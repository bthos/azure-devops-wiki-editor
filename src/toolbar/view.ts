import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { wrapIn } from '@milkdown/kit/prose/commands';

// Commonmark commands
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  insertHrCommand,
  toggleInlineCodeCommand,
  createCodeBlockCommand,
  toggleLinkCommand,
  insertImageCommand,
  liftListItemCommand,
  strongSchema,
  emphasisSchema,
  inlineCodeSchema,
  linkSchema,
  bulletListSchema,
  orderedListSchema,
  listItemSchema,
  headingSchema,
  paragraphSchema,
  blockquoteSchema,
} from '@milkdown/kit/preset/commonmark';
import { lift } from '@milkdown/kit/prose/commands';

// GFM commands
import {
  toggleStrikethroughCommand,
  insertTableCommand,
  addRowBeforeCommand,
  addRowAfterCommand,
  strikethroughSchema,
} from '@milkdown/kit/preset/gfm';

// ADO syntax commands
import { insertHtmlBlockCommand } from '../syntax/ado-html-node';

// ProseMirror table utilities
import {
  deleteTable,
  deleteRow,
  deleteColumn,
  addColumnBefore,
  addColumnAfter,
  isInTable,
  findTable,
  TableMap,
} from '@milkdown/kit/prose/tables';

export const toolbarPluginKey = new PluginKey('toolbar');

export const toolbarView = $prose((ctx: Ctx) => {
  return new Plugin({
    key: toolbarPluginKey,
    view: (editorView: EditorView) => {
      const toolbar = createToolbar(ctx, editorView);
      return {
        update: (view) => {
          updateToolbarState(ctx, toolbar);
        },
        destroy: () => {
          toolbar.remove();
        },
      };
    },
  });
});

