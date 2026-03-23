

export default function ({ score, max, label }: { score: number; max: number; label: string }) {
    const percentage = Math.min(100, Math.max(0, (score / max) * 100));
    return (
        <div class={`flex flex-col gap-1 w-24`}>
            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>{label}</span>
                <span>{score}</span>
            </div>
            <div class="h-1.5 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                    class="h-full bg-primary-500 rounded-full"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
