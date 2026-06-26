/**
 * markdown-it inline rule for ADO people mentions after {@link ../utils/wiki-markers.preprocessMentions}:
 * `@‹Display Name›` (U+2039 / U+203A) so `<` is not parsed as HTML.
 */

import type MarkdownIt from 'markdown-it';

/** markdown-it `StateInline` (implementation detail; keep loose for version differences). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WikiStateInline = any;

const MENTION = /^@‹([^›]+)›/;

export function wikiMentionInlineRule(state: WikiStateInline, silent: boolean): boolean {
    const pos = state.pos;
    if (pos >= state.posMax) return false;
    const slice = state.src.slice(pos);
    const m = MENTION.exec(slice);
    if (!m) return false;
    if (silent) return true;

    const token = state.push('mention_inline', '', 0);
    token.content = m[1];
    token.meta = { userName: m[1] as string };
    state.pos += m[0].length;
    return true;
}

export function wikiMentionInlinePlugin(md: MarkdownIt): void {
    md.inline.ruler.after('escape', 'ado_wiki_mention', wikiMentionInlineRule);
}
