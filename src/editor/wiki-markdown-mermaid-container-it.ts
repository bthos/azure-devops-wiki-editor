import type MarkdownIt from 'markdown-it';

import { WIKI_MERMAID_MAX_SOURCE_CHARS } from './wiki-mermaid-render';

/** markdown-it `StateBlock` (types vary by version). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StateBlock = any;

/**
 * Azure DevOps wiki: Mermaid as a **container** (not a fenced code fence):
 *
 * ```
 * ::: mermaid
 * flowchart LR
 *   A --> B
 * :::
 * ```
 *
 * Maps to the same `code_block` + `params: "mermaid"` as fenced ```mermaid (see {@link ./wiki-markdown-parser.ts}).
 */
function adoMermaidContainerBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(pos, max).trim();
    if (!/^::: mermaid\s*$/i.test(line)) {
        return false;
    }

    if (silent) {
        return true;
    }

    const body: string[] = [];
    let next = startLine + 1;
    while (next < endLine) {
        const p = state.bMarks[next] + state.tShift[next];
        const e = state.eMarks[next];
        const raw = state.src.slice(p, e);
        if (raw.trim() === ':::') {
            let content = body.join('\n').replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
            if (content.length > WIKI_MERMAID_MAX_SOURCE_CHARS) {
                content = content.slice(0, WIKI_MERMAID_MAX_SOURCE_CHARS);
            }
            const token = state.push('ado_mermaid_container', 'mermaid', 0);
            token.block = true;
            token.content = content;
            token.map = [startLine, next + 1];
            state.line = next + 1;
            return true;
        }
        body.push(raw);
        next++;
    }
    return false;
}

export function wikiMermaidContainerMarkdownIt(md: MarkdownIt): void {
    md.block.ruler.before('fence', 'ado_mermaid_container', adoMermaidContainerBlock);
}
