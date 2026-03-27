# Patchbay

**A native desktop WebSocket client built for developers.**

![CI](https://github.com/yourusername/patchbay/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Go](https://img.shields.io/badge/go-1.22+-00ADD8.svg)
![Platform](https://img.shields.io/badge/platform-windows%20%7C%20macos%20%7C%20linux-lightgrey.svg)

Postman and Insomnia treat WebSockets as a second-class citizen. Patchbay is built around them. Stay connected, send multiple messages, watch the full-duplex stream in real time, and save everything — without writing a throwaway script or reaching for `wscat`.

Built with [Wails](https://wails.io/) (Go + React). Compiles to a lightweight native binary — no Electron, no browser tab.

---

## Features

- **Persistent connections** — stay connected and watch the full-duplex stream live, color-coded by direction
- **Multiple tabs** — run several connections simultaneously; useful for simulating multiple clients against pub/sub or matchmaking APIs
- **Message history** — sent and received messages persist to disk and reload when you reopen a tab
- **JSON pretty-printing** — payloads are automatically formatted if valid JSON
- **Saved sessions** — bookmark URLs you connect to frequently
- **Message templates** — save payloads you send repeatedly; click to inject them into the input

---

## Requirements

| Tool | Version |
|---|---|
| [Go](https://go.dev/dl/) | 1.22+ |
| [Node.js](https://nodejs.org/) | 18+ |
| [Wails CLI v2](https://wails.io/docs/gettingstarted/installation) | latest |
| WebView2 (Windows) | any — pre-installed on Windows 11 |

Install the Wails CLI:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

Verify everything is in order:

```bash
wails doctor
```

---

## Running

**Development** (hot reload):
```bash
wails dev
```

**Build** a production binary:
```bash
wails build
# Output: build/bin/patchbay.exe
```

---

## Data

Message history, saved sessions, and templates are stored in a local SQLite database at:

- **Windows:** `%APPDATA%\patchbay\data.db`
- **macOS:** `~/Library/Application Support/patchbay/data.db`
- **Linux:** `~/.config/patchbay/data.db`

---

## Roadmap

These features are planned and will be built in roughly this order.

#### Environment variables
Define named environments (dev, staging, prod) with key/value pairs. Reference them in any message payload with `{{TOKEN}}` — Patchbay substitutes the value before sending. Switch environments from the sidebar without touching your payloads.

#### Scriptable flows
A JSON-defined sequence of steps that execute automatically against an active connection:
- `send` — send a message (with variable substitution)
- `waitFor` — block until a received message matches a pattern, with timeout and optional value extraction
- `delay` — pause for N milliseconds

Flows are saved alongside sessions and templates. Useful for automating stateful sequences like auth → matchmaking → game start without manually stepping through each message.

#### Response filtering
A live filter bar above the message stream. Type a string or field value and only matching messages are shown. Cuts through noise on high-volume connections.

#### Multi-connection broadcast
Select two or more open tabs and send a message to all of them simultaneously. Useful for testing pub/sub fan-out, simulating multiple players in a matchmaking queue, or verifying a server event reaches every connected client.

#### Session recording and replay
Record a full session — the complete sequence of sent and received messages with timestamps — to a file. Replay it against any endpoint. Useful for reproducing bugs, running the same flow repeatedly during development, or sharing a reproduction case.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, project structure, and how to submit a pull request.

For significant changes, open an issue first to discuss the approach.

---

## License

[MIT](LICENSE)

---

<img src="rushdown.png" width="20" style="vertical-align:middle"/> Built with ❤️ at [Rushdown Studios](https://rushdownstudios.com)
