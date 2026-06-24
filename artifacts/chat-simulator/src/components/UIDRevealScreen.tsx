import { useState } from "react";
import type { AuthResponse } from "../types";

interface Props {
  auth: AuthResponse;
  onContinue: () => void;
}

export default function UIDRevealScreen({ auth, onContinue }: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(auth.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: ignore */
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card" style={{ maxWidth: 460 }}>

        <div className="uid-title">⚠ Сохраните ваш пароль</div>

        <div className="uid-warning">
          Это единственный раз, когда вы видите свой уникальный пароль-доступ.
          При следующем входе он показан <strong>не будет</strong>.
          Скопируйте его и сохраните в надёжном месте — в заметках, блокноте или менеджере паролей.
        </div>

        <div>
          <label className="field-label">Ваш уникальный пароль (UID)</label>
          <div className="uid-code-block" style={{ cursor: "pointer", userSelect: "all" }} onClick={handleCopy}>
            <span className="uid-code-label">нажмите чтобы скопировать</span>
            <span className="uid-code-value">{auth.uid}</span>
          </div>
          {copied && (
            <div style={{ fontSize: "0.72rem", color: "var(--green)", marginTop: "0.3rem", fontFamily: "JetBrains Mono, monospace" }}>
              ✓ скопировано
            </div>
          )}
        </div>

        <div className="uid-status">
          <span className="uid-status-icon">✉</span>
          <span className="uid-status-text">
            Аккаунт: <strong>{auth.email}</strong>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
          <input
            id="uid-confirm"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ marginTop: "0.15rem", accentColor: "var(--accent)", flexShrink: 0, cursor: "pointer" }}
          />
          <label
            htmlFor="uid-confirm"
            style={{ fontSize: "0.78rem", color: "var(--text2)", cursor: "pointer", lineHeight: 1.5 }}
          >
            Я сохранил(а) свой пароль и понимаю, что восстановить его будет невозможно
          </label>
        </div>

        <button
          className="btn btn-primary"
          onClick={onContinue}
          disabled={!confirmed}
        >
          Начать тренировку →
        </button>
      </div>
    </div>
  );
}
