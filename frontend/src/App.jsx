import { useState, useCallback } from 'react'
import ConnectionTab from './components/ConnectionTab'
import Sidebar from './components/Sidebar'

let tabCounter = 1

function newTab(url = '') {
  return { id: crypto.randomUUID(), label: url || `Connection ${tabCounter++}`, url }
}

export default function App() {
  const [tabs, setTabs] = useState([newTab()])
  const [activeId, setActiveId] = useState(() => tabs[0].id)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const addTab = (url = '') => {
    const tab = newTab(url)
    setTabs(prev => [...prev, tab])
    setActiveId(tab.id)
  }

  const closeTab = useCallback((id) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (next.length === 0) {
        const fresh = newTab()
        setActiveId(fresh.id)
        return [fresh]
      }
      if (activeId === id) setActiveId(next[next.length - 1].id)
      return next
    })
  }, [activeId])

  const renameTab = useCallback((id, label) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, label } : t))
  }, [])

  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const refreshSidebar = () => setSidebarRefreshKey(k => k + 1)

  const [templateInject, setTemplateInject] = useState(null)
  const injectTemplate = (content) => setTemplateInject({ content, key: Date.now() })

  const loadSession = (url) => addTab(url)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {sidebarOpen && (
        <Sidebar
          onLoadSession={loadSession}
          onLoadTemplate={injectTemplate}
          onClose={() => setSidebarOpen(false)}
          refreshKey={sidebarRefreshKey}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: '#1e1e1e', borderBottom: '1px solid var(--border)',
          padding: '4px 8px', flexShrink: 0,
        }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{ marginRight: 4, padding: '4px 8px' }} title="Open sidebar">
              ☰
            </button>
          )}
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius)',
                background: tab.id === activeId ? 'var(--surface2)' : 'transparent',
                border: '1px solid ' + (tab.id === activeId ? 'var(--border)' : 'transparent'),
                cursor: 'pointer', userSelect: 'none',
                maxWidth: 180, color: tab.id === activeId ? 'var(--text)' : 'var(--muted)',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                {tab.label}
              </span>
              {tabs.length > 1 && (
                <span
                  onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                  style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1, flexShrink: 0 }}
                >×</span>
              )}
            </div>
          ))}
          <button onClick={() => addTab()} style={{ padding: '4px 10px', flexShrink: 0 }} title="New tab">+</button>
        </div>

        {/* Tab content */}
        {tabs.map(tab => (
          <div key={tab.id} style={{ display: tab.id === activeId ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
            <ConnectionTab
              tab={tab}
              onRename={(label) => renameTab(tab.id, label)}
              onDataSaved={refreshSidebar}
              templateInject={tab.id === activeId ? templateInject : null}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
