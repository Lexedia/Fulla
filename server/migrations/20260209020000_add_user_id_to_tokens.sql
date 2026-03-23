-- Clown me
ALTER TABLE tokens ADD COLUMN user_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);
