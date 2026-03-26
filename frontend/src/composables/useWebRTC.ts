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
  const candidateQueue: any[] = []

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

  const sendCandidate = async (candidate: any, sessionUrl: string) => {
    try {
      await fetch(`/api/v1/nodes/${nodeId.value}/signal/ice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        body: JSON.stringify({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          session_url: sessionUrl
        })
      })
    } catch (err) {
      console.error('Failed to send ICE candidate:', err)
    }
  }

  const startStream = async () => {
    if (!nodeId.value) return
    loading.value = true
    updateStatus('Negotiating WebRTC...')
    currentSessionUrl.value = null
    candidateQueue.length = 0

    if (peerConnection.value) {
      peerConnection.value.close()
    }

    try {
      peerConnection.value = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.relay.metered.ca:80" },
          {
            urls: [
              "turn:global.relay.metered.ca:80",
              "turn:global.relay.metered.ca:80?transport=tcp",
              "turn:global.relay.metered.ca:443",
              "turn:global.relay.metered.ca:443?transport=tcp"
            ],
            username: "764a7c65471d394d680f27c1",
            credential: "72KO6XDmdWvv3D4F",
          }
        ],
        iceTransportPolicy: 'all' // Allow local/VPN again
      })

      peerConnection.value.onicecandidate = (event) => {
        if (event.candidate && nodeId.value) {
          if (currentSessionUrl.value) {
            sendCandidate(event.candidate, currentSessionUrl.value)
          } else {
            candidateQueue.push(event.candidate)
          }
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

      if (!response.ok) throw new Error('Signaling failed')

      const answer = await response.json()
      currentSessionUrl.value = answer.session_url

      // Flush queued candidates
      if (currentSessionUrl.value) {
        while (candidateQueue.length > 0) {
          const cand = candidateQueue.shift()
          sendCandidate(cand, currentSessionUrl.value)
        }
      }

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
