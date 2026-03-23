import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import { createSignal, createResource, For, Show } from 'solid-js';
import { searchPackages } from '../api';
import PackageCard from '../components/PackageCard';
import { User } from 'lucide-solid';

const UserPackages: Component = () => {
    const params = useParams();
    const decodedUsername = () => decodeURIComponent(params.username || "");
    const [page] = createSignal(1);

    const [data] = createResource(
        () => ({ username: decodedUsername(), p: page() }),
        async ({ username, p }) => {
            return await searchPackages('', p, 20, username);
        }
    );

    const userAvatar = () => {
        const packages = data()?.packages;
        if (packages && packages.length > 0) {
            return packages[0].owner_avatar;
        }
        return undefined;
    };

    return (
        <div class="min-h-screen pb-20">
            <div class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div class="flex items-center gap-4">
                        <Show
                            when={userAvatar()}
                            fallback={<div class="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <User class="text-primary-600 dark:text-primary-400" size={32} />
                            </div>}
                        >
                            <img
                                src={userAvatar()}
                                alt={params.username}
                                class="w-16 h-16 rounded-full object-cover"
                            />
                        </Show>
                        <div>
                            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                                {decodedUsername()}
                            </h1>
                            <p class="text-gray-600 dark:text-gray-400 mt-1">
                                Published packages
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                <Show
                    when={!data.loading}
                    fallback={
                        <div class="flex justify-center p-8">
                            <span class="loading loading-spinner loading-lg"></span>
                        </div>
                    }
                >
                    <div class="space-y-4">
                        <Show when={data()?.packages && data()!.packages.length > 0}>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                {data()!.packages.length} {data()!.packages.length === 1 ? 'package' : 'packages'}
                            </p>
                        </Show>

                        <For each={data()?.packages}>
                            {pkg => <PackageCard package={pkg} showAuthor={false} />}
                        </For>

                        {(!data()?.packages || data()?.packages.length === 0) && (
                            <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                                <User class="mx-auto mb-4 text-gray-300 dark:text-gray-600" size={48} />
                                <p>No packages found for this user.</p>
                            </div>
                        )}
                    </div>
                </Show>
            </div>
        </div>
    );
};

export default UserPackages;
