import { useEffect, useRef, useState, useCallback } from "react";
import type { FeedbackData, SessionInfo } from "../types";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import AIStatusBadge from "./AIStatusBadge";
import { useWebSocket } from "../hooks/useWebSocket";

interface Props {
  session: SessionInfo;
  onNewSession: () => void;
}

const ARCHETYPE_NAMES: Record<string, string> = {
  greener: "Новичком",
  whale: "Китом",
  troll: "Троллем",
  freeloader: "Халявщиком",
  greener_en: "Newbie (EN)",
  whale_en: "Whale (EN)",
  troll_en: "Troll (EN)",
  freeloader_en: "Freeloader (EN)",
};

export default function ChatWindow({ session, onNewSession }: Props) {
  const { messages, send, isConnected } = useWebSocket(session.id);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [sessionClosed, setSessionClosed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.type === "system" && lastMsg.feedback) {
      setFeedback(lastMsg.feedback);
      setSessionClosed(true);
    }
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      send({ type: "message", content: text });
    },
    [send]
  );

  const handleCloseSession = useCallback(() => {
    send({ type: "close_session", content: "" });
  }, [send]);

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span className="chat-title">
          Чат с{" "}
          <strong>
            {ARCHETYPE_NAMES[session.archetype] ?? session.archetype}
          </strong>
        </span>
        <span className={`connection-status ${isConnected ? "connected" : ""}`}>
          {isConnected ? "● Онлайн" : "● Подключение..."}
        </span>
        <AIStatusBadge />
      </div>

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-chat">
            <p>Начните диалог. Мембер ждёт вас!</p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={chatEndRef} />
      </div>

      {sessionClosed && feedback ? (
        <div className="feedback-overlay">
          <h2>📊 Результат тренировки</h2>
          <div className="feedback-inline-score">
            Оценка: <strong>{feedback.score}</strong> / 10
          </div>
          <div className="feedback-inline-section">
            <h4>✅ Сильные стороны</h4>
            <p>{feedback.strengths}</p>
          </div>
          <div className="feedback-inline-section">
            <h4>⚠ Ошибки</h4>
            <p>{feedback.mistakes}</p>
          </div>
          <button className="btn btn-new-session" onClick={onNewSession}>
            🔄 Начать новую тренировку
          </button>
        </div>
      ) : (
        <MessageInput
          onSend={handleSend}
          onCloseSession={handleCloseSession}
          disabled={!isConnected || sessionClosed}
        />
      )}
    </div>
  );
}
