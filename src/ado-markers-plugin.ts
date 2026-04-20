/**
 * Azure DevOps Markers Plugin for Milkdown
 * 
 * This plugin adds visual styling for Azure DevOps Wiki specific markers:
 * - [[_TOC_]] - Table of Contents (renders live preview of document headings)
 * - [[_TOSP_]] - Table of Sub-Pages (Child Pages)
 * - #123456 - Work item references
 * - @<user name> - User mentions
 * - ::: video ::: - Video embeds
 * - ::: mermaid ::: - Mermaid diagrams
 * 
 * Uses ProseMirror decorations to highlight these markers without changing
 * the document structure, ensuring they are preserved exactly in the output.
 */

import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { adoWikiHeadingAnchorsFromPlainTexts } from './ado-wiki-api';

// Plugin key for the ADO markers decoration plugin
const adoMarkersPluginKey = new PluginKey('ado-markers-decoration');

// Undertie character (U+203F) used to protect markers from emphasis parsing
const UNDERTIE = '\u203F';

// Regular expressions for matching ADO markers (using undertie character)
const TOC_REGEX = new RegExp(`\\[\\[${UNDERTIE}TOC${UNDERTIE}\\]\\]`, 'g');
const TOSP_REGEX = new RegExp(`\\[\\[${UNDERTIE}TOSP${UNDERTIE}\\]\\]`, 'g');

// Work item reference pattern: #followed by at least 2 digits (e.g., #123456)
// Requires at least 2 digits to avoid matching single-digit headings like "# 1"
const WORK_ITEM_REGEX = /#(\d{2,})\b/g;

// User mention pattern: @<user name> (user name in angle brackets)
const MENTION_REGEX = /@<([^>]+)>/g;

// Store reference to the editor view for delete operations
let currentEditorView: EditorView | null = null;

/**
 * Heading information for TOC generation
 */
interface HeadingInfo {
    level: number;
    text: string;
    fragment: string;
}

/**
 * Extract all headings from the document
 */
