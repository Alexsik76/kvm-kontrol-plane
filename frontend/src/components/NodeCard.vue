<script setup lang="ts">


defineProps<{
  node: any
}>()

const emit = defineEmits(['delete-node'])

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'online': return 'success'
    case 'offline': return 'error'
    default: return 'warning'
  }
}
</script>

<template>
  <v-card class="h-100 d-flex flex-column mx-auto" max-width="640" elevation="4" hover rounded="xl" :to="{ name: 'node-stream', params: { id: node.id } }">
    <v-img
      v-if="node.screenshot"
      :src="node.screenshot"
      aspect-ratio="16/9"
      cover
      class="bg-black text-center"
    >
      <div class="fill-height d-flex align-center justify-center" style="background: rgba(0,0,0,0.4);">
        <v-btn variant="outlined" size="large" prepend-icon="mdi-play-circle" elevation="8" class="text-none font-weight-bold">
          Connect via WebRTC
        </v-btn>
      </div>
    </v-img>
    <v-sheet v-else :style="{ aspectRatio: '16/9' }" class="d-flex align-center justify-center bg-grey-darken-3 border-b">
      <div class="text-center">
        <v-icon icon="mdi-monitor-eye" size="64" class="text-grey-darken-1 mb-4"></v-icon>
        <div>
          <v-btn variant="outlined" size="large" prepend-icon="mdi-play-circle" elevation="4" class="text-none font-weight-bold">
            Connect via WebRTC
          </v-btn>
        </div>
      </div>
    </v-sheet>

    <v-card-item class="pt-4">
      <template v-slot:title>
        <div class="d-flex align-center font-weight-bold text-h6">
          <v-icon icon="mdi-raspberry-pi" size="large" class="mr-3 text-primary"></v-icon>
          {{ node.name }}
        </div>
      </template>
      <template v-slot:append>
        <v-chip
          :color="getStatusColor(node.status)"
          size="small"
          class="text-uppercase font-weight-bold mr-3"
          variant="outlined"
        >
          {{ node.status }}
        </v-chip>
        <v-btn
          icon="mdi-delete"
          variant="outlined"
          color="error"
          size="small"
          @click.prevent="emit('delete-node', node)"
        ></v-btn>
      </template>
    </v-card-item>

    <v-card-text class="flex-grow-1 pb-4">
      <div class="d-flex align-center mb-2">
        <v-icon icon="mdi-ip-network" size="small" class="mr-3 text-medium-emphasis"></v-icon>
        <span class="text-body-1">{{ node.internal_ip }}</span>
      </div>
      <div v-if="node.tunnel_url" class="d-flex align-center mb-2">
        <v-icon icon="mdi-cloud-lock" size="small" class="mr-3 text-primary"></v-icon>
        <span class="text-body-1 text-primary">{{ node.tunnel_url }}</span>
      </div>
      <div class="d-flex align-center mb-3">
        <v-icon icon="mdi-clock-outline" size="small" class="mr-3 text-medium-emphasis"></v-icon>
        <span class="text-body-2 text-medium-emphasis">
          Last Seen: {{ node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : 'Never' }}
        </span>
      </div>

      <!-- Display machine info JSON if available -->
      <div v-if="node.machine_info" class="mt-4 pa-3 bg-transparent border border-opacity-25 rounded">
        <div class="text-caption text-uppercase font-weight-bold text-primary mb-1">Hardware Specs</div>
        <div v-for="(val, key) in node.machine_info" :key="key" class="d-flex justify-space-between text-caption">
          <span class="text-medium-emphasis">{{ key }}</span>
          <span class="font-weight-medium">{{ val }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>
