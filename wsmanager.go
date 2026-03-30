package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// Direction values for Message.Direction.
const (
	dirSent     = "sent"
	dirReceived = "received"
)

// Message represents a single WebSocket frame, either sent or received.
// It is the primary data type exchanged between the backend and frontend.
type Message struct {
	ID           string    `json:"id"`
	ConnectionID string    `json:"connectionId"`
	Direction    string    `json:"direction"` // dirSent | dirReceived
	Content      string    `json:"content"`
	Timestamp    time.Time `json:"timestamp"`
}

// conn holds the runtime state of a single active WebSocket connection.
type conn struct {
	ws      *websocket.Conn
	cancel  context.CancelFunc
	send    chan string // outbound text frames; buffered to avoid blocking callers
	closing bool       // set to true before an intentional close to suppress onClose
}

// WSManager manages multiple concurrent WebSocket connections keyed by a
// caller-supplied ID. All methods are safe for concurrent use.
type WSManager struct {
	appCtx      context.Context
	connections map[string]*conn
	mu          sync.RWMutex
}

// NewWSManager creates a WSManager whose connections are bound to appCtx.
// When appCtx is cancelled, all active connections are torn down.
func NewWSManager(appCtx context.Context) *WSManager {
	return &WSManager{
		appCtx:      appCtx,
		connections: make(map[string]*conn),
	}
}

// Connect dials url and registers the connection under id.
//
// onMessage is called from a dedicated goroutine for every received frame.
// onClose is called once when the connection drops unexpectedly; it is NOT
// called for deliberate closes initiated via Disconnect or CloseAll.
//
// Returns an error if the dial fails or if id is already in use.
func (m *WSManager) Connect(id, url string, onMessage func(Message), onClose func()) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.connections[id]; exists {
		return fmt.Errorf("connection %q already exists", id)
	}

	ws, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithCancel(m.appCtx)
	c := &conn{
		ws:     ws,
		cancel: cancel,
		// Buffer 64 frames so callers do not block on a slow network path.
		send: make(chan string, 64),
	}
	m.connections[id] = c

	// Writer goroutine — drains the send channel and writes text frames.
	// Exits when the context is cancelled or a write fails.
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

	// Reader goroutine — reads frames and dispatches them to onMessage.
	// When the loop exits (error or remote close) it cleans up the connection
	// and — unless this was a deliberate close — notifies the caller via onClose.
	go func() {
		defer func() {
			m.mu.Lock()
			deliberate := c.closing
			// Remove from the map so Send/Disconnect no longer see it.
			// This is a no-op when Disconnect beat us to it.
			delete(m.connections, id)
			m.mu.Unlock()

			cancel()

			if !deliberate {
				onClose()
			}
		}()

		for {
			// NOTE: we currently handle only text frames. Binary frames are
			// decoded to string as-is; the message type is intentionally ignored.
			_, data, err := ws.ReadMessage()
			if err != nil {
				return
			}
			onMessage(Message{
				ID:           uuid.NewString(),
				ConnectionID: id,
				Direction:    dirReceived,
				Content:      string(data),
				Timestamp:    time.Now(),
			})
		}
	}()

	return nil
}

// Send queues content for delivery on the connection identified by id.
// Returns the Message record (for history and event emission) or an error if
// the connection does not exist or the outbound buffer is full.
func (m *WSManager) Send(id, content string) (Message, error) {
	m.mu.RLock()
	c, ok := m.connections[id]
	m.mu.RUnlock()
	if !ok {
		return Message{}, fmt.Errorf("no active connection for %q", id)
	}

	msg := Message{
		ID:           uuid.NewString(),
		ConnectionID: id,
		Direction:    dirSent,
		Content:      content,
		Timestamp:    time.Now(),
	}
	select {
	case c.send <- content:
		return msg, nil
	default:
		return Message{}, fmt.Errorf("send buffer full for %q", id)
	}
}

// Disconnect closes the connection identified by id and removes it from the
// manager. The associated onClose callback is suppressed so the frontend
// does not display a spurious "connection closed by server" error.
// It is a no-op if id is not found.
func (m *WSManager) Disconnect(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	c, ok := m.connections[id]
	if !ok {
		return nil
	}

	// Mark as deliberate before closing so the reader goroutine's defer does
	// not invoke onClose when it unblocks from ReadMessage.
	c.closing = true
	c.cancel()
	c.ws.Close()
	delete(m.connections, id)
	return nil
}

// CloseAll closes every active connection. Called on application shutdown.
// All closes are treated as deliberate; onClose callbacks are not invoked.
func (m *WSManager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, c := range m.connections {
		c.closing = true
		c.cancel()
		c.ws.Close()
		delete(m.connections, id)
	}
}
