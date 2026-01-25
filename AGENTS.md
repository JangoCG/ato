# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Project Overview

This is a Tauri 2.x desktop application with a React/TypeScript frontend and Rust backend.

## Development Commands

```bash
# Install dependencies
bun install

# Start development (runs both Vite dev server and Tauri app)
bun run tauri dev

# Build for production
bun run tauri build

# Run only the frontend dev server (without Tauri)
bun run dev
```

## Architecture

**Frontend** (`src/`): React 18 with TypeScript, bundled by Vite on port 1420.

**Backend** (`src-tauri/`): Rust application using Tauri framework. Commands are defined in `src-tauri/src/lib.rs` using the `#[tauri::command]` macro.

**IPC Communication**: Frontend calls Rust via `invoke("command_name", { args })` from `@tauri-apps/api/core`. Commands must be registered in the `tauri::generate_handler!` macro in `lib.rs`.

**Tauri Config** (`src-tauri/tauri.conf.json`): App settings, window config, and build commands.

**Capabilities** (`src-tauri/capabilities/`): Security permissions for the app.

## Adding New Tauri Commands

1. Define the command in `src-tauri/src/lib.rs`:
   ```rust
   #[tauri::command]
   fn my_command(arg: &str) -> String {
       format!("Result: {}", arg)
   }
   ```

2. Register it in `generate_handler!`:
   ```rust
   .invoke_handler(tauri::generate_handler![greet, my_command])
   ```

3. Call from frontend:
   ```typescript
   import { invoke } from "@tauri-apps/api/core";
   const result = await invoke("my_command", { arg: "value" });
   ```

## TypeScript Configuration

Strict mode is enabled. The project uses `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.