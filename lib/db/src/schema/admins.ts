import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminsTable = pgTable("admins", {
  id: text("id").primaryKey(),
  login: text("login").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: text("role").notNull().default("coach"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export type Admin = typeof adminsTable.$inferSelect;
