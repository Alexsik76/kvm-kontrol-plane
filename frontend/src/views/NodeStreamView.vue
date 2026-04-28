<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import WebRTCPlayer from '../components/WebRTCPlayer.vue'
import FrontPanelControls from '../components/FrontPanelControls.vue'
import { useFrontPanel } from '../composables/useFrontPanel'
import type { KvmNode } from '../types/node'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const nodeId = route.params.id as string
const node = ref<KvmNode | null>(null)

const isHidCaptured = ref(false)

const {
  isConnected: fpConnected,
  pwrStatus,
  hddStatus,
  lastError: fpError,
  connect: fpConnect,
  disconnect: fpDisconnect,
  powerPress,
  powerHold,
  reset: fpReset,
  clearError: fpClearError,
} = useFrontPanel()

const nodeDomain = computed(() => {
  if (!node.value) return ''
  if (node.value.tunnel_url) {
    try {
      const url = new URL(node.value.tunnel_url)
      return url.host
    } catch {
      return node.value.tunnel_url.replace(/^https?:\/\//, '')
    }
  }
  return node.value.internal_ip || ''
})

// Values passed up from WebRTCPlayer component
const streamStatus = ref('Connecting...')
const connectionError = ref('')

const handleStreamStatus = (payload: { status: string, error: string }) => {
  streamStatus.value = payload.status
  connectionError.value = payload.error
}

// Fetch node details for the header
const fetchNodeDetails = async () => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBaseUrl}/api/v1/nodes/${nodeId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.accessToken}`
      }
    })

    if (response.ok) {
      node.value = await response.json()
      if (node.value!.has_front_panel) {
        fpConnect(nodeDomain.value, authStore.accessToken).catch((err) => {
          console.error('Front panel WebSocket connection failed:', err)
        })
      }
    } else {
      router.push({ name: 'dashboard' }) // Not found or no access
    }
  } catch (err) {
    console.error('Failed to load node details', err)
  }
}

onMounted(() => {
  fetchNodeDetails()
})

onUnmounted(() => {
  fpDisconnect()
})
</script>

<template>
  <v-layout class="bg-grey-darken-4" min-height="100vh">
    <v-app-bar color="surface" elevation="2">
      <v-btn icon="mdi-arrow-left" variant="text" @click="router.push({ name: 'dashboard' })"></v-btn>
      <v-app-bar-title class="font-weight-medium">
        {{ node?.name || 'Loading Node...' }}
        <span class="text-medium-emphasis text-body-2 ml-2">{{ node?.internal_ip }}</span>
      </v-app-bar-title>

      <v-spacer></v-spacer>

      <v-chip
        v-if="!connectionError"
        :color="streamStatus === 'Connected' ? 'success' : 'warning'"
        size="small"
        class="text-uppercase font-weight-bold mr-4"
        prepend-icon="mdi-video"
      >
        {{ streamStatus }}
      </v-chip>
      <v-chip
        v-else
        color="error"
        size="small"
        class="text-uppercase font-weight-bold mr-4"
        prepend-icon="mdi-alert-circle"
      >
        {{ streamStatus }}
      </v-chip>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-4 h-100">
        <v-row class="h-100 g-4">

          <!-- Extracted WebRTC Player -->
          <v-col cols="12" md="8" lg="9" class="d-flex flex-column h-100">
            <WebRTCPlayer
              :node-id="nodeId"
              :node-domain="nodeDomain"
              :node-ip="node?.internal_ip"
              @status-changed="handleStreamStatus"
              @capture-change="isHidCaptured = $event"
            />
          </v-col>

          <!-- Right sidebar -->
          <v-col cols="12" md="4" lg="3" class="d-flex flex-column" style="gap: 16px">
            <v-card elevation="2">
              <v-card-title class="border-b pa-4 d-flex align-center">
                <v-icon icon="mdi-keyboard" class="mr-2"></v-icon>
                Controls
              </v-card-title>

              <v-card-text class="pa-4">
                <v-alert :type="isHidCaptured ? 'success' : 'info'" variant="tonal" class="mb-4">
                  {{ isHidCaptured ? 'HID Capture Active' : 'HID Control Ready' }}
                </v-alert>

                <p class="text-body-2 text-medium-emphasis">
                  Click on the video player to focus it. Keyboard and mouse events will be captured and proxied directly to the KVM node. Use <b>ESC</b> to release focus and unlock the mouse. For a full immersive experience, use <b>Professional Mode</b> (Fullscreen), where <b>ESC</b> works natively. In windowed mode, use <b>Alt+`</b> to send Escape.
                </p>
              </v-card-text>
            </v-card>

            <FrontPanelControls
              v-if="node?.has_front_panel"
              :is-connected="fpConnected"
              :pwr-status="pwrStatus"
              :hdd-status="hddStatus"
              :last-error="fpError"
              @power-press="powerPress()"
              @power-hold="powerHold()"
              @reset="fpReset()"
              @clear-error="fpClearError()"
            />
          </v-col>

        </v-row>
      </v-container>
    </v-main>
  </v-layout>
</template>
