# OpenWorship

AI-powered worship display — listens to the sermon, detects scripture references and song cues, and projects the right content automatically. No trained volunteer required.

---

## Prerequisites

Before you can run or build OpenWorship locally you need the following tools installed.

### All platforms

| Tool | Version | Install |
|------|---------|---------|
| [Rust](https://rustup.rs) | stable (≥ 1.78) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| [Node.js](https://nodejs.org) | ≥ 22 | [nodejs.org](https://nodejs.org) or via [nvm](https://github.com/nvm-sh/nvm) |
| [pnpm](https://pnpm.io) | ≥ 9.15 | `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@latest --activate` |

### macOS

```bash
xcode-select --install
```

### Linux (Ubuntu / Debian)

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev
```

### Windows

- Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (select "Desktop development with C++")
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 11)

---

## Project structure

```
openworship/
├── .github/
│   └── workflows/
│       ├── ci.yml          # lint, type-check, test on every PR
│       └── cd.yml          # Tauri desktop builds on tagged releases
│
├── apps/
│   ├── desktop/            # Tauri shell (thin orchestrator)
│   │   ├── src/
│   │   │   ├── main.rs     # Tauri entry point
│   │   │   ├── lib.rs      # App setup
│   │   │   ├── commands.rs # Tauri IPC commands
│   │   │   └── state.rs    # App state
│   │   ├── icons/          # App icons (all platforms)
│   │   ├── capabilities/   # Tauri permission capabilities
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   │
│   └── web/                # Vite + React frontend
│       ├── src/
│       │   ├── routes/     # Page-level components (operator, display, artifacts, settings)
│       │   ├── components/ # Reusable UI components
│       │   ├── hooks/      # Custom React hooks
│       │   ├── stores/     # Zustand state management
│       │   ├── lib/        # Tauri IPC bridge, WebSocket client, shared types
│       │   └── styles/     # Design system CSS variables
│       ├── package.json
│       └── vite.config.ts
│
├── crates/
│   ├── ow-core/            # Core domain logic (no Tauri deps) — Phase 2+
│   ├── ow-search/          # Tantivy scripture search index — Phase 2+
│   ├── ow-audio/           # STT pipeline (Whisper.cpp / Deepgram) — Phase 2+
│   ├── ow-display/         # Local WebSocket display server — Phase 2+
│   └── ow-db/              # SQLite persistence layer — Phase 2+
│
├── Cargo.toml              # Rust workspace
├── package.json            # Node workspace (pnpm)
├── pnpm-workspace.yaml
└── rust-toolchain.toml
```

---

## Setup

**1. Clone the repository**

```bash
git clone https://github.com/mbao01/openworship.git
cd openworship
```

**2. Install frontend dependencies**

```bash
pnpm install
```

**3. Verify Rust toolchain**

```bash
rustup show          # should print the active stable toolchain
cargo --version
```

---

## Running locally

**Start the Tauri dev server** (launches both the Vite frontend and the native window):

```bash
cd apps/desktop
cargo tauri dev
```

This command:
- Runs `pnpm --filter @openworship/web dev` to start the Vite dev server on `http://localhost:1420`
- Compiles the Rust backend and opens the native desktop window pointing at the dev server
- Watches both the frontend and backend for changes and hot-reloads automatically

> **Note:** The first build will take a few minutes while Cargo compiles all dependencies. Subsequent builds are much faster.

**Frontend only** (no native window — useful for pure UI work):

```bash
cd apps/web
pnpm dev
# open http://localhost:1420
```

---

## Common tasks

| Task | Command (from repo root) |
|------|--------------------------|
| Install dependencies | `pnpm install` |
| Lint | `pnpm lint` |
| Type-check | `pnpm type-check` |
| Run tests | `pnpm test` |
| Check Rust | `cargo check` |
| Rust lints | `cargo clippy -- -D warnings` |
| Rust tests | `cargo test` |
| Desktop dev | `cd apps/desktop && cargo tauri dev` |
| Desktop build | `cd apps/desktop && cargo tauri build` |

---

## Building for release

Desktop artifacts (.dmg, .exe, .AppImage) are built automatically by the CD workflow when a tag is pushed:

```bash
# Pre-release (patch increment)
git tag 0.0.2
git push origin 0.0.2

# Production (CalVer — first prod release)
git tag 2026.4.0
git push origin 2026.4.0
```

The release workflow builds universal binaries on macOS, Windows, and Linux and publishes a draft GitHub Release with all artifacts attached.

To build locally:

```bash
cd apps/desktop
cargo tauri build
# artifacts output to: apps/desktop/target/release/bundle/
```

---

## Branch and PR workflow

- **No direct commits to `main`** — open a PR from a feature branch
- **Branch naming**: `TICKET_ID-slug` (e.g. `OPE-5-scripture-search`)
- CI must pass before merge
- All CI checks run automatically on every PR: frontend lint/type-check/test + Rust check/clippy/test

---

## Versioning

| Phase | Format | Example |
|-------|--------|---------|
| Pre-release | `0.0.PATCH` | `0.0.1`, `0.0.2` |
| Production | `YYYY.M.COUNTER` | `2026.4.0`, `2026.4.1` |

---

## Troubleshooting

**`error: failed to run custom build command` on first build**
Run `cargo clean` then retry. This sometimes happens when switching branches with different Cargo.lock states.

**`libwebkit2gtk-4.1` not found (Linux)**
Re-run the Linux prerequisites block above. Ensure you install `libwebkit2gtk-4.1-dev` (not the older `4.0` variant).

**Vite dev server not starting**
Make sure `pnpm install` has been run from the repo root. The `apps/web` workspace package must be linked before `cargo tauri dev` can invoke the frontend build command.

**`cargo` not found**
Install Rust via rustup: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`, then restart your terminal.
