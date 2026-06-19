import { useState, type FormEvent } from "react";
import type { AuthResponse } from "../types";

interface Props {
  onLogin: (auth: AuthResponse) => void;
  onCoachPanel: () => void;
}

export default function LoginScreen({ onLogin, onCoachPanel }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail ?? "Ошибка входа");
      }

      const auth: AuthResponse = await resp.json();
      onLogin(auth);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <h1 className="app-title">🤖 AI Chat Simulator</h1>
      <p className="subtitle">Тренажёр для операторов вебкам-чата</p>

      <form className="login-form" onSubmit={handleLogin}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="form-input"
          placeholder="operator@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
        />

        {error && <p className="error-message">❌ {error}</p>}

        <button
          type="submit"
          className="btn btn-start"
          disabled={loading || !email.trim()}
        >
          {loading ? "Вход..." : "🔑 Войти"}
        </button>
      </form>

      <p className="coach-link" onClick={onCoachPanel}>
        🛡 Панель Коуча
      </p>
    </div>
  );
}
