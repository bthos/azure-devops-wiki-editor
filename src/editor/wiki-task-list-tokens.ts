/**
 * Derive {@link ./wiki-schema.ts} `list_item.attrs.checked` from markdown-it + `markdown-it-task-lists` tokens.
 * `null` = normal list item; `true` / `false` = task item.
 */

// markdown-it token shape (avoid tight coupling to markdown-it types)
export type MdToken = {
    type: string;
    level?: number;
    attrGet?: (name: string) => string | null;
    children?: MdToken[];
    content?: string;
};

export function taskListCheckedFromListItemOpen(tokens: MdToken[], i: number): boolean | null {
    const open = tokens[i];
    if (!open || open.type !== 'list_item_open') return null;
    const cls = open.attrGet?.('class') ?? '';
    if (!cls.includes('task-list-item')) return null;
    const level = open.level ?? 0;
    for (let j = i + 1; j < tokens.length; j++) {
        const t = tokens[j];
        if (t.type === 'list_item_close' && t.level === level) break;
        if (t.type === 'inline' && t.children && t.children.length > 0) {
            const first = t.children[0];
            if (first.type === 'html_inline' && typeof first.content === 'string') {
                if (/checked\s*=/.test(first.content)) return true;
                if (/task-list-item-checkbox/.test(first.content)) return false;
            }
        }
    }
    return false;
}
