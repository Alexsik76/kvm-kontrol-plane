# API Documentation — IP-KVM Control Plane

This document describes all API endpoints for the backend service.

## Basic Information

- **Base URL:** `https://<control-plane-host>/api/v1`
- **Data Format:** `application/json`
- **Authentication:** JSON Web Token (JWT) using the `Authorization: Bearer <token>` header (except for WebSockets, where the token is passed in a query parameter).

---

## 1. Video Streaming and WebRTC Signaling

These endpoints are used to set up a WebRTC connection between the browser and MediaMTX on the KVM node.

### 1.1. Send SDP Offer
**URL:** `POST /nodes/{node_id}/signal/offer`

Used to initialize a WebRTC connection (WHEP protocol).

- **Headers:**
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>`
  - `Content-Type: application/json`

- **Request Body (JSON):**
```json
{
  "sdp": "v=0\r\no=- 473289... (full SDP offer text)",
  "type": "offer"
}
```

- **Successful Response (200 OK):**
```json
{
  "sdp": "v=0\r\no=- 893247... (SDP answer text from MediaMTX)",
  "type": "answer",
  "session_url": "https://<node-host>/kvm/whep/uuid-session-id"
}
```
*Important:* You must save the `session_url` to send ICE candidates later.

---

### 1.2. Send ICE Candidate (Trickle ICE)
**URL:** `POST /nodes/{node_id}/signal/ice`

- **Headers:**
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>`
  - `Content-Type: application/json`

- **Request Body (JSON):**
```json
{
  "candidate": "candidate:423492834 1 udp 2122260223 192.168.1.100 54321 typ host...",
  "sdpMid": "0",
  "sdpMLineIndex": 0,
  "session_url": "https://<node-host>/kvm/whep/uuid-session-id"
}
```
*Note:* `session_url` is the session URL received in the response to the Offer.

- **Successful Response:** `204 No Content`.

---

## 2. Direct Control (HID) via WebSocket

The backend no longer proxies HID traffic in order to reduce latency. Clients must connect **directly to the node** (using `tunnel_url` or `internal_ip` received from the node details).

### 2.1. WebSocket Connection
**URL:** `wss://<node_domain>/ws/control`

Used to send real-time keyboard and mouse events directly to the KVM node (Raspberry Pi).

- **Authentication:** The token is passed as a query string parameter.
- **Format:** `wss://<node_domain>/ws/control?token=<JWT_ACCESS_TOKEN>`

---

## 3. Authentication (`/auth`)

### 3.1. Login
**URL:** `POST /auth/login`

- **Request Body (Form Data):** `username`, `password`
- **Response:** `{"access_token": "...", "refresh_token": "...", "token_type": "bearer"}`

### 3.2. Token Refresh
**URL:** `POST /auth/refresh`
- **Request Body:** `{"refresh_token": "..."}`

---

## 4. KVM Node Management (`/nodes`)

This section provides CRUD operations for managing and monitoring nodes. Note that operations that change state require superuser permissions.

### 4.1. CRUD Operations
- **GET `/nodes`**: Get a list of all available nodes.
- **POST `/nodes`**: Register a new node (superuser only).
- **GET `/nodes/{node_id}`**: Get detailed information about a node.
- **PUT `/nodes/{node_id}`**: Partially update node data (superuser only).
- **DELETE `/nodes/{node_id}`**: Delete a node (superuser only).

### 4.2. Node Status (Health)
**URL:** `GET /nodes/{node_id}/status`
Returns the last known node status, which is periodically updated by a background poller (`node_health`).

### 4.3. Wake-on-USB
**URL:** `POST /nodes/{node_id}/ws/wake`

Used to send a "magic" keyboard signal (such as Left Shift) to wake up the target PC.
Unlike the persistent WebSocket connection, this request is **proxied by the backend** (the API forwards the HTTP request to `kvm_engine_py` on the target node), which allows waking up the host before establishing a WebSocket connection.
- **Headers:** `Authorization: Bearer <JWT_ACCESS_TOKEN>`

---

## Specific Headers for MediaMTX (Internal)

The backend automatically adds the `Authorization: Basic <base64(user:pass)>` header when contacting the node. Clients do not need to know this information.
