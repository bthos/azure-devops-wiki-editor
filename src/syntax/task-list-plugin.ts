/**
 * Task List Click Handler Plugin
 * 
 * Adds click interactivity to task list checkboxes.
 * Clicking on a task list item's checkbox area toggles the checked state.
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

export const taskListPluginKey = new PluginKey('taskListClickHandler');

/**
 * Plugin that handles clicks on task list checkboxes
 */
export const taskListClickPlugin = $prose(() => {
    return new Plugin({
        key: taskListPluginKey,
        props: {
            handleDOMEvents: {
                click(view, event) {
                    const target = event.target as HTMLElement;
                    
                    // Check if we clicked on or near a task list item
                    const listItem = target.closest('li[data-item-type="task"], li[data-checked]') as HTMLElement;
                    if (!listItem) return false;
                    
                    // Check if click was in the checkbox area (left padding of the list item)
                    const rect = listItem.getBoundingClientRect();
                    const clickX = event.clientX;
                    
                    // Checkbox is positioned at left: 0 with 24px padding
                    // Allow clicking within the first 24px of the list item
                    if (clickX > rect.left + 24) {
                        return false;
                    }
                    
                    // Get the position from the DOM element
                    const pos = view.posAtDOM(listItem, 0);
                    if (pos === -1) return false;
                    
                    // Find the list_item node at this position
                    const $pos = view.state.doc.resolve(pos);
                    
                    // Walk up to find the list_item node
                    for (let depth = $pos.depth; depth >= 0; depth--) {
                        const node = $pos.node(depth);
                        if (node.type.name === 'list_item') {
                            // Check if this is a task list item (has checked attribute)
                            if (node.attrs.checked != null) {
                                const nodePos = $pos.before(depth);
                                const newChecked = !node.attrs.checked;
                                
                                // Toggle the checked attribute
                                const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
                                    ...node.attrs,
                                    checked: newChecked,
                                });
                                
                                view.dispatch(tr);
                                event.preventDefault();
                                return true;
                            }
                            break;
                        }
                    }
                    
                    return false;
                },
            },
        },
    });
});

export const taskListPlugin = [taskListClickPlugin];
