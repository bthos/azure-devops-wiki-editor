export interface IAttachment {
    file: File;
    guidSuffixedFileName: string;
    base64Content?: string;
    error?: Error;
}

export interface IWikiContext {
    org?: string;
    projectId: string;
    wikiId: string;
    wikiVersion?: string;
}

// Allowed file types (matching ADO's official list)
const ALLOWED_ATTACHMENT_TYPES = [
    '.CS', '.CSV', '.DOC', '.DOCX', '.GIF', '.GZ', '.HTM', '.HTML',
    '.ICO', '.JPEG', '.JPG', '.JSON', '.LYR', '.MD', '.MOV', '.MP4',
    '.MPP', '.MSG', '.PDF', '.PNG', '.PPT', '.PPTX', '.PS1', '.RAR',
    '.RDP', '.SQL', '.TXT', '.VSD', '.VSDX', '.XLS', '.XLSX', '.XML',
    '.ZIP', '.SVG'
];

const MAX_FILE_SIZE = 18874368; // 18 MB

export class AdoAttachmentService {
    /** Backing Git repo id for the wiki (from Wikis GET). */
    repositoryId: string | null = null;

    constructor(public wikiContext: IWikiContext) { }

    /** True after {@link hydrateRepositoryId} resolves the wiki repo (needed for Git Items URLs). */
    isDisplaySrcReady(): boolean {
        return this.repositoryId != null && this.wikiContext.org != null && this.wikiContext.org.length > 0;
    }

