import { useState, type FormEvent, type KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  onCloseSession: () => void;
  disabled: boolean;
}

export default function MessageInput({ onSend, onCloseSession, disabled }: Props) {
  const [text, setText] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="message-input-container" onSubmit={handleSubmit}>
      <textarea
        className="message-input-field"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Введите сообщение..."
        rows={2}
        disabled={disabled}
        autoFocus
      />
      <div className="input-actions">
        <button
          type="submit"
          className="btn btn-send"
          disabled={disabled || !text.trim()}
        >
          Отправить
        </button>
        <button
          type="button"
          className="btn btn-close"
          onClick={onCloseSession}
          disabled={disabled}
        >
          Завершить сессию
        </button>
      </div>
    </form>
  );
}
