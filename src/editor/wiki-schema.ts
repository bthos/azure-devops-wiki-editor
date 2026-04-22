import { Schema, type Mark, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import { schema as markdownSchema } from 'prosemirror-markdown';
import { tableNodes } from 'prosemirror-tables';

import { base64ToUtf8, utf8ToBase64 } from './wiki-html-marker';
import { normalizeWikiToolbarHexColor, parseWikiStyleDeclarations } from './wiki-text-color';

const baseListItem = markdownSchema.spec.nodes.get('list_item')!;
const baseHeading = markdownSchema.spec.nodes.get('heading')!;

function headingAnchorIdFromDom(dom: HTMLElement | string): string | null {
    if (typeof dom === 'string') return null;
    const id = (dom as HTMLElement).id?.trim();
    return id ? id : null;
}

/**
 * Same `content` / `marks` as CommonMark `heading`, plus `anchorId` rendered as DOM `id` (ADO wiki fragments).
 * Keeps anchors in the document so ProseMirror does not fight RAF-driven `element.id = …` mutations.
 */
const wikiHeading: NodeSpec = {
    ...baseHeading,
    attrs: {
        level: { default: 1 },
        anchorId: { default: null },
    },
    parseDOM: [
        { tag: 'h1', getAttrs: (dom) => ({ level: 1, anchorId: headingAnchorIdFromDom(dom) }) },
        { tag: 'h2', getAttrs: (dom) => ({ level: 2, anchorId: headingAnchorIdFromDom(dom) }) },
        { tag: 'h3', getAttrs: (dom) => ({ level: 3, anchorId: headingAnchorIdFromDom(dom) }) },
        { tag: 'h4', getAttrs: (dom) => ({ level: 4, anchorId: headingAnchorIdFromDom(dom) }) },
        { tag: 'h5', getAttrs: (dom) => ({ level: 5, anchorId: headingAnchorIdFromDom(dom) }) },
        { tag: 'h6', getAttrs: (dom) => ({ level: 6, anchorId: headingAnchorIdFromDom(dom) }) },
    ],
    toDOM(node) {
        const level = node.attrs['level'] as number;
        const anchorId = node.attrs['anchorId'] as string | null | undefined;
        if (anchorId) {
            return ['h' + level, { id: anchorId }, 0];
        }
        return ['h' + level, 0];
    },
};

/** `null` = normal list item; `boolean` = GFM task list item (matches Milkdown `data-checked` / theme rules). */
const wikiListItem: NodeSpec = {
    ...baseListItem,
    attrs: { checked: { default: null } },
    parseDOM: [
        {
            tag: 'li[data-checked]',
            getAttrs(dom: HTMLElement | string) {
                if (typeof dom === 'string') return false;
                const v = dom.getAttribute('data-checked');
                return { checked: v === 'true' };
            },
        },
        {
            tag: 'li.task-list-item',
            getAttrs(dom: HTMLElement | string) {
                if (typeof dom === 'string') return false;
                const cb = dom.querySelector('input.task-list-item-checkbox[type=checkbox]');
                if (cb) return { checked: (cb as HTMLInputElement).checked };
                return { checked: false };
            },
        },
        { tag: 'li', getAttrs: () => ({ checked: null }) },
    ],
    toDOM(node) {
        const c = node.attrs['checked'] as boolean | null | undefined;
        if (typeof c === 'boolean') {
            return ['li', { class: 'task-list-item', 'data-checked': c ? 'true' : 'false' }, 0];
        }
        return ['li', 0];
    },
};

function adoAtomBlock(className: string): NodeSpec {
    return {
        group: 'block',
        atom: true,
        selectable: true,
        draggable: false,
        isolating: true,
        parseDOM: [{ tag: `div.${className}` }],
        toDOM() {
            return ['div', { class: className, contenteditable: 'false' }];
        },
    };
}

/** ADO-style embedded HTML block: raw `html_block` in markdown (`markdown-it` `html: true`). */
function adoHtmlBlockNode(): NodeSpec {
    return {
        group: 'block',
        atom: true,
        selectable: true,
        draggable: false,
        isolating: true,
        attrs: {
            html: { default: '' },
        },
        parseDOM: [
            {
                tag: 'div.ado-html-widget[data-html-b64]',
                getAttrs(dom: HTMLElement | string) {
                    if (typeof dom === 'string') return false;
                    const el = dom as HTMLElement;
                    const raw = el.getAttribute('data-html-b64')?.trim() ?? '';
                    if (!raw) return { html: '' };
                    try {
                        return { html: base64ToUtf8(raw) };
                    } catch {
                        return { html: '' };
                    }
                },
            },
        ],
        toDOM(node) {
            const html = String(node.attrs['html'] ?? '');
            const b64 = utf8ToBase64(html);
            return ['div', { class: 'ado-html-widget', 'data-html-b64': b64, contenteditable: 'false' }];
        },
    };
}

/** Raw HTML inside a paragraph (markdown-it `html_inline`), excluding task-list checkbox markup. */
function adoHtmlInlineNode(): NodeSpec {
    return {
        group: 'inline',
        atom: true,
        inline: true,
        selectable: true,
        attrs: { html: { default: '' } },
        parseDOM: [
            {
                tag: 'span.ado-html-inline[data-html-inline]',
                getAttrs(dom: HTMLElement | string) {
                    if (typeof dom === 'string') return false;
                    const raw = (dom as HTMLElement).getAttribute('data-html-inline')?.trim() ?? '';
                    if (!raw) return { html: '' };
                    try {
                        return { html: base64ToUtf8(raw) };
                    } catch {
                        return { html: '' };
                    }
                },
            },
        ],
        toDOM(node) {
            const html = String(node.attrs['html'] ?? '');
            return [
                'span',
                {
                    class: 'ado-html-inline',
                    'data-html-inline': utf8ToBase64(html),
                    contenteditable: 'false',
                },
            ];
        },
    };
}

const wikiTableNodes = tableNodes({
    tableGroup: 'block',
    /** Cells hold paragraphs; {@link createWikiMarkdownParser} wraps markdown-it `inline` cell tokens into paragraphs. */
    cellContent: 'paragraph+',
    cellAttributes: {},
});

/** GFM `~~strike~~` — markdown-it `default` preset emits `s_open` / `s_close` tokens for this. */
const strikethroughMark: MarkSpec = {
    parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }],
    toDOM() {
        return ['s', 0];
    },
};

