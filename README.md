# PurpleSky

A high-performance Bluesky (AT Protocol) PWA built with **Qwik** and **Rust/WebAssembly**, featuring feeds, forums, Polis-like consensus, and collaboration tools for artists and game developers.

## Features

### Core (ported from ArtSky)
- **Masonry Feed** – Multi-column grid of images and videos with infinite scroll
- **Collections (Artboards)** – Save posts to named collections, synced to your PDS
- **Remix Feeds** – Mix multiple Bluesky feeds by percentage (e.g., 60% Following + 40% Art)
- **Suggested Accounts** – "Followed by people you follow" recommendations
- **Seen Posts** – Track which posts you've scrolled past, hide them from view
- **Comments** – Reply to posts with @mentions and #hashtags
- **Voting** – Likes as upvotes + Microcosm constellation downvotes

### Forums
- Post, reply, and collaborate using custom AT Protocol lexicons
- Threaded/nested replies with furl/unfurl
- Draft posts for later editing
- Pinning and highlighting key posts
- Wiki-style pages promoted from threads
- Sorting, filtering, tag-based organization, @mentions

### Polis-like Consensus
- Submit statements for group discussion
- Vote agree/disagree/pass on each statement
- WASM-powered opinion cluster detection
- Consensus visualization (agreement bars, divisiveness scores)
- Polls and surveys for collaborative decision-making

### Collaboration (Blender & Godot)
- **Blender workflow**: .blend metadata on PDS, full files on Git LFS/cloud/torrent v2
- **Godot workflow**: Project metadata on PDS, files stored externally
- Lightweight previews (GLTF, HTML5 exports) on PDS for in-app viewing
- Kanban boards for task/project management
- Annotations and threaded feedback on assets
- Template libraries for rigs, scenes, shaders, scripts

### Social & Interactive
- Threaded comments with nested replies
- User profiles with activity, posts, votes, forum participation
- Custom ranking: trending, best (Wilson score), newest, controversial
- Infinite scrolling with smart prefetching
- Light/dark/high-contrast modes, keyboard navigation

