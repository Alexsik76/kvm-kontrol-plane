<script setup lang="ts">
defineProps<{
  isHidConnected: boolean
  isCaptured: boolean
}>()

defineEmits<{
  (e: 'start-capture'): void
}>()
</script>

<template>
  <!-- Top Right Badge -->
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

  <!-- Center Click to Control -->
  <div
    v-if="isHidConnected && !isCaptured"
    class="position-absolute d-flex flex-column align-center justify-center w-100 h-100"
    style="top: 0; left: 0; z-index: 10; background: rgba(0,0,0,0.5); cursor: pointer; backdrop-filter: grayscale(80%);"
    @click="$emit('start-capture')"
  >
    <v-icon icon="mdi-cursor-default-click" size="64" color="white" class="mb-4"></v-icon>
    <div class="text-h5 text-white font-weight-bold">Click to Control</div>
    <div class="text-body-1 text-grey-lighten-2 mt-2">Mouse will be locked. Press <strong>Shift+ESC</strong> to exit</div>
  </div>
</template>
