import { createEffect, createSignal, type ParentComponent } from 'solid-js';
import NavBar from '../components/NavBar';

const Layout: ParentComponent = (props) => {
    const stored = localStorage.getItem('colorTheme');
    const [darkMode, setDarkMode] = createSignal(stored !== null ? stored === 'true' : false);

    createEffect(() => {
        const isDark = darkMode();
        localStorage.setItem('colorTheme', String(isDark));
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    })


    return (
        <div class="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            <NavBar darkMode={darkMode} toggleTheme={() => setDarkMode(!darkMode())} />
            <main>
                {props.children}
            </main>
            <footer class="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 py-12 mt-auto">
                <div class="max-w-7xl mx-auto px-4 text-center">
                    <p class="text-gray-500 dark:text-gray-400 text-sm">
                        Not affiliated with Google or pub.dev.
                    </p>
                </div>
            </footer>
        </div>
    )
};

export default Layout;
