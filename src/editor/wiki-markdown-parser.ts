import type { Mark } from 'prosemirror-model';
import { MarkdownParser, defaultMarkdownParser } from 'prosemirror-markdown';
import { wikiSchema } from './wiki-schema';
import { createWikiMarkdownIt } from './wiki-markdown-it';
import { sanitizeWikiHtml } from './wiki-html-sanitize';
import { WIKI_MATH_MAX_TEX_CHARS } from './wiki-math-katex';
import { taskListCheckedFromListItemOpen, type MdToken } from './wiki-task-list-tokens';
import { isWikiHtmlInlineClosingSpan, tryParseWikiStyleSpanOpenHtml } from './wiki-text-color';
import { normalizeWikiVideoEmbedInput } from './wiki-video-url';

const wikiTokens = {
    ...defaultMarkdownParser.tokens,
    /** `markdown-it-task-lists` injects checkbox HTML; we map check state onto `list_item.attrs.checked` instead. */
    html_inline: { ignore: true as const, noCloseToken: true as const },
    list_item: {
        block: 'list_item' as const,
        getAttrs: (_tok: unknown, tokens: unknown[], i: number) => ({
            checked: taskListCheckedFromListItemOpen(tokens as MdToken[], i),
        }),
    },
    table: { block: 'table' as const },
    thead: { ignore: true },
    tbody: { ignore: true },
    tr: { block: 'table_row' as const },
    th: { block: 'table_header' as const },
    td: { block: 'table_cell' as const },
    caption: { ignore: true },
    /** markdown-it `default` preset: `~~text~~` → `s_open` / `s_close` (HTML `<s>`). */
    s: { mark: 'strikethrough' as const },
    /** Raw HTML blocks when `markdown-it` runs with `html: true` (ADO-style wiki). */
    html_block: {
        node: 'ado_html_block' as const,
        getAttrs: (tok: unknown) => {
            const raw = String((tok as { content?: string }).content ?? '')
                .replace(/\r\n/g, '\n')
                .replace(/\n+$/, '');
            return { html: sanitizeWikiHtml(raw) };
        },
    },
    ado_toc: { node: 'ado_toc' as const },
    ado_tosp: { node: 'ado_tosp' as const },
    /** `::: mermaid` … `:::` (ADO wiki); same PM node as fenced ```mermaid. */
    ado_mermaid_container: {
        block: 'code_block' as const,
        noCloseToken: true as const,
        getAttrs: () => ({ params: 'mermaid' }),
    },
    /** `::: video` … `:::` — iframe HTML or embed **src** URL (YouTube / Stream / SharePoint). */
    ado_video_container: {
        node: 'ado_video_block' as const,
        noCloseToken: true as const,
        getAttrs: (tok: unknown) => {
            const raw = String((tok as { content?: string }).content ?? '').replace(/\r\n/g, '\n');
            const body = raw.replace(/^\n+|\n+$/g, '');
            if (/<iframe/i.test(body)) {
                return { body };
            }
            const n = normalizeWikiVideoEmbedInput(body);
            return { body: n ?? body.trim() };
        },
    },
    /** `@‹name›` from {@link ./wiki-markdown-mention-it.ts}; text is display name only (mark wraps it). */
    mention_inline: {
        mark: 'userMention' as const,
        noCloseToken: true as const,
        getAttrs: (tok: unknown) => {
            const t = tok as { content?: string; meta?: { userName?: string } };
            return { userName: (t.meta && t.meta.userName) || String(t.content ?? '') };
        },
    },
    /** `#12345` from {@link ./wiki-markdown-work-item-it.ts}; token content is full `#…` text. */
    work_item_inline: {
        mark: 'wikiWorkItem' as const,
        noCloseToken: true as const,
        getAttrs: (tok: unknown) => {
            const t = tok as { meta?: { id?: string } };
            const id = String(t.meta?.id ?? '').trim();
            return { id };
        },
    },
    /** `\(...\)` — see {@link ./wiki-markdown-math-it.ts} (no single `$`). */
    wiki_math_inline: {
        node: 'wiki_math_inline' as const,
        getAttrs: (tok: unknown) => {
            const raw = String((tok as { content?: string }).content ?? '');
            const tex = raw.length > WIKI_MATH_MAX_TEX_CHARS ? raw.slice(0, WIKI_MATH_MAX_TEX_CHARS) : raw;
            return { tex };
        },
    },
    /** `$$…$$` or `\[…\]` display — serialized as `$$` blocks. */
    wiki_math_block: {
        node: 'wiki_math_block' as const,
        getAttrs: (tok: unknown) => {
            const raw = String((tok as { content?: string }).content ?? '')
                .replace(/\r\n/g, '\n')
                .replace(/^\n+|\n+$/g, '');
            const tex = raw.length > WIKI_MATH_MAX_TEX_CHARS ? raw.slice(0, WIKI_MATH_MAX_TEX_CHARS) : raw;
            return { tex };
        },
    },
};

