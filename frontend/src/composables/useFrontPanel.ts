import { ref, shallowRef } from 'vue'

type PwrStatus = 'unknown' | 'off' | 'on' | 'blinking'
type HddStatus = 'unknown' | 'idle' | 'active'
export type VideoStatus = 'unknown' | 'active' | 'inactive'

const BACKOFF_MS = [1000, 2000, 5000]
const MAX_RECONNECT = 10

export function useFrontPanel() {
  const ws = shallowRef<WebSocket | null>(null)
  const isConnected = ref(false)
  const pwrStatus = ref<PwrStatus>('unknown')
  const hddStatus = ref<HddStatus>('unknown')
  const videoStatus = ref<VideoStatus>('unknown')
  const videoActiveSignal = ref(0)  // increments on every video_status:active receipt
  const lastError = ref<string | null>(null)

  let _domain = ''
  let _token = ''
  let _stopped = true
  let _attempt = 0
  let _timer: ReturnType<typeof setTimeout> | null = null

  const _clearTimer = () => {
    if (_timer !== null) { clearTimeout(_timer); _timer = null }
  }

  const _onMessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data)
      // Pi broadcasts led_status as {"pwr": ..., "hdd": ...} without a type field
      if (msg.pwr !== undefined || msg.hdd !== undefined) {
        if (msg.pwr !== undefined) pwrStatus.value = msg.pwr
        if (msg.hdd !== undefined) hddStatus.value = msg.hdd
      } else if (msg.type === 'video_status') {
        if (msg.status === 'active' || msg.status === 'inactive') {
          videoStatus.value = msg.status
          if (msg.status === 'active') videoActiveSignal.value++
        }
      } else if (msg.type === 'ack') {
        console.debug('Front panel ack:', msg)
      } else if (msg.type === 'error') {
        lastError.value = msg.reason ?? 'Unknown error'
      }
    } catch (err) {
      console.error('Failed to parse front panel WS message:', err)
    }
  }

  const _scheduleReconnect = () => {
    if (_stopped) return
    if (_attempt >= MAX_RECONNECT) {
      lastError.value = 'Front panel: reconnect failed after max attempts'
      return
    }
    const delay = BACKOFF_MS[Math.min(_attempt, BACKOFF_MS.length - 1)]
    _attempt++
    _timer = setTimeout(() => {
      _timer = null
      if (!_stopped) _openSocket()
    }, delay)
  }

  const _openSocket = (onSettle?: (ok: boolean) => void) => {
    if (ws.value) {
      ws.value.onclose = null
      ws.value.close()
      ws.value = null
    }

    const socket = new WebSocket(`wss://${_domain}/ws/front_panel?token=${_token}`)
    ws.value = socket

    // Prevent double-settle from onerror+onclose firing in sequence
    let settled = false
    const settle = (ok: boolean) => {
      if (settled) return
      settled = true
      onSettle?.(ok)
    }

    socket.onopen = () => {
      isConnected.value = true
      _attempt = 0
      settle(true)
    }

    socket.onerror = () => settle(false)

    socket.onclose = () => {
      isConnected.value = false
      pwrStatus.value = 'unknown'
      hddStatus.value = 'unknown'
      videoStatus.value = 'unknown'
      settle(false)
      _scheduleReconnect()
    }

    socket.onmessage = _onMessage
  }

  const connect = (nodeDomain: string, token: string): Promise<void> => {
    _stopped = false
    _attempt = 0
    _clearTimer()
    _domain = nodeDomain
    _token = token
    return new Promise((resolve, reject) => {
      _openSocket((ok) => {
        if (ok) resolve()
        else reject(new Error('Front panel WebSocket connection failed'))
      })
    })
  }

  const disconnect = (): void => {
    _stopped = true
    _clearTimer()
    if (ws.value) {
      ws.value.onclose = null
      ws.value.close()
      ws.value = null
    }
    isConnected.value = false
    pwrStatus.value = 'unknown'
    hddStatus.value = 'unknown'
    videoStatus.value = 'unknown'
  }

  const send = (msg: object): void => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(msg))
    }
  }

  const powerPress = (): void => send({ type: 'power_press' })

  const powerHold = (): Promise<void> => {
    send({ type: 'power_hold' })
    return Promise.resolve()
  }

  const reset = (): void => send({ type: 'reset' })

  const clearError = (): void => {
    lastError.value = null
  }

  return { isConnected, pwrStatus, hddStatus, videoStatus, videoActiveSignal, lastError, connect, disconnect, powerPress, powerHold, reset, clearError }
}
