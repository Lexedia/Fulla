import { type Component, For, Show, createSignal, createResource } from 'solid-js';
import { getPackageAdvisories, createAdvisory, deleteAdvisory } from '../api';
import { timeAgo } from '../utils/utils';
import { ShieldAlert, Trash2, Plus, ExternalLink } from 'lucide-solid';
import type { Advisory } from '../types/types';

const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
};

const AdvisoriesPanel: Component<{ packageName: string, canManage?: boolean }> = (props) => {
    const [advisories, { refetch }] = createResource(() => props.packageName, getPackageAdvisories);
    const [showForm, setShowForm] = createSignal(false);
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [error, setError] = createSignal('');

    const [title, setTitle] = createSignal('');
    const [description, setDescription] = createSignal('');
    const [affectedVersions, setAffectedVersions] = createSignal('*');
    const [patchedVersions, setPatchedVersions] = createSignal('');
    const [severity, setSeverity] = createSignal('unknown');
    const [url, setUrl] = createSignal('');

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setAffectedVersions('*');
        setPatchedVersions('');
        setSeverity('unknown');
        setUrl('');
        setError('');
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        if (!title().trim()) {
            setError('Title is required');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await createAdvisory(props.packageName, {
                title: title().trim(),
                description: description().trim() || undefined,
                affectedVersions: affectedVersions().trim() || undefined,
                patchedVersions: patchedVersions().trim() || undefined,
                severity: severity(),
                url: url().trim() || undefined,
            });
            resetForm();
            setShowForm(false);
            refetch();
        } catch (err: any) {
            setError(err.message || 'Failed to create advisory');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this advisory?')) return;
        try {
            await deleteAdvisory(id);
            refetch();
        } catch (err: any) {
            console.error('Failed to delete advisory', err);
        }
    };

    return (
        <div>
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-2">
                    <ShieldAlert size={20} class="text-gray-500 dark:text-gray-400" />
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                        Security Advisories
                    </h2>
                    <Show when={advisories()?.advisories?.length}>
                        <span class="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            {advisories()!.advisories.length}
                        </span>
                    </Show>
                </div>
                <Show when={props.canManage}>
                    <button
                        onClick={() => { setShowForm(!showForm()); if (!showForm()) resetForm(); }}
                        class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 border border-primary-200 dark:border-primary-800 rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        {showForm() ? 'Cancel' : 'Add Advisory'}
                    </button>
                </Show>
            </div>

            <Show when={showForm()}>
                <div class="mb-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                    <form onSubmit={handleSubmit} class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                            <input
                                type="text"
                                value={title()}
                                onInput={(e) => setTitle(e.currentTarget.value)}
                                placeholder="e.g. Arbitrary code execution in parser"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                            <textarea
                                value={description()}
                                onInput={(e) => setDescription(e.currentTarget.value)}
                                rows={3}
                                placeholder="Describe the vulnerability..."
                                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500 resize-y"
                            />
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Affected Versions</label>
                                <input
                                    type="text"
                                    value={affectedVersions()}
                                    onInput={(e) => setAffectedVersions(e.currentTarget.value)}
                                    placeholder="e.g. <2.0.0 or *"
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Patched Versions</label>
                                <input
                                    type="text"
                                    value={patchedVersions()}
                                    onInput={(e) => setPatchedVersions(e.currentTarget.value)}
                                    placeholder="e.g. >=2.0.1"
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Severity</label>
                                <select
                                    value={severity()}
                                    onChange={(e) => setSeverity(e.currentTarget.value)}
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500 cursor-pointer"
                                >
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                    <option value="unknown">Unknown</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
                                <input
                                    type="url"
                                    value={url()}
                                    onInput={(e) => setUrl(e.currentTarget.value)}
                                    placeholder="https://..."
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                        </div>
                        <Show when={error()}>
                            <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
                        </Show>
                        <div class="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting()}
                                class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                                {isSubmitting() ? 'Creating...' : 'Create Advisory'}
                            </button>
                        </div>
                    </form>
                </div>
            </Show>

            <Show when={!advisories.loading} fallback={<div class="flex justify-center p-12"><span class="loading loading-spinner text-primary-600"></span></div>}>
                <Show when={advisories()?.advisories?.length} fallback={
                    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
                        <ShieldAlert size={40} class="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                        <p class="text-gray-500 dark:text-gray-400">No security advisories for this package.</p>
                    </div>
                }>
                    <div class="space-y-4">
                        <For each={advisories()!.advisories}>
                            {(advisory: Advisory) => (
                                <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5">
                                    <div class="flex items-start justify-between gap-4">
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 flex-wrap mb-2">
                                                <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                                                    {advisory.summary}
                                                </h3>
                                                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase border ${severityColors[advisory.database_specific?.severity || 'unknown'] || severityColors.unknown}`}>
                                                    {advisory.database_specific?.severity || 'unknown'}
                                                </span>
                                            </div>
                                            <Show when={advisory.details}>
                                                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{advisory.details}</p>
                                            </Show>
                                            <div class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span>Affected: <code class="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 rounded font-mono">{advisory.affected?.[0]?.ranges?.[0]?.events?.find(e => e.introduced)?.introduced || '*'}</code></span>
                                                <Show when={advisory.affected?.[0]?.ranges?.[0]?.events?.find(e => e.fixed)?.fixed}>
                                                    <span>Patched: <code class="px-1 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded font-mono">{advisory.affected[0].ranges[0].events.find(e => e.fixed)!.fixed}</code></span>
                                                </Show>
                                                <span>Published {timeAgo(advisory.published)}</span>
                                                <Show when={advisory.references?.[0]?.url}>
                                                    <a
                                                        href={advisory.references![0].url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
                                                    >
                                                        <ExternalLink size={12} />
                                                        More info
                                                    </a>
                                                </Show>
                                            </div>
                                        </div>
                                        <Show when={props.canManage}>
                                            <button
                                                onClick={() => handleDelete(advisory.id)}
                                                class="shrink-0 p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="Delete advisory"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </Show>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </Show>
        </div>
    );
};

export default AdvisoriesPanel;
