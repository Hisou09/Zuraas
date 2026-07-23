INSERT INTO entry_reads (user_email, content_id, entry_number, read_at)
SELECT user_email, content_id, progress, updated_at
FROM watch_history
ON CONFLICT (user_email, content_id, entry_number) DO NOTHING;
