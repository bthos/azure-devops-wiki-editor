/**
 * Azure DevOps wiki **video** blocks expect iframe embeds (YouTube, Microsoft Stream, SharePoint), not raw media files.
 * @see `.artefacts/features/2026-04-21-wiki-video-embed/spec.md`
 */

export const WIKI_VIDEO_URL_MAX_LENGTH = 2048;

/** Placeholder copy aligned with ADO wiki UI. */
export const WIKI_VIDEO_IFRAME_PLACEHOLDER =
    'Insert iframe block from YouTube, Microsoft Stream or SharePoint here.';

function hostIsOrSubdomainOf(hostname: string, base: string): boolean {
    const h = hostname.toLowerCase();
    const b = base.toLowerCase();
    return h === b || h.endsWith(`.${b}`);
}

/**
 * True when `url` is an allowed **iframe src** for the wiki video widget (HTTPS hosts used by ADO).
 */
export function isWikiVideoIframeEmbedUrl(url: URL): boolean {
    const h = url.hostname;
    const p = url.pathname.toLowerCase();

    const yt =
        (hostIsOrSubdomainOf(h, 'youtube.com') || hostIsOrSubdomainOf(h, 'youtube-nocookie.com')) &&
        p.includes('/embed/');
    if (yt) {
        return true;
    }

    if (h.toLowerCase().includes('sharepoint.com')) {
        return true;
    }

    if (hostIsOrSubdomainOf(h, 'microsoftstream.com')) {
        return true;
    }

    if (hostIsOrSubdomainOf(h, 'office.com') && (p.includes('/embed') || p.includes('embed.aspx'))) {
        return true;
    }

    return false;
}

/**
 * Returns normalized `https` href, or `null` if the value must be rejected / stripped.
 */
export function normalizeWikiVideoEmbedUrl(raw: string): string | null {
    const t = raw.trim().replace(/\r\n/g, '\n');
    if (!t || t.length > WIKI_VIDEO_URL_MAX_LENGTH) {
        return null;
    }
    let u: URL;
    try {
        u = new URL(t);
    } catch {
        return null;
    }
    if (u.protocol !== 'https:') {
        return null;
    }
    if (u.username || u.password) {
        return null;
    }
    return u.href;
}

/**
 * First `src="…"` / `src='…'` inside an `<iframe` snippet (trimmed), or `null`.
 */
export function extractIframeSrcFromEmbedHtml(raw: string): string | null {
    const t = raw.trim();
    if (!/<iframe/i.test(t)) {
        return null;
    }
    const m = /<iframe[\s\S]*?\ssrc\s*=\s*(["'])([^"']*)\1/i.exec(t);
    const src = m?.[2]?.trim();
    return src && src.length > 0 ? src : null;
}

/**
 * Resolves `::: video` body: optional full `<iframe …>`, or a single embed **src** URL.
 * Returns normalized https URL only for allowed iframe hosts; otherwise `null`.
 */
export function normalizeWikiVideoEmbedInput(raw: string): string | null {
    const trimmed = raw.trim().replace(/\r\n/g, '\n');
    if (!trimmed) {
        return null;
    }
    const fromIframe = extractIframeSrcFromEmbedHtml(trimmed);
    const candidate =
        fromIframe ??
        trimmed
            .split('\n')
            .map((s) => s.trim())
            .find((s) => s.length > 0 && !s.startsWith('#')) ??
        '';
    const https = normalizeWikiVideoEmbedUrl(candidate);
    if (!https) {
        return null;
    }
    let u: URL;
    try {
        u = new URL(https);
    } catch {
        return null;
    }
    if (!isWikiVideoIframeEmbedUrl(u)) {
        return null;
    }
    return u.href;
}

/** @deprecated Video widget no longer uses `<video>`; kept for tests / callers that inspect URL shape. */
export function canWikiVideoUseNativeMediaElement(normalizedHttpsUrl: string): boolean {
    let path: string;
    try {
        path = new URL(normalizedHttpsUrl).pathname.toLowerCase();
    } catch {
        return false;
    }
    return /\.(mp4|webm|ogg)(\/)?$/i.test(path);
}
