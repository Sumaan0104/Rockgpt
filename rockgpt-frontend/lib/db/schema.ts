import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// 1. users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: text("name"),
  password_hash: text("password_hash"),
  avatar_url: text("avatar_url"),
  google_id: varchar("google_id", { length: 128 }),
  theme: varchar("theme", { length: 16 }).notNull().default("dark"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type User = InferSelectModel<typeof users>;

// 2. auth_sessions
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_sessions_user_id_idx").on(table.user_id),
  ]
);
export type AuthSession = InferSelectModel<typeof authSessions>;

// 3. projects
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 28 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Project = InferSelectModel<typeof projects>;

// 4. chats
export const chats = pgTable(
  "chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    project_id: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    mode: varchar("mode", { length: 16 }).notNull().default("chat"), // "chat" | "deep"
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("chats_user_id_updated_at_idx").on(table.user_id, table.updated_at),
    index("chats_project_id_idx").on(table.project_id),
  ]
);
export type Chat = InferSelectModel<typeof chats>;

// 5. messages
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chat_id: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(), // "user" | "assistant"
    content: text("content").notNull(),
    tokens_in: integer("tokens_in").notNull().default(0),
    tokens_out: integer("tokens_out").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_chat_id_created_at_idx").on(table.chat_id, table.created_at),
  ]
);
export type Message = InferSelectModel<typeof messages>;

// 6. canvas_docs
export const canvasDocs = pgTable("canvas_docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  content: text("content").notNull().default(""),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CanvasDoc = InferSelectModel<typeof canvasDocs>;

// 7. research_runs
export const researchRuns = pgTable("research_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  chat_id: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("running"), // "running" | "done" | "failed"
  plan: jsonb("plan"),
  sources: jsonb("sources"),
  report: text("report"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finished_at: timestamp("finished_at", { withTimezone: true }),
});
export type ResearchRun = InferSelectModel<typeof researchRuns>;

// Aliases for compatibility
export const user = users;
export const chat = chats;
export const message = messages;
export type DBMessage = Message;
export const document = canvasDocs;
export type Document = CanvasDoc;

export const suggestion = pgTable("suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id"),
  documentCreatedAt: timestamp("document_created_at", { withTimezone: true }),
  originalText: text("original_text").notNull().default(""),
  suggestedText: text("suggested_text").notNull().default(""),
  description: text("description"),
  isResolved: integer("is_resolved").notNull().default(0),
  userId: uuid("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Suggestion = InferSelectModel<typeof suggestion>;

export const vote = pgTable("votes", {
  chatId: uuid("chat_id").notNull(),
  messageId: uuid("message_id").notNull(),
  isUpvoted: integer("is_upvoted").notNull().default(1),
});
export type Vote = InferSelectModel<typeof vote>;

export const stream = pgTable("streams", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Stream = InferSelectModel<typeof stream>;

