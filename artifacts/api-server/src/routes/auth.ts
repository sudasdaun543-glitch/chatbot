import { Router } from "express";
import { db, operatorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// ─── Priority 2: In-memory rate limiter (10 req/min per IP) ───────────────

const loginAttempts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now    = Date.now();
  const window = 60_000; // 1 minute
  const max    = 10;
  const prev   = (loginAttempts.get(ip) ?? []).filter(t => now - t < window);
  prev.push(now);
  loginAttempts.set(ip, prev);
  return prev.length > max;
}

// ─── Auth ─────────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress
      ?? "unknown";

    if (isRateLimited(ip)) {
      res.status(429).json({ detail: "Слишком много попыток. Подождите минуту." });
      return;
    }

    const { email, uid } = req.body as { email?: string; uid?: string };
    if (!email) {
      res.status(400).json({ detail: "Email обязателен" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const providedUid = uid?.trim() ?? "";

    const existing = await db
      .select()
      .from(operatorsTable)
      .where(eq(operatorsTable.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      const op = existing[0];

      if (!providedUid) {
        res.status(401).json({ detail: "Введите ваш пароль (UID)" });
        return;
      }

      if (op.id !== providedUid) {
        res.status(401).json({ detail: "Неверный пароль" });
        return;
      }

      res.json({
        uid: op.id,
        email: op.email,
        role: op.role,
        verified: true,
        isNew: false,
        message: "Добро пожаловать!",
      });
      return;
    }

    if (providedUid) {
      res.status(404).json({ detail: "Аккаунт с таким email не найден" });
      return;
    }

    const newUid = crypto.randomUUID();
    const name = normalizedEmail.split("@")[0];
    await db.insert(operatorsTable).values({
      id: newUid,
      email: normalizedEmail,
      name,
      role: "operator",
      verified: true,
    });

    res.json({
      uid: newUid,
      email: normalizedEmail,
      role: "operator",
      verified: true,
      isNew: true,
      message: "Аккаунт создан!",
    });
  } catch (err) {
    req.log.error({ err }, "auth/login error");
    res.status(500).json({ detail: "Внутренняя ошибка сервера" });
  }
});

export default router;
