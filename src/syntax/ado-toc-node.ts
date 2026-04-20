/**
 * ADO Table of Contents Node
 * 
 * Parses [[_TOC_]] marker and renders as a live TOC widget.
 * Serializes back to [[_TOC_]] in markdown.
 */

import { $node, $remark, $view } from '@milkdown/kit/utils';
import type { Node } from '@milkdown/kit/prose/model';
import { adoWikiHeadingAnchorsFromPlainTexts } from '../ado-wiki-api';

interface HeadingInfo {
  level: number;
  text: string;
  /** Encoded fragment for `href="#..."` */
  fragment: string;
}

/**
 * Remark plugin to parse [[_TOC_]] during markdown parsing
 * 
 * Note: Remark parses [[_TOC_]] as three nodes: text "[[", emphasis "_TOC_", text "]]"
 * because underscores are interpreted as emphasis markers. We need to detect this pattern
 * and replace the ENTIRE PARAGRAPH with an adoToc node (since adoToc is a block-level node).
 */
export const remarkAdoToc = $remark('remarkAdoToc', () => {
  return () => {
    return (tree: any) => {
      // We need to replace entire paragraphs, not just inline content
      visitParent(tree, (node: any, index: number, parent: any) => {
        if (node.type !== 'paragraph' || !parent || index === undefined) return;
        if (!node.children || node.children.length === 0) return;
        
        const children = node.children;
        
        // Check for pattern: text "[[" + emphasis with "TOC" + text "]]"
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
            second.children[0].value === 'TOC' &&
            third.type === 'text' && third.value === ']]'
          ) {
            // Replace the entire paragraph with adoToc node
            parent.children[index] = { type: 'adoToc' };
            return;
          }
        }
        
        // Also check for single text node with [[_TOC_]] (in case emphasis wasn't applied)
        if (children.length === 1 && children[0].type === 'text') {
          if (children[0].value?.trim() === '[[_TOC_]]') {
            parent.children[index] = { type: 'adoToc' };
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
 * ProseMirror node schema for TOC
 */
export const adoTocNode = $node('adoToc', () => ({
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  defining: true,
  isolating: true,
  
  parseDOM: [{
    tag: 'div.ado-toc-widget',
  }],
  
  toDOM: () => ['div', { class: 'ado-toc-widget', contenteditable: 'false' }],
  
  parseMarkdown: {
    match: (node: any) => node.type === 'adoToc',
    runner: (state: any, _node: any, type: any) => {
      state.addNode(type);
    },
  },
  
  toMarkdown: {
    match: (node: Node) => node.type.name === 'adoToc',
    runner: (state: any) => {
      state.addNode('paragraph', undefined, undefined, {
        children: [{ type: 'text', value: '[[_TOC_]]' }],
      });
    },
  },
}));

function buildTocHtml(headings: HeadingInfo[]): string {
  if (headings.length === 0) {
    return '<div class="ado-toc-empty">No headings found</div>';
  }
  
  // Build nested <ul> hierarchy based on heading levels
  return buildNestedTocHtml(headings);
}

/**
 * Build nested <ul> structure based on heading levels.
 * Matches ADO's nesting pattern where nested <ul> is inside parent <li>:
 * <ul>
 *   <li><a>Parent</a>
 *     <ul>
 *       <li><a>Child</a></li>
 *     </ul>
 *   </li>
 * </ul>
 */
function buildNestedTocHtml(headings: HeadingInfo[]): string {
  if (headings.length === 0) return '';
  
  const result: string[] = [];
  const levelStack: number[] = []; // Track open levels
  
  result.push('<ul class="ado-toc-list">');
  
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const level = heading.level;
    
    if (levelStack.length === 0) {
      // First heading
      result.push(`<li><a href="#${heading.fragment}" class="ado-toc-link">${escapeHtml(heading.text)}</a>`);
      levelStack.push(level);
    } else {
      const prevLevel = levelStack[levelStack.length - 1];
      
      if (level > prevLevel) {
        // Going deeper - open nested <ul> inside current <li> (don't close <li> yet)
        result.push('<ul class="ado-toc-list">');
        result.push(`<li><a href="#${heading.fragment}" class="ado-toc-link">${escapeHtml(heading.text)}</a>`);
        levelStack.push(level);
      } else if (level < prevLevel) {
        // Going up - close items until we reach the right level
        while (levelStack.length > 0 && levelStack[levelStack.length - 1] > level) {
          result.push('</li>'); // Close the <li>
          result.push('</ul>'); // Close the nested <ul>
          levelStack.pop();
        }
        // Close the sibling at this level and start new one
        if (levelStack.length > 0) {
          result.push('</li>');
          levelStack.pop();
        }
        result.push(`<li><a href="#${heading.fragment}" class="ado-toc-link">${escapeHtml(heading.text)}</a>`);
        levelStack.push(level);
      } else {
        // Same level - close previous <li> and start new one
        result.push('</li>');
        levelStack.pop();
        result.push(`<li><a href="#${heading.fragment}" class="ado-toc-link">${escapeHtml(heading.text)}</a>`);
        levelStack.push(level);
      }
    }
  }
  
  // Close all remaining open elements
  while (levelStack.length > 0) {
    result.push('</li>');
    levelStack.pop();
    if (levelStack.length > 0) {
      result.push('</ul>');
    }
  }
  
  result.push('</ul>');
  
  return result.join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Custom node view for TOC with live heading preview
 */
export const adoTocView = $view(adoTocNode, () => {
  return (_node, view, getPos) => {
    const dom = document.createElement('div');
    dom.className = 'ado-toc-widget';
    dom.contentEditable = 'false';
    dom.setAttribute('role', 'navigation');
    dom.setAttribute('aria-label', 'Table of contents');
    
    const header = document.createElement('div');
    header.className = 'ado-widget-header';
    
    const title = document.createElement('span');
    title.className = 'ado-toc-title';
    title.textContent = 'Contents';
    header.appendChild(title);
    
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'ado-widget-buttons';
    
    // Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'ado-widget-refresh';
    refreshBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
    </svg>`;
    refreshBtn.title = 'Refresh Table of Contents';
    refreshBtn.type = 'button';
    refreshBtn.setAttribute('aria-label', 'Refresh Table of Contents');
    buttonGroup.appendChild(refreshBtn);
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ado-widget-delete';
    deleteBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
      <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg>`;
    deleteBtn.title = 'Remove Table of Contents';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', 'Remove Table of Contents');
    buttonGroup.appendChild(deleteBtn);
    
    header.appendChild(buttonGroup);
    dom.appendChild(header);
    
    const content = document.createElement('div');
    content.className = 'ado-toc-content';
    dom.appendChild(content);
    
    const updateHeadings = () => {
      const levels: number[] = [];
      const texts: string[] = [];
      view.state.doc.descendants((node) => {
        if (node.type.name === 'heading') {
          const text = node.textContent;
          levels.push(node.attrs.level as number);
          texts.push(text);
        }
      });
      const parts = adoWikiHeadingAnchorsFromPlainTexts(texts);
      const headings: HeadingInfo[] = levels.map((level, i) => ({
        level,
        text: texts[i],
        fragment: parts[i].fragment,
      }));
      content.innerHTML = buildTocHtml(headings);
    };
    
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateHeadings();
    });
    
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
    
    updateHeadings();
    
    return {
      dom,
      update: (updatedNode) => {
        if (updatedNode.type.name !== 'adoToc') return false;
        updateHeadings();
        return true;
      },
      destroy: () => {},
      ignoreMutation: () => true,
    };
  };
});

export const adoTocPlugin = [
  remarkAdoToc,
  adoTocNode,
  adoTocView,
].flat();
