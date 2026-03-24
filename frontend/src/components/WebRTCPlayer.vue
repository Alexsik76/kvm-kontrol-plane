<script setup lang="ts">
import { ref, watch, toRef, onMounted, onBeforeUnmount } from 'vue'
import { useWebRTC } from '../composables/useWebRTC'
import { useHID } from '../composables/useHID'
import { usePlayerInput } from '../composables/usePlayerInput'
import { resetKeyboardState } from '../utils/hid'
import WebRTCCaptureOverlay from './WebRTCCaptureOverlay.vue'
import WebRTCStatusOverlay from './WebRTCStatusOverlay.vue'

const props = defineProps<{
  nodeId: string
}>()

const emit = defineEmits<{
  (e: 'status-changed', payload: { status: string, error: string }): void
  (e: 'capture-change', captured: boolean): void
}>()

const nodeId = toRef(props, 'nodeId')

const {
  videoRef,
  loading,
  connectionError,
  streamStatus,
  startStream
} = useWebRTC(nodeId)

const {
  isHidConnected,
  sendHIDMessage,
  connectHID,
  wakeHost
} = useHID(nodeId, () => {
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

// === Global Keydown for Wake ===
const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (connectionError.value && !loading.value) {
    console.log('Key pressed during connection error, sending wake signal...')
    wakeHost()
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
      @retry="startStream"
      @wake="wakeHost"
    />
  </v-card>
</template>