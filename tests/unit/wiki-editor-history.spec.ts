// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { undoDepth } from 'prosemirror-history';

import { AdoAttachmentService, type IWikiContext } from '../../src/services/attachment-service';
import { insertUploadedFilesIntoWikiEditor } from '../../src/editor/wiki-attachment-upload';
import { WikiEditor } from '../../src/editor/wiki-editor';
import { setWindowLocation } from '../helpers/mock-location';

function wikiCtx(): IWikiContext {
    return { org: 'O', projectId: 'P', wikiId: 'W' };
}

describe('WikiEditor history (Option C)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('coalesces rapid programmatic inserts into one undo event (baseline PM history)', () => {
        const host = document.createElement('div');
        const ed = new WikiEditor(host, 'Hello', { toolbar: false });
        const { view } = ed;
        const pos = 2;
        for (let i = 0; i < 4; i++) {
            view.dispatch(view.state.tr.insertText('x', pos + i));
        }
        expect(undoDepth(view.state)).toBe(1);
        ed.destroy();
    });

    it('batches multi-file attachment insert into a single undo step', async () => {
        setWindowLocation('https://dev.azure.com');

        const svc = new AdoAttachmentService(wikiCtx());
        vi.spyOn(svc, 'uploadAttachment').mockImplementation(async (file: File) => {
            return `/.attachments/${encodeURIComponent(file.name)}`;
        });

        const host = document.createElement('div');
        const ed = new WikiEditor(host, 'Hi', { toolbar: false, attachmentService: svc });
        const { view } = ed;

        const depthBefore = undoDepth(view.state);
        const files = [
            new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }),
            new File([new Uint8Array([2])], 'b.png', { type: 'image/png' }),
            new File([new Uint8Array([3])], 'c.png', { type: 'image/png' }),
        ];
        await insertUploadedFilesIntoWikiEditor(view, svc, files);

        expect(undoDepth(view.state)).toBe(depthBefore + 1);

        ed.destroy();
    });
});
