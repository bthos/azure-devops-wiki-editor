/**
 * ProseMirror `prosemirror-history` tuning for {@link ./wiki-editor.ts} (Option C — editor undo depth / grouping).
 *
 * - **depth** — keep more undo events than the default (100) for long wiki sessions.
 * - **newGroupDelay** — slightly longer window than default (500ms) so rapid edits stay in one undo step when adjacent.
 */

export const wikiEditorHistoryOptions = {
    depth: 200,
    newGroupDelay: 750,
} as const;
