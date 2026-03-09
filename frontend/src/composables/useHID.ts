import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { useAuthStore } from '../stores/auth'

export function useHID(nodeId: Ref<string>) {
  const authStore = useAuthStore()
  const wsConnection = shallowRef<WebSocket | null>(null)
  const isHidConnected = ref(false)

  const sendHIDMessage = (msg: any) => {
    if (wsConnection.value && wsConnection.value.readyState === WebSocket.OPEN && msg) {
      wsConnection.value.send(JSON.stringify(msg))
    }
  }

  let reconnectAttempts = 0
  const maxReconnectAttempts = 10
  const baseDelay = 3000

  const connectHID = () => {
    if (!nodeId.value) return
    
    if (wsConnection.value) {
      wsConnection.value.onclose = null
      wsConnection.value.close()
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/v1/nodes/${nodeId.value}/ws?token=${authStore.accessToken}`
    
    wsConnection.value = new WebSocket(wsUrl)
    
    wsConnection.value.onopen = () => {
      isHidConnected.value = true
      reconnectAttempts = 0
      console.log('HID WebSocket connected')
    }
    
    wsConnection.value.onclose = () => {
      isHidConnected.value = false
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        const delay = Math.min(baseDelay * reconnectAttempts, 30000)
        console.log(`HID WebSocket closed. Retrying in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`)
        setTimeout(() => {
          if (nodeId.value) connectHID()
        }, delay)
      } else {
        console.error('Max HID reconnection attempts reached.')
      }
    }
    
    wsConnection.value.onerror = () => {
      // Error handling is mostly covered by onclose
    }
  }

  watch(nodeId, (id) => {
    if (id) {
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

  return {
    isHidConnected,
    sendHIDMessage,
    connectHID
  }
}
