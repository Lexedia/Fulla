ALTER TABLE users ADD COLUMN avatar_url TEXT;

ALTER TABLE packages ADD COLUMN owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_packages_owner_id ON packages(owner_id);
