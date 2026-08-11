# desktop-tauri

Minimal delta for a Tauri 2 desktop app — the heavy scaffolding comes from upstream: run `pnpm create tauri-app@latest apps/desktop` after stamping, then keep the jig root (docs, hooks, gate) and wire the app's `typecheck`/`test` into it. This flavor ships only what upstream doesn't: the Rust standards delta and toolchain pin.

Codesigning/notarization stays a local release step; CI still runs the verify gate and handles post-release fan-out.
