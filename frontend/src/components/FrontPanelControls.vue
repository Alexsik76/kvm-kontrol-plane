<script setup lang="ts">
import { ref, computed } from 'vue'

type PwrStatus = 'unknown' | 'off' | 'on' | 'blinking'
type HddStatus = 'unknown' | 'idle' | 'active'

const props = defineProps<{
  isConnected: boolean
  pwrStatus: PwrStatus
  hddStatus: HddStatus
  lastError: string | null
}>()

const emit = defineEmits<{
  (e: 'power-press'): void
  (e: 'power-hold'): void
  (e: 'reset'): void
  (e: 'clear-error'): void
}>()

// Force-off double confirm state
const forceOffState = ref<'idle' | 'pending'>('idle')
const forceOffCountdown = ref(3)
let countdownInterval: ReturnType<typeof setInterval> | null = null

const handleForceOff = () => {
  if (forceOffState.value === 'idle') {
    forceOffState.value = 'pending'
    forceOffCountdown.value = 3
    countdownInterval = setInterval(() => {
      forceOffCountdown.value--
      if (forceOffCountdown.value <= 0) {
        clearInterval(countdownInterval!)
        countdownInterval = null
        forceOffState.value = 'idle'
      }
    }, 1000)
  } else {
    if (countdownInterval !== null) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
    forceOffState.value = 'idle'
    emit('power-hold')
  }
}

const handleReset = () => {
  if (confirm('Reset target PC?')) {
    emit('reset')
  }
}

const pwrLedClass = computed(() => `fp-led--${props.pwrStatus}`)
const hddLedClass = computed(() => `fp-led--${props.hddStatus}`)
</script>

<template>
  <v-card elevation="2">
    <v-card-title class="border-b pa-4 d-flex align-center">
      <v-icon icon="mdi-chip" class="mr-2"></v-icon>
      Front Panel
    </v-card-title>

    <v-card-text class="pa-4">
      <!-- Connection status -->
      <div class="d-flex align-center mb-4">
        <v-progress-circular
          v-if="!isConnected"
          indeterminate
          size="14"
          width="2"
          color="warning"
          class="mr-2"
        ></v-progress-circular>
        <v-icon v-else icon="mdi-check-circle" color="success" size="small" class="mr-2"></v-icon>
        <span class="text-caption text-medium-emphasis">
          {{ isConnected ? 'Connected' : 'Connecting...' }}
        </span>
      </div>

      <!-- LED indicators -->
      <div class="d-flex align-center mb-4">
        <div class="d-flex align-center mr-6">
          <div class="fp-led" :class="pwrLedClass"></div>
          <span class="text-caption font-weight-bold ml-2">
            PWR<span v-if="pwrStatus === 'unknown'" class="text-medium-emphasis"> ?</span>
          </span>
        </div>
        <div class="d-flex align-center">
          <div class="fp-led" :class="hddLedClass"></div>
          <span class="text-caption font-weight-bold ml-2">
            HDD<span v-if="hddStatus === 'unknown'" class="text-medium-emphasis"> ?</span>
          </span>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="d-flex flex-column" style="gap: 8px">
        <v-btn
          block
          variant="tonal"
          color="primary"
          prepend-icon="mdi-power"
          :disabled="!isConnected"
          @click="emit('power-press')"
        >
          Power
        </v-btn>

        <v-btn
          block
          variant="tonal"
          color="warning"
          prepend-icon="mdi-restart"
          :disabled="!isConnected"
          @click="handleReset"
        >
          Reset
        </v-btn>

        <v-btn
          block
          :variant="forceOffState === 'pending' ? 'flat' : 'tonal'"
          color="error"
          prepend-icon="mdi-power-off"
          :disabled="!isConnected"
          @click="handleForceOff"
        >
          {{ forceOffState === 'pending'
            ? `Click again to force off (${forceOffCountdown}s)`
            : 'Force off' }}
        </v-btn>
      </div>

      <!-- Error notification -->
      <v-alert
        v-if="lastError"
        type="error"
        variant="tonal"
        density="compact"
        closable
        class="mt-3"
        @click:close="emit('clear-error')"
      >
        {{ lastError }}
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.fp-led {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.fp-led--unknown,
.fp-led--off,
.fp-led--idle {
  background-color: #616161;
}

.fp-led--on {
  background-color: #4caf50;
}

.fp-led--blinking {
  background-color: #ffc107;
  animation: fp-blink 1s ease-in-out infinite;
}

.fp-led--active {
  background-color: #f44336;
  animation: fp-pulse 0.5s ease-in-out infinite;
}

@keyframes fp-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

@keyframes fp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
