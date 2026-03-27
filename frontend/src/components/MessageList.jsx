import { useEffect, useRef } from 'react'

function tryPrettyJson(str) {
  try {
    const parsed = JSON.parse(str)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return str
  }
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function MessageList({ messages }) {
  const bottomRef = useRef(null)

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
        const isSent = msg.direction === 'sent'
        const content = tryPrettyJson(msg.content)
        const isMultiline = content.includes('\n')

        return (
          <div key={msg.id} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: isSent ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              flexDirection: isSent ? 'row-reverse' : 'row',
              marginBottom: 2,
            }}>
              <span style={{ color: isSent ? 'var(--sent)' : 'var(--received)', fontSize: 11, fontWeight: 600 }}>
                {isSent ? '▲ sent' : '▼ recv'}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>{formatTime(msg.timestamp)}</span>
            </div>
            <pre style={{
              background: 'var(--surface2)',
              border: '1px solid ' + (isSent ? '#1a3a5a' : '#1a3a1a'),
              borderRadius: 'var(--radius)',
              padding: isMultiline ? '8px 12px' : '5px 10px',
              fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
              fontSize: 12,
              color: isSent ? '#c8e0ff' : '#c8ffc8',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxWidth: '85%',
              margin: 0,
            }}>
              {content}
            </pre>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
