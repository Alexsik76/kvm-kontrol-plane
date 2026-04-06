<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const emit = defineEmits(['node-added'])
const authStore = useAuthStore()

const dialogOpen = ref(false)
const loading = ref(false)
const error = ref('')
const newNode = ref({
  name: '',
  internal_ip: '',
  tunnel_url: '',
  ws_port: 8080,
  mediamtx_api_port: 30000,
  stream_name: 'kvm',
  mediamtx_user: '',
  mediamtx_pass: ''
})

const machineInfoList = ref<{key: string, value: string}[]>([])

const addMachineInfoField = () => {
  machineInfoList.value.push({ key: '', value: '' })
}

const removeMachineInfoField = (index: number) => {
  machineInfoList.value.splice(index, 1)
}

const submitNode = async () => {
  error.value = ''
  loading.value = true
  
  let machineInfoObj: any = null
  if (machineInfoList.value.length > 0) {
    machineInfoObj = {}
    for (const item of machineInfoList.value) {
      const k = item.key.trim()
      const v = item.value.trim()
      if (k && v) {
        machineInfoObj[k] = v
      }
    }
    if (Object.keys(machineInfoObj).length === 0) {
      machineInfoObj = null
    }
  }
  
  try {
    const payload = {
      name: newNode.value.name,
      internal_ip: newNode.value.internal_ip,
      tunnel_url: newNode.value.tunnel_url,
      ws_port: newNode.value.ws_port,
      mediamtx_api_port: newNode.value.mediamtx_api_port,
      stream_name: newNode.value.stream_name,
      mediamtx_user: newNode.value.mediamtx_user,
      mediamtx_pass: newNode.value.mediamtx_pass,
      ...(machineInfoObj && { machine_info: machineInfoObj })
    }

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBaseUrl}/api/v1/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.accessToken}`
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.detail || 'Failed to create node')
    }
    
    dialogOpen.value = false
    newNode.value = { 
      name: '', 
      internal_ip: '', 
      tunnel_url: '', 
      ws_port: 8080, 
      mediamtx_api_port: 9997, 
      stream_name: 'kvm',
      mediamtx_user: '',
      mediamtx_pass: ''
    }
    machineInfoList.value = []
    emit('node-added') // Tell parent to refresh
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog v-model="dialogOpen" max-width="500">
    <template v-slot:activator="{ props }">
      <v-btn color="primary" prepend-icon="mdi-plus" variant="flat" v-bind="props">
        Add Node
      </v-btn>
    </template>
    
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center justify-space-between pa-4 border-b">
        <span>Add KVM Node</span>
        <v-btn icon="mdi-close" variant="text" @click="dialogOpen = false"></v-btn>
      </v-card-title>
      
      <v-card-text class="pt-4">
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
          {{ error }}
        </v-alert>
        
        <v-form :disabled="loading">
          <v-text-field v-model="newNode.name" label="Node Name" variant="outlined" density="comfortable" class="mb-2" required hint="e.g. Server-Room-Rack-1"></v-text-field>
          <v-text-field v-model="newNode.internal_ip" label="Internal IP" variant="outlined" density="comfortable" class="mb-2" required hint="e.g. 10.8.0.10"></v-text-field>
          <v-text-field v-model="newNode.tunnel_url" label="Tunnel URL (Cloudflare)" variant="outlined" density="comfortable" class="mb-2" hint="e.g. https://pi4.lab.vn.ua"></v-text-field>
          <v-text-field v-model="newNode.stream_name" label="Stream Name (MediaMTX Path)" variant="outlined" density="comfortable" class="mb-2" required hint="e.g. kvm"></v-text-field>

          <v-row mb-0>
            <v-col cols="6">
              <v-text-field v-model="newNode.mediamtx_user" label="MediaMTX User" variant="outlined" density="comfortable" class="mb-2" required></v-text-field>
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="newNode.mediamtx_pass" label="MediaMTX Password" variant="outlined" density="comfortable" class="mb-2" required type="password"></v-text-field>
            </v-col>
          </v-row>
          
          <v-row mb-0>
            <v-col cols="6">
              <v-text-field v-model.number="newNode.ws_port" label="WebSocket Port" type="number" variant="outlined" density="comfortable" required></v-text-field>
            </v-col>
            <v-col cols="6">
              <v-text-field v-model.number="newNode.mediamtx_api_port" label="MediaMTX WebRTC Port" type="number" variant="outlined" density="comfortable" required></v-text-field>
            </v-col>
          </v-row>

          <div class="mt-4">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-subtitle-2 text-medium-emphasis">Hardware Specs (Optional)</span>
              <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-plus" @click="addMachineInfoField">Add Field</v-btn>
            </div>
            
            <div class="d-flex flex-column gap-2 mb-2">
              <v-row v-for="(field, index) in machineInfoList" :key="index" dense align="center">
                <v-col cols="5">
                  <v-text-field v-model="field.key" label="Property (e.g. CPU)" variant="outlined" density="compact" hide-details></v-text-field>
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="field.value" label="Value (e.g. Ryzen 9)" variant="outlined" density="compact" hide-details></v-text-field>
                </v-col>
                <v-col cols="1" class="text-center">
                  <v-btn icon="mdi-close" variant="text" size="small" color="error" @click="removeMachineInfoField(index)"></v-btn>
                </v-col>
              </v-row>
            </div>
            
            <div v-if="machineInfoList.length === 0" class="text-caption text-medium-emphasis text-center py-3 bg-surface-variant rounded border">
              No custom hardware specifications added.
            </div>
          </div>
        </v-form>
      </v-card-text>
      
      <v-card-actions class="pa-4 border-t bg-surface-variant">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="dialogOpen = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="loading" @click="submitNode">Confirm</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
