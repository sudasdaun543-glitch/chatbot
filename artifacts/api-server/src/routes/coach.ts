import { Router, type Request, type Response, type NextFunction } from "express";
import { db, operatorsTable, sessionsTable, feedbackTable, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// ─── Priority 1: Server-side session tokens for coach/dev routes ───────────

const coachTokens = new Map<string, { login: string; role: string; exp: number }>();

function cleanExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of coachTokens) {
    if (now > data.exp) coachTokens.delete(token);
  }
}

function requireToken(allowedRole: "coach" | "dev" | "any") {
  return (req: Request, res: Response, next: NextFunction): void => {
    cleanExpiredTokens();
    const auth  = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const data  = token ? coachTokens.get(token) : null;

    if (!data || Date.now() > data.exp) {
      res.status(401).json({ detail: "Требуется авторизация" });
      return;
    }
    if (allowedRole !== "any" && data.role !== allowedRole) {
      res.status(403).json({ detail: "Недостаточно прав" });
      return;
    }
    next();
  };
}

function hashPw(pw: string) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

// ─── Auth endpoints (public) ───────────────────────────────────────────────

router.post("/coach/access", async (req, res) => {
  const { login, password } = req.body as { login?: string; password?: string };
  if (!login || !password) {
    res.status(400).json({ detail: "Логин и пароль обязательны" });
    return;
  }
  const rows = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.login, login.trim()))
    .limit(1);

  if (!rows.length || rows[0].role !== "coach" || rows[0].password_hash !== hashPw(password)) {
    res.status(403).json({ detail: "Неверный логин или пароль" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  coachTokens.set(token, { login: rows[0].login, role: "coach", exp: Date.now() + 8 * 3600 * 1000 });
  res.json({ granted: true, token });
});

router.post("/dev/access", async (req, res) => {
  const { login, password } = req.body as { login?: string; password?: string };
  if (!login || !password) {
    res.status(400).json({ detail: "Логин и пароль обязательны" });
    return;
  }
  const rows = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.login, login.trim()))
    .limit(1);

  if (!rows.length || rows[0].role !== "dev" || rows[0].password_hash !== hashPw(password)) {
    res.status(403).json({ detail: "Неверный логин или пароль" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  coachTokens.set(token, { login: rows[0].login, role: "dev", exp: Date.now() + 8 * 3600 * 1000 });
  res.json({ granted: true, token });
});

// ─── Protected coach routes ────────────────────────────────────────────────

router.get("/coach/operators", requireToken("any"), async (_req, res) => {
  const operators = await db.select().from(operatorsTable).orderBy(operatorsTable.created_at);
  res.json(operators.map((op) => ({
    id: op.id, email: op.email, name: op.name, role: op.role,
    verified: op.verified, created_at: op.created_at,
  })));
});

router.post("/coach/verify/:id", requireToken("any"), async (req, res) => {
  const { verified } = req.body as { verified?: boolean };
  await db.update(operatorsTable).set({ verified: verified ?? false }).where(eq(operatorsTable.id, req.params.id));
  res.json({ ok: true });
});

router.get("/coach/sessions", requireToken("any"), async (_req, res) => {
  const rows = await db
    .select({
      id: sessionsTable.id,
      operator_id: sessionsTable.operator_id,
      archetype: sessionsTable.archetype,
      status: sessionsTable.status,
      created_at: sessionsTable.created_at,
      closed_at: sessionsTable.closed_at,
      operator_email: operatorsTable.email,
      operator_name: operatorsTable.name,
      score: feedbackTable.score,
      strengths: feedbackTable.strengths,
      mistakes: feedbackTable.mistakes,
    })
    .from(sessionsTable)
    .leftJoin(operatorsTable, eq(sessionsTable.operator_id, operatorsTable.id))
    .leftJoin(feedbackTable, eq(sessionsTable.id, feedbackTable.session_id))
    .orderBy(sessionsTable.created_at);
  res.json(rows);
});

router.delete("/coach/clear-sessions", requireToken("any"), async (_req, res) => {
  try {
    await db.delete(feedbackTable);
    await db.delete(sessionsTable);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ detail: "Ошибка очистки" });
  }
});

// ─── Protected dev routes ──────────────────────────────────────────────────

router.get("/dev/coaches", requireToken("dev"), async (_req, res) => {
  const coaches = await db
    .select({ id: adminsTable.id, login: adminsTable.login, role: adminsTable.role, created_at: adminsTable.created_at })
    .from(adminsTable)
    .where(eq(adminsTable.role, "coach"));
  res.json(coaches);
});

router.post("/dev/coaches", requireToken("dev"), async (req, res) => {
  const { login, password } = req.body as { login?: string; password?: string };
  if (!login || !password) {
    res.status(400).json({ detail: "Логин и пароль обязательны" });
    return;
  }
  const id = crypto.randomUUID();
  try {
    await db.insert(adminsTable).values({
      id,
      login: login.trim(),
      password_hash: hashPw(password),
      role: "coach",
    });
    res.json({ id, login: login.trim(), role: "coach" });
  } catch {
    res.status(409).json({ detail: "Логин уже занят" });
  }
});

router.delete("/dev/coaches/:id", requireToken("dev"), async (req, res) => {
  await db.delete(adminsTable).where(eq(adminsTable.id, req.params.id));
  res.json({ ok: true });
});

// ─── Public ────────────────────────────────────────────────────────────────

router.get("/ai-status", (_req, res) => {
  const hasKey = !!(process.env["OPENAI_API_KEY1"] ?? process.env["OPENAI_API_KEY"]);
  res.json({
    status: hasKey ? "online" : "offline",
    model: hasKey ? "deepseek-chat" : "не подключён",
    base_url: hasKey ? "https://api.deepseek.com" : "",
    error: hasKey ? null : "OPENAI_API_KEY1 не задан.",
  });
});

export default router;
