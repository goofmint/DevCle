-- Create plugin_nonces table for anti-replay protection
-- This table stores nonces used in plugin authentication tokens to prevent replay attacks.
-- Nonces are checked before allowing plugin API requests and are periodically cleaned up.

CREATE TABLE IF NOT EXISTS "plugin_nonces" (
	"nonce_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"plugin_id" text NOT NULL,
	"nonce" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_nonces_tenant_plugin_nonce_unique" UNIQUE("tenant_id","plugin_id","nonce")
);

-- Add foreign key constraint to tenants
ALTER TABLE "plugin_nonces" ADD CONSTRAINT "plugin_nonces_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;

-- Create index on created_at for efficient garbage collection
CREATE INDEX IF NOT EXISTS "idx_plugin_nonces_created_at" ON "plugin_nonces" ("created_at");

-- Enable Row Level Security for tenant isolation
ALTER TABLE "plugin_nonces" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
-- SELECT/INSERT require tenant context for security
CREATE POLICY plugin_nonces_select_insert
  ON plugin_nonces
  FOR ALL
  TO PUBLIC
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::text);

-- DELETE allowed for cleanup operations (runs without tenant context)
CREATE POLICY plugin_nonces_delete_cleanup
  ON plugin_nonces
  FOR DELETE
  TO PUBLIC
  USING (true);
