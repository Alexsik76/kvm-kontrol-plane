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

  const startStream = async () => {
    if (!nodeId.value) return
    loading.value = true
    updateStatus('Gathering candidates...')

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
        iceTransportPolicy: 'all'
      })

      peerConnection.value.addTransceiver('video', { direction: 'recvonly' })

      peerConnection.value.ontrack = (event) => {
        if (videoRef.value && event.streams && event.streams[0]) {
          videoRef.value.srcObject = event.streams[0]
          updateStatus('Connected')
          loading.value = false
        }
      }

      // We wait for candidates to be gathered before sending the offer.
      // This is the most compatible way for Cloudflare Tunnels.
      const offer = await peerConnection.value.createOffer()
      await peerConnection.value.setLocalDescription(offer)

      // Wait for ICE gathering to complete (max 3 seconds)
      await new Promise<void>((resolve) => {
        if (peerConnection.value?.iceGatheringState === 'complete') {
          resolve()
        } else {
          const checkState = () => {
            if (peerConnection.value?.iceGatheringState === 'complete') {
              peerConnection.value?.removeEventListener('icegatheringstatechange', checkState)
              resolve()
            }
          }
          peerConnection.value?.addEventListener('icegatheringstatechange', checkState)
          // Safety timeout
          setTimeout(resolve, 3000)
        }
      })

      updateStatus('Signaling...')
      
      const currentOffer = peerConnection.value.localDescription
      if (!currentOffer) throw new Error('Failed to create local description')

      const response = await fetch(`/api/v1/nodes/${nodeId.value}/signal/offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        body: JSON.stringify({ sdp: currentOffer.sdp, type: currentOffer.type })
      })

      if (!response.ok) throw new Error(`Signaling failed: ${response.status}`)

      const answer = await response.json()
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
