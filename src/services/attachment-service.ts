import { createSlice, Ctx } from '@milkdown/kit/ctx';

export interface IAttachment {
    file: File;
    guidSuffixedFileName: string;
    base64Content?: string;
    error?: Error;
}

export interface IWikiContext {
    projectId: string;
    wikiId: string;
    wikiVersion?: string;
    // We don't need accessToken if we use credentials: 'include' for same-origin requests
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
    constructor(public wikiContext: IWikiContext) { }

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
        
        // Use crypto.randomUUID() if available, otherwise a simple fallback
        let guid: string;
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            guid = crypto.randomUUID().replace(/-/g, '');
        } else {
            // Simple fallback for older environments (though ADO supports modern browsers)
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

    // Upload attachment to ADO Wiki
    async uploadAttachment(file: File): Promise<string> {
        const validation = this.validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const guidSuffixedFileName = this.generateGuidSuffixedFilename(file.name);
        const base64Content = await this.readFileAsBase64(file);

        // Convert base64 to ArrayBuffer for upload
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Construct URL
        // We use relative path to leverage the browser's existing session cookies
        // Pattern: /{project}/_apis/wiki/wikis/{wikiIdentifier}/attachments/{name}?api-version=5.2-preview.1
        const projectPart = this.wikiContext.projectId ? `/${this.wikiContext.projectId}` : '';
        const url = `${projectPart}/_apis/wiki/wikis/${this.wikiContext.wikiId}/attachments/${encodeURIComponent(guidSuffixedFileName)}?api-version=5.2-preview.1`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream',
                // 'Authorization': `Bearer ...` // Not needed if using credentials: 'include' (default for same-origin)
            },
            body: bytes.buffer,
        });

        if (!response.ok) {
            throw new Error(`Failed to upload attachment: ${response.statusText}`);
        }

        // Return the markdown-ready path
        // ADO uses /.attachments/filename format
        return `/.attachments/${encodeURIComponent(guidSuffixedFileName).replace(/%20/g, '%20')}`;
    }
}

export const attachmentServiceCtx = createSlice<AdoAttachmentService | null>(null, 'attachmentService');
