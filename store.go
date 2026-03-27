package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// Session is a saved WebSocket endpoint (a named URL bookmark).
type Session struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"createdAt"`
}

// Template is a saved message payload that can be loaded into the input area.
type Template struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

// Store manages all persistent data using an embedded SQLite database.
// The database file is stored in the OS user config directory under "patchbay/".
type Store struct {
	db *sql.DB
}

// NewStore opens (or creates) the SQLite database and runs schema migrations.
// Panics if the database cannot be opened — this is intentional since the
// application cannot function without a working store.
func NewStore() *Store {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	dir = filepath.Join(dir, "patchbay")
	os.MkdirAll(dir, 0755)

	db, err := openDB(filepath.Join(dir, "data.db"))
	if err != nil {
		panic(err)
	}

	s := &Store{db: db}
	s.migrate()
	return s
}

// openDB opens a SQLite database at the given path, creating it if necessary.
// Extracted so tests can open a database at an arbitrary path.
func openDB(path string) (*sql.DB, error) {
	return sql.Open("sqlite", path)
}

// migrate creates the schema if it does not already exist.
// All statements use CREATE IF NOT EXISTS so this is safe to call on every startup.
func (s *Store) migrate() {
	s.db.Exec(`CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		url TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	s.db.Exec(`CREATE TABLE IF NOT EXISTS templates (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	s.db.Exec(`CREATE TABLE IF NOT EXISTS messages (
		id TEXT PRIMARY KEY,
		connection_id TEXT NOT NULL,
		direction TEXT NOT NULL,
		content TEXT NOT NULL,
		timestamp DATETIME NOT NULL
	)`)
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_messages_conn ON messages(connection_id, timestamp)`)
}

// SaveSession inserts or replaces a session. A UUID is assigned if ID is empty.
func (s *Store) SaveSession(sess Session) error {
	if sess.ID == "" {
		sess.ID = uuid.NewString()
	}
	_, err := s.db.Exec(`INSERT OR REPLACE INTO sessions (id, name, url) VALUES (?, ?, ?)`,
		sess.ID, sess.Name, sess.URL)
	return err
}

// GetSessions returns all sessions ordered by creation time descending.
func (s *Store) GetSessions() ([]Session, error) {
	rows, err := s.db.Query(`SELECT id, name, url, created_at FROM sessions ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Session
	for rows.Next() {
		var s Session
		rows.Scan(&s.ID, &s.Name, &s.URL, &s.CreatedAt)
		out = append(out, s)
	}
	return out, nil
}

// DeleteSession removes the session with the given ID.
func (s *Store) DeleteSession(id string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE id = ?`, id)
	return err
}

// SaveTemplate inserts or replaces a template. A UUID is assigned if ID is empty.
func (s *Store) SaveTemplate(t Template) error {
	if t.ID == "" {
		t.ID = uuid.NewString()
	}
	_, err := s.db.Exec(`INSERT OR REPLACE INTO templates (id, name, content) VALUES (?, ?, ?)`,
		t.ID, t.Name, t.Content)
	return err
}

// GetTemplates returns all templates ordered by creation time descending.
func (s *Store) GetTemplates() ([]Template, error) {
	rows, err := s.db.Query(`SELECT id, name, content, created_at FROM templates ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Template
	for rows.Next() {
		var t Template
		rows.Scan(&t.ID, &t.Name, &t.Content, &t.CreatedAt)
		out = append(out, t)
	}
	return out, nil
}

// DeleteTemplate removes the template with the given ID.
func (s *Store) DeleteTemplate(id string) error {
	_, err := s.db.Exec(`DELETE FROM templates WHERE id = ?`, id)
	return err
}

// SaveMessage persists a sent or received message to history.
func (s *Store) SaveMessage(msg Message) error {
	_, err := s.db.Exec(
		`INSERT INTO messages (id, connection_id, direction, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
		msg.ID, msg.ConnectionID, msg.Direction, msg.Content, msg.Timestamp,
	)
	return err
}

// GetMessages returns up to 1000 messages for the given connection ID,
// ordered oldest-first.
func (s *Store) GetMessages(connectionID string) ([]Message, error) {
	rows, err := s.db.Query(
		`SELECT id, connection_id, direction, content, timestamp FROM messages WHERE connection_id = ? ORDER BY timestamp ASC LIMIT 1000`,
		connectionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		rows.Scan(&m.ID, &m.ConnectionID, &m.Direction, &m.Content, &m.Timestamp)
		out = append(out, m)
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
