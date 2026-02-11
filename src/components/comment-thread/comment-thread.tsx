/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CommentThread – Nested/Threaded Replies with Furl/Unfurl
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Renders a tree of nested replies with:
 *  - Collapsible threads (furl/unfurl)
 *  - Inline reply forms
 *  - Like/downvote per reply
 *  - Author avatar and handle
 *  - Time ago formatting
 *  - Depth-based indentation (max 5 levels)
 *
 * HOW TO EDIT:
 *  - To change max nesting depth, edit MAX_DEPTH
 *  - To change the indentation per level, edit the paddingLeft calc
 *  - To add new reply actions (edit, delete), add buttons to the action row
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { component$, useSignal, $ } from '@builder.io/qwik';
import type { ForumReply } from '~/lib/types';

const MAX_DEPTH = 5;

interface CommentThreadProps {
  replies: ForumReply[];
  postUri: string;
  parentUri?: string;
  depth?: number;
}

export const CommentThread = component$<CommentThreadProps>(
  ({ replies, postUri, parentUri, depth = 0 }) => {
    // Filter replies for this level
    const levelReplies = replies.filter((r) => {
      if (depth === 0) return !r.replyTo;
      return r.replyTo === parentUri;
    });

    if (levelReplies.length === 0) return null;

    return (
      <div style={{ paddingLeft: depth > 0 ? `${Math.min(depth, MAX_DEPTH) * 16}px` : '0' }}>
        {levelReplies.map((reply) => (
          <CommentNode
            key={reply.uri}
            reply={reply}
            allReplies={replies}
            postUri={postUri}
            depth={depth}
          />
        ))}
      </div>
    );
  },
);

// ── Single Comment Node ───────────────────────────────────────────────────

const CommentNode = component$<{
  reply: ForumReply;
  allReplies: ForumReply[];
  postUri: string;
  depth: number;
}>(({ reply, allReplies, postUri, depth }) => {
  const collapsed = useSignal(false);
  const showReply = useSignal(false);
  const replyText = useSignal('');

  const childCount = allReplies.filter((r) => r.replyTo === reply.uri).length;

  const timeAgo = (() => {
    if (!reply.record?.createdAt) return '';
    const diff = Date.now() - new Date(reply.record.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  })();

  const handleSubmitReply = $(async () => {
    if (!replyText.value.trim()) return;
    try {
      const { createForumReply } = await import('~/lib/forum');
      await createForumReply({
        postUri, text: replyText.value, replyToUri: reply.uri,
      });
      replyText.value = '';
      showReply.value = false;
    } catch (err) {
      console.error('Reply failed:', err);
    }
  });

  return (
    <div style={{
      borderLeft: depth > 0 ? '2px solid var(--border)' : 'none',
      marginBottom: 'var(--space-sm)',
    }}>
      <div class="glass" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
          {reply.author.avatar && (
            <img src={reply.author.avatar} alt="" width="20" height="20" style={{ borderRadius: '50%' }} />
          )}
          <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600' }}>
            @{reply.author.handle}
          </span>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)' }}>{timeAgo}</span>

          {/* Collapse toggle */}
          {childCount > 0 && (
            <button
              style={{ fontSize: 'var(--font-xs)', color: 'var(--accent)', marginLeft: 'auto', minWidth: 'auto', minHeight: 'auto', padding: '2px 6px' }}
              onClick$={() => { collapsed.value = !collapsed.value; }}
            >
              {collapsed.value ? `[+${childCount}]` : '[-]'}
            </button>
          )}
        </div>

        {/* Reply text */}
        <p style={{ fontSize: 'var(--font-sm)', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {reply.record?.text}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
          <button style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', minWidth: 'auto', minHeight: 'auto' }}>
            ♥ {reply.likeCount ?? 0}
          </button>
          {depth < MAX_DEPTH && (
            <button
              style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', minWidth: 'auto', minHeight: 'auto' }}
              onClick$={() => { showReply.value = !showReply.value; }}
            >
              Reply
            </button>
          )}
        </div>

        {/* Inline reply form */}
        {showReply.value && (
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
            <input
              type="text"
              placeholder="Write a reply..."
              value={replyText.value}
              onInput$={(_, el) => { replyText.value = el.value; }}
              style={{ flex: 1, fontSize: 'var(--font-sm)', padding: '4px 8px' }}
            />
            <button class="btn" style={{ fontSize: 'var(--font-xs)', padding: '4px 10px' }} onClick$={handleSubmitReply}>
              Reply
            </button>
          </div>
        )}
      </div>

      {/* Nested children */}
      {!collapsed.value && childCount > 0 && (
        <CommentThread
          replies={allReplies}
          postUri={postUri}
          parentUri={reply.uri}
          depth={depth + 1}
        />
      )}
    </div>
  );
});
