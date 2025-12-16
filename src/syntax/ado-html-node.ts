/**
 * ADO HTML Block Node
 * 
 * Renders HTML content inline in the editor with an edit mode.
 * Serializes back to raw HTML in markdown.
 */

import { $node, $remark, $view, $command } from '@milkdown/kit/utils';
import type { Node } from '@milkdown/kit/prose/model';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { $inputRule } from '@milkdown/kit/utils';

/**
 * Remark plugin to parse HTML blocks during markdown parsing
 * 
 * Detects raw HTML blocks in the markdown content and converts them to adoHtml nodes.
 * Only converts HTML that is in a block context (direct child of root or other block containers).
 */
export const remarkAdoHtml = $remark('remarkAdoHtml', () => {
  return () => {
    return (tree: any) => {
      visitNodes(tree, (node: any, index: number, parent: any) => {
        // Match standalone HTML nodes
        if (node.type === 'html' && parent && index !== undefined) {
          // Only convert HTML that's in a block context (not inside paragraphs or other inline contexts)
          // Block contexts: root, blockquote, listItem, etc.
          const blockParentTypes = ['root', 'blockquote', 'listItem', 'tableCell', 'footnoteDefinition'];
          if (!blockParentTypes.includes(parent.type)) {
            // Parent is not a block context (e.g., it's a paragraph), skip conversion
            return;
          }
          
          const htmlContent = node.value || '';
          // Only convert block-level HTML (not inline fragments)
          if (htmlContent.trim().startsWith('<') && !isInlineHtml(htmlContent)) {
            parent.children[index] = {
              type: 'adoHtml',
              value: htmlContent,
            };
          }
        }
      });
    };
  };
});

/**
 * Check if HTML is inline (like <br> or <span>text</span>)
 */
function isInlineHtml(html: string): boolean {
  const inlineTags = ['br', 'span', 'a', 'strong', 'em', 'b', 'i', 'code', 'kbd', 'mark', 'sub', 'sup'];
  const trimmed = html.trim().toLowerCase();
  for (const tag of inlineTags) {
    if (trimmed.startsWith(`<${tag}`) && !trimmed.includes('\n')) {
      return true;
    }
  }
  return false;
}

/**
 * Visit nodes with parent context
 */
