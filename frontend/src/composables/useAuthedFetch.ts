import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

export function useAuthedFetch() {
  const authStore = useAuthStore()
  const router = useRouter()

  async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const doFetch = () =>
      fetch(input, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${authStore.accessToken}`,
        },
      })

    let response = await doFetch()
    if (response.status !== 401) return response

    const refreshed = await authStore.refresh()
    if (!refreshed) {
      router.push({ name: 'login' })
      return response
    }

    response = await doFetch()
    if (response.status === 401) {
      authStore.logout()
      router.push({ name: 'login' })
    }
    return response
  }

  return { authedFetch }
}
