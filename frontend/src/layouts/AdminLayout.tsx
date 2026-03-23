import { type ParentComponent, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useAuth } from '../auth';
import { LayoutDashboard, Users, ChevronRight } from 'lucide-solid';

const AdminLayout: ParentComponent = (props) => {
    const { isAdmin, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    // Redirect non-admins immediately
    if (!isAuthenticated() || !isAdmin()) {
        navigate('/');
        return null;
    }

    return (
        <Show when={isAdmin()} fallback={null}>
            <div class="min-h-screen bg-gray-50 dark:bg-slate-950 flex">
                {/* Sidebar */}
                <aside class="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col">
                    <div class="h-16 flex items-center gap-3 px-6 border-b border-gray-200 dark:border-slate-800">
                        <div class="w-7 h-7 bg-primary-600 rounded-md flex items-center justify-center text-white font-bold text-sm">
                            F
                        </div>
                        <div>
                            <div class="text-sm font-bold text-gray-900 dark:text-white">Fulla</div>
                            <div class="text-[10px] font-semibold uppercase tracking-widest text-primary-500">Admin</div>
                        </div>
                    </div>

                    <nav class="flex-1 px-3 py-4 space-y-1">
                        <A
                            href="/admin"
                            end
                            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
                            activeClass="bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-400"
                        >
                            <LayoutDashboard size={16} />
                            Dashboard
                        </A>
                        <A
                            href="/admin/users"
                            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
                            activeClass="bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-400"
                        >
                            <Users size={16} />
                            Users
                        </A>
                    </nav>

                    <div class="p-3 border-t border-gray-200 dark:border-slate-800">
                        <A
                            href="/"
                            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ChevronRight size={14} class="rotate-180" />
                            Back to site
                        </A>
                    </div>
                </aside>

                {/* Main content */}
                <div class="flex-1 flex flex-col min-w-0">
                    <main class="flex-1 p-8">
                        {props.children}
                    </main>
                </div>
            </div>
        </Show>
    );
};

export default AdminLayout;
