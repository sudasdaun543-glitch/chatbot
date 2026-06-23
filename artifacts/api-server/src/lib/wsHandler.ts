import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { db, sessionsTable, feedbackTable, learningExamplesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import {
  hasOpenAI, getAIReply, generateAIFeedback,
  type Archetype, type ChatMessage, type ConversationPhase,
} from "./openaiClient.js";
import { getNextReply, generateFeedback, cleanupSession } from "./mockAI.js";
import { logger } from "./logger.js";

const sessionHistories     = new Map<string, ChatMessage[]>();
const sessionLearningCache = new Map<string, string[]>();

interface ConvState {
  totalMessages: number;
  warmStreak:    number;
  coldStreak:    number;
  contentAsked:  boolean;
  personalAsked: boolean;
  actionTaken:   boolean;
}

const sessionStates = new Map<string, ConvState>();

const CONTENT_PATTERN = /приват|привате|покаж|раздев|голая|голый|ценник|стоит|сколько|купить|private|pvt|topless|naked|nude|price|how much|fully|panties|pussy|boobs|butt|pic\b|show me/i;
const PERSONAL_PATTERN = /сколько лет|откуда|возраст|как тебя|твоё имя|давно ли|how old|where are you from|your name|how long|age|country|city/i;
const WARM_PATTERN    = /привет|хай|как дела|интересно|расскаж|нравится|классно|супер|отлично|люблю|скучаю|hello|hi\b|how are|nice|great|love|miss|awesome|wow|tell me|curious|pretty|beautiful|gorgeous|sweetie|darling|princess/i;
const COLD_PATTERN    = /^.{1,3}$|^(ок|да|нет|ну|ok|yes|no|k|yep|nope|sure|fine)\.?$/i;
const ACTION_PATTERN  = /оплат|заплат|куплю|беру|в приват|paid|pay|bought|private now|tip|чаевые/i;

function analyzeOperatorMessage(content: string): "warm" | "cold" | "neutral" {
  if (WARM_PATTERN.test(content)) return "warm";
  if (COLD_PATTERN.test(content.trim())) return "cold";
  return "neutral";
}

function detectPhase(state: ConvState, history: ChatMessage[]): ConversationPhase {
  const { totalMessages, contentAsked, personalAsked, actionTaken } = state;

  if (totalMessages <= 1) return "opening";
  if (actionTaken)        return "post_action";

  if (totalMessages >= 12) return "exit";

  if (contentAsked && personalAsked) return "negotiation";
  if (contentAsked) return "personal_connect";
  if (totalMessages >= 4 && !contentAsked) return "content_inquiry";

  const lastOperator = [...history].reverse().find(m => m.role === "user");
  if (lastOperator) {
    if (CONTENT_PATTERN.test(lastOperator.content)) return "content_inquiry";
    if (PERSONAL_PATTERN.test(lastOperator.content)) return "personal_connect";
  }

  return "opening";
}

function updateState(state: ConvState, operatorMessage: string, quality: "warm" | "cold" | "neutral"): void {
  state.totalMessages += 1;

  if (quality === "warm") {
    state.warmStreak += 1;
    state.coldStreak  = 0;
  } else if (quality === "cold") {
    state.coldStreak += 1;
    state.warmStreak  = 0;
  } else {
    state.warmStreak  = 0;
    state.coldStreak  = 0;
  }

  if (CONTENT_PATTERN.test(operatorMessage))  state.contentAsked  = true;
  if (PERSONAL_PATTERN.test(operatorMessage)) state.personalAsked = true;
  if (ACTION_PATTERN.test(operatorMessage))   state.actionTaken   = true;
}

function resolveOperatorQuality(state: ConvState): "warm" | "cold" | "neutral" {
  if (state.warmStreak >= 2) return "warm";
  if (state.coldStreak >= 2) return "cold";
  return "neutral";
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

const OPENING_MESSAGES: Record<string, string[]> = {
  greener: [
    "хай)",
    "ку",
    "привет)",
    "о, привет",
    "хм)",
    "хай хай",
    "о, тут живые есть?",
    "привет, ты настоящая?",
    "здарова",
    "ого)",
  ],
  whale: [
    "привет красотка)",
    "хай, солнышко)",
    "о, привет красавица",
    "хай)",
    "привет, заглянул)",
    "о, кто тут у нас)",
    "хай, давно не был)",
    "привет милая)",
    "ооо, хороша)",
    "привет звёздочка)",
  ],
  troll: [
    "ну и чо",
    "хм",
    "ага",
    "ну привет что ли",
    "смотрим смотрим",
    "ну давай",
    "ок",
    "чо как",
    "занятно",
    "посмотрим посмотрим",
  ],
  freeloader: [
    "привет)",
    "хай",
    "ку, ты добрая?)",
    "привет, как дела?",
    "хай, ты хорошая?)",
    "о привет)",
    "здравствуй)",
    "привет, ты добрая девушка?",
    "хай хай)",
    "привет, зашёл посмотреть)",
  ],
  greener_en: [
    "hey)",
    "hi)",
    "heyy",
    "oh hi)",
    "hey there)",
    "oh, you're live)",
    "hii",
    "hey, real person?)",
    "oh hey)",
    "hi hi)",
  ],
  whale_en: [
    "hey gorgeous)",
    "hi sweetie)",
    "oh hey beautiful)",
    "hey darling)",
    "hi there, pretty)",
    "oh, hello)",
    "heyy)",
    "hi princess)",
    "oh gorgeous)",
    "hey lovely)",
  ],
  troll_en: [
    "hmm",
    "ok",
    "yeah",
    "so",
    "lol hi",
    "whatever",
    "uh hi",
    "sure sure",
    "ok then",
    "interesting",
  ],
  freeloader_en: [
    "hey)",
    "hi there)",
    "heyy)",
    "oh hey)",
    "hi, you nice?)",
    "hello)",
    "hey, you kind?)",
    "hi hi)",
    "hii)",
    "hey, came to watch)",
  ],
};

function pickOpeningMessage(archetype: string): string {
  const pool = OPENING_MESSAGES[archetype] ?? OPENING_MESSAGES["greener"];
  return pool[Math.floor(Math.random() * pool.length)];
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
    const session   = rows[0];
    const archetype = session.archetype as Archetype;

    sessionHistories.set(sessionId, []);
    sessionStates.set(sessionId, {
      totalMessages: 0,
      warmStreak:    0,
      coldStreak:    0,
      contentAsked:  false,
      personalAsked: false,
      actionTaken:   false,
    });

    let learningExamplesReady: string[] = [];
    if (hasOpenAI()) {
      try {
        learningExamplesReady = await fetchLearningExamples(archetype);
      } catch {
        learningExamplesReady = [];
      }
      sessionLearningCache.set(sessionId, learningExamplesReady);
    }

    ws.send(JSON.stringify({
      type: "system", role: "system",
      content: `Сессия начата. Архетип: ${archetype}. Начните диалог!`,
      action: null, feedback: null,
    }));

    // AI sends the opening message first (client enters chat) — picked from a random pool
    if (ws.readyState === WebSocket.OPEN) {
      const openingReply = pickOpeningMessage(archetype);
      const history = sessionHistories.get(sessionId) ?? [];
      history.push({ role: "assistant", content: openingReply });
      sessionHistories.set(sessionId, history);
      // small delay so the system message renders first
      await new Promise(r => setTimeout(r, 400));
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "message", role: "assistant", content: openingReply, action: null, feedback: null }));
      }
    }

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
            const state   = sessionStates.get(sessionId) ?? {
              totalMessages: 0, warmStreak: 0, coldStreak: 0,
              contentAsked: false, personalAsked: false, actionTaken: false,
            };

            const quality = analyzeOperatorMessage(msg.content);
            updateState(state, msg.content, quality);
            sessionStates.set(sessionId, state);

            history.push({ role: "user", content: msg.content });
            sessionHistories.set(sessionId, history);

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "typing", role: "assistant", content: "", action: null, feedback: null }));
            }

            let replyText: string;
            let tipAction: { type: string; amount: number } | null = null;

            if (hasOpenAI()) {
              const phase           = detectPhase(state, history);
              const operatorQuality = resolveOperatorQuality(state);
              const learningExamples = sessionLearningCache.get(sessionId) ?? [];

              logger.info({ sessionId, phase, operatorQuality, totalMessages: state.totalMessages }, "AI reply context");

              replyText = (await getAIReply(archetype, history, phase, operatorQuality, learningExamples)).replace(/\n+/g, " ").trim();

              const isWhale = archetype === "whale" || archetype === "whale_en";
              if (isWhale && state.totalMessages >= 6 && operatorQuality === "warm" && Math.random() < 0.35) {
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