function createToolbar(ctx: Ctx, view: EditorView): HTMLElement {
  const container = view.dom.parentElement;
  if (!container) throw new Error('Editor container not found');

  const toolbar = document.createElement('div');
  toolbar.className = 'milkdown-toolbar';
  toolbar.innerHTML = `
    <div class="toolbar-group">
      <button class="toolbar-button" data-action="bold" data-mark="strong" title="Bold (Ctrl+B)" aria-label="Bold">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M4 2h4.5c1.7 0 3 1.3 3 3 0 1-.5 1.9-1.3 2.4.9.5 1.5 1.5 1.5 2.6 0 1.7-1.3 3-3 3H4V2zm2 4.5h2.5c.6 0 1-.4 1-1s-.4-1-1-1H6v2zm0 5h3c.6 0 1-.4 1-1s-.4-1-1-1H6v2z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="italic" data-mark="emphasis" title="Italic (Ctrl+I)" aria-label="Italic">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M6 2h6v2H9.5l-2 8H10v2H4v-2h2.5l2-8H6V2z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="strikethrough" data-mark="strike_through" title="Strikethrough" aria-label="Strikethrough">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M8 14c-1.1 0-2-.9-2-2h1c0 .6.4 1 1 1s1-.4 1-1c0-.4-.2-.7-.5-.9L6 9.5c-.6-.4-1-1-1-1.7 0-1.1.9-2 2-2s2 .9 2 2h-1c0-.6-.4-1-1-1s-1 .4-1 1c0 .4.2.7.5.9L9 10.3c.6.4 1 1 1 1.7 0 1.1-.9 2-2 2zM2 8h12v1H2V8z"/>
        </svg>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button class="toolbar-button" data-action="heading1" title="Heading 1" aria-label="Heading 1">
        <span class="toolbar-text">H1</span>
      </button>
      <button class="toolbar-button" data-action="heading2" title="Heading 2" aria-label="Heading 2">
        <span class="toolbar-text">H2</span>
      </button>
      <button class="toolbar-button" data-action="heading3" title="Heading 3" aria-label="Heading 3">
        <span class="toolbar-text">H3</span>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button class="toolbar-button" data-action="bullet-list" title="Bullet List" aria-label="Bullet List">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <circle cx="3" cy="4" r="1.5"/>
          <circle cx="3" cy="8" r="1.5"/>
          <circle cx="3" cy="12" r="1.5"/>
          <rect x="6" y="3" width="8" height="2" rx="1"/>
          <rect x="6" y="7" width="8" height="2" rx="1"/>
          <rect x="6" y="11" width="8" height="2" rx="1"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="ordered-list" title="Numbered List" aria-label="Numbered List">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M2 3h1v2H2V3zm0 4h1.5v-.5H2.5v-.5h1V5H2v1h1v.5H2V7zm1 4H2v-1h1v-.5H2v-.5h1.5V11H2v-1h1.5v2z"/>
          <rect x="5" y="3" width="9" height="2" rx="1"/>
          <rect x="5" y="7" width="9" height="2" rx="1"/>
          <rect x="5" y="11" width="9" height="2" rx="1"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="task-list" title="Task List" aria-label="Task List">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <rect x="2" y="2.5" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1"/>
          <polyline points="2.5,4 3.5,5 5,2.5" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="7" y="3" width="7" height="2" rx="1"/>
          <rect x="2" y="6.5" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="7" y="7" width="7" height="2" rx="1"/>
          <rect x="2" y="10.5" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="7" y="11" width="7" height="2" rx="1"/>
        </svg>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button class="toolbar-button" data-action="link" data-mark="link" title="Insert Link (Ctrl+K)" aria-label="Insert Link">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="image" title="Insert Image" aria-label="Insert Image">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm11 9V3H3v7l3-3 2 2 4-4 1 1v6zm-4-7a1 1 0 11-2 0 1 1 0 012 0z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="code" data-mark="inlineCode" title="Inline Code" aria-label="Inline Code">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M5.854 4.854a.5.5 0 10-.708-.708l-3.5 3.5a.5.5 0 000 .708l3.5 3.5a.5.5 0 00.708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 01.708-.708l3.5 3.5a.5.5 0 010 .708l-3.5 3.5a.5.5 0 01-.708-.708L13.293 8l-3.147-3.146z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="code-block" title="Code Block" aria-label="Code Block">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M1 3a1 1 0 011-1h12a1 1 0 011 1v10a1 1 0 01-1 1H2a1 1 0 01-1-1V3zm1 0v10h12V3H2zm3.146 4.146a.5.5 0 01.708 0l2 2a.5.5 0 010 .708l-2 2a.5.5 0 01-.708-.708L6.793 9.5 5.146 7.854a.5.5 0 010-.708zM8 11a.5.5 0 010-1h3a.5.5 0 010 1H8z"/>
        </svg>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <div class="toolbar-dropdown">
        <button class="toolbar-button" data-action="table-insert-menu" title="Insert Table" aria-label="Insert Table" aria-haspopup="true">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm1 1v3h3.5V4H4zm4.5 0v3H12V4H8.5zM4 8v3h3.5V8H4zm4.5 0v3H12V8H8.5z"/>
          </svg>
          <svg class="dropdown-arrow" viewBox="0 0 16 16" width="8" height="8" fill="currentColor">
            <path d="M4 6l4 4 4-4z"/>
          </svg>
        </button>
        <div class="toolbar-dropdown-menu table-grid-menu" role="menu">
          <div class="table-grid-label">Insert Table</div>
          <div class="table-grid" data-rows="6" data-cols="6"></div>
          <div class="table-grid-size">1 × 1</div>
        </div>
      </div>
      <div class="toolbar-dropdown">
        <button class="toolbar-button" data-action="table-menu" title="Table Options" aria-label="Table Options" aria-haspopup="true">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm1 2v2h4V5H3zm5 0v2h5V5H8zM3 8v2h4V8H3zm5 0v2h5V8H8zM3 11v2h4v-2H3zm5 0v2h5v-2H8z"/>
          </svg>
          <svg class="dropdown-arrow" viewBox="0 0 16 16" width="8" height="8" fill="currentColor">
            <path d="M4 6l4 4 4-4z"/>
          </svg>
        </button>
        <div class="toolbar-dropdown-menu" role="menu">
          <button class="toolbar-dropdown-item" data-action="add-row-before" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
            Add Row Above
          </button>
          <button class="toolbar-dropdown-item" data-action="add-row-after" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
            Add Row Below
          </button>
          <button class="toolbar-dropdown-item" data-action="delete-row" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 5h4a.5.5 0 010 1H6a.5.5 0 01-.5-.5z"/>
            </svg>
            Delete Row
          </button>
          <div class="toolbar-dropdown-separator"></div>
          <button class="toolbar-dropdown-item" data-action="add-col-before" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
            Add Column Left
          </button>
          <button class="toolbar-dropdown-item" data-action="add-col-after" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
            Add Column Right
          </button>
          <button class="toolbar-dropdown-item" data-action="delete-col" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 5h4a.5.5 0 010 1H6a.5.5 0 01-.5-.5z"/>
            </svg>
            Delete Column
          </button>
          <div class="toolbar-dropdown-separator"></div>
          <button class="toolbar-dropdown-item toolbar-dropdown-item-danger" data-action="delete-table" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 5h4a.5.5 0 010 1H6a.5.5 0 01-.5-.5zM11 2.5v-1A1.5 1.5 0 009.5 0h-3A1.5 1.5 0 005 1.5v1H2.5a.5.5 0 000 1h.538l.853 10.66A2 2 0 005.885 16h4.23a2 2 0 001.994-1.84l.853-10.66h.538a.5.5 0 000-1H11z"/>
            </svg>
            Delete Table
          </button>
        </div>
      </div>
      <button class="toolbar-button" data-action="quote" title="Quote" aria-label="Quote">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M6 12c0 .6.4 1 1 1h1c.6 0 1-.4 1-1V9c0-.6-.4-1-1-1H7c0-2 1.5-3 3-3V3c-2.8 0-5 2.2-5 5v4zm6 0c0 .6.4 1 1 1h1c.6 0 1-.4 1-1V9c0-.6-.4-1-1-1h-1c0-2 1.5-3 3-3V3c-2.8 0-5 2.2-5 5v4z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="hr" title="Horizontal Rule" aria-label="Horizontal Rule">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <rect x="2" y="7" width="12" height="2" rx="1"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="html-block" title="Insert HTML Block" aria-label="Insert HTML Block">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M5.854 4.854a.5.5 0 10-.708-.708l-3.5 3.5a.5.5 0 000 .708l3.5 3.5a.5.5 0 00.708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 01.708-.708l3.5 3.5a.5.5 0 010 .708l-3.5 3.5a.5.5 0 01-.708-.708L13.293 8l-3.147-3.146z"/>
          <path d="M8 1a.5.5 0 01.5.5v13a.5.5 0 01-1 0v-13A.5.5 0 018 1z" transform="rotate(20, 8, 8)"/>
        </svg>
      </button>
    </div>
  `;

  // Insert toolbar before editor
  container.insertBefore(toolbar, view.dom);

  // Initialize table grid
  initializeTableGrid(toolbar, ctx, view);

  // Add click handlers using Milkdown commands
  toolbar.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('button[data-action]');
    if (!button) return;

    e.preventDefault();
    e.stopPropagation();
    const action = button.getAttribute('data-action');
    if (!action) return;

    // Handle dropdown toggles
    if (action === 'table-menu' || action === 'table-insert-menu') {
      const dropdown = button.closest('.toolbar-dropdown');
      const menu = dropdown?.querySelector('.toolbar-dropdown-menu');
      if (menu) {
        const isOpen = menu.classList.contains('show');
        // Close all other dropdowns first
        toolbar.querySelectorAll('.toolbar-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        if (!isOpen) {
          menu.classList.add('show');
        }
      }
      return;
    }

    // Close any open dropdown after action
    toolbar.querySelectorAll('.toolbar-dropdown-menu.show').forEach(m => m.classList.remove('show'));

    handleToolbarAction(ctx, action, view);
    view.focus();
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!toolbar.contains(e.target as Node)) {
      toolbar.querySelectorAll('.toolbar-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    }
  });

  return toolbar;
}

