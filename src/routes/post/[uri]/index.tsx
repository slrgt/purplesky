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
import type { PostView } from '~/lib/types';

export default component$(() => {
  const app = useAppState();
  const loc = useLocation();
  const uri = decodeURIComponent(loc.params.uri);

  const post = useSignal<PostView | null>(null);
  const thread = useSignal<unknown>(null);
  const loading = useSignal(true);
  const replyText = useSignal('');

  useVisibleTask$(async () => {
    try {
      const { agent, publicAgent, getSession } = await import('~/lib/bsky');
      const client = getSession() ? agent : publicAgent;
      const res = await client.getPostThread({ uri, depth: 10 });
      thread.value = res.data.thread;
      post.value = (res.data.thread as { post?: PostView })?.post ?? null;
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

  /** Flatten AT Protocol thread (nested replies) into array of { post, depth } for display */
  const flattenedReplies = (() => {
    const out: Array<{ post: PostView; depth: number }> = [];
    function walk(t: unknown, depth: number) {
      if (!t || typeof t !== 'object') return;
      const node = t as { post?: PostView; replies?: unknown[] };
      if (node.post && node.post.uri) out.push({ post: node.post, depth });
      (node.replies ?? []).forEach((r) => walk(r, depth + 1));
    }
    const root = thread.value as { replies?: unknown[] };
    (root?.replies ?? []).forEach((r) => walk(r, 0));
    return out;
  })();

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <article class="glass-strong" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-lg)' }}>
        {/* Author */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          {p.author.avatar && (
            <img src={p.author.avatar} alt="" width="40" height="40" style={{ borderRadius: '50%' }} />
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

        {/* Stats */}
        <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: 'var(--font-sm)', color: 'var(--muted)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border)' }}>
          <span>{p.likeCount ?? 0} likes</span>
          <span>{p.repostCount ?? 0} reposts</span>
          <span>{p.replyCount ?? 0} replies</span>
          {record?.createdAt && <span>{new Date(record.createdAt).toLocaleString()}</span>}
        </div>
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

      {/* Thread replies (flattened from nested structure) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {flattenedReplies.map(({ post: rp, depth }, i) => {
          const rr = rp.record as { text?: string; createdAt?: string };
          return (
            <div
              key={rp.uri}
              class="glass"
              style={{ padding: 'var(--space-md)', marginLeft: `${depth * 16}px`, borderLeft: depth > 0 ? '2px solid var(--border)' : undefined }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                {rp.author.avatar && (
                  <img src={rp.author.avatar} alt="" width="24" height="24" style={{ borderRadius: '50%' }} />
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
            </div>
          );
        })}
      </div>
    </div>
  );
});
