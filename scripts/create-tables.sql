-- Create tables for Morphic app

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR(191) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  title TEXT NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  visibility VARCHAR(256) NOT NULL DEFAULT 'private'
);

CREATE INDEX IF NOT EXISTS chats_user_id_idx ON chats(user_id);
CREATE INDEX IF NOT EXISTS chats_user_id_created_at_idx ON chats(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chats_created_at_idx ON chats(created_at DESC);
CREATE INDEX IF NOT EXISTS chats_id_user_id_idx ON chats(id, user_id);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(191) PRIMARY KEY,
  chat_id VARCHAR(191) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role VARCHAR(256) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages(chat_id);
CREATE INDEX IF NOT EXISTS messages_chat_id_created_at_idx ON messages(chat_id, created_at);

-- Parts table
CREATE TABLE IF NOT EXISTS parts (
  id VARCHAR(191) PRIMARY KEY,
  message_id VARCHAR(191) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  type VARCHAR(256) NOT NULL,

  -- Text parts
  text_text TEXT,

  -- Reasoning parts
  reasoning_text TEXT,

  -- File parts
  file_media_type VARCHAR(256),
  file_filename VARCHAR(1024),
  file_url TEXT,

  -- Source URL parts
  source_url_source_id VARCHAR(256),
  source_url_url TEXT,
  source_url_title TEXT,

  -- Source document parts
  source_document_source_id VARCHAR(256),
  source_document_media_type VARCHAR(256),
  source_document_title TEXT,
  source_document_filename VARCHAR(1024),
  source_document_url TEXT,
  source_document_snippet TEXT,

  -- Tool parts (generic)
  tool_tool_call_id VARCHAR(256),
  tool_state VARCHAR(256),
  tool_error_text TEXT,

  -- Tool-specific columns
  tool_search_input JSON,
  tool_search_output JSON,
  tool_fetch_input JSON,
  tool_fetch_output JSON,
  tool_question_input JSON,
  tool_question_output JSON,

  -- Todo tool columns
  "tool_todoWrite_input" JSON,
  "tool_todoWrite_output" JSON,
  "tool_todoRead_input" JSON,
  "tool_todoRead_output" JSON,

  -- Dynamic tools
  tool_dynamic_input JSON,
  tool_dynamic_output JSON,
  tool_dynamic_name VARCHAR(256),
  tool_dynamic_type VARCHAR(256),

  -- Data parts
  data_prefix VARCHAR(256),
  data_content JSON,
  data_id VARCHAR(256),

  -- Provider metadata
  provider_metadata JSON,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT text_text_required CHECK (type != 'text' OR text_text IS NOT NULL),
  CONSTRAINT reasoning_text_required CHECK (type != 'reasoning' OR reasoning_text IS NOT NULL),
  CONSTRAINT file_fields_required CHECK (type != 'file' OR (file_media_type IS NOT NULL AND file_filename IS NOT NULL AND file_url IS NOT NULL)),
  CONSTRAINT tool_state_valid CHECK (tool_state IS NULL OR tool_state IN ('input-streaming', 'input-available', 'output-available', 'output-error')),
  CONSTRAINT tool_fields_required CHECK (type NOT LIKE 'tool-%' OR (tool_tool_call_id IS NOT NULL AND tool_state IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS parts_message_id_idx ON parts(message_id);
CREATE INDEX IF NOT EXISTS parts_message_id_order_idx ON parts(message_id, "order");

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id VARCHAR(191) PRIMARY KEY,
  user_id VARCHAR(255),
  sentiment VARCHAR(256) NOT NULL,
  message TEXT NOT NULL,
  page_url TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback(created_at);

-- Enable Row Level Security on all tables
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chats
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'users_manage_own_chats') THEN
    CREATE POLICY users_manage_own_chats ON chats AS PERMISSIVE FOR ALL TO public
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'public_chats_readable') THEN
    CREATE POLICY public_chats_readable ON chats AS PERMISSIVE FOR SELECT TO public
      USING (visibility = 'public');
  END IF;
END $$;

-- RLS Policies for messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'users_manage_chat_messages') THEN
    CREATE POLICY users_manage_chat_messages ON messages AS PERMISSIVE FOR ALL TO public
      USING (EXISTS (
        SELECT 1 FROM chats
        WHERE chats.id = chat_id
        AND chats.user_id = current_setting('app.current_user_id', true)
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM chats
        WHERE chats.id = chat_id
        AND chats.user_id = current_setting('app.current_user_id', true)
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'public_chat_messages_readable') THEN
    CREATE POLICY public_chat_messages_readable ON messages AS PERMISSIVE FOR SELECT TO public
      USING (EXISTS (
        SELECT 1 FROM chats
        WHERE chats.id = chat_id
        AND chats.visibility = 'public'
      ));
  END IF;
END $$;

-- RLS Policies for parts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parts' AND policyname = 'users_manage_message_parts') THEN
    CREATE POLICY users_manage_message_parts ON parts AS PERMISSIVE FOR ALL TO public
      USING (EXISTS (
        SELECT 1 FROM messages
        INNER JOIN chats ON chats.id = messages.chat_id
        WHERE messages.id = message_id
        AND chats.user_id = current_setting('app.current_user_id', true)
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM messages
        INNER JOIN chats ON chats.id = messages.chat_id
        WHERE messages.id = message_id
        AND chats.user_id = current_setting('app.current_user_id', true)
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parts' AND policyname = 'public_chat_parts_readable') THEN
    CREATE POLICY public_chat_parts_readable ON parts AS PERMISSIVE FOR SELECT TO public
      USING (EXISTS (
        SELECT 1 FROM messages
        INNER JOIN chats ON chats.id = messages.chat_id
        WHERE messages.id = message_id
        AND chats.visibility = 'public'
      ));
  END IF;
END $$;

-- RLS Policies for feedback
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'feedback_select_policy') THEN
    CREATE POLICY feedback_select_policy ON feedback AS PERMISSIVE FOR SELECT TO public
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'anyone_can_insert_feedback') THEN
    CREATE POLICY anyone_can_insert_feedback ON feedback FOR INSERT TO public
      WITH CHECK (true);
  END IF;
END $$;
