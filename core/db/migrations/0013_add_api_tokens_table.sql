-- Create api_tokens table for webhook authentication
CREATE TABLE IF NOT EXISTS api_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  CONSTRAINT api_tokens_tenant_name_unique UNIQUE (tenant_id, name)
);

-- Create indexes for performance
CREATE INDEX idx_api_tokens_tenant_id ON api_tokens(tenant_id);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_api_tokens_revoked_at ON api_tokens(revoked_at) WHERE revoked_at IS NULL;

-- Enable Row Level Security
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation (applies to ALL operations: SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY api_tokens_tenant_isolation
  ON api_tokens
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::text);
