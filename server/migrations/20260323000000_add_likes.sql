-- Create package_likes table to track which users liked which packages.
CREATE TABLE IF NOT EXISTS package_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(package_id, user_id)
);

-- Index for faster lookup of likes by package
CREATE INDEX IF NOT EXISTS idx_package_likes_package_id ON package_likes(package_id);
-- Index for faster lookup of likes by user
CREATE INDEX IF NOT EXISTS idx_package_likes_user_id ON package_likes(user_id);
