import { createHighlighterCore, type HighlighterCore, type LanguageRegistration } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import githubDark from 'shiki/themes/github-dark.mjs';
import githubLight from 'shiki/themes/github-light.mjs';

const langNames = [
    // Generic languages projects would use
    'dart',
    'yaml',
    'json',
    'markdown',
    'typescript',
    'javascript',
    'bash',

    // DB
    'sql',


    // FFI
    'rust',
    'c',
    'cpp'
] as const

let highlighter: HighlighterCore | null = null;

export async function initHighlighter() {
    if (!highlighter) {
        const langs = await Promise.all(langNames.map(name => import(/* @vite-ignore */ `shiki/langs/${name}.mjs`))) as LanguageRegistration[]


        highlighter = await createHighlighterCore({
            themes: [githubDark, githubLight],
            langs,
            engine: createJavaScriptRegexEngine()
        });
    }
}

export async function renderMarkdown(text: string): Promise<string> {
    await initHighlighter();

    const renderer = new marked.Renderer();
    const originalCode = renderer.code.bind(renderer);

    type Code = Parameters<typeof renderer.code>[0];

    renderer.code = function ({ text, lang, escaped, ...rest }: Code) {
        const args = { text, lang, escaped };
        if (lang && highlighter) {
            try {
                return highlighter.codeToHtml(text, {
                    lang,
                    themes: {
                        light: 'github-light',
                        dark: 'github-dark'
                    }
                });
            } catch (e) {
                console.warn('Shiki highlighting failed for lang:', lang, e);
            }
        }
        // Fallback to default renderer if no language or highlighting fails
        return originalCode({ ...args, ...rest });
    };

    const rawHtml = await marked.parse(text, { renderer, async: true });
    return DOMPurify.sanitize(rawHtml as string, { ADD_ATTR: ['style'] });
}
