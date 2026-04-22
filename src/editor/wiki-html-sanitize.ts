/**
 * Strip dangerous tags/attributes before `innerHTML` (ADO-style paste).
 * Not a full CSP policy — prefer server-side sanitization for published wiki.
 */
export function sanitizeWikiHtml(html: string): string {
    const trimmed = html.trim();
    if (!trimmed) return '';
    if (typeof DOMParser === 'undefined') {
        return trimmed.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    }
    const doc = new DOMParser().parseFromString(trimmed, 'text/html');
    doc.querySelectorAll('script, style, iframe, object, embed, link[rel="import"], meta[http-equiv]').forEach((el) => el.remove());
    doc.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            const n = attr.name.toLowerCase();
            if (n.startsWith('on')) el.removeAttribute(attr.name);
            if ((n === 'href' || n === 'src' || n === 'xlink:href') && /^\s*javascript:/i.test(attr.value)) {
                el.removeAttribute(attr.name);
            }
        }
    });
    return doc.body.innerHTML;
}
