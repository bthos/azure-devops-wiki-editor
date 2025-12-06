/**
 * Azure DevOps Theme for Milkdown
 * 
 * A custom Milkdown theme that matches Azure DevOps Wiki styling.
 * Supports Light, Dark, High Contrast Dark, and High Contrast Light themes.
 */

import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewOptionsCtx } from '@milkdown/kit/core';

// Import the theme CSS
import './ado-theme.css';

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
export const adoTheme = (ctx: Ctx) => {
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
 * Helper to detect and apply the current ADO theme
 * Call this after creating the editor to sync with ADO's theme
 */
export function detectAdoTheme(): 'light' | 'dark' | 'hc-dark' | 'hc-light' {
    const bodyTheme = document.body.getAttribute('data-theme') || '';
    
    if (bodyTheme.includes('hc-dark')) {
        return 'hc-dark';
    } else if (bodyTheme.includes('hc-light')) {
        return 'hc-light';
    } else if (bodyTheme.includes('dark')) {
        return 'dark';
    }
    
    return 'light';
}

/**
 * Apply dark theme class to the editor container
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
