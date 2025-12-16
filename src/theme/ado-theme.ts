/**
 * Azure DevOps Theme for Milkdown
 * 
 * Custom theme matching Azure DevOps Wiki styling.
 * Supports Light, Dark, High Contrast Dark, and High Contrast Light themes.
 * 
 * Theming is handled via CSS custom properties that respond to
 * the data-theme attribute on the body element.
 */

import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewOptionsCtx } from '@milkdown/kit/core';

// Import the theme CSS
import './ado-theme.css';

/**
 * Theme type representing ADO theme variants
 */
export type AdoTheme = 'light' | 'dark' | 'hc-dark' | 'hc-light';

/**
 * Azure DevOps theme configuration for Milkdown
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
                'milkdown',
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
    editorElement.classList.add('milkdown-dark-theme');
}

/**
 * Remove dark theme class from the editor container
 */
export function removeDarkTheme(editorElement: HTMLElement): void {
    editorElement.classList.remove('milkdown-dark-theme');
}

export default adoTheme;
