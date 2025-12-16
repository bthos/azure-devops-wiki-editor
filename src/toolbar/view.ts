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
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M5 4.5C5 3.67157 5.67157 3 6.5 3H10.38C12.7442 3 14.5 4.93367 14.5 7.12C14.5 7.93875 14.2533 8.72553 13.8193 9.38869C14.6623 10.138 15.2474 11.2377 15.2474 12.63C15.2474 15.4046 12.9287 17 10.88 17H6.5C5.67157 17 5 16.3284 5 15.5V4.5ZM8 6V8.25H10.3795C11.0054 8.25 11.5 7.73416 11.5 7.12C11.5 6.51403 11.0119 6 10.38 6H8ZM8 11.25V14H10.88C11.5713 14 12.2474 13.4635 12.2474 12.63C12.2474 11.7902 11.5629 11.25 10.88 11.25H8Z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="italic" data-mark="emphasis" title="Italic (Ctrl+I)" aria-label="Italic">
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M8 3.25C8 2.83579 8.33579 2.5 8.75 2.5H16.25C16.6642 2.5 17 2.83579 17 3.25C17 3.66421 16.6642 4 16.25 4H13.0151L8.59202 15.5H11.25C11.6642 15.5 12 15.8358 12 16.25C12 16.6642 11.6642 17 11.25 17H3.75C3.33579 17 3 16.6642 3 16.25C3 15.8358 3.33579 15.5 3.75 15.5H6.9849L11.408 4H8.75C8.33579 4 8 3.66421 8 3.25Z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="strikethrough" data-mark="strike_through" title="Strikethrough" aria-label="Strikethrough">
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M6.252 3.702A6.56 6.56 0 0110 2.5c2.783 0 4.489 1.485 5.1 2.3a.75.75 0 01-1.2.9C13.511 5.182 12.217 4 10 4a5.06 5.06 0 00-2.877.923C6.331 5.489 6 6.105 6 6.5c0 .78.376 1.285 1.11 1.71.18.105.377.2.586.29H5.162c-.408-.523-.662-1.178-.662-2 0-1.105.794-2.114 1.752-2.798zM16.5 10a.75.75 0 010 1.5h-1.662c.408.523.662 1.178.662 2 0 1.358-.874 2.376-1.912 3.014-1.042.641-2.367.986-3.588.986-1.142 0-2.133-.129-2.992-.498-.877-.378-1.563-.982-2.132-1.836a.75.75 0 111.248-.832c.43.646.901 1.042 1.477 1.29.594.255 1.354.376 2.4.376.966 0 2.015-.28 2.801-.764C13.593 14.75 14 14.141 14 13.5c0-.78-.376-1.285-1.11-1.71-.18-.105-.377-.2-.586-.29H3.5a.75.75 0 010-1.5h13z"/>
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
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M3.25 7C3.94036 7 4.5 6.44036 4.5 5.75C4.5 5.05964 3.94036 4.5 3.25 4.5C2.55964 4.5 2 5.05964 2 5.75C2 6.44036 2.55964 7 3.25 7ZM7 5.75C7 5.33579 7.33579 5 7.75 5H17.25C17.6642 5 18 5.33579 18 5.75C18 6.16421 17.6642 6.5 17.25 6.5H7.75C7.33579 6.5 7 6.16421 7 5.75ZM7.75 10C7.33579 10 7 10.3358 7 10.75C7 11.1642 7.33579 11.5 7.75 11.5H17.25C17.6642 11.5 18 11.1642 18 10.75C18 10.3358 17.6642 10 17.25 10H7.75ZM7.75 15C7.33579 15 7 15.3358 7 15.75C7 16.1642 7.33579 16.5 7.75 16.5H17.25C17.6642 16.5 18 16.1642 18 15.75C18 15.3358 17.6642 15 17.25 15H7.75ZM4.5 10.75C4.5 11.4404 3.94036 12 3.25 12C2.55964 12 2 11.4404 2 10.75C2 10.0596 2.55964 9.5 3.25 9.5C3.94036 9.5 4.5 10.0596 4.5 10.75ZM3.25 17C3.94036 17 4.5 16.4404 4.5 15.75C4.5 15.0596 3.94036 14.5 3.25 14.5C2.55964 14.5 2 15.0596 2 15.75C2 16.4404 2.55964 17 3.25 17Z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="ordered-list" title="Numbered List" aria-label="Numbered List">
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M5.00011 1.49988c0-.23189-.15944-.43335-.38512-.48663-.22878-.054007-.45557.06152-.56351.2657-.02198.0419-.04617.08267-.07095.12294-.05372.08729-.13583.2106-.24585.34814-.2229.27861-.54457.59583-.95818.80263-.24699.1235-.3471.42383-.2236.67082.12349.24699.42383.3471.67082.22361.29981-.14991.5583-.3363.77639-.52899v2.58178c0 .27614.22386.5.5.5s.5-.22386.5-.5v-4zm3.74989 2.5c-.41421 0-.75.33578-.75.75 0 .41421.33579.75.75.75h7.5c.4142 0 .75-.33579.75-.75 0-.41422-.3358-.75-.75-.75h-7.5zm0 5c-.41421 0-.75.33578-.75.75s.33579.75002.75.75002h7.5c.4142 0 .75-.3358.75-.75002 0-.41422-.3358-.75-.75-.75h-7.5zM8 14.7499c0-.4142.33579-.75.75-.75h7.5c.4142 0 .75.3358.75.75s-.3358.75-.75.75h-7.5c-.41421 0-.75-.3358-.75-.75zM2.64642 7.64639c-.19525.19527-.19522.51186.00005.7071.19412.19409.5081.19522.70361.00342l.00657-.00602c.00793-.0071.02246-.01969.04323-.03601.04177-.03284.10721-.07955.19335-.12696.17195-.09463.4171-.18719.71971-.18804.22727.00453.41093.06477.52438.14878.09574.0709.16268.17069.16268.35131 0 .20227-.07021.31913-.21072.43621-.15136.12614-.34792.22343-.61819.35721-.04585.02269-.09447.04676-.14469.07187-.31374.15687-.70272.36349-1.00575.69684C2.69919 10.4157 2.5 10.8808 2.5 11.5c0 .2761.22386.5.5.5h2.49944C5.77558 12 6 11.7761 6 11.5s-.22386-.5-.5-.5H3.58925c.04533-.1067.10488-.1921.17135-.2653.16572-.1823.40174-.3194.713-.475.03868-.0193.07944-.0393.12174-.0601.26196-.1285.5832-.28608.83413-.4952C5.75771 9.43086 6 9.04771 6 8.49997c0-.50444-.22275-.89961-.56756-1.15495-.3264-.2417-.73259-.33876-1.10681-.34507l-.00841-.00007c-.51263-.00003-.92461.15701-1.20615.31196-.14101.0776-.25165.15591-.32916.21684-.03888.03056-.06979.05704-.0924.07728a1.358376 1.358376 0 00-.02778.02556l-.00922.00886-.00344.00337-.00142.00141-.00123.00123zm.01531-.01487l-.01531.01487s.10068-.08975.01531-.01487zm1.08838 7.86838c0-.2762.22386-.5.5-.5.34279 0 .53222-.0967.62764-.1831.09426-.0854.13297-.1914.12896-.2982-.00725-.1935-.18588-.5187-.7566-.5187-.41251 0-.62615.1017-.72265.166-.05056.0337-.07773.063-.08855.0759l-.00409.0051c-.13033.2298-.4193.3197-.65832.2002-.24699-.1235-.3471-.4238-.2236-.6708l.00071-.0015.00074-.0014.00159-.0031.00354-.0068.00867-.0157a.80331.80331 0 01.02407-.0398c.01919-.0298.04494-.0661.07847-.1063.0673-.0808.16513-.1766.30207-.2678.2785-.1857.68986-.334 1.27735-.334 1.02928 0 1.72565.6747 1.7559 1.4812.01378.3675-.11803.7357-.39642 1.0188.27839.283.4102.6512.39642 1.0187-.03025.8065-.72662 1.4813-1.7559 1.4813-.58749 0-.99885-.1483-1.27735-.334-.13694-.0913-.23477-.187-.30207-.2678-.03353-.0402-.05928-.0765-.07847-.1064-.0096-.0149-.01757-.0282-.02407-.0397l-.00867-.0158-.00354-.0067-.00159-.0031-.00074-.0015-.00071-.0014c-.1235-.247-.02339-.5473.2236-.6708.23902-.1195.52799-.0296.65832.2001l.00409.0051c.01082.013.03799.0422.08855.076.0965.0643.31014.166.72265.166.57072 0 .74935-.3253.7566-.5188.00401-.1068-.0347-.2128-.12896-.2981-.09542-.0864-.28485-.1831-.62764-.1831-.27614 0-.5-.2239-.5-.5zm-.31529-1.253c.00422-.0074.00827-.015.01216-.0227l-.00102.002-.00131.0025-.00242.0047-.00406.0074c-.00234.0041-.00478.008-.00478.008l-.0006.0009.00203-.0028z"/>
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
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M14 6C16.2091 6 18 7.79086 18 10C18 12.1422 16.316 13.8911 14.1996 13.9951L14 14H12C11.5858 14 11.25 13.6642 11.25 13.25C11.25 12.8703 11.5322 12.5565 11.8982 12.5068L12 12.5H14C15.3807 12.5 16.5 11.3807 16.5 10C16.5 8.67452 15.4685 7.58996 14.1644 7.50532L14 7.5H12C11.5858 7.5 11.25 7.16421 11.25 6.75C11.25 6.3703 11.5322 6.05651 11.8982 6.00685L12 6H14ZM8 6C8.41421 6 8.75 6.33579 8.75 6.75C8.75 7.1297 8.46785 7.44349 8.10177 7.49315L8 7.5H6C4.61929 7.5 3.5 8.61929 3.5 10C3.5 11.3255 4.53154 12.41 5.83562 12.4947L6 12.5H8C8.41421 12.5 8.75 12.8358 8.75 13.25C8.75 13.6297 8.46785 13.9435 8.10177 13.9932L8 14H6C3.79086 14 2 12.2091 2 10C2 7.8578 3.68397 6.10892 5.80036 6.0049L6 6H8ZM6.25 9.25H13.75C14.1642 9.25 14.5 9.58579 14.5 10C14.5 10.3797 14.2178 10.6935 13.8518 10.7432L13.75 10.75H6.25C5.83579 10.75 5.5 10.4142 5.5 10C5.5 9.6203 5.78215 9.30651 6.14823 9.25685L6.25 9.25H13.75H6.25Z"/>
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
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
          <path d="M6 3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6ZM4 6c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm4.85 1.85a.5.5 0 1 0-.7-.7l-2.5 2.5a.5.5 0 0 0 0 .7l2.5 2.5a.5.5 0 0 0 .7-.7L6.71 10l2.14-2.15Zm3-.7a.5.5 0 0 0-.7.7L13.29 10l-2.14 2.15a.5.5 0 0 0 .7.7l2.5-2.5a.5.5 0 0 0 0-.7l-2.5-2.5Z"/>
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
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M9 6.5a2.5 2.5 0 10-1.174 2.12 8.802 8.802 0 01-.952 2.764c-.649 1.18-1.476 2.011-2.228 2.762a.5.5 0 00.708.708l.011-.012c.747-.747 1.664-1.664 2.386-2.976C8.48 10.538 9 8.83 9 6.5zM14.826 8.62A2.5 2.5 0 1116 6.5c0 2.33-.52 4.038-1.25 5.366-.721 1.312-1.638 2.23-2.384 2.976l-.012.012a.5.5 0 01-.708-.708c.752-.751 1.579-1.581 2.228-2.762a8.8 8.8 0 00.952-2.765z"/>
        </svg>
      </button>
      <button class="toolbar-button" data-action="hr" title="Horizontal Rule" aria-label="Horizontal Rule">
        <svg viewBox="8 8 16 16" width="16" height="16" fill="currentColor">
          <path d="M22.75,17.5H9.25C8.5596,17.5,8,16.9404,8,16.25S8.5596,15,9.25,15h13.5c0.6904,0,1.25,0.5596,1.25,1.25 S23.4404,17.5,22.75,17.5z M21,12.5c0-0.2764-0.2236-0.5-0.5-0.5h-9c-0.2764,0-0.5,0.2236-0.5,0.5s0.2236,0.5,0.5,0.5h9 C20.7764,13,21,12.7764,21,12.5z M21,9.5C21,9.2236,20.7764,9,20.5,9h-9C11.2236,9,11,9.2236,11,9.5s0.2236,0.5,0.5,0.5h9 C20.7764,10,21,9.7764,21,9.5z M21,23.5c0-0.2764-0.2236-0.5-0.5-0.5h-9c-0.2764,0-0.5,0.2236-0.5,0.5s0.2236,0.5,0.5,0.5h9 C20.7764,24,21,23.7764,21,23.5z M21,20.5c0-0.2764-0.2236-0.5-0.5-0.5h-9c-0.2764,0-0.5,0.2236-0.5,0.5s0.2236,0.5,0.5,0.5h9 C20.7764,21,21,20.7764,21,20.5z"/>
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
    const $from = state.doc.resolve(from);

    // Check if cursor is inside a table
    const inTable = isInTable(state);
    
    // Block-level actions that should be disabled inside tables
    const blockActions = [
      'heading1', 'heading2', 'heading3',
      'bullet-list', 'ordered-list', 'task-list',
      'code-block', 'hr', 'quote', 'table-insert-menu', 'html-block'
    ];
    
    // Update disabled state for block-level buttons
    blockActions.forEach((action) => {
      const button = toolbar.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
      if (button) {
        button.disabled = inTable;
        button.classList.toggle('disabled', inTable);
      }
    });

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
    
    // Check heading state
    const currentNode = $from.parent;
    const headingType = state.schema.nodes.heading;
    const currentHeadingLevel = (currentNode.type === headingType) ? currentNode.attrs.level : 0;
    
    // Update heading buttons
    for (let level = 1; level <= 3; level++) {
      const headingButton = toolbar.querySelector<HTMLButtonElement>(`button[data-action="heading${level}"]`);
      if (headingButton) {
        const isActive = currentHeadingLevel === level;
        headingButton.classList.toggle('active', isActive && !inTable);
        headingButton.setAttribute('aria-pressed', String(isActive && !inTable));
      }
    }
    
    // Check list state
    const bulletListType = state.schema.nodes.bullet_list;
    const orderedListType = state.schema.nodes.ordered_list;
    const listItemType = state.schema.nodes.list_item;
    
    let inBulletList = false;
    let inOrderedList = false;
    let inTaskList = false;
    
    // Traverse up the document tree to find list context
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (node.type === listItemType) {
        // Check if it's a task list item (has checked attribute)
        if (node.attrs.checked != null) {
          inTaskList = true;
        }
      } else if (node.type === bulletListType) {
        if (!inTaskList) {
          inBulletList = true;
        }
        break;
      } else if (node.type === orderedListType) {
        inOrderedList = true;
        break;
      }
    }
    
    // Update list buttons (only show active if not in table)
    const bulletListButton = toolbar.querySelector<HTMLButtonElement>('button[data-action="bullet-list"]');
    if (bulletListButton) {
      bulletListButton.classList.toggle('active', inBulletList && !inTable);
      bulletListButton.setAttribute('aria-pressed', String(inBulletList && !inTable));
    }
    
    const orderedListButton = toolbar.querySelector<HTMLButtonElement>('button[data-action="ordered-list"]');
    if (orderedListButton) {
      orderedListButton.classList.toggle('active', inOrderedList && !inTable);
      orderedListButton.setAttribute('aria-pressed', String(inOrderedList && !inTable));
    }
    
    const taskListButton = toolbar.querySelector<HTMLButtonElement>('button[data-action="task-list"]');
    if (taskListButton) {
      taskListButton.classList.toggle('active', inTaskList && !inTable);
      taskListButton.setAttribute('aria-pressed', String(inTaskList && !inTable));
    }
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
