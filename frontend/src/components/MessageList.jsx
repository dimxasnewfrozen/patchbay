import { useEffect, useRef } from 'react'
import { tryPrettyJson, formatTime } from '../utils'

/**
 * Scrollable list of WebSocket messages for one connection.
 *
 * Each message is displayed as a bubble aligned to the left (received) or
 * right (sent), with a direction label and timestamp in the gutter.
 * Valid JSON payloads are automatically pretty-printed.
 *
 * @param {object[]} props.messages - Array of Message objects from the Go backend
 */
export default function MessageList({ messages }) {
  const bottomRef = useRef(null)

  // Scroll to the latest message whenever a new one arrives.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--muted)', fontSize: 13,
      }}>
        No messages yet
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '8px 12px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      {messages.map(msg => {
        const isSent    = msg.direction === 'sent'
        const content   = tryPrettyJson(msg.content)
        const multiline = content.includes('\n')

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isSent ? 'flex-end' : 'flex-start',
            }}
          >
            {/* Direction label + timestamp */}
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              flexDirection: isSent ? 'row-reverse' : 'row',
              marginBottom: 2,
            }}>
              <span style={{ color: isSent ? 'var(--sent)' : 'var(--received)', fontSize: 11, fontWeight: 600 }}>
                {isSent ? '▲ sent' : '▼ recv'}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                {formatTime(msg.timestamp)}
              </span>
            </div>

            {/* Message bubble */}
            <pre className={[
              'message-bubble',
              isSent ? 'sent' : 'received',
              multiline ? 'expanded' : 'compact',
            ].join(' ')}>
              {content}
            </pre>
          </div>
        )
      })}

      {/* Invisible anchor kept at the bottom for auto-scroll targeting */}
      <div ref={bottomRef} />
    </div>
  )
}
