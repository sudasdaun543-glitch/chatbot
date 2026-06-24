import { useEffect, useState, useCallback, useMemo } from "react";
import type { OperatorInfo, SessionWithResult } from "../types";

interface Props {
  onBack: () => void;
  onDevPanel: () => void;
}

type Tab = "operators" | "sessions" | "leaderboard";
type SortOrder = "asc" | "desc" | null;

const ARCHETYPE_LABELS: Record<string, string> = {
  greener: "🌱 Новичок",
  whale: "🐋 Кит",
  troll: "👹 Тролль",
  freeloader: "🤑 Халявщик",
  greener_en: "🌱 Newbie (EN)",
  whale_en: "🐋 Whale (EN)",
  troll_en: "👹 Troll (EN)",
  freeloader_en: "🤑 Freeloader (EN)",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="score-badge score-none">—</span>;
  const cls = score >= 7 ? "score-high" : score >= 4 ? "score-mid" : "score-low";
  return <span className={`score-badge ${cls}`}>{score}/10</span>;
}

function TotalScoreBadge({ total, count }: { total: number; count: number }) {
  if (count === 0) return <span className="score-badge score-none">—</span>;
  const avg = total / count;
  const cls = avg >= 7 ? "score-high" : avg >= 4 ? "score-mid" : "score-low";
  return (
    <span className={`score-badge ${cls}`} title={`${count} оценённых сессий`}>
      {total}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span className={`status-badge ${isActive ? "status-active" : "status-closed"}`}>
      {isActive ? "● В процессе" : "✓ Завершён"}
    </span>
  );
}

function SortIcon({ order }: { order: SortOrder }) {
  if (order === "asc")  return <span style={{ marginLeft: 4 }}>↑</span>;
  if (order === "desc") return <span style={{ marginLeft: 4 }}>↓</span>;
  return <span style={{ marginLeft: 4, opacity: 0.4 }}>↕</span>;
}

