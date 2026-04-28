export type NodeStatus = 'online' | 'offline' | 'unknown'

export interface KvmNode {
  id: string
  name: string
  internal_ip: string
  tunnel_url: string | null
  ws_port: number
  mediamtx_api_port: number
  stream_name: string
  mediamtx_user: string
  mediamtx_pass: string
  has_front_panel: boolean
  status: NodeStatus
  machine_info: Record<string, string> | null
  screenshot: string | null
  last_seen_at: string | null
  created_at: string
}
