/**
 * Azure DevOps Wiki API Client
 * 
 * This module provides access to ADO Wiki REST APIs to fetch:
 * - Child pages (for [[_TOSP_]] markers)
 * - Page headings (for [[_TOC_]] markers)
 */

export interface WikiPage {
    id: number;
    path: string;
    order: number;
    remoteUrl: string;
    gitItemPath?: string;
    subPages?: WikiPage[];
    content?: string;
}

export interface WikiInfo {
    org: string;
    projectId: string;
    wikiIdentifier: string;
    pagePath: string;
    version?: string;
}

export interface TocEntry {
    level: number;
    text: string;
    /** Encoded URL fragment for `href="#..."` (see {@link encodeAdoWikiHeadingFragment}). */
    anchor: string;
}

const utf8Encoder = new TextEncoder();

/**
 * Azure DevOps Wiki heading anchors follow Markdown All in One’s Azure DevOps slugify.
 *
 * Steps on the raw heading text:
 * 1. `trim`, Unicode `toLowerCase`
 * 2. Replace every character in Unicode category **Zs** (space separator) with `-`
 *
 * That string is the **intermediate** form used as the DOM `id` (decoded identifier).
 */
export function normalizeAdoWikiHeadingIntermediate(text: string): string {
    return text.trim().toLowerCase().replace(/\p{Zs}/gu, '-');
}

/**
 * Encodes the intermediate string for the `#fragment` in wiki links.
 * - If the intermediate starts with a digit: UTF-8 percent-encode **every** byte as `%XX` (uppercase hex),
 *   matching ADO / vscode-markdown so headings are not mistaken for work-item `#123` links.
 * - Otherwise: `encodeURIComponent` (comma → `%2C`, `>` → `%3E`, `\` → `%5C`, `:` → `%3A`; `!~*'()` stay unescaped per ECMA-262).
 */
export function encodeAdoWikiHeadingFragment(intermediate: string): string {
    if (/^\d/.test(intermediate)) {
        return Array.from(utf8Encoder.encode(intermediate), (b) => {
            const h = b.toString(16).toUpperCase().padStart(2, '0');
            return `%${h}`;
        }).join('');
    }
    return encodeURIComponent(intermediate);
}

export interface AdoWikiHeadingAnchorParts {
    /** DOM `id` value (decoded; matches fragment after browser percent-decoding). */
    intermediate: string;
    /** Value for `href="#..."` in TOC links. */
    fragment: string;
}

/**
 * Decode a single path segment from `location.href` once so we don't double-encode
 */
function decodeUrlPathSegment(segment: string): string {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

/**
 * Wiki URLs include `wikiVersion=GBwikiMaster` as a UI version key; Git REST APIs expect the backing branch
 * name `wikiMaster`. Using `GBwikiMaster` as {@link WikiInfo.version} with `versionDescriptor.versionType=branch`
 * yields TF401175 (branch cannot be resolved).
 */
export function normalizeWikiVersionForGitApi(version: string | undefined): string | undefined {
    if (version == null || version === '') {
        return undefined;
    }
    const v = version.trim();
    if (/^GBwikiMaster$/i.test(v)) {
        return 'wikiMaster';
    }
    return version;
}

/** Maps each heading plain text to intermediate + encoded fragment (ADO duplicate headings share the same values). */
export function adoWikiHeadingAnchorsFromPlainTexts(headingPlainTexts: string[]): AdoWikiHeadingAnchorParts[] {
    return headingPlainTexts.map((text) => {
        const intermediate = normalizeAdoWikiHeadingIntermediate(text);
        return {
            intermediate,
            fragment: encodeAdoWikiHeadingFragment(intermediate),
        };
    });
}

/**
 * Extract wiki info from the current URL
 */
export function getWikiInfoFromUrl(): WikiInfo | null {
    const url = window.location.href;
    
    // Match patterns like:
    // https://dev.azure.com/{org}/{project}/_wiki/wikis/{wikiName}/{pageId}/{pagePath}
    // https://dev.azure.com/{org}/{project}/_wiki/wikis/{wikiName}?pagePath={path}
    
    const wikiMatch = url.match(/https?:\/\/[^/]+\/([^/]+)\/([^/]+)\/_wiki\/wikis\/([^/?]+)/);
    if (!wikiMatch) return null;
    
    const [, org, project, wikiIdentifier] = wikiMatch;
    
    // Try to get pagePath from URL params or path
    const urlObj = new URL(url);
    let pagePath = urlObj.searchParams.get('pagePath') || '';
    
    // If not in query params, try to extract from path after wiki identifier
    if (!pagePath) {
        const pathMatch = url.match(/wikis\/[^/]+\/\d+\/(.+?)(?:\?|$)/);
        if (pathMatch) {
            pagePath = '/' + decodeURIComponent(pathMatch[1]);
        }
    }
    
    // Get version from query params if available (map UI tokens to Git branch names)
    const version = normalizeWikiVersionForGitApi(urlObj.searchParams.get('wikiVersion') || undefined);

    let normalizedPath = pagePath || '/';
    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
        normalizedPath = normalizedPath.replace(/\/+$/, '');
    }

    return {
        org: decodeUrlPathSegment(org),
        projectId: decodeUrlPathSegment(project),
        wikiIdentifier: decodeUrlPathSegment(wikiIdentifier),
        pagePath: normalizedPath,
        version,
    };
}

