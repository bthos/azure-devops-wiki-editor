/**
 * Resolves `/.attachments/...` targets to Azure DevOps Git Items URLs in the editor:
 * - `image` node `src`
 * - `link` mark `href` (non-image uploads)
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { Node, MarkType } from '@milkdown/kit/prose/model';
import { attachmentServiceCtx } from '../services/attachment-service';

export const attachmentImageResolveKey = new PluginKey('adoAttachmentImageResolve');

export const attachmentImageResolvePlugin = $prose((ctx) => {
    return new Plugin({
        key: attachmentImageResolveKey,
        appendTransaction(_trs, _oldState, newState) {
            const service = ctx.get(attachmentServiceCtx);
            if (!service?.isDisplaySrcReady()) {
                return null;
            }

            const imageUpdates: { pos: number; node: Node }[] = [];
            const linkUpdates: {
                from: number;
                to: number;
                markType: MarkType;
                attrs: Record<string, unknown>;
            }[] = [];

            newState.doc.descendants((node, pos) => {
                if (node.type.name === 'image') {
                    const src = node.attrs.src as string | undefined;
                    if (!src?.startsWith('/.attachments/')) {
                        return;
                    }
                    const next = service.toDisplaySrc(src);
                    if (next !== src) {
                        imageUpdates.push({ pos, node });
                    }
                    return;
                }

                if (!node.isText) {
                    return;
                }
                const linkMark = node.marks.find((m) => m.type.name === 'link');
                if (!linkMark) {
                    return;
                }
                const href = linkMark.attrs.href as string | undefined;
                if (!href?.startsWith('/.attachments/')) {
                    return;
                }
                const next = service.toDisplaySrc(href);
                if (next === href) {
                    return;
                }
                linkUpdates.push({
                    from: pos,
                    to: pos + node.nodeSize,
                    markType: linkMark.type,
                    attrs: { ...linkMark.attrs, href: next },
                });
            });

            if (imageUpdates.length === 0 && linkUpdates.length === 0) {
                return null;
            }

            let tr = newState.tr;

            linkUpdates.sort((a, b) => b.from - a.from);
            for (const u of linkUpdates) {
                tr = tr.removeMark(u.from, u.to, u.markType);
                tr = tr.addMark(u.from, u.to, u.markType.create(u.attrs));
            }

            imageUpdates.sort((a, b) => b.pos - a.pos);
            for (const { pos, node } of imageUpdates) {
                const src = node.attrs.src as string;
                const next = service.toDisplaySrc(src);
                tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: next });
            }

            return tr;
        },
    });
});
