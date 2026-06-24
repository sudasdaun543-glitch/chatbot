import type { ChatMessage } from "../types";
import bunnyImg from "../assets/bunny.png";

interface Props {
  message: ChatMessage;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message }: Props) {
  const { role, content, action, type } = message;
  const time = formatTime(new Date());

  if (type === "system" || role === "system") {
    return (
      <div className="message-row center">
        <div className="bubble system-bubble">
          {content}
          {action?.type === "send_tips" && (
            <div className="tip-notification">
              💰 Пользователь зачислил <strong>{action.amount}</strong> токенов
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "error") {
    return (
      <div className="message-row center">
        <div className="error-bubble">{content}</div>
      </div>
    );
  }

  if (role === "assistant") {
    return (
      <div className="message-row left">
        <img src={bunnyImg} alt="" className="msg-avatar" />
        <div className="msg-content-col">
          <div className="bubble member-bubble">
            {content}
            {action?.type === "send_tips" && (
              <div className="tip-action-badge">💰 +{action.amount} токенов</div>
            )}
          </div>
          <span className="bubble-time">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="message-row right">
      <div className="msg-content-col" style={{ alignItems: "flex-end" }}>
        <div className="bubble operator-bubble">{content}</div>
        <span className="bubble-time">{time}</span>
      </div>
    </div>
  );
}
