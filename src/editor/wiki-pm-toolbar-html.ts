/**
 * Toolbar inner HTML aligned with {@link ../toolbar/view.ts#createToolbar} (Milkdown).
 * ProseMirror path adds “Paste as HTML” (`ado_html_block`); wiki markdown uses raw HTML like Azure DevOps
 * (`markdown-it` `html: true`). Milkdown uses a code-block placeholder for HTML.
 */

export type WikiPmToolbarHtmlOpts = {
    /** When non-empty, inserts the attachment control (same SVG as Milkdown). */
    attachmentButtonHtml: string;
};

export function wikiPmToolbarInnerHtml(opts: WikiPmToolbarHtmlOpts): string {
    const { attachmentButtonHtml } = opts;
    return `
    <div class="toolbar-group">
      <button type="button" class="toolbar-button" data-action="undo" title="Undo (Ctrl+Z)" aria-label="Undo">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <text x="8" y="12.5" text-anchor="middle" font-size="13" fill="currentColor" font-family="Segoe UI Symbol, Segoe MDL2 Assets, sans-serif">↶</text>
        </svg>
      </button>
      <button type="button" class="toolbar-button" data-action="redo" title="Redo (Ctrl+Y)" aria-label="Redo">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <text x="8" y="12.5" text-anchor="middle" font-size="13" fill="currentColor" font-family="Segoe UI Symbol, Segoe MDL2 Assets, sans-serif">↷</text>
        </svg>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button type="button" class="toolbar-button" data-action="bold" data-mark="strong" title="Bold (Ctrl+B)" aria-label="Bold">
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M5 4.5C5 3.67157 5.67157 3 6.5 3H10.38C12.7442 3 14.5 4.93367 14.5 7.12C14.5 7.93875 14.2533 8.72553 13.8193 9.38869C14.6623 10.138 15.2474 11.2377 15.2474 12.63C15.2474 15.4046 12.9287 17 10.88 17H6.5C5.67157 17 5 16.3284 5 15.5V4.5ZM8 6V8.25H10.3795C11.0054 8.25 11.5 7.73416 11.5 7.12C11.5 6.51403 11.0119 6 10.38 6H8ZM8 11.25V14H10.88C11.5713 14 12.2474 13.4635 12.2474 12.63C12.2474 11.7902 11.5629 11.25 10.88 11.25H8Z"/>
        </svg>
      </button>
      <button type="button" class="toolbar-button" data-action="italic" data-mark="em" title="Italic (Ctrl+I)" aria-label="Italic">
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M8 3.25C8 2.83579 8.33579 2.5 8.75 2.5H16.25C16.6642 2.5 17 2.83579 17 3.25C17 3.66421 16.6642 4 16.25 4H13.0151L8.59202 15.5H11.25C11.6642 15.5 12 15.8358 12 16.25C12 16.6642 11.6642 17 11.25 17H3.75C3.33579 17 3 16.6642 3 16.25C3 15.8358 3.33579 15.5 3.75 15.5H6.9849L11.408 4H8.75C8.33579 4 8 3.66421 8 3.25Z"/>
        </svg>
      </button>
      <button type="button" class="toolbar-button" data-action="strikethrough" data-mark="strikethrough" title="Strikethrough" aria-label="Strikethrough">
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M6.252 3.702A6.56 6.56 0 0110 2.5c2.783 0 4.489 1.485 5.1 2.3a.75.75 0 01-1.2.9C13.511 5.182 12.217 4 10 4a5.06 5.06 0 00-2.877.923C6.331 5.489 6 6.105 6 6.5c0 .78.376 1.285 1.11 1.71.18.105.377.2.586.29H5.162c-.408-.523-.662-1.178-.662-2 0-1.105.794-2.114 1.752-2.798zM16.5 10a.75.75 0 010 1.5h-1.662c.408.523.662 1.178.662 2 0 1.358-.874 2.376-1.912 3.014-1.042.641-2.367.986-3.588.986-1.142 0-2.133-.129-2.992-.498-.877-.378-1.563-.982-2.132-1.836a.75.75 0 111.248-.832c.43.646.901 1.042 1.477 1.29.594.255 1.354.376 2.4.376.966 0 2.015-.28 2.801-.764C13.593 14.75 14 14.141 14 13.5c0-.78-.376-1.285-1.11-1.71-.18-.105-.377-.2-.586-.29H3.5a.75.75 0 010-1.5h13z"/>
        </svg>
      </button>
      <div class="toolbar-dropdown wiki-style-dropdown">
        <button type="button" class="toolbar-button" data-action="wiki-style-menu" title="Text &amp; highlight colors" aria-label="Text and highlight colors" aria-haspopup="true">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M5 3h10v2H5V3zm0 4h10v2H5V7zm0 4h7v2H5v-2zm8 0h2v6h-2v-6z"/>
          </svg>
          <svg class="dropdown-arrow" viewBox="0 0 16 16" width="8" height="8" fill="currentColor" aria-hidden="true">
            <path d="M4 6l4 4 4-4z"/>
          </svg>
        </button>
        <div class="toolbar-dropdown-menu wiki-style-color-menu" role="menu" aria-label="Text and highlight colors">
          <div class="wiki-style-color-row">
            <span class="wiki-style-color-label">Text</span>
            <input type="color" class="toolbar-color-input wiki-style-color-input" data-toolbar="wiki-style-fg" value="#000000" aria-label="Text color" />
          </div>
          <div class="wiki-style-color-row">
            <span class="wiki-style-color-label">Highlight</span>
            <input type="color" class="toolbar-color-input wiki-style-color-input" data-toolbar="wiki-style-bg" value="#ffff00" aria-label="Highlight color" />
          </div>
          <button type="button" class="toolbar-dropdown-item" data-action="wiki-style-clear-fg" role="menuitem">Clear text color</button>
          <button type="button" class="toolbar-dropdown-item" data-action="wiki-style-clear-bg" role="menuitem">Clear highlight</button>
          <button type="button" class="toolbar-dropdown-item" data-action="wiki-style-clear-all" role="menuitem">Reset both</button>
        </div>
      </div>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button type="button" class="toolbar-button" data-action="heading1" title="Heading 1" aria-label="Heading 1">
        <span class="toolbar-text">H1</span>
      </button>
      <button type="button" class="toolbar-button" data-action="heading2" title="Heading 2" aria-label="Heading 2">
        <span class="toolbar-text">H2</span>
      </button>
      <button type="button" class="toolbar-button" data-action="heading3" title="Heading 3" aria-label="Heading 3">
        <span class="toolbar-text">H3</span>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button type="button" class="toolbar-button" data-action="bullet-list" title="Bullet List" aria-label="Bullet List">
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M3.25 7C3.94036 7 4.5 6.44036 4.5 5.75C4.5 5.05964 3.94036 4.5 3.25 4.5C2.55964 4.5 2 5.05964 2 5.75C2 6.44036 2.55964 7 3.25 7ZM7 5.75C7 5.33579 7.33579 5 7.75 5H17.25C17.6642 5 18 5.33579 18 5.75C18 6.16421 17.6642 6.5 17.25 6.5H7.75C7.33579 6.5 7 6.16421 7 5.75ZM7.75 10C7.33579 10 7 10.3358 7 10.75C7 11.1642 7.33579 11.5 7.75 11.5H17.25C17.6642 11.5 18 11.1642 18 10.75C18 10.3358 17.6642 10 17.25 10H7.75ZM7.75 15C7.33579 15 7 15.3358 7 15.75C7 16.1642 7.33579 16.5 7.75 16.5H17.25C17.6642 16.5 18 16.1642 18 15.75C18 15.3358 17.6642 15 17.25 15H7.75ZM4.5 10.75C4.5 11.4404 3.94036 12 3.25 12C2.55964 12 2 11.4404 2 10.75C2 10.0596 2.55964 9.5 3.25 9.5C3.94036 9.5 4.5 10.0596 4.5 10.75ZM3.25 17C3.94036 17 4.5 16.4404 4.5 15.75C4.5 15.0596 3.94036 14.5 3.25 14.5C2.55964 14.5 2 15.0596 2 15.75C2 16.4404 2.55964 17 3.25 17Z"/>
        </svg>
      </button>
      <button type="button" class="toolbar-button" data-action="ordered-list" title="Numbered List" aria-label="Numbered List">
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M5.00011 1.49988c0-.23189-.15944-.43335-.38512-.48663-.22878-.054007-.45557.06152-.56351.2657-.02198.0419-.04617.08267-.07095.12294-.05372.08729-.13583.2106-.24585.34814-.2229.27861-.54457.59583-.95818.80263-.24699.1235-.3471.42383-.2236.67082.12349.24699.42383.3471.67082.22361.29981-.14991.5583-.3363.77639-.52899v2.58178c0 .27614.22386.5.5.5s.5-.22386.5-.5v-4zm3.74989 2.5c-.41421 0-.75.33578-.75.75 0 .41421.33579.75.75.75h7.5c.4142 0 .75-.33579.75-.75 0-.41422-.3358-.75-.75-.75h-7.5zm0 5c-.41421 0-.75.33578-.75.75s.33579.75002.75.75002h7.5c.4142 0 .75-.3358.75-.75002 0-.41422-.3358-.75-.75-.75h-7.5zM8 14.7499c0-.4142.33579-.75.75-.75h7.5c.4142 0 .75.3358.75.75s-.3358.75-.75.75h-7.5c-.41421 0-.75-.3358-.75-.75zM2.64642 7.64639c-.19525.19527-.19522.51186.00005.7071.19412.19409.5081.19522.70361.00342l.00657-.00602c.00793-.0071.02246-.01969.04323-.03601.04177-.03284.10721-.07955.19335-.12696.17195-.09463.4171-.18719.71971-.18804.22727.00453.41093.06477.52438.14878.09574.0709.16268.17069.16268.35131 0 .20227-.07021.31913-.21072.43621-.15136.12614-.34792.22343-.61819.35721-.04585.02269-.09447.04676-.14469.07187-.31374.15687-.70272.36349-1.00575.69684C2.69919 10.4157 2.5 10.8808 2.5 11.5c0 .2761.22386.5.5.5h2.49944C5.77558 12 6 11.7761 6 11.5s-.22386-.5-.5-.5H3.58925c.04533-.1067.10488-.1921.17135-.2653.16572-.1823.40174-.3194.713-.475.03868-.0193.07944-.0393.12174-.0601.26196-.1285.5832-.28608.83413-.4952C5.75771 9.43086 6 9.04771 6 8.49997c0-.50444-.22275-.89961-.56756-1.15495-.3264-.2417-.73259-.33876-1.10681-.34507l-.00841-.00007c-.51263-.00003-.92461.15701-1.20615.31196-.14101.0776-.25165.15591-.32916.21684-.03888.03056-.06979.05704-.0924.07728a1.358376 1.358376 0 00-.02778.02556l-.00922.00886-.00344.00337-.00142.00141-.00123.00123zm.01531-.01487l-.01531.01487s.10068-.08975.01531-.01487zm1.08838 7.86838c0-.2762.22386-.5.5-.5.34279 0 .53222-.0967.62764-.1831.09426-.0854.13297-.1914.12896-.2982-.00725-.1935-.18588-.5187-.7566-.5187-.41251 0-.62615.1017-.72265.166-.05056.0337-.07773.063-.08855.0759l-.00409.0051c-.13033.2298-.4193.3197-.65832.2002-.24699-.1235-.3471-.4238-.2236-.6708l.00071-.0015.00074-.0014.00159-.0031.00354-.0068.00867-.0157a.80331.80331 0 01.02407-.0398c.01919-.0298.04494-.0661.07847-.1063.0673-.0808.16513-.1766.30207-.2678.2785-.1857.68986-.334 1.27735-.334 1.02928 0 1.72565.6747 1.7559 1.4812.01378.3675-.11803.7357-.39642 1.0188.27839.283.4102.6512.39642 1.0187-.03025.8065-.72662 1.4813-1.7559 1.4813-.58749 0-.99885-.1483-1.27735-.334-.13694-.0913-.23477-.187-.30207-.2678-.03353-.0402-.05928-.0765-.07847-.1064-.0096-.0149-.01757-.0282-.02407-.0397l-.00867-.0158-.00354-.0067-.00159-.0031-.00074-.0015-.00071-.0014c-.1235-.247-.02339-.5473.2236-.6708.23902-.1195.52799-.0296.65832.2001l.00409.0051c.01082.013.03799.0422.08855.076.0965.0643.31014.166.72265.166.57072 0 .74935-.3253.7566-.5188.00401-.1068-.0347-.2128-.12896-.2981-.09542-.0864-.28485-.1831-.62764-.1831-.27614 0-.5-.2239-.5-.5zm-.31529-1.253c.00422-.0074.00827-.015.01216-.0227l-.00102.002-.00131.0025-.00242.0047-.00406.0074c-.00234.0041-.00478.008-.00478.008l-.0006.0009.00203-.0028z"/>
        </svg>
      </button>
      <button type="button" class="toolbar-button" data-action="task-list" title="Task List" aria-label="Task List">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
          <rect x="2" y="2.5" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1"/>
          <polyline points="2.5,4 3.5,5 5,2.5" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="7" y="3" width="7" height="2" rx="1"/>
          <rect x="2" y="6.5" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="7" y="7" width="7" height="2" rx="1"/>
          <rect x="2" y="10.5" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="7" y="11" width="7" height="2" rx="1"/>
        </svg>
      </button>
      <button type="button" class="toolbar-button" data-action="indent-list" title="Increase list indent (nest under previous item, or nest first item)" aria-label="Increase list indent">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
          <rect x="2" y="3.5" width="5" height="1.25" rx="0.2"/>
          <rect x="2" y="7.375" width="3.5" height="1.25" rx="0.2"/>
          <rect x="2" y="11.25" width="5" height="1.25" rx="0.2"/>
          <path d="M10.5 5.5V10.5L13.25 8L10.5 5.5Z"/>
        </svg>
      </button>
      <button type="button" class="toolbar-button" data-action="outdent-list" title="Decrease list indent" aria-label="Decrease list indent">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
          <g transform="translate(16,0) scale(-1,1)">
            <rect x="2" y="3.5" width="5" height="1.25" rx="0.2"/>
            <rect x="2" y="7.375" width="3.5" height="1.25" rx="0.2"/>
            <rect x="2" y="11.25" width="5" height="1.25" rx="0.2"/>
            <path d="M10.5 5.5V10.5L13.25 8L10.5 5.5Z"/>
          </g>
        </svg>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button type="button" class="toolbar-button" data-action="insert-toc" title="Insert Table of Contents ([[_TOC_]])" aria-label="Insert Table of Contents">
        <span class="toolbar-text">TOC</span>
      </button>
      <button type="button" class="toolbar-button" data-action="insert-tosp" title="Insert Table of Sub-Pages ([[_TOSP_]])" aria-label="Insert Table of Sub-Pages">
        <span class="toolbar-text">TOSP</span>
      </button>
      <button type="button" class="toolbar-button" data-action="insert-mention" title="Insert @mention" aria-label="Insert mention">
        <span class="toolbar-text">@</span>
      </button>
      <button type="button" class="toolbar-button" data-action="paste-html" title="Paste as HTML (ADO-style)" aria-label="Paste as HTML">
        <span class="toolbar-text">&lt;/&gt;</span>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button type="button" class="toolbar-button" data-action="link" data-mark="link" title="Insert Link (Ctrl+K)" aria-label="Insert Link">
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M14 6C16.2091 6 18 7.79086 18 10C18 12.1422 16.316 13.8911 14.1996 13.9951L14 14H12C11.5858 14 11.25 13.6642 11.25 13.25C11.25 12.8703 11.5322 12.5565 11.8982 12.5068L12 12.5H14C15.3807 12.5 16.5 11.3807 16.5 10C16.5 8.67452 15.4685 7.58996 14.1644 7.50532L14 7.5H12C11.5858 7.5 11.25 7.16421 11.25 6.75C11.25 6.3703 11.5322 6.05651 11.8982 6.00685L12 6H14ZM8 6C8.41421 6 8.75 6.33579 8.75 6.75C8.75 7.1297 8.46785 7.44349 8.10177 7.49315L8 7.5H6C4.61929 7.5 3.5 8.61929 3.5 10C3.5 11.3255 4.53154 12.41 5.83562 12.4947L6 12.5H8C8.41421 12.5 8.75 12.8358 8.75 13.25C8.75 13.6297 8.46785 13.9435 8.10177 13.9932L8 14H6C3.79086 14 2 12.2091 2 10C2 7.8578 3.68397 6.10892 5.80036 6.0049L6 6H8ZM6.25 9.25H13.75C14.1642 9.25 14.5 9.58579 14.5 10C14.5 10.3797 14.2178 10.6935 13.8518 10.7432L13.75 10.75H6.25C5.83579 10.75 5.5 10.4142 5.5 10C5.5 9.6203 5.78215 9.30651 6.14823 9.25685L6.25 9.25H13.75H6.25Z"/>
        </svg>
      </button>
      ${attachmentButtonHtml}
      <button type="button" class="toolbar-button" data-action="code" data-mark="code" title="Inline Code" aria-label="Inline Code">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M5.854 4.854a.5.5 0 10-.708-.708l-3.5 3.5a.5.5 0 000 .708l3.5 3.5a.5.5 0 00.708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 01.708-.708l3.5 3.5a.5.5 0 010 .708l-3.5 3.5a.5.5 0 01-.708-.708L13.293 8l-3.147-3.146z"/>
        </svg>
      </button>
      <button type="button" class="toolbar-button" data-action="code-block" title="Code Block" aria-label="Code Block">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
          <path d="M6 3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6ZM4 6c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm4.85 1.85a.5.5 0 1 0-.7-.7l-2.5 2.5a.5.5 0 0 0 0 .7l2.5 2.5a.5.5 0 0 0 .7-.7L6.71 10l2.14-2.15Zm3-.7a.5.5 0 0 0-.7.7L13.29 10l-2.14 2.15a.5.5 0 0 0 .7.7l2.5-2.5a.5.5 0 0 0 0-.7l-2.5-2.5Z"/>
        </svg>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <div class="toolbar-dropdown">
        <button type="button" class="toolbar-button" data-action="table-insert-menu" data-require-not-table="true" title="Insert Table" aria-label="Insert Table" aria-haspopup="true">
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
        <button type="button" class="toolbar-button" data-action="table-menu" data-require-table="true" title="Table Options" aria-label="Table Options" aria-haspopup="true">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm1 2v2h4V5H3zm5 0v2h5V5H8zM3 8v2h4V8H3zm5 0v2h5V8H8zM3 11v2h4v-2H3zm5 0v2h5v-2H8z"/>
          </svg>
          <svg class="dropdown-arrow" viewBox="0 0 16 16" width="8" height="8" fill="currentColor">
            <path d="M4 6l4 4 4-4z"/>
          </svg>
        </button>
        <div class="toolbar-dropdown-menu" role="menu">
          <button type="button" class="toolbar-dropdown-item" data-action="add-row-before" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
            Add Row Above
          </button>
          <button type="button" class="toolbar-dropdown-item" data-action="add-row-after" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
            Add Row Below
          </button>
          <button type="button" class="toolbar-dropdown-item" data-action="delete-row" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 5h4a.5.5 0 010 1H6a.5.5 0 01-.5-.5z"/>
            </svg>
            Delete Row
          </button>
          <div class="toolbar-dropdown-separator"></div>
          <button type="button" class="toolbar-dropdown-item" data-action="add-col-before" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
            Add Column Left
          </button>
          <button type="button" class="toolbar-dropdown-item" data-action="add-col-after" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
            Add Column Right
          </button>
          <button type="button" class="toolbar-dropdown-item" data-action="delete-col" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 5h4a.5.5 0 010 1H6a.5.5 0 01-.5-.5z"/>
            </svg>
            Delete Column
          </button>
          <div class="toolbar-dropdown-separator"></div>
          <button type="button" class="toolbar-dropdown-item toolbar-dropdown-item-danger" data-action="delete-table" role="menuitem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 5h4a.5.5 0 010 1H6a.5.5 0 01-.5-.5zM11 2.5v-1A1.5 1.5 0 009.5 0h-3A1.5 1.5 0 005 1.5v1H2.5a.5.5 0 000 1h.538l.853 10.66A2 2 0 005.885 16h4.23a2 2 0 001.994-1.84l.853-10.66h.538a.5.5 0 000-1H11z"/>
            </svg>
            Delete Table
          </button>
        </div>
      </div>
      <button type="button" class="toolbar-button" data-action="quote" title="Quote" aria-label="Quote">
        <svg viewBox="2 2 16 16" width="16" height="16" fill="currentColor">
          <path d="M9 6.5a2.5 2.5 0 10-1.174 2.12 8.802 8.802 0 01-.952 2.764c-.649 1.18-1.476 2.011-2.228 2.762a.5.5 0 00.708.708l.011-.012c.747-.747 1.664-1.664 2.386-2.976C8.48 10.538 9 8.83 9 6.5zM14.826 8.62A2.5 2.5 0 1116 6.5c0 2.33-.52 4.038-1.25 5.366-.721 1.312-1.638 2.23-2.384 2.976l-.012.012a.5.5 0 01-.708-.708c.752-.751 1.579-1.581 2.228-2.762a8.8 8.8 0 00.952-2.765z"/>
        </svg>
      </button>
      <button type="button" class="toolbar-button" data-action="hr" title="Horizontal Rule" aria-label="Horizontal Rule">
        <svg viewBox="8 8 16 16" width="16" height="16" fill="currentColor">
          <path d="M22.75,17.5H9.25C8.5596,17.5,8,16.9404,8,16.25S8.5596,15,9.25,15h13.5c0.6904,0,1.25,0.5596,1.25,1.25 S23.4404,17.5,22.75,17.5z M21,12.5c0-0.2764-0.2236-0.5-0.5-0.5h-9c-0.2764,0-0.5,0.2236-0.5,0.5s0.2236,0.5,0.5,0.5h9 C20.7764,13,21,12.7764,21,12.5z M21,9.5C21,9.2236,20.7764,9,20.5,9h-9C11.2236,9,11,9.2236,11,9.5s0.2236,0.5,0.5,0.5h9 C20.7764,10,21,9.7764,21,9.5z M21,23.5c0-0.2764-0.2236-0.5-0.5-0.5h-9c-0.2764,0-0.5,0.2236-0.5,0.5s0.2236,0.5,0.5,0.5h9 C20.7764,24,21,23.7764,21,23.5z M21,20.5c0-0.2764-0.2236-0.5-0.5-0.5h-9c-0.2764,0-0.5,0.2236-0.5,0.5s0.2236,0.5,0.5,0.5h9 C20.7764,21,21,20.7764,21,20.5z"/>
        </svg>
      </button>
    </div>
  `;
}

/** Same attachment icon as Milkdown toolbar (paperclip). */
export const wikiPmToolbarAttachmentButtonHtml = `
    <button type="button" class="toolbar-button" data-action="image" title="Insert Attachment" aria-label="Insert Attachment">
      <svg aria-hidden="true" fill="currentColor" width="1em" height="1em" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path d="m4.83 10.48 5.65-5.65a3 3 0 0 1 4.25 4.24L8 15.8a1.5 1.5 0 0 1-2.12-2.12l6-6.01a.5.5 0 1 0-.7-.71l-6 6.01a2.5 2.5 0 0 0 3.53 3.54l6.71-6.72a4 4 0 1 0-5.65-5.66L4.12 9.78a.5.5 0 0 0 .7.7Z"/>
      </svg>
    </button>
`;
