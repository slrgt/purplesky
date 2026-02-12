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
import type { TimelineItem, CardViewMode } from '~/lib/types';
import { resizedAvatarUrl } from '~/lib/image-utils';
import { ActionBar } from '~/components/action-buttons/action-buttons';

import './post-card.css';

interface ArtboardOption {
  id: string;
  name: string;
}

interface PostCardProps {
  item: TimelineItem;
  isSeen: boolean;
  onSeen$: QRL<() => void>;
  /** Card layout: full, mini, art */
  cardViewMode?: CardViewMode;
  /** When true, show NSFW blur overlay until user taps (parent tracks unblurred) */
  nsfwBlurred?: boolean;
  onNsfwUnblur$?: QRL<() => void>;
  /** Number of downvotes (for score display). From constellation when available. */
  downvoteCount?: number;
  /** If set, current user has downvoted this post (value = downvote record URI to undo) */
  myDownvoteUri?: string;
  onDownvote$?: QRL<() => void>;
  onUndoDownvote$?: QRL<() => void>;
  artboards?: ArtboardOption[];
  onAddToArtboard$?: QRL<(boardId: string) => void>;
  isInAnyArtboard?: boolean;
  /** Whether this card has keyboard focus */
  isSelected?: boolean;
  /** Whether the mouse is over this card (keeps hover look during keyboard nav) */
  isMouseOver?: boolean;
}

export const PostCard = component$<PostCardProps>(({
  item,
  isSeen,
  onSeen$,
  cardViewMode = 'full',
  nsfwBlurred = false,
  onNsfwUnblur$,
  downvoteCount = 0,
  myDownvoteUri,
  onDownvote$,
  onUndoDownvote$,
  artboards = [],
  onAddToArtboard$,
  isInAnyArtboard = false,
  isSelected = false,
  isMouseOver = false,
}) => {
  const post = item.post;
  const record = post.record as { text?: string; createdAt?: string };
  const cardRef = useSignal<HTMLElement>();
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

  // ── Keyboard event handling (like/collect from feed keyboard nav) ─────
  useVisibleTask$(({ cleanup }) => {
    if (!cardRef.value) return;
    const el = cardRef.value;
    const onLike = () => {
      const likeBtn = el.querySelector<HTMLElement>('[data-action="like"]');
      likeBtn?.click();
    };
    const onCollect = () => {
      if (artboards.length > 0) {
        showCollectionDropdown.value = !showCollectionDropdown.value;
      }
    };
    el.addEventListener('keyboard-like', onLike);
    el.addEventListener('keyboard-collect', onCollect);
    cleanup(() => {
      el.removeEventListener('keyboard-like', onLike);
      el.removeEventListener('keyboard-collect', onCollect);
    });
  });

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

  const showNsfwOverlay = nsfwBlurred;

  return (
    <article
      ref={cardRef}
      class={`post-card glass post-card-${cardViewMode} ${isSeen ? 'post-card-seen' : ''} ${isInAnyArtboard ? 'post-card-in-collection' : ''} ${isSelected ? 'post-card-selected' : ''} ${isMouseOver ? 'post-card-mouse-over' : ''}`}
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
            {showNsfwOverlay && (
              <div
                class="post-nsfw-overlay"
                onClick$={(e) => { e.preventDefault(); onNsfwUnblur$?.(); }}
                role="button"
                tabIndex={0}
                onKeyDown$={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNsfwUnblur$?.(); } }}
              >
                <span>Sensitive Content</span>
                <small>Tap to reveal</small>
              </div>
            )}
          </div>
        </Link>
      )}

      {/* ── Author Row (hidden in mini except inline) ──────────────────── */}
      {(cardViewMode === 'full' || cardViewMode === 'art') && (
        <div class="post-meta">
          <Link href={profilePath} class="post-author">
            {post.author.avatar && (
              <img src={resizedAvatarUrl(post.author.avatar, 24)} alt="" class="post-avatar" width="24" height="24" loading="lazy" />
            )}
            <span class="post-handle truncate">
              {post.author.displayName || post.author.handle}
            </span>
          </Link>
          <span class="post-time">{timeAgo}</span>
        </div>
      )}

      {/* ── Text (full: full snippet; art: one line; mini: skip) ────────── */}
      {record?.text && cardViewMode !== 'mini' && (
        <Link href={postPath} class="post-text-link">
          <p class={`post-text ${cardViewMode === 'art' ? 'post-text-art' : ''}`}>
            {cardViewMode === 'art'
              ? (record.text.length > 80 ? record.text.slice(0, 80) + '…' : record.text)
              : (record.text.length > 200 ? record.text.slice(0, 200) + '…' : record.text)}
          </p>
        </Link>
      )}

      {/* Mini: compact author + time inline */}
      {cardViewMode === 'mini' && (
        <div class="post-meta post-meta-mini">
          <Link href={profilePath} class="post-author">
            {post.author.avatar && (
              <img src={resizedAvatarUrl(post.author.avatar, 20)} alt="" class="post-avatar" width="20" height="20" loading="lazy" />
            )}
            <span class="post-handle truncate">{post.author.handle}</span>
          </Link>
          <span class="post-time">{timeAgo}</span>
        </div>
      )}

      {/* ── Action Row (reusable ActionBar + collection) ───────────────── */}
      <div class="post-actions">
        <ActionBar
          subjectUri={post.uri}
          subjectCid={post.cid}
          likeCount={post.likeCount ?? 0}
          liked={!!post.viewer?.like}
          likeRecordUri={post.viewer?.like}
          downvoteCount={downvoteCount}
          downvoted={isDownvoted.value || !!myDownvoteUri}
          downvoteRecordUri={myDownvoteUri}
          onDownvote$={onDownvote$}
          onUndoDownvote$={onUndoDownvote$}
          replyCount={post.replyCount ?? 0}
          replyHref={postPath}
          hideVoteCounts
          likeIcon="heart"
        />

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
