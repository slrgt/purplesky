/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Main Layout – Navigation, Header, App Shell
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is the root layout for all pages. It provides:
 *  - App context (global state)
 *  - Floating top-right account/login button (no top navbar)
 *  - Floating bottom navigation bar (iOS-style tab bar)
 *  - Theme initialization
 *  - Session restoration on app load
 *
 * HOW TO EDIT:
 *  - To add a new nav tab, add an entry to the navItems array below
 *  - To change the header, edit the <header> section
 *  - Theme switching happens in the account menu
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { component$, Slot, useVisibleTask$, useSignal, $ } from '@builder.io/qwik';
import { Link, useLocation, useNavigate } from '@builder.io/qwik-city';
import { useAppProvider, useAppState } from '~/context/app-context';
import type { ThemeMode, CardViewMode } from '~/lib/types';

import { ComposeModal } from '~/components/compose-modal/compose-modal';
import './layout.css';

export default component$(() => {
  const store = useAppProvider();
  const loc = useLocation();
  const nav = useNavigate();

  const showAbout = useSignal(false);
  const accountMenuOpen = useSignal(false);
  const accountWrapRef = useSignal<HTMLElement>();
  const otherAccounts = useSignal<Array<{ did: string; handle: string; avatar?: string }>>([]);
  const navSearchOpen = useSignal(false);
  const navSearchQuery = useSignal('');
  const navSearchRef = useSignal<HTMLInputElement>();

  // Auto-dismiss global toast after 2.5s
  useVisibleTask$(({ track, cleanup }) => {
    track(() => store.toastMessage);
    if (!store.toastMessage) return;
    const id = setTimeout(() => {
      store.toastMessage = null;
    }, 2500);
    cleanup(() => clearTimeout(id));
  });

  // ── Scroll Position Preservation ────────────────────────────────────────
  // Saves scroll position continuously. On back/forward (browser button,
  // mobile edge-swipe, Q key), restores exactly where you were.
  // Forward navigation (clicking a link) scrolls to top as normal.
  useVisibleTask$(({ cleanup }) => {
    // Disable the browser's built-in scroll restoration so we control it
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    const SCROLL_KEY = 'purplesky-scroll-positions';

    function getScrollMap(): Record<string, number> {
      try {
        const raw = sessionStorage.getItem(SCROLL_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    }

    function saveCurrentScroll() {
      const map = getScrollMap();
      map[location.pathname + location.search] = window.scrollY;
      try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify(map)); } catch { /* ignore */ }
      // Also embed in history.state for back/forward accuracy
      try {
        const state = history.state ?? {};
        history.replaceState({ ...state, _scrollY: window.scrollY }, '');
      } catch { /* ignore */ }
    }

    // Debounced scroll save — keeps position fresh as user scrolls
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(saveCurrentScroll, 100);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Before internal link clicks, snapshot the scroll position immediately
    const onClickCapture = (e: Event) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (anchor && anchor.href && new URL(anchor.href).origin === location.origin) {
        saveCurrentScroll();
      }
    };
    document.addEventListener('click', onClickCapture, true);

    // On popstate (back button, forward button, mobile swipe-back), restore scroll
    const onPopState = (e: PopStateEvent) => {
      const stateScroll = (e.state as { _scrollY?: number } | null)?._scrollY;
      const key = location.pathname + location.search;

      const scrollTarget = typeof stateScroll === 'number'
        ? stateScroll
        : (getScrollMap()[key] ?? null);
      if (scrollTarget === null || scrollTarget === 0) return;

      // Hide the page while we jump to the saved position so the user
      // doesn't see the scroll animate down — they just appear there.
      const main = document.getElementById('main-content');
      if (main) main.style.visibility = 'hidden';

      const tryRestore = (attempts: number) => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: scrollTarget, behavior: 'instant' as ScrollBehavior });
          if (attempts > 0) {
            setTimeout(() => tryRestore(attempts - 1), 60);
          } else {
            // All attempts done — reveal the page at the final position
            requestAnimationFrame(() => {
              if (main) main.style.visibility = '';
            });
          }
        });
      };
      setTimeout(() => tryRestore(4), 10);
    };
    window.addEventListener('popstate', onPopState);

    cleanup(() => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('popstate', onPopState);
      if (scrollTimer) clearTimeout(scrollTimer);
    });
  });

  // ── Restore scroll when navigating to Home (or any page) via link ─────
  // Popstate handles back/forward; this handles clicking Home / nav links.
  useVisibleTask$(({ track, cleanup }) => {
    track(() => loc.url.pathname);
    track(() => loc.url.search);
    const pathname = loc.url.pathname;
    const key = loc.url.pathname + loc.url.search;
    const SCROLL_KEY = 'purplesky-scroll-positions';
    function getScrollMap(): Record<string, number> {
      try {
        const raw = sessionStorage.getItem(SCROLL_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    }
    const scrollTarget = getScrollMap()[key];
    if (scrollTarget == null || scrollTarget <= 0) return;
    const main = document.getElementById('main-content');
    if (main) main.style.visibility = 'hidden';
    const tryRestore = (attempts: number) => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollTarget, behavior: 'instant' as ScrollBehavior });
        if (attempts > 0) {
          setTimeout(() => tryRestore(attempts - 1), 60);
        } else {
          requestAnimationFrame(() => {
            if (main) main.style.visibility = '';
          });
        }
      });
    };
    const t = setTimeout(() => tryRestore(4), 50);
    cleanup(() => clearTimeout(t));
  });

  // ── Restore session & theme on first load (browser only) ──────────────
  useVisibleTask$(async () => {
    // Restore theme from localStorage
    const savedTheme = localStorage.getItem('purplesky-theme') as ThemeMode | null;
    if (savedTheme) {
      store.theme = savedTheme;
      document.documentElement.setAttribute('data-theme', savedTheme === 'system' ? '' : savedTheme);
    }

    // Restore view columns
    const savedCols = localStorage.getItem('purplesky-view-columns');
    if (savedCols) store.viewColumns = parseInt(savedCols) as 1 | 2 | 3;

    // Restore card view mode and NSFW preference
    const savedCardView = localStorage.getItem('purplesky-card-view') as CardViewMode | null;
    if (savedCardView === 'full' || savedCardView === 'mini' || savedCardView === 'art') store.cardViewMode = savedCardView;
    const savedNsfw = localStorage.getItem('purplesky-nsfw-mode') as 'hide' | 'blur' | 'show' | null;
    if (savedNsfw === 'hide' || savedNsfw === 'blur' || savedNsfw === 'show') store.nsfwMode = savedNsfw;
    const savedMediaOnly = localStorage.getItem('purplesky-media-only');
    if (savedMediaOnly === '1') store.mediaOnly = true;

    // Restore session
    try {
      const { resumeSession, getSession } = await import('~/lib/bsky');

      // Check for OAuth callback
      const params = new URLSearchParams(window.location.search);
      const hasCallback = params.has('state') && (params.has('code') || params.has('error'));

      if (hasCallback) {
        const { initOAuth } = await import('~/lib/oauth');
        const result = await initOAuth({ hasCallback: true });
        if (result?.session) {
          const { Agent } = await import('@atproto/api');
          const oauthAgent = new Agent(result.session);
          const { setOAuthAgent, addOAuthDid } = await import('~/lib/bsky');
          setOAuthAgent(oauthAgent, result.session);
          addOAuthDid(oauthAgent.did!, true);
          // Clean URL
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        }
      } else {
        // Try restoring existing session
        const { initOAuth } = await import('~/lib/oauth');
        const oauthResult = await initOAuth().catch(() => undefined);
        if (oauthResult?.session) {
          const { Agent } = await import('@atproto/api');
          const oauthAgent = new Agent(oauthResult.session);
          const { setOAuthAgent, addOAuthDid } = await import('~/lib/bsky');
          setOAuthAgent(oauthAgent, oauthResult.session);
          addOAuthDid(oauthAgent.did!, true);
        } else {
          await resumeSession();
        }
      }

      // Update store with session info
      const session = getSession();
      if (session?.did) {
        store.session.did = session.did;
        store.session.isLoggedIn = true;
        // Fetch profile for handle/avatar
        try {
          const { agent } = await import('~/lib/bsky');
          const profile = await agent.getProfile({ actor: session.did });
          const d = profile.data as { handle?: string; avatar?: string; displayName?: string };
          store.session.handle = d.handle ?? null;
          store.session.avatar = d.avatar ?? null;
          // Cache profile for account switcher
          const { saveAccountProfile } = await import('~/lib/bsky');
          saveAccountProfile({ did: session.did, handle: d.handle ?? session.did, avatar: d.avatar, displayName: d.displayName });
        } catch { /* ignore */ }
      }

      // Load other accounts for the switcher
      try {
        const { getOAuthAccountsSnapshot, getAccountProfiles } = await import('~/lib/bsky');
        const oauthSnap = getOAuthAccountsSnapshot();
        const profiles = getAccountProfiles();
        const currentDid = session?.did;
        const others = oauthSnap.dids
          .filter((d: string) => d !== currentDid)
          .map((d: string) => {
            const p = profiles[d];
            return { did: d, handle: p?.handle ?? d.slice(0, 16) + '…', avatar: p?.avatar };
          });
        otherAccounts.value = others;
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Session restore failed:', err);
    }
  });

  // Close account dropdown on outside click
  useVisibleTask$(({ track, cleanup }) => {
    track(() => accountMenuOpen.value);
    const close = (e: Event) => {
      const t = e.target as Node;
      if (accountMenuOpen.value && accountWrapRef.value && !accountWrapRef.value.contains(t)) accountMenuOpen.value = false;
    };
    document.addEventListener('click', close);
    cleanup(() => document.removeEventListener('click', close));
  });

  /** Switch to another logged-in account by DID. */
  const onSwitchAccount = $(async (did: string) => {
    accountMenuOpen.value = false;
    try {
      const { restoreOAuthSession } = await import('~/lib/oauth');
      const { Agent } = await import('@atproto/api');
      const session = await restoreOAuthSession(did);
      if (!session) return;
      const oauthAgent = new Agent(session);
      const { setOAuthAgent, setActiveOAuthDid, saveAccountProfile, getOAuthAccountsSnapshot, getAccountProfiles } = await import('~/lib/bsky');
      setOAuthAgent(oauthAgent, session);
      setActiveOAuthDid(did);
      // Update store with new profile
      store.session.did = did;
      store.session.isLoggedIn = true;
      try {
        const { agent } = await import('~/lib/bsky');
        const profile = await agent.getProfile({ actor: did });
        const d = profile.data as { handle?: string; avatar?: string; displayName?: string };
        store.session.handle = d.handle ?? null;
        store.session.avatar = d.avatar ?? null;
        saveAccountProfile({ did, handle: d.handle ?? did, avatar: d.avatar, displayName: d.displayName });
      } catch { /* ignore */ }
      // Rebuild other accounts list
      const oauthSnap = getOAuthAccountsSnapshot();
      const profiles = getAccountProfiles();
      otherAccounts.value = oauthSnap.dids
        .filter((d: string) => d !== did)
        .map((d: string) => {
          const p = profiles[d];
          return { did: d, handle: p?.handle ?? d.slice(0, 16) + '…', avatar: p?.avatar };
        });
      // Reload page to refresh feeds for the new account
      window.location.reload();
    } catch (err) {
      console.error('Account switch failed:', err);
    }
  });

  /** Log out the current account. If others remain, switch to the next one. */
  const onLogout = $(async () => {
    const currentDid = store.session.did;
    if (!currentDid) return;
    const { logoutAccount } = await import('~/lib/bsky');
    const nextDid = await logoutAccount(currentDid);
    if (nextDid) {
      // Switch to next account
      await onSwitchAccount(nextDid);
    } else {
      // No accounts left — fully logged out
      store.session.did = null;
      store.session.handle = null;
      store.session.avatar = null;
      store.session.isLoggedIn = false;
      otherAccounts.value = [];
      accountMenuOpen.value = false;
    }
  });

  /** Open login modal to add another account. */
  const onAddAccount = $(() => {
    accountMenuOpen.value = false;
    store.showLoginModal = true;
  });

  // ── Theme Toggle ────────────────────────────────────────────────────────
  const cycleTheme = $(() => {
    const modes: ThemeMode[] = ['dark', 'light', 'high-contrast', 'system'];
    const idx = modes.indexOf(store.theme);
    const next = modes[(idx + 1) % modes.length];
    store.theme = next;
    document.documentElement.setAttribute('data-theme', next === 'system' ? '' : next);
    localStorage.setItem('purplesky-theme', next);
  });

  // ── Global Keyboard Shortcuts ──────────────────────────────────────────
  useVisibleTask$(({ cleanup }) => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when login modal or about dialog is open
      if (store.showLoginModal || store.showComposeModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          store.showLoginModal = false;
          store.showComposeModal = false;
        }
        return;
      }
      if (showAbout.value) {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'q') {
          e.preventDefault();
          showAbout.value = false;
        }
        return;
      }

      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        if (e.key === 'Escape') {
          e.preventDefault();
          target.blur();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) return;

      const key = e.key.toLowerCase();

      // 1/2/3 = column count
      if (key === '1' || key === '2' || key === '3') {
        e.preventDefault();
        store.viewColumns = parseInt(key) as 1 | 2 | 3;
        localStorage.setItem('purplesky-view-columns', key);
        return;
      }

      // T = cycle theme
      if (key === 't') {
        e.preventDefault();
        const modes: ThemeMode[] = ['dark', 'light', 'high-contrast', 'system'];
        const idx = modes.indexOf(store.theme);
        const next = modes[(idx + 1) % modes.length];
        store.theme = next;
        document.documentElement.setAttribute('data-theme', next === 'system' ? '' : next);
        localStorage.setItem('purplesky-theme', next);
        return;
      }

      // Escape = close any open dropdown
      if (e.key === 'Escape') {
        e.preventDefault();
        accountMenuOpen.value = false;
        return;
      }

      // / = go to search page
      if (key === '/') {
        e.preventDefault();
        const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
        nav(`${base}/search/`);
        return;
      }

      // ? = show keyboard shortcuts help
      if (e.key === '?') {
        e.preventDefault();
        showAbout.value = true;
        return;
      }

      // Q = go back (except on feed page where it's handled by feed nav)
      if (key === 'q' && e.key !== 'Backspace') {
        const path = loc.url.pathname;
        if (path !== '/' && !path.startsWith('/feed')) {
          e.preventDefault();
          window.history.back();
        }
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    cleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  // ── Nav Items ───────────────────────────────────────────────────────────
  const navItems = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/forum/', label: 'Forums', icon: 'forum' },
    { href: '/consensus/', label: 'Consensus', icon: 'consensus' },
    { href: '/collab/', label: 'Collab', icon: 'collab' },
    { href: '/artboards/', label: 'Collections', icon: 'collections' },
  ];

  const pathname = loc.url.pathname;
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';
  const pathAfterBase = pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
  const isHome = pathAfterBase === '/' || pathAfterBase === '';
  const showBackButton = !isHome;

  return (
    <div class="app-shell">
      {/* ── Floating back button (top-left), when on a page we can go back from ── */}
      {showBackButton && (
        <button
          type="button"
          class="floating-back float-btn"
          aria-label="Back"
          onClick$={() => { history.back(); }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* ── Floating top-right: Account or Login (no top navbar) ───────────── */}
      <div class="floating-top-right" ref={accountWrapRef}>
        {store.session.isLoggedIn ? (
          <>
            {/* New post to the left of account */}
            <button
              class="floating-fab float-btn"
              aria-label="New post"
              onClick$={() => { store.showComposeModal = true; }}
            >
              New post
            </button>
            <div class="floating-top-right-col">
              <div class="account-btn-wrap">
                <button
                  class="floating-fab float-btn"
                  aria-label="Account menu"
                  aria-expanded={accountMenuOpen.value}
                  onClick$={() => { accountMenuOpen.value = !accountMenuOpen.value; }}
                >
                  {store.session.avatar ? (
                    <img src={store.session.avatar} alt="" width="28" height="28" class="floating-avatar" />
                  ) : (
                    <span class="floating-avatar-placeholder">{(store.session.handle ?? '?')[0].toUpperCase()}</span>
                  )}
                </button>
                {accountMenuOpen.value && (
                  <div class="account-dropdown glass-strong">
                    {/* ── Current account ── */}
                    {store.session.handle && (
                      <button
                        type="button"
                        class="acct-row acct-current"
                        onClick$={async () => {
                          const handle = store.session.handle;
                          accountMenuOpen.value = false;
                          if (handle) {
                            const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
                            await nav(`${base}/profile/${encodeURIComponent(handle)}/`);
                          }
                        }}
                      >
                        {store.session.avatar ? (
                          <img src={store.session.avatar} alt="" width="24" height="24" class="acct-avatar" />
                        ) : (
                          <span class="acct-avatar-ph">{(store.session.handle ?? '?')[0].toUpperCase()}</span>
                        )}
                        <span class="acct-info">
                          <span class="acct-handle">@{store.session.handle}</span>
                          <span class="acct-label">View profile</span>
                        </span>
                      </button>
                    )}

                    {/* ── Other accounts ── */}
                    {otherAccounts.value.length > 0 && (
                      <div class="acct-section">
                        <div class="acct-divider" />
                        {otherAccounts.value.map((acct) => (
                          <button
                            key={acct.did}
                            type="button"
                            class="acct-row"
                            onClick$={() => onSwitchAccount(acct.did)}
                          >
                            {acct.avatar ? (
                              <img src={acct.avatar} alt="" width="24" height="24" class="acct-avatar" />
                            ) : (
                              <span class="acct-avatar-ph">{(acct.handle ?? '?')[0].toUpperCase()}</span>
                            )}
                            <span class="acct-info">
                              <span class="acct-handle">@{acct.handle}</span>
                              <span class="acct-label">Switch</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* ── Add account ── */}
                    <div class="acct-divider" />
                    <button type="button" onClick$={() => onAddAccount()}>
                      + Add account
                    </button>

                    {/* ── Utilities ── */}
                    <div class="acct-divider" />
                    <button type="button" onClick$={() => { cycleTheme(); accountMenuOpen.value = false; }}>
                      Theme
                    </button>

                    {/* ── Log out ── */}
                    <div class="acct-divider" />
                    <button type="button" class="acct-logout" onClick$={() => onLogout()}>
                      Log out @{store.session.handle ?? ''}
                    </button>
                  </div>
                )}
              </div>
              {/* Toggle buttons: card view (cycle), NSFW/blur (cycle), media only (toggle) */}
              <div class="float-toggles">
                {/* Card view: one button cycles Full → Mini → Art */}
                <button
                  type="button"
                  class="float-toggle-btn float-btn"
                  aria-label={`Card view: ${store.cardViewMode} (click to cycle)`}
                  title={`Card view: ${store.cardViewMode}`}
                  onClick$={() => {
                    const next = store.cardViewMode === 'full' ? 'mini' : store.cardViewMode === 'mini' ? 'art' : 'full';
                    store.cardViewMode = next;
                    localStorage.setItem('purplesky-card-view', next);
                    store.toastMessage = next === 'full' ? 'Full cards' : next === 'mini' ? 'Mini cards' : 'Art cards';
                  }}
                >
                  {store.cardViewMode === 'full' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="3" y1="14" x2="18" y2="14" />
                    </svg>
                  )}
                  {store.cardViewMode === 'mini' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="5" y="8" width="14" height="8" rx="1" />
                    </svg>
                  )}
                  {store.cardViewMode === 'art' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="2" y="2" width="20" height="20" rx="2" />
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                  )}
                </button>
                {/* NSFW/Blur: one button cycles SFW → Blur → NSFW */}
                <button
                  type="button"
                  class="float-toggle-btn float-btn"
                  aria-label={`Content: ${store.nsfwMode === 'hide' ? 'SFW' : store.nsfwMode === 'blur' ? 'Blur' : 'NSFW'} (click to cycle)`}
                  title={`Content: ${store.nsfwMode === 'hide' ? 'SFW' : store.nsfwMode === 'blur' ? 'Blur' : 'NSFW'}`}
                  onClick$={() => {
                    const next = store.nsfwMode === 'hide' ? 'blur' : store.nsfwMode === 'blur' ? 'show' : 'hide';
                    store.nsfwMode = next;
                    localStorage.setItem('purplesky-nsfw-mode', next);
                    store.toastMessage = next === 'hide' ? 'SFW' : next === 'blur' ? 'Blur' : 'NSFW';
                  }}
                >
                  {store.nsfwMode === 'hide' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M1 1l22 22" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    </svg>
                  )}
                  {store.nsfwMode === 'blur' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                  )}
                  {store.nsfwMode === 'show' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
                {/* Media only: one button toggles Media only ↔ Media and text */}
                <button
                  type="button"
                  class="float-toggle-btn float-btn"
                  aria-label={store.mediaOnly ? 'Media only (click for media and text)' : 'Media and text (click for media only)'}
                  title={store.mediaOnly ? 'Media only' : 'Media and text'}
                  onClick$={() => {
                    store.mediaOnly = !store.mediaOnly;
                    try { localStorage.setItem('purplesky-media-only', store.mediaOnly ? '1' : '0'); } catch { /* ignore */ }
                    store.toastMessage = store.mediaOnly ? 'Media only' : 'Media and text';
                  }}
                >
                  {store.mediaOnly ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <button class="floating-fab floating-login float-btn" onClick$={() => { store.showLoginModal = true; }} aria-label="Log in">
            Log in
          </button>
        )}
      </div>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main id="main-content" class="main-content">
        <Slot />
      </main>

      {/* ── Bottom Navigation (iOS-style floating tab bar) ─────────────── */}
      <nav class="nav glass" aria-label="Main navigation" role="tablist">
        {navSearchOpen.value ? (
          /* ── Expanded search bar ── */
          <form
            class="nav-search-bar"
            preventdefault:submit
            onSubmit$={async () => {
              const q = navSearchQuery.value.trim();
              if (q) {
                navSearchOpen.value = false;
                navSearchQuery.value = '';
                const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
                await nav(`${base}/search/?q=${encodeURIComponent(q)}`);
              }
            }}
          >
            <input
              ref={navSearchRef}
              type="text"
              class="nav-search-input"
              placeholder="Search…"
              autoFocus
              bind:value={navSearchQuery}
              onKeyDown$={(e) => {
                if ((e as KeyboardEvent).key === 'Escape') {
                  navSearchOpen.value = false;
                  navSearchQuery.value = '';
                }
              }}
            />
            <button type="submit" class="nav-search-go" aria-label="Search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            <button
              type="button"
              class="nav-search-close"
              aria-label="Close search"
              onClick$={() => { navSearchOpen.value = false; navSearchQuery.value = ''; }}
            >
              ✕
            </button>
          </form>
        ) : (
          /* ── Normal nav tabs + search button ── */
          <>
            {navItems.map((item) => {
              const isActive = loc.url.pathname === item.href ||
                (item.href !== '/' && loc.url.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  class={`nav-tab ${isActive ? 'nav-tab-active' : ''}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={item.label}
                >
                  <NavIcon name={item.icon} active={isActive} />
                  <span class="nav-label">{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              class={`nav-tab ${loc.url.pathname.startsWith('/search') ? 'nav-tab-active' : ''}`}
              role="tab"
              aria-label="Search"
              onClick$={() => {
                navSearchOpen.value = true;
                // Auto-focus after render
                setTimeout(() => navSearchRef.value?.focus(), 50);
              }}
            >
              <NavIcon name="search" active={loc.url.pathname.startsWith('/search')} />
              <span class="nav-label">Search</span>
            </button>
          </>
        )}
      </nav>

      {/* ── Login Modal ────────────────────────────────────────────────── */}
      {store.showLoginModal && <LoginModal />}

      {/* ── Compose Modal ───────────────────────────────────────────────── */}
      {store.showComposeModal && <ComposeModal />}

      {/* ── Global toast (e.g. card view mode, hide seen) ────────────────── */}
      {store.toastMessage && (
        <div class="app-toast float-btn" role="status" aria-live="polite">
          {store.toastMessage}
        </div>
      )}

      {/* ── Keyboard Shortcuts Help ────────────────────────────────────── */}
      {showAbout.value && (
        <div class="modal-overlay" onClick$={() => { showAbout.value = false; }}>
          <div class="modal-card glass-strong" onClick$={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h2 class="modal-title">PurpleSky</h2>
            <p style={{ color: 'var(--muted)', marginBottom: 'var(--space-lg)', fontSize: 'var(--font-sm)' }}>
              A Bluesky client for art, forums, consensus, and collaboration. Keyboard-friendly navigation.
            </p>
            <h3 style={{ fontWeight: '700', marginBottom: 'var(--space-sm)', fontSize: 'var(--font-md)' }}>Keyboard Shortcuts</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px var(--space-lg)', fontSize: 'var(--font-sm)' }}>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>W / ↑</kbd><span style={{ color: 'var(--muted)' }}>Move up</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>A / ←</kbd><span style={{ color: 'var(--muted)' }}>Move left</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>S / ↓</kbd><span style={{ color: 'var(--muted)' }}>Move down</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>D / →</kbd><span style={{ color: 'var(--muted)' }}>Move right</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>E</kbd><span style={{ color: 'var(--muted)' }}>Enter / open post</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>R</kbd><span style={{ color: 'var(--muted)' }}>Reply to post</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>F</kbd><span style={{ color: 'var(--muted)' }}>Like / unlike</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>C</kbd><span style={{ color: 'var(--muted)' }}>Collect (save to artboard)</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>Q</kbd><span style={{ color: 'var(--muted)' }}>Quit / go back</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>T</kbd><span style={{ color: 'var(--muted)' }}>Toggle theme</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>1 / 2 / 3</kbd><span style={{ color: 'var(--muted)' }}>Column count</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>/</kbd><span style={{ color: 'var(--muted)' }}>Go to search page</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>Escape</kbd><span style={{ color: 'var(--muted)' }}>Close / unfocus</span>
              <kbd style={{ fontWeight: '600', fontFamily: 'monospace' }}>?</kbd><span style={{ color: 'var(--muted)' }}>Show this help</span>
            </div>
            <button
              class="modal-close"
              onClick$={() => { showAbout.value = false; }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Nav Icons ─────────────────────────────────────────────────────────────

const NavIcon = component$<{ name: string; active: boolean }>(({ name, active }) => {
  const color = active ? 'var(--accent)' : 'var(--muted)';
  const sw = active ? '2.5' : '2';

  switch (name) {
    case 'home':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={sw}>
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'forum':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={sw}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      );
    case 'consensus':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={sw}>
          <path d="M12 20V10M18 20V4M6 20v-4" />
        </svg>
      );
    case 'collab':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={sw}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case 'collections':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={sw}>
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case 'search':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={sw}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    default:
      return <span>?</span>;
  }
});

// ── Login Modal ───────────────────────────────────────────────────────────

const LoginModal = component$(() => {
  const store = useAppState();

  const handleInput = useSignal('');
  const suggestions = useSignal<Array<{ did: string; handle: string; displayName?: string; avatar?: string }>>([]);
  const suggestionsLoading = useSignal(false);
  const showSuggestions = useSignal(false);
  const loginError = useSignal('');
  const loginLoading = useSignal(false);
  const suggestionsRef = useSignal<HTMLElement>();

  // Debounced typeahead search as user types
  useVisibleTask$(async ({ track, cleanup }) => {
    track(() => handleInput.value);
    const q = handleInput.value.trim();
    if (q.length < 2) {
      suggestions.value = [];
      showSuggestions.value = false;
      return;
    }
    const t = setTimeout(async () => {
      suggestionsLoading.value = true;
      try {
        const { searchActorsTypeahead } = await import('~/lib/bsky');
        const res = await searchActorsTypeahead(q, 6);
        const actors = (res as { actors?: Array<{ did: string; handle: string; displayName?: string; avatar?: string }> }).actors ?? [];
        suggestions.value = actors;
        showSuggestions.value = actors.length > 0;
      } catch {
        suggestions.value = [];
      }
      suggestionsLoading.value = false;
    }, 250);
    cleanup(() => clearTimeout(t));
  });

  const selectSuggestion = $((handle: string) => {
    handleInput.value = handle;
    showSuggestions.value = false;
  });

  const handleOAuthLogin = $(async (handle: string) => {
    if (!handle) return;
    loginError.value = '';
    loginLoading.value = true;
    try {
      const { signInWithOAuthRedirect, normalizeHandle } = await import('~/lib/oauth');
      const normalized = normalizeHandle(handle);
      handleInput.value = normalized;
      await signInWithOAuthRedirect(normalized);
    } catch (err) {
      console.error('OAuth login failed:', err);
      loginError.value = err instanceof Error ? err.message : 'Login failed. Check your handle and try again.';
      loginLoading.value = false;
    }
  });

  return (
    <div class="modal-overlay" onClick$={() => { store.showLoginModal = false; }}>
      <div class="modal-card glass-strong" onClick$={(e) => e.stopPropagation()}>
        <h2 class="modal-title">Log in with Bluesky</h2>
        <p class="modal-subtitle">Enter your Bluesky handle or custom domain</p>

        <form
          preventdefault:submit
          onSubmit$={() => {
            const handle = handleInput.value.trim();
            if (handle) handleOAuthLogin(handle);
          }}
        >
          <div style={{ position: 'relative' }} ref={suggestionsRef}>
            <input
              type="text"
              placeholder="yourname.bsky.social or custom.domain"
              class="modal-input"
              autoFocus
              bind:value={handleInput}
              onFocus$={() => { if (suggestions.value.length > 0) showSuggestions.value = true; }}
              onBlur$={() => { setTimeout(() => { showSuggestions.value = false; }, 200); }}
            />
            {/* Typeahead suggestions dropdown */}
            {showSuggestions.value && suggestions.value.length > 0 && (
              <div class="login-suggestions glass" style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                borderRadius: 'var(--glass-radius-sm)', overflow: 'hidden',
                maxHeight: '240px', overflowY: 'auto',
              }}>
                {suggestions.value.map((actor) => (
                  <button
                    key={actor.did}
                    type="button"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                      width: '100%', padding: 'var(--space-sm) var(--space-md)',
                      textAlign: 'left', background: 'none', border: 'none',
                      color: 'var(--text)', cursor: 'pointer', fontSize: 'var(--font-sm)',
                      minHeight: 'auto',
                    }}
                    onClick$={() => selectSuggestion(actor.handle)}
                    onMouseDown$={(e) => e.preventDefault()}
                  >
                    {actor.avatar && (
                      <img src={actor.avatar} alt="" width="28" height="28" style={{ borderRadius: '50%', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {actor.displayName && (
                        <div style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {actor.displayName}
                        </div>
                      )}
                      <div style={{ color: 'var(--muted)', fontSize: 'var(--font-xs)' }}>@{actor.handle}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {suggestionsLoading.value && (
              <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                <div class="spinner" style={{ width: '16px', height: '16px' }} />
              </div>
            )}
          </div>

          {loginError.value && (
            <p style={{ color: 'var(--danger)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-sm)' }}>
              {loginError.value}
            </p>
          )}

          <button type="submit" class="btn modal-submit" disabled={loginLoading.value}>
            {loginLoading.value ? 'Redirecting…' : 'Continue with Bluesky'}
          </button>
        </form>

        <p style={{ color: 'var(--muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-md)', textAlign: 'center' }}>
          Works with any AT Protocol PDS — just enter your full handle.
        </p>

        <button
          class="modal-close"
          onClick$={() => { store.showLoginModal = false; }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
});
