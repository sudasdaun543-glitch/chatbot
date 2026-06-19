import { useState } from "react";
import type { Archetype, SessionInfo } from "../types";

interface ArchetypeConfig {
  emoji: string;
  title: string;
  desc: string;
  color: string;
}

const ARCHETYPES: Record<Archetype, ArchetypeConfig> = {
  greener:     { emoji: "🌱", title: "Новичок",     desc: "Первый раз на платформе, стесняется, сомневается", color: "#22c55e" },
  whale:       { emoji: "🐋", title: "Кит",          desc: "Готов тратить, ценит эксклюзив и внимание",        color: "#3b82f6" },
  troll:       { emoji: "👹", title: "Тролль",       desc: "Провоцирует, грубит, не собирается платить",        color: "#ef4444" },
  freeloader:  { emoji: "🤑", title: "Халявщик",     desc: "Постоянно просит бесплатно, ищет скидки",           color: "#f59e0b" },
  greener_en:  { emoji: "🌱", title: "Newbie",        desc: "First time, shy, unsure about spending",            color: "#22c55e" },
  whale_en:    { emoji: "🐋", title: "Whale",         desc: "High spender, values exclusivity and attention",    color: "#3b82f6" },
  troll_en:    { emoji: "👹", title: "Troll",         desc: "Provokes, rude, says won't pay",                    color: "#ef4444" },
  freeloader_en: { emoji: "🤑", title: "Freeloader", desc: "Always asks for free stuff, makes excuses",         color: "#f59e0b" },
};

interface Props {
  operatorId: string;
  onStartSession: (session: SessionInfo) => void;
}

export default function SessionStarter({ operatorId, onStartSession }: Props) {
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!archetype) return;
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archetype, operator_id: operatorId }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail ?? "Failed to create session");
      }

      const session: SessionInfo = await resp.json();
      onStartSession(session);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="session-starter">
      <h1 className="app-title">🤖 AI Chat Simulator</h1>
      <p className="subtitle">Выберите тип клиента для тренировки</p>

      <div className="archetype-section-label">🇷🇺 Русский</div>
      <div className="archetype-grid">
        {(["greener", "whale", "troll", "freeloader"] as Archetype[]).map((key) => {
          const cfg = ARCHETYPES[key];
          const selected = archetype === key;
          return (
            <button
              key={key}
              className={`archetype-card ${selected ? "archetype-card--selected" : ""}`}
              style={selected ? { "--card-color": cfg.color } as React.CSSProperties : {}}
              onClick={() => setArchetype(key)}
            >
              <div className="archetype-card__check">{selected ? "✓" : ""}</div>
              <div className="archetype-card__emoji">{cfg.emoji}</div>
              <div className="archetype-card__title">{cfg.title}</div>
              <div className="archetype-card__desc">{cfg.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="archetype-section-label">🇬🇧 English</div>
      <div className="archetype-grid">
        {(["greener_en", "whale_en", "troll_en", "freeloader_en"] as Archetype[]).map((key) => {
          const cfg = ARCHETYPES[key];
          const selected = archetype === key;
          return (
            <button
              key={key}
              className={`archetype-card ${selected ? "archetype-card--selected" : ""}`}
              style={selected ? { "--card-color": cfg.color } as React.CSSProperties : {}}
              onClick={() => setArchetype(key)}
            >
              <div className="archetype-card__check">{selected ? "✓" : ""}</div>
              <div className="archetype-card__emoji">{cfg.emoji}</div>
              <div className="archetype-card__title">{cfg.title}</div>
              <div className="archetype-card__desc">{cfg.desc}</div>
            </button>
          );
        })}
      </div>

      {error && <p className="error-message">❌ {error}</p>}

      <button
        className="btn btn-start"
        onClick={handleStart}
        disabled={!archetype || loading}
      >
        {loading ? "Создание сессии..." : archetype ? `🚀 Начать с ${ARCHETYPES[archetype].emoji} ${ARCHETYPES[archetype].title}` : "Выберите архетип"}
      </button>
    </div>
  );
}
