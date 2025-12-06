// Milkdown Core Editor Bundle for Azure DevOps Wiki Editor
// Custom editor built on @milkdown/kit with Azure DevOps styling

import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx, editorViewOptionsCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { getMarkdown, replaceAll } from '@milkdown/kit/utils';

// Import required ProseMirror base CSS
import '@milkdown/kit/prose/view/style/prosemirror.css';

// Import custom Azure DevOps theme
import { adoTheme, detectAdoTheme, applyDarkTheme, removeDarkTheme } from './theme/ado-theme';

// Import ADO syntax extensions
import { adoSyntaxPlugin } from './syntax';

// Import toolbar plugin
import { toolbarPlugin } from './toolbar';

// Export core classes and utilities for use in main.ts
export { 
    Editor, 
    rootCtx, 
    defaultValueCtx, 
    editorViewCtx, 
    serializerCtx, 
    editorViewOptionsCtx,
    commonmark,
    gfm,
    history,
    listener,
    listenerCtx,
    clipboard,
    getMarkdown,
    replaceAll,
    // Theme exports
    adoTheme,
    detectAdoTheme,
    applyDarkTheme,
    removeDarkTheme,
    // ADO Syntax exports
    adoSyntaxPlugin,
    // Toolbar exports
    toolbarPlugin
};

// Also attach to window for global access
if (typeof window !== 'undefined') {
    (window as any).MilkdownEditor = Editor;
    (window as any).MilkdownCore = {
        Editor,
        rootCtx,
        defaultValueCtx,
        editorViewCtx,
        serializerCtx,
        editorViewOptionsCtx,
        commonmark,
        gfm,
        history,
        listener,
        listenerCtx,
        clipboard,
        getMarkdown,
        replaceAll,
        adoTheme,
        detectAdoTheme,
        applyDarkTheme,
        removeDarkTheme,
        adoSyntaxPlugin,
        toolbarPlugin
    };
}
