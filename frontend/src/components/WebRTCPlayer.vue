<script setup lang="ts">
import { ref, watch, toRef, onBeforeUnmount } from 'vue'
import { createKeyboardEventMessage, createMouseEventMessage } from '../utils/hid'
import { useWebRTC } from '../composables/useWebRTC'
import { useHID } from '../composables/useHID'

const props = defineProps<{
  nodeId: string
  nodeIp?: string
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
  sendHIDMessage
} = useHID(nodeId)

const isCaptured = ref(false)

// === Event Handlers for HID ===
const handleKeyDown = (e: KeyboardEvent) => {
  if (!isCaptured.value) return
  
  console.log('Key Down:', e.code)
  
  // Allow browser shortcuts
  if (['F5', 'F12'].includes(e.code)) return
  
  // Custom exit shortcut: Shift + Escape
  if (e.code === 'Escape' && e.shiftKey) {
    e.preventDefault()
    stopCapture()
    return
  }

  e.preventDefault()
  const msg = createKeyboardEventMessage(e, true)
  if (msg) sendHIDMessage(msg)
}

const handleKeyUp = (e: KeyboardEvent) => {
  if (!isCaptured.value) return
  if (['F5', 'F12'].includes(e.code)) return
  if (e.code === 'Escape' && e.shiftKey) return 

  e.preventDefault()
  const msg = createKeyboardEventMessage(e, false)
  if (msg) sendHIDMessage(msg)
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isCaptured.value || !videoRef.value) return
  e.preventDefault()
  
  if (e.movementX === 0 && e.movementY === 0) return

  const scaleX = videoRef.value.videoWidth / videoRef.value.clientWidth
  const scaleY = videoRef.value.videoHeight / videoRef.value.clientHeight

  const adjustedX = Math.round(e.movementX * scaleX)
  const adjustedY = Math.round(e.movementY * scaleY)

  const msg = createMouseEventMessage(e.buttons, adjustedX, adjustedY, 0)
  sendHIDMessage(msg)
}

const handleMouseDown = (e: MouseEvent) => {
  if (!isCaptured.value) return
  e.preventDefault()
  const msg = createMouseEventMessage(e.buttons, 0, 0, 0)
  sendHIDMessage(msg)
}

const handleMouseUp = (e: MouseEvent) => {
  if (!isCaptured.value) return
  e.preventDefault()
  const msg = createMouseEventMessage(e.buttons, 0, 0, 0)
  sendHIDMessage(msg)
}

const handleWheel = (e: WheelEvent) => {
  if (!isCaptured.value) return
  e.preventDefault()
  const wheelVal = e.deltaY > 0 ? -1 : 1
  const msg = createMouseEventMessage(e.buttons, 0, 0, wheelVal)
  sendHIDMessage(msg)
}

// Disable context menu on the video element to prevent Right-click blocking
const handleContextMenu = (e: Event) => {
  e.preventDefault()
}

// === Capture Control ===
const startCapture = () => {
  isCaptured.value = true
  emit('capture-change', true)
  videoRef.value?.focus()
  
  // Use Pointer Lock to keep mouse inside
  try {
    videoRef.value?.requestPointerLock()
  } catch (err) {
    console.error('Pointer Lock failed:', err)
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
}

const stopCapture = () => {
  if (!isCaptured.value) return
  isCaptured.value = false
  emit('capture-change', false)
  
  if (document.pointerLockElement === videoRef.value) {
    document.exitPointerLock()
  }

  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
}

const handlePointerLockChange = () => {
  if (document.pointerLockElement !== videoRef.value && isCaptured.value) {
    // If pointer lock is lost (e.g. by pressing ESC), stop capture
    stopCapture()
  }
}

// === Watchers & Lifecycle ===
watch([streamStatus, connectionError], ([status, error]) => {
  emit('status-changed', { status, error })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerlockchange', handlePointerLockChange)
  stopCapture()
})

const initCapture = () => {
  document.addEventListener('pointerlockchange', handlePointerLockChange)
}

// Initialize on component logic start
initCapture()

defineExpose({ startCapture, stopCapture })
</script>

<template>
  <v-card class="flex-grow-1 bg-black rounded-lg overflow-hidden position-relative h-100" elevation="6">
    <div 
      v-if="isHidConnected" 
      class="position-absolute text-caption px-3 py-1 rounded bg-black border"
      :class="isCaptured ? 'border-success text-success' : 'border-grey text-grey'"
      style="top: 8px; right: 8px; z-index: 20; opacity: 0.9;"
    >
      <v-icon icon="mdi-keyboard" size="small" class="mr-1"></v-icon>
      <v-icon icon="mdi-mouse" size="small" class="mr-2"></v-icon>
      <span v-if="isCaptured" class="font-weight-bold">HID Capture Active — Shift+ESC to Unlock</span>
      <span v-else>HID Ready</span>
    </div>

    <div
      v-if="isHidConnected && !isCaptured"
      class="position-absolute d-flex flex-column align-center justify-center w-100 h-100"
      style="top: 0; left: 0; z-index: 10; background: rgba(0,0,0,0.5); cursor: pointer; backdrop-filter: grayscale(80%);"
      @click="startCapture"
    >
      <v-icon icon="mdi-cursor-default-click" size="64" color="white" class="mb-4"></v-icon>
      <div class="text-h5 text-white font-weight-bold">Click to Control</div>
      <div class="text-body-1 text-grey-lighten-2 mt-2">Mouse will be locked. Press <strong>Shift+ESC</strong> to exit</div>
    </div>

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
      :style="{ objectFit: 'contain', background: '#000', outline: 'none', cursor: isCaptured ? 'none' : 'crosshair' }"
    ></video>

    <div
      v-if="loading || connectionError"
      class="position-absolute d-flex flex-column align-center justify-center w-100 h-100"
      style="top: 0; left: 0; background: rgba(0,0,0,0.7); z-index: 10;"
    >
      <v-progress-circular
        v-if="loading"
        indeterminate
        color="primary"
        size="64"
        class="mb-4"
      ></v-progress-circular>
      
      <v-icon
        v-if="connectionError"
        icon="mdi-video-off"
        color="error"
        size="64"
        class="mb-4"
      ></v-icon>
      
      <h3 class="text-h6 font-weight-medium text-white">{{ streamStatus }}</h3>
      <p v-if="connectionError" class="text-body-1 text-error mt-2">{{ connectionError }}</p>
      
      <v-btn
        v-if="connectionError"
        color="primary"
        variant="flat"
        prepend-icon="mdi-reload"
        class="mt-6"
        @click="startStream"
      >
        Retry Connection
      </v-btn>
    </div>
  </v-card>
</template>