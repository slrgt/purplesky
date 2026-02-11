/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Main Layout – Navigation, Header, App Shell
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is the root layout for all pages. It provides:
 *  - App context (global state)
 *  - Fixed header with logo, search, account menu
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
import type { ThemeMode } from '~/lib/types';

import './layout.css';

export default component$(() => {
  const store = useAppProvider();
  const loc = useLocation();
  const nav = useNavigate();

  const searchQuery = useSignal('');
  const searchOpen = useSignal(false);
  const searchLoading = useSignal(false);
  const searchResults = useSignal<{
    actors: Array<{ did: string; handle: string; displayName?: string; avatar?: string }>;
    posts: Array<{ uri: string; author?: { handle: string; displayName?: string }; record?: { text?: string } }>;
  }>({ actors: [], posts: [] });
  const accountMenuOpen = useSignal(false);
  const searchWrapRef = useSignal<HTMLElement>();
  const accountWrapRef = useSignal<HTMLElement>();

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
          const d = profile.data as { handle?: string; avatar?: string };
          store.session.handle = d.handle ?? null;
          store.session.avatar = d.avatar ?? null;
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('Session restore failed:', err);
    }
  });

  // Close dropdowns on outside click
  useVisibleTask$(({ track, cleanup }) => {
    track(() => searchOpen.value);
    track(() => accountMenuOpen.value);
    const close = (e: Event) => {
      const t = e.target as Node;
      if (searchOpen.value && searchWrapRef.value && !searchWrapRef.value.contains(t)) searchOpen.value = false;
      if (accountMenuOpen.value && accountWrapRef.value && !accountWrapRef.value.contains(t)) accountMenuOpen.value = false;
    };
    document.addEventListener('click', close);
    cleanup(() => document.removeEventListener('click', close));
  });

  // Debounced search when query length >= 2
  useVisibleTask$(async ({ track, cleanup }) => {
    track(() => searchQuery.value);
    const q = searchQuery.value.trim();
    if (q.length < 2) {
      searchResults.value = { actors: [], posts: [] };
      searchOpen.value = false;
      return;
    }
    const t = setTimeout(async () => {
      searchLoading.value = true;
      try {
        const [actorRes, postRes] = await Promise.all([
          import('~/lib/bsky').then((m) => m.searchActorsTypeahead(q, 5)),
          import('~/lib/bsky').then((m) => m.searchPostsByQuery(q, undefined)),
        ]);
        const actors = (actorRes as { actors?: Array<{ did: string; handle: string; displayName?: string; avatar?: string }> }).actors ?? [];
        const posts = (postRes.posts ?? []).slice(0, 5);
        searchResults.value = { actors, posts };
        searchOpen.value = true;
      } catch {
        searchResults.value = { actors: [], posts: [] };
      }
      searchLoading.value = false;
    }, 300);
    cleanup(() => clearTimeout(t));
  });

  const onSearchSubmit = $(() => {
    const q = searchQuery.value.trim();
    if (q) nav(`/search?q=${encodeURIComponent(q)}`);
    searchOpen.value = false;
  });

  const onLogout = $(async () => {
    const { logout } = await import('~/lib/bsky');
    await logout();
    store.session.did = null;
    store.session.handle = null;
    store.session.avatar = null;
    store.session.isLoggedIn = false;
    accountMenuOpen.value = false;
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

  // ── Nav Items ───────────────────────────────────────────────────────────
  const navItems = [
    { href: '/', label: 'Feed', icon: 'home' },
    { href: '/forum/', label: 'Forums', icon: 'forum' },
    { href: '/consensus/', label: 'Consensus', icon: 'consensus' },
    { href: '/collab/', label: 'Collab', icon: 'collab' },
    { href: '/artboards/', label: 'Collections', icon: 'collections' },
  ];

  return (
    <div class="app-shell">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header class="header glass">
        <div class="header-left">
          <Link href="/" class="logo-link" aria-label="PurpleSky Home">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="var(--accent)" stroke-width="2" />
              <circle cx="14" cy="14" r="6" fill="var(--accent)" />
            </svg>
            <span class="logo-text">PurpleSky</span>
          </Link>
        </div>

        <div class="header-center" ref={searchWrapRef}>
          <form class="search-bar" preventdefault:submit onSubmit$={onSearchSubmit}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search posts, people, tags..."
              class="search-input"
              bind:value={searchQuery}
              onFocus$={() => { if (searchResults.value.actors.length || searchResults.value.posts.length) searchOpen.value = true; }}
            />
          </form>
          {searchOpen.value && (searchLoading.value || searchResults.value.actors.length > 0 || searchResults.value.posts.length > 0) && (
            <div class="search-dropdown glass">
              {searchLoading.value && (
                <div class="search-dropdown-section">
                  <div style={{ padding: 'var(--space-md)', color: 'var(--muted)', fontSize: 'var(--font-sm)' }}>Searching…</div>
                </div>
              )}
              {!searchLoading.value && searchResults.value.actors.length > 0 && (
                <div class="search-dropdown-section">
                  <div class="search-dropdown-section-title">People</div>
                  {searchResults.value.actors.map((a) => (
                    <Link key={a.did} href={`/profile/${encodeURIComponent(a.handle)}/`} onClick$={() => { searchOpen.value = false; }}>
                      {a.avatar && <img src={a.avatar} alt="" width="24" height="24" style={{ borderRadius: '50%' }} />}
                      <span>{a.displayName || a.handle}</span>
                      <span style={{ color: 'var(--muted)', fontSize: 'var(--font-xs)' }}>@{a.handle}</span>
                    </Link>
                  ))}
                </div>
              )}
              {!searchLoading.value && searchResults.value.posts.length > 0 && (
                <div class="search-dropdown-section">
                  <div class="search-dropdown-section-title">Posts</div>
                  {searchResults.value.posts.map((p) => (
                    <Link key={p.uri} href={`/post/${encodeURIComponent(p.uri)}/`} onClick$={() => { searchOpen.value = false; }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(p.record?.text ?? '').slice(0, 60)}{(p.record?.text?.length ?? 0) > 60 ? '…' : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {!searchLoading.value && (
                <div class="search-dropdown-section">
                  <Link href={`/search?q=${encodeURIComponent(searchQuery.value.trim())}`} onClick$={() => { searchOpen.value = false; }}>
                    See all results for "{searchQuery.value.trim()}"
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div class="header-right">
          {/* Theme toggle */}
          <button class="icon-btn" onClick$={cycleTheme} aria-label="Toggle theme" title={`Theme: ${store.theme}`}>
            {store.theme === 'dark' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
            {store.theme === 'light' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
            {(store.theme === 'system' || store.theme === 'high-contrast') && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2" />
              </svg>
            )}
          </button>

          {/* Account / Login */}
          {store.session.isLoggedIn ? (
            <div style={{ position: 'relative' }} ref={accountWrapRef}>
              <button
                class="avatar-btn"
                aria-label="Account menu"
                aria-expanded={accountMenuOpen.value}
                onClick$={() => { accountMenuOpen.value = !accountMenuOpen.value; }}
              >
                {store.session.avatar ? (
                  <img src={store.session.avatar} alt="" width="32" height="32" class="avatar-img" />
                ) : (
                  <div class="avatar-placeholder">
                    {(store.session.handle ?? '?')[0].toUpperCase()}
                  </div>
                )}
              </button>
              {accountMenuOpen.value && (
                <div class="account-dropdown glass">
                  {store.session.handle && (
                    <Link href={`/profile/${encodeURIComponent(store.session.handle)}/`} onClick$={() => { accountMenuOpen.value = false; }}>
                      Profile
                    </Link>
                  )}
                  <button type="button" onClick$={() => onLogout()}>
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button class="btn" onClick$={() => { store.showLoginModal = true; }}>
              Log In
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main id="main-content" class="main-content">
        <Slot />
      </main>

      {/* ── Bottom Navigation (iOS-style floating tab bar) ─────────────── */}
      <nav class="nav glass" aria-label="Main navigation" role="tablist">
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
      </nav>

      {/* ── Login Modal ────────────────────────────────────────────────── */}
      {store.showLoginModal && <LoginModal />}
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
    default:
      return <span>?</span>;
  }
});

// ── Login Modal ───────────────────────────────────────────────────────────

const LoginModal = component$(() => {
  const store = useAppState();

  const handleOAuthLogin = $(async (handle: string) => {
    try {
      const { signInWithOAuthRedirect } = await import('~/lib/oauth');
      await signInWithOAuthRedirect(handle);
    } catch (err) {
      console.error('OAuth login failed:', err);
    }
  });

  return (
    <div class="modal-overlay" onClick$={() => { store.showLoginModal = false; }}>
      <div class="modal-card glass-strong" onClick$={(e) => e.stopPropagation()}>
        <h2 class="modal-title">Log in with Bluesky</h2>
        <p class="modal-subtitle">Enter your Bluesky handle to continue</p>

        <form
          preventdefault:submit
          onSubmit$={(_, target) => {
            const formData = new FormData(target as HTMLFormElement);
            const handle = (formData.get('handle') as string)?.trim();
            if (handle) handleOAuthLogin(handle);
          }}
        >
          <input
            name="handle"
            type="text"
            placeholder="yourname.bsky.social"
            class="modal-input"
            autoFocus
          />
          <button type="submit" class="btn modal-submit">
            Continue with Bluesky
          </button>
        </form>

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
