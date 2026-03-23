import { type Component, createSignal, createEffect, For, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import SearchBar from '../components/SearchBar';
import PackageCard from '../components/PackageCard';
import { searchPackages } from '../api';
import type { SearchPackage } from '../types/types';
import { SortOption } from '../types/types';

const Search: Component = () => {
    const [searchParams] = useSearchParams();
    const [results, setResults] = createSignal<SearchPackage[]>([]);
    const [loading, setLoading] = createSignal(false);
    const [hasSearched, setHasSearched] = createSignal(false);
    const [sortBy, setSortBy] = createSignal<SortOption>(SortOption.Relevance);

    createEffect(async () => {
        const query = searchParams.q as string;
        if (query) {
            setLoading(true);
            setHasSearched(true);
            try {
                const data = await searchPackages(query);
                let sorted = [...data.packages];

                // Apply sorting
                switch (sortBy()) {
                    case SortOption.LastUpdated:
                        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                        break;
                    case SortOption.PubPoints:
                        sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
                        break;
                    case SortOption.Relevance:
                    default:
                        // Already sorted by relevance from Meilisearch
                        break;
                }

                setResults(sorted);
            } catch (e) {
                console.error("Search failed", e);
                setResults([]);
            } finally {
                setLoading(false);
            }
        } else {
            setResults([]);
            setHasSearched(false);
        }
    });

    return (
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="mb-12 text-center">
                <h1 class="text-3xl font-bold text-slate-100 mb-6">Search Packages</h1>
                <div class="max-w-2xl mx-auto">
                    <SearchBar initialQuery={searchParams.q as string} />
                </div>
            </div>

            <Show when={hasSearched()}>
                <div class="mb-6 flex justify-between items-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        {results().length} package{results().length !== 1 ? 's' : ''} found
                    </p>
                    <div class="flex items-center gap-2">
                        <label class="text-sm text-gray-600 dark:text-gray-300">Sort by:</label>
                        <select
                            value={sortBy()}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            class="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value={SortOption.Relevance}>Relevance</option>
                            <option value={SortOption.LastUpdated}>Last Updated</option>
                            <option value={SortOption.PubPoints}>Pub Points</option>
                        </select>
                    </div>
                </div>
            </Show>

            <Show when={loading()}>
                <div class="flex justify-center py-12">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
            </Show>

            <Show when={!loading() && hasSearched()}>
                <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <For
                        each={results()}
                        fallback={
                            <div class="col-span-full text-center py-12 text-slate-500">
                                No packages found matching "{searchParams.q}"
                            </div>
                        }
                    >
                        {(pkg) => (
                            <PackageCard package={pkg} />
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
};

export default Search;
