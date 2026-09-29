CREATE TABLE password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'reset' CHECK (purpose IN ('reset','invite')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets (user_id);

-- Explicit outbox for integration deliveries that could not be sent (provider not configured / failed)
CREATE TABLE outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel text NOT NULL,
  recipient text,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX outbox_status_idx ON outbox (tenant_id, status);
