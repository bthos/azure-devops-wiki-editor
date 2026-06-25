/**
 * Pure HTML builder for the ADO table-of-contents widget (shared by {@link ../editor/wiki-ado-widget-plugin.ts}).
 */

export interface HeadingInfo {
    level: number;
    text: string;
    /** Encoded fragment for `href="#..."` */
    fragment: string;
}

export function buildTocHtml(headings: HeadingInfo[]): string {
    if (headings.length === 0) {
        return '<div class="ado-toc-empty">No headings found</div>';
    }
    return buildNestedTocHtml(headings);
}

function buildNestedTocHtml(headings: HeadingInfo[]): string {
    if (headings.length === 0) return '';

    const result: string[] = [];
    const levelStack: number[] = [];

    result.push('<ul class="ado-toc-list">');

    for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        const level = heading.level;

        if (levelStack.length === 0) {
            result.push(`<li><a href="#${heading.fragment}" class="ado-toc-link">${escapeHtml(heading.text)}</a>`);
            levelStack.push(level);
        } else {
            const prevLevel = levelStack[levelStack.length - 1];

            if (level > prevLevel) {
                result.push('<ul class="ado-toc-list">');
                result.push(`<li><a href="#${heading.fragment}" class="ado-toc-link">${escapeHtml(heading.text)}</a>`);
                levelStack.push(level);
            } else if (level < prevLevel) {
                while (levelStack.length > 0 && levelStack[levelStack.length - 1] > level) {
                    result.push('</li>');
                    result.push('</ul>');
                    levelStack.pop();
                }
                if (levelStack.length > 0) {
                    result.push('</li>');
                    levelStack.pop();
                }
                result.push(`<li><a href="#${heading.fragment}" class="ado-toc-link">${escapeHtml(heading.text)}</a>`);
                levelStack.push(level);
            } else {
                result.push('</li>');
                levelStack.pop();
                result.push(`<li><a href="#${heading.fragment}" class="ado-toc-link">${escapeHtml(heading.text)}</a>`);
                levelStack.push(level);
            }
        }
    }

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
