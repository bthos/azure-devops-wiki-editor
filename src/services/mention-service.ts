import { IWikiContext } from './attachment-service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IIdentity {
    displayName: string;
    id: string;
    uniqueName?: string;
    imageUrl?: string;
    mailAddress?: string;
    principalName?: string;
}

export class AdoMentionService {
    private cache: Map<string, IIdentity> = new Map();
    private nameToId: Map<string, string> = new Map();
    private mangledNames: Map<string, string> = new Map();

    constructor(public wikiContext: IWikiContext) {}

    private isGuid(value: string): boolean {
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
    }

    private isLikelyEmail(s: string | undefined): boolean {
        return typeof s === 'string' && EMAIL_RE.test(s.trim());
    }

    resolveStorageKeyFromDisplayName(label: string): string | undefined {
        const trimmed = label.trim();
        if (this.mangledNames.has(trimmed)) {
            return this.mangledNames.get(trimmed);
        }
        if (this.nameToId.has(trimmed)) {
            return this.nameToId.get(trimmed);
        }
        return undefined;
    }

    getCachedIdentity(storageKey: string): IIdentity | undefined {
        return this.cache.get(storageKey);
    }

    /**
     * Load IMS identity, then Graph user (vssps) when email is still missing — same browser session as ADO.
     */
    async fetchIdentityForCard(storageKey: string): Promise<IIdentity | null> {
        if (!this.isGuid(storageKey)) {
            return null;
        }
        await this.fetchIdentities([storageKey]);
        let current = this.cache.get(storageKey);
        if (current && this.isLikelyEmail(current.mailAddress)) {
            return current;
        }
        await this.enrichIdentityFromGraph(storageKey);
        return this.cache.get(storageKey) ?? null;
    }