type TokenHandler = (
    // MarkdownParseState from prosemirror-markdown (not exported); shape is stable for our patch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state: any,
    // markdown-it Token (class instance); avoid importing types that differ across markdown-it majors.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tok: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tokens: any[],
    i: number,
) => void;

/**
 * Table cell `inline` tokens must become `paragraph+` content. Default `inline` only runs
 * `parseTokens(children)`; with the `default` markdown-it preset, `children` is often non-empty
 * (`text` tokens), which would place inlines directly in the cell and make `createAndFill` fail
 * for `paragraph+`. Always wrap cell inlines in one paragraph (parse `children` or `content`).
 */
/**
 * Map `html_inline` to `ado_html_inline` for user HTML, but keep ignoring task-list checkbox
 * fragments from `markdown-it-task-lists` (same as prior `html_inline: { ignore: true }`).
 */
function patchHtmlInlineForWiki(parser: MarkdownParser): void {
    const inlineType = wikiSchema.nodes['ado_html_inline'];
    if (!inlineType) return;

    const handlers = (parser as unknown as { tokenHandlers: Record<string, TokenHandler> }).tokenHandlers;
    const previous = handlers['html_inline'];
    if (!previous) return;

    handlers['html_inline'] = (state, tok, tokens, i) => {
        const raw = String(tok.content ?? '');
        if (!raw || raw.includes('task-list-item-checkbox')) {
            previous(state, tok, tokens, i);
            return;
        }
        const styleAttrs = tryParseWikiStyleSpanOpenHtml(raw);
        if (styleAttrs) {
            const mt = wikiSchema.marks['wikiStyle'];
            if (mt) {
                state.openMark(mt.create({ color: styleAttrs.color, backgroundColor: styleAttrs.backgroundColor }));
            }
            return;
        }
        if (isWikiHtmlInlineClosingSpan(raw)) {
            const mt = wikiSchema.marks['wikiStyle'];
            if (mt) {
                const top = state.top();
                const existing = top.marks.find((m: Mark) => m.type === mt);
                if (existing) {
                    (top as { marks: readonly Mark[] }).marks = existing.removeFromSet(top.marks);
                }
            }
            return;
        }
        state.addNode(inlineType, { html: sanitizeWikiHtml(raw) });
    };
}

function patchInlineForTableCells(parser: MarkdownParser): void {
    const handlers = (parser as unknown as { tokenHandlers: Record<string, TokenHandler> }).tokenHandlers;
    const origInline = handlers['inline'];
    if (!origInline) return;

    handlers['inline'] = (state, tok, _tokens, _i) => {
        const topName: string | undefined = state.top().type?.name;
        const inCell = topName === 'table_cell' || topName === 'table_header';
        if (!inCell) {
            origInline(state, tok, _tokens, _i);
            return;
        }
        /** `markdown-it` "default" preset often builds `inline.children` (e.g. `text`); CommonMark-only paths may leave it empty with `content` only. Either way, cells are `paragraph+`. */
        const paragraph = state.schema.nodes.paragraph;
        const children = tok.children as unknown[] | undefined;
        state.openNode(paragraph, null);
        if (children && children.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            state.parseTokens(children as any);
        } else if (tok.content) {
            state.addText(tok.content);
        }
        state.closeNode();
    };
}

/**
 * Markdown → ProseMirror document using the wiki schema (CommonMark + GFM tables + ADO TOC/TOSP/HTML atoms).
 */
export function createWikiMarkdownParser(): MarkdownParser {
    const parser = new MarkdownParser(wikiSchema, createWikiMarkdownIt(), wikiTokens);
    patchInlineForTableCells(parser);
    patchHtmlInlineForWiki(parser);
    return parser;
}
