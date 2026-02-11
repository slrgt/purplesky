/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Feed Page (Home) – Masonry Grid of Posts
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is the main page users see. It displays a masonry grid of images
 * and videos from Bluesky feeds, with:
 *  - Configurable column count (1/2/3)
 *  - Feed mixing (show percentages from different feeds)
 *  - Infinite scroll with smart prefetching
 *  - Pull-to-refresh
 *  - Seen post tracking (mark posts as seen when scrolled past)
 *  - Hide/show seen posts toggle
 *  - Art-only and media-only filters
 *  - Sorting via WASM (newest, trending, Wilson score, controversial)
 *
 * HOW TO EDIT:
 *  - To change the default sort order, edit the initial sortMode value
 *  - To add a new filter, add a state variable and filter logic
 *  - The masonry layout is handled by the MasonryFeed component
 *  - Feed mixing is configured in the FeedSelector component
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { component$, useSignal, useVisibleTask$, useStore, $ } from '@builder.io/qwik';
import { useAppState } from '~/context/app-context';
import { PostCard } from '~/components/post-card/post-card';
import { FeedSelector } from '~/components/feed-selector/feed-selector';
import type { TimelineItem } from '~/lib/types';

import './feed.css';

export default component$(() => {
  const app = useAppState();

  // ── Feed State ──────────────────────────────────────────────────────────
  /** Cursors: for mixed feed use keys like 'timeline', at://...; for guest use 'guest'. */
  const feed = useStore<{
    items: TimelineItem[];
    loading: boolean;
    cursors: Record<string, string>;
    error: string | null;
  }>({
    items: [],
    loading: true,
    cursors: {},
    error: null,
  });

  /** Which sort algorithm to use */
  const sortMode = useSignal<'newest' | 'trending' | 'wilson' | 'controversial'>('newest');

  /** Set of seen post URIs (tracked locally) */
  const seenPosts = useSignal<Set<string>>(new Set());

  /** Downvote counts per post URI (from Microcosm); populated after feed loads */
  const downvoteCounts = useSignal<Record<string, number>>({});

  /** Sorted+filtered items (after WASM sort); used for grid display */
  const sortedDisplayItems = useSignal<TimelineItem[]>([]);

  /** Show feed selector panel */
  const showFeedSelector = useSignal(false);

  /** Map post URI -> downvote record URI (for "I downvoted" state and undo) */
  const myDownvoteUris = useSignal<Record<string, string>>({});

  /** Artboards for "Save to collection" dropdown */
  const artboardsList = useSignal<Array<{ id: string; name: string }>>([]);

  /** Set of post URIs that are in at least one artboard (for card outline) */
  const inAnyArtboardUris = useSignal<Set<string>>(new Set());

  // ── Guest feed handles (shown when not logged in) ───────────────────────
  const GUEST_HANDLES = [
    'studio.blender.org', 'godotengine.org', 'stsci.edu',
    'oseanworld.bsky.social', 'osean.world',
  ];

  // ── Load Feed ───────────────────────────────────────────────────────────
  const loadFeed = $(async (append = false) => {
    feed.loading = true;
    feed.error = null;
    try {
      if (app.session.isLoggedIn) {
        const { getMixedFeed } = await import('~/lib/bsky');
        const cursorsToUse = append && Object.keys(feed.cursors).length > 0 ? feed.cursors : undefined;
        const result = await getMixedFeed(app.feedMix, 30, cursorsToUse);
        if (append) {
          feed.items = [...feed.items, ...result.feed];
        } else {
          feed.items = result.feed;
        }
        feed.cursors = result.cursors ?? {};
      } else {
        const { getGuestFeed } = await import('~/lib/bsky');
        const guestCursor = feed.cursors['guest'];
        const result = await getGuestFeed(
          GUEST_HANDLES,
          30,
          append && guestCursor ? guestCursor : undefined,
        );
        if (append) {
          feed.items = [...feed.items, ...result.feed];
        } else {
          feed.items = result.feed;
        }
        feed.cursors = result.cursor ? { guest: result.cursor } : {};
      }
    } catch (err) {
      feed.error = err instanceof Error ? err.message : 'Failed to load feed';
    }
    feed.loading = false;
  });

  // ── Initial Load ────────────────────────────────────────────────────────
  useVisibleTask$(async () => {
    try {
      const raw = localStorage.getItem('purplesky-seen-posts');
      if (raw) seenPosts.value = new Set(JSON.parse(raw));
    } catch { /* ignore */ }
    setTimeout(() => loadFeed(), 300);
  });

  // ── Fetch downvote counts when feed items change ─────────────────────────
  useVisibleTask$(async ({ track }) => {
    track(() => feed.items.length);
    if (feed.items.length === 0) {
      downvoteCounts.value = {};
      return;
    }
    const { getDownvoteCounts } = await import('~/lib/constellation');
    const uris = feed.items.map((i) => i.post.uri).filter(Boolean);
    downvoteCounts.value = await getDownvoteCounts(uris);
  });

  // ── Apply sort (WASM) and set sortedDisplayItems ─────────────────────────
  useVisibleTask$(async ({ track }) => {
    track(() => feed.items.length);
    track(() => sortMode.value);
    track(() => downvoteCounts.value);
    track(() => app.hideSeenPosts);
    track(() => seenPosts.value);

    const filtered = feed.items.filter((item) => {
      if (app.hideSeenPosts && seenPosts.value.has(item.post.uri)) return false;
      return true;
    });
    if (filtered.length === 0) {
      sortedDisplayItems.value = [];
      return;
    }

    const record = (p: TimelineItem) => p.post.record as { createdAt?: string };
    const sortable = filtered.map((item) => ({
      uri: item.post.uri,
      created_at: record(item)?.createdAt ?? new Date(0).toISOString(),
      like_count: item.post.likeCount ?? 0,
      downvote_count: downvoteCounts.value[item.post.uri] ?? 0,
      reply_count: item.post.replyCount ?? 0,
      repost_count: item.post.repostCount ?? 0,
    }));

    const {
      sortByNewest,
      sortByTrending,
      sortByWilsonScore,
      sortByControversial,
    } = await import('~/lib/wasm-bridge');

    let ordered: typeof sortable;
    switch (sortMode.value) {
      case 'trending':
        ordered = await sortByTrending(sortable);
        break;
      case 'wilson':
        ordered = await sortByWilsonScore(sortable);
        break;
      case 'controversial':
        ordered = await sortByControversial(sortable);
        break;
      default:
        ordered = await sortByNewest(sortable);
    }

    const byUri = new Map(filtered.map((i) => [i.post.uri, i]));
    sortedDisplayItems.value = ordered.map((s) => byUri.get(s.uri)).filter(Boolean) as TimelineItem[];
  });

  // ── Load More (infinite scroll) ─────────────────────────────────────────
  const hasMoreCursor = Object.values(feed.cursors).some(Boolean);
  const loadMore = $(() => {
    if (!feed.loading && hasMoreCursor) loadFeed(true);
  });

  // ── Load my downvotes and artboards when logged in ──────────────────────
  useVisibleTask$(async ({ track }) => {
    track(() => app.session.did);
    if (!app.session.did) {
      myDownvoteUris.value = {};
      artboardsList.value = [];
      return;
    }
    try {
      const [downvotes, boards] = await Promise.all([
        import('~/lib/bsky').then((m) => m.listMyDownvotes()),
        import('~/lib/artboards').then((m) => m.getArtboards()),
      ]);
      myDownvoteUris.value = downvotes;
      artboardsList.value = boards.map((b) => ({ id: b.id, name: b.name }));
      const uris = new Set<string>();
      for (const b of boards) for (const p of b.posts) uris.add(p.uri);
      inAnyArtboardUris.value = uris;
    } catch { /* ignore */ }
  });

  // ── Downvote / undo downvote ───────────────────────────────────────────
  const handleDownvote = $(async (uri: string, cid: string) => {
    try {
      const { createDownvote } = await import('~/lib/bsky');
      const recordUri = await createDownvote(uri, cid);
      myDownvoteUris.value = { ...myDownvoteUris.value, [uri]: recordUri };
    } catch (err) {
      console.error('Downvote failed:', err);
    }
  });
  const handleUndoDownvote = $(async (postUri: string) => {
    const recordUri = myDownvoteUris.value[postUri];
    if (!recordUri) return;
    try {
      const { deleteDownvote } = await import('~/lib/bsky');
      await deleteDownvote(recordUri);
      const next = { ...myDownvoteUris.value };
      delete next[postUri];
      myDownvoteUris.value = next;
    } catch (err) {
      console.error('Undo downvote failed:', err);
    }
  });

  // ── Add post to artboard ───────────────────────────────────────────────
  const handleAddToArtboard = $(async (boardId: string, item: TimelineItem) => {
    const art = await import('~/lib/artboards');
    const bsky = await import('~/lib/bsky');
    const post = item.post;
    const mediaInfo = bsky.getPostMediaInfo(post);
    art.addPostToArtboard(boardId, {
      uri: post.uri,
      cid: post.cid,
      authorHandle: post.author.handle,
      text: (post.record as { text?: string })?.text,
      thumb: mediaInfo?.url,
      thumbs: mediaInfo?.url ? [mediaInfo.url] : undefined,
    });
    artboardsList.value = art.getArtboards().map((b) => ({ id: b.id, name: b.name }));
    inAnyArtboardUris.value = new Set([...inAnyArtboardUris.value, post.uri]);
    try {
      const board = art.getArtboard(boardId);
      if (board && app.session.did) await art.syncBoardToPds(board);
    } catch { /* ignore */ }
  });

  // ── Mark Post as Seen ───────────────────────────────────────────────────
  const markSeen = $((uri: string) => {
    const next = new Set(seenPosts.value);
    next.add(uri);
    // Cap at 2000 entries
    if (next.size > 2000) {
      const arr = Array.from(next);
      arr.splice(0, arr.length - 2000);
      seenPosts.value = new Set(arr);
    } else {
      seenPosts.value = next;
    }
    try {
      localStorage.setItem('purplesky-seen-posts', JSON.stringify(Array.from(seenPosts.value)));
    } catch { /* ignore */ }
  });

  // Use WASM-sorted list when ready, otherwise filter in place for first paint
  const displayItems =
    sortedDisplayItems.value.length > 0
      ? sortedDisplayItems.value
      : feed.items.filter((item) => {
          if (app.hideSeenPosts && seenPosts.value.has(item.post.uri)) return false;
          return true;
        });

  // ── Distribute into masonry columns ─────────────────────────────────────
  const numCols = app.viewColumns;
  const columns: TimelineItem[][] = Array.from({ length: numCols }, () => []);
  displayItems.forEach((item, i) => {
    columns[i % numCols].push(item);
  });

  return (
    <div class="feed-page">
      {/* ── Controls Row ───────────────────────────────────────────────── */}
      <div class="feed-controls">
        <div class="feed-controls-left">
          {/* Column switcher */}
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              class={`col-btn ${app.viewColumns === n ? 'col-btn-active' : ''}`}
              onClick$={() => {
                app.viewColumns = n as 1 | 2 | 3;
                localStorage.setItem('purplesky-view-columns', String(n));
              }}
              aria-label={`${n} column${n > 1 ? 's' : ''}`}
            >
              {n}
            </button>
          ))}

          {/* Sort mode */}
          <select
            class="sort-select"
            value={sortMode.value}
            onChange$={(_, el) => { sortMode.value = el.value as typeof sortMode.value; }}
          >
            <option value="newest">Newest</option>
            <option value="trending">Trending</option>
            <option value="wilson">Best</option>
            <option value="controversial">Controversial</option>
          </select>
        </div>

        <div class="feed-controls-right">
          {/* Hide seen toggle */}
          <button
            class={`icon-btn ${app.hideSeenPosts ? 'icon-btn-active' : ''}`}
            onClick$={() => { app.hideSeenPosts = !app.hideSeenPosts; }}
            aria-label={app.hideSeenPosts ? 'Show seen posts' : 'Hide seen posts'}
            title={app.hideSeenPosts ? 'Show seen posts' : 'Hide seen posts'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              {app.hideSeenPosts ? (
                <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M1 1l22 22" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /></>
              ) : (
                <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
              )}
            </svg>
          </button>

          {/* Feed mixer button */}
          {app.session.isLoggedIn && (
            <button
              class="btn-ghost feed-mix-btn"
              onClick$={() => { showFeedSelector.value = !showFeedSelector.value; }}
            >
              Mix Feeds
            </button>
          )}

          {/* Refresh */}
          <button class="icon-btn" onClick$={() => loadFeed()} aria-label="Refresh feed">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Feed Selector Panel ────────────────────────────────────────── */}
      {showFeedSelector.value && (
        <FeedSelector
          onClose$={() => { showFeedSelector.value = false; }}
        />
      )}

      {/* ── Error State ────────────────────────────────────────────────── */}
      {feed.error && (
        <div class="feed-error">
          <p>{feed.error}</p>
          <button class="btn" onClick$={() => loadFeed()}>Retry</button>
        </div>
      )}

      {/* ── Masonry Grid ───────────────────────────────────────────────── */}
      <div class={`masonry-grid masonry-cols-${numCols}`}>
        {columns.map((col, colIdx) => (
          <div key={colIdx} class="masonry-column">
            {col.map((item) => (
              <PostCard
                key={item.post.uri}
                item={item}
                isSeen={seenPosts.value.has(item.post.uri)}
                onSeen$={() => markSeen(item.post.uri)}
                myDownvoteUri={app.session.isLoggedIn ? myDownvoteUris.value[item.post.uri] : undefined}
                onDownvote$={app.session.isLoggedIn ? () => handleDownvote(item.post.uri, item.post.cid) : undefined}
                onUndoDownvote$={app.session.isLoggedIn ? () => handleUndoDownvote(item.post.uri) : undefined}
                artboards={app.session.isLoggedIn ? artboardsList.value : undefined}
                onAddToArtboard$={app.session.isLoggedIn ? (boardId) => handleAddToArtboard(boardId, item) : undefined}
                isInAnyArtboard={app.session.isLoggedIn ? inAnyArtboardUris.value.has(item.post.uri) : false}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── Loading / Load More ────────────────────────────────────────── */}
      {feed.loading && (
        <div class="feed-loading flex-center">
          <div class="spinner" />
        </div>
      )}

      {!feed.loading && hasMoreCursor && displayItems.length > 0 && (
        <div class="load-more flex-center">
          <button class="btn-ghost" onClick$={loadMore}>Load More</button>
        </div>
      )}

      {/* ── Empty State ────────────────────────────────────────────────── */}
      {!feed.loading && !feed.error && displayItems.length === 0 && (
        <div class="feed-empty flex-center">
          <p>
            {app.hideSeenPosts
              ? 'All caught up! No new posts.'
              : 'No posts to show. Try following some accounts.'}
          </p>
        </div>
      )}

      {/* ── Suggested Follows (when logged in) ───────────────────────────── */}
      {app.session.isLoggedIn && !feed.loading && displayItems.length > 0 && (
        <SuggestedFollowsSection />
      )}

      {/* ── Guest CTA (when not logged in) ─────────────────────────────── */}
      {!app.session.isLoggedIn && !feed.loading && (
        <div class="guest-section glass">
          <h3>Welcome to PurpleSky</h3>
          <p>Log in with your Bluesky account to see your personalized feed, save posts to collections, and more.</p>
          <button class="btn" onClick$={() => { app.showLoginModal = true; }}>
            Log In with Bluesky
          </button>
        </div>
      )}
    </div>
  );
});

// ── Suggested Follows (people your followees follow) ───────────────────────
const SuggestedFollowsSection = component$(() => {
  const app = useAppState();
  const suggested = useSignal<Array<{ did: string; handle: string; displayName?: string; avatar?: string; count: number }>>([]);
  const loading = useSignal(false);
  const open = useSignal(false);

  useVisibleTask$(async ({ track }) => {
    track(() => app.session.did);
    if (!app.session.did) return;
    loading.value = true;
    try {
      const { getSuggestedFollows } = await import('~/lib/bsky');
      suggested.value = await getSuggestedFollows(app.session.did, 8);
    } catch { /* ignore */ }
    loading.value = false;
  });

  if (suggested.value.length === 0 && !loading.value) return null;

  return (
    <div class="glass" style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)' }}>
      <button
        class="flex-between"
        style={{ width: '100%', marginBottom: open.value ? 'var(--space-md)' : 0 }}
        onClick$={() => { open.value = !open.value; }}
      >
        <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: '700' }}>Suggested accounts</h3>
        <span style={{ color: 'var(--muted)', fontSize: 'var(--font-sm)' }}>
          {open.value ? '−' : '+'}
        </span>
      </button>
      {open.value && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {loading.value ? (
            <div class="flex-center" style={{ padding: 'var(--space-md)' }}><div class="spinner" /></div>
          ) : (
            suggested.value.map((s) => (
              <a
                key={s.did}
                href={`/profile/${encodeURIComponent(s.handle)}/`}
                class="flex-between glass"
                style={{ padding: 'var(--space-sm) var(--space-md)', textDecoration: 'none', color: 'var(--text)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  {s.avatar && (
                    <img src={s.avatar} alt="" width="32" height="32" style={{ borderRadius: '50%' }} />
                  )}
                  <div>
                    <div style={{ fontWeight: '600' }}>{s.displayName || s.handle}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)' }}>@{s.handle}</div>
                  </div>
                </div>
                <span class="badge">{s.count} follow{s.count !== 1 ? 's' : ''} them</span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
});