    /**
     * Load `repositoryId` so `/.attachments/...` can be shown via Git Items API (same as ADO native wiki).
     */
    async hydrateRepositoryId(): Promise<void> {
        if (this.repositoryId || !this.wikiContext.org) {
            return;
        }
        const origin = window.location.origin;
        const url = `${origin}/${encodeURIComponent(this.wikiContext.org)}/${encodeURIComponent(this.wikiContext.projectId)}/_apis/wiki/wikis/${encodeURIComponent(this.wikiContext.wikiId)}?api-version=7.1`;
        try {
            const res = await fetch(url, {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) {
                console.warn('AdoAttachmentService: could not load wiki metadata', res.status);
                return;
            }
            const data = (await res.json()) as { repositoryId?: string; RepositoryId?: string };
            const rid = data.repositoryId ?? data.RepositoryId;
            if (typeof rid === 'string' && rid.length > 0) {
                this.repositoryId = rid;
            }
        } catch (e) {
            console.warn('AdoAttachmentService: wiki metadata fetch failed', e);
        }
    }

    /**
     * ADO stores `/.attachments/name.jpeg` in markdown; the browser needs the Git Items URL to display `<img>`.
     */
    toDisplaySrc(storedPath: string): string {
        if (!this.isDisplaySrcReady() || !storedPath) {
            return storedPath;
        }
        const normalized = AdoAttachmentService.normalizeAttachmentMarkdownPath(storedPath);
        if (!normalized.startsWith('/.attachments/')) {
            return storedPath;
        }
        return this.buildGitItemsUrl(normalized);
    }

    private buildGitItemsUrl(repoPath: string): string {
        const origin = window.location.origin;
        const params = new URLSearchParams();
        params.set('path', repoPath);
        params.set('download', 'false');
        params.set('resolveLfs', 'true');
        params.set('$format', 'octetStream');
        params.set('api-version', '5.0-preview.1');
        params.set('sanitize', 'true');
        const ver = this.wikiContext.wikiVersion;
        if (ver) {
            params.set('versionDescriptor.version', ver);
            params.set('versionDescriptor.versionType', 'branch');
        } else {
            params.set('versionDescriptor.version', 'wikiMaster');
        }
        const base = `${origin}/${encodeURIComponent(this.wikiContext.org!)}/${encodeURIComponent(this.wikiContext.projectId)}/_apis/git/repositories/${this.repositoryId}/Items`;
        return `${base}?${params.toString()}`;
    }

    /**
     * Legacy: remark destinationRaw could emit `...jpeg\)`; strip stray trailing `\` on relative paths.
     * Also normalize angle-bracket destinations `![x](</.attachments/...>)` if a backslash slipped in.
     */
    sanitizeMarkdownAttachmentParenEscapes(markdown: string): string {
        // Universal fix for `.../.attachments/...path\)` (does not depend on `![` / link prefix).
        let out = markdown.replace(/(\/\.attachments\/[^)]+?)\\\)/g, '$1)');
        out = out.replace(
            /(!?\[[^\]]*]\()\s*<(\/\.attachments\/[^>]+)>(\))/g,
            (_full, before: string, path: string, after: string) => {
                const cleaned = path.replace(/\\+$/g, '');
                return `${before}<${cleaned}>${after}`;
            }
        );
        out = out.replace(
            /(!?\[[^\]]*]\()(\s*)(\/\.attachments\/[^)]+)(\))/g,
            (_full, before: string, space: string, path: string, after: string) => {
                const cleaned = path.replace(/\\+$/g, '');
                return before + space + cleaned + after;
            }
        );
        out = out.replace(/(\]\(\s*\/\.attachments\/[^)]+?)\\\)/g, '$1)');
        return out;
    }

    /**
     * Rewrite markdown image/link targets from `/.attachments/...` to display URLs before parsing.
     */
    rewriteMarkdownToDisplayUrls(markdown: string): string {
        if (!this.isDisplaySrcReady()) {
            return markdown;
        }
        markdown = this.sanitizeMarkdownAttachmentParenEscapes(markdown);
        // `![alt](</.attachments/...>)` from mdast destinationLiteral (see ado-wiki-attachment-stringify.ts)
        markdown = markdown.replace(
            /(!?\[[^\]]*]\()\s*<(\/\.attachments\/[^>\n]+)>(\))/g,
            (_full, before: string, path: string, after: string) => {
                const display = this.toDisplaySrc(path);
                return `${before}${display}${after}`;
            }
        );
        return markdown.replace(
            /(!?\[[^\]]*]\()(\s*)(\/\.attachments\/[^)]+)(\))/g,
            (_full, before: string, space: string, path: string, after: string) => {
                const display = this.toDisplaySrc(path);
                return `${before}${space}${display}${after}`;
            }
        );
    }

    /**
     * Turn Git Items URLs back into `/.attachments/...` for textarea / ADO storage.
     * Handles `![alt](https://...items?...)` and `![alt](<https://...items?...>)` (mdast destinationLiteral).
     */
    markdownRestoreRelativeAttachmentPaths(markdown: string): string {
        markdown = this.sanitizeMarkdownAttachmentParenEscapes(markdown);

        const toRelative = (before: string, url: string, after: string): string | null => {
            try {
                const u = new URL(url);
                const path = u.searchParams.get('path');
                if (path && path.startsWith('/.attachments/')) {
                    const rel = AdoAttachmentService.wikiMarkdownAttachmentRelativePath(path);
                    return `${before}${rel}${after}`;
                }
            } catch {
                /* ignore */
            }
            return null;
        };

        // Angle-bracket Git Items URLs (common when remark uses destinationLiteral for long HTTPS).
        markdown = markdown.replace(
            /(!?\[[^\]]*]\()\s*<(https?:\/\/[^>]+)>(\))/gi,
            (full, before: string, url: string, after: string) => {
                if (!url.includes('/items?') || !url.includes('_apis/git/repositories/')) {
                    return full;
                }
                return toRelative(before, url, after) ?? full;
            }
        );

        const itemsUrlPattern =
            /(!?\[[^\]]*]\()(\s*)(https?:\/\/[^)\s]+?_apis\/git\/repositories\/[a-f0-9-]{36}\/items\?[^)]+)(\))/gi;
        markdown = markdown.replace(itemsUrlPattern, (full, before: string, space: string, url: string, after: string) => {
            const rel = toRelative(before + space, url, after);
            return rel ?? full;
        });

        return this.sanitizeMarkdownAttachmentParenEscapes(markdown);
    }

    /**
     * Normalize `/.attachments/...` for Git Items API (`path` query): trim, strip trailing `\`, decode
     * percent-escapes so `params.set('path', …)` serializes correctly.
     */
    static normalizeAttachmentMarkdownPath(src: string): string {
        let s = src.trim();
        try {
            s = decodeURIComponent(s);
        } catch {
            /* keep */
        }
        if (s.startsWith('/.attachments/')) {
            s = s.replace(/\\+$/g, '');
        }
        return s;
    }

    /**
     * Wiki markdown must keep attachment paths segment-encoded (`%20` for spaces). A decoded path from
     * `URLSearchParams` or the editor would otherwise become `](/.attachments/foo bar.pdf)` and break the link.
     */
    static wikiMarkdownAttachmentRelativePath(decodedRepoPath: string): string {
        let s = decodedRepoPath.trim();
        if (s.startsWith('/.attachments/')) {
            s = s.replace(/\\+$/g, '');
        }
        if (!s.startsWith('/.attachments/')) {
            return s;
        }
        const segments = s.split('/').filter(Boolean);
        return '/' + segments.map((seg) => encodeURIComponent(seg)).join('/');
    }

    // Validate file is allowed
    validateFile(file: File): { valid: boolean; error?: string } {
        const ext = '.' + file.name.split('.').pop()?.toUpperCase();

        if (!ALLOWED_ATTACHMENT_TYPES.includes(ext)) {
            return { valid: false, error: `File type ${ext} is not supported` };
        }

        if (file.size > MAX_FILE_SIZE) {
            return { valid: false, error: `File exceeds maximum size of 18MB` };
        }

        return { valid: true };
    }

    // Generate ADO-style GUID-suffixed filename
    generateGuidSuffixedFilename(originalName: string): string {
        const lastDotIndex = originalName.lastIndexOf('.');
        const baseName = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex + 1) : '';
        
        let guid: string;
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            guid = crypto.randomUUID().replace(/-/g, '');
        } else {
            guid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        
        return `${baseName}-${guid}.${extension}`;
    }

    // Read file as base64
    async readFileAsBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const commaIndex = result.indexOf(',');
                if (commaIndex >= 0) {
                    resolve(result.substr(commaIndex + 1));
                } else {
                    reject(new Error('Failed to read file as base64'));
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    /**
     * ADO Wiki attachment create: PUT `.../wikis/{wiki}/attachments?name=...`.
     * See Azure DevOps REST "Attachments - Create" (wiki), not `.../attachments/{name}` path style.
     */
    async uploadAttachment(file: File): Promise<string> {
        const validation = this.validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const org = this.wikiContext.org?.trim();
        if (!org) {
            throw new Error('Cannot upload attachment: missing organization in wiki URL');
        }

        const guidSuffixedFileName = this.generateGuidSuffixedFilename(file.name);
        const params = new URLSearchParams();
        params.set('name', guidSuffixedFileName);
        params.set('api-version', '7.1');
        const ver = this.wikiContext.wikiVersion?.trim();
        if (ver) {
            params.set('versionDescriptor.versionType', 'branch');
            params.set('versionDescriptor.version', ver);
        }

        const origin = window.location.origin;
        const base = `${origin}/${encodeURIComponent(org)}/${encodeURIComponent(this.wikiContext.projectId)}/_apis/wiki/wikis/${encodeURIComponent(this.wikiContext.wikiId)}/attachments`;
        const url = `${base}?${params.toString()}`;

        // Server decodes the body as Base64; raw file bytes → HTTP 500 "not a valid Base-64 string".
        // PUT only allows application/json, application/json-patch+json, or application/octet-stream
        // (text/plain → HTTP 400). Send the ASCII Base64 characters as octet-stream bytes—not decoded binary.
        const base64Payload = await this.readFileAsBase64(file);
        const body = new TextEncoder().encode(base64Payload);

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream',
                Accept: 'application/json',
            },
            credentials: 'include',
            body,
        });

        if (!response.ok) {
            let detail = response.statusText?.trim() ?? '';
            try {
                const text = await response.text();
                if (text) {
                    const trimmed = text.length > 800 ? `${text.slice(0, 800)}…` : text;
                    try {
                        const j = JSON.parse(text) as { message?: string; value?: string };
                        detail = (j.message ?? j.value ?? trimmed).trim() || trimmed;
                    } catch {
                        detail = trimmed;
                    }
                }
            } catch {
                /* keep statusText */
            }
            throw new Error(
                `Failed to upload attachment: HTTP ${response.status}${detail ? ` — ${detail}` : ''}`,
            );
        }

        return `/.attachments/${encodeURIComponent(guidSuffixedFileName)}`;
    }
}
