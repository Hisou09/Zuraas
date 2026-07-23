CREATE TABLE IF NOT EXISTS entry_reads (
  id serial PRIMARY KEY,
  user_email text NOT NULL,
  content_id text NOT NULL,
  entry_number real NOT NULL,
  read_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS entry_reads_user_content_number_idx
ON entry_reads (user_email, content_id, entry_number);
