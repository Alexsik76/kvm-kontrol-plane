import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { resetKeyboardState } from '../utils/hid'

export function useHID(nodeId: Ref<string>, onReset?: () => void) {
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

    wsConnection.value.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
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

  const MSG_INTERVAL_MS = 10;
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

    // Movement coalescing:
    // If the latest message in the queue is a mouse movement and has the same button state,
    // we can merge this new movement into it instead of creating a new queue entry.
    if (msg.type === "mouse" && messageQueue.length > 0) {
      const lastMsg = messageQueue[messageQueue.length - 1];
      if (lastMsg.type === "mouse" && lastMsg.data.buttons === msg.data.buttons) {
        lastMsg.data.x += msg.data.x;
        lastMsg.data.y += msg.data.y;
        lastMsg.data.wheel += msg.data.wheel;
        
        // Constrain to int8 range [-127, 127]
        lastMsg.data.x = Math.max(-127, Math.min(127, lastMsg.data.x));
        lastMsg.data.y = Math.max(-127, Math.min(127, lastMsg.data.y));
        return;
      }
    }

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
