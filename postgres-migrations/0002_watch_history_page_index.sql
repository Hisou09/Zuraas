ALTER TABLE watch_history
ADD COLUMN IF NOT EXISTS page_index integer NOT NULL DEFAULT 0;
