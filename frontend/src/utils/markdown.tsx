import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Import themes
import githubDark from 'shiki/themes/github-dark.mjs';
import githubLight from 'shiki/themes/github-light.mjs';

// Import languages
import dart from 'shiki/langs/dart.mjs';
import yaml from 'shiki/langs/yaml.mjs';
import json from 'shiki/langs/json.mjs';
import markdown from 'shiki/langs/markdown.mjs';
import typescript from 'shiki/langs/typescript.mjs';
import javascript from 'shiki/langs/javascript.mjs';
import bash from 'shiki/langs/bash.mjs';
import sql from 'shiki/langs/sql.mjs';

let highlighter: HighlighterCore | null = null;

export async function initHighlighter() {
    if (!highlighter) {
        highlighter = await createHighlighterCore({
            themes: [githubDark, githubLight],
            langs: [dart, yaml, json, markdown, typescript, javascript, bash, sql],
            engine: createJavaScriptRegexEngine()
        });
    }
}

export async function renderMarkdown(text: string): Promise<string> {
    await initHighlighter();

    const renderer = new marked.Renderer();
    const originalCode = renderer.code.bind(renderer);

    renderer.code = function ({ text, lang, escaped }: { text: string; lang?: string; escaped?: boolean }) {
        const args = { text, lang, escaped };
        if (lang && highlighter) {
            try {
                // Use the highlighter to generate HTML
                // We use one theme for now, or could handle dark/light if the highlighter supports it easily
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
        return originalCode(args as any);
    };

    const rawHtml = await marked.parse(text, { renderer, async: true });
    return DOMPurify.sanitize(rawHtml as string, { ADD_ATTR: ['style'] });
}
