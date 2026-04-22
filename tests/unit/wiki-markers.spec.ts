import { describe, expect, it } from 'vitest';
import { postprocessAdoMarkers, preprocessMentions } from '../../src/utils/wiki-markers';

describe('preprocessMentions', () => {
    it('wraps @<name> with angle quotation marks', () => {
        expect(preprocessMentions('Hi @<Jane Doe> there')).toBe('Hi @‹Jane Doe› there');
    });

    it('leaves text without mentions unchanged', () => {
        expect(preprocessMentions('no mentions')).toBe('no mentions');
    });
});

describe('postprocessAdoMarkers', () => {
    it('restores mention angle quotes to ADO storage form', () => {
        expect(postprocessAdoMarkers('ping @‹x›')).toBe('ping @<x>');
    });

    it('unescapes angle bracket escape', () => {
        expect(postprocessAdoMarkers('a \\< b')).toBe('a < b');
    });

    it('normalizes escaped TOC marker to [[_TOC_]]', () => {
        expect(postprocessAdoMarkers('\\[\\[_TOC_\\]\\]')).toBe('[[_TOC_]]');
    });

    it('normalizes escaped TOSP marker to [[_TOSP_]]', () => {
        expect(postprocessAdoMarkers('\\[\\[_TOSP_\\]\\]')).toBe('[[_TOSP_]]');
    });
});
