/**
 * Remark / mdast stringify: Azure DevOps wiki attachment paths `/.attachments/...` must use
 * destination-literal (`<...>`) form. Otherwise mdast-util-to-markdown uses destinationRaw and
 * `state.safe(url, { after: ')' })` escapes `)` as `\)` (see lib/handle/image.js, unsafe.js).
 *
 * @see https://github.com/syntax-tree/mdast-util-to-markdown/blob/main/lib/handle/image.js
 */

import type { Image, Link, Parents } from 'mdast';
import type { Handle, State, Info } from 'mdast-util-to-markdown';
import { defaultHandlers } from 'mdast-util-to-markdown';
import { toString } from 'mdast-util-to-string';

/** Inlined from mdast-util-to-markdown (package only exports root). */
function checkQuote(state: State): '"' | "'" {
    const marker = state.options.quote || '"';
    if (marker !== '"' && marker !== "'") {
        throw new Error('Cannot serialize title: expected `"` or `\'` for options.quote');
    }
    return marker;
}

/** Inlined from mdast-util-to-markdown/lib/util/format-link-as-autolink.js */
function formatLinkAsAutolink(node: Link, state: State): boolean {
    const raw = toString(node);
    return Boolean(
        !state.options.resourceLink &&
            node.url &&
            !node.title &&
            node.children &&
            node.children.length === 1 &&
            node.children[0].type === 'text' &&
            (raw === node.url || 'mailto:' + raw === node.url) &&
            /^[a-z][a-z+.-]+:/i.test(node.url) &&
            !/[\0- <>\u007F]/.test(node.url)
    );
}

/** True for Azure DevOps wiki attachment paths (serialize with `<...>` destination). */
export function isAdoWikiAttachmentPath(url: string | undefined | null): boolean {
    return typeof url === 'string' && url.startsWith('/.attachments/');
}

/** Same branching as mdast image handler, but force `<url>` for `/.attachments/...`. */
export const adoWikiAttachmentImageHandler: Handle = Object.assign(
    function image(node: Image, _: Parents | undefined, state: State, info: Info): string {
        if (!isAdoWikiAttachmentPath(node.url)) {
            return defaultHandlers.image(node, _, state, info);
        }

        const quote = checkQuote(state);
        const suffix = quote === '"' ? 'Quote' : 'Apostrophe';
        const exit = state.enter('image');
        let subexit = state.enter('label');
        const tracker = state.createTracker(info);
        let value = tracker.move('![');
        value += tracker.move(
            state.safe(node.alt, { before: value, after: ']', ...tracker.current() })
        );
        value += tracker.move('](');

        subexit();

        subexit = state.enter('destinationLiteral');
        value += tracker.move('<');
        value += tracker.move(
            state.safe(node.url, { before: value, after: '>', ...tracker.current() })
        );
        value += tracker.move('>');

        subexit();

        if (node.title) {
            subexit = state.enter(`title${suffix}`);
            value += tracker.move(' ' + quote);
            value += tracker.move(
                state.safe(node.title, {
                    before: value,
                    after: quote,
                    ...tracker.current(),
                })
            );
            value += tracker.move(quote);
            subexit();
        }

        value += tracker.move(')');
        exit();

        return value;
    },
    { peek: () => '!' as const }
);

/** Same for inline links to attachment paths (non-image uploads). */
export const adoWikiAttachmentLinkHandler: Handle = Object.assign(
    function link(node: Link, _: Parents | undefined, state: State, info: Info): string {
        if (formatLinkAsAutolink(node, state)) {
            return defaultHandlers.link(node, _, state, info);
        }
        if (!isAdoWikiAttachmentPath(node.url)) {
            return defaultHandlers.link(node, _, state, info);
        }

        const quote = checkQuote(state);
        const suffix = quote === '"' ? 'Quote' : 'Apostrophe';
        const tracker = state.createTracker(info);
        let subexit: () => void;

        const exit = state.enter('link');
        subexit = state.enter('label');
        let value = tracker.move('[');
        value += tracker.move(
            state.containerPhrasing(node, {
                before: value,
                after: '](',
                ...tracker.current(),
            })
        );
        value += tracker.move('](');
        subexit();

        subexit = state.enter('destinationLiteral');
        value += tracker.move('<');
        value += tracker.move(
            state.safe(node.url, { before: value, after: '>', ...tracker.current() })
        );
        value += tracker.move('>');

        subexit();

        if (node.title) {
            subexit = state.enter(`title${suffix}`);
            value += tracker.move(' ' + quote);
            value += tracker.move(
                state.safe(node.title, {
                    before: value,
                    after: quote,
                    ...tracker.current(),
                })
            );
            value += tracker.move(quote);
            subexit();
        }

        value += tracker.move(')');

        exit();
        return value;
    },
    {
        peek(node: Link, _: Parents | undefined, state: State): string {
            return formatLinkAsAutolink(node, state) ? '<' : '[';
        },
    }
);
