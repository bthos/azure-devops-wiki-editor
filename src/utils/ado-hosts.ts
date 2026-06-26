/**
 * Maps the current wiki page host to Identity / Graph (SPS) API origins.
 * Hosted orgs with a **custom / vanity domain** still use the global SPS host for IMS;
 * Azure DevOps Server keeps IMS on the same origin as the web app.
 *
 * Chrome `host_permissions` / `optional_host_permissions` must allow these origins;
 * see `public/manifest.json`.
 */

/** Hosted Azure DevOps Services (SPS) — see Microsoft Learn (IMS / Graph). */
const HOST_VSSPS_CLOUD = 'vssps.dev.azure.com';
/** Legacy `*.visualstudio.com` accounts. */
const HOST_VSSPS_LEGACY = 'vssps.visualstudio.com';

function hostnameLower(): string {
    if (typeof window === 'undefined') {
        return '';
    }
    const { hostname, href } = window.location;
    if (hostname) {
        return hostname.toLowerCase();
    }
    try {
        return new URL(href).hostname.toLowerCase();
    } catch {
        return '';
    }
}

/** Cloud: org is the first path segment (`/{org}/{project}/...`). */
export function isHostedDevAzureCloud(hostname: string): boolean {
    const h = hostname.toLowerCase();
    return h === 'dev.azure.com' || h.endsWith('.dev.azure.com');
}

/** Legacy: org is often the subdomain (`{account}.visualstudio.com`). */
export function isLegacyVisualStudioHost(hostname: string): boolean {
    return hostname.toLowerCase().endsWith('.visualstudio.com');
}

/**
 * Origin for IMS Read Identities, Graph descriptors/users, etc.
 * Uses the page's `protocol`; falls back to {@link window.location.origin} for Server / dedicated hosts.
 */
export function getIdentityServiceOrigin(): string {
    if (typeof window === 'undefined') {
        return '';
    }
    const { protocol, origin } = window.location;
    const host = hostnameLower();
    if (isHostedDevAzureCloud(host)) {
        return `${protocol}//${HOST_VSSPS_CLOUD}`;
    }
    if (isLegacyVisualStudioHost(host)) {
        return `${protocol}//${HOST_VSSPS_LEGACY}`;
    }
    return origin;
}

/**
 * Origins to try for IMS / Graph when resolving mentions (404-safe order).
 * - Known cloud / legacy hosts: single deterministic SPS origin.
 * - Custom domain, reverse proxy, or Server: try wiki **origin** first, then hosted cloud SPS
 *   (vanity URLs still resolve identities under `/{org}/_apis/...` on `vssps.dev.azure.com`).
 */
export function getIdentityServiceCandidateOrigins(): string[] {
    if (typeof window === 'undefined') {
        return [];
    }
    const { protocol, origin } = window.location;
    const host = hostnameLower();
    if (isHostedDevAzureCloud(host)) {
        return [`${protocol}//${HOST_VSSPS_CLOUD}`];
    }
    if (isLegacyVisualStudioHost(host)) {
        return [`${protocol}//${HOST_VSSPS_LEGACY}`];
    }
    const cloudSps = `${protocol}//${HOST_VSSPS_CLOUD}`;
    const candidates = [origin];
    if (cloudSps !== origin && !candidates.includes(cloudSps)) {
        candidates.push(cloudSps);
    }
    return candidates;
}
