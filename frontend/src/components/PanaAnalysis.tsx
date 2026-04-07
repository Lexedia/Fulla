import { type Component, For, Show, createSignal, createResource, createMemo } from 'solid-js';
import type { PanaReport, ReportSection } from '../types/pana';
import { ChevronDown, ChevronUp, CircleCheckBig, CircleX, TriangleAlert, Info, Shield, Cpu, FileCode, Wrench, Globe, Smartphone, Monitor, Server } from 'lucide-solid';
import { renderMarkdown } from '../utils/markdown';

interface Props {
    report: PanaReport;
}

function preprocessPanaSummary(raw: string): string {
    return raw
        .replace(/^(?:\s*|#{1,6}\s*)\[\*\]\s*(.+)$/gm, '<div class="pana-check pana-pass"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="4" fill="#22c55e" fill-opacity="0.15"/><path d="M4.5 8.5L7 11L11.5 5.5" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>$1</span></div>')
        .replace(/^(?:\s*|#{1,6}\s*)\[x\]\s*(.+)$/gm, '<div class="pana-check pana-fail"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="4" fill="#ef4444" fill-opacity="0.15"/><path d="M5 5L11 11M11 5L5 11" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg><span>$1</span></div>');
}

const ScoreRing: Component<{ granted: number; max: number }> = (props) => {
    const pct = createMemo(() => Math.round((props.granted / props.max) * 100));
    const color = createMemo(() => {
        const p = pct();
        if (p >= 80) return { stroke: '#22c55e', bg: 'rgba(34,197,94,0.08)', label: 'text-green-500' };
        if (p >= 50) return { stroke: '#eab308', bg: 'rgba(234,179,8,0.08)', label: 'text-yellow-500' };
        return { stroke: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: 'text-red-500' };
    });
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = createMemo(() => circumference - (pct() / 100) * circumference);

    return (
        <div class="relative flex items-center justify-center" style={{ width: '160px', height: '160px' }}>
            <div class="absolute inset-0 rounded-full blur-2xl opacity-40" style={{ background: color().bg }} />
            <svg width="160" height="160" class="transform -rotate-90">
                <circle
                    cx="80" cy="80" r={radius}
                    fill="none"
                    stroke="currentColor"
                    class="text-gray-200 dark:text-slate-700"
                    stroke-width="10"
                />
                <circle
                    cx="80" cy="80" r={radius}
                    fill="none"
                    stroke={color().stroke}
                    stroke-width="10"
                    stroke-linecap="round"
                    stroke-dasharray={circumference.toString()}
                    stroke-dashoffset={dashOffset()}
                    class="transition-all duration-1000 ease-out"
                />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class={`text-4xl font-black leading-none ${color().label}`}>{props.granted}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 font-semibold mt-1">/ {props.max}</span>
            </div>
        </div>
    );
};

const SectionScoreBar: Component<{ granted: number; max: number; status: string }> = (props) => {
    const pct = createMemo(() => props.max > 0 ? (props.granted / props.max) * 100 : 0);
    const barColor = createMemo(() => {
        if (props.status === 'passed') return 'bg-green-500';
        if (props.status === 'partial') return 'bg-yellow-500';
        return 'bg-red-500';
    });
    return (
        <div class="flex items-center gap-3 min-w-[140px]">
            <div class="flex-1 h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                <div
                    class={`h-full rounded-full transition-all duration-700 ease-out ${barColor()}`}
                    style={{ width: `${pct()}%` }}
                />
            </div>
            <span class="text-sm font-bold text-gray-700 dark:text-gray-300 tabular-nums w-[52px] text-right">
                {props.granted}/{props.max}
            </span>
        </div>
    );
};

const StatusBadge: Component<{ status: string }> = (props) => {
    const config = createMemo(() => {
        switch (props.status) {
            case 'passed':
                return { icon: CircleCheckBig, cls: 'bg-green-100 dark:bg-green-900/25 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800', text: 'Passed' };
            case 'failed':
                return { icon: CircleX, cls: 'bg-red-100 dark:bg-red-900/25 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800', text: 'Failed' };
            case 'partial':
                return { icon: TriangleAlert, cls: 'bg-yellow-100 dark:bg-yellow-900/25 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', text: 'Partial' };
            default:
                return { icon: Info, cls: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-600', text: 'Unknown' };
        }
    });

    return (
        <div class={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${config().cls}`}>
            {(() => { const Icon = config().icon; return <Icon size={12} />; })()}
            {config().text}
        </div>
    );
};

const SectionCard: Component<{ section: ReportSection; index: number }> = (props) => {
    const [expanded, setExpanded] = createSignal(false);

    const [summaryHtml] = createResource(() => props.section.summary, (summary) => {
        console.log(summary);
        return renderMarkdown(preprocessPanaSummary(summary));
    });

    const sectionIcon = createMemo(() => {
        const id = props.section.id?.toLowerCase() || props.section.title.toLowerCase();
        if (id.includes('convention') || id.includes('follow')) return FileCode;
        if (id.includes('document') || id.includes('readme')) return FileCode;
        if (id.includes('platform') || id.includes('support')) return Cpu;
        if (id.includes('analysis') || id.includes('static') || id.includes('code')) return Shield;
        if (id.includes('depend') || id.includes('up-to-date')) return Wrench;
        return Info;
    });

    return (
        <div
            class={`group rounded-xl border transition-all duration-300 overflow-hidden ${expanded()
                ? 'border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-500/5'
                : 'border-gray-200 dark:border-slate-700/80 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
            style={{ 'animation-delay': `${props.index * 80}ms` }}
        >
            <button
                onClick={() => setExpanded(!expanded())}
                class="w-full flex items-center gap-4 p-5 bg-white dark:bg-slate-800/80 hover:bg-gray-50/80 dark:hover:bg-slate-750/50 transition-colors text-left"
            >
                <div class={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${props.section.status === 'passed'
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    : props.section.status === 'partial'
                        ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    }`}>
                    {(() => { const Icon = sectionIcon(); return <Icon size={20} />; })()}
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-3 mb-1.5">
                        <span class="font-semibold text-gray-900 dark:text-white text-sm truncate">{props.section.title}</span>
                        <StatusBadge status={props.section.status} />
                    </div>
                    <SectionScoreBar granted={props.section.grantedPoints} max={props.section.maxPoints} status={props.section.status} />
                </div>

                <div class="shrink-0 ml-2">
                    <Show when={expanded()} fallback={<ChevronDown class="text-gray-400 dark:text-gray-500" size={18} />}>
                        <ChevronUp class="text-gray-400 dark:text-gray-500" size={18} />
                    </Show>
                </div>
            </button>

            <Show when={expanded()}>
                <div class="border-t border-gray-100 dark:border-slate-700/60 bg-gray-50/80 dark:bg-slate-900/40 p-5">
                    <Show when={!summaryHtml.loading} fallback={
                        <div class="flex items-center gap-2 text-gray-400">
                            <div class="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                            <span class="text-sm">Loading details…</span>
                        </div>
                    }>
                        <div class="not-prose dark:prose-invert prose-sm max-w-none prose-headings:text-base prose-p:leading-relaxed prose-code:text-xs prose-li:my-0.5" innerHTML={summaryHtml()} />
                    </Show>
                </div>
            </Show>
        </div>
    );
};

const PlatformPill: Component<{ platform: string }> = (props) => {
    const config = createMemo(() => {
        const p = props.platform.toLowerCase();
        if (p === 'android') return { icon: Smartphone, color: 'bg-green-50 dark:bg-green-900/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' };
        if (p === 'ios') return { icon: Smartphone, color: 'bg-gray-50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700' };
        if (p === 'web') return { icon: Globe, color: 'bg-blue-50 dark:bg-blue-900/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' };
        if (p === 'windows') return { icon: Monitor, color: 'bg-cyan-50 dark:bg-cyan-900/15 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800' };
        if (p === 'macos') return { icon: Monitor, color: 'bg-violet-50 dark:bg-violet-900/15 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800' };
        if (p === 'linux') return { icon: Server, color: 'bg-orange-50 dark:bg-orange-900/15 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' };
        return { icon: Cpu, color: 'bg-gray-50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700' };
    });

    return (
        <div class={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border ${config().color} transition-transform hover:scale-105`}>
            {(() => { const Icon = config().icon; return <Icon size={14} />; })()}
            <span class="capitalize">{props.platform}</span>
        </div>
    );
};

const TagPill: Component<{ label: string; variant: 'sdk' | 'is' | 'license' }> = (props) => {
    const cls = createMemo(() => {
        switch (props.variant) {
            case 'sdk': return 'bg-indigo-50 dark:bg-indigo-900/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
            case 'is': return 'bg-purple-50 dark:bg-purple-900/15 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
            case 'license': return 'bg-emerald-50 dark:bg-emerald-900/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
        }
    });

    return (
        <span class={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${cls()}`}>
            {props.label}
        </span>
    );
};

const PanaAnalysis: Component<Props> = (props) => {
    const platforms = createMemo(() =>
        props.report.tags?.filter(t => t.startsWith('platform:')).map(t => t.split(':')[1]) || []
    );
    const sdkTags = createMemo(() =>
        props.report.tags?.filter(t => t.startsWith('sdk:')).map(t => t.split(':')[1]) || []
    );
    const isTags = createMemo(() =>
        props.report.tags?.filter(t => t.startsWith('is:')).map(t => t.split(':')[1].replace(/-/g, ' ')) || []
    );
    const licenseTags = createMemo(() =>
        props.report.tags?.filter(t => t.startsWith('license:')).map(t => t.split(':')[1].toUpperCase()) || []
    );

    const passedCount = createMemo(() => props.report.report.sections.filter(s => s.status === 'passed').length);
    const totalCount = createMemo(() => props.report.report.sections.length);

    return (
        <div class="space-y-8">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div class="lg:col-span-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-gray-200 dark:border-slate-700/80 p-8 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                    <ScoreRing granted={props.report.scores.grantedPoints} max={props.report.scores.maxPoints} />
                    <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] font-bold mt-4">Pub Points</p>
                    <div class="flex items-center gap-2 mt-3">
                        <span class="text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                            pana v{props.report.runtimeInfo.panaVersion}
                        </span>
                        <span class="text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                            sdk v{props.report.runtimeInfo.sdkVersion}
                        </span>
                    </div>
                </div>

                <div class="lg:col-span-8 bg-white dark:bg-slate-800/80 rounded-2xl border border-gray-200 dark:border-slate-700/80 p-8 backdrop-blur-sm">
                    <div class="space-y-6">
                        <Show when={platforms().length > 0}>
                            <div>
                                <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Supported Platforms</h3>
                                <div class="flex flex-wrap gap-2">
                                    <For each={platforms()}>
                                        {(p) => <PlatformPill platform={p} />}
                                    </For>
                                </div>
                            </div>
                        </Show>

                        <Show when={sdkTags().length > 0 || isTags().length > 0 || licenseTags().length > 0}>
                            <div>
                                <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Tags</h3>
                                <div class="flex flex-wrap gap-2">
                                    <For each={sdkTags()}>
                                        {(t) => <TagPill label={`SDK: ${t}`} variant="sdk" />}
                                    </For>
                                    <For each={isTags()}>
                                        {(t) => <TagPill label={t} variant="is" />}
                                    </For>
                                    <For each={licenseTags()}>
                                        {(t) => <TagPill label={`License: ${t}`} variant="license" />}
                                    </For>
                                </div>
                            </div>
                        </Show>

                        <Show when={!props.report.tags || props.report.tags.length === 0}>
                            <p class="text-gray-500 dark:text-gray-400 text-sm italic">No platform or tag information detected.</p>
                        </Show>
                    </div>
                </div>
            </div>

            <div>
                <div class="flex items-center justify-between mb-5">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white">Analysis Breakdown</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {passedCount()} of {totalCount()} categories passed
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <For each={props.report.report.sections}>
                            {(section) => (
                                <div
                                    class={`w-2.5 h-2.5 rounded-full transition-colors ${section.status === 'passed'
                                        ? 'bg-green-500'
                                        : section.status === 'partial'
                                            ? 'bg-yellow-500'
                                            : 'bg-red-500'
                                        }`}
                                    title={`${section.title}: ${section.grantedPoints}/${section.maxPoints}`}
                                />
                            )}
                        </For>
                    </div>
                </div>
                <div class="space-y-3">
                    <For each={props.report.report.sections}>
                        {(section, i) => <SectionCard section={section} index={i()} />}
                    </For>
                </div>
            </div>
        </div>
    );
};

export default PanaAnalysis;
