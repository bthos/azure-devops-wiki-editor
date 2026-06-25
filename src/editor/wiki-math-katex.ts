import katex from 'katex';

/** Hard cap for TeX source length (parse + render). */
export const WIKI_MATH_MAX_TEX_CHARS = 16_384;

export type WikiMathKatexResult =
    | { ok: true; html: string }
    | { ok: false; html: string; message: string };

/**
 * Renders wiki math with KaTeX defaults hardened for untrusted source (no `trust`, no `\href` / `\url` execution).
 * @see https://katex.org/docs/options.html
 */
export function renderWikiMathKatex(tex: string, displayMode: boolean): WikiMathKatexResult {
    const trimmed = tex.replace(/\r\n/g, '\n');
    if (trimmed.length > WIKI_MATH_MAX_TEX_CHARS) {
        return {
            ok: false,
            html: '',
            message: `Math exceeds ${WIKI_MATH_MAX_TEX_CHARS} characters`,
        };
    }
    try {
        const html = katex.renderToString(trimmed, {
            displayMode,
            output: 'html',
            throwOnError: false,
            strict: 'ignore',
            trust: false,
            maxSize: 500,
            maxExpand: 1000,
        });
        return { ok: true, html };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, html: '', message };
    }
}
