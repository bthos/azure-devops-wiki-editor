/** Encode / decode UTF-8 for `data-html-inline` / `data-html-b64` on widget DOM (clipboard / parseDOM). */

export function utf8ToBase64(s: string): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(s, 'utf8').toString('base64');
    }
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]!);
    }
    return btoa(bin);
}

export function base64ToUtf8(b64: string): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(b64, 'base64').toString('utf8');
    }
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i)!;
    }
    return new TextDecoder().decode(bytes);
}
