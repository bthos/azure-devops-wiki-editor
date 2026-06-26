/**
 * markdown-it inline rule: ADO-style work item refs `#12345` (≥2 digits).
 */

import type MarkdownIt from 'markdown-it';

import { matchWikiWorkItemRef } from './wiki-work-item-match';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WikiStateInline = any;

export function wikiWorkItemInlineRule(state: WikiStateInline, silent: boolean): boolean {
    const pos = state.pos;
    const m = matchWikiWorkItemRef(state.src, pos, state.posMax);
    if (!m) return false;
    if (silent) return true;

    const token = state.push('work_item_inline', '', 0);
    token.content = m.raw;
    token.meta = { id: m.id };
    state.pos += m.raw.length;
    return true;
}

export function wikiWorkItemInlinePlugin(md: MarkdownIt): void {
    md.inline.ruler.after('escape', 'ado_wiki_work_item', wikiWorkItemInlineRule);
}
