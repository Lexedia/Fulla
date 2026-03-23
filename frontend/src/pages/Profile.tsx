import { createSignal, Show, createEffect, For, onMount } from "solid-js";
import { useAuth } from "../auth";
import { useNavigate } from "@solidjs/router";
import { uploadAvatar, listTokens, createToken, deleteToken, type Token } from "../api";
import { Upload, Plus, Trash2, Copy, Check } from "lucide-solid";

export default function Profile() {
    const { user, isAuthenticated, login } = useAuth();
    const navigate = useNavigate();
    const [isUploading, setIsUploading] = createSignal(false);
    const [error, setError] = createSignal("");
    const [success, setSuccess] = createSignal("");
    const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);

    // Token management state
    const [tokens, setTokens] = createSignal<Token[]>([]);
    const [isLoadingTokens, setIsLoadingTokens] = createSignal(false);
    const [tokenError, setTokenError] = createSignal("");
    const [tokenSuccess, setTokenSuccess] = createSignal("");
    const [newTokenName, setNewTokenName] = createSignal("");
    const [newTokenExpiry, setNewTokenExpiry] = createSignal("");
    const [isCreatingToken, setIsCreatingToken] = createSignal(false);
    const [newlyCreatedToken, setNewlyCreatedToken] = createSignal<string | null>(null);
    const [copiedTokenId, setCopiedTokenId] = createSignal<string | null>(null);

    // Redirect if not authenticated (reactive)
    createEffect(() => {
        if (!isAuthenticated()) {
            navigate("/login");
        }
    });

    const handleFileSelect = async (e: Event) => {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setError("Please select an image file");
            return;
        }

        // Validate file size (10 MiB max)
        if (file.size > 10 * 1024 * 1024) {
            setError("Image must be less than 10 MiB");
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setPreviewUrl(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Upload
        setError("");
        setSuccess("");
        setIsUploading(true);

        try {
            const result = await uploadAvatar(file);
            setSuccess("Avatar updated successfully!");

            // Update user in auth context
            const currentUser = user();
            if (currentUser) {
                login(localStorage.getItem("auth_token") || "", {
                    ...currentUser,
                    avatar_url: result.avatar_url
                });
            }

            // Clear preview after successful upload
            setTimeout(() => {
                setPreviewUrl(null);
                setSuccess("");
            }, 3000);
        } catch (err: any) {
            setError(err.message || "Failed to upload avatar");
            setPreviewUrl(null);
        } finally {
            setIsUploading(false);
        }
    };

    // Token management handlers
    const loadTokens = async () => {
        setIsLoadingTokens(true);
        setTokenError("");
        try {
            const tokenList = await listTokens();
            setTokens(tokenList);
        } catch (err: any) {
            setTokenError(err.message || "Failed to load tokens");
        } finally {
            setIsLoadingTokens(false);
        }
    };

    const handleCreateToken = async (e: Event) => {
        e.preventDefault();
        if (!newTokenName().trim()) {
            setTokenError("Token name is required");
            return;
        }

        setIsCreatingToken(true);
        setTokenError("");
        setTokenSuccess("");

        try {
            const expiryDate = newTokenExpiry() ? new Date(newTokenExpiry()).toISOString() : undefined;
            const token = await createToken(newTokenName(), expiryDate);
            setNewlyCreatedToken(token.token);
            setTokenSuccess("Token created successfully! Make sure to copy it now - you won't be able to see it again.");
            setNewTokenName("");
            setNewTokenExpiry("");
            await loadTokens();
        } catch (err: any) {
            setTokenError(err.message || "Failed to create token");
        } finally {
            setIsCreatingToken(false);
        }
    };

    const handleDeleteToken = async (id: string) => {
        if (!confirm("Are you sure you want to delete this token? This action cannot be undone.")) {
            return;
        }

        setTokenError("");
        setTokenSuccess("");

        try {
            await deleteToken(id);
            setTokenSuccess("Token deleted successfully");
            await loadTokens();
            setTimeout(() => setTokenSuccess(""), 3000);
        } catch (err: any) {
            setTokenError(err.message || "Failed to delete token");
        }
    };

    const copyToClipboard = async (text: string, tokenId?: string) => {
        try {
            await navigator.clipboard.writeText(text);
            if (tokenId) {
                setCopiedTokenId(tokenId);
                setTimeout(() => setCopiedTokenId(null), 2000);
            }
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    onMount(() => {
        loadTokens();
    });

    return (
        <div class="min-h-screen bg-white dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-3xl mx-auto">
                <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-8">
                    {/* Header */}
                    <div class="border-b border-gray-200 dark:border-slate-700 pb-6">
                        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Profile</h1>
                        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            Manage your account settings and preferences
                        </p>
                    </div>

                    {/* Avatar Section */}
                    <div class="space-y-6">
                        <div>
                            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Avatar</h2>
                            <div class="flex items-center gap-6">
                                {/* Current/Preview Avatar */}
                                <div class="relative">
                                    <Show
                                        when={previewUrl() || user()?.avatar_url}
                                        fallback={
                                            <div class="w-24 h-24 rounded-full bg-primary-600 flex items-center justify-center text-white text-3xl font-bold">
                                                {user()?.username?.[0]?.toUpperCase() || '?'}
                                            </div>
                                        }
                                    >
                                        <img
                                            src={previewUrl() || user()!.avatar_url}
                                            alt={user()!.username}
                                            class="w-24 h-24 rounded-full object-cover border-2 border-gray-200 dark:border-slate-700"
                                        />
                                    </Show>
                                    {isUploading() && (
                                        <div class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                        </div>
                                    )}
                                </div>

                                {/* Upload Button */}
                                <div class="flex-1">
                                    <input
                                        id="avatar-upload"
                                        type="file"
                                        accept="image/*"
                                        class="hidden"
                                        onChange={handleFileSelect}
                                        disabled={isUploading()}
                                    />
                                    <label for="avatar-upload" class="inline-block">
                                        <div class="cursor-pointer inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                            <Upload size={16} class="mr-2" />
                                            {isUploading() ? "Uploading..." : "Upload new avatar"}
                                        </div>
                                    </label>
                                    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        JPG, PNG or GIF. Max size 10 MiB. Image will be resized to 256x256.
                                    </p>
                                </div>
                            </div>

                            {/* Success/Error Messages */}
                            {success() && (
                                <div class="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
                                    {success()}
                                </div>
                            )}
                            {error() && (
                                <div class="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                                    {error()}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* User Info Section */}
                    <div class="space-y-4 border-t border-gray-200 dark:border-slate-700 pt-6">
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Information</h2>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Username
                            </label>
                            <div class="px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white">
                                {user()?.username}
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                User ID
                            </label>
                            <div class="px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-500 dark:text-gray-400 font-mono text-sm">
                                {user()?.id}
                            </div>
                        </div>

                        <Show when={user()?.is_admin}>
                            <div class="flex items-center gap-2 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                                <span class="text-primary-700 dark:text-primary-400 font-medium text-sm">
                                    Administrator Account
                                </span>
                            </div>
                        </Show>
                    </div>

                    {/* API Tokens Section */}
                    <div class="space-y-4 border-t border-gray-200 dark:border-slate-700 pt-6">
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">API Tokens</h2>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            API tokens allow you to authenticate with the package registry. Keep them secure!
                        </p>

                        {/* Create Token Form */}
                        <form onSubmit={handleCreateToken} class="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Token Name
                                </label>
                                <input
                                    type="text"
                                    value={newTokenName()}
                                    onInput={(e) => setNewTokenName(e.currentTarget.value)}
                                    placeholder="e.g., CI/CD Token"
                                    class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    disabled={isCreatingToken()}
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Expiration Date (Optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={newTokenExpiry()}
                                    onInput={(e) => setNewTokenExpiry(e.currentTarget.value)}
                                    class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    disabled={isCreatingToken()}
                                />
                                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Leave empty for a token that never expires
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isCreatingToken() || !newTokenName().trim()}
                                class="inline-flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus size={16} class="mr-2" />
                                {isCreatingToken() ? "Creating..." : "Create Token"}
                            </button>
                        </form>

                        {/* Newly Created Token Display */}
                        {newlyCreatedToken() && (
                            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                <p class="text-sm font-medium text-green-800 dark:text-green-400 mb-2">
                                    Token created! Copy it now - you won't be able to see it again.
                                </p>
                                <div class="flex items-center gap-2">
                                    <code class="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-green-300 dark:border-green-700 rounded text-sm font-mono text-gray-900 dark:text-white overflow-x-auto">
                                        {newlyCreatedToken()}
                                    </code>
                                    <button
                                        onClick={() => copyToClipboard(newlyCreatedToken()!)}
                                        class="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                                        title="Copy to clipboard"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => setNewlyCreatedToken(null)}
                                    class="mt-2 text-sm text-green-700 dark:text-green-400 hover:underline"
                                >
                                    I've copied it, dismiss this message
                                </button>
                            </div>
                        )}

                        {/* Success/Error Messages */}
                        {tokenSuccess() && !newlyCreatedToken() && (
                            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
                                {tokenSuccess()}
                            </div>
                        )}
                        {tokenError() && (
                            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                                {tokenError()}
                            </div>
                        )}

                        {/* Token List */}
                        <div class="space-y-2">
                            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Your Tokens</h3>
                            {isLoadingTokens() ? (
                                <div class="text-center py-8">
                                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                                </div>
                            ) : tokens().length === 0 ? (
                                <div class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                                    No tokens yet. Create one to get started!
                                </div>
                            ) : (
                                <div class="space-y-2">
                                    <For each={tokens()}>
                                        {(token) => (
                                            <div class="flex items-center justify-between p-4 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg">
                                                <div class="flex-1">
                                                    <div class="flex items-center gap-2">
                                                        <h4 class="font-medium text-gray-900 dark:text-white">{token.name}</h4>
                                                        {token.expires_at && new Date(token.expires_at) < new Date() && (
                                                            <span class="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-full">
                                                                Expired
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                                                        <div>Created: {new Date(token.created_at).toLocaleDateString()}</div>
                                                        {token.expires_at && (
                                                            <div>Expires: {new Date(token.expires_at).toLocaleDateString()}</div>
                                                        )}
                                                        {token.last_used_at && (
                                                            <div>Last used: {new Date(token.last_used_at).toLocaleDateString()}</div>
                                                        )}
                                                    </div>
                                                    <div class="mt-2 flex items-center gap-2">
                                                        <code class="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded text-xs font-mono text-gray-600 dark:text-gray-400">
                                                            {token.token.substring(0, 8)}...{token.token.substring(token.token.length - 8)}
                                                        </code>
                                                        <button
                                                            onClick={() => copyToClipboard(token.token, token.id)}
                                                            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                                            title="Copy full token"
                                                        >
                                                            {copiedTokenId() === token.id ? (
                                                                <Check size={14} class="text-green-600" />
                                                            ) : (
                                                                <Copy size={14} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteToken(token.id)}
                                                    class="ml-4 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                    title="Delete token"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
