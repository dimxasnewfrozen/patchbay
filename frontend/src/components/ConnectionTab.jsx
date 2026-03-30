import { useState, useRef, useEffect, useCallback } from 'react'
import MessageList from './MessageList'
import { useConnectionTab } from '../hooks/useConnectionTab'

/**
 * A single connection tab — the main working area of the app.
 *
 * Renders the URL bar, live message stream, and compose area for one
 * WebSocket connection. All connection and persistence logic lives in
 * the useConnectionTab hook; this component is purely presentational.
 *
 * @param {object}        props.tab            - Tab descriptor ({ id, url, label })
 * @param {function}      props.onRename       - Called with a new label when connected
 * @param {function}      props.onDataSaved    - Called when a session or template is saved
 * @param {{ content, key }|null} props.templateInject - Payload injected from the sidebar
 */
export default function ConnectionTab({ tab, onRename, onDataSaved, templateInject }) {
  const [url, setUrl]                       = useState(tab.url || '')
  const [input, setInput]                   = useState('')
  const [savingSession, setSavingSession]   = useState(false)
  const [saveSessionName, setSaveSessionName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const inputRef = useRef(null)

  const {
    connected,
    connecting,
    messages,
    error,
    connect,
    disconnect,
    send,
    clearHistory,
    saveSession,
    saveTemplate,
  } = useConnectionTab(tab, onRename, onDataSaved)

  // When the sidebar injects a template, populate the compose area.
  useEffect(() => {
    if (templateInject) setInput(templateInject.content)
  }, [templateInject])

  // ── Handlers ──────────────────────────────────────────────

  const handleConnect = async () => {
    if (!url.trim()) return
    await connect(url.trim())
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || !connected) return
    try {
      await send(input.trim())
      setInput('')
      inputRef.current?.focus()
    } catch {
      // Error is already surfaced by the hook via the `error` value.
    }
  }, [input, connected, send])

  // Ctrl+Enter / Cmd+Enter submits the compose area.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSaveSession = async () => {
    if (!saveSessionName.trim()) return
    try {
      await saveSession(saveSessionName.trim(), url.trim())
      setSaveSessionName('')
      setSavingSession(false)
    } catch {
      // Error surfaced by the hook.
    }
  }

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim() || !input.trim()) return
    try {
      await saveTemplate(saveTemplateName.trim(), input.trim())
      setSaveTemplateName('')
      setSavingTemplate(false)
    } catch {
      // Error surfaced by the hook.
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* URL bar — connection controls */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '8px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <span className={`status-badge ${connected ? 'open' : 'closed'}`}>
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
          <button className="danger" onClick={disconnect}>Disconnect</button>
        )}

        {/* Save session — inline name prompt */}
        {!savingSession ? (
          <button
            onClick={() => setSavingSession(true)}
            disabled={!url.trim()}
            title="Save this URL as a session"
          >
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

      {/* Error banner — shown when the last operation failed */}
      {error && <div className="error-banner">{error}</div>}

      {/* Message stream */}
      <MessageList messages={messages} />

      {/* Message count + clear button */}
      {messages.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          padding: '2px 12px', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', gap: 8, flexShrink: 0,
        }}>
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>{messages.length} messages</span>
          <button onClick={clearHistory} style={{ padding: '2px 8px', fontSize: 11 }}>Clear</button>
        </div>
      )}

      {/* Compose area */}
      <div style={{
        borderTop: '1px solid var(--border)', background: 'var(--surface)',
        padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message payload — Ctrl+Enter to send"
          rows={4}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>

          {/* Save template — inline name prompt */}
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
            <button
              onClick={() => setSavingTemplate(true)}
              disabled={!input.trim()}
              title="Save as template"
            >
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
