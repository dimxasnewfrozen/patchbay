import { useState, useEffect } from 'react'
import { GetSessions, DeleteSession, GetTemplates, DeleteTemplate } from '../../wailsjs/go/main/App'

function tryPretty(str) {
  try { return JSON.stringify(JSON.parse(str), null, 2) } catch { return str }
}

export default function Sidebar({ onLoadSession, onLoadTemplate, onClose, refreshKey }) {
  const [sessions, setSessions] = useState([])
  const [templates, setTemplates] = useState([])
  const [tab, setTab] = useState('sessions')

  const reload = () => {
    GetSessions().then(r => setSessions(r || [])).catch(() => {})
    GetTemplates().then(r => setTemplates(r || [])).catch(() => {})
  }

  useEffect(() => { reload() }, [refreshKey])

  const deleteSession = async (id, e) => {
    e.stopPropagation()
    await DeleteSession(id)
    reload()
  }

  const deleteTemplate = async (id, e) => {
    e.stopPropagation()
    await DeleteTemplate(id)
    reload()
  }

  return (
    <div style={{
      width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.05em' }}>
          PATCHBAY
        </span>
        <button onClick={onClose} style={{ padding: '2px 6px', fontSize: 14, border: 'none', background: 'transparent', color: 'var(--muted)' }}>
          ‹
        </button>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {['sessions', 'templates'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, border: 'none', borderRadius: 0, background: tab === t ? 'var(--surface2)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--muted)',
              borderBottom: '2px solid ' + (tab === t ? 'var(--sent)' : 'transparent'),
              padding: '7px 0', fontSize: 12, fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {tab === 'sessions' && (
          sessions.length === 0
            ? <p style={{ color: 'var(--muted)', padding: '12px', fontSize: 12, textAlign: 'center' }}>No saved sessions</p>
            : sessions.map(s => (
              <div
                key={s.id}
                onClick={() => onLoadSession(s.url)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 12px', cursor: 'pointer', gap: 6,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.url}
                  </div>
                </div>
                <button
                  onClick={(e) => deleteSession(s.id, e)}
                  style={{ flexShrink: 0, padding: '2px 6px', border: 'none', background: 'transparent', color: 'var(--muted)', fontSize: 14 }}
                >
                  ×
                </button>
              </div>
            ))
        )}

        {tab === 'templates' && (
          templates.length === 0
            ? <p style={{ color: 'var(--muted)', padding: '12px', fontSize: 12, textAlign: 'center' }}>No saved templates</p>
            : templates.map(t => (
              <div
                key={t.id}
                onClick={() => onLoadTemplate(t.content)}
                style={{
                  padding: '8px 12px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{t.name}</span>
                  <button
                    onClick={(e) => deleteTemplate(t.id, e)}
                    style={{ padding: '2px 6px', border: 'none', background: 'transparent', color: 'var(--muted)', fontSize: 14, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
                <pre style={{
                  fontSize: 11,
                  color: '#9ac',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: 80,
                  overflow: 'hidden',
                  fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                  background: '#1a1f2a',
                  border: '1px solid #2a3a4a',
                  borderRadius: 4,
                  padding: '5px 7px',
                  margin: 0,
                  maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                }}>
                  {tryPretty(t.content)}
                </pre>
                <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                  click to use
                </span>
              </div>
            ))
        )}
      </div>

      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={reload} style={{ width: '100%', fontSize: 11, padding: '5px' }}>↻ Refresh</button>
      </div>
    </div>
  )
}
