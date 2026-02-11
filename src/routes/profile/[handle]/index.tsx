/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Profile Page – User Activity, Posts, Votes, Badges
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Shows a user's profile with:
 *  - Avatar, display name, handle, bio
 *  - Follow/unfollow button
 *  - Stats: followers, following, posts count
 *  - Tabs: Posts, Media, Forums, Activity
 *  - Optional badges (contributor, moderator, etc.)
 *  - Forum participation and vote history
 *
 * HOW TO EDIT:
 *  - To add new profile tabs, add entries to the TABS array
 *  - To add badge types, extend the badges section
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';
import { useAppState } from '~/context/app-context';
import type { ProfileView, TimelineItem } from '~/lib/types';

const TABS = ['Posts', 'Media', 'Forums', 'Activity'];

export default component$(() => {
  const app = useAppState();
  const loc = useLocation();
  const handle = decodeURIComponent(loc.params.handle);

  const profile = useSignal<ProfileView | null>(null);
  const posts = useSignal<TimelineItem[]>([]);
  const forumPosts = useSignal<Array<{ uri: string; title?: string; createdAt?: string }>>([]);
  const loading = useSignal(true);
  const activeTab = useSignal('Posts');

  useVisibleTask$(async () => {
    try {
      const { publicAgent, agent, getSession } = await import('~/lib/bsky');
      const client = getSession() ? agent : publicAgent;
      const res = await client.getProfile({ actor: handle });
      profile.value = res.data as unknown as ProfileView;
      const feedRes = await client.getAuthorFeed({ actor: handle, limit: 50 });
      posts.value = (feedRes.data.feed ?? []) as TimelineItem[];
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
    loading.value = false;
  });

  useVisibleTask$(async ({ track }) => {
    track(() => activeTab.value);
    track(() => profile.value?.did);
    if (activeTab.value !== 'Forums' || !profile.value?.did) return;
    try {
      const { listForumPosts } = await import('~/lib/forum');
      const result = await listForumPosts(profile.value.did, { limit: 30 });
      forumPosts.value = result.posts.map((fp) => ({ uri: fp.uri, title: fp.title, createdAt: fp.createdAt }));
    } catch {
      forumPosts.value = [];
    }
  });

  if (loading.value) {
    return <div class="flex-center" style={{ padding: 'var(--space-2xl)' }}><div class="spinner" /></div>;
  }

  if (!profile.value) {
    return <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--muted)' }}>Profile not found</div>;
  }

  const p = profile.value;
  const isMe = app.session.did === p.did;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Profile Header */}
      <div class="glass-strong" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-start' }}>
          {p.avatar && (
            <img src={p.avatar} alt="" width="80" height="80" style={{ borderRadius: '50%', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: '700' }}>{p.displayName || p.handle}</h1>
            <p style={{ color: 'var(--muted)', marginBottom: 'var(--space-sm)' }}>@{p.handle}</p>
            {p.description && (
              <p style={{ fontSize: 'var(--font-sm)', lineHeight: '1.5', marginBottom: 'var(--space-md)' }}>
                {p.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: 'var(--font-sm)' }}>
              <span><strong>{p.followersCount ?? 0}</strong> followers</span>
              <span><strong>{p.followsCount ?? 0}</strong> following</span>
              <span><strong>{p.postsCount ?? 0}</strong> posts</span>
            </div>
          </div>
          {!isMe && app.session.isLoggedIn && (
            <button class={p.viewer?.following ? 'btn-ghost' : 'btn'}>
              {p.viewer?.following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-sm)' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            style={{
              padding: '6px 14px', fontSize: 'var(--font-sm)', fontWeight: '600', borderRadius: '8px',
              color: activeTab.value === tab ? 'var(--accent)' : 'var(--muted)',
              background: activeTab.value === tab ? 'var(--accent-subtle)' : 'transparent',
              minWidth: 'auto', minHeight: 'auto',
            }}
            onClick$={() => { activeTab.value = tab; }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Posts tab */}
      {activeTab.value === 'Posts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {posts.value.map((item) => {
            const rec = item.post.record as { text?: string; createdAt?: string };
            return (
              <div key={item.post.uri} class="glass" style={{ padding: 'var(--space-md)' }}>
                {rec?.text && <p style={{ fontSize: 'var(--font-sm)', lineHeight: '1.5' }}>{rec.text}</p>}
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', marginTop: 'var(--space-xs)' }}>
                  {rec?.createdAt && new Date(rec.createdAt).toLocaleDateString()}
                  {' · '}
                  {item.post.likeCount ?? 0} likes · {item.post.replyCount ?? 0} replies
                </div>
              </div>
            );
          })}
          {posts.value.length === 0 && (
            <p style={{ color: 'var(--muted)', textAlign: 'center' }}>No posts yet.</p>
          )}
        </div>
      )}

      {/* Media tab: posts with images or video */}
      {activeTab.value === 'Media' && (() => {
        const mediaItems = posts.value.filter((item) => {
          const emb = item.post.embed as { $type?: string; images?: unknown[]; media?: { $type?: string } } | undefined;
          return (emb?.$type === 'app.bsky.embed.images#view' && !!emb.images?.length) ||
            emb?.$type === 'app.bsky.embed.video#view' ||
            emb?.media?.$type === 'app.bsky.embed.images#view' || emb?.media?.$type === 'app.bsky.embed.video#view';
        });
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-sm)' }}>
            {mediaItems.map((item) => {
              const emb = item.post.embed as { images?: Array<{ thumb: string }>; thumbnail?: string } | undefined;
              const thumb = emb?.images?.[0]?.thumb ?? emb?.thumbnail ?? '';
              return (
                <a key={item.post.uri} href={`/post/${encodeURIComponent(item.post.uri)}/`} style={{ display: 'block' }}>
                  <img src={thumb} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--glass-radius-sm)' }} loading="lazy" />
                </a>
              );
            })}
            {mediaItems.length === 0 && (
              <p style={{ gridColumn: '1 / -1', color: 'var(--muted)', textAlign: 'center' }}>No media posts.</p>
            )}
          </div>
        );
      })()}

      {/* Forums tab: forum posts by this user */}
      {activeTab.value === 'Forums' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {forumPosts.value.map((fp) => (
            <a key={fp.uri} href={`/forum/${encodeURIComponent(fp.uri)}/`} class="glass" style={{ padding: 'var(--space-md)', textDecoration: 'none', color: 'var(--text)' }}>
              <div style={{ fontWeight: '600' }}>{fp.title || 'Untitled'}</div>
              {fp.createdAt && <div style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)' }}>{new Date(fp.createdAt).toLocaleDateString()}</div>}
            </a>
          ))}
          {forumPosts.value.length === 0 && activeTab.value === 'Forums' && (
            <p style={{ color: 'var(--muted)', textAlign: 'center' }}>No forum posts.</p>
          )}
        </div>
      )}

      {/* Activity tab: notifications for own profile, else message */}
      {activeTab.value === 'Activity' && (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--muted)' }}>
          {isMe ? (
            <>
              <p style={{ marginBottom: 'var(--space-md)' }}>Your recent likes, replies, and mentions.</p>
              <a href="/" class="btn">View feed</a>
            </>
          ) : (
            <p>Activity is only visible to the account owner.</p>
          )}
        </div>
      )}
    </div>
  );
});
