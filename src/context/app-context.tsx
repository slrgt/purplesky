/**
 * ═══════════════════════════════════════════════════════════════════════════
 * App Context – Global State for PurpleSky
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This provides reactive state shared across all components:
 *  - Session: current user's DID, handle, avatar, login status
 *  - Theme: light/dark/system/high-contrast mode
 *  - View: number of masonry columns
 *  - Feed mix: which feeds to show and at what percentages
 *  - Seen posts: track which posts have been scrolled past
 *  - Filters: art-only, media-only, NSFW mode
 *
 * HOW TO EDIT:
 *  - To add new global state, add it to the AppStore interface
 *  - Use useAppState() in any component to read/write state
 *  - State is persisted to localStorage where appropriate
 *
 * Qwik context uses createContextId + useContextProvider + useContext.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createContextId, useContext, useContextProvider, useStore } from '@builder.io/qwik';
import type { ThemeMode, ViewColumns, FeedMixEntry } from '~/lib/types';

// ── Store Shape ───────────────────────────────────────────────────────────

export interface AppStore {
  /** Current user session */
  session: {
    did: string | null;
    handle: string | null;
    avatar: string | null;
    isLoggedIn: boolean;
  };
  /** Theme preference */
  theme: ThemeMode;
  /** Masonry column count */
  viewColumns: ViewColumns;
  /** Feed mixing configuration */
  feedMix: FeedMixEntry[];
  /** Whether to hide seen posts */
  hideSeenPosts: boolean;
  /** Art-only filter */
  artOnly: boolean;
  /** Media-only filter */
  mediaOnly: boolean;
  /** NSFW filter mode */
  nsfwMode: 'hide' | 'blur' | 'show';
  /** Notification count */
  unreadCount: number;
  /** Login modal visibility */
  showLoginModal: boolean;
  /** Compose modal visibility */
  showComposeModal: boolean;
}

// ── Context ID ────────────────────────────────────────────────────────────

export const AppContext = createContextId<AppStore>('app-context');

// ── Provider Hook ─────────────────────────────────────────────────────────

/** Call this in the root layout to provide app state to all children. */
export function useAppProvider() {
  const store = useStore<AppStore>({
    session: { did: null, handle: null, avatar: null, isLoggedIn: false },
    theme: 'system',
    viewColumns: 2,
    feedMix: [
      { source: { kind: 'timeline', label: 'Following' }, percent: 50 },
      {
        source: {
          kind: 'custom',
          label: 'For You',
          uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
        },
        percent: 50,
      },
    ],
    hideSeenPosts: false,
    artOnly: false,
    mediaOnly: false,
    nsfwMode: 'blur',
    unreadCount: 0,
    showLoginModal: false,
    showComposeModal: false,
  });

  useContextProvider(AppContext, store);
  return store;
}

// ── Consumer Hook ─────────────────────────────────────────────────────────

/** Get the app state from any child component. */
export function useAppState() {
  return useContext(AppContext);
}
