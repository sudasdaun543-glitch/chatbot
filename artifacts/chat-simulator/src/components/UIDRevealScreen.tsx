import type { AuthResponse } from "../types";

interface Props {
  auth: AuthResponse;
  onContinue: (uid: string) => void;
  onBack: () => void;
}

export default function UIDRevealScreen({ auth, onContinue, onBack }: Props) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ maxWidth: 420, width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "2rem" }}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Добро пожаловать!</h2>
        <p style={{ color: "#aaa", marginBottom: 16 }}>{auth.message}</p>

        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: 16, fontFamily: "monospace", fontSize: 13, color: "#ccc", wordBreak: "break-all" }}>
          {auth.uid}
        </div>

        {auth.verified ? (
          <button
            onClick={() => onContinue(auth.uid)}
            style={{ width: "100%", padding: "0.75rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 600 }}
          >
            Начать тренировку →
          </button>
        ) : (
          <div style={{ color: "#fbbf24", fontSize: 14, marginBottom: 12 }}>
            Ваш аккаунт ещё не верифицирован коучем. Обратитесь к коучу.
          </div>
        )}

        <button
          onClick={onBack}
          style={{ width: "100%", padding: "0.6rem", background: "transparent", color: "#888", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, cursor: "pointer", fontSize: 14, marginTop: 8 }}
        >
          ← Назад
        </button>
      </div>
    </div>
  );
}
