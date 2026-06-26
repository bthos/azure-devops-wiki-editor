import MarkdownIt from 'markdown-it';
import multimdTable from 'markdown-it-multimd-table';
import taskLists from 'markdown-it-task-lists';

import { wikiMentionInlinePlugin } from './wiki-markdown-mention-it';
import { wikiWorkItemInlinePlugin } from './wiki-markdown-work-item-it';
import { wikiMathMarkdownIt } from './wiki-markdown-math-it';
import { wikiMermaidContainerMarkdownIt } from './wiki-markdown-mermaid-container-it';
import { wikiVideoContainerMarkdownIt } from './wiki-markdown-video-container-it';

/** markdown-it `StateBlock` (types vary by markdown-it version). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StateBlock = any;

/**
 * Recognize standalone `[[_TOC_]]` / `[[_TOSP_]]` lines as block tokens (before emphasis splits underscores).
 * Raw HTML uses markdown-it `html: true` (`html_block` / `html_inline`); see {@link createWikiMarkdownIt}.
 */
function adoMarkersBlock(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(start, max).trim();

    if (line === '[[_TOC_]]') {
        if (silent) return true;
        state.line = startLine + 1;
        const t = state.push('ado_toc', '', 0);
        t.map = [startLine, startLine + 1];
        return true;
    }
    if (line === '[[_TOSP_]]') {
        if (silent) return true;
        state.line = startLine + 1;
        const t = state.push('ado_tosp', '', 0);
        t.map = [startLine, startLine + 1];
        return true;
    }
    return false;
}

/**
 * markdown-it preset must not be `'commonmark'` alone — that chain omits the `table`
 * ruler slot `markdown-it-multimd-table` relies on, so pipe tables become plain paragraphs.
 * `html: true` matches Azure DevOps wiki: raw HTML in the `.md` file is tokenized as `html_block` / `html_inline`
 * (ADO still strips dangerous tags like `script` / `iframe` server-side; we sanitize in the editor).
 */
export function createWikiMarkdownIt(): MarkdownIt {
    const md = new MarkdownIt('default', { html: true })
        .use(multimdTable)
        /** GFM `- [ ]` / `- [x]`; injects `html_inline` checkbox tokens — handled in {@link ./wiki-markdown-parser.ts}. */
        .use(taskLists, { enabled: true })
        .use(wikiMentionInlinePlugin)
        /** ADO `#12345` work item refs in prose (not URL fragments); see {@link ./wiki-markdown-work-item-it.ts}. */
        .use(wikiWorkItemInlinePlugin)
        /** Safe math delimiters only (no single `$`); see {@link ./wiki-markdown-math-it.ts}. */
        .use(wikiMathMarkdownIt)
        /** ADO `::: mermaid` … `:::` → same `code_block` as fenced ```mermaid. */
        .use(wikiMermaidContainerMarkdownIt)
        /** ADO `::: video` … `:::` → `ado_video_block` (body: iframe HTML or embed URL). */
        .use(wikiVideoContainerMarkdownIt);
    md.block.ruler.before('paragraph', 'ado_wiki_markers', adoMarkersBlock);
    return md;
}
