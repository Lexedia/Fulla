import { createResource, Show, For } from 'solid-js';
import { getAdminStats } from '../../api';
import { Package, Users, GitBranch, TrendingUp } from 'lucide-solid';

const AdminDashboard = () => {
    const [stats] = createResource(getAdminStats);

    const statCards = () => [
        {
            label: 'Total Users',
            value: stats()?.users ?? '—',
            icon: Users,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
        },
        {
            label: 'Total Packages',
            value: stats()?.packages ?? '—',
            icon: Package,
            color: 'text-violet-600 dark:text-violet-400',
            bg: 'bg-violet-50 dark:bg-violet-900/20',
        },
        {
            label: 'Total Versions',
            value: stats()?.versions ?? '—',
            icon: GitBranch,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        },
        {
            label: 'Avg. Versions / Package',
            value: stats() && stats()!.packages > 0
                ? (stats()!.versions / stats()!.packages).toFixed(1)
                : '—',
            icon: TrendingUp,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-900/20',
        },
    ];

    return (
        <div>
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Overview of your Fulla registry</p>
            </div>

            <Show
                when={!stats.loading}
                fallback={
                    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                        <For each={[1, 2, 3, 4]}>
                            {() => (
                                <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 animate-pulse">
                                    <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
                                    <div class="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
                                </div>
                            )}
                        </For>
                    </div>
                }
            >
                <Show when={stats.error}>
                    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
                        Failed to load stats: {stats.error?.message}
                    </div>
                </Show>
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                    <For each={statCards()}>
                        {(card) => {
                            const Icon = card.icon;
                            return (
                                <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 hover:shadow-md transition-shadow">
                                    <div class="flex items-center justify-between mb-4">
                                        <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</span>
                                        <div class={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                                            <Icon size={18} class={card.color} />
                                        </div>
                                    </div>
                                    <div class="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                                        {card.value}
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>
        </div>
    );
};

export default AdminDashboard;
