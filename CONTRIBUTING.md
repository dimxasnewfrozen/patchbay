# Contributing to Patchbay

Thanks for your interest in contributing. This document covers everything you need to get a dev environment running and submit a pull request.

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Go | 1.22+ | https://go.dev/dl/ |
| Node.js | 18+ | https://nodejs.org/ |
| Wails CLI | v2 | `go install github.com/wailsapp/wails/v2/cmd/wails@latest` |
| WebView2 | any | Pre-installed on Windows 11. [Download](https://developer.microsoft.com/microsoft-edge/webview2/) for Windows 10. |

Verify your setup:

```bash
wails doctor
```

## Running locally

```bash
git clone https://github.com/yourusername/patchbay
cd patchbay
wails dev
```

`wails dev` starts the app with hot reload — Go changes restart the backend, React changes hot-reload in place. The Wails CLI generates the JS bindings in `frontend/wailsjs/` on first run; these are committed to the repo so the frontend can build without the CLI.

## Running the test server

A mock game backend lives in `testserver/` for local testing:

```bash
cd testserver
go run main.go
# Connect Patchbay to ws://localhost:8080/ws
```

## Running tests

```bash
# From the repo root
go test ./...
go vet ./...
```

Tests only cover the Go backend. The store tests use an in-memory SQLite database via `t.TempDir()` — no setup needed.

## Project structure

```
patchbay/
├── main.go           — Wails entry point
├── app.go            — bound methods exposed to the frontend
├── wsmanager.go      — WebSocket connection lifecycle
├── store.go          — SQLite persistence (sessions, templates, message history)
├── store_test.go     — store unit tests
├── testserver/       — mock WebSocket server for local testing
└── frontend/
    ├── src/
    │   ├── App.jsx                    — tab management, sidebar
    │   └── components/
    │       ├── ConnectionTab.jsx      — per-connection view
    │       ├── MessageList.jsx        — message stream
    │       └── Sidebar.jsx            — sessions and templates
    └── wailsjs/                       — generated Wails bindings (committed)
```

## Making changes

**Backend (Go):** All exported types and functions must have godoc comments. Run `go vet ./...` before opening a PR.

**Frontend (React):** Keep components focused. Inline styles are intentional (no build-time CSS tooling dependency). Don't add a state management library without opening an issue first.

**New dependencies:** Open an issue before adding a new Go module or npm package. We keep the dependency surface small.

## Submitting a pull request

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `go test ./...` and `go vet ./...`
4. Open a PR — fill out the template

For significant changes (new features, architecture changes) open an issue first so we can discuss the approach before you invest time writing code.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include your OS, Patchbay version, and steps to reproduce.
