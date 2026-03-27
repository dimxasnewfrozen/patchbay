package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// newTestStore creates a Store backed by a temporary database file.
// The caller is responsible for calling s.Close() and cleaning up the dir.
func newTestStore(t *testing.T) (*Store, func()) {
	t.Helper()
	dir := t.TempDir()
	db, err := openDB(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("openDB: %v", err)
	}
	s := &Store{db: db}
	s.migrate()
	return s, func() { s.Close() }
}

func TestSaveAndGetSession(t *testing.T) {
	s, cleanup := newTestStore(t)
	defer cleanup()

	if err := s.SaveSession(Session{Name: "Local", URL: "ws://localhost:8080"}); err != nil {
		t.Fatalf("SaveSession: %v", err)
	}

	sessions, err := s.GetSessions()
	if err != nil {
		t.Fatalf("GetSessions: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	if sessions[0].Name != "Local" || sessions[0].URL != "ws://localhost:8080" {
		t.Errorf("unexpected session: %+v", sessions[0])
	}
	if sessions[0].ID == "" {
		t.Error("expected non-empty ID")
	}
}

func TestDeleteSession(t *testing.T) {
	s, cleanup := newTestStore(t)
	defer cleanup()

	s.SaveSession(Session{Name: "A", URL: "ws://a"})
	sessions, _ := s.GetSessions()
	if err := s.DeleteSession(sessions[0].ID); err != nil {
		t.Fatalf("DeleteSession: %v", err)
	}

	sessions, _ = s.GetSessions()
	if len(sessions) != 0 {
		t.Errorf("expected 0 sessions after delete, got %d", len(sessions))
	}
}

func TestSaveAndGetTemplate(t *testing.T) {
	s, cleanup := newTestStore(t)
	defer cleanup()

	content := `{"type":"auth","data":{"token":"abc"}}`
	if err := s.SaveTemplate(Template{Name: "Auth", Content: content}); err != nil {
		t.Fatalf("SaveTemplate: %v", err)
	}

	templates, err := s.GetTemplates()
	if err != nil {
		t.Fatalf("GetTemplates: %v", err)
	}
	if len(templates) != 1 {
		t.Fatalf("expected 1 template, got %d", len(templates))
	}
	if templates[0].Name != "Auth" || templates[0].Content != content {
		t.Errorf("unexpected template: %+v", templates[0])
	}
}

func TestDeleteTemplate(t *testing.T) {
	s, cleanup := newTestStore(t)
	defer cleanup()

	s.SaveTemplate(Template{Name: "T", Content: "{}"})
	templates, _ := s.GetTemplates()
	if err := s.DeleteTemplate(templates[0].ID); err != nil {
		t.Fatalf("DeleteTemplate: %v", err)
	}

	templates, _ = s.GetTemplates()
	if len(templates) != 0 {
		t.Errorf("expected 0 templates after delete, got %d", len(templates))
	}
}

func TestSaveAndGetMessages(t *testing.T) {
	s, cleanup := newTestStore(t)
	defer cleanup()

	connID := "conn-123"
	msgs := []Message{
		{ID: "m1", ConnectionID: connID, Direction: "sent", Content: `{"type":"ping"}`, Timestamp: time.Now()},
		{ID: "m2", ConnectionID: connID, Direction: "received", Content: `{"type":"pong"}`, Timestamp: time.Now()},
	}
	for _, m := range msgs {
		if err := s.SaveMessage(m); err != nil {
			t.Fatalf("SaveMessage: %v", err)
		}
	}

	got, err := s.GetMessages(connID)
	if err != nil {
		t.Fatalf("GetMessages: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(got))
	}
	if got[0].Direction != "sent" || got[1].Direction != "received" {
		t.Errorf("unexpected message order or direction")
	}
}

func TestGetMessagesIsolatedByConnectionID(t *testing.T) {
	s, cleanup := newTestStore(t)
	defer cleanup()

	s.SaveMessage(Message{ID: "a", ConnectionID: "conn-A", Direction: "sent", Content: "{}", Timestamp: time.Now()})
	s.SaveMessage(Message{ID: "b", ConnectionID: "conn-B", Direction: "sent", Content: "{}", Timestamp: time.Now()})

	got, _ := s.GetMessages("conn-A")
	if len(got) != 1 || got[0].ID != "a" {
		t.Errorf("expected only conn-A messages, got %+v", got)
	}
}

func TestClearMessages(t *testing.T) {
	s, cleanup := newTestStore(t)
	defer cleanup()

	connID := "conn-x"
	s.SaveMessage(Message{ID: "1", ConnectionID: connID, Direction: "sent", Content: "{}", Timestamp: time.Now()})
	s.SaveMessage(Message{ID: "2", ConnectionID: connID, Direction: "received", Content: "{}", Timestamp: time.Now()})

	if err := s.ClearMessages(connID); err != nil {
		t.Fatalf("ClearMessages: %v", err)
	}

	got, _ := s.GetMessages(connID)
	if len(got) != 0 {
		t.Errorf("expected 0 messages after clear, got %d", len(got))
	}
}

// Ensure the test binary can find the data directory even without a real config dir.
func TestMain(m *testing.M) {
	os.Exit(m.Run())
}
