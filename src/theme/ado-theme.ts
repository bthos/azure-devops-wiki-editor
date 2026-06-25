/**
 * Azure DevOps theme helpers for the wiki WYSIWYG surface (shared with {@link ../editor/wiki-editor.ts}).
 *
 * Light, dark, high-contrast dark, and high-contrast light variants follow the `data-theme` attribute on `body`
 * and `.wiki-editor-dark` on the editor root.
 */

import { WIKI_EDITOR_DARK_CLASS } from '../editor/wiki-editor-dom';

import './ado-theme.css';

export type AdoTheme = 'light' | 'dark' | 'hc-dark' | 'hc-light';

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

export function isDarkTheme(theme?: AdoTheme): boolean {
    const currentTheme = theme ?? detectAdoTheme();
    return currentTheme === 'dark' || currentTheme === 'hc-dark';
}

export function applyDarkTheme(editorElement: HTMLElement): void {
    editorElement.classList.add(WIKI_EDITOR_DARK_CLASS);
}

export function removeDarkTheme(editorElement: HTMLElement): void {
    editorElement.classList.remove(WIKI_EDITOR_DARK_CLASS);
}
