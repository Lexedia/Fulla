import type { JSX } from "solid-js";

const colours = {
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    grey: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export default function Badge(props: { children: JSX.Element, color: keyof typeof colours }) {
    return (<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colours[props.color]}`}>
        {props.children}
    </span>)
}
