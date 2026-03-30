import { useState, useEffect } from 'react'
import { GetSessions, DeleteSession, GetTemplates, DeleteTemplate } from '../../wailsjs/go/main/App'
import { tryPrettyJson } from '../utils'

/**
 * Persistent sidebar showing saved sessions and message templates.
 *
 * Sessions are URL bookmarks that open a new connection tab when clicked.
 * Templates are saved payloads that are injected into the active tab's
 * compose area when clicked.
 *
 * @param {function} props.onLoadSession  - Called with a URL string when a session is clicked
 * @param {function} props.onLoadTemplate - Called with a content string when a template is clicked
 * @param {function} props.onClose        - Called when the collapse button is pressed
 * @param {number}   props.refreshKey     - Incrementing this triggers a data reload
 */
export default function Sidebar({ onLoadSession, onLoadTemplate, onClose, refreshKey }) {
  const [sessions, setSessions]   = useState([])
  const [templates, setTemplates] = useState([])
  const [activeTab, setActiveTab] = useState('sessions')

  const reload = () => {
    GetSessions().then(r  => setSessions(r  || [])).catch(() => {})
    GetTemplates().then(r => setTemplates(r || [])).catch(() => {})
  }

  // Reload whenever the parent signals that new data has been saved.
  useEffect(() => { reload() }, [refreshKey])

  const handleDeleteSession = async (id, e) => {
    e.stopPropagation() // prevent the row click from firing
    await DeleteSession(id)
    reload()
  }

  const handleDeleteTemplate = async (id, e) => {
    e.stopPropagation()
    await DeleteTemplate(id)
    reload()
  }

  // ── Shared row hover style applied via JS because we have no CSS modules ──

  const hoverHandlers = {
    onMouseEnter: e => { e.currentTarget.style.background = 'var(--surface2)' },
    onMouseLeave: e => { e.currentTarget.style.background = 'transparent' },
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      width: 220, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)',
      background: 'var(--surface)',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.05em' }}>
          PATCHBAY
        </span>
        <button
          onClick={onClose}
          title="Collapse sidebar"
          style={{ padding: '2px 6px', fontSize: 14, border: 'none', background: 'transparent', color: 'var(--muted)' }}
        >
          ‹
        </button>
      </div>

      {/* Tab switcher — Sessions | Templates */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {['sessions', 'templates'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              flex: 1, border: 'none', borderRadius: 0,
              background: activeTab === t ? 'var(--surface2)' : 'transparent',
              color: activeTab === t ? 'var(--text)' : 'var(--muted)',
              borderBottom: `2px solid ${activeTab === t ? 'var(--sent)' : 'transparent'}`,
              padding: '7px 0', fontSize: 12,
              fontWeight: activeTab === t ? 600 : 400,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* List content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>

        {activeTab === 'sessions' && (
          sessions.length === 0
            ? <p style={{ color: 'var(--muted)', padding: '12px', fontSize: 12, textAlign: 'center' }}>
                No saved sessions
              </p>
            : sessions.map(s => (
              <div
                key={s.id}
                onClick={() => onLoadSession(s.url)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 12px', cursor: 'pointer', gap: 6,
                }}
                {...hoverHandlers}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: 500, fontSize: 12,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.name}
                  </div>
                  <div style={{
                    color: 'var(--muted)', fontSize: 11,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.url}
                  </div>
                </div>
                <button
                  onClick={e => handleDeleteSession(s.id, e)}
                  title="Delete session"
                  style={{ flexShrink: 0, padding: '2px 6px', border: 'none', background: 'transparent', color: 'var(--muted)', fontSize: 14 }}
                >
                  ×
                </button>
              </div>
            ))
        )}

        {activeTab === 'templates' && (
          templates.length === 0
            ? <p style={{ color: 'var(--muted)', padding: '12px', fontSize: 12, textAlign: 'center' }}>
                No saved templates
              </p>
            : templates.map(t => (
              <div
                key={t.id}
                onClick={() => onLoadTemplate(t.content)}
                style={{
                  padding: '8px 12px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                {...hoverHandlers}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>
                    {t.name}
                  </span>
                  <button
                    onClick={e => handleDeleteTemplate(t.id, e)}
                    title="Delete template"
                    style={{ padding: '2px 6px', border: 'none', background: 'transparent', color: 'var(--muted)', fontSize: 14, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>

                {/* Truncated preview of the template payload */}
                <pre style={{
                  fontSize: 11, color: '#9ac',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  maxHeight: 80, overflow: 'hidden',
                  fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                  background: '#1a1f2a', border: '1px solid #2a3a4a',
                  borderRadius: 4, padding: '5px 7px', margin: 0,
                  maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                }}>
                  {tryPrettyJson(t.content)}
                </pre>

                <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                  click to use
                </span>
              </div>
            ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={reload} style={{ width: '100%', fontSize: 11, padding: '5px' }}>
          ↻ Refresh
        </button>
      </div>

    </div>
  )
}
