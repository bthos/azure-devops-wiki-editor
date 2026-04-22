import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { AdoAttachmentService } from '../services/attachment-service';

/**
 * Upload each file via {@link AdoAttachmentService.uploadAttachment} and replace the current
 * selection with an `image` node (images) or a `paragraph` with a `link` mark (other attachments).
 * Dispatches one transaction per file so the selection advances naturally.
 */
export async function insertUploadedFilesIntoWikiEditor(
    view: EditorView,
    service: AdoAttachmentService,
    files: readonly File[],
): Promise<void> {
    const { schema } = view.state;
    for (const file of files) {
        try {
            const url = await service.uploadAttachment(file);
            const tr = view.state.tr;
            if (file.type.startsWith('image/')) {
                const node = schema.nodes.image?.createAndFill({ src: url, alt: file.name });
                if (node) {
                    view.dispatch(tr.replaceSelectionWith(node).scrollIntoView());
                }
            } else {
                const linkMark = schema.marks.link?.create({ href: url, title: file.name });
                if (linkMark && schema.nodes.paragraph) {
                    const textNode = schema.text(file.name, [linkMark]);
                    const node = schema.nodes.paragraph.create({}, [textNode]);
                    view.dispatch(tr.replaceSelectionWith(node).scrollIntoView());
                }
            }
        } catch (e) {
            console.error('WikiEditor upload failed', e);
            window.alert(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}

/** Paste / drop files into the editor (same behaviour as Milkdown upload plugin). */
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
