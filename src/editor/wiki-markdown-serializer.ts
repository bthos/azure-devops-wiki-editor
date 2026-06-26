import type { Mark, Node } from 'prosemirror-model';
import { MarkdownSerializer, defaultMarkdownSerializer } from 'prosemirror-markdown';
import type { MarkdownSerializerState } from 'prosemirror-markdown';
import { isAdoWikiAttachmentPath } from '../syntax/ado-wiki-attachment-stringify';
import { serializeTable } from './wiki-table-serialize';
import { normalizeWikiToolbarHexColor } from './wiki-text-color';

/** `MarkdownSerializerState` list helpers exist at runtime but are omitted from published typings. */
type WikiMarkdownSerializerState = MarkdownSerializerState & {
    closed: unknown;
    flushClose(size?: number): void;
    inTightList: boolean;
};

type NodeSerializer = (state: MarkdownSerializerState, node: Node, parent: Node, index: number) => void;

type SerializerState = MarkdownSerializerState & { inAutolink?: boolean };

/**
 * `markdown-it-task-lists` todoify() does `text.content.slice(3)` on `[ ] Foo`, leaving `" Foo"`
 * (leading space preserved). Do not emit another space in that case or we get `- [ ]  Foo`.
 */
function taskListItemTextAlreadyHasGapAfterCheckboxMark(item: Node): boolean {
    const block = item.firstChild;
    if (!block || !block.isTextblock || block.childCount === 0) return false;
    const first = block.child(0);
    return first.isText && /^\s/.test(first.text!);
}

/** Mirrors `prosemirror-markdown` `isPlainURL` (not exported). */
function isPlainURL(link: Mark, parent: Node, index: number): boolean {
    if (link.attrs.title || !/^\w+:/.test(String(link.attrs.href))) {
        return false;
    }
    const content = parent.child(index);
    if (!content.isText || content.text !== link.attrs.href || content.marks[content.marks.length - 1] !== link) {
        return false;
    }
    return index === parent.childCount - 1 || !link.isInSet(parent.child(index + 1).marks);
}

const baseNodes = defaultMarkdownSerializer.nodes as Record<string, NodeSerializer>;

/** Escape `$` inside TeX so it does not close the `$…$` pair when re-parsed. */
function escapeWikiDollarInlineTexForMarkdown(tex: string): string {
    return tex.replace(/\$/g, '\\$');
}

function normalizeWikiMathBlockTex(tex: string): string {
    return tex.replace(/\r\n/g, '\n').trim();
}

/** ADO wiki `::: mermaid` … `:::`; other `code_block` uses default fenced serializer. */
function wikiSerializeCodeBlock(state: MarkdownSerializerState, node: Node, parent: Node, index: number): void {
    const params = String(node.attrs['params'] ?? '').trim().toLowerCase();
    if (params === 'mermaid') {
        state.ensureNewLine();
        state.write('::: mermaid\n');
        state.text(node.textContent, false);
        state.write('\n:::\n');
        state.closeBlock(node);
        return;
    }
    (baseNodes.code_block as NodeSerializer)(state, node, parent, index);
}

function wikiSerializeBulletList(state: MarkdownSerializerState, node: Node) {
    const s = state as WikiMarkdownSerializerState;
    if (s.closed && (s.closed as { type?: unknown }).type === node.type) s.flushClose(3);
    else if (s.inTightList) s.flushClose(1);
    const isTight = typeof node.attrs['tight'] !== 'undefined' ? node.attrs['tight'] : state.options.tightLists;
    const prevTight = s.inTightList;
    s.inTightList = isTight as boolean;
    /** ADO wiki uses `-` for unordered lists (not `*`). */
    const bulletAttr = (node.attrs as { bullet?: string }).bullet;
    node.forEach((child, _offset, idx) => {
        if (idx && isTight) s.flushClose(1);
        const checked = (child.attrs as { checked?: boolean | null }).checked;
        const bullet = typeof checked === 'boolean' ? '-' : bulletAttr || '-';
        const firstDelim = typeof checked === 'boolean' ? `${bullet} [${checked ? 'x' : ' '}]` : `${bullet} `;
        state.wrapBlock('  ', firstDelim, node, () => {
            /**
             * Task lines must have exactly one space between `]` and the label for `markdown-it-task-lists`
             * (`[ ] ` / `[x] `). Parsed items keep that space in the paragraph; editor-created tasks may not.
             */
            if (typeof checked === 'boolean' && !taskListItemTextAlreadyHasGapAfterCheckboxMark(child)) {
                state.write(' ');
            }
            state.render(child, node, idx);
        });
    });
    s.inTightList = prevTight;
}

function wikiSerializeOrderedList(state: MarkdownSerializerState, node: Node) {
    const s = state as WikiMarkdownSerializerState;
    if (s.closed && (s.closed as { type?: unknown }).type === node.type) s.flushClose(3);
    else if (s.inTightList) s.flushClose(1);
    const isTight = typeof node.attrs['tight'] !== 'undefined' ? node.attrs['tight'] : state.options.tightLists;
    const prevTight = s.inTightList;
    s.inTightList = isTight as boolean;
    const start = (node.attrs['order'] as number) || 1;
    const maxW = String(start + node.childCount - 1).length;
    const space = state.repeat(' ', maxW + 2);
    node.forEach((child, _offset, idx) => {
        if (idx && isTight) s.flushClose(1);
        const nStr = String(start + idx);
        const checked = (child.attrs as { checked?: boolean | null }).checked;
        const numPart = state.repeat(' ', maxW - nStr.length) + nStr + '. ';
        const firstDelim = typeof checked === 'boolean' ? `${numPart}[${checked ? 'x' : ' '}]` : numPart;
        state.wrapBlock(space, firstDelim, node, () => {
            if (typeof checked === 'boolean' && !taskListItemTextAlreadyHasGapAfterCheckboxMark(child)) {
                state.write(' ');
            }
            state.render(child, node, idx);
        });
    });
    s.inTightList = prevTight;
}

