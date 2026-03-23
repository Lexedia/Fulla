import type { Pubspec } from "./pubspec";

export enum SortOption {
    Relevance = 'Relevance',
    Popularity = 'Popularity',
    Likes = 'Likes',
    PubPoints = 'Pub Points',
    LastUpdated = 'Last Updated',
    Created = 'Created',
}

export interface Package {
    name: string;
    latest: PackageVersion;
    versions: PackageVersion[];
    is_discontinued: boolean;
    replaced_by: string;
    advisories_updated: string;
    owner_username?: string;
    owner_avatar?: string;
}

export interface PackageVersion {
    version: string;
    archive_url: string;
    archive_sha256: string;
    pubspec: Pubspec;
    retracted: boolean;
    created_at: string;
}

export interface SearchPackage {
    package: string;
    version: string;
    description?: string;
    score?: number;
    updated_at: string;
    is_discontinued?: boolean;
    owner_username?: string;
    owner_avatar?: string;
    platforms: string[];
}

export interface SearchResult {
    packages: SearchPackage[];
    total_hits: number;
}
export interface PackageDetail {
    package: DBPackage;
    version: PackageVersion;
    readme?: string;
    analysis?: any;
    owner_username?: string;
}

export interface DBPackage {
    id: string;
    name: string;
    is_discontinued: boolean;
    replaced_by?: string;
    owner_id?: string;
    created_at: string;
    updated_at: string;
}
