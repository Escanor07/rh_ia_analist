import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { fetchPipelineStatus, startIngest as apiIngest, startSyncVacancies as apiSync } from '../lib/api'

const Ctx = createContext(null)
export const usePipeline = () => useContext(Ctx)

export function PipelineProvider({ children }) {
  const [status, setStatus] = useState(null)
  const [polling, setPolling] = useState(false)
  const onFinishRef = useRef(null)
  const clearTimerRef = useRef(null)

  // On mount — resume polling if backend is already running
  useEffect(() => {
    fetchPipelineStatus().then(s => {
      if (s.running) {
        setStatus(s)
        setPolling(true)
      }
    }).catch(() => {})
  }, [])

  // Poll every 3s while running
  useEffect(() => {
    if (!polling) return
    const id = setInterval(() => {
      fetchPipelineStatus().then(s => {
        setStatus(s)
        if (!s.running) {
          setPolling(false)
          if (onFinishRef.current) {
            onFinishRef.current()
            onFinishRef.current = null
          }
          clearTimerRef.current = setTimeout(() => setStatus(null), 3000)
        }
      }).catch(() => {})
    }, 3000)
    return () => clearInterval(id)
  }, [polling])

  // Cleanup timer on unmount
  useEffect(() => () => { if (clearTimerRef.current) clearTimeout(clearTimerRef.current) }, [])

  const startIngest = useCallback(async (onFinish) => {
    if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null }
    await apiIngest()
    onFinishRef.current = onFinish || null
    setStatus({ running: true, task: 'ingest', processed: 0, total: 0, skipped: 0, failed: 0 })
    setPolling(true)
  }, [])

  const startSync = useCallback(async (onFinish) => {
    if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null }
    await apiSync()
    onFinishRef.current = onFinish || null
    setStatus({ running: true, task: 'sync_vacancies', processed: 0, total: 0, skipped: 0, failed: 0 })
    setPolling(true)
  }, [])

  const done     = (status?.processed || 0) + (status?.failed || 0)
  const progress = status?.total > 0
    ? Math.round(done / status.total * 100)
    : (status?.running ? -1 : 0)

  return (
    <Ctx.Provider value={{ status, progress, startIngest, startSync }}>
      {children}
    </Ctx.Provider>
  )
}
