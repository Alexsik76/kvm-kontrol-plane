<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{
  nodeId: string
}>()

const emit = defineEmits(['status-changed'])

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
</script>

<template>
  <v-card class="flex-grow-1 bg-black rounded-lg overflow-hidden position-relative h-100" elevation="6">
    <video
      ref="videoRef"
      autoplay
      playsinline
      muted
      class="w-100 h-100"
      style="object-fit: contain; background: #000;"
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
