import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { useAuthedFetch } from './useAuthedFetch'

const MAX_RECONNECT = 5
const RECONNECT_DELAY_MS = 3000

export function useWebRTC(nodeId: Ref<string>) {
  const { authedFetch } = useAuthedFetch()
  const videoRef = ref<HTMLVideoElement | null>(null)
  const loading = ref(false)
  const connectionError = ref('')
  const streamStatus = ref('Idle')

  const peerConnection = shallowRef<RTCPeerConnection | null>(null)
  const currentSessionUrl = ref<string | null>(null)

  let _reconnectAttempts = 0
  let _reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const updateStatus = (status: string, err: string = '') => {
    streamStatus.value = status
    connectionError.value = err
  }

  const startStream = async () => {
    if (!nodeId.value || loading.value) return
    // Cancel any pending auto-reconnect timer — manual or triggered start takes over
    if (_reconnectTimer !== null) { clearTimeout(_reconnectTimer); _reconnectTimer = null }
    loading.value = true
    updateStatus('Connecting...')
    currentSessionUrl.value = null

    if (peerConnection.value) {
      // Detach handler before close so the 'closed' state transition doesn't trigger reconnect
      peerConnection.value.onconnectionstatechange = null
      peerConnection.value.close()
    }

    try {
      peerConnection.value = new RTCPeerConnection({
        // iceServers: [{ urls: 'stun:stun.relay.metered.ca:80' }],
        iceServers: [],
        iceTransportPolicy: 'all',
      })

      // Reconnect on peer connection failure — main safeguard independent of any status channel
      peerConnection.value.onconnectionstatechange = () => {
        const state = peerConnection.value?.connectionState
        if (state === 'failed') {
          updateStatus('Failed', 'Stream lost — retrying...')
          loading.value = false
          scheduleReconnect()
        }
      }

      // Send candidates immediately as they are found (Trickle ICE)
      peerConnection.value.onicecandidate = (event) => {
        if (event.candidate && nodeId.value && currentSessionUrl.value) {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
          authedFetch(`${apiBaseUrl}/api/v1/nodes/${nodeId.value}/signal/ice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              session_url: currentSessionUrl.value,
            }),
          }).catch(err => console.error('ICE Error:', err))
        }
      }

      peerConnection.value.addTransceiver('video', { direction: 'recvonly' })

      peerConnection.value.ontrack = (event) => {
        if (videoRef.value && event.streams && event.streams[0]) {
          videoRef.value.srcObject = event.streams[0]
          updateStatus('Connected')
          loading.value = false
          _reconnectAttempts = 0
        }
      }

      const offer = await peerConnection.value.createOffer()
      await peerConnection.value.setLocalDescription(offer)

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
      const response = await authedFetch(
        `${apiBaseUrl}/api/v1/nodes/${nodeId.value}/signal/offer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sdp: offer.sdp, type: offer.type }),
        },
      )

      if (!response.ok) throw new Error(`Signaling failed: ${response.status}`)

      const answer = await response.json()
      currentSessionUrl.value = answer.session_url

      await peerConnection.value.setRemoteDescription({
        type: answer.type,
        sdp: answer.sdp,
      })
    } catch (err: any) {
      console.error('WebRTC error:', err)
      updateStatus('Failed', err.message)
      loading.value = false
    }
  }

  // One scheduled attempt at a time; after MAX_RECONNECT exposes manual Retry
  const scheduleReconnect = () => {
    if (_reconnectTimer !== null) return
    if (_reconnectAttempts >= MAX_RECONNECT) {
      updateStatus('Failed', 'Stream lost — click Retry')
      return
    }
    _reconnectAttempts++
    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null
      startStream()
    }, RECONNECT_DELAY_MS)
  }

  watch(nodeId, (newId) => {
    if (newId) startStream()
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (_reconnectTimer !== null) { clearTimeout(_reconnectTimer); _reconnectTimer = null }
    if (peerConnection.value) peerConnection.value.close()
  })

  return { videoRef, loading, connectionError, streamStatus, startStream, peerConnection }
}
