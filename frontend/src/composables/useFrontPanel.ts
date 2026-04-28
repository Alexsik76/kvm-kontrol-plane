import { ref, shallowRef } from 'vue'

type PwrStatus = 'unknown' | 'off' | 'on' | 'blinking'
type HddStatus = 'unknown' | 'idle' | 'active'

export function useFrontPanel() {
  const ws = shallowRef<WebSocket | null>(null)
  const isConnected = ref(false)
  const pwrStatus = ref<PwrStatus>('unknown')
  const hddStatus = ref<HddStatus>('unknown')
  const lastError = ref<string | null>(null)

  const connect = (nodeDomain: string, token: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      let settled = false

      if (ws.value) {
        ws.value.onclose = null
        ws.value.close()
        ws.value = null
      }

      const socket = new WebSocket(`wss://${nodeDomain}/ws/front_panel?token=${token}`)
      ws.value = socket

      socket.onopen = () => {
        settled = true
        isConnected.value = true
        resolve()
      }

      socket.onerror = () => {
        if (!settled) {
          settled = true
          reject(new Error('Front panel WebSocket connection failed'))
        }
      }

      socket.onclose = () => {
        isConnected.value = false
        pwrStatus.value = 'unknown'
        hddStatus.value = 'unknown'
        if (!settled) {
          settled = true
          reject(new Error('Front panel WebSocket closed before connecting'))
        }
      }

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          // Pi broadcasts led_status as {"pwr": ..., "hdd": ...} without a type field
          if (msg.pwr !== undefined || msg.hdd !== undefined) {
            if (msg.pwr !== undefined) pwrStatus.value = msg.pwr
            if (msg.hdd !== undefined) hddStatus.value = msg.hdd
          } else if (msg.type === 'ack') {
            console.debug('Front panel ack:', msg)
          } else if (msg.type === 'error') {
            lastError.value = msg.reason ?? 'Unknown error'
          }
        } catch (err) {
          console.error('Failed to parse front panel WS message:', err)
        }
      }
    })
  }

  const disconnect = (): void => {
    if (ws.value) {
      ws.value.onclose = null
      ws.value.close()
      ws.value = null
    }
    isConnected.value = false
    pwrStatus.value = 'unknown'
    hddStatus.value = 'unknown'
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

  return { isConnected, pwrStatus, hddStatus, lastError, connect, disconnect, powerPress, powerHold, reset, clearError }
}
