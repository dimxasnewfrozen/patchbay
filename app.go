package main

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the main application struct. All exported methods are bound to the
// Wails runtime and become callable from the frontend via the generated JS
// bindings. Method names must stay stable across releases to avoid breaking
// the bindings.
type App struct {
	ctx     context.Context
	manager *WSManager
	store   *Store
}

// NewApp creates a new App instance. Called once at startup by main.
func NewApp() *App {
	return &App{}
}

// startup is invoked by the Wails runtime after the application window is
// ready. It initialises the persistent store and the WebSocket manager.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.store = NewStore()
	a.manager = NewWSManager(ctx)
}

// shutdown is invoked by the Wails runtime when the window is closed.
// It tears down all active WebSocket connections and flushes the database.
func (a *App) shutdown(_ context.Context) {
	a.manager.CloseAll()
	a.store.Close()
}

// ── Connection ────────────────────────────────────────────────────────────────

// Connect opens a WebSocket connection identified by id to the given url.
//
// Incoming messages are emitted as "message:<id>" Wails events and persisted
// to the message history. A "connection:closed:<id>" event is emitted only if
// the connection drops unexpectedly; deliberate disconnects are silent.
func (a *App) Connect(id, url string) error {
	return a.manager.Connect(id, url,
		func(msg Message) {
			runtime.EventsEmit(a.ctx, "message:"+id, msg)
			a.store.SaveMessage(msg) //nolint:errcheck // best-effort persistence
		},
		func() {
			runtime.EventsEmit(a.ctx, "connection:closed:"+id, nil)
		},
	)
}

// Disconnect closes the WebSocket connection identified by id.
// The frontend is not notified (no event is emitted) because the disconnect
// was user-initiated.
func (a *App) Disconnect(id string) error {
	return a.manager.Disconnect(id)
}

// SendMessage sends a text message on the connection identified by id.
// The sent message is emitted as a "message:<id>" event and saved to history.
func (a *App) SendMessage(id, content string) error {
	msg, err := a.manager.Send(id, content)
	if err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "message:"+id, msg)
	a.store.SaveMessage(msg) //nolint:errcheck // best-effort persistence
	return nil
}

// ── History ───────────────────────────────────────────────────────────────────

// GetHistory returns up to 1000 messages for the given connection ID,
// ordered oldest-first. Used to restore the message stream on tab load.
func (a *App) GetHistory(connectionID string) ([]Message, error) {
	return a.store.GetMessages(connectionID)
}

// ClearHistory deletes all stored messages for the given connection ID.
func (a *App) ClearHistory(connectionID string) error {
	return a.store.ClearMessages(connectionID)
}

// ── Sessions ──────────────────────────────────────────────────────────────────

// SaveSession persists a named session (URL bookmark) to the database.
func (a *App) SaveSession(name, url string) error {
	return a.store.SaveSession(Session{Name: name, URL: url})
}

// GetSessions returns all saved sessions ordered by creation time descending.
func (a *App) GetSessions() ([]Session, error) {
	return a.store.GetSessions()
}

// DeleteSession removes a saved session by its ID.
func (a *App) DeleteSession(id string) error {
	return a.store.DeleteSession(id)
}

// ── Templates ─────────────────────────────────────────────────────────────────

// SaveTemplate persists a named message template to the database.
func (a *App) SaveTemplate(name, content string) error {
	return a.store.SaveTemplate(Template{Name: name, Content: content})
}

// GetTemplates returns all saved templates ordered by creation time descending.
func (a *App) GetTemplates() ([]Template, error) {
	return a.store.GetTemplates()
}

// DeleteTemplate removes a saved template by its ID.
func (a *App) DeleteTemplate(id string) error {
	return a.store.DeleteTemplate(id)
}
