/** Max diagram source length (characters) before refusing render. */
export const WIKI_MERMAID_MAX_SOURCE_CHARS = 128_000;

type MermaidModule = typeof import('mermaid');

let mermaidLoad: Promise<MermaidModule> | null = null;
let initializedForDark: boolean | null = null;

function loadMermaid(): Promise<MermaidModule> {
    if (!mermaidLoad) {
        mermaidLoad = import('mermaid');
    }
    return mermaidLoad;
}

/**
 * Initializes Mermaid once per light/dark mode (theme affects SVG palette).
 * `securityLevel: 'strict'` avoids unsafe diagram constructs; bundled only (MV3).
 */
export async function ensureMermaidInitialized(isDark: boolean): Promise<MermaidModule> {
    const mod = await loadMermaid();
    const m = mod.default;
    if (initializedForDark !== isDark) {
        m.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: isDark ? 'dark' : 'default',
        });
        initializedForDark = isDark;
    }
    return mod;
}

export type WikiMermaidRenderResult = { svg: string } | { error: string };

/**
 * Renders Mermaid source to an SVG string. Safe to call from a ProseMirror node view (catch errors).
 */
export async function renderMermaidSvg(diagramSource: string, isDark: boolean): Promise<WikiMermaidRenderResult> {
    const src = diagramSource.replace(/\r\n/g, '\n');
    if (src.length > WIKI_MERMAID_MAX_SOURCE_CHARS) {
        return { error: `Diagram exceeds ${WIKI_MERMAID_MAX_SOURCE_CHARS} characters` };
    }
    if (!src.trim()) {
        return { error: 'Empty diagram' };
    }
    try {
        const mod = await ensureMermaidInitialized(isDark);
        const id = `wiki-mmd-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
        const { svg } = await mod.default.render(id, src);
        return { svg };
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
}
