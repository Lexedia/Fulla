import type { SearchResult, PackageDetail, PackageDownloadsResponse, PackageVersion } from "./types/types";
import { authenticatedFetch } from "./auth";

const API_BASE = '/api';

export async function searchPackages(query: string, page: number = 1, limit: number = 10, owner?: string, sort?: string, platforms?: string[]): Promise<SearchResult> {
    const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        limit: limit.toString(),
    });

    if (owner) {
        params.append('owner', owner);
    }
    if (sort) {
        params.append('sort', sort);
    }
    if (platforms && platforms.length > 0) {
        params.append('platforms', platforms.join(','));
    }

    const response = await fetch(`${API_BASE}/search?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to fetch packages');
    }
    return response.json();
}

export async function getPackageDetails(name: string, version: string = 'latest'): Promise<PackageDetail> {
    const response = await fetch(`${API_BASE}/packages/${name}/versions/${version}/details`);
    if (!response.ok) {
        throw new Error('Failed to fetch package details');
    }
    return response.json();
}

export async function getPackageVersions(name: string): Promise<PackageVersion[]> {
    const response = await fetch(`${API_BASE}/packages/${name}/versions`);
    if (!response.ok) {
        throw new Error('Failed to fetch package versions');
    }
    return response.json();
}

export async function getPackageDownloads(name: string, range: string = '30d'): Promise<PackageDownloadsResponse> {
    const response = await fetch(`${API_BASE}/packages/${name}/downloads?range=${range}`);
    if (!response.ok) {
        throw new Error('Failed to fetch package downloads');
    }
    return response.json();
}

export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await authenticatedFetch(`${API_BASE}/profile/avatar`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to upload avatar');
    }

    return response.json();
}

// Token Management
export interface Token {
    id: string;
    token: string;
    name: string;
    user_id?: string;
    created_at: string;
    expires_at?: string;
    last_used_at?: string;
    revoked: boolean;
}

export interface CreateTokenRequest {
    name: string;
    expires_at?: string;
}

export async function listTokens(): Promise<Token[]> {
    const response = await authenticatedFetch(`${API_BASE}/tokens`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch tokens');
    }

    return response.json();
}

export async function createToken(name: string, expiresAt?: string): Promise<Token> {
    const body: CreateTokenRequest = { name };
    if (expiresAt) {
        body.expires_at = expiresAt;
    }

    const response = await authenticatedFetch(`${API_BASE}/tokens`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create token');
    }

    return response.json();
}

export async function deleteToken(id: string): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/tokens/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to delete token');
    }
}

export async function discontinuePackage(name: string, replacedBy?: string): Promise<void> {
    const body = {
        // n.b: this may look silly (because it is) but undefined isn't coerced to null and including an undefined value will actually delete the entire key
        replaced_by: replacedBy || null,
    };

    const response = await authenticatedFetch(`${API_BASE}/packages/${name}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to discontinue package');
    }
}

export async function likePackage(name: string): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/packages/${name}/like`, {
        method: 'POST',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to like package');
    }
}

export async function unlikePackage(name: string): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/packages/${name}/like`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to unlike package');
    }
}

export interface AdminStats {
    users: number;
    packages: number;
    versions: number;
}

export interface AdminUser {
    id: string;
    username: string;
    is_admin: boolean;
    avatar_url?: string;
    created_at: string;
}

export async function getAdminStats(): Promise<AdminStats> {
    const response = await authenticatedFetch(`${API_BASE}/admin/stats`);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch admin stats');
    }
    return response.json();
}

export async function getAdminUsers(): Promise<AdminUser[]> {
    const response = await authenticatedFetch(`${API_BASE}/admin/users`);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch users');
    }
    return response.json();
}

export async function deleteAdminUser(id: string): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/admin/users/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to delete user');
    }
}

export async function setAdminStatus(id: string, isAdmin: boolean): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/admin/users/${id}/admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: isAdmin }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update admin status');
    }
}

export async function createAdminUser(username: string, password: string, isAdmin: boolean): Promise<AdminUser> {
    const response = await authenticatedFetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, is_admin: isAdmin }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create user');
    }
    return response.json();
}


