import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import Button from '../components/Button';

const NotFound: Component = () => {
    return (
        <div class="min-h-[calc(100vh-4rem)] flex items-center justify-center relative overflow-hidden bg-white dark:bg-slate-900">
            <div class="absolute inset-0 mask-[radial-gradient(ellipse_at_center,black_10%,transparent_70%)] pointer-events-none">
                <div class="absolute inset-0 bg-slate-400/20 dark:bg-slate-500/20" style={{ "mask-image": 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M12 6 Q12 12 18 12 Q12 12 12 18 Q12 12 6 12 Q12 12 12 6 Z\' fill=\'black\'/%3E%3C/svg%3E")', "mask-size": '100px 100px' }}></div>
            </div>
            <div class="relative z-10 text-center px-4">
                <div class="relative mb-4">
                    <h1 class="text-9xl font-black text-slate-200 dark:text-slate-800/50 select-none">404</h1>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <h2 class="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mt-12 md:mt-16">Page not found</h2>
                    </div>
                </div>

                <p class="mt-12 text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
                    Are you lost? Maybe, but it's okay, you're trying your best, please keep on living, you truly rock, I believe in you.
                </p>

                <div class="flex justify-center gap-4">
                    <A href="/">
                        <Button variant="primary">
                            Go Home
                        </Button>
                    </A>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
