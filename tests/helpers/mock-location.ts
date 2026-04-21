/** Happy DOM forbids cross-origin `history.replaceState`; stub `window.location` instead. */
export function setWindowLocation(href: string): void {
    const url = new URL(href);
    const loc = {
        href: url.href,
        pathname: url.pathname,
        search: url.search,
        origin: url.origin,
        assign: () => {},
        replace: () => {},
        reload: () => {},
        toString: () => url.href,
    } as unknown as Location;
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: loc,
        writable: true,
    });
}
