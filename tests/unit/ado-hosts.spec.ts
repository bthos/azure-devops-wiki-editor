// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import {
    getIdentityServiceCandidateOrigins,
    getIdentityServiceOrigin,
    isHostedDevAzureCloud,
    isLegacyVisualStudioHost,
} from '../../src/utils/ado-hosts';
import { setWindowLocation } from '../helpers/mock-location';

describe('ado-hosts', () => {
    it('detects hosted dev.azure.com cloud', () => {
        expect(isHostedDevAzureCloud('dev.azure.com')).toBe(true);
        expect(isHostedDevAzureCloud('foo.dev.azure.com')).toBe(true);
        expect(isHostedDevAzureCloud('contoso.visualstudio.com')).toBe(false);
    });

    it('detects legacy visualstudio.com', () => {
        expect(isLegacyVisualStudioHost('contoso.visualstudio.com')).toBe(true);
        expect(isLegacyVisualStudioHost('dev.azure.com')).toBe(false);
    });

    it('maps dev.azure.com page to cloud SPS origin', () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w');
        expect(getIdentityServiceOrigin()).toBe('https://vssps.dev.azure.com');
    });

    it('maps visualstudio.com page to legacy SPS origin', () => {
        setWindowLocation('https://fabrikam.visualstudio.com/DefaultCollection/_wiki/wikis/w');
        expect(getIdentityServiceOrigin()).toBe('https://vssps.visualstudio.com');
    });

    it('falls back to page origin for unknown hosts', () => {
        setWindowLocation('https://tfs.corp.local:8443/tfs/DefaultCollection/p/_wiki/wikis/w');
        expect(getIdentityServiceOrigin()).toBe('https://tfs.corp.local:8443');
    });

    it('preserves http protocol when page is http', () => {
        setWindowLocation('http://dev.azure.com/o/p/_wiki/wikis/w');
        expect(getIdentityServiceOrigin()).toBe('http://vssps.dev.azure.com');
    });

    it('returns single SPS origin on dev.azure.com for identity candidates', () => {
        setWindowLocation('https://dev.azure.com/o/p/_wiki/wikis/w');
        expect(getIdentityServiceCandidateOrigins()).toEqual(['https://vssps.dev.azure.com']);
    });

    it('returns wiki origin then cloud SPS for custom hostnames (vanity / proxy)', () => {
        setWindowLocation('https://ado.contoso.com/MyOrg/MyProject/_wiki/wikis/w');
        expect(getIdentityServiceCandidateOrigins()).toEqual([
            'https://ado.contoso.com',
            'https://vssps.dev.azure.com',
        ]);
    });
});
