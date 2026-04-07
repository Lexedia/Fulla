import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import githubDark from 'shiki/themes/github-dark.mjs';
import githubLight from 'shiki/themes/github-light.mjs';

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
