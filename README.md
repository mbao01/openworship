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
│   ├── ow-core/            # Core domain logic (no Tauri deps)
│   ├── ow-search/          # Tantivy scripture search index
│   ├── ow-audio/           # Offline STT pipeline (Whisper.cpp, Deepgram)
│   ├── ow-display/         # Local WebSocket display server
│   └── ow-db/              # SQLite Bible DB (KJV, WEB, BSB)
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

**Start the full Tauri desktop app** (real Rust backend + Vite frontend):

```bash
pnpm desktop:dev
```

This is the recommended way to run OpenWorship locally. It:
- Compiles the Rust backend (SQLite Bible DB, Tantivy search, Whisper/Deepgram STT, WebSocket display server)
- Runs `pnpm --filter @openworship/web dev` to start the Vite dev server on `http://localhost:1420`
- Opens the native desktop window pointing at the dev server
- Watches both frontend and backend for changes and hot-reloads automatically
- All Tauri `invoke()` calls reach real Rust handlers — no mocked responses

> **Note:** The first build will take a few minutes while Cargo compiles all dependencies. Subsequent builds are much faster.

**Frontend only** (no native window — useful for pure UI work):

```bash
pnpm dev
# open http://localhost:1420
```

> Tauri IPC (`invoke()`) is unavailable in this mode. Use `pnpm desktop:dev` for full integration testing.

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
| Desktop dev | `pnpm desktop:dev` |
| Desktop build | `cd apps/desktop && cargo tauri build` |

---

## Minimum OS requirements

The effective minimum OS versions are set by Tauri 2 itself:

- **Windows**: Windows 10+
- **Linux**: Any distro with WebKitGTK 4.1 (Ubuntu 20.04+, Fedora 33+)
- **macOS**: 11.0+ (Big Sur) — required for Apple Silicon and `std::filesystem` in whisper.cpp/ggml

---

## Building for release

Desktop artifacts (.dmg, .exe, .AppImage) are built automatically by the CD workflow when a tag is pushed:

```bash
# Unstable patch release
git tag 0000.0.2
git push origin 0000.0.2

# First production release
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

All releases follow a single `YYYY.M.COUNTER` scheme:

| Phase | Year | Example tags |
|-------|------|--------------|
| Unstable / pre-release | `0000` | `0000.0.1`, `0000.0.2`, … |
| Production | real year | `2026.4.0`, `2026.4.1`, … |

> **Note on Cargo / Tauri manifests:** Both Cargo and Tauri v2 enforce strict
> semver and reject leading zeros (e.g. `0000.0.1` is invalid semver). Internal
> `Cargo.toml` and `tauri.conf.json` version fields therefore track a parallel
> semver string (`0.0.1`, `0.0.2`, …) that is bumped in lockstep with the tag.
> The published release name and artifact filename always use the `YYYY.M.COUNTER`
> tag — this is what end users see.

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
