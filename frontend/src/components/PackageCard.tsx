import { For, Show, type Component } from 'solid-js';
import { type SearchPackage } from '../types/types';
import { timeAgo } from '../utils/utils';


interface Props {
    package: SearchPackage;
    showAuthor?: boolean;
}

const PackageCard: Component<Props> = (props) => {


    return (
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow relative overflow-hidden text-left">
            <Show when={props.package.is_discontinued}>
                <div class="absolute top-0 right-0 bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-bl-lg border-b border-l border-red-200 dark:border-red-800">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Discontinued</span>
                </div>
            </Show>
            <div class="flex justify-between items-start">
                <div>
                    <a href={`/packages/${props.package.package}`} class="text-lg font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer">
                        {props.package.package}
                    </a>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        v{props.package.version} • Updated {timeAgo(props.package.updated_at)}
                    </p>
                </div>
                <div class="flex flex-col items-end">
                    <div class={`flex flex-col items-end gap-2`}>
                        <Show when={props.package.score !== undefined}>
                            <div class={`flex items-center space-x-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded text-xs font-medium text-blue-700 dark:text-blue-300 ${props.package.is_discontinued ? 'mt-8' : ''}`}>
                                <span>{props.package.score}</span>
                                <span>points</span>
                            </div>
                            {/* <ScoreBar score={props.package.score!} max={160} label="Score" /> */}
                        </Show>
                    </div>
                </div>
            </div>
            <p class="mt-3 text-gray-600 dark:text-gray-300 text-sm line-clamp-2">
                {props.package.description || 'No description available.'}
            </p>
            <Show when={props.package.platforms && props.package.platforms.length > 0}>
                <div class="mt-3 flex flex-wrap gap-1.5">
                    <For each={props.package.platforms}>
                        {platform => (
                            <span class="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 text-[10px] font-medium rounded uppercase tracking-wider">
                                {platform}
                            </span>
                        )}
                    </For>
                </div>
            </Show>
            {props.package.owner_username && (props.showAuthor !== false) && (
                <div class="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {props.package.owner_avatar ? (
                        <img
                            src={props.package.owner_avatar}
                            alt={props.package.owner_username}
                            class="w-4 h-4 rounded-full object-cover"
                        />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    )}
                    <a href={`/users/${props.package.owner_username}`} class="hover:underline hover:text-primary-600 dark:hover:text-primary-400">
                        {props.package.owner_username}
                    </a>
                </div>
            )}
        </div>
    );
};

export default PackageCard;
