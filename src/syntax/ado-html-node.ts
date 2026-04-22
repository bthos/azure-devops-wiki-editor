/**
 * Toolbar “HTML block” entry point for Milkdown.
 * A dedicated raw-HTML block node is not wired yet; inserting a code block is a safe placeholder.
 */
export { createCodeBlockCommand as insertHtmlBlockCommand } from '@milkdown/kit/preset/commonmark';
