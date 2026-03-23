import { createSignal, Show } from "solid-js";
import { useAuth } from "../auth";
import { A, useNavigate } from "@solidjs/router";
import { Sun, Moon, X, Menu } from 'lucide-solid';
import Button from "./Button";

export default function ({ darkMode, toggleTheme }: { darkMode: () => boolean; toggleTheme: () => void }) {
    const [isMenuOpen, setIsMenuOpen] = createSignal(false)
    const { user, isAuthenticated, logout, isAdmin } = useAuth();
    const navigate = useNavigate();

    return (<nav class="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16 items-center">
                <A class="flex items-center gap-2 cursor-pointer" href="/">
                    <div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                        F
                    </div>
                    <span class="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-primary-600 to-primary-400 hidden sm:block">
                        Fulla
                    </span>
                </A>
                <div class="hidden md:flex items-center space-x-6">
                    <A href="/" class="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-primary-600 dark:hover:text-primary-400">Browse</A>
                    <a href="#" class="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">Documentation</a>
                    <Show when={isAdmin()}>
                        <A href="/admin" class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">Admin</A>
                    </Show>
                    <div class="h-4 w-px bg-gray-300 dark:bg-slate-700 mx-2"></div>

                    <button
                        onClick={toggleTheme}
                        class="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800 transition-colors"
                    >
                        {darkMode() ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    {isAuthenticated() && user() ? (
                        <div class="flex items-center gap-3">
                            <A href="/profile">
                                {user()?.avatar_url ? (
                                    <img src={user()!.avatar_url} alt={user()!.username} class="w-8 h-8 rounded-full border border-gray-200 dark:border-slate-700" />
                                ) : (
                                    <div class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
                                        {user()?.username?.[0]?.toUpperCase() || '?'}
                                    </div>
                                )}
                            </A>
                            <Button variant="ghost" class="text-xs" onClick={() => { logout(); navigate('/'); }}>Sign Out</Button>
                        </div>
                    ) : (
                        <div class="flex items-center gap-3">
                            <Button variant="outline" onClick={() => navigate('/login')} class="rounded-full px-6">
                                Sign In
                            </Button>
                            <Button variant="primary" onClick={() => navigate('/register')} class="rounded-full px-6">
                                Sign Up
                            </Button>
                        </div>
                    )}
                </div>
                <div class="md:hidden flex items-center gap-4">
                    <button
                        onClick={toggleTheme}
                        class="p-2 rounded-full text-gray-500 dark:text-gray-400"
                    >
                        {darkMode() ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen())} class="text-gray-700 dark:text-gray-200">
                        {isMenuOpen() ? <X /> : <Menu />}
                    </button>
                </div>
                {
                    isMenuOpen() && (
                        <div class="md:hidden border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
                            <A href="/" class="block text-base font-medium text-gray-700 dark:text-gray-200" onClick={() => setIsMenuOpen(false)}>Browse</A>
                            {isAuthenticated() ? (
                                <>
                                    <A href="/profile" class="block text-base font-medium text-gray-700 dark:text-gray-200" onClick={() => setIsMenuOpen(false)}>My Profile</A>
                                    <Show when={isAdmin()}>
                                        <A href="/admin" class="block text-base font-medium text-primary-600 dark:text-primary-400" onClick={() => setIsMenuOpen(false)}>Admin</A>
                                    </Show>
                                    <button onClick={() => { setIsMenuOpen(false); logout(); navigate('/'); }} class="block text-base font-medium text-red-500">Sign Out</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => { setIsMenuOpen(false); navigate('/login'); }} class="block text-base font-medium text-gray-700 dark:text-gray-200">Sign In</button>
                                    <button onClick={() => { setIsMenuOpen(false); navigate('/register'); }} class="block text-base font-medium text-primary-600">Sign Up</button>
                                </>
                            )}
                        </div>
                    )
                }
            </div>
        </div>
    </nav >
    )
}
