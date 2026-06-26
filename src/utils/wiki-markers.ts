/**
 * Pure string transforms for Azure DevOps wiki markdown markers.
 * Shared by the content script and tests; future ProseMirror editor sync can import the same helpers.
 */

/**
 * Preprocess markdown so @<user> mentions are not parsed as HTML.
 * Converts @<user> to @‹user› (U+2039 / U+203A).
 */
export function preprocessMentions(content: string): string {
    return content.replace(/@<([^>]+)>/g, '@‹$1›');
}

/**
 * Restore ADO wiki markers after markdown serialization (inverse of preprocess + escaped TOC/TOSP).
 */
export function postprocessAdoMarkers(content: string): string {
    return content
        .replace(/@‹([^›]+)›/g, '@<$1>')
        .replace(/\\</g, '<')
        .replace(/\\?\[\\?\[\\?_TOC\\?_\\?\]\\?\]/g, '[[_TOC_]]')
        .replace(/\\?\[\\?\[\\?_TOSP\\?_\\?\]\\?\]/g, '[[_TOSP_]]');
}
