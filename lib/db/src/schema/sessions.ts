import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  operator_id: text("operator_id"),
  archetype: text("archetype").notNull(),
  status: text("status").notNull().default("active"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  closed_at: timestamp("closed_at"),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  created_at: true,
  closed_at: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
