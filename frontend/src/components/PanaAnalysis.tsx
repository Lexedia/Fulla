import { type Component, For, Show, createSignal, createResource } from 'solid-js';
import type { PanaReport, ReportSection } from '../types/pana';
import { ChevronDown, ChevronUp, CircleCheckBig, CircleX, TriangleAlert, Info } from 'lucide-solid';
import { renderMarkdown } from '../utils/markdown';

interface Props {
    report: PanaReport;
}

const SectionItem: Component<{ section: ReportSection }> = (props) => {
    const [expanded, setExpanded] = createSignal(false);

    const getIcon = () => {
        switch (props.section.status) {
            case 'passed':
                return <CircleCheckBig class="text-green-500" size={20} />;
            case 'failed':
                return <CircleX class="text-red-500" size={20} />;
            case 'partial':
                return <TriangleAlert class="text-yellow-500" size={20} />;
            default:
                return <TriangleAlert class="text-gray-500" size={20} />;
        }
    };

    const [summaryHtml] = createResource(() => props.section.summary, (summary) => {
        return renderMarkdown(summary);
    });

    return (
        <div class="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden mb-4 transition-all duration-200">
            <button
                onClick={() => setExpanded(!expanded())}
                class="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
                <div class="flex items-center space-x-3">
                    {getIcon()}
                    <span class="font-medium text-gray-900 dark:text-white text-left">{props.section.title}</span>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="text-sm font-semibold text-gray-600 dark:text-gray-300 min-w-[60px] text-right">
                        {props.section.grantedPoints} / {props.section.maxPoints}
                    </div>
                    <Show when={expanded()} fallback={<ChevronDown class="text-gray-400" size={20} />}>
                        <ChevronUp class="text-gray-400" size={20} />
                    </Show>
                </div>
            </button>
            <Show when={expanded()}>
                <div class="p-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-700">
                    <Show when={!summaryHtml.loading} fallback={<div class="flex justify-center"><span class="loading loading-spinner text-primary-600"></span></div>}>
                        <div class="prose dark:prose-invert prose-sm max-w-none" innerHTML={summaryHtml()} />
                    </Show>
                </div>
            </Show>
        </div>
    );
};

const PanaAnalysis: Component<Props> = (props) => {
    return (
        <div class="space-y-8 animate-in fade-in duration-500">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Analysis Report</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Comprehensive health and maintenance analysis for this package version
                    </p>
                </div>
                <div class="flex flex-col items-end">
                    <span class="text-xs font-mono text-gray-400">Pana v{props.report.runtimeInfo.panaVersion}</span>
                    <span class="text-xs font-mono text-gray-400">SDK v{props.report.runtimeInfo.sdkVersion}</span>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Overall Score Card */}
                <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <div class="absolute inset-0 bg-primary-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    <div class="relative w-28 h-28 flex items-center justify-center rounded-full border-4 border-primary-500/20 mb-4 ring-4 ring-primary-500/5">
                        <div class="flex flex-col items-center">
                            <span class="text-4xl font-black text-primary-600 dark:text-primary-400 leading-tight">
                                {props.report.scores.grantedPoints}
                            </span>
                        </div>
                        {/* Simple CSS-based progress circle could go here if we wanted to be fancy */}
                    </div>
                    <p class="text-xs text-gray-500 uppercase tracking-widest font-bold">Pub Points</p>
                    <p class="text-xs text-gray-400 mt-1">out of {props.report.scores.maxPoints}</p>
                </div>

                {/* Platform support & Tags */}
                <div class="md:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
                    <div class="flex items-center space-x-2 mb-4">
                        <Info size={16} class="text-gray-400" />
                        <h3 class="font-bold text-gray-900 dark:text-white">Platform & Capabilities</h3>
                    </div>

                    <div class="space-y-4">
                        <div class="flex flex-wrap gap-2">
                            <For each={props.report.tags?.filter(t => t.startsWith('platform:'))}>
                                {(tag) => (
                                    <div class="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-800 flex items-center space-x-1">
                                        <CircleCheckBig size={12} />
                                        <span class="capitalize">{tag.split(':')[1]}</span>
                                    </div>
                                )}
                            </For>
                        </div>

                        <div class="flex flex-wrap gap-2">
                            <For each={props.report.tags?.filter(t => t.startsWith('sdk:'))}>
                                {(tag) => (
                                    <div class="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-md text-xs font-semibold border border-gray-200 dark:border-slate-600">
                                        SDK: <span class="capitalize">{tag.split(':')[1]}</span>
                                    </div>
                                )}
                            </For>
                            <For each={props.report.tags?.filter(t => t.startsWith('is:'))}>
                                {(tag) => (
                                    <div class="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-md text-xs font-semibold border border-purple-100 dark:border-purple-800">
                                        {tag.split(':')[1].replace(/-/g, ' ')}
                                    </div>
                                )}
                            </For>
                            <For each={props.report.tags?.filter(t => t.startsWith('license:'))}>
                                {(tag) => (
                                    <div class="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2.5 py-1 rounded-md text-xs font-semibold border border-green-100 dark:border-green-800">
                                        License: {tag.split(':')[1].toUpperCase()}
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    <Show when={!props.report.tags || props.report.tags.length === 0}>
                        <p class="text-gray-500 text-sm italic">No tags or platform support information detected.</p>
                    </Show>
                </div>
            </div>

            <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white">Analysis Breakdown</h3>
                    <div class="text-sm text-gray-500">
                        {props.report.report.sections.filter(s => s.status === 'passed').length} / {props.report.report.sections.length} passed
                    </div>
                </div>
                <div class="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-gray-200 dark:border-slate-700/50">
                    <For each={props.report.report.sections}>
                        {(section) => <SectionItem section={section} />}
                    </For>
                </div>
            </div>
        </div >
    );
};

export default PanaAnalysis;
