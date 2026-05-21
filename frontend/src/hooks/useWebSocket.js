import { useEffect, useRef, useCallback, useState } from 'react'

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}://${host}/ws/rondines/`)
    wsRef.current = ws

    ws.onopen = () => {
      clearTimeout(reconnectTimer.current)
      setConnected(true)
    }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        onMessageRef.current?.(data)
      } catch {
        // malformed message
      }
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    connect()
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    return () => {
      clearTimeout(reconnectTimer.current)
      clearInterval(pingInterval)
      wsRef.current?.close()
    }
  }, [connect])

  return connected
}
