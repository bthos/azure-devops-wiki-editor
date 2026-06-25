import type MarkdownIt from 'markdown-it';

/** markdown-it `StateBlock` (types vary by version). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StateBlock = any;

const MAX_BODY_CHARS = 4096;

/**
 * Azure DevOps wiki-style **video** container (mirror `::: mermaid`):
 *
 * ```
 * ::: video
 * <iframe src="https://www.youtube.com/embed/…" …></iframe>
 * :::
 * ```
 *
 * Or a single line with the iframe **src** URL only. Body is trimmed; parsed with
 * {@link ./wiki-video-url.ts#normalizeWikiVideoEmbedInput} (YouTube embed, SharePoint / Stream).
 */
function adoVideoContainerBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(pos, max).trim();
    if (!/^::: video\s*$/i.test(line)) {
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
            if (content.length > MAX_BODY_CHARS) {
                content = content.slice(0, MAX_BODY_CHARS);
            }
            const token = state.push('ado_video_container', 'video', 0);
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

export function wikiVideoContainerMarkdownIt(md: MarkdownIt): void {
    md.block.ruler.before('fence', 'ado_video_container', adoVideoContainerBlock);
}