/**
 * Initialize the table grid picker
 */
function initializeTableGrid(toolbar: HTMLElement, ctx: Ctx, editorView: EditorView): void {
  const grid = toolbar.querySelector('.table-grid') as HTMLElement;
  if (!grid) return;

  const rows = parseInt(grid.dataset.rows || '6', 10);
  const cols = parseInt(grid.dataset.cols || '6', 10);
  const sizeLabel = toolbar.querySelector('.table-grid-size') as HTMLElement;

  // Create grid cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'table-grid-cell';
      cell.dataset.row = String(r + 1);
      cell.dataset.col = String(c + 1);
      grid.appendChild(cell);
    }
  }

  // Handle hover to highlight cells
  grid.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('table-grid-cell')) return;

    const hoverRow = parseInt(target.dataset.row || '1', 10);
    const hoverCol = parseInt(target.dataset.col || '1', 10);

    // Update size label
    if (sizeLabel) {
      sizeLabel.textContent = `${hoverCol} × ${hoverRow}`;
    }

    // Highlight cells up to this position
    const cells = grid.querySelectorAll('.table-grid-cell');
    cells.forEach((cell) => {
      const cellEl = cell as HTMLElement;
      const cellRow = parseInt(cellEl.dataset.row || '0', 10);
      const cellCol = parseInt(cellEl.dataset.col || '0', 10);
      
      if (cellRow <= hoverRow && cellCol <= hoverCol) {
        cellEl.classList.add('highlighted');
      } else {
        cellEl.classList.remove('highlighted');
      }
    });
  });

  // Reset on mouse leave
  grid.addEventListener('mouseleave', () => {
    if (sizeLabel) {
      sizeLabel.textContent = '1 × 1';
    }
    grid.querySelectorAll('.table-grid-cell').forEach((cell) => {
      cell.classList.remove('highlighted');
    });
  });

  // Handle click to insert table
  grid.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('table-grid-cell')) return;

    const selectedRows = parseInt(target.dataset.row || '1', 10);
    const selectedCols = parseInt(target.dataset.col || '1', 10);

    // Close the dropdown
    toolbar.querySelectorAll('.toolbar-dropdown-menu.show').forEach(m => m.classList.remove('show'));

    // Check if cursor is inside a table - if so, don't insert
    if (isInTable(editorView.state)) {
      editorView.focus();
      return;
    }

    // Insert table with selected dimensions (add 1 row for header)
    const commands = ctx.get(commandsCtx);
    commands.call(insertTableCommand.key, { row: selectedRows + 1, col: selectedCols });
    
    editorView.focus();
  });
}

