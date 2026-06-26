import type MarkdownIt from 'markdown-it';

import { WIKI_MATH_MAX_TEX_CHARS } from './wiki-math-katex';

/** markdown-it `StateBlock` / `StateInline` (types vary by version). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StateBlock = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StateInline = any;

function capTex(s: string): string {
    const t = s.replace(/\r\n/g, '\n');
    if (t.length <= WIKI_MATH_MAX_TEX_CHARS) return t;
    return t.slice(0, WIKI_MATH_MAX_TEX_CHARS);
}

/**
 * At `pos` where `src.slice(pos, pos+2) === '\\)'` or `'\\]'`, true if this pair closes (odd run of `\` ending at pos).
 */
function isUnescapedDelimiterClose(src: string, from: number, pos: number): boolean {
    let run = 0;
    let k = pos;
    while (k >= from && src[k] === '\\') {
        run++;
        k--;
    }
    return run % 2 === 1;
}

/** Find index of `\` starting closing `\)` after `from`; `-1` if none. */
function findInlineMathCloseParen(src: string, from: number, to: number): number {
    let pos = from;
    while (pos < to - 1) {
        if (src[pos] === '\\' && src[pos + 1] === ')') {
            if (isUnescapedDelimiterClose(src, from, pos)) return pos;
        }
        pos++;
    }
    return -1;
}

/** True if `$` at `dollarPos` is a delimiter (even count of `\` immediately before it, within `[from, dollarPos)`). */
function isClosingDollar(src: string, from: number, dollarPos: number): boolean {
    let bs = 0;
    let j = dollarPos - 1;
    while (j >= from && src[j] === '\\') {
        bs++;
        j--;
    }
    return bs % 2 === 0;
}

/**
 * Same-line `$…$` closing dollar after `from` (exclusive of opening `$`). `-1` if none.
 * Skips `$$` pairs inside the span (treated as two literal dollars, not display).
 */
function findInlineMathCloseDollar(src: string, from: number, to: number): number {
    let pos = from;
    while (pos < to) {
        if (src[pos] === '\n') {
            return -1;
        }
        if (src[pos] === '$') {
            if (pos + 1 < to && src[pos + 1] === '$') {
                pos += 2;
                continue;
            }
            if (isClosingDollar(src, from, pos)) {
                return pos;
            }
        }
        pos++;
    }
    return -1;
}

/**
 * Avoid prices parsed as math: `$50`, `$19.99`, and `$50 and $19.99` on one line (first `$` must not
 * pair across prose into the next amount). Strip whole-word `and` / `or`, then require digits-only.
 */
