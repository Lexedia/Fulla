-- Create packages table
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_discontinued BOOLEAN NOT NULL DEFAULT FALSE,
    replaced_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create package_versions table
CREATE TABLE IF NOT EXISTS package_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    pubspec JSONB NOT NULL,
    archive_url TEXT NOT NULL,
    archive_sha256 TEXT,
    retracted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(package_id, version)
);

-- Create downloads table for tracking
CREATE TABLE IF NOT EXISTS downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
    download_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create analysis_results table for Pana output
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
    score INTEGER,
    report JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster package lookup
CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(name);
CREATE INDEX IF NOT EXISTS idx_package_versions_package_id ON package_versions(package_id);