/**
 * Update toolbar button active states based on current selection
 */
function updateToolbarState(ctx: Ctx, toolbar: HTMLElement): void {
  try {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { from, to } = state.selection;

    // Check each mark type and update button state
    const markButtons = toolbar.querySelectorAll<HTMLButtonElement>('button[data-mark]');
    markButtons.forEach((button) => {
      const markName = button.getAttribute('data-mark');
      if (!markName) return;

      const markType = state.schema.marks[markName];
      if (!markType) return;

      // Check if mark is active in current selection
      const isActive = isMarkActive(state, markType, from, to);
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  } catch {
    // Ignore errors during state updates
  }
}

/**
 * Check if a mark type is active in the current selection
 */
function isMarkActive(
  state: import('@milkdown/kit/prose/state').EditorState,
  markType: import('@milkdown/kit/prose/model').MarkType,
  from: number,
  to: number
): boolean {
  let active = false;
  
  if (from === to) {
    // Cursor position - check stored marks or marks at position
    const storedMarks = state.storedMarks;
    if (storedMarks) {
      active = storedMarks.some((mark) => mark.type === markType);
    } else {
      const $from = state.doc.resolve(from);
      active = markType.isInSet($from.marks()) !== undefined;
    }
  } else {
    // Range selection - check if mark exists anywhere in range
    state.doc.nodesBetween(from, to, (node) => {
      if (node.marks.some((mark) => mark.type === markType)) {
        active = true;
      }
    });
  }
  
  return active;
}

/**
 * Handle toolbar button actions using Milkdown commands
 */
function handleToolbarAction(ctx: Ctx, action: string, editorView?: EditorView): void {
  const commands = ctx.get(commandsCtx);
  const view = editorView || ctx.get(editorViewCtx);

  switch (action) {
    // Mark toggles
    case 'bold':
      commands.call(toggleStrongCommand.key);
      break;
    case 'italic':
      commands.call(toggleEmphasisCommand.key);
      break;
    case 'strikethrough':
      commands.call(toggleStrikethroughCommand.key);
      break;
    case 'code':
      commands.call(toggleInlineCodeCommand.key);
      break;

    // Headings (toggle behavior)
    case 'heading1':
      toggleHeading(ctx, 1);
      break;
    case 'heading2':
      toggleHeading(ctx, 2);
      break;
    case 'heading3':
      toggleHeading(ctx, 3);
      break;

    // Lists (toggle behavior)
    case 'bullet-list':
      toggleList(ctx, 'bullet');
      break;
    case 'ordered-list':
      toggleList(ctx, 'ordered');
      break;
    case 'task-list':
      toggleList(ctx, 'task');
      break;

    // Block elements (toggle behavior)
    case 'quote':
      toggleBlockquote(ctx);
      break;
    case 'hr':
      commands.call(insertHrCommand.key);
      break;
    case 'code-block':
      commands.call(createCodeBlockCommand.key);
      break;

    // Insert elements
    case 'link':
      commands.call(toggleLinkCommand.key, { href: '' });
      break;
    case 'image':
      commands.call(insertImageCommand.key, { src: '', alt: '' });
      break;
    case 'table':
      // Don't insert table if already inside one
      if (!isInTable(view.state)) {
        commands.call(insertTableCommand.key, { row: 3, col: 2 });
      }
      break;

    // Table row/column operations
    case 'add-row-before':
      addRowAbove(ctx, view);
      break;
    case 'add-row-after':
      commands.call(addRowAfterCommand.key);
      break;
    case 'delete-row':
      deleteTableRow(view);
      break;
    case 'add-col-before':
      addColumnBefore(view.state, view.dispatch);
      break;
    case 'add-col-after':
      addColumnAfter(view.state, view.dispatch);
      break;
    case 'delete-col':
      deleteColumn(view.state, view.dispatch);
      break;
    case 'delete-table':
      deleteTable(view.state, view.dispatch);
      break;

    // HTML block
    case 'html-block':
      commands.call(insertHtmlBlockCommand.key);
      break;
  }
}

/**
 * Create a task list by wrapping in bullet list and setting checked=false on list items
 */
function createTaskList(ctx: Ctx): void {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  
  // Get the bullet list and list item types
  const bulletListType = bulletListSchema.type(ctx);
  const listItemType = listItemSchema.type(ctx);
  
  // First, try to wrap in bullet list
  const wrapCommand = wrapIn(bulletListType);
  
  // Check if we're already in a list item
  const { $from } = state.selection;
  let inListItem = false;
  let listItemPos = -1;
  
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === listItemType) {
      inListItem = true;
      listItemPos = $from.before(d);
      break;
    }
  }
  
  if (inListItem && listItemPos >= 0) {
    // Already in a list item - just convert it to a task item
    const node = state.doc.nodeAt(listItemPos);
    if (node) {
      const tr = state.tr.setNodeMarkup(listItemPos, undefined, {
        ...node.attrs,
        checked: false,
      });
      dispatch(tr);
    }
  } else {
    // Wrap in bullet list first, then set checked attribute
    if (wrapCommand(state, (tr) => {
      // After wrapping, find the new list item and set checked
      const newState = view.state.apply(tr);
      const { $from: newFrom } = newState.selection;
      
      for (let d = newFrom.depth; d > 0; d--) {
        const node = newFrom.node(d);
        if (node.type === listItemType) {
          const pos = newFrom.before(d);
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            checked: false,
          });
          break;
        }
      }
      
      dispatch(tr);
    })) {
      // Command executed with dispatch
    } else {
      // Fallback: insert task list text directly
      const { from, to } = state.selection;
      const text = state.doc.textBetween(from, to, '\n');
      const taskText = text ? `- [ ] ${text}` : '- [ ] ';
      
      const tr = state.tr.replaceWith(from, to, state.schema.text(taskText));
      dispatch(tr);
    }
  }
}

