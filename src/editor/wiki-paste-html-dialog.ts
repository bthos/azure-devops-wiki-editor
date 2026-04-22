export type WikiPasteHtmlDialogOptions = {
    /** Pre-filled HTML when editing an existing block */
    initialHtml?: string;
    /** Dialog title */
    title?: string;
};

/**
 * ADO-style modal: textarea for raw HTML, OK / Cancel.
 * Resolves to the textarea contents when Insert is chosen (may be empty), or `null` if cancelled / dismissed.
 */
export function openWikiPasteHtmlDialog(options?: WikiPasteHtmlDialogOptions): Promise<string | null> {
    return new Promise((resolve) => {
        if (typeof document === 'undefined') {
            resolve(null);
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'wiki-paste-html-backdrop';
        backdrop.setAttribute('role', 'presentation');

        const panel = document.createElement('div');
        panel.className = 'wiki-paste-html-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'wiki-paste-html-title');

        const title = document.createElement('h2');
        title.id = 'wiki-paste-html-title';
        title.className = 'wiki-paste-html-title';
        title.textContent = options?.title ?? 'Paste as HTML';

        const hint = document.createElement('p');
        hint.className = 'wiki-paste-html-hint';
        hint.textContent = 'HTML is sanitized before insertion (scripts, inline handlers, and javascript: URLs are removed).';

        const ta = document.createElement('textarea');
        ta.className = 'wiki-paste-html-textarea';
        ta.setAttribute('spellcheck', 'false');
        ta.setAttribute('aria-label', 'HTML source');
        ta.value = options?.initialHtml ?? '';
        ta.placeholder = '<p>…</p>';

        const actions = document.createElement('div');
        actions.className = 'wiki-paste-html-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'wiki-paste-html-btn wiki-paste-html-btn-secondary';
        cancelBtn.textContent = 'Cancel';

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'wiki-paste-html-btn wiki-paste-html-btn-primary';
        okBtn.textContent = 'Insert';

        const cleanup = () => {
            backdrop.remove();
            document.removeEventListener('keydown', onKeyDown, true);
        };

        const finish = (value: string | null) => {
            cleanup();
            resolve(value);
        };

        cancelBtn.addEventListener('click', () => finish(null));
        okBtn.addEventListener('click', () => finish(ta.value));

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(null);
            }
        };

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) finish(null);
        });

        actions.append(cancelBtn, okBtn);
        panel.append(title, hint, ta, actions);
        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);
        document.addEventListener('keydown', onKeyDown, true);
        requestAnimationFrame(() => {
            ta.focus();
            ta.select();
        });
    });
}
