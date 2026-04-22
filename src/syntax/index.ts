import { adoMentionPlugin } from './ado-mention-mark';
import { adoTocPlugin } from './ado-toc-node';
import { adoTospPlugin } from './ado-tosp-node';
import { adoWorkItemPlugin } from './ado-work-item-mark';

/** Milkdown plugins for ADO wiki markers (TOC, mentions, work items, …). */
export const adoSyntaxPlugin = [...adoTocPlugin, ...adoTospPlugin, ...adoMentionPlugin, ...adoWorkItemPlugin].flat();
