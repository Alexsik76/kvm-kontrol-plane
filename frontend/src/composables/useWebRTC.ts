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
    updateStatus('Negotiating WebRTC...')

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

      // Trickle ICE
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
              sdpMLineIndex: event.candidate.sdpMLineIndex
            })
          }).catch(err => console.error('Failed to send ICE candidate:', err))
        }
      }

      peerConnection.value.addTransceiver('video', { direction: 'recvonly' })

      peerConnection.value.ontrack = (event) => {
        if (videoRef.value && event.streams && event.streams[0]) {
          // Robust stream assignment
          if (videoRef.value.srcObject !== event.streams[0]) {
            videoRef.value.srcObject = event.streams[0]
            console.log('WebRTC Stream attached successfully')
          }
          updateStatus('Connected')
          loading.value = false
        }
      }

      peerConnection.value.onconnectionstatechange = () => {
        const state = peerConnection.value?.connectionState
        console.log('WebRTC Connection State:', state)
        if (state === 'connected') {
          updateStatus('Connected')
          loading.value = false
        } else if (state === 'failed' || state === 'disconnected') {
          updateStatus('Connection Lost')
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

      if (!response.ok) throw new Error('Signaling failed')

      const answer = await response.json()
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