function isProbablyCurrencyOnly(inner: string): boolean {
    const t = inner.trim();
    if (!t) return true;
    const noConjunctions = t.replace(/\b(and|or)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    return /^[\d.,\s]+$/.test(noConjunctions);
}

/** Find index of `\` starting closing `\]` after `from`. */
function findBracketMathClose(src: string, from: number, to: number): number {
    let pos = from;
    while (pos < to - 1) {
        if (src[pos] === '\\' && src[pos + 1] === ']') {
            if (isUnescapedDelimiterClose(src, from, pos)) return pos;
        }
        pos++;
    }
    return -1;
}

/** `$$` … `$$` on own lines (display). */
function wikiMathBlockDollar(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(pos, max).trim();
    if (line !== '$$') return false;

    if (silent) return true;

    const body: string[] = [];
    let next = startLine + 1;
    while (next < endLine) {
        const p = state.bMarks[next] + state.tShift[next];
        const e = state.eMarks[next];
        const l = state.src.slice(p, e).trim();
        if (l === '$$') {
            const token = state.push('wiki_math_block', 'math', 0);
            token.block = true;
            token.content = capTex(body.join('\n').replace(/^\n+|\n+$/g, ''));
            token.map = [startLine, next + 1];
            state.line = next + 1;
            return true;
        }
        body.push(state.src.slice(state.bMarks[next] + state.tShift[next], state.eMarks[next]));
        next++;
    }
    return false;
}

/**
 * Display `\[ … \]` either one line `\[…\]` or:
 *
 * ```
 * \[
 * …
 * \]
 * ```
 */
function wikiMathBlockBracket(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const rawLine = state.src.slice(pos, max);
    const trimmedStart = rawLine.trimStart();
    if (!trimmedStart.startsWith('\\[')) return false;

    const openOffset = rawLine.length - trimmedStart.length;
    const afterOpen = pos + openOffset + 2;
    const lineEnd = state.src.slice(afterOpen, max);
    const closeOnSame = findBracketMathClose(lineEnd, 0, lineEnd.length);
    if (closeOnSame >= 0) {
        if (silent) return true;
        const inner = lineEnd.slice(0, closeOnSame).trim();
        const token = state.push('wiki_math_block', 'math', 0);
        token.block = true;
        token.content = capTex(inner);
        token.map = [startLine, startLine + 1];
        state.line = startLine + 1;
        return true;
    }

    /** Same-line `\[ …` without `\]` is not a display block (avoid swallowing invalid lines). */
    if (lineEnd.trim().length > 0) return false;

    if (trimmedStart.trim() !== '\\[') return false;

    if (silent) return true;

    const body: string[] = [];
    let next = startLine + 1;
    while (next < endLine) {
        const p = state.bMarks[next] + state.tShift[next];
        const e = state.eMarks[next];
        const full = state.src.slice(p, e);
        const t = full.trim();
        if (t === '\\]') {
            const token = state.push('wiki_math_block', 'math', 0);
            token.block = true;
            token.content = capTex(body.join('\n').replace(/^\n+|\n+$/g, ''));
            token.map = [startLine, next + 1];
            state.line = next + 1;
            return true;
        }
        body.push(full);
        next++;
    }
    return false;
}

/** Inline `$…$` (ADO-style); same line; skips digit-only “currency” spans. */
function wikiMathInlineDollar(state: StateInline, silent: boolean): boolean {
    if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) {
        return false;
    }
    if (state.pos + 1 < state.posMax && state.src.charCodeAt(state.pos + 1) === 0x24) {
        return false;
    }
    if (!isClosingDollar(state.src, 0, state.pos)) {
        return false;
    }

    const contentStart = state.pos + 1;
    const closeIdx = findInlineMathCloseDollar(state.src, contentStart, state.posMax);
    if (closeIdx < 0) {
        return false;
    }

    const inner = state.src.slice(contentStart, closeIdx);
    if (!inner.trim()) {
        return false;
    }
    if (isProbablyCurrencyOnly(inner)) {
        return false;
    }

    if (!silent) {
        const token = state.push('wiki_math_inline', 'math', 0);
        token.markup = '$';
        token.content = capTex(inner);
    }
    state.pos = closeIdx + 1;
    return true;
}

/** Legacy `\(...\)` (still parsed for old pages). */
function wikiMathInlineParen(state: StateInline, silent: boolean): boolean {
    if (state.src.slice(state.pos, state.pos + 2) !== '\\(') {
        return false;
    }

    const contentStart = state.pos + 2;
    const closeIdx = findInlineMathCloseParen(state.src, contentStart, state.posMax);
    if (closeIdx < 0) {
        return false;
    }

    if (!silent) {
        const token = state.push('wiki_math_inline', 'math', 0);
        token.markup = '\\( \\)';
        token.content = capTex(state.src.slice(contentStart, closeIdx));
    }
    state.pos = closeIdx + 2;
    return true;
}

function wikiMathInline(state: StateInline, silent: boolean): boolean {
    if (wikiMathInlineDollar(state, silent)) {
        return true;
    }
    return wikiMathInlineParen(state, silent);
}

export function wikiMathMarkdownIt(md: MarkdownIt): void {
    md.block.ruler.before('paragraph', 'wiki_math_block_dollar', wikiMathBlockDollar);
    md.block.ruler.before('paragraph', 'wiki_math_block_bracket', wikiMathBlockBracket);
    /** Before `escape` so `\$` / `\\(` are not eaten before we see math delimiters. */
    md.inline.ruler.before('escape', 'wiki_math_inline', wikiMathInline);
}