    async resolveMentions(text: string): Promise<string> {
        const guidPattern = /@<([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>/g;
        const matches = Array.from(text.matchAll(guidPattern));

        if (matches.length === 0) return text;

        const guidsToFetch = new Set<string>();
        matches.forEach((m) => {
            const guid = m[1];
            if (!this.cache.has(guid)) {
                guidsToFetch.add(guid);
            }
        });

        if (guidsToFetch.size > 0) {
            await this.fetchIdentities(Array.from(guidsToFetch));
        }

        return text.replace(guidPattern, (match, guid) => {
            const identity = this.cache.get(guid);
            if (identity) {
                const displayName = this.getMangledName(identity);
                return `@<${displayName}>`;
            }
            return match;
        });
    }

    restoreMentions(text: string): string {
        const mentionPattern = /@<([^>]+)>/g;

        return text.replace(mentionPattern, (match, name) => {
            if (this.isGuid(name)) return match;

            if (this.mangledNames.has(name)) {
                return `@<${this.mangledNames.get(name)}>`;
            }

            if (this.nameToId.has(name)) {
                return `@<${this.nameToId.get(name)}>`;
            }

            return match;
        });
    }

    private getMangledName(identity: IIdentity): string {
        for (const [mangled, id] of this.mangledNames.entries()) {
            if (id === identity.id) return mangled;
        }

        let name = identity.displayName;
        if (!this.nameToId.has(name) || this.nameToId.get(name) === identity.id) {
            this.nameToId.set(name, identity.id);
            this.mangledNames.set(name, identity.id);
            return name;
        }

        let counter = 1;
        let mangled = `${name} (${counter})`;
        while (this.mangledNames.has(mangled) && this.mangledNames.get(mangled) !== identity.id) {
            counter++;
            mangled = `${name} (${counter})`;
        }

        this.mangledNames.set(mangled, identity.id);
        return mangled;
    }

    private async adoFetch(url: string): Promise<Response> {
        return fetch(url, {
            credentials: 'include',
            headers: {
                Accept: 'application/json',
            },
        });
    }

    private readProp(item: Record<string, unknown>, key: string): string | undefined {
        const props = item.properties as Record<string, unknown> | undefined;
        const v = props?.[key];
        if (v == null) return undefined;
        if (typeof v === 'string') return v;
        if (typeof v === 'object' && v !== null && '$value' in v && (v as { $value?: unknown }).$value != null) {
            return String((v as { $value: unknown }).$value);
        }
        return undefined;
    }

    /**
     * IMS property bags vary: scan nested $value strings for the first RFC5322-like email.
     */
    private extractEmailFromProperties(properties: unknown): string | undefined {
        if (!properties || typeof properties !== 'object') return undefined;

        const preferredKeys = [
            'Mail',
            'mail',
            'SignInName',
            'SignIn',
            'PreferredEmail',
            'Microsoft.TeamFoundation.Identity.UserPrincipalName',
            'UserPrincipalName',
            'Account',
            'Core.Identity.Mail',
            'Microsoft.TeamFoundation.Identity.Mail',
        ];

        for (const key of preferredKeys) {
            const v = this.readProp({ properties } as Record<string, unknown>, key);
            if (v && this.isLikelyEmail(v)) {
                return v.trim();
            }
        }

        const walk = (node: unknown): string | undefined => {
            if (typeof node === 'string') {
                return this.isLikelyEmail(node) ? node.trim() : undefined;
            }
            if (!node || typeof node !== 'object') return undefined;
            const o = node as Record<string, unknown>;
            if ('$value' in o && o.$value != null) {
                const inner = walk(o.$value);
                if (inner) return inner;
            }
            for (const k of Object.keys(o)) {
                if (k === '$type') continue;
                const inner = walk(o[k]);
                if (inner) return inner;
            }
            return undefined;
        };

        return walk(properties);
    }

    private parseIdentityFromItem(item: Record<string, unknown>): IIdentity | null {
        const id = item.id as string | undefined;
        const providerName = (item.providerDisplayName as string) || (item.customDisplayName as string);
        if (!id || !providerName) {
            return null;
        }

        const props = item.properties;
        const account = this.readProp(item, 'Account');
        const upn =
            this.readProp(item, 'Microsoft.TeamFoundation.Identity.UserPrincipalName') ||
            this.readProp(item, 'UserPrincipalName');
        const mailFromProp =
            this.readProp(item, 'Mail') ||
            (account && this.isLikelyEmail(account) ? account : undefined) ||
            this.extractEmailFromProperties(props);

        const uniqueFromRoot = typeof item.uniqueName === 'string' ? item.uniqueName : undefined;
        const mailFromRoot = uniqueFromRoot && this.isLikelyEmail(uniqueFromRoot) ? uniqueFromRoot : undefined;

        const mailAddress = mailFromProp || mailFromRoot;

        let imageUrl: string | undefined;
        const directImg = item.imageUrl as string | undefined;
        if (typeof directImg === 'string' && directImg.startsWith('http')) {
            imageUrl = directImg;
        } else {
            const fromProp =
                this.readProp(item, 'Microsoft.TeamFoundation.Identity.Image.Url') ||
                this.readProp(item, 'ImageUrl');
            if (fromProp?.startsWith('http')) {
                imageUrl = fromProp;
            }
        }

        const uniqueName =
            uniqueFromRoot ||
            account ||
            upn ||
            (item.descriptor as string | undefined);

        return {
            id,
            displayName: providerName,
            uniqueName,
            imageUrl,
            mailAddress: mailAddress || undefined,
            principalName: upn || mailAddress,
        };
    }

    private mergeIdentity(existing: IIdentity | undefined, incoming: IIdentity): IIdentity {
        if (!existing) return incoming;
        return {
            ...existing,
            ...incoming,
            displayName: existing.displayName || incoming.displayName,
            mailAddress: incoming.mailAddress || existing.mailAddress,
            principalName: incoming.principalName || existing.principalName,
            imageUrl: incoming.imageUrl || existing.imageUrl,
            uniqueName: incoming.uniqueName || existing.uniqueName,
        };
    }

    private getOrgName(): string {
        if (this.wikiContext.org) {
            return this.wikiContext.org;
        }
        const host = window.location.hostname;
        const path = window.location.pathname;
        const parts = path.split('/').filter((p) => p);

        if (host.includes('dev.azure.com') && parts.length >= 1) {
            return parts[0];
        }
        if (host.includes('visualstudio.com')) {
            const sub = host.split('.')[0];
            if (sub && sub !== 'www') {
                return sub;
            }
        }
        return '';
    }

    private getOrgUrl(): string {
        const name = this.getOrgName();
        return name ? `/${name}` : '';
    }

    /**
     * Resolve storage key (VSID) → Graph subject descriptor (vssps).
     */
    private async fetchGraphDescriptor(storageKey: string): Promise<string | null> {
        const org = this.getOrgName();
        if (!org) return null;
        const url = `https://vssps.dev.azure.com/${encodeURIComponent(
            org
        )}/_apis/graph/descriptors/${encodeURIComponent(storageKey)}?api-version=7.1`;
        const res = await this.adoFetch(url);
        if (!res.ok) {
            return null;
        }
        const data = (await res.json()) as { value?: string; descriptor?: string };
        if (typeof data.value === 'string') {
            return data.value;
        }
        if (typeof data.descriptor === 'string') {
            return data.descriptor;
        }
        return null;
    }

    /**
     * Graph user — includes authoritative mailAddress for org members.
     */
    private async fetchGraphUser(descriptor: string): Promise<IIdentity | null> {
        const org = this.getOrgName();
        if (!org) return null;
        const url = `https://vssps.dev.azure.com/${encodeURIComponent(org)}/_apis/graph/users/${encodeURIComponent(
            descriptor
        )}?api-version=7.1-preview.1`;
        const res = await this.adoFetch(url);
        if (!res.ok) {
            return null;
        }
        const u = (await res.json()) as {
            displayName?: string;
            mailAddress?: string;
            principalName?: string;
        };
        const mail = u.mailAddress?.trim();
        const principal = u.principalName?.trim();
        return {
            id: '',
            displayName: u.displayName || '',
            mailAddress: mail && this.isLikelyEmail(mail) ? mail : undefined,
            principalName: principal,
            uniqueName: principal || mail,
        };
    }

    private async enrichIdentityFromGraph(storageKey: string): Promise<void> {
        const org = this.getOrgName();
        if (!org) {
            return;
        }
        try {
            const descriptor = await this.fetchGraphDescriptor(storageKey);
            if (!descriptor) {
                return;
            }
            const graph = await this.fetchGraphUser(descriptor);
            if (!graph) {
                return;
            }
            const prev = this.cache.get(storageKey);
            const merged: IIdentity = this.mergeIdentity(prev, {
                ...graph,
                id: storageKey,
                displayName: prev?.displayName || graph.displayName || '',
                mailAddress: graph.mailAddress || prev?.mailAddress,
                principalName: graph.principalName || prev?.principalName,
            });
            this.cache.set(storageKey, merged);
        } catch (e) {
            console.warn('Mention profile: Graph enrich failed', e);
        }
    }

    private async fetchIdentities(guids: string[]): Promise<void> {
        const orgUrl = this.getOrgUrl();
        const url = `${orgUrl}/_apis/identities?api-version=6.0`;

        try {
            const chunks = this.chunkArray(guids, 20);

            for (const chunk of chunks) {
                const queryUrl = `${url}&identityIds=${chunk.join(',')}`;

                const response = await this.adoFetch(queryUrl);
                if (!response.ok) {
                    console.warn(`Failed to fetch identities: ${response.status} ${response.statusText}`);
                    continue;
                }

                const data = (await response.json()) as { value?: Record<string, unknown>[] };
                if (data?.value) {
                    for (const item of data.value) {
                        const parsed = this.parseIdentityFromItem(item);
                        if (!parsed) continue;

                        const prev = this.cache.get(parsed.id);
                        const merged = this.mergeIdentity(prev, parsed);
                        this.cache.set(parsed.id, merged);
                        this.getMangledName(merged);
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching identities', e);
        }
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const result: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
    }
}
