/**
 * ADO Syntax Extensions - Main Export
 * 
 * Combines all ADO-specific syntax extensions into a single plugin array.
 */

import { adoTocPlugin } from './ado-toc-node';
import { adoTospPlugin } from './ado-tosp-node';
import { adoWorkItemPlugin } from './ado-work-item-mark';
import { adoMentionPlugin } from './ado-mention-mark';
import { taskListPlugin } from './task-list-plugin';
import { adoHtmlPlugin } from './ado-html-node';

/**
 * Complete ADO syntax plugin
 * 
 * Usage:
 * ```typescript
 * import { adoSyntaxPlugin } from './syntax';
 * 
 * Editor.make()
 *   .use(commonmark)
 *   .use(gfm)
 *   .use(adoSyntaxPlugin)
 *   .create();
 * ```
 */
export const adoSyntaxPlugin = [
  ...adoTocPlugin,
  ...adoTospPlugin,
  ...adoWorkItemPlugin,
  ...adoMentionPlugin,
  ...taskListPlugin,
  ...adoHtmlPlugin,
];

// Individual exports for selective use
export { adoTocPlugin } from './ado-toc-node';
export { adoTospPlugin } from './ado-tosp-node';
export { adoWorkItemPlugin } from './ado-work-item-mark';
export { adoMentionPlugin } from './ado-mention-mark';
export { taskListPlugin } from './task-list-plugin';
export { adoHtmlPlugin, insertHtmlBlockCommand } from './ado-html-node';
