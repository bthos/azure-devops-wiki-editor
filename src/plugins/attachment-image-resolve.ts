/**
 * Resolves `/.attachments/...` image `src` to Azure DevOps Git Items URLs so images render in the editor.
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { Node } from '@milkdown/kit/prose/model';
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

            const updates: { pos: number; node: Node }[] = [];
            newState.doc.descendants((node, pos) => {
                if (node.type.name !== 'image') {
                    return;
                }
                const src = node.attrs.src as string | undefined;
                if (!src?.startsWith('/.attachments/')) {
                    return;
                }
                const next = service.toDisplaySrc(src);
                if (next !== src) {
                    updates.push({ pos, node });
                }
            });

            if (updates.length === 0) {
                return null;
            }

            let tr = newState.tr;
            updates.sort((a, b) => b.pos - a.pos);
            for (const { pos, node } of updates) {
                const src = node.attrs.src as string;
                const next = service.toDisplaySrc(src);
                tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: next });
            }
            return tr;
        },
    });
});