function escapeHeadingTextForToc(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function extractHeadings(doc: ProseMirrorNode): HeadingInfo[] {
    const levels: number[] = [];
    const texts: string[] = [];

    doc.descendants((node) => {
        if (node.type.name === 'heading') {
            const level = node.attrs.level as number;
            const text = node.textContent;
            if (text.trim()) {
                levels.push(level);
                texts.push(text);
            }
        }
        return true;
    });

    const parts = adoWikiHeadingAnchorsFromPlainTexts(texts);
    return levels.map((level, i) => ({
        level,
        text: texts[i],
        fragment: parts[i].fragment,
    }));
}

/**
 * Build a nested HTML list structure from headings
 */
function buildTocHtml(headings: HeadingInfo[]): string {
    if (headings.length === 0) {
        return '<div class="ado-toc-empty">No headings found</div>';
    }
    
    let html = '<ul class="ado-toc-list">';
    
    // Find the minimum heading level to use as base
    const minLevel = Math.min(...headings.map(h => h.level));
    
    // Track current nesting level
    let currentLevel = minLevel;
    
    headings.forEach((heading, index) => {
        // Close lists if going to a higher level (lower number)
        while (currentLevel > heading.level) {
            html += '</ul></li>';
            currentLevel--;
        }
        
        // Open lists if going to a deeper level
        while (currentLevel < heading.level) {
            // Only add opening <li> if we're not at the start
            if (currentLevel >= minLevel) {
                html += '<li><ul class="ado-toc-list">';
            } else {
                html += '<ul class="ado-toc-list">';
            }
            currentLevel++;
        }
        
        // Create the list item without numbering prefix
        html += `<li><a href="#${heading.fragment}" class="ado-toc-link">${escapeHeadingTextForToc(heading.text)}</a>`;
        
        // Check if next heading is at same or higher level to close the li
        const nextHeading = headings[index + 1];
        if (!nextHeading || nextHeading.level <= heading.level) {
            html += '</li>';
        }
    });
    
    // Close any remaining open lists
    while (currentLevel > minLevel) {
        html += '</ul></li>';
        currentLevel--;
    }
    
    html += '</ul>';
    return html;
}

/**
 * Generate heading prefix like "1.", "1.1.", "2." etc.
 */
function getHeadingPrefix(headings: HeadingInfo[], currentIndex: number, minLevel: number): string {
    const counters: number[] = [];
    const currentHeading = headings[currentIndex];
    const targetLevel = currentHeading.level - minLevel;
    
    // Initialize counters for each level
    for (let i = 0; i <= targetLevel; i++) {
        counters[i] = 0;
    }
    
    // Count through headings up to current
    for (let i = 0; i <= currentIndex; i++) {
        const h = headings[i];
        const level = h.level - minLevel;
        
        // Increment counter at this level
        counters[level] = (counters[level] || 0) + 1;
        
        // Reset all deeper levels when we hit a heading
        for (let j = level + 1; j < counters.length; j++) {
            counters[j] = 0;
        }
    }
    
    // Build prefix string up to current level
    const parts: number[] = [];
    for (let i = 0; i <= targetLevel; i++) {
        parts.push(counters[i] || 1);
    }
    
    return parts.join('.') + '.';
}

/**
 * Delete marker from the document
 */
function deleteMarker(from: number, to: number): void {
    if (!currentEditorView) return;
    
    const { state, dispatch } = currentEditorView;
    const tr = state.tr.delete(from, to);
    dispatch(tr);
}

/**
 * Create a TOC widget element with delete button
 * Uses span elements to be valid inside paragraphs
 */
function createTocWidget(headings: HeadingInfo[], from: number, to: number): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'ado-toc-widget';
    wrapper.contentEditable = 'false';
    
    // Create header with title and delete button
    const header = document.createElement('span');
    header.className = 'ado-widget-header';
    
    const title = document.createElement('span');
    title.className = 'ado-toc-title';
    title.textContent = 'Contents';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ado-widget-delete';
    deleteBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
      <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg>`;
    deleteBtn.title = 'Remove Table of Contents';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', 'Remove Table of Contents');
    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteMarker(from, to);
    });
    
    header.appendChild(title);
    header.appendChild(deleteBtn);
    wrapper.appendChild(header);
    
    // Add TOC content
    const content = document.createElement('span');
    content.className = 'ado-toc-content';
    content.innerHTML = buildTocHtml(headings);
    wrapper.appendChild(content);
    
    return wrapper;
}

/**
 * Create a TOSP widget element with delete button
 * Uses span elements to be valid inside paragraphs
 */
function createTospWidget(from: number, to: number): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'ado-tosp-widget';
    wrapper.contentEditable = 'false';
    
    // Create header with title and delete button
    const header = document.createElement('span');
    header.className = 'ado-widget-header';
    
    const title = document.createElement('span');
    title.className = 'ado-tosp-title';
    title.textContent = 'Child Pages';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ado-widget-delete';
    deleteBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
      <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg>`;
    deleteBtn.title = 'Remove Child Pages';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', 'Remove Child Pages');
    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteMarker(from, to);
    });
    
    header.appendChild(title);
    header.appendChild(deleteBtn);
    wrapper.appendChild(header);
    
    // Add placeholder content
    const content = document.createElement('span');
    content.className = 'ado-tosp-placeholder';
    content.textContent = 'Sub-pages will appear here';
    wrapper.appendChild(content);
    
    return wrapper;
}

/**
 * Create a work item reference widget (inline)
 */
function createWorkItemWidget(workItemId: string): HTMLElement {
    const span = document.createElement('span');
    span.className = 'ado-work-item-ref';
    span.contentEditable = 'false';
    
    const icon = document.createElement('span');
    icon.className = 'ado-work-item-icon';
    icon.textContent = '#';
    
    const idSpan = document.createElement('span');
    idSpan.className = 'ado-work-item-id';
    idSpan.textContent = workItemId;
    
    span.appendChild(icon);
    span.appendChild(idSpan);
    span.title = `Work Item #${workItemId}`;
    
    return span;
}

/**
 * Create a user mention widget (inline)
 */
function createMentionWidget(userName: string): HTMLElement {
    const span = document.createElement('span');
    span.className = 'ado-mention';
    span.contentEditable = 'false';
    
    const icon = document.createElement('span');
    icon.className = 'ado-mention-icon';
    icon.textContent = '@';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'ado-mention-name';
    nameSpan.textContent = userName;
    
    span.appendChild(icon);
    span.appendChild(nameSpan);
    span.title = `Mention: ${userName}`;
    
    return span;
}

