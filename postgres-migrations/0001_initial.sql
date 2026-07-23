CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id bigserial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  usercode text NOT NULL UNIQUE,
  vip_until timestamptz,
  contact_email text,
  avatar_key text,
  cover_key text,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  user_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_devices (
  device_id text PRIMARY KEY,
  user_email text NOT NULL,
  label text NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS vip_history (
  id bigserial PRIMARY KEY,
  user_email text NOT NULL,
  days integer NOT NULL,
  source text NOT NULL DEFAULT 'admin',
  granted_by text,
  granted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS contents (
  id text PRIMARY KEY,
  title text NOT NULL,
  original_title text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  year integer NOT NULL,
  episode_count integer NOT NULL DEFAULT 0,
  rating real NOT NULL DEFAULT 0,
  genres text NOT NULL DEFAULT '',
  image text NOT NULL,
  banner_image text NOT NULL DEFAULT '',
  characters text NOT NULL DEFAULT '[]',
  description text NOT NULL DEFAULT '',
  adult integer NOT NULL DEFAULT 0,
  anilist_id integer,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS library_items (
  id bigserial PRIMARY KEY,
  user_email text NOT NULL,
  content_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watch_history (
  id bigserial PRIMARY KEY,
  user_email text NOT NULL,
  content_id text NOT NULL,
  progress integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id bigserial PRIMARY KEY,
  content_id text NOT NULL,
  user_email text NOT NULL,
  display_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS error_reports (
  id bigserial PRIMARY KEY,
  content_id text NOT NULL,
  chapter_number real NOT NULL,
  user_email text NOT NULL,
  issue_type text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id bigserial PRIMARY KEY,
  user_email text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  is_read integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vip_settings (
  id integer PRIMARY KEY,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  promotion text NOT NULL DEFAULT '',
  global_discount integer NOT NULL DEFAULT 0,
  accent_color text NOT NULL DEFAULT '#8b6cf6'
);

CREATE TABLE IF NOT EXISTS vip_packages (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  duration_days integer NOT NULL,
  price integer NOT NULL,
  discount_percent integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS episodes (
  id bigserial PRIMARY KEY,
  content_id text NOT NULL,
  number real NOT NULL,
  access text NOT NULL DEFAULT 'registered',
  publish_at timestamptz,
  media_keys text NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_settings (
  id integer PRIMARY KEY,
  facebook text NOT NULL DEFAULT '',
  instagram text NOT NULL DEFAULT '',
  youtube text NOT NULL DEFAULT '',
  discord text NOT NULL DEFAULT '',
  telegram text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  user_email text,
  amount integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS library_user_content_idx ON library_items(user_email, content_id);
CREATE UNIQUE INDEX IF NOT EXISTS history_user_content_idx ON watch_history(user_email, content_id);
CREATE INDEX IF NOT EXISTS episodes_content_number_idx ON episodes(content_id, number DESC);
CREATE INDEX IF NOT EXISTS comments_content_created_idx ON comments(content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS devices_user_seen_idx ON user_devices(user_email, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS analytics_type_created_idx ON analytics_events(event_type, created_at DESC);
