import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { useAuthStore } from '../stores/auth'

export function useHID(nodeId: Ref<string>) {
  const authStore = useAuthStore()
  const wsConnection = shallowRef<WebSocket | null>(null)
  const isHidConnected = ref(false)

  let lastMessageTime = 0

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
      console.log('HID WebSocket connected')
    }
    
    wsConnection.value.onclose = () => {
      isHidConnected.value = false
      console.log('HID WebSocket closed. No automatic reconnection.')
    }
  }

  const MSG_INTERVAL_MS = 15;
  const messageQueue: any[] = [];
  let isSendingQueue = false;

  const processQueue = () => {
    if (messageQueue.length === 0) {
      isSendingQueue = false;
      return;
    }
    
    isSendingQueue = true;
    const msg = messageQueue.shift();
    
    if (wsConnection.value?.readyState === WebSocket.OPEN) {
      wsConnection.value.send(JSON.stringify(msg));
    }
    
    setTimeout(processQueue, MSG_INTERVAL_MS);
  };

  const sendHIDMessage = (msg: any) => {
    if (wsConnection.value?.readyState !== WebSocket.OPEN) return;

    if (msg.type === "mouse" && msg.data.buttons === 0) {
      // For pure mouse movement without clicks, we can drop them if sending too fast or busy
      const now = Date.now();
      if (now - lastMessageTime < MSG_INTERVAL_MS || isSendingQueue) return;
      lastMessageTime = now;
      wsConnection.value.send(JSON.stringify(msg));
      return;
    }

    // Always queue keyboard events and mouse clicks to guarantee delivery
    messageQueue.push(msg);
    if (!isSendingQueue) {
      processQueue();
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
