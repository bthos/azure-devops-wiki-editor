import { closeHistory } from 'prosemirror-history';

import type { Node } from 'prosemirror-model';

import { Plugin } from 'prosemirror-state';

import type { EditorView } from 'prosemirror-view';

import type { AdoAttachmentService } from '../services/attachment-service';

/**
 * Upload each file via {@link AdoAttachmentService.uploadAttachment} and insert results in a **single**
 * transaction (one undo step for the whole paste/drop batch). Uses {@link closeHistory} so the batch
 * does not merge with the previous typing event in the undo stack.
 */
export async function insertUploadedFilesIntoWikiEditor(
    view: EditorView,
    service: AdoAttachmentService,
    files: readonly File[],
): Promise<void> {
    const { schema } = view.state;
    const nodes: Node[] = [];

    for (const file of files) {
        try {
            const url = await service.uploadAttachment(file);
            if (file.type.startsWith('image/')) {
                const node = schema.nodes.image?.createAndFill({ src: url, alt: file.name });
                if (node) nodes.push(node);
            } else {
                const linkMark = schema.marks.link?.create({ href: url, title: file.name });
                if (linkMark && schema.nodes.paragraph) {
                    const textNode = schema.text(file.name, [linkMark]);
                    nodes.push(schema.nodes.paragraph.create({}, [textNode]));
                }
            }
        } catch (e) {
            console.error('WikiEditor upload failed', e);
            window.alert(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    if (nodes.length === 0) {
        return;
    }

    let tr = closeHistory(view.state.tr);
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;
        if (i === 0) {
            tr = tr.replaceSelectionWith(node);
        } else {
            tr = tr.insert(tr.selection.anchor, node);
        }
    }
    view.dispatch(tr.scrollIntoView());
}

/** Paste / drop files into the editor (upload to ADO wiki attachments API). */
export function wikiAttachmentPasteDropPlugin(service: AdoAttachmentService): Plugin {
    return new Plugin({
        props: {
            handleDOMEvents: {
                drop(view, event) {
                    const dt = event.dataTransfer;
                    if (!dt?.files?.length) {
                        return false;
                    }
                    event.preventDefault();
                    void insertUploadedFilesIntoWikiEditor(view, service, Array.from(dt.files));
                    return true;
                },
                paste(view, event) {
                    const files = event.clipboardData?.files;
                    if (!files?.length) {
                        return false;
                    }
                    event.preventDefault();
                    void insertUploadedFilesIntoWikiEditor(view, service, Array.from(files));
                    return true;
                },
            },
        },
    });
}