/**
 * Toggle heading - if already at the specified level, convert to paragraph
 */
function toggleHeading(ctx: Ctx, level: number): void {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const { $from } = state.selection;
  
  const headingType = headingSchema.type(ctx);
  const paragraphType = paragraphSchema.type(ctx);
  
  // Check if current block is a heading of the same level
  const currentNode = $from.parent;
  
  if (currentNode.type === headingType && currentNode.attrs.level === level) {
    // Already at this heading level - convert to paragraph
    const pos = $from.before($from.depth);
    const tr = state.tr.setNodeMarkup(pos, paragraphType);
    dispatch(tr);
  } else {
    // Convert to heading
    const commands = ctx.get(commandsCtx);
    commands.call(wrapInHeadingCommand.key, level);
  }
}

/**
 * Toggle list - if already in the same list type, lift out of list
 */
function toggleList(ctx: Ctx, listType: 'bullet' | 'ordered' | 'task'): void {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const { $from } = state.selection;
  const commands = ctx.get(commandsCtx);
  
  const bulletListType = bulletListSchema.type(ctx);
  const orderedListType = orderedListSchema.type(ctx);
  const listItemType = listItemSchema.type(ctx);
  
  // Check if we're in a list and what type
  let inList = false;
  let currentListType: 'bullet' | 'ordered' | 'task' | null = null;
  let listItemNode = null;
  
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === listItemType) {
      listItemNode = node;
      // Check if it's a task list item
      if (node.attrs.checked != null) {
        currentListType = 'task';
        inList = true;
      }
    } else if (node.type === bulletListType) {
      if (!currentListType) currentListType = 'bullet';
      inList = true;
      break;
    } else if (node.type === orderedListType) {
      currentListType = 'ordered';
      inList = true;
      break;
    }
  }
  
  if (inList && currentListType === listType) {
    // Already in this list type - lift out of list
    commands.call(liftListItemCommand.key);
  } else if (listType === 'task') {
    // Create task list
    createTaskList(ctx);
  } else if (listType === 'ordered') {
    commands.call(wrapInOrderedListCommand.key);
  } else {
    commands.call(wrapInBulletListCommand.key);
  }
}

