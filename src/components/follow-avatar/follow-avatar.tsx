/**
 * Avatar with optional follow overlay: when not following, shows "+" on the avatar
 * and clicking the avatar follows. When following, no overlay; avatar can link to profile.
 */

import { component$, useSignal, $, useVisibleTask$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import { useAppState } from '~/context/app-context';

import './follow-avatar.css';

export interface FollowAvatarProps {
  authorDid: string;
  followUri?: string;
  profilePath: string;
  avatarUrl: string | undefined;
  size: number;
  /** Optional class for the wrapper */
  class?: string;
}

export const FollowAvatar = component$<FollowAvatarProps>(
  ({ authorDid, followUri, profilePath, avatarUrl, size, class: className }) => {
    const app = useAppState();
    const following = useSignal(followUri ?? '');
    const followLoading = useSignal(false);

    useVisibleTask$(({ track }) => {
      track(() => followUri);
      following.value = followUri ?? '';
    });

    const handleFollow = $(async () => {
      if (!authorDid || followLoading.value || !app.session.isLoggedIn) return;
      followLoading.value = true;
      try {
        const { followUser } = await import('~/lib/bsky');
        const uri = await followUser(authorDid);
        following.value = uri;
      } catch (err) {
        console.error('Follow failed:', err);
      }
      followLoading.value = false;
    });

    const isMe = app.session.did === authorDid;
    const canFollow = app.session.isLoggedIn && !isMe;
    const showOverlay = canFollow && !following.value;

    const avatarEl = avatarUrl ? (
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: '50%', display: 'block' }}
        loading="lazy"
      />
    ) : (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--border)',
        }}
      />
    );

    return (
      <span class={`follow-avatar ${className ?? ''}`} style={{ position: 'relative', flexShrink: 0 }}>
        {showOverlay ? (
          <button
            type="button"
            class="follow-avatar-btn"
            onClick$={handleFollow}
            disabled={followLoading.value}
            aria-label="Follow"
            style={{ width: size, height: size }}
          >
            {avatarEl}
            <span class="follow-avatar-plus" style={{ fontSize: Math.max(10, size * 0.5) }}>{followLoading.value ? '…' : '+'}</span>
          </button>
        ) : following.value ? (
          <Link href={profilePath} class="follow-avatar-link" style={{ display: 'block' }}>
            {avatarEl}
          </Link>
        ) : (
          <Link href={profilePath} class="follow-avatar-link" style={{ display: 'block' }}>
            {avatarEl}
          </Link>
        )}
      </span>
    );
  },
);