const extraNodes: Record<string, NodeSerializer> = {
    ado_toc(state, node) {
        state.ensureNewLine();
        state.write('[[_TOC_]]');
        state.closeBlock(node);
    },
    ado_tosp(state, node) {
        state.ensureNewLine();
        state.write('[[_TOSP_]]');
        state.closeBlock(node);
    },
    ado_video_block(state, node) {
        state.ensureNewLine();
        const body = String(node.attrs['body'] ?? '').replace(/\r\n/g, '\n');
        state.write('::: video\n');
        if (body) {
            state.write(body);
        }
        state.write('\n:::\n');
        state.closeBlock(node);
    },
    ado_html_block(state, node) {
        state.ensureNewLine();
        const html = String(node.attrs['html'] ?? '');
        if (html) {
            state.write(html);
            if (!html.endsWith('\n')) {
                state.write('\n');
            }
        }
        state.closeBlock(node);
    },
    ado_html_inline(state, node) {
        state.write(String(node.attrs['html'] ?? ''));
    },
    wiki_math_inline(state, node) {
        state.write('$');
        state.write(escapeWikiDollarInlineTexForMarkdown(String(node.attrs['tex'] ?? '')));
        state.write('$');
    },
    wiki_math_block(state, node) {
        state.ensureNewLine();
        const body = normalizeWikiMathBlockTex(String(node.attrs['tex'] ?? ''));
        state.write('$$\n');
        state.write(body);
        state.write('\n$$\n');
        state.closeBlock(node);
    },
    table: serializeTable,
    image(state, node, parent, index) {
        const src = String(node.attrs.src ?? '');
        if (!isAdoWikiAttachmentPath(src)) {
            baseNodes.image(state, node, parent, index);
            return;
        }
        const title = node.attrs.title as string | null | undefined;
        const titlePart = title ? ` "${String(title).replace(/"/g, '\\"')}"` : '';
        state.write(
            '![' + state.esc(String(node.attrs.alt ?? '')) + '](<' + src.replace(/>/g, '\\>') + '>' + titlePart + ')',
        );
    },
};

const wikiNodes: Record<string, NodeSerializer> = {
    ...baseNodes,
    bullet_list: wikiSerializeBulletList,
    ordered_list: wikiSerializeOrderedList,
    code_block: wikiSerializeCodeBlock,
    ...extraNodes,
};

const wikiMarks = {
    ...defaultMarkdownSerializer.marks,
    strikethrough: {
        open: '~~',
        close: '~~',
        mixable: true,
        expelEnclosingWhitespace: true,
    },
    /** Inner text is display name; wrappers become `@‹name›` for {@link ../utils/wiki-markers.postprocessAdoMarkers}. */
    userMention: {
        open: '@\u2039',
        close: '\u203A',
        mixable: false,
        expelEnclosingWhitespace: false,
    },
    /** Markdown stays literal `#12345` (mark adds chip only in the editor DOM). */
    wikiWorkItem: {
        open: '',
        close: '',
        mixable: true,
        expelEnclosingWhitespace: false,
    },
    wikiStyle: {
        open(_state: MarkdownSerializerState, mark: Mark) {
            const color = normalizeWikiToolbarHexColor(String(mark.attrs['color'] ?? ''));
            const bg = normalizeWikiToolbarHexColor(String(mark.attrs['backgroundColor'] ?? ''));
            const parts: string[] = [];
            if (color) parts.push(`color:${color}`);
            if (bg) parts.push(`background-color:${bg}`);
            return parts.length ? `<span style="${parts.join(';')}">` : '';
        },
        close: '</span>',
        mixable: true,
        expelEnclosingWhitespace: false,
    },
    link: {
        open(state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) {
            const s = state as SerializerState;
            s.inAutolink = isPlainURL(mark, parent, index);
            return s.inAutolink ? '<' : '[';
        },
        close(state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) {
            const s = state as SerializerState;
            const wasAutolink = s.inAutolink;
            s.inAutolink = undefined;
            if (wasAutolink) {
                return '>';
            }
            const href = String(mark.attrs.href ?? '');
            if (isAdoWikiAttachmentPath(href)) {
                const title = mark.attrs.title as string | null | undefined;
                const titlePart = title ? ` "${String(title).replace(/"/g, '\\"')}"` : '';
                return `](<${href.replace(/>/g, '\\>')}>${titlePart})`;
            }
            return (
                '](' +
                href.replace(/[\(\)"]/g, '\\$&') +
                (mark.attrs.title ? ` "${String(mark.attrs.title).replace(/"/g, '\\"')}"` : '') +
                ')'
            );
        },
        mixable: true,
    },
};

/**
 * ProseMirror document → CommonMark string for {@link wikiSchema}.
 */
export const wikiMarkdownSerializer = new MarkdownSerializer(
    wikiNodes,
    wikiMarks,
    defaultMarkdownSerializer.options,
);
