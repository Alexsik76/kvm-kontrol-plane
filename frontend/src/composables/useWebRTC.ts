import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { useAuthStore } from '../stores/auth'

export function useWebRTC(nodeId: Ref<string>) {
  const authStore = useAuthStore()
  const videoRef = ref<HTMLVideoElement | null>(null)
  const loading = ref(false)
  const connectionError = ref('')
  const streamStatus = ref('Idle')
  
  const peerConnection = shallowRef<RTCPeerConnection | null>(null)
  const currentSessionUrl = ref<string | null>(null)

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

  const startStream = async () => {
    if (!nodeId.value) return
    loading.value = true
    updateStatus('Negotiating WebRTC...')
    currentSessionUrl.value = null

    if (peerConnection.value) {
      peerConnection.value.close()
    }

    try {
      peerConnection.value = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.relay.metered.ca:80" },
          {
            urls: "turn:global.relay.metered.ca:80",
            username: "764a7c65471d394d680f27c1",
            credential: "72KO6XDmdWvv3D4F",
          },
          {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "764a7c65471d394d680f27c1",
            credential: "72KO6XDmdWvv3D4F",
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: "764a7c65471d394d680f27c1",
            credential: "72KO6XDmdWvv3D4F",
          },
          {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: "764a7c65471d394d680f27c1",
            credential: "72KO6XDmdWvv3D4F",
          }
        ],
        // Set to 'relay' to force TURN through Cloudflare Tunnel
        iceTransportPolicy: 'relay' 
      })

      // TRICKLE ICE
      peerConnection.value.onicecandidate = (event) => {
        if (event.candidate && nodeId.value) {
          fetch(`/api/v1/nodes/${nodeId.value}/signal/ice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authStore.accessToken}`
            },
            body: JSON.stringify({
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              session_url: currentSessionUrl.value // Essential for WHEP/MediaMTX
            })
          }).catch(err => console.error('Failed to send ICE candidate:', err))
        }
      }

      peerConnection.value.addTransceiver('video', { direction: 'recvonly' })

      peerConnection.value.ontrack = (event) => {
        if (videoRef.value && event.streams && event.streams[0]) {
          videoRef.value.srcObject = event.streams[0]
          updateStatus('Connected')
          loading.value = false
          videoRef.value.onloadeddata = () => {
            captureAndUploadScreenshot()
            if (videoRef.value) videoRef.value.onloadeddata = null
          }
        }
      }

      peerConnection.value.onconnectionstatechange = () => {
        const state = peerConnection.value?.connectionState
        if (state === 'failed' || state === 'disconnected') {
          updateStatus('Connection Lost', 'The video stream was disconnected.')
          loading.value = false
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
        body: JSON.stringify({ sdp: offer.sdp, type: offer.type })
      })

      if (!response.ok) throw new Error(`Signaling failed: ${response.status}`)

      const answer = await response.json()
      // Store the session URL provided by the backend for Trickle ICE
      currentSessionUrl.value = answer.session_url

      await peerConnection.value.setRemoteDescription({
        type: answer.type,
        sdp: answer.sdp
      })
    } catch (err: any) {
      console.error('WebRTC streaming error:', err)
      updateStatus('Failed to connect', err.message)
      loading.value = false
    }
  }

  watch(nodeId, (newId) => {
    if (newId) startStream()
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (peerConnection.value) peerConnection.value.close()
  })

  return { videoRef, loading, connectionError, streamStatus, startStream }
}
