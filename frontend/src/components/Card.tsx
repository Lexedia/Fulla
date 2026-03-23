import type { JSX } from "solid-js";

export default function ({ children, class: klass }: { children: JSX.Element, class?: string }) {
    return (<div class={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${klass}`}>
        {children}
    </div>)
}
