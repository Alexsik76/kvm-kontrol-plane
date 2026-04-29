import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { resetKeyboardState } from '../utils/hid'

export function useHID(nodeDomain: Ref<string>, onReset?: () => void) {
  const authStore = useAuthStore()
  const wsConnection = shallowRef<WebSocket | null>(null)
  const isHidConnected = ref(false)
  const lastPong = shallowRef<{ id: number; receivedAt: number } | null>(null)

  const connectHID = () => {
    if (!nodeDomain.value) return

    // Always clear existing connection properly
    if (wsConnection.value) {
      wsConnection.value.onclose = null
      wsConnection.value.close()
    }

    // Ensure we are using the LATEST token from the store
    const currentToken = authStore.accessToken

    const wsUrl = `wss://${nodeDomain.value}/ws/control?token=${currentToken}`

    wsConnection.value = new WebSocket(wsUrl)

    wsConnection.value.onopen = () => {
      isHidConnected.value = true
      console.log('HID WebSocket connected')
    }

    wsConnection.value.onclose = () => {
      isHidConnected.value = false
      console.log('HID WebSocket closed. No automatic reconnection.')
    }

    wsConnection.value.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pong') {
          lastPong.value = { id: msg.data?.id, receivedAt: performance.now() };
          return;
        }
        if (msg.type === 'reset_hid') {
          console.warn('HID Server requested state reset (NACK)');

          // Clears local sets and generates { type: "keyboard", data: { modifiers: 0, keys: "" } }
          const resetMsg = resetKeyboardState();
          sendHIDMessage(resetMsg);

          if (onReset) onReset();
        }
      } catch (err) {
        console.error('Failed to parse HID WS message:', err);
      }
    };
  }

  const sendHIDMessage = (msg: any) => {
    const ws = wsConnection.value;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Backpressure: при перевантаженому сокеті дропаємо ТІЛЬКИ pure mouse moves
    // (без натиснутих кнопок). Keyboard, mouse clicks, drag — ніколи не дропаємо.
    if (msg.type === "mouse" && ws.bufferedAmount > 65536 && msg.data.buttons === 0) {
      return;
    }

    ws.send(JSON.stringify(msg));
  };

  watch(nodeDomain, (domain) => {
    if (domain) {
      connectHID()
    } else {
      if (wsConnection.value) {
        wsConnection.value.close()
        wsConnection.value = null
      }
      isHidConnected.value = false
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (wsConnection.value) {
      wsConnection.value.onclose = null // Prevent auto-reconnect
      wsConnection.value.close()
      wsConnection.value = null
    }
  })

  const wakeHost = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!nodeDomain.value) return { ok: false, error: 'No node domain' }
    try {
      const response = await fetch(`https://${nodeDomain.value}/ws/wake`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.accessToken}`
        }
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        return { ok: false, error: `HTTP ${response.status}${text ? ': ' + text : ''}` }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  return {
    isHidConnected,
    lastPong,
    sendHIDMessage,
    connectHID,
    wakeHost
  }
}
