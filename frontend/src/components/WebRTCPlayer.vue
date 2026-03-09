<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { createKeyboardEventMessage, createMouseEventMessage } from '../utils/hid'

const props = defineProps<{
  nodeId: string
  nodeIp?: string
}>()

const emit = defineEmits<{
  (e: 'status-changed', payload: { status: string, error: string }): void
  (e: 'capture-change', captured: boolean): void
}>()

const authStore = useAuthStore()

const videoRef = ref<HTMLVideoElement | null>(null)
const loading = ref(true)
const connectionError = ref('')
const streamStatus = ref('Connecting...')

let peerConnection: RTCPeerConnection | null = null

const updateStatus = (status: string, err: string = '') => {
  streamStatus.value = status
  connectionError.value = err
  emit('status-changed', { status, error: err })
}

const startStream = async () => {
  if (!props.nodeId) return

  loading.value = true
  updateStatus('Negotiating WebRTC...')

  try {
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    peerConnection.addTransceiver('video', { direction: 'recvonly' })

    peerConnection.ontrack = (event) => {
      if (videoRef.value && event.streams && event.streams[0]) {
        if (videoRef.value.srcObject !== event.streams[0]) {
          videoRef.value.srcObject = event.streams[0]
          updateStatus('Connected')
          loading.value = false
          
          // Wait briefly for the frame to render, then grab a screenshot
          setTimeout(() => {
            captureAndUploadScreenshot()
          }, 3000)
        }
      }
    }

const captureAndUploadScreenshot = async () => {
  if (!videoRef.value || !videoRef.value.videoWidth) return

  try {
    const canvas = document.createElement('canvas')
    // Downscale the screenshot slightly to save DB size, e.g. max width 1280
    const scale = Math.min(1, 1280 / videoRef.value.videoWidth)
    canvas.width = videoRef.value.videoWidth * scale
    canvas.height = videoRef.value.videoHeight * scale
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
    
    // Use JPEG with 0.6 quality to keep payload small for DB Text column
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6)

    await fetch(`/api/v1/nodes/${props.nodeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.accessToken}`
      },
      // Keep existing data mostly the same by omitting it, only update screenshot
      body: JSON.stringify({ 
        screenshot: dataUrl 
      })
    })
    console.log('Automated screenshot captured and saved.')
  } catch (err) {
    console.error('Failed to capture or upload screenshot:', err)
  }
}

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection?.connectionState === 'failed' || peerConnection?.connectionState === 'disconnected') {
        updateStatus('Connection Lost', 'The video stream was disconnected.')
        loading.value = false
      }
    }

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    const response = await fetch(`/api/v1/nodes/${props.nodeId}/signal/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.accessToken}`
      },
      body: JSON.stringify({
        sdp: offer.sdp,
        type: offer.type
      })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.detail || 'Signaling failed')
    }

    const answer = await response.json()
    await peerConnection.setRemoteDescription({
      type: answer.type,
      sdp: answer.sdp
    })
  } catch (err: any) {
    console.error('WebRTC streaming error:', err)
    updateStatus('Failed to connect', err.message || 'Failed to establish WebRTC stream.')
    loading.value = false
  }
}
const isCaptured = ref(false)

const startCapture = () => {
  isCaptured.value = true
  emit('capture-change', true)
  if (videoRef.value) {
    videoRef.value.focus()
  }
}

const stopCapture = () => {
  isCaptured.value = false
  emit('capture-change', false)
}

defineExpose({ startCapture, stopCapture })

onMounted(() => {
  startStream()
})

onBeforeUnmount(() => {
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }
})

// Restart stream if nodeId changes dynamically
watch(() => props.nodeId, () => {
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }
  startStream()
})

// === HID WebSocket Integration ===
let wsConnection: WebSocket | null = null
const isHidConnected = ref(false)

