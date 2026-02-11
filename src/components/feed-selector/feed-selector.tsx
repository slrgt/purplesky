/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FeedSelector – Configure Feed Mixing
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lets users mix multiple Bluesky feeds with percentage weights.
 * Example: 60% Following + 40% Art feed.
 *
 * HOW TO EDIT:
 *  - To add preset feed configs, add entries to the PRESET_FEEDS array
 *  - To change the percentage slider range, edit the input range attributes
 *  - Feed URIs are at:// URIs from Bluesky feed generators
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { component$, useVisibleTask$, useSignal, type QRL } from '@builder.io/qwik';
import { useAppState } from '~/context/app-context';
import type { FeedMixEntry, FeedSource } from '~/lib/types';

interface FeedSelectorProps {
  onClose$: QRL<() => void>;
}

export const FeedSelector = component$<FeedSelectorProps>(({ onClose$ }) => {
  const app = useAppState();
  const savedFeeds = useSignal<Array<{ id: string; label: string; uri: string }>>([]);
  const newFeedUrl = useSignal('');

  // Load saved feeds from Bluesky preferences
  useVisibleTask$(async () => {
    try {
      const { getSavedFeeds } = await import('~/lib/bsky');
      const feeds = await getSavedFeeds();
      savedFeeds.value = feeds
        .filter((f) => f.type === 'feed')
        .map((f) => ({ id: f.id, label: f.value.split('/').pop() ?? f.value, uri: f.value }));
    } catch { /* ignore */ }
  });

  return (
    <div class="feed-selector glass-strong">
      <div class="flex-between" style={{ marginBottom: 'var(--space-md)' }}>
        <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: '700' }}>Mix Feeds</h3>
        <button class="icon-btn" onClick$={onClose$} aria-label="Close">✕</button>
      </div>

      {/* Current mix entries */}
      {app.feedMix.map((entry, i) => (
        <div key={i} class="feed-mix-entry">
          <span class="feed-mix-label truncate">{entry.source.label}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={entry.percent}
            class="feed-mix-slider"
            onInput$={(_, el) => {
              app.feedMix = app.feedMix.map((e, j) =>
                j === i ? { ...e, percent: parseInt(el.value) } : e,
              );
            }}
          />
          <span class="feed-mix-pct">{entry.percent}%</span>
          <button
            class="icon-btn"
            style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px', fontSize: 'var(--font-sm)' }}
            onClick$={() => {
              app.feedMix = app.feedMix.filter((_, j) => j !== i);
            }}
            aria-label="Remove feed"
          >
            ✕
          </button>
        </div>
      ))}

      {/* Add saved feed */}
      {savedFeeds.value.length > 0 && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--muted)', marginBottom: 'var(--space-sm)' }}>
            Add from your saved feeds:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
            {savedFeeds.value
              .filter((f) => !app.feedMix.some((m) => m.source.uri === f.uri))
              .map((f) => (
                <button
                  key={f.id}
                  class="btn-ghost"
                  style={{ fontSize: 'var(--font-xs)', padding: '4px 8px' }}
                  onClick$={() => {
                    app.feedMix = [
                      ...app.feedMix,
                      { source: { kind: 'custom', label: f.label, uri: f.uri }, percent: 20 },
                    ];
                  }}
                >
                  + {f.label}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Balance button */}
      <button
        class="btn"
        style={{ marginTop: 'var(--space-md)', width: '100%', justifyContent: 'center' }}
        onClick$={() => {
          if (app.feedMix.length === 0) return;
          const each = Math.floor(100 / app.feedMix.length);
          app.feedMix = app.feedMix.map((e) => ({ ...e, percent: each }));
        }}
      >
        Balance Evenly
      </button>

      <style>{`
        .feed-selector { padding: var(--space-lg); margin-bottom: var(--space-md); }
        .feed-mix-entry { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); }
        .feed-mix-label { flex: 0 0 100px; font-size: var(--font-sm); font-weight: 600; }
        .feed-mix-slider { flex: 1; accent-color: var(--accent); }
        .feed-mix-pct { font-size: var(--font-sm); font-weight: 700; color: var(--accent); min-width: 36px; text-align: right; }
      `}</style>
    </div>
  );
});
