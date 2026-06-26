import type { AdoWorkItemPreview } from './wiki-work-item-wit-api';
import { fetchAdoWorkItemPreview } from './wiki-work-item-wit-api';

export type WikiWorkItemPickerResult = AdoWorkItemPreview;

/**
 * Dialog to insert a work item: enter numeric id, look up via WIT REST, then insert (ADO-style chip).
 */
export function openWikiWorkItemPickerDialog(options?: { title?: string }): Promise<WikiWorkItemPickerResult | null> {
    return new Promise((resolve) => {
        if (typeof document === 'undefined') {
            resolve(null);
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'wiki-mention-picker-backdrop';
        backdrop.setAttribute('role', 'presentation');

        const panel = document.createElement('div');
        panel.className = 'wiki-mention-picker-panel wiki-work-item-picker-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'wiki-work-item-picker-title');

        const title = document.createElement('h2');
        title.id = 'wiki-work-item-picker-title';
        title.className = 'wiki-mention-picker-title';
        title.textContent = options?.title ?? 'Insert work item';

        const label = document.createElement('label');
        label.className = 'wiki-work-item-picker-label';
        label.setAttribute('for', 'wiki-work-item-id-input');
        label.textContent = 'Work item ID';

        const idInput = document.createElement('input');
        idInput.id = 'wiki-work-item-id-input';
        idInput.type = 'text';
        idInput.className = 'wiki-mention-picker-search';
        idInput.setAttribute('aria-label', 'Work item ID');
        idInput.setAttribute('placeholder', 'e.g. 12');
        idInput.setAttribute('inputmode', 'numeric');
        idInput.setAttribute('autocomplete', 'off');

        const status = document.createElement('p');
        status.className = 'wiki-mention-picker-status';
        status.textContent = 'Enter an id (at least 2 digits), then Look up.';

        const actions = document.createElement('div');
        actions.className = 'wiki-mention-picker-actions';

        const lookupBtn = document.createElement('button');
        lookupBtn.type = 'button';
        lookupBtn.className = 'wiki-paste-html-btn wiki-paste-html-btn-secondary';
        lookupBtn.textContent = 'Look up';

        const insertBtn = document.createElement('button');
        insertBtn.type = 'button';
        insertBtn.className = 'wiki-paste-html-btn';
        insertBtn.textContent = 'Insert';
        insertBtn.disabled = true;

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'wiki-paste-html-btn wiki-paste-html-btn-secondary';
        cancelBtn.textContent = 'Cancel';

        actions.append(lookupBtn, insertBtn, cancelBtn);

        panel.append(title, label, idInput, status, actions);
        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);

        let ac: AbortController | null = null;
        let lastPreview: AdoWorkItemPreview | null = null;

        const cleanup = () => {
            ac?.abort();
            backdrop.remove();
            document.removeEventListener('keydown', onKeyDown, true);
        };

        const finish = (value: WikiWorkItemPickerResult | null) => {
            cleanup();
            resolve(value);
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                finish(null);
            }
        };
        document.addEventListener('keydown', onKeyDown, true);

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) finish(null);
        });

        cancelBtn.addEventListener('click', () => finish(null));

        lookupBtn.addEventListener('click', () => {
            const raw = idInput.value.trim();
            if (!/^\d{2,}$/.test(raw)) {
                status.textContent = 'Id must be at least two digits.';
                lastPreview = null;
                insertBtn.disabled = true;
                return;
            }
            ac?.abort();
            ac = new AbortController();
            status.textContent = 'Loading…';
            lastPreview = null;
            insertBtn.disabled = true;
            void fetchAdoWorkItemPreview(raw, ac.signal)
                .then((p) => {
                    if (!p) {
                        status.textContent = 'Could not load work item (check id and wiki page context).';
                        return;
                    }
                    lastPreview = p;
                    status.textContent = `${p.workItemType || 'Work item'} ${p.id}: ${p.title || '(no title)'} — ${p.state || '(no state)'}`;
                    insertBtn.disabled = false;
                })
                .catch(() => {
                    status.textContent = 'Request failed.';
                });
        });

        insertBtn.addEventListener('click', () => {
            if (!lastPreview) return;
            finish(lastPreview);
        });

        idInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                lookupBtn.click();
            }
        });

        queueMicrotask(() => idInput.focus());
    });
}
