import { createSignal } from "solid-js";
import { useAuth, authenticatedFetch } from "../auth";
import { useNavigate, A } from "@solidjs/router";
import Button from "../components/Button";

export default function Login() {
    const [username, setUsername] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [error, setError] = createSignal("");
    const [isLoading, setIsLoading] = createSignal(false);
    const auth = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const response = await authenticatedFetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username(), password: password() }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || "Login failed");
            }

            const data = await response.json();
            auth.login(data.token, data.user);
            navigate("/");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div class="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full">
                <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-6">
                    {/* Header */}
                    <div class="text-center">
                        <div class="w-16 h-16 mx-auto bg-primary-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4">
                            F
                        </div>
                        <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
                        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            Sign in to your account to continue
                        </p>
                    </div>

                    {/* Form */}
                    <form class="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Username
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                disabled={isLoading()}
                                class="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Enter your username"
                                value={username()}
                                onChange={(e) => setUsername(e.currentTarget.value)}
                            />
                        </div>

                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                disabled={isLoading()}
                                class="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Enter your password"
                                value={password()}
                                onChange={(e) => setPassword(e.currentTarget.value)}
                            />
                        </div>

                        {error() && (
                            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                                {error()}
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="primary"
                            class="w-full py-3"
                            disabled={isLoading()}
                        >
                            {isLoading() ? "Signing in..." : "Sign in"}
                        </Button>
                    </form>

                    {/* Footer */}
                    <div class="text-center pt-4 border-t border-gray-200 dark:border-slate-700">
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            Don't have an account?{" "}
                            <A href="/register" class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors">
                                Sign up
                            </A>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
