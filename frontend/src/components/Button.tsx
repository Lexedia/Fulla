import type { JSX } from "solid-js";

const variants = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm',
    secondary: 'bg-gray-800 hover:bg-gray-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600',
    outline: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
    ghost: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
};

export default function ({ variant = 'primary', class: klass, ...props }: JSX.IntrinsicElements['button'] & { variant?: keyof typeof variants }) {
    return (<button class={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${klass}`} {...props} />)
}
