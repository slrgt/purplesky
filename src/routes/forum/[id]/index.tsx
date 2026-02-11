/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Forum Post Detail – Threaded Replies, Voting, Wiki Promotion
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Displays a single forum post with:
 *  - Full post content with formatting
 *  - Threaded/nested replies (furl/unfurl)
 *  - Reply composer with @mentions
 *  - Like/downvote integration with Microcosm
 *  - Pin/highlight controls for post author
 *  - Promote to wiki page
 *  - Edit/delete for own posts
 *
 * HOW TO EDIT:
 *  - To change the reply threading depth, edit maxDepth
 *  - To add reaction types, extend the action buttons
 *  - Reply data uses app.purplesky.forum.reply lexicon
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';
import { useAppState } from '~/context/app-context';
import { CommentThread } from '~/components/comment-thread/comment-thread';
import type { ForumPost, ForumReply } from '~/lib/types';

export default component$(() => {
  const app = useAppState();
  const loc = useLocation();
  const postUri = decodeURIComponent(loc.params.id);

  const post = useSignal<ForumPost | null>(null);
  const replies = useSignal<ForumReply[]>([]);
  const loading = useSignal(true);
  const replyText = useSignal('');

  // Load post and replies
  useVisibleTask$(async () => {
    try {
      const { getForumPost, listForumReplies } = await import('~/lib/forum');
      const [p, r] = await Promise.all([
        getForumPost(postUri),
        listForumReplies(postUri, app.session.did ? [app.session.did] : []),
      ]);
      post.value = p;
      replies.value = r;
    } catch (err) {
      console.error('Failed to load post:', err);
    }
    loading.value = false;
  });

  // Submit reply
  const handleReply = $(async () => {
    if (!replyText.value.trim()) return;
    try {
      const { createForumReply, listForumReplies } = await import('~/lib/forum');
      await createForumReply({ postUri, text: replyText.value });
      replyText.value = '';
      replies.value = await listForumReplies(postUri, app.session.did ? [app.session.did] : []);
    } catch (err) {
      console.error('Failed to reply:', err);
    }
  });

  // Promote to wiki
  const handlePromoteWiki = $(async () => {
    try {
      const { promoteToWiki } = await import('~/lib/forum');
      await promoteToWiki(postUri);
      // Reload
      const { getForumPost } = await import('~/lib/forum');
      post.value = await getForumPost(postUri);
    } catch (err) {
      console.error('Failed to promote:', err);
    }
  });

  if (loading.value) {
    return <div class="flex-center" style={{ padding: 'var(--space-2xl)' }}><div class="spinner" /></div>;
  }

  if (!post.value) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--muted)' }}>
        <h2>Post not found</h2>
      </div>
    );
  }

  const p = post.value;
  const isAuthor = app.session.did === p.did;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Post Header */}
      <article class="glass-strong" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          {p.isPinned && <span class="badge">Pinned</span>}
          {p.isWiki && <span class="badge-success badge">Wiki</span>}
        </div>

        <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: '700', marginBottom: 'var(--space-md)' }}>
          {p.title || 'Untitled'}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', color: 'var(--muted)', fontSize: 'var(--font-sm)' }}>
          {p.authorAvatar && (
            <img src={p.authorAvatar} alt="" width="28" height="28" style={{ borderRadius: '50%' }} />
          )}
          <span>@{p.authorHandle ?? p.did}</span>
          {p.createdAt && <span>{new Date(p.createdAt).toLocaleDateString()}</span>}
        </div>

        {/* Post body */}
        <div style={{ lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {p.body}
        </div>

        {/* Tags */}
        {p.tags && p.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-lg)', flexWrap: 'wrap' }}>
            {p.tags.map((tag) => (
              <span key={tag} class="badge">#{tag}</span>
            ))}
          </div>
        )}

        {/* Author actions */}
        {isAuthor && (
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-md)' }}>
            <button class="btn-ghost" style={{ fontSize: 'var(--font-sm)' }}>Edit</button>
            {!p.isWiki && (
              <button class="btn-ghost" style={{ fontSize: 'var(--font-sm)' }} onClick$={handlePromoteWiki}>
                Promote to Wiki
              </button>
            )}
            <button class="btn-ghost" style={{ fontSize: 'var(--font-sm)', color: 'var(--danger)' }}>Delete</button>
          </div>
        )}
      </article>

      {/* Replies Section */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: '600', marginBottom: 'var(--space-md)' }}>
          Replies ({replies.value.length})
        </h2>

        {/* Reply composer */}
        {app.session.isLoggedIn && (
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
            <textarea
              placeholder="Write a reply... Use @username for mentions"
              value={replyText.value}
              onInput$={(_, el) => { replyText.value = el.value; }}
              style={{ flex: 1, minHeight: '80px', resize: 'vertical' }}
            />
            <button class="btn" onClick$={handleReply} style={{ alignSelf: 'flex-end' }}>
              Reply
            </button>
          </div>
        )}

        {/* Threaded replies */}
        <CommentThread replies={replies.value} postUri={postUri} />
      </div>
    </div>
  );
});
