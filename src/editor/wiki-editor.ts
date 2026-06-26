import { baseKeymap } from 'prosemirror-commands';

import { gapCursor } from 'prosemirror-gapcursor';

import { history, redo, undo } from 'prosemirror-history';

import { keymap } from 'prosemirror-keymap';

import type { Plugin } from 'prosemirror-state';

import { EditorState } from 'prosemirror-state';

import { EditorView } from 'prosemirror-view';

import { columnResizing, tableEditing } from 'prosemirror-tables';

import { wikiTableHeaderRecoveryPlugin } from './wiki-table-header-recovery';

import 'prosemirror-tables/style/tables.css';

import 'prosemirror-view/style/prosemirror.css';



import { createWikiMarkdownParser } from './wiki-markdown-parser';

import { wikiMarkdownSerializer } from './wiki-markdown-serializer';

import { wikiAttachmentDisplaySrcPlugin } from './wiki-attachment-display-src';

import { wikiAttachmentPasteDropPlugin } from './wiki-attachment-upload';

import { mountWikiToolbar } from './wiki-toolbar';

import { wikiCodeBlockInputGuardPlugin, wikiCodeBlockWidgetPlugin } from './wiki-code-block-widget-plugin';

import { wikiMathWidgetPlugin } from './wiki-math-widget-plugin';

import { wikiHeadingAnchorPlugin, wikiHeadingAnchorPluginKey } from './wiki-heading-anchor-plugin';

import { wikiTaskListClickPlugin } from './wiki-task-list-plugin';

import { wikiAdoWidgetPlugin } from './wiki-ado-widget-plugin';

import { wikiWorkItemResolvePlugin } from './wiki-work-item-resolve-plugin';

import { wikiVideoWidgetPlugin } from './wiki-video-widget-plugin';

import type { AdoAttachmentService } from '../services/attachment-service';

import type { AdoMentionService } from '../services/mention-service';

import { WIKI_EDITOR_SHELL_CLASS } from './wiki-editor-dom';

import { wikiEditorHistoryOptions } from './wiki-editor-history-config';



const wikiMarkdownParser = createWikiMarkdownParser();



export type WikiEditorOptions = {

    /** Fired after local transactions that change the document (typing, undo, paste, …). */

    onDocChanged?: () => void;

    /** When true (default), mount `.wiki-editor-toolbar` above the editor. Set false for headless/tests. */

    toolbar?: boolean;

    /** When set, enables paste/drop file upload and the toolbar attachment control (ADO `/.attachments/` paths). */

    attachmentService?: AdoAttachmentService | null;

    /** When set, @mention uses Core REST team member picker instead of a plain prompt. */

    mentionService?: AdoMentionService | null;

};



function wikiEditorPlugins(extra: Plugin[] = []) {

    return [

        history({ ...wikiEditorHistoryOptions }),

        keymap({

            'Mod-z': undo,

            'Mod-y': redo,

            'Shift-Mod-z': redo,

        }),

        wikiCodeBlockInputGuardPlugin(),

        keymap(baseKeymap),

        gapCursor(),

        columnResizing({}),

        tableEditing(),

        wikiTableHeaderRecoveryPlugin(),

        wikiHeadingAnchorPlugin(),

        wikiTaskListClickPlugin(),

        wikiCodeBlockWidgetPlugin(),

        wikiMathWidgetPlugin(),

        wikiVideoWidgetPlugin(),

        wikiAdoWidgetPlugin(),

        wikiWorkItemResolvePlugin(),

        ...extra,

    ];

}



/**
 * ProseMirror wiki editor for Azure DevOps wiki markdown. Wired from `main.ts`.
 *
 * DOM: `#wiki-editor-root` → `.wiki-editor-shell` → `.wiki-editor-toolbar` + `.editor` → `.ProseMirror`
 * so {@link ../../public/custom-styles.css} flex rules apply.
 */

export class WikiEditor {

    readonly view: EditorView;



    private readonly shell: HTMLElement;



    private readonly toolbarUnmount?: () => void;



    constructor(place: HTMLElement, markdown: string, options?: WikiEditorOptions) {

        const shell = document.createElement('div');

        shell.className = WIKI_EDITOR_SHELL_CLASS;

        place.appendChild(shell);



        const editorMount = document.createElement('div');

        editorMount.className = 'editor';

        shell.appendChild(editorMount);



        this.shell = shell;



        const doc = wikiMarkdownParser.parse(markdown, {});

        const extraPlugins: Plugin[] = [];

        if (options?.attachmentService) {

            extraPlugins.push(wikiAttachmentDisplaySrcPlugin(options.attachmentService));

            extraPlugins.push(wikiAttachmentPasteDropPlugin(options.attachmentService));

        }

        const state = EditorState.create({

            doc,

            plugins: wikiEditorPlugins(extraPlugins),

        });

        const view = new EditorView(editorMount, {

            state,

            dispatchTransaction(tr) {

                const newState = view.state.apply(tr);

                view.updateState(newState);

                if (tr.docChanged) options?.onDocChanged?.();

            },

        });

        this.view = view;

        queueMicrotask(() => {
            if (!view.isDestroyed) {
                view.dispatch(view.state.tr.setMeta(wikiHeadingAnchorPluginKey, true));
            }
        });

        const showToolbar = options?.toolbar !== false && typeof document !== 'undefined';

        this.toolbarUnmount = showToolbar

            ? mountWikiToolbar(shell, this.view, {

                  attachmentService: options?.attachmentService ?? null,

                  mentionService: options?.mentionService ?? null,

              })

            : undefined;

    }



    getMarkdown(): string {

        return wikiMarkdownSerializer.serialize(this.view.state.doc);

    }



    destroy(): void {

        this.toolbarUnmount?.();

        this.view.destroy();

        this.shell.remove();

    }

}