/**
 * Numeric wiki page id from the path segment after the wiki name, e.g.
 * `.../_wiki/wikis/My.wiki/42/...` → `42`. Prefer this for GET .../pages/{id} (reliable subPages).
 */
export function getWikiPageIdFromUrl(): number | null {
    const path = window.location.pathname;
    const m = path.match(/\/_wiki\/wikis\/[^/]+\/(\d+)(?:\/|$)/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : null;
}

/**
 * Wiki pages API lives under `/{organization}/{project}/_apis/...` (dev.azure.com and *.visualstudio.com).
 */
function wikiApiBasePath(wikiInfo: WikiInfo): string {
    const origin = window.location.origin;
    return `${origin}/${encodeURIComponent(wikiInfo.org)}/${encodeURIComponent(wikiInfo.projectId)}`;
}

function mapWikiPageRows(raw: unknown[]): WikiPage[] {
    return raw.map((page) => {
        const p = page as Record<string, unknown>;
        return {
            id: p.id as number,
            path: String(p.path ?? ''),
            order: (p.order as number) ?? 0,
            remoteUrl: typeof p.remoteUrl === 'string' ? p.remoteUrl : '',
            gitItemPath: typeof p.gitItemPath === 'string' ? p.gitItemPath : undefined,
        };
    });
}

function extractSubPagesPayload(data: Record<string, unknown> & { subPages?: unknown[]; SubPages?: unknown[] }): unknown[] {
    if (Array.isArray(data.subPages)) return data.subPages;
    if (Array.isArray(data.SubPages)) return data.SubPages;
    return [];
}

/**
 * Fetch child pages for a wiki page (for TOSP).
 * Uses page id from the URL when present (`.../wikis/{wiki}/{id}/`) — path-only queries can return empty subPages.
 */
export async function fetchChildPages(wikiInfo: WikiInfo, signal?: AbortSignal): Promise<WikiPage[]> {
    try {
        const base = `${wikiApiBasePath(wikiInfo)}/_apis/wiki/wikis/${encodeURIComponent(wikiInfo.wikiIdentifier)}/pages`;
        const path = wikiInfo.pagePath || '/';

        const buildParams = (includeVersion: boolean): URLSearchParams => {
            const params = new URLSearchParams({
                // VersionControlRecursionType.OneLevel — required for subPages
                recursionLevel: '1',
                'api-version': '7.1',
            });
            if (includeVersion && wikiInfo.version) {
                params.append('versionDescriptor.version', wikiInfo.version);
                params.append('versionDescriptor.versionType', 'branch');
            }
            return params;
        };

        const fetchOnce = async (fullUrl: string): Promise<unknown[]> => {
            const response = await fetch(fullUrl, {
                method: 'GET',
                credentials: 'include',
                signal,
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                console.warn('Failed to fetch child pages:', response.status, errText);
                return [];
            }
            const data = (await response.json()) as Record<string, unknown> & { subPages?: unknown[]; SubPages?: unknown[] };
            return extractSubPagesPayload(data);
        };

        const pageId = getWikiPageIdFromUrl();
        const tryVersioned = !!wikiInfo.version;

        const byId = async (id: number, includeVersion: boolean): Promise<WikiPage[]> => {
            const params = buildParams(includeVersion);
            const url = `${base}/${id}?${params.toString()}`;
            const raw = await fetchOnce(url);
            return mapWikiPageRows(raw);
        };

        const byPath = async (includeVersion: boolean): Promise<WikiPage[]> => {
            const params = buildParams(includeVersion);
            params.set('path', path);
            const url = `${base}?${params.toString()}`;
            const raw = await fetchOnce(url);
            return mapWikiPageRows(raw);
        };

        let pages: WikiPage[] = [];

        if (pageId != null) {
            pages = await byId(pageId, tryVersioned);
            if (pages.length === 0) {
                pages = await byPath(tryVersioned);
            }
        } else {
            pages = await byPath(tryVersioned);
        }

        if (pages.length === 0 && tryVersioned) {
            if (pageId != null) {
                pages = await byId(pageId, false);
                if (pages.length === 0) {
                    pages = await byPath(false);
                }
            } else {
                pages = await byPath(false);
            }
        }

        return pages;
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            return [];
        }
        console.error('Error fetching child pages:', error);
        return [];
    }
}

/**
 * Extract table of contents from document headings
 * This parses the current document's headings to build a TOC
 */
export function extractTocFromDocument(container: HTMLElement): TocEntry[] {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const texts: string[] = [];
    const levels: number[] = [];

    headings.forEach((heading) => {
        const level = parseInt(heading.tagName.charAt(1), 10);
        const text = heading.textContent?.trim() || '';
        if (text) {
            texts.push(text);
            levels.push(level);
        }
    });

    const parts = adoWikiHeadingAnchorsFromPlainTexts(texts);
    return texts.map((text, i) => ({
        level: levels[i],
        text,
        anchor: parts[i].fragment,
    }));
}

/**
 * Get page name from path
 */
export function getPageNameFromPath(path: string): string {
    const match = path.match(/\/([^/]*)$/);
    return match ? match[1] : path;
}

/**
 * Build the wiki page URL for a child page (matches dev.azure.com / visualstudio.com routing).
 */
export function buildWikiPageUrl(wikiInfo: WikiInfo, childPath: string): string {
    const baseUrl = window.location.origin;
    const pagePath = encodeURIComponent(childPath);
    const wikiEnc = encodeURIComponent(wikiInfo.wikiIdentifier);
    return `${baseUrl}/${encodeURIComponent(wikiInfo.org)}/${encodeURIComponent(wikiInfo.projectId)}/_wiki/wikis/${wikiEnc}?pagePath=${pagePath}`;
}

/**
 * Render TOC HTML matching ADO's format
 */
export function renderTocHtml(entries: TocEntry[]): string {
    if (entries.length === 0) {
        return '<div class="toc-container"><div class="toc-container-header">Contents</div><ul><li>No headings found</li></ul></div>';
    }
    
    let html = '<div class="toc-container" aria-label="Table of contents" role="navigation">';
    html += '<div class="toc-container-header">Contents</div>';
    html += '<ul>';
    
    entries.forEach(entry => {
        const indent = '  '.repeat(entry.level - 1);
        html += `${indent}<li><a href="#${entry.anchor}">${escapeHtml(entry.text)}</a></li>`;
    });
    
    html += '</ul></div>';
    return html;
}

/**
 * List markup for TOSP body (used inside the editor widget; header is separate).
 */
export function renderTospChildListHtml(pages: WikiPage[], wikiInfo: WikiInfo): string {
    if (pages.length === 0) {
        return '<div class="ado-tosp-empty">No child pages</div>';
    }
    const sortedPages = [...pages].sort((a, b) => a.order - b.order);
    let html = '<ul class="ado-tosp-list">';
    sortedPages.forEach((page) => {
        const name = getPageNameFromPath(page.path);
        const url = page.remoteUrl || buildWikiPageUrl(wikiInfo, page.path);
        html += `<li><a class="ado-tosp-link" href="${escapeHtmlAttr(url)}">${escapeHtml(name)}</a></li>`;
    });
    html += '</ul>';
    return html;
}

/**
 * Render TOSP HTML matching ADO's format
 */
export function renderTospHtml(pages: WikiPage[], wikiInfo: WikiInfo): string {
    let html = '<div class="tosp-container">';
    html += '<div class="tosp-container-header">Child Pages</div>';
    html += renderTospChildListHtml(pages, wikiInfo);
    html += '</div>';
    return html;
}

/**
 * Helper to escape HTML
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeHtmlAttr(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;');
}




