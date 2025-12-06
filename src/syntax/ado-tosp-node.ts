/**
 * ADO Table of Sub-Pages Node
 * 
 * Parses [[_TOSP_]] marker and renders as a placeholder widget.
 * Serializes back to [[_TOSP_]] in markdown.
 */

import { $node, $remark, $view } from '@milkdown/kit/utils';
import type { Node } from '@milkdown/kit/prose/model';

/**
 * Remark plugin to parse [[_TOSP_]] during markdown parsing
 * 
 * Note: Remark parses [[_TOSP_]] as three nodes: text "[[", emphasis "_TOSP_", text "]]"
 * because underscores are interpreted as emphasis markers. We need to detect this pattern
 * and replace the ENTIRE PARAGRAPH with an adoTosp node (since adoTosp is a block-level node).
 */
export const remarkAdoTosp = $remark('remarkAdoTosp', () => {
  return () => {
    return (tree: any) => {
      // We need to replace entire paragraphs, not just inline content
      visitParent(tree, (node: any, index: number, parent: any) => {
        if (node.type !== 'paragraph' || !parent || index === undefined) return;
        if (!node.children || node.children.length === 0) return;
        
        const children = node.children;
        
        // Check for pattern: text "[[" + emphasis with "TOSP" + text "]]"
        // This should be the ONLY content in the paragraph
        if (children.length === 3) {
          const first = children[0];
          const second = children[1];
          const third = children[2];
          
          if (
            first.type === 'text' && first.value === '[[' &&
            second.type === 'emphasis' && 
            second.children?.length === 1 &&
            second.children[0].type === 'text' &&
            second.children[0].value === 'TOSP' &&
            third.type === 'text' && third.value === ']]'
          ) {
            // Replace the entire paragraph with adoTosp node
            parent.children[index] = { type: 'adoTosp' };
            return;
          }
        }
        
        // Also check for single text node with [[_TOSP_]] (in case emphasis wasn't applied)
        if (children.length === 1 && children[0].type === 'text') {
          if (children[0].value?.trim() === '[[_TOSP_]]') {
            parent.children[index] = { type: 'adoTosp' };
            return;
          }
        }
      });
    };
  };
});

/**
 * Visit nodes with parent context
 */
function visitParent(tree: any, callback: (node: any, index: number, parent: any) => void) {
  function visit(node: any, index: number | null, parent: any) {
    if (index !== null && parent) {
      callback(node, index, parent);
    }
    if (node.children) {
      // Iterate in reverse to safely modify array while iterating
      for (let i = node.children.length - 1; i >= 0; i--) {
        visit(node.children[i], i, node);
      }
    }
  }
  visit(tree, null, null);
}

/**
 * ProseMirror node schema for TOSP
 */
export const adoTospNode = $node('adoTosp', () => ({
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  defining: true,
  
  parseDOM: [{
    tag: 'div.ado-tosp-widget',
  }],
  
  toDOM: () => ['div', { class: 'ado-tosp-widget', contenteditable: 'false' }],
  
  parseMarkdown: {
    match: (node: any) => node.type === 'adoTosp',
    runner: (state: any, _node: any, type: any) => {
      state.addNode(type);
    },
  },
  
  toMarkdown: {
    match: (node: Node) => node.type.name === 'adoTosp',
    runner: (state: any) => {
      state.addNode('paragraph', undefined, undefined, {
        children: [{ type: 'text', value: '[[_TOSP_]]' }],
      });
    },
  },
}));

/**
 * Custom node view for TOSP
 */
export const adoTospView = $view(adoTospNode, () => {
  return (_node, view, getPos) => {
    const dom = document.createElement('div');
    dom.className = 'ado-tosp-widget';
    dom.contentEditable = 'false';
    dom.setAttribute('aria-label', 'Table of sub-pages');
    
    const header = document.createElement('div');
    header.className = 'ado-widget-header';
    
    const title = document.createElement('span');
    title.className = 'ado-tosp-title';
    title.textContent = 'Child Pages';
    header.appendChild(title);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ado-widget-delete';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Remove Child Pages';
    deleteBtn.type = 'button';
    header.appendChild(deleteBtn);
    
    dom.appendChild(header);
    
    const placeholder = document.createElement('div');
    placeholder.className = 'ado-tosp-placeholder';
    placeholder.textContent = 'Sub-pages will appear here';
    dom.appendChild(placeholder);
    
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = getPos();
      if (pos !== undefined) {
        const tr = view.state.tr.delete(pos, pos + 1);
        view.dispatch(tr);
        view.focus();
      }
    });
    
    return {
      dom,
      update: (updatedNode) => updatedNode.type.name === 'adoTosp',
      destroy: () => {},
      ignoreMutation: () => true,
    };
  };
});

export const adoTospPlugin = [
  remarkAdoTosp,
  adoTospNode,
  adoTospView,
].flat();