/**
 * Toggle blockquote - if already in blockquote, lift out
 */
function toggleBlockquote(ctx: Ctx): void {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const { $from } = state.selection;
  const commands = ctx.get(commandsCtx);
  
  const blockquoteType = blockquoteSchema.type(ctx);
  
  // Check if we're inside a blockquote
  let inBlockquote = false;
  
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === blockquoteType) {
      inBlockquote = true;
      break;
    }
  }
  
  if (inBlockquote) {
    // Already in blockquote - lift out
    lift(state, dispatch);
  } else {
    // Wrap in blockquote
    commands.call(wrapInBlockquoteCommand.key);
  }
}

/**
 * Add a row above the current row
 * Special handling for header row: inserts a new header row and converts 
 * the current header to a data row
 */
function addRowAbove(ctx: Ctx, view: EditorView): void {
  const { state, dispatch } = view;
  
  if (!isInTable(state)) return;
  
  const table = findTable(state.selection.$from);
  if (!table) return;
  
  // Find which row we're in
  const { $from } = state.selection;
  let inHeaderRow = false;
  
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table_header_row') {
      inHeaderRow = true;
      break;
    }
    if (node.type.name === 'table_row') {
      break;
    }
  }
  
  if (inHeaderRow) {
    // Adding above header row - create new empty header and convert current header to data row
    const headerRow = table.node.firstChild;
    if (!headerRow) return;
    
    const map = TableMap.get(table.node);
    const tableStart = table.start;
    const colCount = map.width;
    
    const headerCellType = state.schema.nodes.table_header;
    const headerRowType = state.schema.nodes.table_header_row;
    const dataCellType = state.schema.nodes.table_cell;
    const dataRowType = state.schema.nodes.table_row;
    
    if (!headerCellType || !headerRowType || !dataCellType || !dataRowType) return;
    
    // Create new empty header cells
    const newHeaderCells: import('@milkdown/kit/prose/model').Node[] = [];
    for (let col = 0; col < colCount; col++) {
      const cell = headerCellType.createAndFill();
      if (cell) newHeaderCells.push(cell);
    }
    
    if (newHeaderCells.length !== colCount) return;
    
    // Convert current header cells to data cells (preserve content)
    const newDataCells: import('@milkdown/kit/prose/model').Node[] = [];
    headerRow.forEach((cell) => {
      const newCell = dataCellType.create(cell.attrs, cell.content);
      newDataCells.push(newCell);
    });
    
    // Create the new rows
    const newHeaderRow = headerRowType.create(null, newHeaderCells);
    const newDataRow = dataRowType.create(null, newDataCells);
    
    // Replace the old header row with new header + converted data row
    const headerRowEnd = tableStart + headerRow.nodeSize;
    const tr = state.tr.replaceWith(tableStart, headerRowEnd, [newHeaderRow, newDataRow]);
    dispatch(tr);
  } else {
    // Normal case - use the standard command
    const commands = ctx.get(commandsCtx);
    commands.call(addRowBeforeCommand.key);
  }
}

