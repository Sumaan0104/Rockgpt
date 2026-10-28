-- Migration 0002: Hardened Row-Level Security (RLS), Google OAuth Identity Mapping & Constraints

-- 1. Add OAuth and verification columns to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" varchar(128);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_verified" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_idx" ON "users" ("google_id") WHERE "google_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");

-- 2. Enable Row Level Security (RLS) on all sensitive user tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "canvas_docs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_runs" ENABLE ROW LEVEL SECURITY;

-- 3. Row-Level Security Policies for Users
DROP POLICY IF EXISTS "users_select_own" ON "users";
CREATE POLICY "users_select_own" ON "users"
  FOR SELECT
  USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS "users_update_own" ON "users";
CREATE POLICY "users_update_own" ON "users"
  FOR UPDATE
  USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- 4. Row-Level Security Policies for Chats
DROP POLICY IF EXISTS "chats_user_isolation" ON "chats";
CREATE POLICY "chats_user_isolation" ON "chats"
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- 5. Row-Level Security Policies for Messages
DROP POLICY IF EXISTS "messages_chat_isolation" ON "messages";
CREATE POLICY "messages_chat_isolation" ON "messages"
  FOR ALL
  USING (
    chat_id IN (
      SELECT id FROM "chats"
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- 6. Row-Level Security Policies for Projects
DROP POLICY IF EXISTS "projects_user_isolation" ON "projects";
CREATE POLICY "projects_user_isolation" ON "projects"
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- 7. Row-Level Security Policies for Canvas Documents
DROP POLICY IF EXISTS "canvas_docs_user_isolation" ON "canvas_docs";
CREATE POLICY "canvas_docs_user_isolation" ON "canvas_docs"
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- 8. Row-Level Security Policies for Research Runs
DROP POLICY IF EXISTS "research_runs_user_isolation" ON "research_runs";
CREATE POLICY "research_runs_user_isolation" ON "research_runs"
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
