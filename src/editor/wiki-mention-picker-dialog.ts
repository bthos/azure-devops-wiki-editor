import type { AdoMentionService, IIdentity } from '../services/mention-service';

export type WikiMentionPickerOptions = {
    mentionService: AdoMentionService;
    title?: string;
};

function initials(displayName: string): string {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

function secondaryLine(m: IIdentity): string {
    const u = m.uniqueName?.trim();
    const mail = m.mailAddress?.trim();
    if (mail) return mail;
    if (u && u !== m.displayName) return u;
    return '';
}

/**
 * ADO-style @ picker: load project team members via Core REST, filter by search, return selected identity or `null`.
 */
export function openWikiMentionPickerDialog(options: WikiMentionPickerOptions): Promise<IIdentity | null> {
    return new Promise((resolve) => {
        if (typeof document === 'undefined') {
            resolve(null);
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'wiki-mention-picker-backdrop';
        backdrop.setAttribute('role', 'presentation');

        const panel = document.createElement('div');
        panel.className = 'wiki-mention-picker-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'wiki-mention-picker-title');

        const title = document.createElement('h2');
        title.id = 'wiki-mention-picker-title';
        title.className = 'wiki-mention-picker-title';
        title.textContent = options.title ?? 'Mention someone';

        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'wiki-mention-picker-search';
        search.placeholder = 'Filter by name or email…';
        search.setAttribute('aria-label', 'Filter members');

        const status = document.createElement('p');
        status.className = 'wiki-mention-picker-status';
        status.textContent = 'Loading team members…';

        const list = document.createElement('ul');
        list.className = 'wiki-mention-picker-list';
        list.setAttribute('role', 'listbox');

        const actions = document.createElement('div');
        actions.className = 'wiki-mention-picker-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'wiki-paste-html-btn wiki-paste-html-btn-secondary';
        cancelBtn.textContent = 'Cancel';
        actions.appendChild(cancelBtn);

        let members: IIdentity[] = [];
        let ac: AbortController | null = null;

        const cleanup = () => {
            ac?.abort();
            backdrop.remove();
            document.removeEventListener('keydown', onKeyDown, true);
        };

        const finish = (value: IIdentity | null) => {
            cleanup();
            resolve(value);
        };

        const renderList = () => {
            list.innerHTML = '';
            const q = search.value.trim().toLowerCase();
            const filtered = q
                ? members.filter((m) => {
                      const hay = `${m.displayName} ${m.uniqueName ?? ''} ${m.mailAddress ?? ''}`.toLowerCase();
                      return hay.includes(q);
                  })
                : members;

            if (filtered.length === 0) {
                const li = document.createElement('li');
                li.className = 'wiki-mention-picker-empty';
                li.textContent = members.length === 0 ? 'No members returned for this project.' : 'No matches.';
                list.appendChild(li);
                return;
            }

            for (const m of filtered) {
                const li = document.createElement('li');
                li.className = 'wiki-mention-picker-item';
                li.setAttribute('role', 'option');
                li.tabIndex = 0;

                const av = document.createElement('div');
                av.className = 'wiki-mention-picker-avatar';
                if (m.imageUrl) {
                    const img = document.createElement('img');
                    img.src = m.imageUrl;
                    img.alt = '';
                    av.appendChild(img);
                } else {
                    av.textContent = initials(m.displayName);
                }

                const textCol = document.createElement('div');
                textCol.className = 'wiki-mention-picker-text';

                const nameRow = document.createElement('div');
                nameRow.className = 'wiki-mention-picker-name';
                nameRow.textContent = m.displayName;

                const sub = document.createElement('div');
                sub.className = 'wiki-mention-picker-sub';
                const line2 = secondaryLine(m);
                sub.textContent = line2 || '\u00a0';

                textCol.append(nameRow, sub);
                li.append(av, textCol);

                const pick = () => finish(m);
                li.addEventListener('click', (e) => {
                    e.preventDefault();
                    pick();
                });
                li.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        pick();
                    }
                });

                list.appendChild(li);
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(null);
            }
        };

        cancelBtn.addEventListener('click', () => finish(null));
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) finish(null);
        });
        search.addEventListener('input', () => renderList());

        panel.append(title, search, status, list, actions);
        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);
        document.addEventListener('keydown', onKeyDown, true);

        ac = new AbortController();
        void options.mentionService
            .fetchProjectTeamMembers({ signal: ac.signal })
            .then((rows) => {
                members = rows;
                status.textContent = rows.length ? `Showing ${rows.length} member(s).` : 'No members found.';
                renderList();
                requestAnimationFrame(() => search.focus());
            })
            .catch((err) => {
                if ((err as Error)?.name === 'AbortError') return;
                status.textContent = 'Could not load team members.';
                console.warn('wiki mention picker', err);
                renderList();
            });
    });
}
