import { For, Show } from "solid-js";
import type { Package } from "../types/types";
import Badge from "./Badge";
import Card from "./Card";
import ScoreBar from "./ScoreBar";
import { Calendar, ChevronRight, UserIcon } from "lucide-solid";

export default function ({ pkg, onClick }: { pkg: Package, onClick: () => void }) {
    return (
        <Card class="hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-200 cursor-pointer group">
            <div class="p-5" onClick={onClick}>
                <div class="flex justify-between items-start">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 mb-1">
                            <h3 class="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">
                                {pkg.name}
                            </h3>
                            <span class="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                {pkg.latest.version}
                            </span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
                            {pkg.latest.pubspec.description}
                        </p>

                        <div class="flex flex-wrap gap-2">
                            <For each={pkg.latest.pubspec.topics?.slice(0, 4)}>
                                {tag => <Badge color="blue">{tag}</Badge>}
                            </For>
                        </div>
                    </div>

                    <div class="hidden sm:flex flex-col gap-3 ml-4 border-l border-gray-100 dark:border-slate-700 pl-4">
                        <ScoreBar score={pkg.like_count} max={100} label="Likes" />
                        <ScoreBar score={pkg.download_count} max={1000} label="Downloads" />
                    </div>
                </div>

                <div class="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <div class="flex gap-4">
                        <Show when={pkg.owner_username}>
                            <span class="flex items-center gap-1.5">
                                <Show
                                    when={pkg.owner_avatar}
                                    fallback={<UserIcon size={16} class="text-gray-400" />}
                                >
                                    <img
                                        src={pkg.owner_avatar}
                                        alt={pkg.owner_username}
                                        class="w-4 h-4 rounded-full object-cover"
                                    />
                                </Show>
                                {pkg.owner_username}
                            </span>
                        </Show>
                        <span class="flex items-center gap-1">
                            <Calendar size={12} /> {pkg.latest.created_at ? new Date(pkg.latest.created_at).toLocaleDateString() : 'Recently'}
                        </span>
                    </div>
                    <span class="text-primary-600 dark:text-primary-400 font-medium group-hover:underline flex items-center gap-1">
                        View Details <ChevronRight size={12} />
                    </span>
                </div>
            </div>
        </Card>
    )
}
