/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PostCard – Individual Post in the Feed
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Displays a single post with:
 *  - Media (image or video) with aspect-ratio-aware container
 *  - Author info (avatar, handle, display name)
 *  - Post text (truncated)
 *  - Action row: like, downvote, repost, comment, save to collection
 *  - Seen tracking: when scrolled past, marked as seen
 *  - NSFW blur overlay
 *  - Collection indicator (outline when saved)
 *
 * HOW TO EDIT:
 *  - To change what info is shown, edit the JSX below
 *  - To change the card style, edit post-card.css
 *  - To add new actions (e.g., share), add a button to the action row
 *  - Media rendering: images show directly, videos use HLS.js
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { component$, useSignal, useVisibleTask$, type QRL } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import type { TimelineItem } from '~/lib/types';

import './post-card.css';

interface ArtboardOption {
  id: string;
  name: string;
}

interface PostCardProps {
  item: TimelineItem;
  isSeen: boolean;
  onSeen$: QRL<() => void>;
  /** If set, current user has downvoted this post (value = downvote record URI to undo) */
  myDownvoteUri?: string;
  onDownvote$?: QRL<() => void>;
  onUndoDownvote$?: QRL<() => void>;
  artboards?: ArtboardOption[];
  onAddToArtboard$?: QRL<(boardId: string) => void>;
  isInAnyArtboard?: boolean;
}

