import { useState, useEffect, useRef, useCallback } from 'react'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import { Connect, Disconnect, SendMessage, GetHistory, ClearHistory, SaveSession, SaveTemplate } from '../../wailsjs/go/main/App'
import MessageList from './MessageList'

export default function ConnectionTab({ tab, onRename, onDataSaved, templateInject }) {
  const [url, setUrl] = useState(tab.url || '')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [saveSessionName, setSaveSessionName] = useState('')
  const [savingSession, setSavingSession] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (templateInject) setInput(templateInject.content)
  }, [templateInject])

  // Load history on mount
  useEffect(() => {
    GetHistory(tab.id).then(hist => {
      if (hist && hist.length > 0) setMessages(hist)
    }).catch(() => {})
  }, [tab.id])

  // Subscribe to events for this connection
  useEffect(() => {
    const msgKey = 'message:' + tab.id
    const closeKey = 'connection:closed:' + tab.id

    EventsOn(msgKey, (msg) => {
      setMessages(prev => [...prev, msg])
    })
    EventsOn(closeKey, () => {
      setConnected(false)
      setError('Connection closed by server')
    })

    return () => {
      EventsOff(msgKey)
      EventsOff(closeKey)
    }
  }, [tab.id])

  const handleConnect = async () => {
    if (!url.trim()) return
    setConnecting(true)
    setError('')
    try {
      await Connect(tab.id, url.trim())
      setConnected(true)
      onRename(url.trim().replace(/^wss?:\/\//, ''))
    } catch (e) {
      setError(String(e))
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    await Disconnect(tab.id)
    setConnected(false)
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || !connected) return
    try {
      await SendMessage(tab.id, input.trim())
      setInput('')
      inputRef.current?.focus()
    } catch (e) {
      setError(String(e))
    }
  }, [input, connected, tab.id])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = async () => {
    await ClearHistory(tab.id)
    setMessages([])
  }

  const handleSaveSession = async () => {
    if (!saveSessionName.trim()) return
    try {
      await SaveSession(saveSessionName.trim(), url.trim())
      setSaveSessionName('')
      setSavingSession(false)
      onDataSaved()
    } catch (e) {
      setError(String(e))
    }
  }

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim() || !input.trim()) return
    try {
      await SaveTemplate(saveTemplateName.trim(), input.trim())
      setSaveTemplateName('')
      setSavingTemplate(false)
      onDataSaved()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* URL bar */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '8px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <span style={{
          padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
          background: connected ? '#1a3a1a' : '#3a1a1a',
          color: connected ? 'var(--received)' : 'var(--danger)',
          border: '1px solid ' + (connected ? '#2a5a2a' : '#5a2a2a'),
          flexShrink: 0,
        }}>
          {connected ? 'OPEN' : 'CLOSED'}
        </span>

        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !connected && handleConnect()}
          placeholder="ws://localhost:8080 or wss://..."
          style={{ flex: 1 }}
          disabled={connected}
        />

        {!connected ? (
          <button className="primary" onClick={handleConnect} disabled={connecting || !url.trim()}>
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        ) : (
          <button className="danger" onClick={handleDisconnect}>Disconnect</button>
        )}

        {!savingSession ? (
          <button onClick={() => setSavingSession(true)} disabled={!url.trim()} title="Save this URL as a session">
            Save
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={saveSessionName}
              onChange={e => setSaveSessionName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveSession()}
              placeholder="Session name"
              style={{ width: 130 }}
              autoFocus
            />
            <button className="primary" onClick={handleSaveSession}>OK</button>
            <button onClick={() => setSavingSession(false)}>✕</button>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '6px 12px', background: '#2a1a1a', color: '#f88',
          borderBottom: '1px solid #5a2a2a', fontSize: 12, flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* Message stream */}
      <MessageList messages={messages} />

      {/* Message count / clear */}
      {messages.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          padding: '2px 12px', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', gap: 8, flexShrink: 0,
        }}>
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>{messages.length} messages</span>
          <button onClick={handleClear} style={{ padding: '2px 8px', fontSize: 11 }}>Clear</button>
        </div>
      )}

      {/* Input area */}
      <div style={{
        borderTop: '1px solid var(--border)', background: 'var(--surface)',
        padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Message payload — Ctrl+Enter to send'
          rows={4}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {savingTemplate ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                value={saveTemplateName}
                onChange={e => setSaveTemplateName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                placeholder="Template name"
                style={{ width: 140 }}
                autoFocus
              />
              <button className="primary" onClick={handleSaveTemplate}>Save</button>
              <button onClick={() => setSavingTemplate(false)}>✕</button>
            </div>
          ) : (
            <button onClick={() => setSavingTemplate(true)} disabled={!input.trim()} title="Save as template">
              Save as template
            </button>
          )}
          <button
            className="primary"
            onClick={handleSend}
            disabled={!connected || !input.trim()}
            title="Ctrl+Enter"
          >
            Send ▶
          </button>
        </div>
      </div>
    </div>
  )
}
