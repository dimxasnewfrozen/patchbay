package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// Session is a saved WebSocket endpoint — a named URL bookmark.
type Session struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"createdAt"`
}

// Template is a saved message payload that can be loaded into the compose area.
type Template struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

// Store manages all persistent data using an embedded SQLite database.
// The database file lives in the OS user-config directory under "patchbay/".
type Store struct {
	db *sql.DB
}

// NewStore opens (or creates) the SQLite database and runs schema migrations.
// Panics if the database cannot be opened or the schema cannot be applied,
// since the application cannot function without a working store.
func NewStore() *Store {
	dir, err := os.UserConfigDir()
	if err != nil {
		// Fall back to the working directory if the config dir is unavailable.
		dir = "."
	}

	dir = filepath.Join(dir, "patchbay")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		panic(fmt.Sprintf("patchbay: create config dir: %v", err))
	}

	db, err := openDB(filepath.Join(dir, "data.db"))
	if err != nil {
		panic(fmt.Sprintf("patchbay: open database: %v", err))
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		panic(fmt.Sprintf("patchbay: migrate database: %v", err))
	}
	return s
}

// openDB opens a SQLite database at path, creating it if necessary.
// Extracted from NewStore so that tests can open databases at arbitrary paths.
func openDB(path string) (*sql.DB, error) {
	return sql.Open("sqlite", path)
}

// migrate creates the schema tables and indexes if they do not already exist.
// All statements use IF NOT EXISTS so this is safe to call on every startup.
func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS sessions (
			id         TEXT PRIMARY KEY,
			name       TEXT NOT NULL,
			url        TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS templates (
			id         TEXT PRIMARY KEY,
			name       TEXT NOT NULL,
			content    TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS messages (
			id            TEXT PRIMARY KEY,
			connection_id TEXT     NOT NULL,
			direction     TEXT     NOT NULL,
			content       TEXT     NOT NULL,
			timestamp     DATETIME NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_messages_conn
			ON messages(connection_id, timestamp)`,
	}

	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return fmt.Errorf("exec migration: %w", err)
		}
	}
	return nil
}

// ── Sessions ──────────────────────────────────────────────────────────────────

// SaveSession inserts or replaces a session. A UUID is assigned when ID is empty.
// INSERT OR REPLACE is used so that re-saving an existing bookmark (same ID)
// updates it in place rather than creating a duplicate.
func (s *Store) SaveSession(sess Session) error {
	if sess.ID == "" {
		sess.ID = uuid.NewString()
	}
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO sessions (id, name, url) VALUES (?, ?, ?)`,
		sess.ID, sess.Name, sess.URL,
	)
	return err
}

// GetSessions returns all saved sessions ordered by creation time descending.
func (s *Store) GetSessions() ([]Session, error) {
	rows, err := s.db.Query(
		`SELECT id, name, url, created_at FROM sessions ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Session
	for rows.Next() {
		var sess Session
		if err := rows.Scan(&sess.ID, &sess.Name, &sess.URL, &sess.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan session row: %w", err)
		}
		out = append(out, sess)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate session rows: %w", err)
	}
	return out, nil
}

// DeleteSession removes the session with the given ID.
func (s *Store) DeleteSession(id string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE id = ?`, id)
	return err
}

// ── Templates ─────────────────────────────────────────────────────────────────

// SaveTemplate inserts or replaces a template. A UUID is assigned when ID is empty.
func (s *Store) SaveTemplate(t Template) error {
	if t.ID == "" {
		t.ID = uuid.NewString()
	}
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO templates (id, name, content) VALUES (?, ?, ?)`,
		t.ID, t.Name, t.Content,
	)
	return err
}

// GetTemplates returns all saved templates ordered by creation time descending.
func (s *Store) GetTemplates() ([]Template, error) {
	rows, err := s.db.Query(
		`SELECT id, name, content, created_at FROM templates ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Template
	for rows.Next() {
		var t Template
		if err := rows.Scan(&t.ID, &t.Name, &t.Content, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan template row: %w", err)
		}
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate template rows: %w", err)
	}
	return out, nil
}

// DeleteTemplate removes the template with the given ID.
func (s *Store) DeleteTemplate(id string) error {
	_, err := s.db.Exec(`DELETE FROM templates WHERE id = ?`, id)
	return err
}

// ── Messages ──────────────────────────────────────────────────────────────────

// SaveMessage persists a sent or received message to history.
// Messages use INSERT (not INSERT OR REPLACE) because IDs are UUIDs and
// duplicates should never occur under normal operation.
func (s *Store) SaveMessage(msg Message) error {
	_, err := s.db.Exec(
		`INSERT INTO messages (id, connection_id, direction, content, timestamp)
		 VALUES (?, ?, ?, ?, ?)`,
		msg.ID, msg.ConnectionID, msg.Direction, msg.Content, msg.Timestamp,
	)
	return err
}

// GetMessages returns up to 1000 messages for the given connection ID,
// ordered oldest-first. The 1000-row cap prevents unbounded memory growth
// when a connection has been open for a long time.
func (s *Store) GetMessages(connectionID string) ([]Message, error) {
	rows, err := s.db.Query(
		`SELECT id, connection_id, direction, content, timestamp
		 FROM messages
		 WHERE connection_id = ?
		 ORDER BY timestamp ASC
		 LIMIT 1000`,
		connectionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.ConnectionID, &m.Direction, &m.Content, &m.Timestamp); err != nil {
			return nil, fmt.Errorf("scan message row: %w", err)
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate message rows: %w", err)
	}
	return out, nil
}

// ClearMessages deletes all messages for the given connection ID.
func (s *Store) ClearMessages(connectionID string) error {
	_, err := s.db.Exec(`DELETE FROM messages WHERE connection_id = ?`, connectionID)
	return err
}

// Close closes the underlying database connection.
func (s *Store) Close() {
	s.db.Close()
}
