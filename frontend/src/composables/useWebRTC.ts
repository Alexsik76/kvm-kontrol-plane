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

  const startStream = async () => {
    if (!nodeId.value) return
    loading.value = true
    updateStatus('Connecting...')
    currentSessionUrl.value = null

    if (peerConnection.value) {
      peerConnection.value.close()
    }

    try {
      peerConnection.value = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.relay.metered.ca:80" },
        ],
        iceTransportPolicy: 'all'
      })

      // Send candidates immediately as they are found (Trickle ICE)
      peerConnection.value.onicecandidate = (event) => {
        if (event.candidate && nodeId.value && currentSessionUrl.value) {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
          fetch(`${apiBaseUrl}/api/v1/nodes/${nodeId.value}/signal/ice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authStore.accessToken}`
            },
            body: JSON.stringify({
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              session_url: currentSessionUrl.value
            })
          }).catch(err => console.error('ICE Error:', err))
        }
      }

      peerConnection.value.addTransceiver('video', { direction: 'recvonly' })

      peerConnection.value.ontrack = (event) => {
        if (videoRef.value && event.streams && event.streams[0]) {
          videoRef.value.srcObject = event.streams[0]
          updateStatus('Connected')
          loading.value = false
        }
      }

      const offer = await peerConnection.value.createOffer()
      await peerConnection.value.setLocalDescription(offer)

      // Signaling
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/v1/nodes/${nodeId.value}/signal/offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        body: JSON.stringify({ sdp: offer.sdp, type: offer.type })
      })

      if (!response.ok) throw new Error(`Signaling failed: ${response.status}`)

      const answer = await response.json()
      currentSessionUrl.value = answer.session_url

      await peerConnection.value.setRemoteDescription({
        type: answer.type,
        sdp: answer.sdp
      })
    } catch (err: any) {
      console.error('WebRTC error:', err)
      updateStatus('Failed', err.message)
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
