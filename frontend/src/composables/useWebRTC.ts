import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { useAuthStore } from '../stores/auth'

export function useWebRTC(nodeId: Ref<string>) {
  const authStore = useAuthStore()
  const videoRef = ref<HTMLVideoElement | null>(null)
  const loading = ref(false)
  const connectionError = ref('')
  const streamStatus = ref('Idle')
  
  const peerConnection = shallowRef<RTCPeerConnection | null>(null)

  const updateStatus = (status: string, err: string = '') => {
    streamStatus.value = status
    connectionError.value = err
  }

  const captureAndUploadScreenshot = async () => {
    if (!videoRef.value || !videoRef.value.videoWidth || !nodeId.value) return

    try {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1280 / videoRef.value.videoWidth)
      canvas.width = videoRef.value.videoWidth * scale
      canvas.height = videoRef.value.videoHeight * scale
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6)

      await fetch(`/api/v1/nodes/${nodeId.value}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        body: JSON.stringify({ screenshot: dataUrl })
      })
    } catch (err) {
      console.error('Failed to capture or upload screenshot:', err)
    }
  }

  const retryDelay = 5000
  let reconnectTimer: any = null

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const startStream = async () => {
    if (!nodeId.value) return

    loading.value = true
    updateStatus('Negotiating WebRTC...')
    clearReconnectTimer()

    if (peerConnection.value) {
      peerConnection.value.close()
    }

    try {
      peerConnection.value = new RTCPeerConnection({
        iceServers: [
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "764a7c65471d394d680f27c1",
      credential: "72KO6XDmdWvv3D4F",
    }
  ],
        iceTransportPolicy: 'relay'
      })

      peerConnection.value.addTransceiver('video', { direction: 'recvonly' })

      peerConnection.value.ontrack = (event) => {
        if (videoRef.value && event.streams && event.streams[0]) {
          if (videoRef.value.srcObject !== event.streams[0]) {
            videoRef.value.srcObject = event.streams[0]
            updateStatus('Connected')
            loading.value = false
            
            videoRef.value.onloadeddata = () => {
              captureAndUploadScreenshot()
              if (videoRef.value) videoRef.value.onloadeddata = null
            }
          }
        }
      }

      peerConnection.value.onconnectionstatechange = () => {
        const state = peerConnection.value?.connectionState
        
        if (state === 'failed' || state === 'disconnected') {
          updateStatus('Connection Lost', 'The video stream was disconnected.')
          loading.value = false
          scheduleReconnect()
        }
      }

      const offer = await peerConnection.value.createOffer()
      await peerConnection.value.setLocalDescription(offer)

      const response = await fetch(`/api/v1/nodes/${nodeId.value}/signal/offer`, {
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
        let errorMsg = 'Signaling failed'
        try {
          const data = await response.json()
          errorMsg = data.detail || errorMsg
        } catch (e) {
          errorMsg = `Server error (${response.status})`
        }
        throw new Error(errorMsg)
      }

      const answer = await response.json()
      await peerConnection.value.setRemoteDescription({
        type: answer.type,
        sdp: answer.sdp
      })
    } catch (err: any) {
      console.error('WebRTC streaming error:', err)
      updateStatus('Failed to connect', err.message || 'Failed to establish WebRTC stream.')
      loading.value = false
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    clearReconnectTimer()
    
    reconnectTimer = window.setTimeout(() => {
      if (nodeId.value) {
        startStream()
      }
    }, retryDelay)
  }

  watch(nodeId, (newId) => {
    if (newId) {
      startStream()
    } else {
      clearReconnectTimer()
      if (peerConnection.value) {
        peerConnection.value.close()
        peerConnection.value = null
      }
      updateStatus('Idle')
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    clearReconnectTimer()
    if (peerConnection.value) {
      peerConnection.value.close()
      peerConnection.value = null
    }
  })

  return {
    videoRef,
    loading,
    connectionError,
    streamStatus,
    startStream,
    captureAndUploadScreenshot
  }
}
