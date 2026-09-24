---
paths: app/src-tauri/**
---
# Rust / Tauri rules
- Rust sources are in `app/src-tauri/rust/` (Cargo path overrides), never recreate `src-tauri/src/`.
- Stream bulk JSONL.gz line-by-line; never load a whole bulk file into memory.
- Emit progress events for any operation > 1 s.
- Capabilities: grant the minimum (`fs` app-data + user-picked paths, `dialog`, `http` to listed hosts, `sql`, `store`, `opener`). No wildcard http.
- `cargo clippy` clean; `cargo test` for any parsing logic.
