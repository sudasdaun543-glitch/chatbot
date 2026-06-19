import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { db, sessionsTable, feedbackTable, learningExamplesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { hasOpenAI, getAIReply, generateAIFeedback, type Archetype, type ChatMessage } from "./openaiClient.js";
import { getNextReply, generateFeedback, cleanupSession } from "./mockAI.js";
import { logger } from "./logger.js";

const sessionHistories      = new Map<string, ChatMessage[]>();
const sessionLearningCache  = new Map<string, string[]>();

interface ConvState {
  warmCount: number;
  coldCount: number;
  total: number;
}
const sessionStates = new Map<string, ConvState>();

function analyzeOperatorMessage(content: string): "warm" | "cold" | "neutral" {
  const warmPattern = /привет|хай|как|дела|интерес|расскаж|нравит|хорош|класс|супер|отлич|люб|скуч|hello|hi|how are|nice|great|love|miss|awesome|wow|tell me|curious/i;
  const coldPattern = /^.{1,4}$|^(ок|да|нет|ну|ok|yes|no|k|yep|nope|sure)\.?$/i;
  if (warmPattern.test(content)) return "warm";
  if (coldPattern.test(content.trim())) return "cold";
  return "neutral";
}

function buildStateHint(state: ConvState, archetype: Archetype): string {
  const { warmCount, coldCount, total } = state;
  if (total < 2) return "";
  const warmRatio = warmCount / total;
  const coldRatio = coldCount / total;
  const isRu  = !archetype.endsWith("_en");
  const base  = archetype.replace("_en", "") as "greener" | "whale" | "troll" | "freeloader";

  if (warmRatio >= 0.6) {
    const hints: Record<string, string> = {
      greener:   isRu ? "[Состояние: оператор тёплый. Ты расслабился(-лась), начинаешь открываться.]" : "[State: operator warm. You relax and start opening up.]",
      whale:     isRu ? "[Состояние: оператор работает хорошо. Готов(-а) тратить больше.]" : "[State: operator doing well. You're ready to spend more.]",
      troll:     isRu ? "[Состояние: оператор держится спокойно. Ты немного смягчаешься.]" : "[State: operator stays calm. You soften slightly.]",
      freeloader:isRu ? "[Состояние: оператор уверен. Ты ищешь новые подходы.]" : "[State: operator holds firm. You try new angles.]",
    };
    return hints[base] ?? "";
  }

  if (coldRatio >= 0.6) {
    const hints: Record<string, string> = {
      greener:   isRu ? "[Состояние: оператор холодный. Ты снова замыкаешься.]" : "[State: operator cold. You withdraw.]",
      whale:     isRu ? "[Состояние: оператор не вовлекает. Ты теряешь интерес.]" : "[State: operator not engaging. You lose interest.]",
      troll:     isRu ? "[Состояние: оператор скучный. Усиливаешь провокации.]" : "[State: operator boring. You escalate trolling.]",
      freeloader:isRu ? "[Состояние: оператор не реагирует. Давишь на жалость сильнее.]" : "[State: operator distracted. You guilt-trip harder.]",
    };
    return hints[base] ?? "";
  }

  return "";
}

async function fetchLearningExamples(archetype: Archetype): Promise<string[]> {
  try {
    const rows = await db.select()
      .from(learningExamplesTable)
      .where(eq(learningExamplesTable.archetype, archetype))
      .orderBy(desc(learningExamplesTable.score), desc(learningExamplesTable.created_at))
      .limit(3);
    return rows.map(r => r.conversation);
  } catch {
    return [];
  }
}

async function saveLearningExample(archetype: Archetype, history: ChatMessage[], score: number): Promise<void> {
  if (score < 7 || history.length < 4) return;
  try {
    const conversation = history
      .map(m => `${m.role === "user" ? "ОПЕРАТОР" : "КЛИЕНТ"}: ${m.content}`)
      .join("\n");
    await db.insert(learningExamplesTable).values({
      id:           crypto.randomUUID(),
      archetype,
      conversation,
      score,
    });
    logger.info({ archetype, score }, "Learning example saved");
  } catch (err) {
    logger.warn({ err }, "Failed to save learning example");
  }
}

export function attachWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url   = req.url ?? "";
    const match = url.match(/^\/ws\/chat\/([^/?]+)/);
    if (!match) { socket.destroy(); return; }
    const sessionId = match[1];
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, sessionId);
    });
  });

  wss.on("connection", async (ws: WebSocket, _req: IncomingMessage, sessionId: string) => {
    logger.info({ sessionId }, "WS client connected");

    const rows = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId)).limit(1);
    if (!rows.length) {
      ws.send(JSON.stringify({ type: "error", role: "system", content: "Сессия не найдена", action: null, feedback: null }));
      ws.close();
      return;
    }
    const session  = rows[0];
    const archetype = session.archetype as Archetype;

    sessionHistories.set(sessionId, []);
    sessionStates.set(sessionId, { warmCount: 0, coldCount: 0, total: 0 });

    // Pre-fetch learning examples for this archetype (non-blocking)
    if (hasOpenAI()) {
      fetchLearningExamples(archetype)
        .then(examples => { sessionLearningCache.set(sessionId, examples); })
        .catch(() => { sessionLearningCache.set(sessionId, []); });
    }

    ws.send(JSON.stringify({
      type: "system", role: "system",
      content: `Сессия начата. Архетип: ${archetype}. Начните диалог!`,
      action: null, feedback: null,
    }));

    ws.on("message", (raw) => {
      void (async () => {
        try {
          const msg = JSON.parse(raw.toString()) as { type: string; content?: string };

          if (msg.type === "close_session") {
            await handleClose(ws, sessionId, archetype);
            return;
          }

          if (msg.type === "message" && msg.content) {
            const history = sessionHistories.get(sessionId) ?? [];
            const state   = sessionStates.get(sessionId) ?? { warmCount: 0, coldCount: 0, total: 0 };

            const sentiment = analyzeOperatorMessage(msg.content);
            state.total += 1;
            if (sentiment === "warm") state.warmCount += 1;
            if (sentiment === "cold") state.coldCount += 1;
            sessionStates.set(sessionId, state);

            history.push({ role: "user", content: msg.content });
            sessionHistories.set(sessionId, history);

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "typing", role: "assistant", content: "", action: null, feedback: null }));
            }

            let replyText: string;
            let tipAction: { type: string; amount: number } | null = null;

            if (hasOpenAI()) {
              const stateHint       = buildStateHint(state, archetype);
              const learningExamples = sessionLearningCache.get(sessionId) ?? [];
              replyText = await getAIReply(archetype, history, stateHint || undefined, learningExamples);
              const isWhale = archetype === "whale" || archetype === "whale_en";
              if (isWhale && history.length >= 6 && Math.random() < 0.3) {
                tipAction = { type: "send_tips", amount: Math.floor(Math.random() * 80 + 20) };
              }
            } else {
              const mock = getNextReply(sessionId, archetype);
              replyText  = mock?.content ?? "Продолжим?";
              tipAction  = mock?.action ?? null;
            }

            history.push({ role: "assistant", content: replyText });

            if (ws.readyState !== WebSocket.OPEN) return;

            ws.send(JSON.stringify({
              type: "message", role: "assistant",
              content: replyText, action: tipAction, feedback: null,
            }));
          }
        } catch (err: unknown) {
          logger.error({ err }, "WS message error");
          const isQuota =
            typeof err === "object" && err !== null &&
            ("code" in err
              ? (err as { code?: string }).code === "insufficient_quota"
              : "status" in err
                ? (err as { status?: number }).status === 429
                : false);
          const errorText = isQuota
            ? "Лимит API исчерпан. Пополните баланс."
            : "Ошибка при обработке сообщения. Попробуйте ещё раз.";
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "error", role: "system", content: errorText, action: null, feedback: null }));
          }
        }
      })();
    });

    ws.on("close", () => {
      logger.info({ sessionId }, "WS client disconnected");
      sessionHistories.delete(sessionId);
      sessionStates.delete(sessionId);
      sessionLearningCache.delete(sessionId);
    });
  });
}

async function handleClose(ws: WebSocket, sessionId: string, archetype: Archetype) {
  const history = sessionHistories.get(sessionId) ?? [];

  const feedback = hasOpenAI()
    ? await generateAIFeedback(archetype, history)
    : generateFeedback(sessionId, history);

  cleanupSession(sessionId);

  try {
    await db.update(sessionsTable)
      .set({ status: "closed", closed_at: new Date() })
      .where(eq(sessionsTable.id, sessionId));

    await db.insert(feedbackTable).values({
      id:         crypto.randomUUID(),
      session_id: sessionId,
      score:      feedback.score,
      strengths:  feedback.strengths,
      mistakes:   feedback.mistakes,
    }).onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "Failed to save session feedback");
  }

  // Save successful conversations so the AI can learn from them
  void saveLearningExample(archetype, history, feedback.score);

  ws.send(JSON.stringify({
    type: "system", role: "system",
    content: "Сессия завершена",
    action: null, feedback,
  }));

  sessionHistories.delete(sessionId);
  sessionStates.delete(sessionId);
  ws.close();
}