### PWA
- Installable via manifest.json
- Offline support via service worker
- Cache strategies for images, videos, data
- Background sync for offline edits

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Qwik](https://qwik.dev/) (resumable, near-instant TTI) |
| Computation | Rust → WebAssembly (feed sorting, consensus, masonry layout) |
| Protocol | [AT Protocol](https://atproto.com/) (Bluesky) |
| Voting | [Microcosm Constellations](https://www.microcosm.blue/) |
| Build | Vite |
| Deploy | GitHub Pages (static) |

## Project Structure

```
purplesky/
├── package.json              # Node dependencies and scripts
├── vite.config.ts            # Vite + Qwik + WASM config
├── tsconfig.json             # TypeScript config
├── wasm/                     # Rust WASM module
│   ├── Cargo.toml            #   Rust dependencies
│   └── src/lib.rs            #   Feed sorting, consensus, masonry layout
├── src/
│   ├── root.tsx              # Qwik root component
│   ├── entry.ssr.tsx         # SSR/SSG entry
│   ├── global.css            # Theme variables, resets, utilities
│   ├── context/
│   │   └── app-context.tsx   # Global state (session, theme, filters)
│   ├── lib/
│   │   ├── bsky.ts           # AT Protocol client (auth, feeds, posts)
│   │   ├── oauth.ts          # OAuth "Log in with Bluesky"
│   │   ├── constellation.ts  # Microcosm voting API
│   │   ├── artboards.ts      # Collections + PDS sync
│   │   ├── forum.ts          # Forum posts, replies, wiki, drafts
│   │   ├── collab.ts         # Blender/Godot projects, kanban, annotations
│   │   ├── wasm-bridge.ts    # JS ↔ WASM interface with fallbacks
│   │   └── types.ts          # Shared TypeScript types
│   ├── routes/
│   │   ├── layout.tsx        # App shell (header, nav, login modal)
│   │   ├── layout.css        # Layout styles
│   │   ├── index.tsx         # Feed page (masonry grid)
│   │   ├── feed.css          # Feed styles
│   │   ├── post/[uri]/       # Post detail with thread
│   │   ├── profile/[handle]/ # User profile
│   │   ├── forum/            # Forum list + post detail
│   │   ├── consensus/        # Polis-like voting
│   │   ├── collab/           # Collaboration hub
│   │   └── artboards/        # Collections manager
│   └── components/
│       ├── post-card/        # Individual post card
│       ├── feed-selector/    # Feed mixing UI
│       └── comment-thread/   # Nested threaded replies
├── public/
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker (offline + caching)
│   ├── icon.svg              # App icon
│   └── client-metadata.json  # OAuth client metadata
├── lexicons/                 # AT Protocol lexicon definitions
│   ├── app.purplesky.forum.post.json
│   ├── app.purplesky.forum.reply.json
│   ├── app.purplesky.forum.wiki.json
│   ├── app.purplesky.consensus.vote.json
│   ├── app.purplesky.collab.project.json
│   └── app.artsky.artboard.json
└── .github/workflows/
    └── deploy.yml            # GitHub Pages deployment
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (for WASM compilation)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

### Install

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Install Node.js dependencies
npm install

# Build the WASM module
npm run build:wasm
```

### Development

```bash
npm start
# Opens at http://localhost:5173
```

By default the dev server serves the app at the **root** (`/`). To run it at a **subpath** (e.g. to match production at `/purplesky/`):

```bash
npm run dev:subpath
# Then open http://127.0.0.1:5173/purplesky/
```

Or set the base manually: `VITE_BASE_PATH=/purplesky/ npm run dev`, then open `http://127.0.0.1:5173/purplesky/`.

### Build for Production

```bash
npm run build
# Output in dist/
```

### Deploy to GitHub Pages

1. Update `public/client-metadata.json` with your GitHub Pages URL (or let the workflow generate it; see `.github/workflows/deploy.yml`).
2. Push to the `main` branch.
3. GitHub Actions will automatically build and deploy.

**Forking:** If you fork the repo and deploy from your fork, the workflow uses your **repository name** as the base path (`VITE_BASE_PATH=/${{ github.event.repository.name }}/`). So the app and PWA install (e.g. “Add to Home Screen”) will use the correct URL (e.g. `https://yourname.github.io/your-repo-name/`) with no extra config. The manifest `start_url` and `scope` are rewritten at build time to match.

**Custom base path (e.g. self-hosted at a subpath):** Set `VITE_BASE_PATH` when building, e.g. `VITE_BASE_PATH=/my-app/ npm run build`.

Or build manually and upload:

```bash
npm run build
# Upload dist/ to your hosting (or dist/<base-path-segment>/ if using a subpath)
```

## How to Edit

Every file has comments at the top explaining what it does and how to modify it. Here's a quick guide:

### Feed Display
- **Masonry layout**: `src/routes/index.tsx` (column count, sort mode)
- **Post cards**: `src/components/post-card/post-card.tsx` (what's shown per post)
- **Feed mixing**: `src/components/feed-selector/feed-selector.tsx`

### Voting & Microcosm
- **Like/downvote logic**: `src/lib/bsky.ts` (createDownvote, deleteDownvote)
- **Constellation API**: `src/lib/constellation.ts` (vote counting)
- **Vote calculations**: `wasm/src/lib.rs` (SECTION 2)

### Forums
- **Post creation**: `src/lib/forum.ts` (createForumPost)
- **Thread display**: `src/routes/forum/[id]/index.tsx`
- **Nested replies**: `src/components/comment-thread/comment-thread.tsx`

### Consensus (Polis-like)
- **Voting UI**: `src/routes/consensus/index.tsx`
- **WASM analysis**: `wasm/src/lib.rs` (SECTION 4: analyze_consensus)
- **JS bridge**: `src/lib/wasm-bridge.ts` (analyzeConsensus)

### Collaboration
- **Project CRUD**: `src/lib/collab.ts`
- **Kanban boards**: `src/lib/collab.ts` (getKanbanBoard, addKanbanCard)
- **Project UI**: `src/routes/collab/index.tsx`

### Theme & Design
- **Colors**: `src/global.css` (CSS custom properties)
- **Layout**: `src/routes/layout.tsx` + `layout.css`
- **Theme toggle**: layout.tsx cycleTheme function

### AT Protocol Lexicons
- **Forum posts**: `lexicons/app.purplesky.forum.post.json`
- **Replies**: `lexicons/app.purplesky.forum.reply.json`
- **Projects**: `lexicons/app.purplesky.collab.project.json`
- **Consensus votes**: `lexicons/app.purplesky.consensus.vote.json`

## Architecture Notes

### Why Qwik?
Qwik uses **resumability** instead of hydration. The browser loads only the JavaScript needed for the current interaction, making time-to-interactive nearly instant even on slow devices.

### Why Rust/WASM?
Computation-heavy tasks (sorting thousands of posts, consensus clustering, masonry layout distribution) run in WebAssembly for better performance than JavaScript. Each WASM function has a JS fallback, so the app works even if WASM fails to load.

### Why AT Protocol?
All data (posts, collections, forum threads, votes) is stored on the user's Personal Data Server (PDS). This means data is portable, user-owned, and interoperable with other AT Protocol apps.

### Offline Strategy
- Static assets: Cached on install, served from cache
- API data: Network-first, falls back to cache
- Images/videos: Cache-first with size limits
- Offline edits: Queued in IndexedDB, synced on reconnection

## License

AGPL-3.0-or-later