/**
 * Delete the current row, with special handling for header rows
 * If deleting the header row and there are data rows below, 
 * the first data row will be promoted to header.
 */
function deleteTableRow(view: EditorView): void {
  const { state, dispatch } = view;
  
  if (!isInTable(state)) return;
  
  const table = findTable(state.selection.$from);
  if (!table) return;
  
  // Find which row we're in
  const { $from } = state.selection;
  let inHeaderRow = false;
  
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table_header_row') {
      inHeaderRow = true;
      break;
    }
    if (node.type.name === 'table_row') {
      break;
    }
  }
  
  if (inHeaderRow) {
    // Deleting header row - check if there are data rows to promote
    const rowCount = table.node.childCount;
    
    if (rowCount <= 1) {
      // Only header row exists - delete the entire table
      deleteTable(state, dispatch);
      return;
    }
    
    // Get the second row (first data row) to promote to header
    const headerRow = table.node.firstChild;
    const dataRow = table.node.child(1);
    
    if (!headerRow || !dataRow) return;
    
    const headerCellType = state.schema.nodes.table_header;
    const headerRowType = state.schema.nodes.table_header_row;
    if (!headerCellType || !headerRowType) return;
    
    // Convert data row cells to header cells
    const newCells: import('@milkdown/kit/prose/model').Node[] = [];
    dataRow.forEach((cell) => {
      const newCell = headerCellType.create(cell.attrs, cell.content);
      newCells.push(newCell);
    });
    
    const newHeaderRow = headerRowType.create(null, newCells);
    
    // Calculate positions
    const tableStart = table.start;
    const headerRowEnd = tableStart + headerRow.nodeSize;
    const dataRowEnd = headerRowEnd + dataRow.nodeSize;
    
    // Replace both the header row and the data row with just the new header row
    const tr = state.tr.replaceWith(tableStart, dataRowEnd, newHeaderRow);
    dispatch(tr);
  } else {
    // Normal row deletion
    deleteRow(state, dispatch);
  }
}
