import type { Node } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';

/**
 * True when `clientX` is in the themed checkbox gutter (see `ado-theme.css`:
 * `li[data-checked]` has `padding-left: 24px`, checkbox `::before` is ~14px wide at `left: 0`).
 * Clicks on item text must fall through so ProseMirror can place the caret.
 */
export function isTaskListCheckboxHit(li: HTMLElement, clientX: number): boolean {
    const rect = li.getBoundingClientRect();
    const paddingLeft = parseFloat(getComputedStyle(li).paddingLeft) || 24;
    // Checkbox lives in the left padding; cap keeps nested lists sane on huge indents.
    const gutter = Math.min(Math.max(paddingLeft, 18), 40);
    return clientX >= rect.left && clientX <= rect.left + gutter;
}

/**
 * Toggle `list_item.attrs.checked` when the user clicks the themed checkbox (see `ado-theme.css` `li[data-checked]::before`).
 */
export function wikiTaskListClickPlugin(): Plugin {
    return new Plugin({
        props: {
            handleDOMEvents: {
                click: (view, event) => {
                    const e = event as MouseEvent;
                    let el = e.target as HTMLElement | null;
                    while (el && el !== view.dom) {
                        if (
                            el.tagName === 'LI' &&
                            (el.hasAttribute('data-checked') || el.classList.contains('task-list-item'))
                        ) {
                            if (!isTaskListCheckboxHit(el, e.clientX)) {
                                return false;
                            }
                            const coords = view.posAtCoords({ left: e.clientX, top: e.clientY });
                            if (!coords) return false;
                            const $p = view.state.doc.resolve(coords.pos);
                            for (let d = $p.depth; d > 0; d--) {
                                const n = $p.node(d) as Node;
                                if (n.type.name === 'list_item' && typeof n.attrs['checked'] === 'boolean') {
                                    const next = !n.attrs['checked'];
                                    const start = $p.before(d);
                                    view.dispatch(
                                        view.state.tr.setNodeMarkup(start, undefined, { ...n.attrs, checked: next }),
                                    );
                                    e.preventDefault();
                                    return true;
                                }
                            }
                            return false;
                        }
                        el = el.parentElement;
                    }
                    return false;
                },
            },
        },
    });
}
