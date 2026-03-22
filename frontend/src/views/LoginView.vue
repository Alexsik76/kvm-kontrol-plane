<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

const handleLogin = async () => {
  errorMsg.value = ''
  loading.value = true

  try {
    const formData = new URLSearchParams()
    formData.append('username', username.value)
    formData.append('password', password.value)

    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Login failed')
    }

    // Save tokens and update state
    authStore.setTokens(data.access_token, data.refresh_token)
    
    // Navigate to dashboard
    router.push({ name: 'dashboard' })
  } catch (err: any) {
    errorMsg.value = err.message || 'An error occurred during login.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-layout class="bg-grey-darken-4" min-height="100vh">
    <v-main class="d-flex align-center justify-center">
      <v-card class="pa-6" width="100%" max-width="400" elevation="8" rounded="lg">
        <div class="text-center mb-6">
          <v-icon icon="mdi-shield-lock" size="48" color="primary" class="mb-2"></v-icon>
          <h1 class="text-h5 font-weight-bold">Control Plane Login</h1>
          <p class="text-body-2 text-medium-emphasis">Enter your superuser credentials</p>
        </div>

        <v-alert
          v-if="errorMsg"
          type="error"
          variant="tonal"
          class="mb-4"
          closable
          @click:close="errorMsg = ''"
        >
          {{ errorMsg }}
        </v-alert>

        <v-form :disabled="loading">
          <v-text-field
            v-model="username"
            label="Username"
            id="username"
            name="username"
            prepend-inner-icon="mdi-account"
            variant="outlined"
            class="mb-2"
            autofocus
            required
            @keyup.enter="handleLogin"
          ></v-text-field>

          <v-text-field
            v-model="password"
            id="password"
            name="password"
            autocomplete="current-password"
            label="Password"
            type="password"
            prepend-inner-icon="mdi-lock"
            variant="outlined"
            class="mb-6"
            required
            @keyup.enter="handleLogin"
          ></v-text-field>

          <v-btn
            color="primary"
            size="large"
            block
            :loading="loading"
            elevation="2"
            @click="handleLogin"
          >
            Sign In
          </v-btn>
        </v-form>
      </v-card>
    </v-main>
  </v-layout>
</template>
