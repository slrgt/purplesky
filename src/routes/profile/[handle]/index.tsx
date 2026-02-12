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

import { component$, useSignal, useVisibleTask$, useStore, $ } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';
import { useAppState } from '~/context/app-context';
import { ActionBar } from '~/components/action-buttons/action-buttons';
import { resizedAvatarUrl } from '~/lib/image-utils';
import type { ProfileView, TimelineItem } from '~/lib/types';

const TABS = ['Posts', 'Media', 'Forums', 'Activity'];

export default component$(() => {
  const app = useAppState();
  const loc = useLocation();
  const handle = decodeURIComponent(loc.params.handle);

  const profile = useSignal<ProfileView | null>(null);
  const posts = useSignal<TimelineItem[]>([]);
  const forumPosts = useSignal<Array<{ uri: string; title?: string; createdAt?: string }>>([]);
  const notifications = useSignal<Array<{ uri: string; reason: string; author?: { handle?: string; displayName?: string; avatar?: string }; indexedAt?: string; isRead?: boolean }>>([]);
  const loading = useSignal(true);
  const activeTab = useSignal('Posts');
  const followLoading = useSignal(false);

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
    if (!profile.value?.did) return;

    if (activeTab.value === 'Forums') {
      try {
        const { listForumPosts } = await import('~/lib/forum');
        const result = await listForumPosts(profile.value.did, { limit: 30 });
        forumPosts.value = result.posts.map((fp) => ({ uri: fp.uri, title: fp.title, createdAt: fp.createdAt }));
      } catch {
        forumPosts.value = [];
      }
    }

    if (activeTab.value === 'Activity' && app.session.did === profile.value.did) {
      try {
        const { getNotifications } = await import('~/lib/bsky');
        const result = await getNotifications(30);
        notifications.value = result.notifications as typeof notifications.value;
      } catch {
        notifications.value = [];
      }
    }
  });

  const handleFollow = $(async () => {
    if (!profile.value || followLoading.value) return;
    followLoading.value = true;
    try {
      if (profile.value.viewer?.following) {
        const { unfollowUser } = await import('~/lib/bsky');
        await unfollowUser(profile.value.viewer.following);
        profile.value = { ...profile.value, viewer: { ...profile.value.viewer, following: undefined } };
      } else {
        const { followUser } = await import('~/lib/bsky');
        const followUri = await followUser(profile.value.did);
        profile.value = { ...profile.value, viewer: { ...profile.value.viewer, following: followUri } };
      }
    } catch (err) {
      console.error('Follow action failed:', err);
    }
    followLoading.value = false;
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
            <button
              class={p.viewer?.following ? 'btn-ghost' : 'btn'}
              onClick$={handleFollow}
              disabled={followLoading.value}
            >
              {followLoading.value ? '…' : p.viewer?.following ? 'Following' : 'Follow'}
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
            const postPath = `/post/${encodeURIComponent(item.post.uri)}/`;
            return (
              <div key={item.post.uri} class="glass" style={{ padding: 'var(--space-md)' }}>
                {rec?.text && <p style={{ fontSize: 'var(--font-sm)', lineHeight: '1.5' }}>{rec.text}</p>}
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', marginTop: 'var(--space-xs)' }}>
                  {rec?.createdAt && new Date(rec.createdAt).toLocaleDateString()}
                </div>
                <ActionBar
                  subjectUri={item.post.uri}
                  subjectCid={item.post.cid}
                  likeCount={item.post.likeCount ?? 0}
                  liked={!!item.post.viewer?.like}
                  likeRecordUri={item.post.viewer?.like}
                  downvoteCount={0}
                  replyCount={item.post.replyCount ?? 0}
                  replyHref={postPath}
                  compact
                />
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
        <div>
          {isMe ? (
            notifications.value.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {notifications.value.map((n) => {
                  const reasonLabel: Record<string, string> = {
                    like: 'liked your post', reply: 'replied to you', follow: 'followed you',
                    repost: 'reposted your post', mention: 'mentioned you', quote: 'quoted your post',
                  };
                  const author = n.author as { handle?: string; displayName?: string; avatar?: string } | undefined;
                  return (
                    <div key={n.uri} class="glass" style={{ padding: 'var(--space-sm) var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', opacity: n.isRead ? 0.7 : 1 }}>
                      {author?.avatar && <img src={resizedAvatarUrl(author.avatar, 24)} alt="" width="24" height="24" style={{ borderRadius: '50%' }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: '600', fontSize: 'var(--font-sm)' }}>
                          {author?.displayName || author?.handle || 'Someone'}
                        </span>{' '}
                        <span style={{ color: 'var(--muted)', fontSize: 'var(--font-sm)' }}>
                          {reasonLabel[n.reason as string] ?? n.reason}
                        </span>
                      </div>
                      {n.indexedAt && (
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', flexShrink: 0 }}>
                          {new Date(n.indexedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-xl)' }}>No recent activity.</p>
            )
          ) : (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-2xl)' }}>Activity is only visible to the account owner.</p>
          )}
        </div>
      )}
    </div>
  );
});
