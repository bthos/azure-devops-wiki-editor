/**
 * Azure DevOps work item refs in prose: `#12345` (minimum two digits).
 * Avoid false positives: URL fragments (`.../path#123`), identifiers (`x#123`), markdown headings (`# Title`).
 *
 * @see `.artefacts/features/2026-04-21-wiki-work-item-widget/spec.md`
 */

/** Matches JS `\w` for ASCII (used instead of unicode-aware `\w` for predictable wiki behavior). */
function isAsciiWordChar(code: number): boolean {
    return (
        (code >= 48 && code <= 57) ||
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122) ||
        code === 95
    );
}

export interface WikiWorkItemMatch {
    /** Digits only, e.g. `"12345"`. */
    id: string;
    /** Full `#12345` slice. */
    raw: string;
}

/**
 * If `src[pos]` begins a valid work-item token, returns span and numeric id (else `null`).
 * `posMax` is exclusive end index (markdown-it uses `state.posMax`).
 */
export function matchWikiWorkItemRef(src: string, pos: number, posMax: number): WikiWorkItemMatch | null {
    if (pos >= posMax) return null;
    if (src.charCodeAt(pos) !== 35 /* # */) return null;

    if (pos > 0) {
        const prev = src.charCodeAt(pos - 1);
        // Skip URL fragments and continuation after `#` markers / words.
        if (prev === 47 /* / */ || prev === 35 /* # */) return null;
        if (isAsciiWordChar(prev)) return null;
    }

    let i = pos + 1;
    let digits = 0;
    while (i < posMax) {
        const c = src.charCodeAt(i);
        if (c >= 48 && c <= 57) {
            digits++;
            i++;
            continue;
        }
        break;
    }
    if (digits < 2) return null;

    // `\b` after digits: next char must not extend the word (digit/letter/_).
    if (i < posMax && isAsciiWordChar(src.charCodeAt(i))) {
        return null;
    }

    const id = src.slice(pos + 1, i);
    const raw = src.slice(pos, i);
    return { id, raw };
}
