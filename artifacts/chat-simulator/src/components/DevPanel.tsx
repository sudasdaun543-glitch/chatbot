import { useState, useEffect, useCallback } from "react";
import type { OperatorInfo } from "../types";

interface Props {
  onBack: () => void;
}

interface CoachAccount {
  id: string;
  login: string;
  role: string;
  created_at: string;
}

export default function DevPanel({ onBack }: Props) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [granted, setGranted] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [operators, setOperators] = useState<OperatorInfo[]>([]);
  const [coaches, setCoaches] = useState<CoachAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"operators" | "coaches">("coaches");

  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCodeSubmit = async () => {
    if (!login.trim() || !password.trim()) return;
    setCodeError(null);
    try {
      const resp = await fetch("/api/dev/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail ?? "Неверный логин или пароль");
      }
      const result = await resp.json();
      if (result.granted) setGranted(true);
    } catch (err: unknown) {
      setCodeError(err instanceof Error ? err.message : "Ошибка доступа");
    }
  };

  const loadOperators = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/coach/operators");
      setOperators(await resp.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/dev/coaches");
      setCoaches(await resp.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!granted) return;
    if (activeTab === "operators") loadOperators();
    else loadCoaches();
  }, [granted, activeTab, loadOperators, loadCoaches]);

  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const handleCreateCoach = async () => {
    if (!newLogin.trim() || !newPassword.trim()) return;
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const resp = await fetch("/api/dev/coaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: newLogin.trim(), password: newPassword }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail ?? "Ошибка создания");
      }
      const created: CoachAccount = await resp.json();
      setCreateSuccess(`✅ Коуч создан: ${created.login}  /  пароль: ${newPassword}`);
      setNewLogin("");
      setNewPassword("");
      loadCoaches();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCoach = async (id: string, coachLogin: string) => {
    if (!confirm(`Удалить коуча «${coachLogin}»?`)) return;
    await fetch(`/api/dev/coaches/${id}`, { method: "DELETE" });
    loadCoaches();
  };

  if (!granted) {
    return (
      <div className="coach-panel login-screen">
        <h2 className="app-title">🛠 Панель Разработчика</h2>
        <p className="subtitle">Войдите как разработчик</p>
        <div className="login-form">
          <label htmlFor="dev-login">Логин</label>
          <input
            id="dev-login"
            type="text"
            className="form-input"
            placeholder="Логин разработчика"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
            autoFocus
            autoComplete="username"
          />
          <label htmlFor="dev-password">Пароль</label>
          <input
            id="dev-password"
            type="password"
            className="form-input"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
            autoComplete="current-password"
          />
          {codeError && <p className="error-message">❌ {codeError}</p>}
          <button
            className="btn btn-start"
            onClick={handleCodeSubmit}
            disabled={!login.trim() || !password.trim()}
          >
            🔑 Войти
          </button>
        </div>
        <p className="coach-link" onClick={onBack}>↩ Назад к панели коуча</p>
      </div>
    );
  }

  return (
    <div className="coach-panel">
      <h2 className="app-title">🛠 Панель Разработчика</h2>

      <div className="coach-tabs">
        <button
          className={`coach-tab ${activeTab === "coaches" ? "active" : ""}`}
          onClick={() => setActiveTab("coaches")}
        >
          🛡 Аккаунты коучей
        </button>
        <button
          className={`coach-tab ${activeTab === "operators" ? "active" : ""}`}
          onClick={() => setActiveTab("operators")}
        >
          👥 Все операторы
        </button>
      </div>

      {loading && <p className="subtitle" style={{ marginTop: 16 }}>Загрузка...</p>}

      {activeTab === "coaches" && (
        <>
          <div className="dev-create-form">
            <h3 style={{ color: "#f0f0f0", marginBottom: 12, fontSize: "1rem" }}>
              ➕ Новый аккаунт коуча
            </h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 160px" }}>
                <label style={{ fontSize: "0.8rem", color: "#aaa", display: "block", marginBottom: 4 }}>
                  Логин
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="login_coach"
                  value={newLogin}
                  onChange={(e) => setNewLogin(e.target.value)}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <label style={{ fontSize: "0.8rem", color: "#aaa", display: "block", marginBottom: 4 }}>
                  Пароль
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="пароль"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ marginBottom: 0, flex: 1 }}
                  />
                  <button
                    className="coach-refresh-btn"
                    style={{ whiteSpace: "nowrap", padding: "8px 10px" }}
                    onClick={() => setNewPassword(generatePassword())}
                    title="Сгенерировать пароль"
                  >
                    🎲
                  </button>
                </div>
              </div>
              <button
                className="btn btn-send"
                style={{ padding: "10px 20px", whiteSpace: "nowrap" }}
                disabled={!newLogin.trim() || !newPassword.trim() || creating}
                onClick={handleCreateCoach}
              >
                {creating ? "Создаём..." : "✅ Создать"}
              </button>
            </div>
            {createError && <p className="error-message" style={{ marginTop: 8 }}>❌ {createError}</p>}
            {createSuccess && (
              <p style={{ marginTop: 8, color: "#4caf50", fontSize: "0.85rem", fontFamily: "monospace" }}>
                {createSuccess}
              </p>
            )}
          </div>

          <div className="coach-table-wrap">
            <table className="coach-table">
              <thead>
                <tr>
                  <th>Логин</th>
                  <th>Роль</th>
                  <th>Создан</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {coaches.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "24px", color: "#666" }}>
                      Нет аккаунтов
                    </td>
                  </tr>
                )}
                {coaches.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.login}</strong></td>
                    <td>🛡 Коуч</td>
                    <td>{new Date(c.created_at).toLocaleString("ru")}</td>
                    <td>
                      <button
                        className="btn btn-close"
                        style={{ padding: "4px 12px", fontSize: "0.82rem" }}
                        onClick={() => handleDeleteCoach(c.id, c.login)}
                      >
                        🗑 Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "operators" && (
        <div className="coach-table-wrap">
          <table className="coach-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>UID</th>
                <th>Имя</th>
                <th>Роль</th>
                <th>Вериф.</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op) => (
                <tr key={op.id}>
                  <td>{op.email || "—"}</td>
                  <td className="uid-cell">{op.id}</td>
                  <td>{op.name}</td>
                  <td>{op.role}</td>
                  <td>{op.verified ? "✅" : "❌"}</td>
                  <td>{new Date(op.created_at).toLocaleString("ru")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="btn btn-close" onClick={onBack} style={{ marginTop: 16 }}>
        ↩ Назад к панели коуча
      </button>
    </div>
  );
}
