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

const ARCHETYPE_META: Record<string, { name: string; emoji: string; color: string }> = {
  greener:      { name: "Новичок",    emoji: "🌱", color: "#22c55e" },
  whale:        { name: "Кит",        emoji: "🐋", color: "#7c6ef5" },
  troll:        { name: "Тролль",     emoji: "👹", color: "#ef4444" },
  freeloader:   { name: "Халявщик",   emoji: "🤑", color: "#f59e0b" },
  greener_en:   { name: "Newbie",     emoji: "🌱", color: "#22c55e" },
  whale_en:     { name: "Whale",      emoji: "🐋", color: "#7c6ef5" },
  troll_en:     { name: "Troll",      emoji: "👹", color: "#ef4444" },
  freeloader_en:{ name: "Freeloader", emoji: "🤑", color: "#f59e0b" },
};

export default function ChatWindow({ session, onNewSession }: Props) {
  const { messages, send, isConnected, isTyping } = useWebSocket(session.id);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [sessionClosed, setSessionClosed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const meta = ARCHETYPE_META[session.archetype] ?? { name: session.archetype, emoji: "👤", color: "#7c6ef5" };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.type === "system" && lastMsg.feedback) {
      setFeedback(lastMsg.feedback);
      setSessionClosed(true);
    }
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => { send({ type: "message", content: text }); },
    [send]
  );

  const handleCloseSession = useCallback(() => {
    send({ type: "close_session", content: "" });
  }, [send]);

  const scoreColor = feedback
    ? feedback.score >= 8 ? "var(--green)" : feedback.score >= 5 ? "var(--yellow)" : "var(--red)"
    : "var(--text)";

  return (
    <div className="chat-layout">
      <div className="chat-sidebar">
        <div
          className="member-avatar"
          style={{ background: `${meta.color}22`, border: `2px solid ${meta.color}44` }}
        >
          {meta.emoji}
          {isConnected && <div className="avatar-online-dot" />}
        </div>
        <div className="sidebar-archetype-label">{meta.name}</div>
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-header-left">
            <span className="chat-title">Чат с {meta.name}</span>
            <span className={`connection-status ${isConnected ? "connected" : ""}`}>
              {isConnected ? "В сети" : "Подключение..."}
            </span>
          </div>
          <AIStatusBadge />
        </div>

        <div className="messages-container">
          {messages.length === 0 && (
            <div className="empty-chat">
              <div className="empty-chat-icon">{meta.emoji}</div>
              <p className="empty-chat-text">Напишите первое сообщение</p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isTyping && (
            <div className="message-row left">
              <div className="typing-bubble">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {sessionClosed && feedback ? (
          <div className="feedback-overlay">
            <div className="feedback-score-ring">
              <div className="feedback-score-number" style={{ color: scoreColor }}>
                {feedback.score}<span style={{ fontSize: "1.1rem", color: "var(--text2)", fontWeight: 400 }}>/10</span>
              </div>
              <div className="feedback-score-label">Результат тренировки</div>
            </div>
            <div className="feedback-inline-section">
              <h4>Сильные стороны</h4>
              <p>{feedback.strengths}</p>
            </div>
            <div className="feedback-inline-section">
              <h4>Зоны роста</h4>
              <p>{feedback.mistakes}</p>
            </div>
            <button className="btn btn-new-session" onClick={onNewSession}>
              Новая тренировка
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
    </div>
  );
}
