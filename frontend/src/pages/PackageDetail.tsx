import { type Component, createResource, Show, createSignal, For, Switch, Match } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import { getPackageDetails, getPackageVersions, getPackageDownloads, discontinuePackage, searchPackages, likePackage, unlikePackage } from '../api';
import PanaAnalysis from '../components/PanaAnalysis';
import DownloadsChart from '../components/DownloadsChart';
import AdvisoriesPanel from '../components/AdvisoriesPanel';
import { renderMarkdown } from '../utils/markdown';
import { useAuth } from '../auth';
import type { SearchPackage } from '../types/types';
import { timeAgo } from '../utils/utils';
import { Download, BookOpen, User, CircleXIcon, Heart } from 'lucide-solid'

enum Tab {
    Readme = 'Readme',
    Analysis = 'Analysis',
    Versions = 'Versions',
    Stats = 'Stats',
    Advisories = 'Advisories',
}

const PackageDetail: Component = () => {
    const params = useParams();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = createSignal<Tab>(Tab.Readme);
    const [isDiscontinueModalOpen, setIsDiscontinueModalOpen] = createSignal(false);
    const [replacementPackage, setReplacementPackage] = createSignal("");
    const [confirmPackageName, setConfirmPackageName] = createSignal("");
    const [discontinueError, setDiscontinueError] = createSignal("");
    const [isDiscontinuing, setIsDiscontinuing] = createSignal(false);
    const [suggestions, setSuggestions] = createSignal<SearchPackage[]>([]);
    const [isSearchingSuggestions, setIsSearchingSuggestions] = createSignal(false);
    const [isLiking, setIsLiking] = createSignal(false);


    const [detail, { mutate: mutateDetail }] = createResource(() => params.name, (name) => getPackageDetails(name));
    const [versions] = createResource(() => params.name, (name) => getPackageVersions(name));
    const [timeRange, setTimeRange] = createSignal('30d');
    const [downloads] = createResource(
        () => ({ name: params.name!, range: timeRange() }),
        ({ name, range }) => getPackageDownloads(name, range)
    );

    const handleLike = async () => {
        if (!user()) return;
        setIsLiking(true);
        try {
            if (detail()?.is_liked) {
                await unlikePackage(params.name!);
                mutateDetail(prev => prev ? { ...prev, is_liked: false, like_count: prev.like_count - 1 } : undefined);
            } else {
                await likePackage(params.name!);
                mutateDetail(prev => prev ? { ...prev, is_liked: true, like_count: prev.like_count + 1 } : undefined);
            }
        } catch (err) {
            console.error("Failed to update like status", err);
        } finally {
            setIsLiking(false);
        }
    };

    const handleDiscontinue = async (e: Event) => {
        e.preventDefault();
        if (confirmPackageName() !== params.name) {
            setDiscontinueError("Package name confirmation does not match");
            return;
        }
        setIsDiscontinuing(true);
        setDiscontinueError("");
        try {
            await discontinuePackage(params.name, replacementPackage() || undefined);
            setIsDiscontinueModalOpen(false);
            window.location.reload();
        } catch (err: any) {
            setDiscontinueError(err.message || "Failed to discontinue package");
        } finally {
            setIsDiscontinuing(false);
        }
    };

    const fetchSuggestions = async (query: string) => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        setIsSearchingSuggestions(true);
        try {
            const results = await searchPackages(query, 1, 5);
            setSuggestions(results.packages.filter(p => p.package !== params.name));
        } catch (err) {
            console.error("Failed to fetch suggestions", err);
        } finally {
            setIsSearchingSuggestions(false);
        }
    };

    const [readmeHtml] = createResource(() => detail()?.readme, (readme) => {
        if (!readme) return Promise.resolve('');
        return renderMarkdown(readme);
    });

    return (
        <div class="min-h-screen bg-white dark:bg-slate-900 pb-20">
            <div class="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <div class="flex items-center gap-3 mb-2">
                                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{params.name}</h1>
                                <Show when={detail()?.package.is_discontinued}>
                                    <span class="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium rounded-full">
                                        Discontinued
                                    </span>
                                </Show>
                            </div>
                            <Show when={detail()?.package.replaced_by}>
                                <div class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-400">
                                    <span class="font-bold">Note:</span> This package has been discontinued and replaced by: <A href={`/packages/${detail()?.package.replaced_by}`} class="underline font-medium hover:text-amber-600">{detail()?.package.replaced_by}</A>
                                </div>
                            </Show>
                            <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                <Show when={detail()} fallback={<span>Loading...</span>}>
                                    <Show when={detail()?.owner_username}>
                                        <span class="flex items-center gap-1">
                                            <User size={14} />
                                            {detail()?.owner_username}
                                        </span>
                                        <span>•</span>
                                    </Show>
                                    <span>v{detail()?.version.version}</span>
                                    <span>•</span>
                                    <span>Published {timeAgo(detail()?.version.created_at)}</span>
                                    <span>•</span>
                                    <span class="flex items-center gap-1">
                                        <Download size={14} />
                                        {detail()?.download_count} total downloads
                                    </span>
                                </Show>
                            </div>
                        </div>
                        <div class="flex items-center gap-4">
                            <Show when={detail()}>
                                <button
                                    onClick={handleLike}
                                    disabled={!user() || isLiking()}
                                    class={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all font-medium ${detail()?.is_liked
                                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'
                                        } ${!user() ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title={user() ? (detail()?.is_liked ? 'Unlike' : 'Like') : 'Login to like'}
                                >
                                    <Heart size={20} class={detail()?.is_liked ? 'fill-current' : ''} />
                                    <span>{detail()?.like_count}</span>
                                </button>
                            </Show>
                            <a
                                href={`/documentation/${params.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-gray-200 font-medium"
                            >
                                <BookOpen size={20} />
                                Documentation
                            </a>
                            <Show when={detail()?.analysis}>
                                <div class="flex items-center bg-primary-50 dark:bg-primary-900/20 px-4 py-2 rounded-lg border border-primary-100 dark:border-primary-800">
                                    <span class="text-primary-700 dark:text-primary-400 font-bold text-lg mr-2">{detail()?.analysis.scores.grantedPoints}</span>
                                    <span class="text-primary-600 dark:text-primary-400 text-sm font-medium">points</span>
                                </div>
                            </Show>
                            <Show when={user() && (user()?.is_admin || user()?.id === detail()?.package.owner_id) && !detail()?.package.is_discontinued}>
                                <button
                                    onClick={() => setIsDiscontinueModalOpen(true)}
                                    class="px-4 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg transition-colors font-medium text-sm flex items-center gap-2"
                                >
                                    <CircleXIcon size={18} />
                                    Discontinue
                                </button>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* Tabs Header */}
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex space-x-8">
                        <For each={Object.values(Tab)}>
                            {(tab) => (
                                <button
                                    onClick={() => setActiveTab(tab)}
                                    class={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab() === tab
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                        }`}
                                >
                                    {tab}
                                </button>
                            )}
                        </For>
                    </div>
                </div>
            </div>

            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                <Show when={!detail.loading} fallback={<div class="flex justify-center p-12"><span class="loading loading-spinner loading-lg text-primary-600"></span></div>}>
                    <Show when={detail()} fallback={<div class="text-center py-12 text-red-500">Failed to load package details.</div>}>
                        <Switch>
                            <Match when={activeTab() === Tab.Readme}>
                                <div class="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
                                    <Show when={detail()?.readme} fallback={<div class="text-gray-500 text-center py-8 italic">No README provided for this package.</div>}>
                                        <Show when={!readmeHtml.loading} fallback={<div class="flex justify-center py-8"><span class="loading loading-spinner text-primary-600"></span></div>}>
                                            <div class="prose dark:prose-invert max-w-none" innerHTML={readmeHtml()} />
                                        </Show>
                                    </Show>
                                </div>
                            </Match>
                            <Match when={activeTab() === Tab.Analysis}>
                                <Show when={detail()?.analysis} fallback={<div class="text-center py-12 text-gray-500">No analysis results available.</div>}>
                                    <PanaAnalysis report={detail()!.analysis} />
                                </Show>
                            </Match>
                            <Match when={activeTab() === Tab.Versions}>
                                <Show when={!versions.loading} fallback={<div class="flex justify-center p-12"><span class="loading loading-spinner loading-lg text-primary-600"></span></div>}>
                                    <Show when={versions()} fallback={<div class="text-center py-12 text-red-500">Failed to load versions.</div>}>
                                        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                                            <div class="overflow-x-auto">
                                                <table class="w-full">
                                                    <thead class="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                                                        <tr>
                                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Version</th>
                                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Published</th>
                                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody class="divide-y divide-gray-200 dark:divide-slate-700">
                                                        <For each={versions()}>
                                                            {(version) => (
                                                                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                                                    <td class="px-6 py-4 whitespace-nowrap">
                                                                        <div class="flex items-center gap-2">
                                                                            <a
                                                                                href={`/packages/${params.name}`}
                                                                                class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                                                                            >
                                                                                {version.version}
                                                                            </a>
                                                                            <Show when={version.version === versions()?.at(0)?.version}>
                                                                                <span class="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold uppercase rounded border border-primary-200 dark:border-primary-800">
                                                                                    Latest
                                                                                </span>
                                                                            </Show>
                                                                            <Show when={version.retracted}>
                                                                                <span class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase rounded border border-amber-200 dark:border-amber-800">
                                                                                    Retracted
                                                                                </span>
                                                                            </Show>
                                                                        </div>
                                                                    </td>
                                                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                                                        {timeAgo(version.created_at)}
                                                                    </td>
                                                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                                        <div class="flex items-center justify-end gap-2">
                                                                            <a
                                                                                href={version.archive_url}
                                                                                download=""
                                                                                class="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 border border-primary-200 dark:border-primary-800 rounded-md transition-colors font-medium"
                                                                            >
                                                                                <Download size={16} />
                                                                                Download
                                                                            </a>
                                                                            <a
                                                                                href={`/documentation/${params.name}/${version.version}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                class="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded-md transition-colors font-medium"
                                                                            >
                                                                                <BookOpen size={16} />
                                                                                Docs
                                                                            </a>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </For>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </Show>
                                </Show>
                            </Match>
                            <Match when={activeTab() === Tab.Stats}>
                                <div class="flex justify-end mb-6">
                                    <select
                                        value={timeRange()}
                                        onChange={(e) => setTimeRange(e.currentTarget.value)}
                                        class="px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium focus:ring-primary-500 focus:border-primary-500 cursor-pointer text-gray-700 dark:text-gray-200"
                                    >
                                        <option value="30d">Last 30 Days</option>
                                        <option value="90d">Last 90 Days</option>
                                        <option value="all">All Time</option>
                                    </select>
                                </div>
                                <Show when={!downloads.loading} fallback={<div class="flex justify-center p-12"><span class="loading loading-spinner text-primary-600"></span></div>}>
                                    <Show when={downloads()?.data && downloads()!.data.length > 0} fallback={<div class="text-center py-12 text-gray-500">No time-series version data available to display chart.</div>}>
                                        <DownloadsChart
                                            versions={versions() || []}
                                            downloads={downloads()!.data}
                                        />
                                    </Show>
                                </Show>
                            </Match>
                            <Match when={activeTab() === Tab.Advisories}>
                                <AdvisoriesPanel packageName={params.name!} canManage={user()?.is_admin || (user()?.id === detail()?.package.owner_id && !detail()?.package.is_discontinued)} />
                            </Match>
                        </Switch>
                    </Show>
                </Show>
            </div>

            {/* Discontinue Modal */}
            <Show when={isDiscontinueModalOpen()}>
                <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div class="fixed inset-0 bg-slate-900/75 transition-opacity" aria-hidden="true" onClick={() => setIsDiscontinueModalOpen(false)}></div>
                        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div class="relative z-10 inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleDiscontinue}>
                                <div class="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div class="sm:flex sm:items-start">
                                        <div class="mx-auto shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                                            <CircleXIcon size={24} />
                                        </div>
                                        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                            <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                                                Discontinue Package
                                            </h3>
                                            <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                <p class="mb-4">
                                                    Are you sure you want to discontinue this package? This action tells users that the package is no longer maintained.
                                                </p>
                                                <div class="space-y-4">
                                                    <div>
                                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                            Replacement Package (Optional)
                                                        </label>
                                                        <div class="relative">
                                                            <input
                                                                type="text"
                                                                value={replacementPackage()}
                                                                onInput={(e) => {
                                                                    setReplacementPackage(e.currentTarget.value);
                                                                    fetchSuggestions(e.currentTarget.value);
                                                                }}
                                                                placeholder="e.g. other_package"
                                                                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white sm:text-sm pr-10"
                                                            />
                                                            <Show when={isSearchingSuggestions()}>
                                                                <div class="absolute right-3 top-2.5">
                                                                    <div class="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                                                                </div>
                                                            </Show>
                                                            <Show when={suggestions().length > 0}>
                                                                <div class="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg max-h-60 overflow-auto">
                                                                    <For each={suggestions()}>
                                                                        {(suggestion) => (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setReplacementPackage(suggestion.package);
                                                                                    setSuggestions([]);
                                                                                }}
                                                                                class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-slate-700 last:border-0"
                                                                            >
                                                                                <div class="flex items-center gap-2">
                                                                                    <div class="font-medium text-gray-900 dark:text-white">{suggestion.package}</div>
                                                                                    <Show when={suggestion.is_discontinued}>
                                                                                        <span class="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase rounded border border-red-200 dark:border-red-800">
                                                                                            Discontinued
                                                                                        </span>
                                                                                    </Show>
                                                                                </div>
                                                                                <Show when={suggestion.description}>
                                                                                    <div class="text-xs text-gray-500 truncate">{suggestion.description}</div>
                                                                                </Show>
                                                                            </button>
                                                                        )}
                                                                    </For>
                                                                </div>
                                                            </Show>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                            Type package name to confirm
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={confirmPackageName()}
                                                            onInput={(e) => setConfirmPackageName(e.currentTarget.value)}
                                                            placeholder={params.name}
                                                            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white sm:text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                <Show when={discontinueError()}>
                                                    <p class="mt-2 text-sm text-red-600 dark:text-red-400">{discontinueError()}</p>
                                                </Show>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="bg-gray-50 dark:bg-slate-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        disabled={isDiscontinuing() || confirmPackageName() !== params.name}
                                        class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isDiscontinuing() ? 'Processing...' : 'Discontinue'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsDiscontinueModalOpen(false)}
                                        class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-800 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default PackageDetail;
