import { useEffect, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export function useAppUpdate() {
  const [update, setUpdate] = useState(null)

  useEffect(() => {
    axios.get(`${API_BASE}/version/`).then(({ data }) => {
      const instalada = import.meta.env.VITE_APP_VERSION || '0.0.0'
      if (data.version && data.version !== instalada && data.download_url) {
        setUpdate(data)
      }
    }).catch(() => {})
  }, [])

  return update
}
