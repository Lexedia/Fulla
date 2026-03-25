import type { JSX } from "solid-js";

import { createContext, useContext, createSignal, onMount } from "solid-js";

interface User {
    id: string;
    username: string;
    is_admin: boolean;
    avatar_url?: string;
}

interface AuthContextType {
    user: () => User | null;
    token: () => string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: () => boolean;
    isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: JSX.Element }) {
    const [user, setUser] = createSignal<User | null>(null);
    const [token, setToken] = createSignal<string | null>(null);

    onMount(async () => {
        const storedToken = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("auth_user");
        if (storedToken && storedUser) {
            try {
                const response = await fetch("/api/tokens", {
                    headers: { Authorization: `Bearer ${storedToken}` },
                });
                if (response.ok) {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                } else {
                    localStorage.removeItem("auth_token");
                    localStorage.removeItem("auth_user");
                }
            } catch {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            }
        }
    });

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem("auth_token", newToken);
        localStorage.setItem("auth_user", JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
    };

    const isAuthenticated = () => !!token();
    const isAdmin = () => user()?.is_admin || false;

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, isAdmin }}>
            {props.children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

export async function authenticatedFetch(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem("auth_token");
    const headers = new Headers(options.headers);

    if (token) {
        headers.append("Authorization", `Bearer ${token}`);
    }

    return fetch(url, { ...options, headers });
}
