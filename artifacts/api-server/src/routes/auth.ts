import { Router } from "express";
import { db, operatorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ detail: "Email обязателен" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await db
      .select()
      .from(operatorsTable)
      .where(eq(operatorsTable.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      const op = existing[0];
      res.json({
        uid: op.id,
        email: op.email,
        role: op.role,
        verified: op.verified,
        message: "Добро пожаловать!",
      });
      return;
    }

    const uid = crypto.randomUUID();
    const name = normalizedEmail.split("@")[0];
    await db.insert(operatorsTable).values({
      id: uid,
      email: normalizedEmail,
      name,
      role: "operator",
      verified: false,
    });

    res.json({
      uid,
      email: normalizedEmail,
      role: "operator",
      verified: false,
      message: "Зарегистрирован! Ожидайте верификации коуча.",
    });
  } catch (err) {
    req.log.error({ err }, "auth/login error");
    res.status(500).json({ detail: "Внутренняя ошибка сервера" });
  }
});

export default router;
