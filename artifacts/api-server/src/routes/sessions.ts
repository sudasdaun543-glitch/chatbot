import { Router } from "express";
import { db, sessionsTable, operatorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

router.post("/sessions", async (req, res) => {
  try {
    const { archetype, operator_id } = req.body as {
      archetype?: string;
      operator_id?: string;
    };

    if (!archetype) {
      res.status(400).json({ detail: "archetype обязателен" });
      return;
    }

    if (operator_id) {
      const op = await db
        .select()
        .from(operatorsTable)
        .where(eq(operatorsTable.id, operator_id))
        .limit(1);

      if (op.length === 0) {
        await db.insert(operatorsTable).values({
          id: operator_id,
          name: "unknown",
          role: "operator",
          verified: false,
        });
      }
    }

    const id = crypto.randomUUID();
    const [session] = await db
      .insert(sessionsTable)
      .values({ id, archetype, operator_id: operator_id ?? null, status: "active" })
      .returning();

    res.status(201).json({
      id: session.id,
      operator_id: session.operator_id,
      archetype: session.archetype,
      status: session.status,
      created_at: session.created_at,
      closed_at: session.closed_at,
    });
  } catch (err) {
    req.log.error({ err }, "POST /sessions error");
    res.status(500).json({ detail: "Внутренняя ошибка сервера" });
  }
});

router.get("/sessions/:session_id", async (req, res) => {
  try {
    const { session_id } = req.params;
    const rows = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, session_id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ detail: "Session not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "GET /sessions/:id error");
    res.status(500).json({ detail: "Внутренняя ошибка сервера" });
  }
});

export default router;
