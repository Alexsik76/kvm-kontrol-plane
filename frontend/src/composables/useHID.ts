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

  const connectHID = () => {
    if (!nodeId.value) return
    
    if (wsConnection.value) {
      wsConnection.value.close()
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/v1/nodes/${nodeId.value}/ws?token=${authStore.accessToken}`
    console.log('Connecting to HID Server via backend proxy:', wsUrl)
    
    wsConnection.value = new WebSocket(wsUrl)
    
    wsConnection.value.onopen = () => {
      isHidConnected.value = true
      console.log('HID WebSocket connected')
    }
    
    wsConnection.value.onclose = () => {
      isHidConnected.value = false
      console.log('HID WebSocket closed')
      // Auto-reconnect after 3s
      setTimeout(() => {
        if (nodeId.value) connectHID()
      }, 3000)
    }
    
    wsConnection.value.onerror = (err) => {
      console.error('HID WebSocket error:', err)
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
