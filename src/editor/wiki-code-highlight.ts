/**
 * Read-only syntax highlighting for {@link ./wiki-code-block-widget-plugin.ts} code blocks (MV3-safe: bundled grammars only, no network).
 *
 * @see https://github.com/highlightjs/highlight.js/blob/main/VERSION_11_UPGRADE.md
 */

import hljs from 'highlight.js/lib/core';

import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

import 'highlight.js/styles/github.css';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('python', python);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('powershell', powershell);

hljs.registerAliases(['sh', 'shell', 'zsh'], { languageName: 'bash' });
hljs.registerAliases(['js', 'jsx', 'mjs', 'cjs'], { languageName: 'javascript' });
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerAliases(['yml'], { languageName: 'yaml' });
hljs.registerAliases(['py'], { languageName: 'python' });
hljs.registerAliases(['md', 'mkd'], { languageName: 'markdown' });
hljs.registerAliases(['html', 'htm', 'xhtml', 'svg'], { languageName: 'xml' });
hljs.registerAliases(['ps1', 'psm1'], { languageName: 'powershell' });

/** Languages registered in this bundle (for docs / code-block language picker alignment). */
export const WIKI_CODE_HIGHLIGHT_LANGUAGES = [
    'bash',
    'javascript',
    'typescript',
    'json',
    'yaml',
    'python',
    'css',
    'xml',
    'markdown',
    'powershell',
] as const;

/** Skip highlighting above this size to avoid blocking the UI on huge pasted blobs. */
export const WIKI_CODE_HIGHLIGHT_MAX_CHARS = 120_000;

function normalizeFenceLanguage(raw: string): string {
    return raw.trim().toLowerCase().replace(/^language-/, '');
}

/**
 * Returns the highlight.js language key if supported, otherwise `null` (caller should render plain text).
 */
export function resolveWikiCodeHighlightLanguage(params: string): string | null {
    const key = normalizeFenceLanguage(params);
    if (!key) return null;
    return hljs.getLanguage(key) ? key : null;
}

/**
 * Applies syntax highlighting to a `<code>` element in readonly widget mode.
 * On unknown language, oversize body, or errors: plain `textContent` only (no throw).
 */
export function applyWikiCodeReadonlyHighlight(codeEl: HTMLElement, params: string, text: string): void {
    codeEl.classList.remove('hljs');
    codeEl.removeAttribute('data-highlighted');

    if (text.length > WIKI_CODE_HIGHLIGHT_MAX_CHARS) {
        codeEl.textContent = text;
        return;
    }

    const lang = resolveWikiCodeHighlightLanguage(params);
    if (!lang) {
        codeEl.textContent = text;
        return;
    }

    try {
        const { value } = hljs.highlight(text, { language: lang, ignoreIllegals: true });
        codeEl.classList.add('hljs');
        codeEl.innerHTML = value;
        codeEl.dataset.highlighted = lang;
    } catch {
        codeEl.textContent = text;
    }
}
