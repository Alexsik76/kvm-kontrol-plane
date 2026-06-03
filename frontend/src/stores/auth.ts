import { defineStore } from 'pinia'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: localStorage.getItem('access_token'),
    refreshToken: localStorage.getItem('refresh_token'),
  }),
  getters: {
    isAuthenticated: (state) => !!state.accessToken,
  },
  actions: {
    setTokens(access: string, refresh: string) {
      this.accessToken = access
      this.refreshToken = refresh
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', refresh)
    },
    logout() {
      this.accessToken = null
      this.refreshToken = null
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    },
    async refresh(): Promise<boolean> {
      if (!this.refreshToken) {
        this.logout()
        return false
      }
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.refreshToken })
        })
        if (!response.ok) {
          this.logout()
          return false
        }
        const data = await response.json()
        this.setTokens(data.access_token, data.refresh_token)
        return true
      } catch {
        this.logout()
        return false
      }
    }
  }
})
