<script setup lang="ts">
import { ref, watch, computed, toRef, onMounted, onBeforeUnmount } from 'vue'
import type { VideoStatus } from '../composables/useFrontPanel'
import { useWebRTC } from '../composables/useWebRTC'
import { useHID } from '../composables/useHID'
import { usePlayerInput } from '../composables/usePlayerInput'
import { useDiagnostics } from '../composables/useDiagnostics'
import { resetKeyboardState } from '../utils/hid'
import WebRTCCaptureOverlay from './WebRTCCaptureOverlay.vue'
import WebRTCStatusOverlay from './WebRTCStatusOverlay.vue'
import DiagnosticsOverlay from './DiagnosticsOverlay.vue'

const props = defineProps<{
  nodeId: string
  nodeDomain: string
  videoStatus?: VideoStatus
}>()

const emit = defineEmits<{
  (e: 'status-changed', payload: { status: string, error: string }): void
  (e: 'capture-change', captured: boolean): void
}>()

const nodeId = toRef(props, 'nodeId')
const nodeDomain = toRef(props, 'nodeDomain')

const {
  videoRef,
  loading,
  connectionError,
  streamStatus,
  startStream,
  peerConnection,
} = useWebRTC(nodeId)

const {
  isHidConnected,
  sendHIDMessage,
  connectHID,
  wakeHost,
  lastPong,
} = useHID(nodeDomain, () => {
  // Reset local state when backend NACKs a write failure
  sendHIDMessage(resetKeyboardState())
})

const isCaptured = ref(false)
const {
  startCapture,
  stopCapture,
  toggleFullscreen,
  handleMouseMove,
  handleMouseDown,
  handleMouseUp,
  handleWheel,
  handleContextMenu,
  isFullscreen,
  sendCtrlAltDel,
  showProPanel,
  reLock
} = usePlayerInput(videoRef, isCaptured, sendHIDMessage, emit, connectHID)

// === Watchers ===
watch([streamStatus, connectionError], ([status, error]) => {
  emit('status-changed', { status: status as string, error: (error as string) || '' })
})

watch(() => props.videoStatus, (next, prev) => {
  if (prev === 'inactive' && next === 'active') {
    startStream()
  }
})

// === Wake ===
const isWaking = ref(false)
const snackbarVisible = ref(false)
const snackbarMessage = ref('')
const snackbarColor = ref<'success' | 'error'>('success')

const handleWake = async () => {
  if (isWaking.value) return
  isWaking.value = true
  const result = await wakeHost()
  if (result.ok) {
    snackbarMessage.value = 'Wake signal sent'
    snackbarColor.value = 'success'
  } else {
    snackbarMessage.value = `Wake failed: ${result.error ?? 'unknown error'}`
    snackbarColor.value = 'error'
  }
  snackbarVisible.value = true
  setTimeout(() => { isWaking.value = false }, 2000)
}

// === Diagnostics ===
const debugEnabled = computed(() =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1'
)

const { metrics } = useDiagnostics(peerConnection, sendHIDMessage, lastPong, debugEnabled)

// === Global Keydown for Wake ===
const handleGlobalKeyDown = (_e: KeyboardEvent) => {
  if (connectionError.value && !loading.value) {
    handleWake()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown)
})


defineExpose({ startCapture, stopCapture })
</script>

<template>
  <v-card class="flex-grow-1 bg-black rounded-lg overflow-hidden position-relative h-100" elevation="6">
    <!-- HID Capture Controls Overlay -->
    <WebRTCCaptureOverlay 
      :is-hid-connected="isHidConnected"
      :is-captured="isCaptured"
      :is-fullscreen="isFullscreen"
      :show-pro-panel="showProPanel"
      @start-capture="startCapture"
      @stop-capture="stopCapture"
      @toggle-fullscreen="toggleFullscreen"
      @send-ctrl-alt-del="sendCtrlAltDel"
      @re-lock="reLock"
    />

    <!-- Video Element -->
    <video
      ref="videoRef"
      autoplay
      playsinline
      muted
      tabindex="0"
      @mousemove="handleMouseMove"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @wheel="handleWheel"
      @contextmenu="handleContextMenu"
      class="w-100 h-100"
      :style="{ 
        objectFit: 'contain', 
        background: '#000', 
        outline: 'none', 
        cursor: (isCaptured && !showProPanel) ? 'none' : 'default' 
      }"
    ></video>

    <!-- Error & Loading Status Overlay -->
    <WebRTCStatusOverlay
      :loading="loading"
      :connection-error="connectionError || null"
      :stream-status="streamStatus"
      :is-waking="isWaking"
      :video-status="props.videoStatus ?? 'unknown'"
      @retry="startStream"
      @wake="handleWake"
    />

    <DiagnosticsOverlay v-if="debugEnabled" :metrics="metrics" />

    <v-snackbar
      v-model="snackbarVisible"
      :color="snackbarColor"
      location="bottom right"
      :timeout="3000"
    >
      {{ snackbarMessage }}
    </v-snackbar>
  </v-card>
</template>