-- Empty-database initialization. Run in order; never import legacy Sanity data.
PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  emailVerified TEXT,
  image TEXT,
  password TEXT,
  link TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','EDITOR','ADMIN')),
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0,1)),
  session_version INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, providerAccountId)
);
CREATE INDEX accounts_user ON accounts(userId);

CREATE TABLE sessions (
  sessionToken TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(userId);

CREATE TABLE verification_tokens (
  token_hash TEXT PRIMARY KEY,
  identifier TEXT NOT NULL COLLATE NOCASE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  expires_at TEXT NOT NULL,
  UNIQUE(identifier, purpose)
);

CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  slug TEXT NOT NULL UNIQUE,
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','pending','approved','rejected')),
  review_reason TEXT,
  publish_requested INTEGER NOT NULL DEFAULT 0 CHECK (publish_requested IN (0,1)),
  admin_hidden INTEGER NOT NULL DEFAULT 0 CHECK (admin_hidden IN (0,1)),
  first_published_at TEXT,
  desired_version INTEGER NOT NULL DEFAULT 1 CHECK (desired_version > 0),
  published_version INTEGER NOT NULL DEFAULT 0 CHECK (published_version >= 0 AND published_version <= desired_version),
  paid_plan TEXT CHECK (paid_plan IN ('pro','sponsor')),
  sponsor_started_at TEXT,
  sponsor_ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX listings_owner ON listings(owner_id, created_at DESC);
CREATE INDEX listings_review ON listings(review_status, created_at);
CREATE INDEX listings_sponsor_expiry ON listings(sponsor_ends_at) WHERE sponsor_ends_at IS NOT NULL;

CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT REFERENCES listings(id),
  status TEXT NOT NULL CHECK (status IN ('pending','ready','failed','abandoned')),
  asset_id TEXT,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(owner_id, asset_id)
);
CREATE INDEX uploads_owner ON uploads(owner_id, status);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT NOT NULL REFERENCES listings(id),
  plan TEXT NOT NULL CHECK (plan IN ('pro','sponsor')),
  price_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','expired','refunded')),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_id TEXT UNIQUE,
  checkout_url TEXT,
  refunded_amount INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0 AND refunded_amount <= amount),
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX orders_one_open ON orders(listing_id) WHERE status IN ('pending','processing');
CREATE INDEX orders_user ON orders(user_id, created_at DESC);

CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id),
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  lease_token TEXT,
  lease_until TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(listing_id, version)
);
CREATE INDEX outbox_ready ON outbox(status, available_at, lease_until);

CREATE TABLE notifications (
  first_attempt_at TEXT,
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','sent','failed','paused')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  lease_token TEXT,
  lease_until TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX notifications_ready ON notifications(status, available_at, lease_until);

CREATE TABLE newsletter_subscriptions (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  status TEXT NOT NULL CHECK (status IN ('subscribed','unsubscribed')),
  consent_at TEXT NOT NULL,
  unsubscribe_hash TEXT NOT NULL UNIQUE,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  listing_id TEXT REFERENCES listings(id),
  action TEXT NOT NULL,
  before_version INTEGER,
  after_version INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX audit_listing ON audit_logs(listing_id, created_at DESC);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

INSERT INTO schema_migrations(version, name) VALUES (1, '0001_initial');
