import { Router } from "express";
import { db, operatorsTable, sessionsTable, feedbackTable, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

function hashPw(pw: string) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

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
  res.json({ granted: true });
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
  res.json({ granted: true });
});

router.get("/dev/coaches", async (_req, res) => {
  const coaches = await db
    .select({ id: adminsTable.id, login: adminsTable.login, role: adminsTable.role, created_at: adminsTable.created_at })
    .from(adminsTable)
    .where(eq(adminsTable.role, "coach"));
  res.json(coaches);
});

router.post("/dev/coaches", async (req, res) => {
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

router.delete("/dev/coaches/:id", async (req, res) => {
  await db.delete(adminsTable).where(eq(adminsTable.id, req.params.id));
  res.json({ ok: true });
});

router.get("/coach/operators", async (_req, res) => {
  const operators = await db.select().from(operatorsTable).orderBy(operatorsTable.created_at);
  res.json(operators.map((op) => ({
    id: op.id, email: op.email, name: op.name, role: op.role,
    verified: op.verified, created_at: op.created_at,
  })));
});

router.post("/coach/verify/:id", async (req, res) => {
  const { verified } = req.body as { verified?: boolean };
  await db.update(operatorsTable).set({ verified: verified ?? false }).where(eq(operatorsTable.id, req.params.id));
  res.json({ ok: true });
});

router.get("/coach/sessions", async (_req, res) => {
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

router.get("/ai-status", (_req, res) => {
  const hasKey = !!process.env["OPENAI_API_KEY"];
  res.json({
    status: hasKey ? "online" : "offline",
    model: hasKey ? "gpt-4o-mini" : "не подключён",
    base_url: hasKey ? "https://api.openai.com" : "",
    error: hasKey ? null : "OPENAI_API_KEY не задан.",
  });
});

export default router;
