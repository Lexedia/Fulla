import { type Component, createMemo, Show, createSignal, type Accessor } from 'solid-js';
import type { PackageVersion, DownloadSeriesRow } from '../types/types';
import { SolidUplot } from '@dschz/solid-uplot';
import 'uplot/dist/uPlot.min.css';

interface DownloadsChartProps {
    versions: PackageVersion[];
    downloads: DownloadSeriesRow[];
}

const DownloadsChart: Component<DownloadsChartProps> = (props) => {
    const [tooltip, setTooltip] = createSignal({ show: false, left: 0, top: 0, title: '', body: '' });

    const groupLevel = createMemo(() => {
        if (props.versions.length <= 1) return 'exact';
        const majors = new Set(props.versions.map(v => v.version.split('.')[0]));
        if (majors.size > 1) return 'major';
        const minors = new Set(props.versions.map(v => {
            const p = v.version.split('.');
            return `${p[0]}.${p[1] || '0'}`;
        }));
        if (minors.size > 1) return 'minor';
        return 'exact';
    });

    const getGroupName = (version: string): string => {
        const level = groupLevel();
        if (level === 'exact') return `v${version}`;
        const parts = version.split('.');
        if (level === 'major') return `v${parts[0] || '0'}.x`;
        return `v${parts[0] || '0'}.${parts[1] || '0'}.x`;
    };

    const chartDataAndSeries = createMemo(() => {
        const groupsSet = new Set<string>();
        for (let d of props.downloads) {
            if (d.version) groupsSet.add(getGroupName(d.version));
        }

        const groups = [...groupsSet].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

        const dateMap = new Map<number, Map<string, number>>();

        for (let d of props.downloads) {
            if (!d.date || d.count == null) continue;
            const t = Math.floor(new Date(d.date).getTime() / 1000);
            const groupName = getGroupName(d.version);

            if (!dateMap.has(t)) {
                dateMap.set(t, new Map());
            }
            const groupCounts = dateMap.get(t)!;
            groupCounts.set(groupName, (groupCounts.get(groupName) || 0) + d.count);
        }

        const sortedDates = [...dateMap.keys()].sort((a, b) => a - b);

        let paddedDates = [...sortedDates];
        if (paddedDates.length === 1) {
            const t = paddedDates[0];
            paddedDates = [t - 86400, t];
        } else if (paddedDates.length === 0) {
            return { data: [[]], series: [], isEmpty: true };
        }

        const groupCreationDates = new Map<string, number>();
        for (const v of props.versions) {
            const group = getGroupName(v.version);
            const date = Math.floor(new Date(v.created_at).getTime() / 1000);
            if (!groupCreationDates.has(group) || date < groupCreationDates.get(group)!) {
                groupCreationDates.set(group, date);
            }
        }

        const dataMatrix: (number | null)[][] = [paddedDates];

        for (let i = 0; i < groups.length; i++) {
            let groupName = groups[i];
            const creationDate = groupCreationDates.get(groupName) || 0;

            const seriesData = paddedDates.map(t => {
                const count = dateMap.get(t)?.get(groupName);
                if (count == null) {
                    const dayStart = Math.floor(creationDate / 86400) * 86400;
                    if (t < dayStart) return null;
                    return 0;
                }
                return count;
            });
            dataMatrix.push(seriesData);
        };

        const colors = ['#0ea5e9', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

        const seriesConfig = [
            {},
            ...groups.map((g, i) => {
                const color = colors[i % colors.length];
                return {
                    label: g,
                    stroke: color,
                    fill: color + '11',
                    width: 2,
                    points: {
                        show: true,
                        size: 6,
                        stroke: color,
                        fill: "#fff"
                    },
                    value: (_u: any, v: number) => (v == null ? 0 : v) + ' downloads'
                };
            })
        ];

        return {
            data: dataMatrix as number[][],
            series: seriesConfig,
            isEmpty: paddedDates.length === 0
        };
    });

    // Man why dont people export this shit? Now i have to make a frankensteinised version of that to have basic typing
    const options: Accessor<Parameters<typeof SolidUplot>[0]> = createMemo(() => {
        const { series } = chartDataAndSeries();
        return {
            title: "Downloads over Time",
            width: 800,
            height: 400,
            autoResize: true,
            cursor: { points: { size: 6, width: 2 } },
            scales: {
                x: { time: true },
                y: { range: (_u, _min, max) => [0, Math.max(10, max * 1.1)] }
            },
            hooks: {
                setCursor: [
                    (u) => {
                        const { left, top, idx } = u.cursor;
                        if (left! < 0 || top! < 0 || idx == null) {
                            setTooltip(t => ({ ...t, show: false }));
                            return;
                        }

                        const data = u.data;
                        const ts = data[0][idx];
                        if (!ts) return;

                        const dateString = new Date(ts * 1000).toLocaleDateString('en-GB', {
                            month: 'short', day: 'numeric', year: 'numeric'
                        });

                        let closestSeriesIdx = -1;
                        let minDist = 30;

                        for (let i = 1; i < u.series.length; i++) {
                            const val = data[i][idx];
                            if (val == null || !u.series[i].show) continue;

                            const screenY = u.valToPos(val, 'y');
                            const dist = Math.abs(screenY - top!);
                            if (dist < minDist) {
                                minDist = dist;
                                closestSeriesIdx = i;
                            }
                        }

                        if (closestSeriesIdx === -1) {
                            setTooltip(t => ({ ...t, show: false }));
                            return;
                        }

                        const s = u.series[closestSeriesIdx];
                        const val = data[closestSeriesIdx][idx];
                        const bodyHtml = `<div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full" style="background: ${s.stroke}"></span>
                            <span class="font-medium">${s.label}:</span> 
                            <span>${val?.toLocaleString() ?? 0} downloads</span>
                        </div>`;

                        const plotLeft = u.bbox.left;
                        const plotTop = u.bbox.top;

                        setTooltip({
                            show: true,
                            left: left! + plotLeft + 15,
                            top: top! + plotTop + 15,
                            title: dateString,
                            body: bodyHtml
                        });
                    }
                ]
            },
            axes: [
                {
                    font: "12px Arial, sans-serif",
                    stroke: "#64748b",
                    grid: { stroke: "#e2e8f0" }
                },
                {
                    font: "12px Arial, sans-serif",
                    stroke: "#64748b",
                    grid: { stroke: "#e2e8f0" },
                    values: (_u, vals) => vals.map(v => v.toLocaleString())
                }
            ],
            series: series
        };
    });

    return (
        <div class="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 w-full h-[500px] flex flex-col">
            <div class="relative flex-1 min-h-0 w-full" onMouseLeave={() => setTooltip(t => ({ ...t, show: false }))}>
                <Show when={!chartDataAndSeries().isEmpty} fallback={
                    <div class="text-center text-gray-500 py-8">No historical download data available yet.</div>
                }>
                    <SolidUplot {...options()} data={chartDataAndSeries().data} />

                    <Show when={tooltip().show}>
                        <div class="absolute z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl rounded-lg p-3 pointer-events-none text-sm min-w-[150px]"
                            style={{ left: `${tooltip().left}px`, top: `${tooltip().top}px` }}>
                            <div class="font-bold mb-2 text-gray-700 dark:text-gray-200">{tooltip().title}</div>
                            <div class="flex flex-col gap-1 text-gray-600 dark:text-gray-300" innerHTML={tooltip().body}></div>
                        </div>
                    </Show>
                </Show>
            </div>
        </div>
    );
};

export default DownloadsChart;
