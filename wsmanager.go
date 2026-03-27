package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// Message represents a single WebSocket frame, either sent or received.
type Message struct {
	ID           string    `json:"id"`
	ConnectionID string    `json:"connectionId"`
	Direction    string    `json:"direction"` // "sent" | "received"
	Content      string    `json:"content"`
	Timestamp    time.Time `json:"timestamp"`
}

// conn holds the runtime state of a single WebSocket connection.
type conn struct {
	ws     *websocket.Conn
	cancel context.CancelFunc
	send   chan string
}

// WSManager manages multiple concurrent WebSocket connections keyed by an
// application-supplied ID. It is safe for concurrent use.
type WSManager struct {
	appCtx      context.Context
	connections map[string]*conn
	mu          sync.RWMutex
}

// NewWSManager creates a WSManager whose connections are bound to appCtx.
// When appCtx is cancelled all active connections are torn down.
func NewWSManager(appCtx context.Context) *WSManager {
	return &WSManager{
		appCtx:      appCtx,
		connections: make(map[string]*conn),
	}
}

// Connect dials url and registers the connection under id.
// onMessage is called from a dedicated goroutine for every received frame.
// onClose is called once when the connection is lost (error or remote close).
// Returns an error if the dial fails or id is already in use.
func (m *WSManager) Connect(id, url string, onMessage func(Message), onClose func()) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.connections[id]; exists {
		return fmt.Errorf("already connected")
	}

	ws, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithCancel(m.appCtx)
	c := &conn{
		ws:     ws,
		cancel: cancel,
		send:   make(chan string, 64),
	}
	m.connections[id] = c

	// writer goroutine — drains the send channel and writes frames.
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-c.send:
				if err := ws.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
					return
				}
			}
		}
	}()

	// reader goroutine — reads frames and dispatches to onMessage.
	go func() {
		defer func() {
			m.mu.Lock()
			delete(m.connections, id)
			m.mu.Unlock()
			cancel()
			onClose()
		}()
		for {
			_, data, err := ws.ReadMessage()
			if err != nil {
				return
			}
			onMessage(Message{
				ID:           uuid.NewString(),
				ConnectionID: id,
				Direction:    "received",
				Content:      string(data),
				Timestamp:    time.Now(),
			})
		}
	}()

	return nil
}

// Send queues content for delivery on the connection identified by id.
// Returns the Message record (for history/event emission) or an error if the
// connection does not exist or the send buffer is full.
func (m *WSManager) Send(id, content string) (Message, error) {
	m.mu.RLock()
	c, ok := m.connections[id]
	m.mu.RUnlock()
	if !ok {
		return Message{}, fmt.Errorf("not connected")
	}

	msg := Message{
		ID:           uuid.NewString(),
		ConnectionID: id,
		Direction:    "sent",
		Content:      content,
		Timestamp:    time.Now(),
	}
	select {
	case c.send <- content:
		return msg, nil
	default:
		return Message{}, fmt.Errorf("send buffer full")
	}
}

// Disconnect closes the connection identified by id and removes it from the
// manager. It is a no-op if id is not found.
func (m *WSManager) Disconnect(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.connections[id]
	if !ok {
		return nil
	}
	c.cancel()
	c.ws.Close()
	delete(m.connections, id)
	return nil
}

// CloseAll closes every active connection. Called on application shutdown.
func (m *WSManager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, c := range m.connections {
		c.cancel()
		c.ws.Close()
		delete(m.connections, id)
	}
}
