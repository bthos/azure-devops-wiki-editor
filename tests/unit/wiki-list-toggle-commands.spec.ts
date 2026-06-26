import { describe, expect, it } from 'vitest';

import { type Command, EditorState, TextSelection } from 'prosemirror-state';

import { liftListItem, sinkListItem } from 'prosemirror-schema-list';

import { createToggleBulletList, createToggleOrderedList } from '../../src/editor/wiki-list-toggle-commands';
import { wikiIndentListItem } from '../../src/editor/wiki-list-indent-commands';
import { createToggleWikiTaskList } from '../../src/editor/wiki-task-list-commands';
import { wikiSchema } from '../../src/editor/wiki-schema';

/** Applies every transaction the command dispatches (some commands chain multiple `dispatch` calls). */
function applyCmd(state: EditorState, cmd: Command): EditorState {
    let cur = state;
    const ok = cmd(cur, (tr) => {
        cur = cur.apply(tr);
    });
    expect(ok).toBe(true);
    return cur;
}

describe('createToggleBulletList', () => {
    it('wraps a paragraph in a bullet list then lifts out on second toggle', () => {
        const para = wikiSchema.nodes.paragraph.create(null, wikiSchema.text('hi'));
        const doc = wikiSchema.node('doc', null, [para]);
        const cmd = createToggleBulletList(wikiSchema.nodes.bullet_list, wikiSchema.nodes.list_item);
        let state = EditorState.create({ doc });
        state = state.apply(state.tr.setSelection(TextSelection.create(doc, 2)));
        state = applyCmd(state, cmd);
        expect(state.doc.child(0).type.name).toBe('bullet_list');
        state = applyCmd(state, cmd);
        expect(state.doc.child(0).type.name).toBe('paragraph');
    });
});

describe('createToggleOrderedList', () => {
    it('wraps then lifts ordered list', () => {
        const para = wikiSchema.nodes.paragraph.create(null, wikiSchema.text('x'));
        const doc = wikiSchema.node('doc', null, [para]);
        const cmd = createToggleOrderedList(wikiSchema.nodes.ordered_list, wikiSchema.nodes.list_item);
        let state = EditorState.create({ doc });
        state = state.apply(state.tr.setSelection(TextSelection.create(doc, 2)));
        state = applyCmd(state, cmd);
        expect(state.doc.child(0).type.name).toBe('ordered_list');
        state = applyCmd(state, cmd);
        expect(state.doc.child(0).type.name).toBe('paragraph');
    });
});

describe('createToggleWikiTaskList', () => {
    it('wraps a paragraph in a bullet list with task items in one action', () => {
        const para = wikiSchema.nodes.paragraph.create(null, wikiSchema.text('text'));
        const doc = wikiSchema.node('doc', null, [para]);
        const cmd = createToggleWikiTaskList(wikiSchema.nodes.bullet_list);
        let state = EditorState.create({ doc });
        state = state.apply(state.tr.setSelection(TextSelection.create(doc, 3)));
        state = applyCmd(state, cmd);
        const bl = state.doc.child(0);
        expect(bl.type.name).toBe('bullet_list');
        expect(bl.child(0).type.name).toBe('list_item');
        expect(bl.child(0).attrs['checked']).toBe(false);
    });

    it('second toggle unwraps list (back to paragraph, not plain bullet)', () => {
        const para = wikiSchema.nodes.paragraph.create(null, wikiSchema.text('text'));
        const doc = wikiSchema.node('doc', null, [para]);
        const cmd = createToggleWikiTaskList(wikiSchema.nodes.bullet_list);
        let state = EditorState.create({ doc });
        state = state.apply(state.tr.setSelection(TextSelection.create(doc, 3)));
        state = applyCmd(state, cmd);
        state = applyCmd(state, cmd);
        expect(state.doc.child(0).type.name).toBe('paragraph');
        expect(state.doc.textContent).toBe('text');
    });
});

describe('wikiIndentListItem', () => {
    it('indents the first (and only) list item by wrapping content in an inner list', () => {
        const li = wikiSchema.nodes.list_item;
        const bl = wikiSchema.nodes.bullet_list;
        const item = li.create(null, [wikiSchema.nodes.paragraph.create(null, wikiSchema.text('only'))]);
        const list = bl.create(null, [item]);
        const doc = wikiSchema.node('doc', null, [list]);
        let pos = 0;
        doc.descendants((n, p) => {
            if (n.isText && n.text === 'only') pos = p + 1;
        });
        let state = EditorState.create({ doc });
        state = state.apply(state.tr.setSelection(TextSelection.create(doc, pos)));
        const cmd = wikiIndentListItem(li);
        expect(cmd(state)).toBe(true);
        state = applyCmd(state, cmd);
        const outerLi = state.doc.child(0).child(0);
        expect(outerLi.type.name).toBe('list_item');
        expect(outerLi.child(0).type.name).toBe('bullet_list');
        expect(outerLi.textContent).toBe('only');
    });
});

describe('list indent (sink / lift)', () => {
    it('sink then lift round-trip on sibling list items', () => {
        const li = wikiSchema.nodes.list_item;
        const bl = wikiSchema.nodes.bullet_list;
        const li1 = li.create(null, [wikiSchema.nodes.paragraph.create(null, wikiSchema.text('a'))]);
        const li2 = li.create(null, [wikiSchema.nodes.paragraph.create(null, wikiSchema.text('b'))]);
        const list = bl.create(null, [li1, li2]);
        const doc = wikiSchema.node('doc', null, [list]);
        let posB = 0;
        doc.descendants((n, p) => {
            if (n.isText && n.text === 'b') posB = p + 1;
        });
        let state = EditorState.create({ doc });
        state = state.apply(state.tr.setSelection(TextSelection.create(doc, posB)));
        const sink = sinkListItem(li);
        expect(sink(state)).toBe(true);
        state = applyCmd(state, sink);
        const firstLi = state.doc.child(0).child(0);
        expect(firstLi.type.name).toBe('list_item');
        expect(firstLi.child(1).type.name).toBe('bullet_list');

        let posB2 = 0;
        state.doc.descendants((n, p) => {
            if (n.isText && n.text === 'b') posB2 = p + 1;
        });
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, posB2)));
        const lift = liftListItem(li);
        expect(lift(state)).toBe(true);
        state = applyCmd(state, lift);
        expect(state.doc.child(0).type.name).toBe('bullet_list');
        expect(state.doc.child(0).childCount).toBe(2);
    });
});
