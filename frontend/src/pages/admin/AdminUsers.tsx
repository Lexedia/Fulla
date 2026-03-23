import { createResource, createSignal, Show, For } from 'solid-js';
import { getAdminUsers, deleteAdminUser, setAdminStatus, createAdminUser, type AdminUser } from '../../api';
import { useAuth } from '../../auth';
import { Trash2, ShieldCheck, ShieldOff, AlertTriangle, UserPlus, X, Eye, EyeOff, User } from 'lucide-solid';

const AdminUsers = () => {
    const { user: currentUser } = useAuth();
    const [users, { refetch }] = createResource(getAdminUsers);
    const [confirmDelete, setConfirmDelete] = createSignal<string | null>(null);
    const [actionError, setActionError] = createSignal<string | null>(null);
    const [loadingId, setLoadingId] = createSignal<string | null>(null);

    // Create user form state
    const [showCreateForm, setShowCreateForm] = createSignal(false);
    const [newUsername, setNewUsername] = createSignal('');
    const [newPassword, setNewPassword] = createSignal('');
    const [newIsAdmin, setNewIsAdmin] = createSignal(false);
    const [showPassword, setShowPassword] = createSignal(false);
    const [creating, setCreating] = createSignal(false);
    const [createError, setCreateError] = createSignal<string | null>(null);

    const handleDelete = async (u: AdminUser) => {
        if (confirmDelete() !== u.id) {
            setConfirmDelete(u.id);
            return;
        }
        setLoadingId(u.id);
        setActionError(null);
        try {
            await deleteAdminUser(u.id);
            setConfirmDelete(null);
            refetch();
        } catch (e: any) {
            setActionError(e.message);
        } finally {
            setLoadingId(null);
        }
    };

    const handleToggleAdmin = async (u: AdminUser) => {
        setLoadingId(u.id);
        setActionError(null);
        try {
            await setAdminStatus(u.id, !u.is_admin);
            refetch();
        } catch (e: any) {
            setActionError(e.message);
        } finally {
            setLoadingId(null);
        }
    };

    const handleCreateUser = async (e: Event) => {
        e.preventDefault();
        setCreating(true);
        setCreateError(null);
        try {
            await createAdminUser(newUsername(), newPassword(), newIsAdmin());
            setNewUsername('');
            setNewPassword('');
            setNewIsAdmin(false);
            setShowCreateForm(false);
            refetch();
        } catch (e: any) {
            setCreateError(e.message);
        } finally {
            setCreating(false);
        }
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    return (
        <div>
            <div class="mb-8 flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage registered users</p>
                </div>
                <button
                    onClick={() => { setShowCreateForm(true); setCreateError(null); }}
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
                >
                    <UserPlus size={15} />
                    New User
                </button>
            </div>

            <Show when={actionError()}>
                <div class="mb-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
                    <AlertTriangle size={16} class="shrink-0" />
                    {actionError()}
                </div>
            </Show>

            {/* Create User Slide-in Panel */}
            <Show when={showCreateForm()}>
                {/* Backdrop */}
                <div
                    class="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm"
                    onClick={() => setShowCreateForm(false)}
                />
                {/* Panel */}
                <div class="fixed right-0 top-0 h-full w-full max-w-sm z-30 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl flex flex-col">
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800">
                        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Create User</h2>
                        <button
                            onClick={() => setShowCreateForm(false)}
                            class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <form onSubmit={handleCreateUser} class="flex-1 flex flex-col px-6 py-6 gap-5 overflow-y-auto">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Username
                            </label>
                            <input
                                type="text"
                                required
                                autocomplete="off"
                                value={newUsername()}
                                onInput={(e) => setNewUsername(e.currentTarget.value)}
                                placeholder="e.g. johndoe"
                                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                            />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Password
                            </label>
                            <div class="relative">
                                <input
                                    type={showPassword() ? 'text' : 'password'}
                                    required
                                    minLength={8}
                                    autocomplete="new-password"
                                    value={newPassword()}
                                    onInput={(e) => setNewPassword(e.currentTarget.value)}
                                    placeholder="Min. 8 characters"
                                    class="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword())}
                                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {showPassword() ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={newIsAdmin()}
                                onClick={() => setNewIsAdmin(!newIsAdmin())}
                                class={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${newIsAdmin() ? 'bg-primary-600' : 'bg-gray-200 dark:bg-slate-700'}`}
                            >
                                <span
                                    class={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform ${newIsAdmin() ? 'translate-x-4' : 'translate-x-0'}`}
                                />
                            </button>
                            <div>
                                <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Admin privileges</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400">Grant full admin access</div>
                            </div>
                        </div>

                        <Show when={createError()}>
                            <div class="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm">
                                <AlertTriangle size={14} class="shrink-0" />
                                {createError()}
                            </div>
                        </Show>

                        <div class="mt-auto pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowCreateForm(false)}
                                class="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creating()}
                                class="flex-1 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                            >
                                {creating() ? 'Creating…' : 'Create User'}
                            </button>
                        </div>
                    </form>
                </div>
            </Show>

            <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                <Show
                    when={!users.loading}
                    fallback={
                        <div class="divide-y divide-gray-100 dark:divide-slate-800">
                            <For each={[1, 2, 3, 4, 5]}>
                                {() => (
                                    <div class="flex items-center gap-4 px-6 py-4 animate-pulse">
                                        <div class="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-700 shrink-0" />
                                        <div class="flex-1 space-y-2">
                                            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-32" />
                                            <div class="h-3 bg-gray-200 dark:bg-slate-700 rounded w-20" />
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    }
                >
                    <Show when={users.error}>
                        <div class="p-6 text-sm text-red-600 dark:text-red-400">
                            Failed to load users: {users.error?.message}
                        </div>
                    </Show>

                    {/* Table header */}
                    <div class="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <span>User</span>
                        <span class="text-center">Role</span>
                        <span class="text-right">Joined</span>
                        <span class="text-right">Actions</span>
                    </div>

                    <div class="divide-y divide-gray-100 dark:divide-slate-800">
                        <For each={users()}>
                            {(u) => {
                                const isSelf = () => currentUser()?.id === u.id;
                                const isLoading = () => loadingId() === u.id;
                                const isConfirming = () => confirmDelete() === u.id;

                                return (
                                    <div class="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center gap-3 sm:gap-4 px-6 py-4">
                                        {/* User info */}
                                        <div class="flex items-center gap-3 min-w-0">
                                            {u.avatar_url ? (
                                                <img
                                                    src={u.avatar_url}
                                                    alt={u.username}
                                                    class="w-9 h-9 rounded-full border border-gray-200 dark:border-slate-700 shrink-0"
                                                />
                                            ) : (
                                                <div class="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                                                    {u.username[0].toUpperCase()}
                                                </div>
                                            )}
                                            <div class="min-w-0">
                                                <div class="font-medium text-gray-900 dark:text-white text-sm truncate">
                                                    {u.username}
                                                    {isSelf() && (
                                                        <span class="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">(you)</span>
                                                    )}
                                                </div>
                                                <div class="text-xs text-gray-500 dark:text-gray-400 truncate">{u.id}</div>
                                            </div>
                                        </div>

                                        {/* Role badge */}
                                        <div class="sm:text-center">
                                            {u.is_admin ? (
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800">
                                                    <ShieldCheck size={11} />
                                                    Admin
                                                </span>
                                            ) : (
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-700">
                                                    <User size={11} />
                                                    User
                                                </span>
                                            )}
                                        </div>

                                        {/* Joined date */}
                                        <div class="text-xs text-gray-500 dark:text-gray-400 sm:text-right">
                                            {formatDate(u.created_at)}
                                        </div>

                                        {/* Actions */}
                                        <div class="flex items-center gap-2 sm:justify-end">
                                            {/* Toggle admin */}
                                            <button
                                                onClick={() => handleToggleAdmin(u)}
                                                disabled={isSelf() || isLoading()}
                                                title={u.is_admin ? 'Remove admin' : 'Make admin'}
                                                class="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                                            >
                                                {u.is_admin ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                                            </button>

                                            {/* Delete */}
                                            <button
                                                onClick={() => handleDelete(u)}
                                                disabled={isSelf() || isLoading()}
                                                title={isConfirming() ? 'Click again to confirm' : 'Delete user'}
                                                class={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isConfirming()
                                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                                    : 'text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                    }`}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>

                    <Show when={users()?.length === 0}>
                        <div class="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                            No users found.
                        </div>
                    </Show>
                </Show>
            </div>

            {/* Dismiss confirm on outside click */}
            <Show when={confirmDelete()}>
                <div
                    class="fixed inset-0 z-10"
                    onClick={() => setConfirmDelete(null)}
                />
            </Show>
        </div>
    );
};

export default AdminUsers;