export default function CoachPanel({ onBack, onDevPanel }: Props) {
  const [login, setLogin]       = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken]       = useState<string | null>(null);
  const [granted, setGranted]   = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [operators, setOperators] = useState<OperatorInfo[]>([]);
  const [sessions, setSessions]   = useState<SessionWithResult[]>([]);
  const [loading, setLoading]     = useState(false);
  const [clearing, setClearing]   = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("operators");
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  // ─── Authenticated fetch helper ──────────────────────────────────────────

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}): Promise<Response> => {
    const resp = await fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers ?? {}),
        Authorization: `Bearer ${token ?? ""}`,
      },
    });
    if (resp.status === 401) {
      setGranted(false);
      setToken(null);
      setCodeError("Сессия истекла. Войдите снова.");
    }
    return resp;
  }, [token]);

  // ─── Login ───────────────────────────────────────────────────────────────

  const handleCodeSubmit = async () => {
    if (!login.trim() || !password.trim()) return;
    setCodeError(null);
    try {
      const resp = await fetch("/api/coach/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail ?? "Неверный логин или пароль");
      }
      const result = await resp.json();
      if (result.granted && result.token) {
        setToken(result.token);
        setGranted(true);
      }
    } catch (err: unknown) {
      setCodeError(err instanceof Error ? err.message : "Ошибка доступа");
    }
  };

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadOperators = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authFetch("/api/coach/operators");
      if (resp.ok) setOperators(await resp.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [authFetch]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authFetch("/api/coach/sessions");
      if (resp.ok) setSessions(await resp.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [authFetch]);

  useEffect(() => {
    if (granted) { loadOperators(); loadSessions(); }
  }, [granted, loadOperators, loadSessions]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "operators") loadOperators();
    else loadSessions();
  };

  const toggleSort = () =>
    setSortOrder(prev => prev === null ? "desc" : prev === "desc" ? "asc" : null);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const leaderboard = useMemo(() => {
    const map = new Map<string, { nik: string; total: number; count: number }>();
    for (const s of sessions) {
      const key = s.operator_id ?? "__unknown__";
      const nik = s.operator_email || s.operator_name || key.slice(0, 8);
      const prev = map.get(key) ?? { nik, total: 0, count: 0 };
      map.set(key, {
        nik: prev.nik || nik,
        total: prev.total + (s.score ?? 0),
        count: prev.count + (s.score !== null ? 1 : 0),
      });
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [sessions]);

  const operatorTotals = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const s of sessions) {
      const key = s.operator_id ?? "__unknown__";
      const prev = map.get(key) ?? { total: 0, count: 0 };
      map.set(key, {
        total: prev.total + (s.score ?? 0),
        count: prev.count + (s.score !== null ? 1 : 0),
      });
    }
    return map;
  }, [sessions]);

  const scoredSessions = useMemo(() => sessions.filter(s => s.score !== null), [sessions]);
  const totalScore     = useMemo(() => scoredSessions.reduce((s, r) => s + (r.score ?? 0), 0), [scoredSessions]);
  const averageScore   = useMemo(
    () => scoredSessions.length > 0 ? (totalScore / scoredSessions.length).toFixed(1) : "—",
    [totalScore, scoredSessions],
  );

  const sortedSessions = useMemo(() => {
    if (!sortOrder) return sessions;
    return [...sessions].sort((a, b) => {
      const sa = a.score ?? -1, sb = b.score ?? -1;
      return sortOrder === "asc" ? sa - sb : sb - sa;
    });
  }, [sessions, sortOrder]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleClearSessions = async () => {
    if (!confirm("Удалить ВСЕ сессии и баллы? Это действие необратимо.")) return;
    setClearing(true);
    try {
      await authFetch("/api/coach/clear-sessions", { method: "DELETE" });
      setSessions([]);
    } catch { /* ignore */ } finally { setClearing(false); }
  };

  const verify = async (id: string, verified: boolean) => {
    await authFetch(`/api/coach/verify/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified }),
    });
    loadOperators();
  };

  const exportCsv = () => {
    const ARCHETYPE_CSV: Record<string, string> = {
      greener: "Новичок", whale: "Кит", troll: "Тролль", freeloader: "Халявщик",
      greener_en: "Newbie EN", whale_en: "Whale EN", troll_en: "Troll EN", freeloader_en: "Freeloader EN",
    };
    const header = ["Σ Балл оп.", "Оператор", "Email", "Архетип", "Статус", "Оценка", "Сильные стороны", "Ошибки", "Дата"];
    const rows = sessions.map((s) => {
      const tot = operatorTotals.get(s.operator_id ?? "__unknown__") ?? { total: 0, count: 0 };
      return [
        tot.count > 0 ? tot.total : "",
        s.operator_name ?? "", s.operator_email ?? "",
        ARCHETYPE_CSV[s.archetype] ?? s.archetype,
        s.status === "active" ? "В процессе" : "Завершён",
        s.score ?? "",
        (s.strengths ?? "").replace(/"/g, '""'),
        (s.mistakes ?? "").replace(/"/g, '""'),
        new Date(s.created_at).toLocaleString("ru"),
      ];
    });
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Login screen ─────────────────────────────────────────────────────────

  if (!granted) {
    return (
      <div className="coach-panel login-screen">
        <h2 className="app-title">🛡 Панель Коуча</h2>
        <p className="subtitle">Войдите как коуч</p>
        <div className="login-form">
          <label htmlFor="coach-login">Логин</label>
          <input id="coach-login" type="text" className="form-input"
            placeholder="Логин коуча" value={login}
            onChange={(e) => setLogin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
            autoFocus autoComplete="username" />
          <label htmlFor="coach-password">Пароль</label>
          <input id="coach-password" type="password" className="form-input"
            placeholder="Пароль" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
            autoComplete="current-password" />
          {codeError && <p className="error-message">❌ {codeError}</p>}
          <button className="btn btn-start" onClick={handleCodeSubmit}
            disabled={!login.trim() || !password.trim()}>
            🔑 Войти
          </button>
        </div>
        <p className="coach-link" onClick={onBack}>↩ Назад к входу</p>
      </div>
    );
  }

  // ─── Main panel ───────────────────────────────────────────────────────────

  return (
    <div className="coach-panel">
      <h2 className="app-title">🛡 Панель Коуча</h2>

      <div className="coach-tabs">
        <button className={`coach-tab ${activeTab === "operators" ? "active" : ""}`}
          onClick={() => handleTabChange("operators")}>
          👥 Операторы
        </button>
        <button className={`coach-tab ${activeTab === "sessions" ? "active" : ""}`}
          onClick={() => handleTabChange("sessions")}>
          📊 Сессии и результаты
        </button>
        <button className={`coach-tab ${activeTab === "leaderboard" ? "active" : ""}`}
          onClick={() => handleTabChange("leaderboard")}>
          🏆 Рейтинг
        </button>
      </div>

      {loading && <p className="subtitle" style={{ marginTop: 16 }}>Загрузка...</p>}

      {/* ── OPERATORS TAB ── */}
      {activeTab === "operators" && (
        <div className="coach-table-wrap">
          <table className="coach-table">
            <thead>
              <tr>
                <th>Email</th><th>UID</th><th>Роль</th><th>Вериф.</th><th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {operators.length === 0 && !loading && (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "#666" }}>Нет операторов</td></tr>
              )}
              {operators.map((op) => (
                <tr key={op.id}>
                  <td>{op.email || op.name}</td>
                  <td className="uid-cell">{op.id}</td>
                  <td>{op.role}</td>
                  <td>{op.verified ? "✅" : "❌"}</td>
                  <td>
                    {op.verified ? (
                      <button className="btn btn-close"
                        style={{ padding: "4px 12px", fontSize: "0.82rem" }}
                        onClick={() => verify(op.id, false)}>Отменить</button>
                    ) : (
                      <button className="btn btn-start"
                        style={{ padding: "4px 12px", fontSize: "0.82rem", width: "auto" }}
                        onClick={() => verify(op.id, true)}>Верифицировать</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SESSIONS TAB ── */}
      {activeTab === "sessions" && (
        <>
          {sessions.length > 0 && (
            <div style={{
              display: "flex", gap: 24, padding: "12px 16px",
              margin: "12px 0 8px", background: "rgba(255,255,255,0.04)",
              borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap",
            }}>
              {[
                { label: "Всего сессий", value: sessions.length, color: "#e2e8f0" },
                { label: "Оценённых", value: scoredSessions.length, color: "#e2e8f0" },
                {
                  label: "Общий балл",
                  value: totalScore,
                  color: scoredSessions.length > 0 && totalScore / scoredSessions.length >= 7 ? "#4ade80"
                       : scoredSessions.length > 0 && totalScore / scoredSessions.length >= 4 ? "#facc15"
                       : "#f87171",
                },
                {
                  label: "Средний балл",
                  value: averageScore === "—" ? "—" : `${averageScore}/10`,
                  color: Number(averageScore) >= 7 ? "#4ade80" : Number(averageScore) >= 4 ? "#facc15" : "#f87171",
                },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: "1.25rem", fontWeight: 700, color: item.color }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="coach-table-wrap">
            <table className="coach-table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap", color: "#facc15" }} title="Суммарный балл оператора по всем сессиям">
                    Σ Итог
                  </th>
                  <th>Оператор</th>
                  <th>Архетип</th>
                  <th>Статус</th>
                  <th onClick={toggleSort}
                    style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    title="Нажмите для сортировки">
                    Оценка <SortIcon order={sortOrder} />
                  </th>
                  <th>Сильные стороны</th>
                  <th>Ошибки</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.length === 0 && !loading && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "#666" }}>Нет сессий</td></tr>
                )}
                {sortedSessions.map((s) => {
                  const tot = operatorTotals.get(s.operator_id ?? "__unknown__") ?? { total: 0, count: 0 };
                  return (
                    <tr key={s.id}>
                      <td style={{ textAlign: "center" }}>
                        <TotalScoreBadge total={tot.total} count={tot.count} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                          {s.operator_email || s.operator_name || "—"}
                        </div>
                        <div className="uid-cell" style={{ marginTop: 2 }}>{s.operator_id ?? "—"}</div>
                      </td>
                      <td>{ARCHETYPE_LABELS[s.archetype] ?? s.archetype}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td><ScoreBadge score={s.score} /></td>
                      <td style={{ maxWidth: 200, fontSize: "0.82rem", color: "#4ade80" }}>
                        {s.strengths ?? <span style={{ color: "#666" }}>—</span>}
                      </td>
                      <td style={{ maxWidth: 200, fontSize: "0.82rem", color: "#f3a0c9" }}>
                        {s.mistakes ?? <span style={{ color: "#666" }}>—</span>}
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "#666", whiteSpace: "nowrap" }}>
                        {new Date(s.created_at).toLocaleString("ru")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── LEADERBOARD TAB ── */}
      {activeTab === "leaderboard" && (
        <div className="coach-table-wrap">
          <table className="coach-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center", color: "#facc15" }}>#</th>
                <th>Ник / Email</th>
                <th style={{ textAlign: "center", color: "#facc15" }}>Общий балл</th>
                <th style={{ textAlign: "center" }}>Сессий</th>
                <th style={{ textAlign: "center" }}>Ср. балл</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "#666" }}>
                    Нет данных — сессии ещё не оценены
                  </td>
                </tr>
              )}
              {leaderboard.map((row, i) => {
                const avg = row.count > 0 ? (row.total / row.count).toFixed(1) : "—";
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
                const totalColor = row.count > 0 && row.total / row.count >= 7 ? "#4ade80"
                                 : row.count > 0 && row.total / row.count >= 4 ? "#facc15"
                                 : "#f87171";
                return (
                  <tr key={i} style={i === 0 ? { background: "rgba(250,204,21,0.06)" } : undefined}>
                    <td style={{ textAlign: "center", fontSize: "1.1rem" }}>{medal}</td>
                    <td><span style={{ fontWeight: 600 }}>{row.nik}</span></td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: "1.15rem", color: totalColor }}>
                        {row.count > 0 ? row.total : "—"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", color: "#aaa" }}>{row.count}</td>
                    <td style={{ textAlign: "center" }}>
                      {avg !== "—"
                        ? <ScoreBadge score={parseFloat(avg)} />
                        : <span style={{ color: "#666" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div className="coach-actions">
        <button className="btn btn-close" onClick={onBack}>↩ Назад к входу</button>
        <button className="coach-refresh-btn"
          onClick={() => activeTab === "operators" ? loadOperators() : loadSessions()}>
          🔄 Обновить
        </button>
        {activeTab === "sessions" && sessions.length > 0 && (
          <button className="coach-refresh-btn" onClick={exportCsv}>
            📥 Скачать CSV
          </button>
        )}
        {(activeTab === "sessions" || activeTab === "leaderboard") && (
          <button
            className="btn btn-close"
            style={{ background: "rgba(239,68,68,0.15)", borderColor: "#ef4444", color: "#f87171" }}
            onClick={handleClearSessions}
            disabled={clearing}
          >
            {clearing ? "Очищаем..." : "🗑 Очистить все сессии"}
          </button>
        )}
        <button className="btn btn-send" onClick={onDevPanel}>🛠 Панель разработчика</button>
      </div>
    </div>
  );
}
