import { ref, watch, onBeforeUnmount, type Ref } from 'vue'

export interface DiagnosticsMetrics {
  // HID
  hidRttMs: number | null          // round-trip ping/pong, мс
  hidPingLossPct: number           // % втрачених ping за останнє вікно
  // WebRTC network
  webrtcRttMs: number | null       // currentRoundTripTime * 1000
  // WebRTC video
  jitterBufferDelayMs: number | null  // середня затримка jitter buffer на кадр
  frameDecodeMs: number | null     // середній час декодування кадру
  fps: number | null               // framesPerSecond
  framesDropped: number            // cumulative
  framesDecoded: number            // cumulative
  bitrateKbps: number | null       // delta bytesReceived * 8 / 1000
  // Resolution
  frameWidth: number | null
  frameHeight: number | null
}

interface PingRecord {
  id: number
  sentAt: number      // performance.now()
  ackedAt: number | null
}

const TICK_MS = 1000
const PING_WINDOW = 10  // тримаємо останні 10 пінгів для loss%
const PING_TIMEOUT_MS = 3000

export function useDiagnostics(
  peerConnection: Ref<RTCPeerConnection | null>,
  sendHIDMessage: (msg: any) => void,
  lastPong: Ref<{ id: number; receivedAt: number } | null>,
  enabled: Ref<boolean>,
) {
  const metrics = ref<DiagnosticsMetrics>({
    hidRttMs: null,
    hidPingLossPct: 0,
    webrtcRttMs: null,
    jitterBufferDelayMs: null,
    frameDecodeMs: null,
    fps: null,
    framesDropped: 0,
    framesDecoded: 0,
    bitrateKbps: null,
    frameWidth: null,
    frameHeight: null,
  })

  let nextPingId = 1
  const pings: PingRecord[] = []
  let tickTimer: number | null = null

  // Прев. snapshot getStats для розрахунку дельт (bitrate, fps, decode time)
  let prevSnapshot: {
    bytesReceived: number
    framesDecoded: number
    totalDecodeTime: number
    jitterBufferDelay: number
    jitterBufferEmittedCount: number
    timestamp: number
  } | null = null

  // ---------- HID ping/pong ----------

  const sendPing = () => {
    const id = nextPingId++
    const rec: PingRecord = { id, sentAt: performance.now(), ackedAt: null }
    pings.push(rec)
    if (pings.length > PING_WINDOW) pings.shift()
    sendHIDMessage({ type: 'ping', data: { id } })
  }

  // Ловимо pong через watch на lastPong
  watch(lastPong, (pong) => {
    if (!pong) return
    const rec = pings.find(p => p.id === pong.id)
    if (rec && rec.ackedAt === null) {
      rec.ackedAt = pong.receivedAt
      metrics.value = { ...metrics.value, hidRttMs: Math.round(rec.ackedAt - rec.sentAt) }
    }
  })

  const computeHidLoss = () => {
    const now = performance.now()
    let total = 0
    let lost = 0
    for (const p of pings) {
      if (now - p.sentAt < PING_TIMEOUT_MS && p.ackedAt === null) continue  // ще в польоті
      total++
      if (p.ackedAt === null) lost++
    }
    return total === 0 ? 0 : Math.round((lost / total) * 100)
  }

  // ---------- WebRTC getStats ----------

  const collectWebRtcStats = async () => {
    const pc = peerConnection.value
    if (!pc) return

    try {
      const stats = await pc.getStats()
      let inboundVideo: any = null
      let candidatePair: any = null

      stats.forEach((report: any) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          inboundVideo = report
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
          candidatePair = report
        }
        // fallback: будь-який succeeded candidate-pair якщо nominated немає
        if (!candidatePair && report.type === 'candidate-pair' && report.state === 'succeeded') {
          candidatePair = report
        }
      })

      const now = performance.now()
      const next: Partial<DiagnosticsMetrics> = {}

      if (candidatePair && typeof candidatePair.currentRoundTripTime === 'number') {
        next.webrtcRttMs = Math.round(candidatePair.currentRoundTripTime * 1000)
      }

      if (inboundVideo) {
        next.framesDropped = inboundVideo.framesDropped ?? 0
        next.framesDecoded = inboundVideo.framesDecoded ?? 0
        next.frameWidth = inboundVideo.frameWidth ?? null
        next.frameHeight = inboundVideo.frameHeight ?? null
        next.fps = inboundVideo.framesPerSecond ?? null

        const bytes = inboundVideo.bytesReceived ?? 0
        const decoded = inboundVideo.framesDecoded ?? 0
        const totalDecode = inboundVideo.totalDecodeTime ?? 0
        const jbDelay = inboundVideo.jitterBufferDelay ?? 0
        const jbEmitted = inboundVideo.jitterBufferEmittedCount ?? 0

        if (prevSnapshot) {
          const dt = (now - prevSnapshot.timestamp) / 1000
          if (dt > 0) {
            const dBytes = bytes - prevSnapshot.bytesReceived
            next.bitrateKbps = Math.round((dBytes * 8) / 1000 / dt)
          }
          const dFrames = decoded - prevSnapshot.framesDecoded
          const dDecodeTime = totalDecode - prevSnapshot.totalDecodeTime
          if (dFrames > 0) {
            next.frameDecodeMs = Math.round((dDecodeTime / dFrames) * 1000)
          }
          const dEmitted = jbEmitted - prevSnapshot.jitterBufferEmittedCount
          const dJbDelay = jbDelay - prevSnapshot.jitterBufferDelay
          if (dEmitted > 0) {
            next.jitterBufferDelayMs = Math.round((dJbDelay / dEmitted) * 1000)
          }
        }

        prevSnapshot = {
          bytesReceived: bytes,
          framesDecoded: decoded,
          totalDecodeTime: totalDecode,
          jitterBufferDelay: jbDelay,
          jitterBufferEmittedCount: jbEmitted,
          timestamp: now,
        }
      }

      metrics.value = { ...metrics.value, ...next }
    } catch (err) {
      // getStats може кидати під час teardown — мовчки ігноруємо
    }
  }

  // ---------- Tick ----------

  const tick = async () => {
    if (!enabled.value) return
    sendPing()
    metrics.value = { ...metrics.value, hidPingLossPct: computeHidLoss() }
    await collectWebRtcStats()
  }

  // ---------- Lifecycle ----------

  const start = () => {
    if (tickTimer !== null) return
    tickTimer = window.setInterval(tick, TICK_MS)
  }

  const stop = () => {
    if (tickTimer !== null) {
      clearInterval(tickTimer)
      tickTimer = null
    }
    pings.length = 0
    prevSnapshot = null
  }

  watch(enabled, (on) => {
    if (on) start()
    else stop()
  }, { immediate: true })

  onBeforeUnmount(() => {
    stop()
  })

  return { metrics }
}
