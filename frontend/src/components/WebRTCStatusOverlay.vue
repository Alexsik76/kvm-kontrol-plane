<script setup lang="ts">
defineProps<{
  loading: boolean
  connectionError: string | null
  streamStatus: string
  isWaking: boolean
  videoStatus: 'unknown' | 'active' | 'inactive'
}>()

defineEmits<{
  (e: 'retry'): void
  (e: 'wake'): void
}>()
</script>

<template>
  <div
    v-if="loading || connectionError || videoStatus === 'inactive'"
    class="position-absolute d-flex flex-column align-center justify-center w-100 h-100"
    style="top: 0; left: 0; background: rgba(0,0,0,0.7); z-index: 10;"
  >
    <!-- Priority 1: No HDMI signal -->
    <template v-if="videoStatus === 'inactive'">
      <v-icon
        icon="mdi-monitor-off"
        color="warning"
        size="64"
        class="mb-4"
      ></v-icon>
      <h3 class="text-h6 font-weight-medium text-white">No HDMI Signal</h3>
      <p class="text-body-1 text-medium-emphasis mt-2 text-center" style="max-width: 360px;">
        The host is not outputting any video. It may be powered off, sleeping, or the HDMI cable may be unplugged.
      </p>
      <div class="d-flex mt-6">
        <v-btn
          color="success"
          variant="elevated"
          prepend-icon="mdi-power-sleep"
          :disabled="isWaking"
          :loading="isWaking"
          @click="$emit('wake')"
        >
          {{ isWaking ? 'Waking up...' : 'Wake Host' }}
        </v-btn>
      </div>
    </template>

    <!-- Priority 2: Loading / connecting -->
    <template v-else-if="loading">
      <v-progress-circular
        indeterminate
        color="primary"
        size="64"
        class="mb-4"
      ></v-progress-circular>
      <h3 class="text-h6 font-weight-medium text-white">{{ streamStatus }}</h3>
    </template>

    <!-- Priority 3: Connection error -->
    <template v-else-if="connectionError">
      <v-icon
        icon="mdi-video-off"
        color="error"
        size="64"
        class="mb-4"
      ></v-icon>
      <h3 class="text-h6 font-weight-medium text-white">{{ streamStatus }}</h3>
      <p class="text-body-1 text-error mt-2">{{ connectionError }}</p>
      <div class="d-flex mt-6" style="gap: 16px;">
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
          :disabled="isWaking"
          :loading="isWaking"
          @click="$emit('wake')"
        >
          {{ isWaking ? 'Waking up...' : 'Wake Host' }}
        </v-btn>
      </div>
    </template>
  </div>
</template>
