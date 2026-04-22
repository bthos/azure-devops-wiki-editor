/**
 * Sets each heading's DOM `id` to the decoded ADO anchor string (after Zs→`-` normalization)
 * so `href` fragments (percent-encoded) resolve to these elements.
 *
 * Sync runs in requestAnimationFrame so we do not mutate ProseMirror-managed DOM during
 * PluginView.update (which can retrigger the DOM observer and hang the page).
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { normalizeAdoWikiHeadingIntermediate } from '../ado-wiki-api';

export const adoHeadingAnchorPluginKey = new PluginKey('adoHeadingAnchors');

function syncHeadingElements(root: HTMLElement): void {
    const elements = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    if (elements.length === 0) {
        return;
    }

    const texts = elements.map((el) => el.textContent?.trim() ?? '');
    /** ADO uses one anchor per identical heading; only the first matching node should own `id` (valid HTML). */
    const seenIntermediate = new Set<string>();

    elements.forEach((el, i) => {
        const t = texts[i];
        if (!t) {
            if (el.hasAttribute('id')) {
                el.removeAttribute('id');
            }
            return;
        }
        const intermediate = normalizeAdoWikiHeadingIntermediate(t);
        if (seenIntermediate.has(intermediate)) {
            if (el.hasAttribute('id')) {
                el.removeAttribute('id');
            }
        } else {
            seenIntermediate.add(intermediate);
            if (el.id !== intermediate) {
                el.id = intermediate;
            }
        }
    });
}

export const adoHeadingAnchorPlugin = $prose(() => {
    let rafId = 0;
    let pendingDom: HTMLElement | null = null;

    const scheduleSync = (dom: HTMLElement) => {
        pendingDom = dom;
        if (rafId !== 0) {
            return;
        }
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            const root = pendingDom;
            pendingDom = null;
            if (root) {
                syncHeadingElements(root);
            }
        });
    };

    return new Plugin({
        key: adoHeadingAnchorPluginKey,
        view(view) {
            scheduleSync(view.dom as HTMLElement);
            return {
                update(updatedView) {
                    scheduleSync(updatedView.dom as HTMLElement);
                },
                destroy() {
                    if (rafId !== 0) {
                        cancelAnimationFrame(rafId);
                        rafId = 0;
                    }
                    pendingDom = null;
                },
            };
        },
    });
});

