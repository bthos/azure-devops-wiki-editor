/**
 * People mention profile card (ADO-style) — click @mention to show name, avatar/initials, contact.
 */

import type { AdoMentionService, IIdentity } from '../services/mention-service';

let activeCard: HTMLElement | null = null;
let hideListener: ((e: MouseEvent) => void) | null = null;
let keyListener: ((e: KeyboardEvent) => void) | null = null;

function removeCard() {
    if (activeCard?.parentNode) {
        activeCard.parentNode.removeChild(activeCard);
    }
    activeCard = null;
    if (hideListener) {
        document.removeEventListener('mousedown', hideListener, true);
        hideListener = null;
    }
    if (keyListener) {
        document.removeEventListener('keydown', keyListener, true);
        keyListener = null;
    }
}

function initialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isProbablyEmail(s: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function teamsChatUrl(upnOrEmail: string): string {
    return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(upnOrEmail)}`;
}

function buildCardShell(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'ado-mention-profile-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'User profile');
    return card;
}

function renderCardContent(card: HTMLElement, identity: IIdentity, loading: boolean) {
    const email =
        identity.mailAddress ||
        (identity.principalName && isProbablyEmail(identity.principalName) ? identity.principalName : undefined) ||
        (identity.uniqueName && isProbablyEmail(identity.uniqueName) ? identity.uniqueName : undefined);
    const chatTarget = email || identity.principalName || identity.uniqueName;

    const avatarHtml = identity.imageUrl
        ? `<img class="ado-mention-profile-card__avatar-img" src="${escapeAttr(identity.imageUrl)}" alt="" />`
        : `<div class="ado-mention-profile-card__avatar-fallback">${escapeHtml(
              initialsFromName(identity.displayName)
          )}</div>`;

    card.innerHTML = `
        <div class="ado-mention-profile-card__header">
            <div class="ado-mention-profile-card__avatar">${avatarHtml}</div>
            <div class="ado-mention-profile-card__title">${escapeHtml(identity.displayName)}</div>
        </div>
        <div class="ado-mention-profile-card__divider"></div>
        <div class="ado-mention-profile-card__section">
            <div class="ado-mention-profile-card__section-title">Contact</div>
            ${
                loading
                    ? `<div class="ado-mention-profile-card__muted">Loading…</div>`
                    : email
                      ? `<a class="ado-mention-profile-card__link" href="mailto:${escapeAttr(email)}">${escapeHtml(
                            email
                        )}</a>`
                      : `<div class="ado-mention-profile-card__muted">No email available</div>`
            }
            ${
                !loading && chatTarget && isProbablyEmail(String(chatTarget))
                    ? `<div class="ado-mention-profile-card__chat-row">
                         <a class="ado-mention-profile-card__link" href="${escapeAttr(
                             teamsChatUrl(String(chatTarget))
                         )}" target="_blank" rel="noopener noreferrer">Start chat</a>
                       </div>`
                    : ''
            }
        </div>
    `;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
    return escapeHtml(s).replace(/'/g, '&#39;');
}

function positionCard(card: HTMLElement, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    card.style.position = 'fixed';
    card.style.top = `${rect.bottom + margin}px`;
    card.style.left = `${rect.left}px`;
    card.style.zIndex = '100000';

    document.body.appendChild(card);

    requestAnimationFrame(() => {
        const cr = card.getBoundingClientRect();
        let left = rect.left;
        if (cr.right > window.innerWidth - 8) {
            left = Math.max(8, window.innerWidth - cr.width - 8);
            card.style.left = `${left}px`;
        }
        if (cr.bottom > window.innerHeight - 8) {
            const topAbove = rect.top - cr.height - margin;
            card.style.top = `${Math.max(8, topAbove)}px`;
        }
    });
}

/**
 * Attach click handling for `.ado-mention` inside the editor root.
 */
export function setupMentionProfileCard(editorRoot: HTMLElement, service: AdoMentionService | null): void {
    if (!service) {
        return;
    }

    editorRoot.addEventListener(
        'click',
        async (ev) => {
            const target = ev.target as HTMLElement;
            const mention = target.closest('.ado-mention') as HTMLElement | null;
            if (!mention || !editorRoot.contains(mention)) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();

            removeCard();

            const userName = mention.dataset.userName?.trim() || '';
            if (!userName) {
                return;
            }

            const card = buildCardShell();
            activeCard = card;

            const storageKey = service.resolveStorageKeyFromDisplayName(userName) || '';
            let identity: IIdentity | null = storageKey ? service.getCachedIdentity(storageKey) || null : null;

            renderCardContent(
                card,
                identity || { id: '', displayName: userName },
                true
            );
            positionCard(card, mention);

            if (storageKey) {
                const enriched = await service.fetchIdentityForCard(storageKey);
                if (enriched && activeCard === card) {
                    renderCardContent(card, enriched, false);
                } else if (activeCard === card && identity) {
                    renderCardContent(card, identity, false);
                } else if (activeCard === card) {
                    renderCardContent(
                        card,
                        { id: storageKey, displayName: userName },
                        false
                    );
                }
            } else {
                if (activeCard === card) {
                    renderCardContent(
                        card,
                        { id: '', displayName: userName },
                        false
                    );
                }
            }

            hideListener = (e: MouseEvent) => {
                if (activeCard && !activeCard.contains(e.target as Node) && !mention.contains(e.target as Node)) {
                    removeCard();
                }
            };
            keyListener = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    removeCard();
                }
            };
            setTimeout(() => {
                document.addEventListener('mousedown', hideListener!, true);
                document.addEventListener('keydown', keyListener!, true);
            }, 0);
        },
        true
    );
}
