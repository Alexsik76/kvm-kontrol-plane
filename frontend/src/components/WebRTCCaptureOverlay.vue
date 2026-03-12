<script setup lang="ts">
defineProps<{
  isHidConnected: boolean
  isCaptured: boolean
  isFullscreen: boolean
  showProPanel: boolean
}>()

defineEmits<{
  (e: 'start-capture'): void
  (e: 'stop-capture'): void
  (e: 'toggle-fullscreen'): void
  (e: 'send-ctrl-alt-del'): void
  (e: 're-lock'): void
}>()
</script>

<template>
  <div 
    v-if="isHidConnected" 
    class="position-absolute text-caption px-3 py-1 rounded bg-black border"
    :class="isCaptured ? 'border-success text-success' : 'border-grey text-grey'"
    style="top: 8px; right: 8px; z-index: 20; opacity: 0.9; transition: opacity 0.3s;"
    :style="{ opacity: isFullscreen && isCaptured && !showProPanel ? 0 : 0.9 }"
  >
    <v-icon icon="mdi-keyboard" size="small" class="mr-1"></v-icon>
    <v-icon icon="mdi-mouse" size="small" class="mr-2"></v-icon>
    <span v-if="isCaptured" class="font-weight-bold">
      HID Capture Active — 
      <template v-if="isFullscreen">Alt+P for Menu</template>
      <template v-else>ESC to Unlock</template>
    </span>
    <span v-else>HID Ready</span>
  </div>

  <!-- Professional Mode: Top Slide-Down Control Panel -->
  <div
    v-if="isFullscreen && isCaptured"
    class="pro-panel-container"
    :class="{ 'panel-active': showProPanel }"
  >
    <div class="pro-panel-content d-flex align-center px-4 py-2 rounded-b-lg">
      <div class="d-flex align-center mr-4">
        <v-icon icon="mdi-remote-desktop" color="success" size="small" class="mr-2"></v-icon>
        <span class="text-caption font-weight-bold text-white">PROFESSIONAL KVM MODE</span>
      </div>
      
      <v-divider vertical class="mx-2"></v-divider>
      
      <v-btn 
        variant="tonal" 
        size="small" 
        color="warning" 
        class="mx-1" 
        prepend-icon="mdi-keyboard-variant"
        @click="$emit('send-ctrl-alt-del'); $emit('re-lock')"
      >
        Ctrl+Alt+Del
      </v-btn>

      <v-spacer></v-spacer>

      <v-btn 
        variant="text" 
        size="small" 
        color="grey-lighten-1" 
        icon="mdi-close"
        class="mr-2"
        @click="$emit('re-lock')"
      ></v-btn>

      <v-btn 
        variant="flat" 
        size="small" 
        color="error" 
        prepend-icon="mdi-fullscreen-exit"
        @click="$emit('toggle-fullscreen'); $emit('re-lock')"
      >
        Exit Fullscreen
      </v-btn>
    </div>
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
    <div class="text-body-1 text-grey-lighten-2 mt-2">Mouse will be locked. Press <strong>ESC</strong> to exit</div>
    
    <div class="d-flex mt-4">
      <v-btn color="primary" class="mr-3" @click.stop="$emit('start-capture')">
        Windowed Mode
      </v-btn>
      <v-btn color="success" variant="outlined" prepend-icon="mdi-fullscreen" @click.stop="$emit('toggle-fullscreen'); $emit('start-capture')">
        Professional Mode (Fullscreen)
      </v-btn>
    </div>

    <div class="text-caption text-grey-lighten-1 mt-4">
       Alt+P for Menu in Fullscreen | Alt + ` for Escape in Windowed
    </div>
  </div>
</template>

<style scoped>
.pro-panel-container {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: auto;
  min-width: 600px;
  pointer-events: none; /* Let clicks pass through when panel is up */
}

.panel-active {
  pointer-events: auto !important;
}

.pro-panel-content {
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: none;
  transform: translateY(-100%);
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 50px rgba(0, 0, 0, 0.8);
}

.panel-active .pro-panel-content {
  transform: translateY(0) !important;
}
</style>