/**
 * Inline text color + optional highlight (`background-color`), serialized to one `<span style="…">` in wiki markdown.
 * Distinct from `ado_html_inline` atoms (no widget chrome).
 */
const wikiStyleMark: MarkSpec = {
    attrs: {
        color: { default: '' },
        backgroundColor: { default: '' },
    },
    inclusive: true,
    parseDOM: [
        {
            tag: 'span',
            getAttrs(dom: HTMLElement | string) {
                if (typeof dom === 'string') return false;
                const el = dom as HTMLElement;
                if (el.classList.contains('ado-mention') || el.classList.contains('ado-html-inline')) {
                    return false;
                }
                const parsed = parseWikiStyleDeclarations(el.getAttribute('style') ?? '');
                if (!parsed || (!parsed.color && !parsed.backgroundColor)) {
                    return false;
                }
                return { color: parsed.color, backgroundColor: parsed.backgroundColor };
            },
        },
    ],
    toDOM(mark: Mark) {
        const color = normalizeWikiToolbarHexColor(String(mark.attrs['color'] ?? ''));
        const bg = normalizeWikiToolbarHexColor(String(mark.attrs['backgroundColor'] ?? ''));
        const parts: string[] = [];
        if (color) parts.push(`color: ${color}`);
        if (bg) parts.push(`background-color: ${bg}`);
        if (!parts.length) {
            return ['span', 0];
        }
        return ['span', { style: parts.join('; ') }, 0];
    },
};

/**
 * ADO @mention — same surface as Milkdown {@link ../syntax/ado-mention-mark.ts} / `ado-markers-plugin` widget:
 * `data-user-name` for {@link ../plugins/mention-profile-card.ts} + {@link ../services/mention-service.ts} (IMS / Graph).
 */
const userMentionMark: MarkSpec = {
    attrs: { userName: { default: '' } },
    inclusive: true,
    parseDOM: [
        {
            tag: 'span.ado-mention',
            getAttrs(dom: HTMLElement | string) {
                if (typeof dom === 'string') return false;
                const el = dom as HTMLElement;
                const fromData = el.dataset.userName?.trim();
                if (fromData) return { userName: fromData };
                const nameEl = el.querySelector('.ado-mention-name');
                if (nameEl?.textContent) return { userName: nameEl.textContent.trim() };
                return { userName: '' };
            },
        },
    ],
    toDOM(mark: Mark) {
        const name = String(mark.attrs['userName'] ?? '');
        return [
            'span',
            {
                class: 'ado-mention',
                'data-user-name': name,
                title: `Mention: ${name}`,
            },
            ['span', { class: 'ado-mention-icon', 'aria-hidden': 'true' }, '@'],
            ['span', { class: 'ado-mention-name' }, 0],
        ];
    },
};

const wikiMarks = markdownSchema.spec.marks.append({
    strikethrough: strikethroughMark,
    userMention: userMentionMark,
    wikiStyle: wikiStyleMark,
});

/**
 * CommonMark schema from prosemirror-markdown plus GFM-style tables (prosemirror-tables), strikethrough, and ADO TOC/TOSP/HTML block atoms.
 * Pipe tables: markdown-it-multimd-table + {@link createWikiMarkdownParser} token specs.
 */
export const wikiSchema = new Schema({
    nodes: markdownSchema.spec.nodes
        .update('heading', wikiHeading)
        .update('list_item', wikiListItem)
        .append(wikiTableNodes)
        .append({
            ado_toc: adoAtomBlock('ado-toc-widget'),
            ado_tosp: adoAtomBlock('ado-tosp-widget'),
            ado_html_block: adoHtmlBlockNode(),
            ado_html_inline: adoHtmlInlineNode(),
        }),
    marks: wikiMarks,
});
