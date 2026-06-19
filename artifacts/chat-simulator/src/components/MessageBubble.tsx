import type { ChatMessage } from "../types";

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const { role, content, action, type } = message;

  if (type === "system" || role === "system") {
    return (
      <div className="message-row system">
        <div className="bubble system-bubble">
          <p className="system-text">{content}</p>
          {action && action.type === "send_tips" && (
            <p className="tip-notification">
              💰 Пользователь зачислил <strong>{action.amount}</strong> токенов
            </p>
          )}
        </div>
      </div>
    );
  }

  if (type === "error") {
    return (
      <div className="message-row system">
        <div className="bubble error-bubble">
          <p className="error-text">⚠ {content}</p>
        </div>
      </div>
    );
  }

  if (role === "assistant") {
    return (
      <div className="message-row left">
        <div className="bubble member-bubble">
          <p className="bubble-role-label">Мембер</p>
          <p className="bubble-text">{content}</p>
          {action && action.type === "send_tips" && (
            <div className="tip-action-badge">
              💰 +{action.amount} токенов
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="message-row right">
      <div className="bubble operator-bubble">
        <p className="bubble-role-label">Вы</p>
        <p className="bubble-text">{content}</p>
      </div>
    </div>
  );
}
