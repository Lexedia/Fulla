import type { Component } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import { AuthProvider } from './auth';

import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Layout from './layouts/Layout';
import { Search } from 'lucide-solid';
import Button from './components/Button';
import { SortOption, type SearchPackage } from './types/types';
import { createSignal, createResource, For, Show } from 'solid-js';
import { searchPackages } from './api';
import PackageCard from './components/PackageCard';
import PackageDetail from './pages/PackageDetail';
import UserPackages from './pages/UserPackages';
import NotFound from './pages/NotFound';
import { useNavigate } from '@solidjs/router';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';

const Home: Component = () => {
  const [sort, setSort] = createSignal<SortOption>(SortOption.Relevance);
  const [platforms, setPlatforms] = createSignal<string[]>([]);
  const [query, setQuery] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [searchInput, setSearchInput] = createSignal('');
  const [suggestions, setSuggestions] = createSignal<SearchPackage[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = createSignal(false);
  const navigate = useNavigate();

  const [data] = createResource(
    () => ({ q: query(), p: page(), s: sort(), plt: platforms() }),
    async ({ q, p, s, plt }) => await searchPackages(q, p, 10, undefined, s, plt)
  );

  const togglePlatform = (p: string) => {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p]
    );
    setPage(1);
  };

  const handleSearch = () => {
    setQuery(searchInput());
    setPage(1);
    setSuggestions([]);
  };

  const fetchSuggestions = async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsSearchingSuggestions(true);
    try {
      const results = await searchPackages(q, 1, 5);
      setSuggestions(results.packages);
    } catch (err) {
      console.error("Failed to fetch suggestions", err);
    } finally {
      setIsSearchingSuggestions(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div class="min-h-screen pb-20">
      <div class="relative bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div class="absolute inset-0 mask-[radial-gradient(ellipse_at_center,black_10%,transparent_70%)]">
          <div class="absolute inset-0 bg-slate-400/20 dark:bg-slate-500/20" style={{ "mask-image": 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M12 6 Q12 12 18 12 Q12 12 12 18 Q12 12 6 12 Q12 12 12 6 Z\' fill=\'black\'/%3E%3C/svg%3E")', "mask-size": '100px 100px' }}></div>
        </div>

        <div class="relative max-w-4xl mx-auto px-4 pt-20 pb-24 text-center">
          <h1 class="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight drop-shadow-sm">
            Find the <span class="text-primary-600">package</span> you need.
          </h1>
          <p class="text-lg text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto drop-shadow-sm/50">
            Search packages, edit, unlist and yeah idk man.
          </p>
          <div class="max-w-2xl mx-auto relative group">
            <div class="absolute -inset-1 bg-linear-to-r from-primary-600 to-blue-400 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div class="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl flex items-center p-2">
              <Search class="ml-3 text-gray-400 dark:text-gray-500" size={20} />
              <input
                type="text"
                placeholder="Search packages..."
                class="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 px-4 py-2"
                value={searchInput()}
                onInput={(e) => {
                  setSearchInput(e.currentTarget.value);
                  fetchSuggestions(e.currentTarget.value);
                }}
                onKeyDown={handleKeyDown}
              />
              <Show when={isSearchingSuggestions()}>
                <div class="mr-2">
                  <div class="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                </div>
              </Show>
              <Button class='hidden sm:flex' variant='primary' onClick={handleSearch}>Search</Button>
            </div>

            <Show when={suggestions().length > 0}>
              <div class="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-2xl max-h-80 overflow-auto text-left">
                <For each={suggestions()}>
                  {(suggestion) => (
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/packages/${suggestion.package}`);
                        setSuggestions([]);
                      }}
                      class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-slate-700 last:border-0"
                    >
                      <div class="flex justify-between items-center">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-gray-900 dark:text-white">{suggestion.package}</span>
                          <Show when={suggestion.is_discontinued}>
                            <span class="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase rounded border border-red-200 dark:border-red-800">
                              Discontinued
                            </span>
                          </Show>
                        </div>
                        <span class="text-xs text-gray-500">v{suggestion.version}</span>
                      </div>
                      <Show when={suggestion.description}>
                        <div class="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">{suggestion.description}</div>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div class="flex flex-col md:flex-row gap-8">
          {/* Sidebar Filters */}
          <div class="w-full md:w-64 space-y-6">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Sort By</h3>
              <div class="space-y-1">
                <For each={Object.values(SortOption)} >{option =>
                  <button
                    onClick={() => {
                      setSort(option);
                      setPage(1);
                    }}
                    class={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${sort() === option ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                  >
                    {option}
                  </button>
                }</For>
              </div>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Platforms</h3>
              <div class="space-y-2">
                <For each={['Android', 'iOS', 'Web', 'Linux', 'macOS', 'Windows']} >{p => (
                  <label class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={platforms().includes(p.toLowerCase())}
                      onChange={() => togglePlatform(p.toLowerCase())}
                      class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
                    />
                    <span class="group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{p}</span>
                  </label>
                )}</For>
              </div>
            </div>
          </div>

          {/* Package List */}
          <div class="flex-1">
            <Show when={!data.loading} fallback={<div class="flex justify-center p-8"><span class="loading loading-spinner loading-lg"></span></div>}>
              <div class="space-y-4">
                <For each={data()?.packages}>
                  {pkg => <PackageCard package={pkg} />}
                </For>
                {(!data()?.packages || data()?.packages.length === 0) && (
                  <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                    No packages found.
                  </div>
                )}
              </div>

              {/* Pagination */}
              <Show when={data() && data()!.total_hits > 10}>
                <div class="flex justify-center mt-8 space-x-2">
                  <button
                    class="px-4 py-2 rounded-md bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 disabled:opacity-50"
                    disabled={page() === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </button>
                  <span class="px-4 py-2 text-gray-600 dark:text-gray-300">
                    Page {page()}
                  </span>
                  <button
                    class="px-4 py-2 rounded-md bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 disabled:opacity-50"
                    disabled={page() * 10 >= (data()?.total_hits || 0)}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
};

const App: Component = () => {
  return (
    <AuthProvider>
      <Router root={Layout}>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/profile" component={Profile} />
        <Route path="/packages/:name" component={PackageDetail} />
        <Route path="/users/:username" component={UserPackages} />
        <Route path="/admin" component={AdminLayout}>
          <Route path="/" component={AdminDashboard} />
          <Route path="/users" component={AdminUsers} />
        </Route>
        <Route path="*404" component={NotFound} />
      </Router>
    </AuthProvider>
  );
};

export default App;
