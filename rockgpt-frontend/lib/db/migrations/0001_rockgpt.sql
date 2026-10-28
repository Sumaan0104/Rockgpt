-- RockGPT Up Migration: users, auth_sessions, projects, chats, messages, canvas_docs, research_runs

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL UNIQUE,
  "name" text,
  "password_hash" text,
  "avatar_url" text,
  "theme" varchar(16) NOT NULL DEFAULT 'dark',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" text PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "auth_sessions_user_id_idx" ON "auth_sessions" ("user_id");

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(28) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "mode" varchar(16) NOT NULL DEFAULT 'chat',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "chats_user_id_updated_at_idx" ON "chats" ("user_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "chats_project_id_idx" ON "chats" ("project_id");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
  "role" varchar(16) NOT NULL,
  "content" text NOT NULL,
  "tokens_in" integer NOT NULL DEFAULT 0,
  "tokens_out" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "messages_chat_id_created_at_idx" ON "messages" ("chat_id", "created_at");

CREATE TABLE IF NOT EXISTS "canvas_docs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL DEFAULT '',
  "content" text NOT NULL DEFAULT '',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "research_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "query" text NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'running',
  "plan" jsonb,
  "sources" jsonb,
  "report" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz
);
