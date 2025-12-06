/**
 * ADO Work Item Reference Mark
 * 
 * Parses #123456 and renders as a styled span.
 * Serializes back to #123456 in markdown.
 */

import { $mark, $remark, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import type { Mark } from '@milkdown/kit/prose/model';

/**
 * Remark plugin to parse #workitem references
 */
export const remarkWorkItem = $remark('remarkWorkItem', () => {
  return () => {
    return (tree: any) => {
      visitTextNodes(tree, (node: any, index: number, parent: any) => {
        if (!parent || index === undefined || !node.value) return;
        
        const regex = /#(\d{2,})\b/g;
        const value = node.value;
        const matches: any[] = [];
        let lastIndex = 0;
        let match;
        
        while ((match = regex.exec(value)) !== null) {
          if (match.index > lastIndex) {
            matches.push({
              type: 'text',
              value: value.slice(lastIndex, match.index),
            });
          }
          matches.push({
            type: 'workItemRef',
            data: { workItemId: match[1] },
            children: [{ type: 'text', value: match[0] }],
          });
          lastIndex = match.index + match[0].length;
        }
        
        if (matches.length > 0) {
          if (lastIndex < value.length) {
            matches.push({ type: 'text', value: value.slice(lastIndex) });
          }
          parent.children.splice(index, 1, ...matches);
        }
      });
    };
  };
});

function visitTextNodes(tree: any, callback: (node: any, index: number, parent: any) => void) {
  function visit(node: any, index: number | null, parent: any) {
    if (node.type === 'text') {
      callback(node, index as number, parent);
    }
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        visit(node.children[i], i, node);
      }
    }
  }
  visit(tree, null, null);
}

/**
 * Mark schema for work item references
 */
export const workItemMark = $mark('workItemRef', () => ({
  attrs: {
    workItemId: { default: '' },
  },
  
  parseDOM: [{
    tag: 'span.ado-work-item-ref',
    getAttrs: (dom: HTMLElement) => ({
      workItemId: dom.dataset.workItemId || '',
    }),
  }],
  
  toDOM: (mark: Mark) => [
    'span',
    {
      class: 'ado-work-item-ref',
      'data-work-item-id': mark.attrs.workItemId,
      title: `Work Item #${mark.attrs.workItemId}`,
    },
    0,
  ],
  
  parseMarkdown: {
    match: (node: any) => node.type === 'workItemRef',
    runner: (state: any, node: any, type: any) => {
      state.openMark(type, { workItemId: node.data?.workItemId });
      state.next(node.children);
      state.closeMark(type);
    },
  },
  
  toMarkdown: {
    match: (mark: Mark) => mark.type.name === 'workItemRef',
    runner: (state: any, mark: Mark) => {
      state.withMark(mark, 'text');
    },
  },
}));

/**
 * Input rule: typing #123 followed by space creates work item reference
 */
export const workItemInputRule = $inputRule((ctx) => {
  return new InputRule(
    /#(\d{2,})(\s)$/,
    (state, match, start, end) => {
      const workItemId = match[1];
      const markType = workItemMark.type(ctx);
      
      // Insert #id with mark, then the space without mark
      const tr = state.tr
        .delete(start, end)
        .insertText(`#${workItemId} `, start);
      
      tr.addMark(start, start + workItemId.length + 1, markType.create({ workItemId }));
      
      return tr;
    }
  );
});

export const adoWorkItemPlugin = [
  remarkWorkItem,
  workItemMark,
  workItemInputRule,
].flat();
