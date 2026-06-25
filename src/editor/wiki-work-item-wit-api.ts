/**
 * Azure DevOps Work Item Tracking — fetch fields for inline preview (same cookies as wiki page).
 */

import { getWikiInfoFromUrl } from '../ado-wiki-api';

export type AdoWorkItemPreview = {
    id: string;
    title: string;
    state: string;
    workItemType: string;
};

/**
 * GET `…/_apis/wit/workitems/{id}?api-version=7.1` on the current origin.
 */
export async function fetchAdoWorkItemPreview(id: string, signal?: AbortSignal): Promise<AdoWorkItemPreview | null> {
    const trimmed = id.trim();
    if (!/^\d{2,}$/.test(trimmed)) {
        return null;
    }
    if (typeof window === 'undefined') {
        return null;
    }
    const info = getWikiInfoFromUrl();
    if (!info) {
        return null;
    }
    const base = window.location.origin;
    const url = `${base}/${encodeURIComponent(info.org)}/${encodeURIComponent(info.projectId)}/_apis/wit/workitems/${encodeURIComponent(trimmed)}?api-version=7.1`;
    const res = await fetch(url, {
        credentials: 'include',
        signal,
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
        return null;
    }
    let data: { fields?: Record<string, unknown> };
    try {
        data = (await res.json()) as { fields?: Record<string, unknown> };
    } catch {
        return null;
    }
    const f = data.fields ?? {};
    return {
        id: trimmed,
        title: String(f['System.Title'] ?? '').slice(0, 240),
        state: String(f['System.State'] ?? '').slice(0, 64),
        workItemType: String(f['System.WorkItemType'] ?? '').slice(0, 80),
    };
}
