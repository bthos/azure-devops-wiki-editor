import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { fetchAdoWorkItemPreview } from './wiki-work-item-wit-api';

const wikiWorkItemResolveKey = new PluginKey('wikiWorkItemResolve');

type Pending = Map<string, Promise<import('./wiki-work-item-wit-api').AdoWorkItemPreview | null>>;

/**
 * After markdown import or insert with id only, loads title/state/type from WIT REST and updates mark attrs.
 */
export function wikiWorkItemResolvePlugin(): Plugin {
    const cache: Pending = new Map();

    return new Plugin({
        key: wikiWorkItemResolveKey,
        view(view: EditorView) {
            let timer: ReturnType<typeof setTimeout> | null = null;

            const schedule = () => {
                if (timer != null) {
                    clearTimeout(timer);
                }
                timer = setTimeout(() => {
                    timer = null;
                    void run(view, cache);
                }, 400);
            };

            schedule();

            return {
                update: () => {
                    schedule();
                },
                destroy() {
                    if (timer != null) clearTimeout(timer);
                },
            };
        },
    });
}

async function run(view: EditorView, cache: Pending): Promise<void> {
    const markType = view.state.schema.marks.wikiWorkItem;
    if (!markType) return;

    type Hit = { from: number; to: number; id: string };
    const hits: Hit[] = [];

    view.state.doc.descendants((node: PMNode, pos: number) => {
        if (!node.isText) return true;
        const m = markType.isInSet(node.marks);
        if (!m) return true;
        const id = String(m.attrs['id'] ?? '').trim();
        const title = String(m.attrs['title'] ?? '').trim();
        const attempted = Boolean(m.attrs['resolveAttempted']);
        if (!/^\d{2,}$/.test(id) || title.length > 0 || attempted) {
            return true;
        }
        hits.push({ from: pos, to: pos + node.nodeSize, id });
        return true;
    });

    if (hits.length === 0) return;

    const uniqueIds = [...new Set(hits.map((h) => h.id))];
    const results = new Map<string, import('./wiki-work-item-wit-api').AdoWorkItemPreview | null>();

    await Promise.all(
        uniqueIds.map(async (id) => {
            let p = cache.get(id);
            if (!p) {
                p = fetchAdoWorkItemPreview(id);
                cache.set(id, p);
            }
            const r = await p;
            results.set(id, r);
        }),
    );

    let tr = view.state.tr;
    let changed = false;

    for (const { from, to, id } of hits) {
        const $from = view.state.doc.resolve(from);
        const node = $from.nodeAfter;
        if (!node || !node.isText) continue;
        const existing = markType.isInSet(node.marks);
        if (!existing) continue;
        if (String(existing.attrs['title'] ?? '').trim().length > 0 || Boolean(existing.attrs['resolveAttempted'])) {
            continue;
        }

        const preview = results.get(id) ?? null;
        const nextAttrs = preview
            ? {
                  id,
                  title: preview.title,
                  state: preview.state,
                  workItemType: preview.workItemType,
                  resolveAttempted: true,
              }
            : {
                  id,
                  title: '',
                  state: '',
                  workItemType: '',
                  resolveAttempted: true,
              };

        tr = tr.removeMark(from, to, markType).addMark(from, to, markType.create(nextAttrs));
        changed = true;
    }

    if (changed && !view.isDestroyed) {
        view.dispatch(tr);
    }
}
