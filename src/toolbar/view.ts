import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';

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
  strongSchema,
  emphasisSchema,
  inlineCodeSchema,
  linkSchema,
} from '@milkdown/kit/preset/commonmark';

// GFM commands
import {
  toggleStrikethroughCommand,
  insertTableCommand,
  strikethroughSchema,
} from '@milkdown/kit/preset/gfm';

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
      <button class="toolbar-button" data-action="table" title="Insert Table" aria-label="Insert Table">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm1 2v2h4V5H3zm5 0v2h5V5H8zM3 8v2h4V8H3zm5 0v2h5V8H8zM3 11v2h4v-2H3zm5 0v2h5v-2H8z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="quote" title="Quote" aria-label="Quote">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M2 8a1 1 0 011-1h10a1 1 0 011 1v4a1 1 0 01-1 1H3a1 1 0 01-1-1V8zm2-3v1H3a2 2 0 00-2 2v4a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2h-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="hr" title="Horizontal Rule" aria-label="Horizontal Rule">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <rect x="2" y="7" width="12" height="2" rx="1"/>
        </svg>
      </button>
    </div>
  `;

  // Insert toolbar before editor
  container.insertBefore(toolbar, view.dom);

  // Add click handlers using Milkdown commands
  toolbar.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest('button[data-action]');
    if (!button) return;

    e.preventDefault();
    const action = button.getAttribute('data-action');
    if (!action) return;

    handleToolbarAction(ctx, action);
    view.focus();
  });

  return toolbar;
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
function handleToolbarAction(ctx: Ctx, action: string): void {
  const commands = ctx.get(commandsCtx);

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

    // Headings
    case 'heading1':
      commands.call(wrapInHeadingCommand.key, 1);
      break;
    case 'heading2':
      commands.call(wrapInHeadingCommand.key, 2);
      break;
    case 'heading3':
      commands.call(wrapInHeadingCommand.key, 3);
      break;

    // Lists
    case 'bullet-list':
      commands.call(wrapInBulletListCommand.key);
      break;
    case 'ordered-list':
      commands.call(wrapInOrderedListCommand.key);
      break;
    case 'task-list':
      // Task list is a bullet list with checkbox - use bullet list command
      // The GFM preset handles task list items via the checkbox
      commands.call(wrapInBulletListCommand.key);
      break;

    // Block elements
    case 'quote':
      commands.call(wrapInBlockquoteCommand.key);
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
      commands.call(insertTableCommand.key, { row: 3, col: 2 });
      break;
  }
}
