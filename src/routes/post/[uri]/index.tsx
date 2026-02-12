/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Post Detail Page – Full Post with Thread
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Shows a single post in full with:
 *  - Full-size media (images, video with HLS)
 *  - Complete text
 *  - Like/downvote/repost counts
 *  - Full comment thread (nested replies, furl/unfurl)
 *  - Reply composer
 *  - Quote post support
 *  - Share options
 *
 * HOW TO EDIT:
 *  - To change what's shown in the post detail, edit the article section
 *  - To change comment sorting, add options to the sort dropdown
 *  - Comments use the app.bsky.feed.post reply system
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';
import { useAppState } from '~/context/app-context';
import { ActionBar } from '~/components/action-buttons/action-buttons';
import { resizedAvatarUrl } from '~/lib/image-utils';
import type { PostView } from '~/lib/types';

export default component$(() => {
  const app = useAppState();
  const loc = useLocation();
  const uri = decodeURIComponent(loc.params.uri);

  const post = useSignal<PostView | null>(null);
  const thread = useSignal<unknown>(null);
  const loading = useSignal(true);
  const replyText = useSignal('');
  /** Map post/reply URI -> downvote record URI (for "I downvoted" state) */
  const myDownvoteUris = useSignal<Record<string, string>>({});
  /** Downvote counts per reply URI (for comment sort by score) */
  const replyDownvoteCounts = useSignal<Record<string, number>>({});
  /** Comment sort mode */
  const commentSortMode = useSignal<'newest' | 'oldest' | 'best' | 'controversial'>('best');

  useVisibleTask$(async () => {
    try {
      const { agent, publicAgent, getSession } = await import('~/lib/bsky');
      const session = getSession();
      const client = session ? agent : publicAgent;
      const res = await client.getPostThread({ uri, depth: 10 });
      thread.value = res.data.thread;
      post.value = (res.data.thread as { post?: PostView })?.post ?? null;
      if (session?.did) {
        const { listMyDownvotes } = await import('~/lib/bsky');
        myDownvoteUris.value = await listMyDownvotes();
      }
      // Collect all reply URIs (and main post) for downvote counts
      const replyUris: string[] = [];
      const mainPost = (res.data.thread as { post?: PostView })?.post;
      if (mainPost?.uri) replyUris.push(mainPost.uri);
      function collectUris(t: unknown) {
        if (!t || typeof t !== 'object') return;
        const node = t as { post?: PostView; replies?: unknown[] };
        if (node.post?.uri) replyUris.push(node.post.uri);
        (node.replies ?? []).forEach(collectUris);
      }
      const root = res.data.thread as { replies?: unknown[] };
      (root?.replies ?? []).forEach(collectUris);
      if (replyUris.length > 0) {
        const { getDownvoteCounts } = await import('~/lib/constellation');
        replyDownvoteCounts.value = await getDownvoteCounts(replyUris);
      }
    } catch (err) {
      console.error('Failed to load post:', err);
    }
    loading.value = false;
  });

  // HLS.js for video playback when we have a playlist URL
  useVisibleTask$(async ({ track, cleanup }) => {
    track(() => post.value);
    track(() => videoRef.value);
    const p = post.value;
    const emb = p?.embed as { playlist?: string; media?: { playlist?: string } } | undefined;
    const playlist = emb?.playlist ?? emb?.media?.playlist;
    if (!playlist || !videoRef.value) return;
    const Hls = (await import('hls.js')).default;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(playlist);
      hls.attachMedia(videoRef.value);
      cleanup(() => { hls.destroy(); });
    } else if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.value.src = playlist;
    }
  });

  const handleReply = $(async () => {
    if (!replyText.value.trim() || !post.value) return;
    try {
      const { postReply } = await import('~/lib/bsky');
      await postReply(
        post.value.uri, post.value.cid,
        post.value.uri, post.value.cid,
        replyText.value,
      );
      replyText.value = '';
      // Reload thread
      const { agent } = await import('~/lib/bsky');
      const res = await agent.getPostThread({ uri, depth: 10 });
      thread.value = res.data.thread;
    } catch (err) {
      console.error('Reply failed:', err);
    }
  });

  if (loading.value) {
    return <div class="flex-center" style={{ padding: 'var(--space-2xl)' }}><div class="spinner" /></div>;
  }

  if (!post.value) {
    return <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--muted)' }}>Post not found</div>;
  }

  const p = post.value;
  const record = p.record as { text?: string; createdAt?: string };
  const embed = p.embed as Record<string, unknown> | undefined;
  const images = (embed?.images as Array<{ fullsize: string; alt?: string }>) ?? [];
  const isVideo = (embed?.$type as string) === 'app.bsky.embed.video#view';
  const videoPlaylist = (embed?.playlist as string) ?? (embed?.media as { playlist?: string })?.playlist;
  const videoRef = useSignal<HTMLVideoElement>();

  /** Flatten thread with sort applied at each level (newest/oldest/best/controversial) */
  const flattenedReplies = (() => {
    const mode = commentSortMode.value;
    const downvoteCounts = replyDownvoteCounts.value;
    const getCreated = (n: { post?: PostView }) => ((n.post?.record as { createdAt?: string })?.createdAt ?? '');
    const getScore = (n: { post?: PostView }) => (n.post?.likeCount ?? 0) - (n.post ? (downvoteCounts[n.post.uri] ?? 0) : 0);
    const getControversy = (n: { post?: PostView }) => {
      if (!n.post) return 0;
      const likes = n.post.likeCount ?? 0;
      const downs = downvoteCounts[n.post.uri] ?? 0;
      const total = likes + downs;
      if (total === 0) return 0;
      const ratio = likes / total;
      return total * (1 - 2 * Math.abs(ratio - 0.5));
    };
    function sortNodes(nodes: Array<{ post?: PostView; replies?: unknown[] }>) {
      return [...nodes].sort((a, b) => {
        if (mode === 'newest') return getCreated(b).localeCompare(getCreated(a));
        if (mode === 'oldest') return getCreated(a).localeCompare(getCreated(b));
        if (mode === 'best') return getScore(b) - getScore(a);
        if (mode === 'controversial') return getControversy(b) - getControversy(a);
        return 0;
      });
    }
    function walk(nodes: unknown[], depth: number): Array<{ post: PostView; depth: number }> {
      if (!nodes?.length) return [];
      const typed = nodes.map((n) => n as { post?: PostView; replies?: unknown[] }).filter((n) => n.post?.uri);
      const sorted = sortNodes(typed);
      const out: Array<{ post: PostView; depth: number }> = [];
      for (const node of sorted) {
        out.push({ post: node.post!, depth });
        out.push(...walk(node.replies ?? [], depth + 1));
      }
      return out;
    }
    const root = thread.value as { replies?: unknown[] };
    return walk(root?.replies ?? [], 0);
  })();

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <article class="glass-strong" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-lg)' }}>
        {/* Author */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          {p.author.avatar && (
            <img src={resizedAvatarUrl(p.author.avatar, 40)} alt="" width="40" height="40" style={{ borderRadius: '50%' }} />
          )}
          <div>
            <div style={{ fontWeight: '600' }}>{p.author.displayName || p.author.handle}</div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--muted)' }}>@{p.author.handle}</div>
          </div>
        </div>

        {/* Text */}
        {record?.text && (
          <p style={{ fontSize: 'var(--font-lg)', lineHeight: '1.6', marginBottom: 'var(--space-md)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {record.text}
          </p>
        )}

        {/* Images */}
        {images.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
            {images.map((img, i) => (
              <img key={i} src={img.fullsize} alt={img.alt ?? ''} style={{ width: '100%', borderRadius: 'var(--glass-radius-sm)' }} />
            ))}
          </div>
        )}

        {/* Video (HLS.js when playlist URL present) */}
        {isVideo && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            {videoPlaylist ? (
              <video
                ref={videoRef}
                controls
                class="post-detail-video"
                style={{ width: '100%', maxHeight: '70vh', borderRadius: 'var(--glass-radius-sm)', background: '#000' }}
              />
            ) : (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--glass-radius-sm)', padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--muted)' }}>
                Video (no playlist URL)
              </div>
            )}
          </div>
        )}

        {/* Actions: Like, Downvote, Reply */}
        <div style={{ paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border)' }}>
          <ActionBar
            subjectUri={p.uri}
            subjectCid={p.cid}
            likeCount={p.likeCount ?? 0}
            liked={!!p.viewer?.like}
            likeRecordUri={p.viewer?.like}
            downvoteCount={replyDownvoteCounts.value[p.uri] ?? 0}
            downvoted={!!myDownvoteUris.value[p.uri]}
            downvoteRecordUri={myDownvoteUris.value[p.uri]}
            onDownvote$={app.session.isLoggedIn ? $(async () => {
              myDownvoteUris.value = await (await import('~/lib/bsky')).listMyDownvotes();
              replyDownvoteCounts.value = { ...replyDownvoteCounts.value, [p.uri]: (replyDownvoteCounts.value[p.uri] ?? 0) + 1 };
            }) : undefined}
            onUndoDownvote$={app.session.isLoggedIn ? $(async () => {
              myDownvoteUris.value = await (await import('~/lib/bsky')).listMyDownvotes();
              replyDownvoteCounts.value = { ...replyDownvoteCounts.value, [p.uri]: Math.max(0, (replyDownvoteCounts.value[p.uri] ?? 0) - 1) };
            }) : undefined}
            replyCount={p.replyCount ?? 0}
            replyHref={`/post/${encodeURIComponent(p.uri)}/`}
          />
        </div>
        {record?.createdAt && (
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', marginTop: 'var(--space-xs)' }}>
            {new Date(record.createdAt).toLocaleString()}
          </div>
        )}
      </article>

      {/* Reply Composer */}
      {app.session.isLoggedIn && (
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
          <textarea
            placeholder="Write a reply..."
            value={replyText.value}
            onInput$={(_, el) => { replyText.value = el.value; }}
            style={{ flex: 1, minHeight: '80px', resize: 'vertical' }}
          />
          <button class="btn" onClick$={handleReply} style={{ alignSelf: 'flex-end' }}>Reply</button>
        </div>
      )}

      {/* Comment sort + thread replies */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {flattenedReplies.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--muted)' }}>Sort:</span>
            <select
              value={commentSortMode.value}
              onChange$={(_, el) => { commentSortMode.value = el.value as typeof commentSortMode.value; }}
              style={{ fontSize: 'var(--font-sm)', padding: 'var(--space-xs) var(--space-sm)', borderRadius: 'var(--glass-radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="best">Best</option>
              <option value="controversial">Controversial</option>
            </select>
          </div>
        )}
        {flattenedReplies.map(({ post: rp, depth }) => {
          const rr = rp.record as { text?: string; createdAt?: string };
          return (
            <div
              key={rp.uri}
              class="glass"
              style={{ padding: 'var(--space-md)', marginLeft: `${depth * 16}px`, borderLeft: depth > 0 ? '2px solid var(--border)' : undefined }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                {rp.author.avatar && (
                  <img src={resizedAvatarUrl(rp.author.avatar, 24)} alt="" width="24" height="24" style={{ borderRadius: '50%' }} />
                )}
                <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600' }}>
                  {rp.author.displayName || rp.author.handle}
                </span>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)' }}>
                  @{rp.author.handle}
                </span>
              </div>
              {rr?.text && (
                <p style={{ fontSize: 'var(--font-sm)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{rr.text}</p>
              )}
              <ActionBar
                subjectUri={rp.uri}
                subjectCid={rp.cid}
                likeCount={rp.likeCount ?? 0}
                liked={!!rp.viewer?.like}
                likeRecordUri={rp.viewer?.like}
                downvoteCount={replyDownvoteCounts.value[rp.uri] ?? 0}
                downvoted={!!myDownvoteUris.value[rp.uri]}
                downvoteRecordUri={myDownvoteUris.value[rp.uri]}
                onDownvote$={app.session.isLoggedIn ? $(async () => {
                  myDownvoteUris.value = await (await import('~/lib/bsky')).listMyDownvotes();
                  replyDownvoteCounts.value = { ...replyDownvoteCounts.value, [rp.uri]: (replyDownvoteCounts.value[rp.uri] ?? 0) + 1 };
                }) : undefined}
                onUndoDownvote$={app.session.isLoggedIn ? $(async () => {
                  myDownvoteUris.value = await (await import('~/lib/bsky')).listMyDownvotes();
                  replyDownvoteCounts.value = { ...replyDownvoteCounts.value, [rp.uri]: Math.max(0, (replyDownvoteCounts.value[rp.uri] ?? 0) - 1) };
                }) : undefined}
                replyCount={rp.replyCount ?? 0}
                replyHref={`/post/${encodeURIComponent(uri)}/`}
                compact
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
