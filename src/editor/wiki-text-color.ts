/**
 * Hex colors and combined `style` parsing for {@link wikiSchema} `wikiStyle` mark (text + background).
 */

export function isWikiToolbarHexColor(value: string): boolean {
    const v = value.trim();
    return /^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v);
}

export function expandShortHex(short: string): string {
    const s = short.startsWith('#') ? short.slice(1) : short;
    if (s.length !== 3) return short.startsWith('#') ? short : `#${short}`;
    const r = s[0] ?? '0';
    const g = s[1] ?? '0';
    const b = s[2] ?? '0';
    return `#${r}${r}${g}${g}${b}${b}`;
}

/** Normalize `#rgb` / `#rrggbb` to lowercase `#rrggbb`, or `null` if invalid. */
export function normalizeWikiToolbarHexColor(value: string): string | null {
    const v = value.trim();
    if (!isWikiToolbarHexColor(v)) return null;
    const lower = v.toLowerCase();
    return lower.length === 4 ? expandShortHex(lower) : lower;
}

/** `background-color:` or `background:` with a hex value only (no `url()` etc.). */
export function wikiParseBackgroundColorDeclaration(part: string): string | null {
    const one = part.trim().replace(/\s*;\s*$/, '').trim();
    if (!one || one.includes(';')) return null;
    const m = one.match(
        /^(?:background-color|background)\s*:\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\s*$/i,
    );
    return m?.[1] ?? null;
}

/**
 * Parses a `style` attribute that contains only `color` and/or `background-color` (hex). Unknown rules → `null`.
 */
export function parseWikiStyleDeclarations(style: string): { color: string; backgroundColor: string } | null {
    const raw = style.trim();
    if (!raw) return null;
    const parts = raw
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
    let color = '';
    let backgroundColor = '';
    for (const p of parts) {
        const c = wikiParseSingleColorDeclaration(p);
        if (c) {
            if (color) return null;
            const n = normalizeWikiToolbarHexColor(c);
            if (!n) return null;
            color = n;
            continue;
        }
        const b = wikiParseBackgroundColorDeclaration(p);
        if (b) {
            if (backgroundColor) return null;
            const n = normalizeWikiToolbarHexColor(b);
            if (!n) return null;
            backgroundColor = n;
            continue;
        }
        return null;
    }
    if (!color && !backgroundColor) return null;
    return { color, backgroundColor };
}

/**
 * If `raw` is a lone `<span style="…">` with only allowed color rules (no `class` / `id`), returns attrs; else `null`.
 */
export function tryParseWikiStyleSpanOpenHtml(raw: string): { color: string; backgroundColor: string } | null {
    const full = raw.trim();
    if (!/^<span\b/i.test(full) || !/>$/.test(full)) return null;
    if (/\bclass\s*=/i.test(full) || /\bid\s*=/i.test(full)) return null;
    const m = full.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
    if (!m) return null;
    return parseWikiStyleDeclarations(m[2] ?? '');
}

export function isWikiHtmlInlineClosingSpan(raw: string): boolean {
    return /^\s*<\/span>\s*$/i.test(raw);
}

/** `style` value must be a single `color: #hex` declaration (optional spaces / semicolon). */
export function wikiParseSingleColorDeclaration(styleValue: string): string | null {
    const one = styleValue
        .trim()
        .replace(/\s*;\s*$/, '')
        .trim();
    if (!one || one.includes(';')) return null;
    const m = one.match(/^color\s*:\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\s*$/i);
    return m?.[1] ?? null;
}
