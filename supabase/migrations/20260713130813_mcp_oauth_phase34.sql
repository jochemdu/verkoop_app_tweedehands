-- Fase 34: OAuth 2.1 authorization server voor de gehoste MCP.
-- claude.ai (remote connector) doorloopt DCR → authorize → token; wij binden
-- een access token aan een user_id. Deze tabellen zijn puur intern: RLS aan,
-- géén policies → alleen de service-role (server-side OAuth-routes) mag erbij.

-- Dynamisch geregistreerde clients (RFC 7591). Public clients + PKCE, dus
-- geen secret nodig.
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id     TEXT PRIMARY KEY,
  client_name   TEXT,
  redirect_uris TEXT[] NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kortlevende authorization codes (met PKCE challenge).
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code_hash             TEXT PRIMARY KEY,
  client_id             TEXT NOT NULL,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri          TEXT NOT NULL,
  code_challenge        TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  scope                 TEXT,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expiry ON oauth_authorization_codes(expires_at);

-- Access + refresh tokens (gehasht opgeslagen).
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  token_hash          TEXT PRIMARY KEY,
  refresh_token_hash  TEXT UNIQUE,
  client_id           TEXT NOT NULL,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope               TEXT,
  expires_at          TIMESTAMPTZ NOT NULL,
  refresh_expires_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_refresh ON oauth_access_tokens(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_access_tokens(user_id);

-- RLS aan, geen policies: dichttimmeren voor authenticated/anon. De
-- server-side routes gebruiken de service-role key (bypasst RLS).
ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_access_tokens ENABLE ROW LEVEL SECURITY;

-- Opruim-functie voor verlopen codes/tokens (via pg_cron aan te roepen).
CREATE OR REPLACE FUNCTION cleanup_expired_oauth()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.oauth_authorization_codes WHERE expires_at < NOW();
  DELETE FROM public.oauth_access_tokens
    WHERE expires_at < NOW()
      AND (refresh_expires_at IS NULL OR refresh_expires_at < NOW());
$$;
