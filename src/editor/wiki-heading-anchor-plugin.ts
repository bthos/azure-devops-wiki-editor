/**
 * ADO wiki heading anchors: assigns stable DOM `id` (via schema `anchorId` on `heading`) so fragment links work.
 * Sync is done in {@link Plugin.appendTransaction} — no post-render DOM mutation on ProseMirror nodes (that can break
 * hit-testing / caret placement on `h1`–`h6`, especially on Azure DevOps pages that style headed sections).
 */

import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';

import { normalizeAdoWikiHeadingIntermediate } from '../ado-wiki-api';

export const wikiHeadingAnchorPluginKey = new PluginKey('wikiHeadingAnchors');

function headingPlainText(node: PMNode): string {
    let s = '';
    node.forEach((child) => {
        if (child.isText) {
            s += child.text;
        }
    });
    return s;
}

function normalizeAnchorAttr(v: unknown): string | null {
    if (v == null) return null;
    const t = String(v).trim();
    return t ? t : null;
}

/** Dispatch once after mount: `view.dispatch(view.state.tr.setMeta(wikiHeadingAnchorPluginKey, true))`. */
export function wikiHeadingAnchorPlugin(): Plugin {
    return new Plugin({
        key: wikiHeadingAnchorPluginKey,
        appendTransaction(trs, _oldState, newState) {
            const run =
                trs.some((tr) => tr.docChanged) ||
                trs.some((tr) => tr.getMeta(wikiHeadingAnchorPluginKey) === true);
            if (!run) {
                return null;
            }

            let tr = newState.tr;
            let changed = false;
            const seen = new Set<string>();

            newState.doc.descendants((node, pos) => {
                if (node.type.name !== 'heading') {
                    return;
                }
                const raw = headingPlainText(node).trim();
                let nextAnchor: string | null = null;
                if (raw) {
                    const intermediate = normalizeAdoWikiHeadingIntermediate(raw);
                    if (!seen.has(intermediate)) {
                        seen.add(intermediate);
                        nextAnchor = intermediate;
                    }
                }
                const cur = normalizeAnchorAttr(node.attrs['anchorId']);
                if (cur !== nextAnchor) {
                    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, anchorId: nextAnchor });
                    changed = true;
                }
            });

            return changed ? tr : null;
        },
    });
}
