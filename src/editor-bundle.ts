/**
 * Content-script editor bundle (MV3): ProseMirror {@link WikiEditor} + shared services and theme helpers.
 */

import 'prosemirror-view/style/prosemirror.css';

import {
    detectAdoTheme,
    isDarkTheme,
    applyDarkTheme,
    removeDarkTheme,
} from './theme/ado-theme';

import { WikiEditor, type WikiEditorOptions } from './editor/wiki-editor';
import { AdoAttachmentService, type IWikiContext } from './services/attachment-service';
import { AdoMentionService } from './services/mention-service';

export {
    detectAdoTheme,
    isDarkTheme,
    applyDarkTheme,
    removeDarkTheme,
    WikiEditor,
    type WikiEditorOptions,
    AdoAttachmentService,
    AdoMentionService,
    type IWikiContext,
};

if (typeof window !== 'undefined') {
    (window as unknown as { WikiEditor: typeof WikiEditor }).WikiEditor = WikiEditor;
}
