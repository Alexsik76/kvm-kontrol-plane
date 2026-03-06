<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import AddNodeDialog from '../components/AddNodeDialog.vue'
import NodeCard from '../components/NodeCard.vue'

const authStore = useAuthStore()
const router = useRouter()

const nodes = ref<any[]>([])
const loading = ref(true)

const fetchNodes = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/v1/nodes', {
      headers: {
        'Authorization': `Bearer ${authStore.accessToken}`
      }
    })
    
    if (response.status === 401) {
      handleLogout()
      return
    }
    
    if (response.ok) {
      nodes.value = await response.json()
    }
  } catch (err) {
    console.error('Failed to fetch nodes:', err)
  } finally {
    loading.value = false
  }
}

const deleteDialogOpen = ref(false)
const nodeToDelete = ref<any>(null)
const deleting = ref(false)

const confirmDelete = (node: any) => {
  nodeToDelete.value = node
  deleteDialogOpen.value = true
}

const performDelete = async () => {
  if (!nodeToDelete.value) return
  deleting.value = true
  try {
    const response = await fetch(`/api/v1/nodes/${nodeToDelete.value.id}`, {
      method: 'DELETE',
      headers: {
         'Authorization': `Bearer ${authStore.accessToken}`
      }
    })
    if (!response.ok) {
      throw new Error('Failed to delete node')
    }
    deleteDialogOpen.value = false
    fetchNodes()
  } catch (err) {
    console.error('Failed to delete node:', err)
  } finally {
    deleting.value = false
    nodeToDelete.value = null
  }
}

const handleLogout = () => {
  authStore.logout()
  router.push({ name: 'login' })
}

onMounted(() => {
  fetchNodes()
})
</script>

<template>
  <v-layout class="bg-grey-darken-4" min-height="100vh">
    <v-app-bar color="surface" elevation="2">
      <v-app-bar-title class="font-weight-bold text-primary">IP-KVM Nodes</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn icon="mdi-refresh" @click="fetchNodes" :loading="loading" class="mr-2"></v-btn>
      <v-btn prepend-icon="mdi-logout" variant="tonal" color="error" @click="handleLogout">
        Logout
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container maxWidth="1200" class="py-8">
        <div class="d-flex align-center justify-space-between mb-6">
          <h2 class="text-h5 font-weight-medium">Registered Devices</h2>
          
          <!-- Extracted Add Node Component -->
          <AddNodeDialog @node-added="fetchNodes" />
        </div>

        <v-row v-if="loading && nodes.length === 0">
          <v-col cols="12" class="text-center py-12">
            <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
          </v-col>
        </v-row>

        <v-row v-else-if="nodes.length === 0">
          <v-col cols="12">
            <v-empty-state
              icon="mdi-expansion-card-variant"
              title="No KVM Nodes found"
              text="You haven't registered any Raspberry Pi nodes yet."
              class="bg-surface rounded-lg elevation-1"
            ></v-empty-state>
          </v-col>
        </v-row>

        <v-row v-else justify="center">
          <v-col v-for="node in nodes" :key="node.id" cols="10" sm="8" md="6" lg="5">
            <NodeCard :node="node" @delete-node="confirmDelete" />
          </v-col>
        </v-row>
      </v-container>

      <!-- Delete Confirmation Dialog -->
      <v-dialog v-model="deleteDialogOpen" max-width="400">
        <v-card rounded="lg">
          <v-card-title class="text-h6 pt-4 px-4 bg-error text-white d-flex align-center">
            <v-icon icon="mdi-alert-circle" class="mr-2"></v-icon>
            Delete Node
          </v-card-title>
          <v-card-text class="pt-6 px-4 text-body-1">
            Are you sure you want to delete <strong>{{ nodeToDelete?.name }}</strong>? This action cannot be undone.
          </v-card-text>
          <v-card-actions class="pa-4 bg-surface-variant border-t">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="deleteDialogOpen = false" :disabled="deleting">Cancel</v-btn>
            <v-btn color="error" variant="flat" :loading="deleting" @click="performDelete">Delete</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-main>
  </v-layout>
</template>
