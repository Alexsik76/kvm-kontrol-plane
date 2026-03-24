<script setup lang="ts">
defineProps<{
  loading: boolean
  connectionError: string | null
  streamStatus: string
}>()

defineEmits<{
  (e: 'retry'): void
  (e: 'wake'): void
}>()
</script>

<template>
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
    
    <div v-if="connectionError" class="d-flex mt-6" style="gap: 16px;">
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-reload"
        @click="$emit('retry')"
      >
        Retry Connection
      </v-btn>

      <v-btn
        color="success"
        variant="elevated"
        prepend-icon="mdi-power-sleep"
        @click="$emit('wake')"
      >
        Wake Host
      </v-btn>
    </div>
  </div>
</template>
