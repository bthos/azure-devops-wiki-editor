import { describe, expect, it } from 'vitest';
import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state';

import { selectionInsideCodeBlock } from '../../src/editor/wiki-code-block-context';
import { wikiSchema } from '../../src/editor/wiki-schema';

describe('selectionInsideCodeBlock', () => {
    it('is true when cursor is in code_block text', () => {
        const text = wikiSchema.text('hello');
        const block = wikiSchema.nodes.code_block.create({ params: '' }, text);
        const doc = wikiSchema.node('doc', null, [block]);
        const pos = 2;
        const state = EditorState.create({ doc, selection: TextSelection.create(doc, pos) });
        expect(selectionInsideCodeBlock(state)).toBe(true);
    });

    it('is true for NodeSelection on a code_block', () => {
        const block = wikiSchema.nodes.code_block.create({ params: 'ts' }, wikiSchema.text('x'));
        const doc = wikiSchema.node('doc', null, [block]);
        const pos = 1;
        const state = EditorState.create({
            doc,
            selection: NodeSelection.create(doc, pos),
        });
        expect(selectionInsideCodeBlock(state)).toBe(true);
    });

    it('is false in a plain paragraph', () => {
        const p = wikiSchema.nodes.paragraph.create(null, wikiSchema.text('hi'));
        const doc = wikiSchema.node('doc', null, [p]);
        const state = EditorState.create({ doc, selection: TextSelection.create(doc, 2) });
        expect(selectionInsideCodeBlock(state)).toBe(false);
    });
});