function visitNodes(tree: any, callback: (node: any, index: number, parent: any) => void) {
  function visit(node: any, index: number | null, parent: any) {
    if (index !== null && parent) {
      callback(node, index, parent);
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
 * ProseMirror node schema for HTML block
 */
export const adoHtmlNode = $node('adoHtml', () => ({
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  defining: true,
  isolating: true,
  
  attrs: {
    html: { default: '' },
  },
  
  parseDOM: [{
    tag: 'div.ado-html-widget',
    getAttrs: (dom: HTMLElement) => ({
      html: dom.getAttribute('data-html') || '',
    }),
  }],
  
  toDOM: (node: Node) => ['div', { 
    class: 'ado-html-widget', 
    contenteditable: 'false',
    'data-html': node.attrs.html,
  }],
  
  parseMarkdown: {
    match: (node: any) => node.type === 'adoHtml',
    runner: (state: any, node: any, type: any) => {
      state.addNode(type, { html: node.value || '' });
    },
  },
  
  toMarkdown: {
    match: (node: Node) => node.type.name === 'adoHtml',
    runner: (state: any, node: Node) => {
      // Output raw HTML
      state.addNode('html', undefined, undefined, {
        value: node.attrs.html,
      });
    },
  },
}));

/**
 * Command to insert HTML block
 */
export const insertHtmlBlockCommand = $command('insertHtmlBlock', (ctx) => {
  return () => (state, dispatch) => {
    const { schema } = state;
    const htmlType = schema.nodes.adoHtml;
    if (!htmlType) return false;
    
    if (dispatch) {
      const node = htmlType.create({ html: '' });
      const tr = state.tr.replaceSelectionWith(node);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Custom node view for HTML block with edit mode
 */
export const adoHtmlView = $view(adoHtmlNode, () => {
  return (node, view, getPos) => {
    let isEditing = false;
    let currentHtml = node.attrs.html || '';
    
    const dom = document.createElement('div');
    dom.className = 'ado-html-widget';
    dom.contentEditable = 'false';
    dom.setAttribute('data-html', currentHtml);
    
    const header = document.createElement('div');
    header.className = 'ado-widget-header';
    
    const title = document.createElement('span');
    title.className = 'ado-html-title';
    title.textContent = 'HTML Block';
    header.appendChild(title);
    
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'ado-widget-buttons';
    
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'ado-widget-edit';
    editBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
    </svg>`;
    editBtn.title = 'Edit HTML';
    editBtn.type = 'button';
    editBtn.setAttribute('aria-label', 'Edit HTML');
    buttonGroup.appendChild(editBtn);
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ado-widget-delete';
    deleteBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
      <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg>`;
    deleteBtn.title = 'Remove HTML Block';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', 'Remove HTML Block');
    buttonGroup.appendChild(deleteBtn);
    
    header.appendChild(buttonGroup);
    dom.appendChild(header);
    
    // Content area - shows rendered HTML or editor
    const content = document.createElement('div');
    content.className = 'ado-html-content';
    dom.appendChild(content);
    
    // Editor area (hidden by default)
    const editorArea = document.createElement('div');
    editorArea.className = 'ado-html-editor';
    editorArea.style.display = 'none';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'ado-html-textarea';
    textarea.placeholder = 'Enter HTML code here...';
    textarea.spellcheck = false;
    editorArea.appendChild(textarea);
    
    const editorButtons = document.createElement('div');
    editorButtons.className = 'ado-html-editor-buttons';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'ado-html-save';
    saveBtn.textContent = 'Save';
    saveBtn.type = 'button';
    editorButtons.appendChild(saveBtn);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ado-html-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';
    editorButtons.appendChild(cancelBtn);
    
    editorArea.appendChild(editorButtons);
    dom.appendChild(editorArea);
    
    // Render HTML content
    const renderContent = () => {
      if (currentHtml.trim()) {
        // Create a safe preview - render the HTML
        content.innerHTML = currentHtml;
      } else {
        content.innerHTML = '<div class="ado-html-empty">Hover over and click Edit to add HTML content</div>';
      }
    };
    
    // Switch to edit mode
    const enterEditMode = () => {
      isEditing = true;
      textarea.value = currentHtml;
      content.style.display = 'none';
      editorArea.style.display = 'block';
      editBtn.style.display = 'none';
      textarea.focus();
    };
    
    // Switch to view mode
    const exitEditMode = (save: boolean) => {
      if (save) {
        const newHtml = textarea.value;
        if (newHtml !== currentHtml) {
          currentHtml = newHtml;
          const pos = getPos();
          if (pos !== undefined) {
            const tr = view.state.tr.setNodeMarkup(pos, undefined, { html: newHtml });
            view.dispatch(tr);
          }
        }
      }
      isEditing = false;
      content.style.display = 'block';
      editorArea.style.display = 'none';
      editBtn.style.display = '';
      renderContent();
    };
    
    // Event handlers
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      enterEditMode();
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
    
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      exitEditMode(true);
    });
    
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      exitEditMode(false);
    });
    
    // Handle keyboard shortcuts in textarea
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitEditMode(false);
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        exitEditMode(true);
      }
      // Prevent ProseMirror from handling keypresses while editing
      e.stopPropagation();
    });
    
    // Initial render
    renderContent();
    
    return {
      dom,
      update: (updatedNode) => {
        if (updatedNode.type.name !== 'adoHtml') return false;
        currentHtml = updatedNode.attrs.html || '';
        dom.setAttribute('data-html', currentHtml);
        if (!isEditing) {
          renderContent();
        }
        return true;
      },
      destroy: () => {},
      ignoreMutation: () => true,
      stopEvent: (event) => {
        // Let textarea handle its own events
        return event.target === textarea;
      },
    };
  };
});

export const adoHtmlPlugin = [
  remarkAdoHtml,
  adoHtmlNode,
  adoHtmlView,
  insertHtmlBlockCommand,
].flat();

