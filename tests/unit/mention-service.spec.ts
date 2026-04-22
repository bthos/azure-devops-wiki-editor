// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IWikiContext } from '../../src/services/attachment-service';
import { AdoMentionService } from '../../src/services/mention-service';
import { getIdentityServiceCandidateOrigins } from '../../src/utils/ado-hosts';
import { setWindowLocation } from '../helpers/mock-location';

const ALICE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const BOB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function wikiCtx(over: Partial<IWikiContext> = {}): IWikiContext {
    return {
        org: 'MyOrg',
        projectId: 'MyProject',
        wikiId: 'MyWiki',
        ...over,
    };
}

describe('AdoMentionService.fetchProjectTeamMembers', () => {
    beforeEach(() => {
        setWindowLocation('https://dev.azure.com/MyOrg/MyProject/_wiki/ws/1/page');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns empty list and does not fetch without projectId', async () => {
        const svc = new AdoMentionService(wikiCtx({ projectId: undefined }));
        const spy = vi.spyOn(globalThis, 'fetch');
        await expect(svc.fetchProjectTeamMembers()).resolves.toEqual([]);
        expect(spy).not.toHaveBeenCalled();
    });

    it('returns empty list when teams request is not ok', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
        const svc = new AdoMentionService(wikiCtx());
        await expect(svc.fetchProjectTeamMembers()).resolves.toEqual([]);
    });

    it('calls organization-scoped Core URLs (no /{org}/{project}/_apis/)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ value: [] }));
        const svc = new AdoMentionService(wikiCtx());
        await svc.fetchProjectTeamMembers();
        const teamsUrl = String(vi.mocked(fetch).mock.calls[0][0]);
        expect(teamsUrl).toMatch(/^https:\/\/dev\.azure\.com\/MyOrg\/_apis\/projects\/MyProject\/teams\?/);
        expect(teamsUrl).not.toContain('/MyOrg/MyProject/_apis/');
    });

    it('merges members across teams, dedupes by id, and sorts by displayName', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
            const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            if (u.includes('/_apis/projects/MyProject/teams?')) {
                return Response.json({ value: [{ id: 't1' }, { id: 't2' }] });
            }
            if (u.includes('/teams/t1/members?')) {
                return Response.json({
                    value: [
                        { identity: { id: BOB, displayName: 'Bob', uniqueName: 'bob@corp.test' } },
                        { identity: { id: ALICE, displayName: 'Alice', uniqueName: 'alice@corp.test' } },
                    ],
                });
            }
            if (u.includes('/teams/t2/members?')) {
                return Response.json({
                    value: [{ identity: { id: ALICE, displayName: 'Alice', uniqueName: 'alice@corp.test' } }],
                });
            }
            throw new Error(`unexpected fetch: ${u}`);
        });

        const svc = new AdoMentionService(wikiCtx());
        const members = await svc.fetchProjectTeamMembers();
        expect(members.map((m) => m.id)).toEqual([ALICE, BOB]);
        expect(members.find((m) => m.id === ALICE)?.mailAddress).toBe('alice@corp.test');
    });

    it('respects maxTeams when requesting member lists', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
            const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            if (u.includes('/teams?')) {
                return Response.json({
                    value: [{ id: 'ta' }, { id: 'tb' }, { id: 'tc' }],
                });
            }
            if (u.includes('/members?')) {
                return Response.json({ value: [] });
            }
            throw new Error(`unexpected fetch: ${u}`);
        });

        const svc = new AdoMentionService(wikiCtx());
        await svc.fetchProjectTeamMembers({ maxTeams: 2 });
        const urls = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
        expect(urls.filter((x) => x.includes('/members?'))).toHaveLength(2);
    });
});

describe('AdoMentionService.resolveMentions', () => {
    beforeEach(() => {
        setWindowLocation('https://dev.azure.com/MyOrg/MyProject/_wiki/wikis/w');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loads identities from SPS IMS host (not wiki-origin relative path)', async () => {
        const guid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({
                value: [{ id: guid, providerDisplayName: 'Zed User', properties: {} }],
            }),
        );
        const svc = new AdoMentionService(wikiCtx());
        const out = await svc.resolveMentions(`Hi @<${guid}>!`);
        expect(out).toBe('Hi @<Zed User>!');
        const primary = getIdentityServiceCandidateOrigins()[0];
        const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
        expect(urls.some((u) => u.startsWith(`${primary}/MyOrg/_apis/identities?`))).toBe(true);
        expect(urls.some((u) => u.includes('identityIds=') && u.includes(guid))).toBe(true);
    });

    it('retries IMS on hosted SPS when custom wiki origin returns 404', async () => {
        setWindowLocation('https://ado.contoso.com/MyOrg/MyProject/_wiki/wikis/w');
        const guid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
            const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            if (u.includes('ado.contoso.com') && u.includes('/_apis/identities')) {
                return new Response('', { status: 404 });
            }
            if (u.startsWith('https://vssps.dev.azure.com/MyOrg/_apis/identities')) {
                return Response.json({
                    value: [{ id: guid, providerDisplayName: 'Vanity User', properties: {} }],
                });
            }
            throw new Error(`unexpected fetch: ${u}`);
        });
        const svc = new AdoMentionService(wikiCtx());
        const out = await svc.resolveMentions(`Hi @<${guid}>!`);
        expect(out).toBe('Hi @<Vanity User>!');
        expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});

describe('AdoMentionService.prepareMentionFromTeamMember', () => {
    beforeEach(() => {
        setWindowLocation('https://dev.azure.com/MyOrg/MyProject/_wiki/ws/1/page');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('registers identity so restoreMentions maps display label to GUID', () => {
        const svc = new AdoMentionService(wikiCtx());
        const label = svc.prepareMentionFromTeamMember({
            id: ALICE,
            displayName: 'Alice',
            uniqueName: 'alice@corp.test',
            mailAddress: 'alice@corp.test',
        });
        expect(label).toBe('Alice');
        expect(svc.restoreMentions(`Hello @<${label}> there`)).toBe(`Hello @<${ALICE}> there`);
    });

    it('returns null for non-GUID id', () => {
        const svc = new AdoMentionService(wikiCtx());
        expect(
            svc.prepareMentionFromTeamMember({
                id: 'not-a-guid',
                displayName: 'X',
            }),
        ).toBeNull();
    });
});
