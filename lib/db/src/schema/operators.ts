import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const operatorsTable = pgTable("operators", {
  id: text("id").primaryKey(),
  email: text("email"),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("operator"),
  verified: boolean("verified").notNull().default(false),
  password_hash: text("password_hash"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertOperatorSchema = createInsertSchema(operatorsTable).omit({
  created_at: true,
});
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type Operator = typeof operatorsTable.$inferSelect;
