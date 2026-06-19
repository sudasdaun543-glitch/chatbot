import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { db, sessionsTable, feedbackTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { hasOpenAI, getAIReply, generateAIFeedback, type Archetype, type ChatMessage } from "./openaiClient.js";
import { getNextReply, generateFeedback, cleanupSession } from "./mockAI.js";
import { logger } from "./logger.js";

const sessionHistories = new Map<string, ChatMessage[]>();

export function attachWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = req.url ?? "";
    const match = url.match(/^\/ws\/chat\/([^/?]+)/);
    if (!match) {
      socket.destroy();
      return;
    }
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
    const session = rows[0];
    const archetype = session.archetype as Archetype;

    sessionHistories.set(sessionId, []);

    ws.send(JSON.stringify({
      type: "system",
      role: "system",
      content: `Сессия начата. Архетип: ${archetype}. Начните диалог!`,
      action: null,
      feedback: null,
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

            history.push({ role: "user", content: msg.content });
            sessionHistories.set(sessionId, history);

            let replyText: string;
            let tipAction: { type: string; amount: number } | null = null;

            if (hasOpenAI()) {
              replyText = await getAIReply(archetype, history);
              const isWhale = archetype === "whale" || archetype === "whale_en";
              if (isWhale && history.length >= 6 && Math.random() < 0.3) {
                tipAction = { type: "send_tips", amount: Math.floor(Math.random() * 80 + 20) };
              }
            } else {
              const mock = getNextReply(sessionId, archetype);
              replyText = mock?.content ?? "Продолжим?";
              tipAction = mock?.action ?? null;
            }

            history.push({ role: "assistant", content: replyText });

            if (ws.readyState !== WebSocket.OPEN) return;

            ws.send(JSON.stringify({
              type: "message",
              role: "assistant",
              content: replyText,
              action: tipAction,
              feedback: null,
            }));
          }
        } catch (err: unknown) {
          logger.error({ err }, "WS message error");
          const isQuota =
            typeof err === "object" &&
            err !== null &&
            ("code" in err
              ? (err as { code?: string }).code === "insufficient_quota"
              : "status" in err
                ? (err as { status?: number }).status === 429
                : false);
          const errorText = isQuota
            ? "⚠ Лимит OpenAI исчерпан. Пополните баланс на platform.openai.com/settings/billing"
            : "Ошибка при обработке сообщения. Попробуйте ещё раз.";
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "error",
              role: "system",
              content: errorText,
              action: null,
              feedback: null,
            }));
          }
        }
      })();
    });

    ws.on("close", () => {
      logger.info({ sessionId }, "WS client disconnected");
      sessionHistories.delete(sessionId);
    });
  });
}

async function handleClose(ws: WebSocket, sessionId: string, archetype: Archetype) {
  const history = sessionHistories.get(sessionId) ?? [];

  const feedback = hasOpenAI()
    ? await generateAIFeedback(archetype, history)
    : generateFeedback(sessionId);

  cleanupSession(sessionId);

  try {
    await db.update(sessionsTable)
      .set({ status: "closed", closed_at: new Date() })
      .where(eq(sessionsTable.id, sessionId));

    await db.insert(feedbackTable).values({
      id: crypto.randomUUID(),
      session_id: sessionId,
      score: feedback.score,
      strengths: feedback.strengths,
      mistakes: feedback.mistakes,
    }).onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "Failed to save session feedback");
  }

  ws.send(JSON.stringify({
    type: "system",
    role: "system",
    content: "Сессия завершена",
    action: null,
    feedback,
  }));

  sessionHistories.delete(sessionId);
  ws.close();
}
