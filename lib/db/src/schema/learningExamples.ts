import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const learningExamplesTable = pgTable("learning_examples", {
  id: text("id").primaryKey(),
  archetype: text("archetype").notNull(),
  conversation: text("conversation").notNull(),
  score: integer("score").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export type LearningExample = typeof learningExamplesTable.$inferSelect;
