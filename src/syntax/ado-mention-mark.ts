/**
 * ADO User Mention Mark
 * 
 * Parses @<user name> and renders as a styled mention.
 * Serializes back to @<user name> in markdown.
 */

import { $mark, $remark, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import type { Mark } from '@milkdown/kit/prose/model';

/**
 * Remark plugin to parse @<user> mentions
 */
export const remarkMention = $remark('remarkMention', () => {
  return () => {
    return (tree: any) => {
      visitTextNodes(tree, (node: any, index: number, parent: any) => {
        if (!parent || index === undefined || !node.value) return;
        
        const regex = /@<([^>]+)>/g;
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
            type: 'userMention',
            data: { userName: match[1] },
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
 * Mark schema for user mentions
 */
export const mentionMark = $mark('userMention', () => ({
  attrs: {
    userName: { default: '' },
  },
  
  parseDOM: [{
    tag: 'span.ado-mention',
    getAttrs: (dom: HTMLElement) => ({
      userName: dom.dataset.userName || '',
    }),
  }],
  
  toDOM: (mark: Mark) => [
    'span',
    {
      class: 'ado-mention',
      'data-user-name': mark.attrs.userName,
      title: `Mention: ${mark.attrs.userName}`,
    },
    0,
  ],
  
  parseMarkdown: {
    match: (node: any) => node.type === 'userMention',
    runner: (state: any, node: any, type: any) => {
      state.openMark(type, { userName: node.data?.userName });
      state.next(node.children);
      state.closeMark(type);
    },
  },
  
  toMarkdown: {
    match: (mark: Mark) => mark.type.name === 'userMention',
    runner: (state: any, mark: Mark) => {
      state.withMark(mark, 'text');
    },
  },
}));

/**
 * Input rule: typing @<name> followed by space creates mention
 */
export const mentionInputRule = $inputRule((ctx) => {
  return new InputRule(
    /@<([^>]+)>(\s)$/,
    (state, match, start, end) => {
      const userName = match[1];
      const markType = mentionMark.type(ctx);
      const fullText = `@<${userName}>`;
      
      const tr = state.tr
        .delete(start, end)
        .insertText(`${fullText} `, start);
      
      tr.addMark(start, start + fullText.length, markType.create({ userName }));
      
      return tr;
    }
  );
});

export const adoMentionPlugin = [
  remarkMention,
  mentionMark,
  mentionInputRule,
].flat();
