import { type Component, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';

const SearchBar: Component<{ initialQuery?: string, class?: string }> = (props) => {
    const [query, setQuery] = createSignal(props.initialQuery || "");
    const navigate = useNavigate();

    const handleSearch = (e: Event) => {
        e.preventDefault();
        if (query().trim()) {
            navigate(`/search?q=${encodeURIComponent(query())}`);
        }
    };

    return (
        <form onSubmit={handleSearch} class={`relative flex items-center group ${props.class || ''}`}>
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <input
                type="text"
                class="block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-lg leading-5 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:bg-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm transition-all duration-200"
                placeholder="Search packages..."
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
            />
            <button
                type="submit"
                class="absolute right-1 top-1 bottom-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors duration-200 shadow-md shadow-indigo-500/20"
            >
                Search
            </button>
        </form>
    );
};

export default SearchBar;
