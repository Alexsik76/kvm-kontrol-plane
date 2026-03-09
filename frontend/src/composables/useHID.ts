import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { useAuthStore } from '../stores/auth'

export function useHID(nodeId: Ref<string>) {
  const authStore = useAuthStore()
  const wsConnection = shallowRef<WebSocket | null>(null)
  const isHidConnected = ref(false)

  let reconnectAttempts = 0
  const maxReconnectAttempts = 10
  const baseDelay = 3000
  let lastMessageTime = 0
  const MSG_THROTTLE_MS = 10 // 100Hz max for any HID message

  const connectHID = () => {
    if (!nodeId.value) return
    
    // Always clear existing connection properly
    if (wsConnection.value) {
      wsConnection.value.onclose = null
      wsConnection.value.close()
    }

    // Ensure we are using the LATEST token from the store
    const currentToken = authStore.accessToken
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/v1/nodes/${nodeId.value}/ws?token=${currentToken}`
    
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
        console.log(`HID WebSocket closed. Retrying in ${delay}ms...`)
        setTimeout(() => {
          if (nodeId.value) connectHID()
        }, delay)
      }
    }
  }

  const throttledSend = (msg: any) => {
    const now = Date.now()
    if (now - lastMessageTime < MSG_THROTTLE_MS) return
    
    if (wsConnection.value?.readyState === WebSocket.OPEN) {
      wsConnection.value.send(JSON.stringify(msg))
      lastMessageTime = now
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
    sendHIDMessage: throttledSend,
    connectHID
  }
}
