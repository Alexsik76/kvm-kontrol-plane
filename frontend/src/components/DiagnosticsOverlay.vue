<script setup lang="ts">
import { computed } from 'vue'
import type { DiagnosticsMetrics } from '../composables/useDiagnostics'

const props = defineProps<{
  metrics: DiagnosticsMetrics
}>()

const fmt = (v: number | null, suffix = '') => v === null ? '—' : `${v}${suffix}`

// Кольорове кодування — прості пороги
const hidColor = computed(() => {
  const v = props.metrics.hidRttMs
  if (v === null) return 'text-medium-emphasis'
  if (v < 30) return 'text-success'
  if (v < 80) return 'text-warning'
  return 'text-error'
})

const rtcRttColor = computed(() => {
  const v = props.metrics.webrtcRttMs
  if (v === null) return 'text-medium-emphasis'
  if (v < 50) return 'text-success'
  if (v < 150) return 'text-warning'
  return 'text-error'
})

const jitterColor = computed(() => {
  const v = props.metrics.jitterBufferDelayMs
  if (v === null) return 'text-medium-emphasis'
  if (v < 50) return 'text-success'
  if (v < 120) return 'text-warning'
  return 'text-error'
})

const fpsColor = computed(() => {
  const v = props.metrics.fps
  if (v === null) return 'text-medium-emphasis'
  if (v >= 50) return 'text-success'
  if (v >= 20) return 'text-warning'
  return 'text-error'
})

const lossColor = computed(() => {
  const v = props.metrics.hidPingLossPct
  if (v === 0) return 'text-success'
  if (v < 5) return 'text-warning'
  return 'text-error'
})
</script>

<template>
  <div
    class="diagnostics-overlay"
    style="
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 20;
      background: rgba(0, 0, 0, 0.72);
      color: #fff;
      font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
      font-size: 11px;
      line-height: 1.4;
      padding: 8px 12px;
      border-radius: 6px;
      pointer-events: none;
      min-width: 220px;
      backdrop-filter: blur(4px);
    "
  >
    <div style="font-weight: 600; margin-bottom: 4px; opacity: 0.7; font-size: 10px; letter-spacing: 0.5px;">
      DIAGNOSTICS
    </div>

    <div class="d-flex justify-space-between">
      <span>HID RTT</span>
      <span :class="hidColor">{{ fmt(metrics.hidRttMs, ' ms') }}</span>
    </div>
    <div class="d-flex justify-space-between">
      <span>HID loss</span>
      <span :class="lossColor">{{ metrics.hidPingLossPct }}%</span>
    </div>

    <div style="height: 4px;"></div>

    <div class="d-flex justify-space-between">
      <span>WebRTC RTT</span>
      <span :class="rtcRttColor">{{ fmt(metrics.webrtcRttMs, ' ms') }}</span>
    </div>
    <div class="d-flex justify-space-between">
      <span>Jitter buf</span>
      <span :class="jitterColor">{{ fmt(metrics.jitterBufferDelayMs, ' ms') }}</span>
    </div>
    <div class="d-flex justify-space-between">
      <span>Decode</span>
      <span>{{ fmt(metrics.frameDecodeMs, ' ms') }}</span>
    </div>

    <div style="height: 4px;"></div>

    <div class="d-flex justify-space-between">
      <span>FPS</span>
      <span :class="fpsColor">{{ fmt(metrics.fps) }}</span>
    </div>
    <div class="d-flex justify-space-between">
      <span>Bitrate</span>
      <span>{{ fmt(metrics.bitrateKbps, ' kbps') }}</span>
    </div>
    <div class="d-flex justify-space-between">
      <span>Resolution</span>
      <span>
        {{ metrics.frameWidth ?? '—' }}×{{ metrics.frameHeight ?? '—' }}
      </span>
    </div>
    <div class="d-flex justify-space-between">
      <span>Dropped</span>
      <span>{{ metrics.framesDropped }} / {{ metrics.framesDecoded }}</span>
    </div>
  </div>
</template>