export const PostCard = component$<PostCardProps>(({
  item,
  isSeen,
  onSeen$,
  myDownvoteUri,
  onDownvote$,
  onUndoDownvote$,
  artboards = [],
  onAddToArtboard$,
  isInAnyArtboard = false,
}) => {
  const post = item.post;
  const record = post.record as { text?: string; createdAt?: string };
  const cardRef = useSignal<HTMLElement>();
  const isLiked = useSignal(!!post.viewer?.like);
  const likeCount = useSignal(post.likeCount ?? 0);
  const showNsfw = useSignal(false);
  const showCollectionDropdown = useSignal(false);
  const isDownvoted = useSignal(!!myDownvoteUri);

  // ── Extract media from embed ──────────────────────────────────────────
  const embed = post.embed as Record<string, unknown> | undefined;
  const mediaType = embed?.$type as string | undefined;
  const isImage = mediaType === 'app.bsky.embed.images#view';
  const isVideo = mediaType === 'app.bsky.embed.video#view';
  const images = (embed?.images as Array<{ thumb: string; fullsize: string; aspectRatio?: { width: number; height: number } }>) ?? [];
  const videoThumb = embed?.thumbnail as string | undefined;
  const hasMedia = isImage || isVideo || !!(embed?.media as Record<string, unknown>);

  // Check NSFW
  const nsfwVals = new Set(['porn', 'sexual', 'nudity', 'graphic-media']);
  const isNsfw = post.labels?.some((l) => nsfwVals.has(l.val)) ?? false;

  // ── Seen tracking via IntersectionObserver ─────────────────────────────
  useVisibleTask$(({ cleanup }) => {
    if (!cardRef.value || isSeen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Mark as seen when the card scrolls out of view upward
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            onSeen$();
            observer.disconnect();
          }
        }
      },
      { threshold: 0 },
    );
    observer.observe(cardRef.value);
    cleanup(() => observer.disconnect());
  });

  // ── Time ago formatting ─────────────────────────────────────────────────
  const timeAgo = (() => {
    if (!record?.createdAt) return '';
    const diff = Date.now() - new Date(record.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  })();

  // Encode URI for routing
  const postPath = `/post/${encodeURIComponent(post.uri)}/`;
  const profilePath = `/profile/${encodeURIComponent(post.author.handle)}/`;

  return (
    <article
      ref={cardRef}
      class={`post-card glass ${isSeen ? 'post-card-seen' : ''} ${isInAnyArtboard ? 'post-card-in-collection' : ''}`}
      data-post-uri={post.uri}
    >
      {/* ── Media ────────────────────────────────────────────────────── */}
      {hasMedia && (
        <Link href={postPath} class="post-media-link">
          <div class="post-media-wrap">
            {isImage && images.length > 0 && (
              <>
                <img
                  src={images[0].fullsize ?? images[0].thumb}
                  alt=""
                  class="post-media-img"
                  loading="lazy"
                  style={images[0].aspectRatio
                    ? { aspectRatio: `${images[0].aspectRatio.width} / ${images[0].aspectRatio.height}` }
                    : undefined}
                />
                {images.length > 1 && (
                  <span class="post-media-count">{images.length}</span>
                )}
              </>
            )}
            {isVideo && videoThumb && (
              <div class="post-video-wrap">
                <img src={videoThumb} alt="" class="post-media-img" loading="lazy" />
                <div class="post-video-play">▶</div>
              </div>
            )}
            {/* NSFW overlay */}
            {isNsfw && !showNsfw.value && (
              <div class="post-nsfw-overlay" onClick$={(e) => { e.preventDefault(); showNsfw.value = true; }}>
                <span>Sensitive Content</span>
                <small>Tap to reveal</small>
              </div>
            )}
          </div>
        </Link>
      )}

      {/* ── Author Row ───────────────────────────────────────────────── */}
      <div class="post-meta">
        <Link href={profilePath} class="post-author">
          {post.author.avatar && (
            <img src={post.author.avatar} alt="" class="post-avatar" width="24" height="24" loading="lazy" />
          )}
          <span class="post-handle truncate">
            {post.author.displayName || post.author.handle}
          </span>
        </Link>
        <span class="post-time">{timeAgo}</span>
      </div>

      {/* ── Text ─────────────────────────────────────────────────────── */}
      {record?.text && (
        <Link href={postPath} class="post-text-link">
          <p class="post-text">
            {record.text.length > 200 ? record.text.slice(0, 200) + '…' : record.text}
          </p>
        </Link>
      )}

      {/* ── Action Row ───────────────────────────────────────────────── */}
      <div class="post-actions">
        {/* Like (counts as upvote) */}
        <button
          class={`post-action ${isLiked.value ? 'post-action-active' : ''}`}
          aria-label={isLiked.value ? 'Unlike' : 'Like'}
          onClick$={async () => {
            if (!isLiked.value) {
              isLiked.value = true;
              likeCount.value++;
              try {
                const { agent } = await import('~/lib/bsky');
                await agent.like(post.uri, post.cid);
              } catch { isLiked.value = false; likeCount.value--; }
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isLiked.value ? 'var(--error)' : 'none'} stroke={isLiked.value ? 'var(--error)' : 'currentColor'} stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
          {likeCount.value > 0 && <span>{likeCount.value}</span>}
        </button>

        {/* Downvote (Microcosm constellation) */}
        {(onDownvote$ || onUndoDownvote$) && (
          <button
            class={`post-action ${(isDownvoted.value || !!myDownvoteUri) ? 'post-action-active' : ''}`}
            aria-label={(isDownvoted.value || myDownvoteUri) ? 'Remove downvote' : 'Downvote'}
            onClick$={async () => {
              const currentlyDownvoted = isDownvoted.value || !!myDownvoteUri;
              if (currentlyDownvoted && onUndoDownvote$) {
                onUndoDownvote$();
                isDownvoted.value = false;
              } else if (!currentlyDownvoted && onDownvote$) {
                onDownvote$();
                isDownvoted.value = true;
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={(isDownvoted.value || myDownvoteUri) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
              <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
            </svg>
          </button>
        )}

        {/* Comment */}
        <Link href={postPath} class="post-action" aria-label="Comment">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {(post.replyCount ?? 0) > 0 && <span>{post.replyCount}</span>}
        </Link>

        {/* Save to collection */}
        {artboards.length > 0 && onAddToArtboard$ && (
          <div style={{ position: 'relative' }}>
            <button
              class={`post-action ${isInAnyArtboard ? 'post-action-active' : ''}`}
              aria-label="Save to collection"
              aria-expanded={showCollectionDropdown.value}
              onClick$={() => { showCollectionDropdown.value = !showCollectionDropdown.value; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isInAnyArtboard ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
            </button>
            {showCollectionDropdown.value && (
              <div
                class="glass-strong"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '4px',
                  padding: 'var(--space-xs)',
                  minWidth: '140px',
                  zIndex: 10,
                }}
              >
                {artboards.map((b) => (
                  <button
                    key={b.id}
                    class="post-action"
                    style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: '2px' }}
                    onClick$={() => {
                      onAddToArtboard$(b.id);
                      showCollectionDropdown.value = false;
                    }}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
