/**
 * Azure DevOps theme for the wiki WYSIWYG surface (shared CSS; legacy bundle uses Milkdown `Editor.make()`).
 *
 * Supports light, dark, high-contrast dark, and high-contrast light variants via
 * the `data-theme` attribute on `body` and `.wiki-editor-dark` on the editor root.
 */

import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewOptionsCtx } from '@milkdown/kit/core';
import { WIKI_EDITOR_DARK_CLASS, WIKI_EDITOR_SHELL_CLASS } from '../editor/wiki-editor-dom';

// Import the theme CSS
import './ado-theme.css';

/**
 * Theme type representing ADO theme variants
 */
export type AdoTheme = 'light' | 'dark' | 'hc-dark' | 'hc-light';

/**
 * ProseMirror view attributes for the legacy Milkdown Core bundle (`Editor.make()`), aligned with `WikiEditor` DOM classes.
 *
 * Usage:
 * ```typescript
 * import { adoTheme } from './theme/ado-theme';
 * 
 * Editor.make()
 *   .config(adoTheme)
 *   .use(commonmark)
 *   .create();
 * ```
 */
export const adoTheme = (ctx: Ctx): void => {
    ctx.update(editorViewOptionsCtx, (prev) => ({
        ...prev,
        attributes: {
            ...prev.attributes,
            class: [
                WIKI_EDITOR_SHELL_CLASS,
                (prev.attributes as Record<string, string>)?.class || ''
            ].filter(Boolean).join(' ').trim(),
            spellcheck: 'false',
        },
    }));
};

/**
 * Detect the current ADO theme from the body's data-theme attribute
 */
export function detectAdoTheme(): AdoTheme {
    const bodyTheme = document.body.getAttribute('data-theme') || '';
    
    if (bodyTheme.includes('hc-dark')) {
        return 'hc-dark';
    }
    if (bodyTheme.includes('hc-light')) {
        return 'hc-light';
    }
    if (bodyTheme.includes('dark')) {
        return 'dark';
    }
    
    return 'light';
}

/**
 * Check if the current theme is a dark variant
 */
export function isDarkTheme(theme?: AdoTheme): boolean {
    const currentTheme = theme ?? detectAdoTheme();
    return currentTheme === 'dark' || currentTheme === 'hc-dark';
}

/**
 * Apply dark theme class to the editor container
 * Used for standalone contexts where body doesn't have data-theme
 */
export function applyDarkTheme(editorElement: HTMLElement): void {
    editorElement.classList.add(WIKI_EDITOR_DARK_CLASS);
}

/**
 * Remove dark theme class from the editor container
 */
export function removeDarkTheme(editorElement: HTMLElement): void {
    editorElement.classList.remove(WIKI_EDITOR_DARK_CLASS);
}

export default adoTheme;