const connectHID = () => {
  if (!props.nodeIp) return
  
  if (wsConnection) {
    wsConnection.close()
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/api/v1/nodes/${props.nodeId}/ws`
  console.log('Connecting to HID Server via backend proxy:', wsUrl)
  
  wsConnection = new WebSocket(wsUrl)
  
  wsConnection.onopen = () => {
    isHidConnected.value = true
    console.log('HID WebSocket connected')
  }
  
  wsConnection.onclose = () => {
    isHidConnected.value = false
    console.log('HID WebSocket closed')
    // Auto-reconnect after 3s
    setTimeout(() => {
      if (props.nodeIp) connectHID()
    }, 3000)
  }
  
  wsConnection.onerror = (err) => {
    console.error('HID WebSocket error:', err)
  }
}

watch(() => props.nodeIp, (newIp) => {
  if (newIp) {
    connectHID()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (wsConnection) {
    wsConnection.onclose = null // Prevent auto-reconnect
    wsConnection.close()
    wsConnection = null
  }
})

// === Event Handlers for HID ===
const sendHIDMessage = (msg: any) => {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN && msg) {
    wsConnection.send(JSON.stringify(msg))
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (!isCaptured.value) return;
  // Allow browser shortcuts
  if (['F5', 'F12'].includes(e.code)) return;
  
  // Custom exit shortcut: Shift + Escape
  if (e.code === 'Escape' && e.shiftKey) {
    stopCapture()
    return;
  }

  e.preventDefault()
  const msg = createKeyboardEventMessage(e, true)
  if (msg) sendHIDMessage(msg)
}

const handleKeyUp = (e: KeyboardEvent) => {
  if (!isCaptured.value) return;
  if (['F5', 'F12'].includes(e.code)) return;
  if (e.code === 'Escape' && e.shiftKey) return; 

  e.preventDefault()
  const msg = createKeyboardEventMessage(e, false)
  if (msg) sendHIDMessage(msg)
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isCaptured.value) return;
  e.preventDefault()
  if (e.movementX === 0 && e.movementY === 0) return;
  const msg = createMouseEventMessage(e.buttons, e.movementX, e.movementY, 0)
  sendHIDMessage(msg)
}

const handleMouseDown = (e: MouseEvent) => {
  if (!isCaptured.value) return;
  e.preventDefault()
  const msg = createMouseEventMessage(e.buttons, 0, 0, 0)
  sendHIDMessage(msg)
}

const handleMouseUp = (e: MouseEvent) => {
  if (!isCaptured.value) return;
  e.preventDefault()
  const msg = createMouseEventMessage(e.buttons, 0, 0, 0)
  sendHIDMessage(msg)
}

const handleWheel = (e: WheelEvent) => {
  if (!isCaptured.value) return;
  e.preventDefault()
  const wheelVal = e.deltaY > 0 ? -1 : 1
  const msg = createMouseEventMessage(e.buttons, 0, 0, wheelVal)
  sendHIDMessage(msg)
}

// Disable context menu on the video element to prevent Right-click blocking
const handleContextMenu = (e: Event) => {
  e.preventDefault()
}
</script>

<template>
  <v-card class="flex-grow-1 bg-black rounded-lg overflow-hidden position-relative h-100" elevation="6">
    <!-- HID Connected Indicator Overlay -->
    <div 
      v-if="isHidConnected" 
      class="position-absolute text-caption px-3 py-1 rounded bg-black border"
      :class="isCaptured ? 'border-success text-success' : 'border-grey text-grey'"
      style="top: 8px; right: 8px; z-index: 20; opacity: 0.9;"
    >
      <v-icon icon="mdi-keyboard" size="small" class="mr-1"></v-icon>
      <v-icon icon="mdi-mouse" size="small" class="mr-2"></v-icon>
      <span v-if="isCaptured" class="font-weight-bold">HID Active (Shift+ESC to exit)</span>
      <span v-else>HID Ready</span>
    </div>

    <!-- Click to Capture Overlay -->
    <div
      v-if="isHidConnected && !isCaptured"
      class="position-absolute d-flex flex-column align-center justify-center w-100 h-100"
      style="top: 0; left: 0; z-index: 10; background: rgba(0,0,0,0.5); cursor: pointer; backdrop-filter: grayscale(80%);"
      @click="startCapture"
    >
      <v-icon icon="mdi-cursor-default-click" size="64" color="white" class="mb-4"></v-icon>
      <div class="text-h5 text-white font-weight-bold">Click to Control</div>
      <div class="text-body-1 text-grey-lighten-2 mt-2">Press Shift+ESC to unlock</div>
    </div>

    <video
      ref="videoRef"
      autoplay
      playsinline
      muted
      tabindex="0"
      @keydown="handleKeyDown"
      @keyup="handleKeyUp"
      @mousemove="handleMouseMove"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @wheel="handleWheel"
      @contextmenu="handleContextMenu"
      class="w-100 h-100"
      :style="{ objectFit: 'contain', background: '#000', outline: 'none', cursor: isCaptured ? 'none' : 'crosshair' }"
    ></video>

    <div
      v-if="loading || connectionError"
      class="position-absolute d-flex flex-column align-center justify-center w-100 h-100"
      style="top: 0; left: 0; background: rgba(0,0,0,0.7); z-index: 10;"
    >
      <v-progress-circular
        v-if="loading"
        indeterminate
        color="primary"
        size="64"
        class="mb-4"
      ></v-progress-circular>
      
      <v-icon
        v-if="connectionError"
        icon="mdi-video-off"
        color="error"
        size="64"
        class="mb-4"
      ></v-icon>
      
      <h3 class="text-h6 font-weight-medium text-white">{{ streamStatus }}</h3>
      <p v-if="connectionError" class="text-body-1 text-error mt-2">{{ connectionError }}</p>
      
      <v-btn
        v-if="connectionError"
        color="primary"
        variant="flat"
        prepend-icon="mdi-reload"
        class="mt-6"
        @click="startStream"
      >
        Retry Connection
      </v-btn>
    </div>
  </v-card>
</template>
