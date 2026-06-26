import { describe, expect, it } from 'vitest';

import { EditorState } from 'prosemirror-state';

import { wikiHeadingAnchorPlugin, wikiHeadingAnchorPluginKey } from '../../src/editor/wiki-heading-anchor-plugin';
import { wikiSchema } from '../../src/editor/wiki-schema';

function h(level: number, text: string, anchorId: string | null = null) {
    return wikiSchema.node('heading', { level, anchorId }, wikiSchema.text(text));
}

describe('wikiHeadingAnchorPlugin', () => {
    it('sets anchorId on first heading and null on duplicate normalized text', () => {
        const doc = wikiSchema.node('doc', null, [h(2, 'Hello'), h(2, 'hello')]);
        const state = EditorState.create({ doc, plugins: [wikiHeadingAnchorPlugin()] });
        const next = state.apply(state.tr.setMeta(wikiHeadingAnchorPluginKey, true));
        expect(next.doc.child(0).attrs['anchorId']).toBe('hello');
        expect(next.doc.child(1).attrs['anchorId']).toBe(null);
    });

    it('clears anchorId for empty heading text', () => {
        const doc = wikiSchema.node('doc', null, [h(1, '   ', 'stale-id')]);
        const state = EditorState.create({ doc, plugins: [wikiHeadingAnchorPlugin()] });
        const next = state.apply(state.tr.setMeta(wikiHeadingAnchorPluginKey, true));
        expect(next.doc.child(0).attrs['anchorId']).toBe(null);
    });
});