// Note: Video and Mermaid widgets are commented out for now
// They require multi-line/multi-node handling which is complex
// TODO: Implement these using node-level detection or custom node views

/**
 * Find all ADO markers in the document and create decorations for them
 */
function findAdoMarkers(doc: ProseMirrorNode): DecorationSet {
    const decorations: Decoration[] = [];
    const headings = extractHeadings(doc);
    
    doc.descendants((node, pos) => {
        if (node.isText && node.text) {
            const text = node.text;
            
            // Find all [[_TOC_]] markers (with undertie)
            let match;
            TOC_REGEX.lastIndex = 0;
            while ((match = TOC_REGEX.exec(text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                
                // Replace the marker text with a widget (hides the marker completely)
                decorations.push(
                    Decoration.widget(from, () => createTocWidget(headings, from, to), {
                        side: -1,
                        key: `toc-widget-${from}`,
                    })
                );
                
                // Hide the actual marker text
                decorations.push(
                    Decoration.inline(from, to, {
                        class: 'ado-marker-hidden',
                    })
                );
            }
            
            // Find all [[_TOSP_]] markers (with undertie)
            TOSP_REGEX.lastIndex = 0;
            while ((match = TOSP_REGEX.exec(text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                
                // Replace the marker text with a widget
                decorations.push(
                    Decoration.widget(from, () => createTospWidget(from, to), {
                        side: -1,
                        key: `tosp-widget-${from}`,
                    })
                );
                
                // Hide the actual marker text
                decorations.push(
                    Decoration.inline(from, to, {
                        class: 'ado-marker-hidden',
                    })
                );
            }
            
            // Find all work item references (#123456)
            WORK_ITEM_REGEX.lastIndex = 0;
            while ((match = WORK_ITEM_REGEX.exec(text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                const workItemId = match[1];
                
                // Replace with work item widget
                decorations.push(
                    Decoration.widget(from, () => createWorkItemWidget(workItemId), {
                        side: -1,
                        key: `work-item-widget-${from}`,
                    })
                );
                
                // Hide the actual text
                decorations.push(
                    Decoration.inline(from, to, {
                        class: 'ado-marker-hidden',
                    })
                );
            }
            
            // Find all user mentions (@<user name>)
            MENTION_REGEX.lastIndex = 0;
            while ((match = MENTION_REGEX.exec(text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                const userName = match[1];
                
                // Replace with mention widget
                decorations.push(
                    Decoration.widget(from, () => createMentionWidget(userName), {
                        side: -1,
                        key: `mention-widget-${from}`,
                    })
                );
                
                // Hide the actual text
                decorations.push(
                    Decoration.inline(from, to, {
                        class: 'ado-marker-hidden',
                    })
                );
            }
            
            // Note: Video and Mermaid blocks are multi-line and handled differently
            // They typically span multiple nodes, so simple text matching won't work
            // These would need to be handled at the node level or with a different approach
        }
        return true; // Continue traversing
    });
    
    return DecorationSet.create(doc, decorations);
}

// Note: Copy button functionality removed temporarily for debugging
// TODO: Re-implement using NodeView for better integration

/**
 * ProseMirror plugin that decorates ADO markers
 */
export const adoMarkersDecorationPlugin = new Plugin({
    key: adoMarkersPluginKey,
    
    state: {
        init(_, { doc }) {
            return findAdoMarkers(doc);
        },
        apply(tr, oldState) {
            // Only recalculate if the document changed
            if (tr.docChanged) {
                return findAdoMarkers(tr.doc);
            }
            return oldState.map(tr.mapping, tr.doc);
        },
    },
    
    props: {
        decorations(state) {
            return this.getState(state);
        },
    },
    
    view(editorView) {
        // Store reference to editor view for delete operations
        currentEditorView = editorView;
        
        return {
            update(view) {
                currentEditorView = view;
            },
            destroy() {
                currentEditorView = null;
            },
        };
    },
});

/**
 * Milkdown plugin wrapper for the ADO markers decoration
 */
export const adoMarkersPlugin = $prose(() => adoMarkersDecorationPlugin);

/**
 * Get the plugin to be used with Milkdown editor
 * Call editor.use(adoMarkersPlugin) when building the editor
 */
export { adoMarkersPlugin as default };
