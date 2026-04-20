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
 * Azure DevOps Wiki heading anchors follow Markdown All in One’s Azure DevOps slugify
 * (see https://markdown-all-in-one.github.io/docs/specs/slugify/azure-devops.html),
 * aligned with vscode-markdown’s implementation and tests.
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
    
    // Get version from query params if available
    const version = urlObj.searchParams.get('wikiVersion') || undefined;
    
    return {
        org,
        projectId: project,
        wikiIdentifier: decodeURIComponent(wikiIdentifier),
        pagePath: pagePath || '/',
        version
    };
}

/**
 * Fetch child pages for a wiki page (for TOSP)
 */
export async function fetchChildPages(wikiInfo: WikiInfo): Promise<WikiPage[]> {
    try {
        const baseUrl = window.location.origin;
        const apiUrl = `${baseUrl}/${encodeURIComponent(wikiInfo.projectId)}/_apis/wiki/wikis/${encodeURIComponent(wikiInfo.wikiIdentifier)}/pages`;
        
        const params = new URLSearchParams({
            path: wikiInfo.pagePath,
            recursionLevel: '1', // Only immediate children
            'api-version': '5.2-preview.1'
        });
        
        if (wikiInfo.version) {
            params.append('versionDescriptor.version', wikiInfo.version);
            params.append('versionDescriptor.versionType', 'branch');
        }
        
        const response = await fetch(`${apiUrl}?${params.toString()}`, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.warn('Failed to fetch child pages:', response.status);
            return [];
        }
        
        const data = await response.json();
        
        // Extract subPages from the response
        if (data && data.subPages && Array.isArray(data.subPages)) {
            return data.subPages.map((page: any) => ({
                id: page.id,
                path: page.path,
                order: page.order || 0,
                remoteUrl: page.remoteUrl || '',
                gitItemPath: page.gitItemPath
            }));
        }
        
        return [];
    } catch (error) {
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
 * Build the wiki page URL for a child page
 */
export function buildWikiPageUrl(wikiInfo: WikiInfo, childPath: string): string {
    const baseUrl = window.location.origin;
    const pagePath = encodeURIComponent(childPath);
    return `${baseUrl}/${wikiInfo.projectId}/_wiki/wikis/${encodeURIComponent(wikiInfo.wikiIdentifier)}?pagePath=${pagePath}`;
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
 * Render TOSP HTML matching ADO's format
 */
export function renderTospHtml(pages: WikiPage[], wikiInfo: WikiInfo): string {
    let html = '<div class="tosp-container">';
    html += '<div class="tosp-container-header">Child Pages</div>';
    html += '<ul>';
    
    if (pages.length === 0) {
        html += '<li>No child pages</li>';
    } else {
        // Sort by order
        const sortedPages = [...pages].sort((a, b) => a.order - b.order);
        
        sortedPages.forEach(page => {
            const name = getPageNameFromPath(page.path);
            const url = page.remoteUrl || buildWikiPageUrl(wikiInfo, page.path);
            html += `<li><a href="${escapeHtml(url)}">${escapeHtml(name)}</a></li>`;
        });
    }
    
    html += '</ul></div>';
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




