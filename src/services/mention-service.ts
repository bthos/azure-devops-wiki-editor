import { IWikiContext } from './attachment-service';

export interface IIdentity {
    displayName: string;
    id: string; // Storage Key (GUID)
    uniqueName?: string; // domain\alias or email
    imageUrl?: string;
}

export class AdoMentionService {
    private cache: Map<string, IIdentity> = new Map(); // id -> identity
    private nameToId: Map<string, string> = new Map(); // displayName -> id
    private mangledNames: Map<string, string> = new Map(); // mangledName -> id

    constructor(public wikiContext: IWikiContext) {}

    /**
     * Check if a string is a valid GUID
     */
    private isGuid(value: string): boolean {
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
    }

    /**
     * Resolve all @<GUID> mentions in the text to @<DisplayName>
     */
    async resolveMentions(text: string): Promise<string> {
        const guidPattern = /@<([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>/g;
        const matches = Array.from(text.matchAll(guidPattern));
        
        if (matches.length === 0) return text;

        const guidsToFetch = new Set<string>();
        matches.forEach(m => {
            const guid = m[1];
            if (!this.cache.has(guid)) {
                guidsToFetch.add(guid);
            }
        });

        if (guidsToFetch.size > 0) {
            await this.fetchIdentities(Array.from(guidsToFetch));
        }

        // Replace GUIDs with Display Names
        return text.replace(guidPattern, (match, guid) => {
            const identity = this.cache.get(guid);
            if (identity) {
                // Handle duplicates by using mangled names if necessary
                // For now, we'll just use the display name and rely on the cache
                // If we have multiple users with same name, we should have mangled them during fetch
                const displayName = this.getMangledName(identity);
                return `@<${displayName}>`;
            }
            return match;
        });
    }

    /**
     * Restore all @<DisplayName> mentions in the text to @<GUID>
     */
    restoreMentions(text: string): string {
        // Match @<Name> pattern
        // We need to be careful not to match @<GUID> if it wasn't resolved
        const mentionPattern = /@<([^>]+)>/g;
        
        return text.replace(mentionPattern, (match, name) => {
            if (this.isGuid(name)) return match; // Already a GUID

            // Check mangled names first
            if (this.mangledNames.has(name)) {
                return `@<${this.mangledNames.get(name)}>`;
            }

            // Check direct name mapping
            if (this.nameToId.has(name)) {
                return `@<${this.nameToId.get(name)}>`;
            }

            // If not found, return as is (ADO will handle it or it's just text)
            return match;
        });
    }

    /**
     * Get a unique display name for an identity (handle duplicates)
     */
    private getMangledName(identity: IIdentity): string {
        // Check if we already assigned a mangled name for this ID
        for (const [mangled, id] of this.mangledNames.entries()) {
            if (id === identity.id) return mangled;
        }

        let name = identity.displayName;
        if (!this.nameToId.has(name) || this.nameToId.get(name) === identity.id) {
            this.nameToId.set(name, identity.id);
            this.mangledNames.set(name, identity.id);
            return name;
        }

        // Collision detected
        let counter = 1;
        let mangled = `${name} (${counter})`;
        while (this.mangledNames.has(mangled) && this.mangledNames.get(mangled) !== identity.id) {
            counter++;
            mangled = `${name} (${counter})`;
        }

        this.mangledNames.set(mangled, identity.id);
        return mangled;
    }

    /**
     * Fetch identities from ADO
     */
    private async fetchIdentities(guids: string[]): Promise<void> {
        // We'll use the batch identity endpoint
        // POST https://dev.azure.com/{org}/_apis/identities?api-version=6.0
        // Body: { identityIds: string[] }
        // Note: This endpoint might vary based on ADO version/environment.
        // Another option is /_apis/identity/identities
        
        // Construct URL relative to the current page's organization
        // We assume we are at https://dev.azure.com/{org}/{project}/...
        // So /_apis/... should work relative to domain root? 
        // No, usually it's /{org}/_apis/...
        
        // Let's try to extract org from window.location if possible, or use relative path
        // If we use relative path '/_apis/...', it goes to https://dev.azure.com/_apis/... which is wrong.
        // It needs to be https://dev.azure.com/{org}/_apis/...
        
        const orgUrl = this.getOrgUrl();
        const url = `${orgUrl}/_apis/identities?api-version=6.0`; // Try this first

        // If we can't determine org URL, we might fail.
        
        try {
            // We need to split into chunks if too many
            const chunks = this.chunkArray(guids, 20);
            
            for (const chunk of chunks) {
                // Try using the IdentityPicker API which is more robust for UI
                // But IdentityPicker is for search.
                // Let's try the standard identities batch API.
                
                // Actually, let's try to use the batch endpoint:
                // GET /_apis/identities?descriptors={descriptors}&queryMembership=None&api-version=6.0
                // But we have IDs (Storage Keys), not descriptors.
                // GET /_apis/identities?identityIds={ids}&api-version=6.0
                
                const queryUrl = `${url}&identityIds=${chunk.join(',')}`;
                
                const response = await fetch(queryUrl);
                if (!response.ok) {
                    console.warn(`Failed to fetch identities: ${response.statusText}`);
                    continue;
                }

                const data = await response.json();
                if (data && data.value) {
                    data.value.forEach((item: any) => {
                        if (item && item.id && item.providerDisplayName) {
                            const identity: IIdentity = {
                                id: item.id,
                                displayName: item.providerDisplayName,
                                uniqueName: item.properties?.['Account']?.['$value'] || item.descriptor
                            };
                            this.cache.set(identity.id, identity);
                            this.getMangledName(identity); // Register name mapping
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Error fetching identities', e);
        }
    }

    private getOrgUrl(): string {
        if (this.wikiContext.org) {
            return `/${this.wikiContext.org}`;
        }

        // Try to parse from current location
        // https://dev.azure.com/{org}/{project}/...
        // or https://{org}.visualstudio.com/...
        
        const path = window.location.pathname;
        const parts = path.split('/').filter(p => p);
        
        if (window.location.hostname.includes('dev.azure.com')) {
            // dev.azure.com/{org}
            if (parts.length >= 1) {
                return `/${parts[0]}`;
            }
        } else if (window.location.hostname.includes('visualstudio.com')) {
            // {org}.visualstudio.com
            return ''; // Root is org
        }
        
        // Fallback: try to guess or use relative
        return '';
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
    }
}
