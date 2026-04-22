import { describe, expect, it } from 'vitest';

import { EditorState, TextSelection } from 'prosemirror-state';
import { tableNodeTypes } from 'prosemirror-tables';

import {
    applyWikiStyle,
    insertAdoHtmlBlock,
    insertAdoTocBlock,
    insertAdoTospBlock,
} from '../../src/editor/wiki-insert-markers';
import { createWikiMarkdownParser } from '../../src/editor/wiki-markdown-parser';
import { wikiMarkdownSerializer } from '../../src/editor/wiki-markdown-serializer';
import { isWikiToolbarHexColor } from '../../src/editor/wiki-text-color';
import { insertSimpleTable } from '../../src/editor/wiki-table-commands';
import { wikiSchema } from '../../src/editor/wiki-schema';

function applyCmd(state: EditorState, cmd: ReturnType<typeof insertAdoTocBlock>): EditorState {
    let next: EditorState | null = null;
    const ok = cmd(state, (tr) => {
        next = state.apply(tr);
    });
    expect(ok).toBe(true);
    if (next == null) {
        throw new Error('expected dispatch');
    }
    return next;
}

describe('insertAdoTocBlock / insertAdoTospBlock', () => {
    it('replaces an empty paragraph with ado_toc', () => {
        const para = wikiSchema.nodes.paragraph.create();
        const doc = wikiSchema.node('doc', null, [para]);
        let state = EditorState.create({ doc });
        state = state.apply(state.tr.setSelection(TextSelection.create(doc, 1)));
        state = applyCmd(state, insertAdoTocBlock());
        expect(state.doc.child(0).type.name).toBe('ado_toc');
    });

    it('inserts ado_tosp after a non-empty paragraph', () => {
        const para = wikiSchema.nodes.paragraph.create(null, wikiSchema.text('Hi'));
        const doc = wikiSchema.node('doc', null, [para]);
        let state = EditorState.create({ doc });
        state = state.apply(state.tr.setSelection(TextSelection.create(doc, 2)));
        state = applyCmd(state, insertAdoTospBlock());
        expect(state.doc.childCount).toBe(2);
        expect(state.doc.child(0).type.name).toBe('paragraph');
        expect(state.doc.child(1).type.name).toBe('ado_tosp');
    });

    it('returns false when selection is inside a table', () => {
        const table = insertSimpleTable(wikiSchema, 1, 2, true);
        const doc = wikiSchema.node('doc', null, [table]);
        let state = EditorState.create({ doc });
        const types = tableNodeTypes(wikiSchema);
        const cellPos = 4;
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, cellPos)));
        const ok = insertAdoTocBlock()(state, () => {});
        expect(ok).toBe(false);
    });
});

describe('insertAdoHtmlBlock', () => {
    it('returns false when the selection is inside a list (ADO-style)', () => {
        const p = wikiSchema.nodes.paragraph.create(null, wikiSchema.text('x'));
        const li = wikiSchema.nodes.list_item.create(null, p);
        const bl = wikiSchema.nodes.bullet_list.create(null, li);
        const doc = wikiSchema.node('doc', null, [bl]);
        let state = EditorState.create({ doc });
        state = state.apply(state.tr.setSelection(TextSelection.create(doc, 3)));
        const ok = insertAdoHtmlBlock('<p>a</p>')(state, () => {});
        expect(ok).toBe(false);
    });
});

describe('applyWikiStyle', () => {
    it('validates hex colors for the toolbar', () => {
        expect(isWikiToolbarHexColor('#aabbcc')).toBe(true);
        expect(isWikiToolbarHexColor('#ABC')).toBe(true);
        expect(isWikiToolbarHexColor('red')).toBe(false);
        expect(isWikiToolbarHexColor('#gg0000')).toBe(false);
    });

    it('applies wikiStyle mark (text color) to the selected range', () => {
        const para = wikiSchema.nodes.paragraph.create(null, wikiSchema.text('Hello'));
        const doc = wikiSchema.node('doc', null, [para]);
        let state = EditorState.create({ doc });
        const sel = TextSelection.between(doc.resolve(2), doc.resolve(7));
        state = state.apply(state.tr.setSelection(sel));
        state = applyCmd(state, applyWikiStyle({ color: '#ff0000' }));
        const p = state.doc.child(0);
        expect(p.textContent).toBe('Hello');
        const ws = wikiSchema.marks['wikiStyle'];
        expect(ws).toBeTruthy();
        let sawColor = false;
        p.descendants((n) => {
            if (n.isText && ws!.isInSet(n.marks) && n.marks.find((m) => m.type === ws)?.attrs['color'] === '#ff0000') {
                sawColor = true;
            }
        });
        expect(sawColor).toBe(true);
    });

    it('returns false inside a code block', () => {
        const code = wikiSchema.nodes.code_block.create({ params: '' }, wikiSchema.text('x = 1'));
        const doc = wikiSchema.node('doc', null, [code]);
        let state = EditorState.create({ doc });
        state = state.apply(state.tr.setSelection(TextSelection.create(doc, 2, 3)));
        const ok = applyWikiStyle({ color: '#00ff00' })(state, () => {});
        expect(ok).toBe(false);
    });

    it('round-trips markdown html_inline color span as wikiStyle mark', () => {
        const md = 'Hello <span style="color:#ff00aa">world</span>!';
        const doc = createWikiMarkdownParser().parse(md);
        expect(doc.textContent).toContain('Hello');
        expect(doc.textContent).toContain('world');
        const ws = wikiSchema.marks['wikiStyle'];
        expect(ws).toBeTruthy();
        let hasColorOnWorld = false;
        doc.descendants((n) => {
            if (n.isText && (n.text ?? '').includes('world') && ws!.isInSet(n.marks)) {
                hasColorOnWorld = true;
            }
        });
        expect(hasColorOnWorld).toBe(true);
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toMatch(/color:\s*#ff00aa/i);
    });

    it('round-trips color + background-color in one wikiStyle span', () => {
        const md = 'X <span style="color:#112233;background-color:#ffeedd">Y</span> Z';
        const doc = createWikiMarkdownParser().parse(md);
        const ws = wikiSchema.marks['wikiStyle'];
        let ok = false;
        doc.descendants((n) => {
            if (n.isText && (n.text ?? '') === 'Y' && ws!.isInSet(n.marks)) {
                const m = n.marks.find((x) => x.type === ws);
                if (m?.attrs['color'] === '#112233' && m.attrs['backgroundColor'] === '#ffeedd') ok = true;
            }
        });
        expect(ok).toBe(true);
        const out = wikiMarkdownSerializer.serialize(doc);
        expect(out).toMatch(/color:#112233/i);
        expect(out).toMatch(/background-color:#ffeedd/i);
    });
});
