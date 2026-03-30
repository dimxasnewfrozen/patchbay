import { useState, useEffect, useCallback } from 'react'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import {
  Connect,
  Disconnect,
  SendMessage,
  GetHistory,
  ClearHistory,
  SaveSession,
  SaveTemplate,
} from '../../wailsjs/go/main/App'

/**
 * Manages all WebSocket connection state and backend calls for one tab.
 *
 * Separating this logic from the render tree makes ConnectionTab purely
 * presentational and keeps the Wails bindings in one place.
 *
 * @param {object}   tab           - The tab descriptor ({ id, url })
 * @param {function} onRename      - Called with a new label when the URL is known
 * @param {function} onDataSaved   - Called after a session or template is saved
 *
 * @returns {{
 *   connected:    boolean,
 *   connecting:   boolean,
 *   messages:     object[],
 *   error:        string,
 *   connect:      function,
 *   disconnect:   function,
 *   send:         function,
 *   clearHistory: function,
 *   saveSession:  function,
 *   saveTemplate: function,
 * }}
 */
export function useConnectionTab(tab, onRename, onDataSaved) {
  const [connected, setConnected]   = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [messages, setMessages]     = useState([])
  const [error, setError]           = useState('')

  // Restore persisted message history when the tab first mounts.
  useEffect(() => {
    GetHistory(tab.id)
      .then(hist => { if (hist?.length) setMessages(hist) })
      .catch(() => {})
  }, [tab.id])

  // Subscribe to Wails runtime events scoped to this tab's connection ID.
  // The cleanup function unregisters listeners when the tab unmounts.
  useEffect(() => {
    const msgKey   = `message:${tab.id}`
    const closeKey = `connection:closed:${tab.id}`

    EventsOn(msgKey,   msg => setMessages(prev => [...prev, msg]))
    EventsOn(closeKey, ()  => {
      setConnected(false)
      setError('Connection closed by server')
    })

    return () => {
      EventsOff(msgKey)
      EventsOff(closeKey)
    }
  }, [tab.id])

  /** Dial the given URL and register the connection under this tab's ID. */
  const connect = useCallback(async (url) => {
    setConnecting(true)
    setError('')
    try {
      await Connect(tab.id, url)
      setConnected(true)
      // Strip the scheme so the tab label is just the host + path.
      onRename(url.replace(/^wss?:\/\//, ''))
    } catch (e) {
      setError(String(e))
    } finally {
      setConnecting(false)
    }
  }, [tab.id, onRename])

  /** Close the connection and update local state immediately. */
  const disconnect = useCallback(async () => {
    await Disconnect(tab.id)
    setConnected(false)
  }, [tab.id])

  /**
   * Send a text message. Throws on failure so the caller can decide whether
   * to preserve or clear the compose input.
   */
  const send = useCallback(async (content) => {
    try {
      await SendMessage(tab.id, content)
    } catch (e) {
      setError(String(e))
      throw e
    }
  }, [tab.id])

  /** Delete all persisted messages for this connection and clear the view. */
  const clearHistory = useCallback(async () => {
    await ClearHistory(tab.id)
    setMessages([])
  }, [tab.id])

  /** Persist a named URL bookmark and notify the sidebar to reload. */
  const saveSession = useCallback(async (name, url) => {
    try {
      await SaveSession(name, url)
      onDataSaved()
    } catch (e) {
      setError(String(e))
      throw e
    }
  }, [onDataSaved])

  /** Persist a named message template and notify the sidebar to reload. */
  const saveTemplate = useCallback(async (name, content) => {
    try {
      await SaveTemplate(name, content)
      onDataSaved()
    } catch (e) {
      setError(String(e))
      throw e
    }
  }, [onDataSaved])

  return {
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
  }
}
