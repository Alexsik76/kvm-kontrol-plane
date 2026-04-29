# KVM Control Plane - Frontend

This is a modern web interface for remote server management via IP-KVM, built with Vue 3, TypeScript, and WebRTC. It is designed to provide high-performance, low-latency remote control and monitoring.

## Core Features

### High-Performance Remote Control
A custom input handling system captures and proxies keyboard and mouse events directly to the KVM node.

- **Intelligent Mouse Scaling**: Automatically calculates the ratio between the video stream resolution and its display size.
- **Event Coalescing & RAF Batching**: Consecutive events are merged and dispatched using `requestAnimationFrame` to ensure smooth performance.
- **HID Protocol Mapping**: Maps JavaScript events to raw USB HID scancodes for BIOS/UEFI and OS compatibility.
- **Modular Architecture**: Logic is split into specialized units within `usePlayerInput` for better maintainability.

### Input Shortcuts & Logic
Special handling for the Escape key and system shortcuts ensures both local control and remote system interaction:

#### Windowed Mode
- **Local Exit**: Press `ESC` to release the mouse and exit focus.
- **Remote Escape**: Press `Alt + ~` (Backtick/Tilde) to send a raw Escape key to the remote host.

#### Professional Mode (Fullscreen)
- **Keyboard Lock**: Captures system keys like `Alt+Tab` and `Windows Key` for a native experience.
- **Panel Toggle**: Press `Alt + P` to toggle the Control Panel. This releases the local mouse for UI interaction.
- **Auto-Relock**: Clicking any panel action (like **Ctrl+Alt+Del**) or the close button automatically re-locks the mouse to the remote host.
- **Exit**: **Hold ESC** for 2 seconds to exit fullscreen and release keyboard lock.

### Front-Panel Control
The frontend always connects to the node's `/ws/front_panel` WebSocket endpoint on session start, regardless of the `has_front_panel` flag — because the backend sends `video_status` events over this channel for all nodes. The dedicated control panel UI (`FrontPanelControls`) still appears in the sidebar only when `has_front_panel` is `true`.

The `/ws/front_panel` channel carries two categories of messages:

**LED status** (`{"pwr": ..., "hdd": ...}` — no `type` field, from the RP2040 module, every 100 ms):
- **PWR indicator** — `on` / `off` / `blinking` / `unknown`
- **HDD indicator** — `active` / `idle` / `unknown`

**Typed events** (`{"type": "...", ...}`):
- `video_status` — `{"type":"video_status","status":"active"|"inactive"}` — authoritative HDMI signal presence, sourced from the TC358743 driver via `POLLPRI` on the subdevice. Drives the `videoStatus` reactive ref (`'unknown' | 'active' | 'inactive'`); resets to `'unknown'` on disconnect.

**Control buttons** (visible only when `has_front_panel` is `true`):
- **Power** — sends a short press pulse.
- **Reset** — sends a reset pulse (with a confirmation dialog).
- **Force off** — sends a long-press pulse; requires a second click within 3 seconds to prevent accidental shutdown.

### HDMI Signal Overlay
`WebRTCStatusOverlay` shows an overlay with three priority tiers:

1. **No HDMI Signal** (`videoStatus === 'inactive'`) — highest priority. Shown even when the stream is technically active. Displays `mdi-monitor-off` with a description and a **Wake Host** button only (no Retry, as the problem is on the source side).
2. **Connecting** (`loading`) — spinner with the current stream status label.
3. **Connection Error** (`connectionError`) — `mdi-video-off` with the error message, **Retry Connection**, and **Wake Host** buttons.

When `videoStatus` transitions from `'inactive'` back to `'active'` and the stream is in a failed state, `WebRTCPlayer` automatically calls `startStream()` to reconnect without user interaction.

### Low-Latency Video Streaming
Utilizes WebRTC for near-instant video feedback from the KVM node.
- Status overlays for monitoring connection quality and capture state.

## Technical Architecture

### Tech Stack
- **Framework**: Vue 3 (Composition API)
- **Language**: TypeScript (Strict Mode)
- **UI Library**: Vuetify 3 (Material Design)
- **State Management**: Pinia
- **Build Tool**: Vite

### Key Composables
- `useWebRTC`: Manages the RTCPeerConnection and video stream lifecycle.
- `useHID`: Handles WebSocket communication for HID reports. No automatic reconnection by design.
- `usePlayerInput`: Orchestrates input capture, fullscreen, mouse, and keyboard handling.
- `useFrontPanel`: Manages the WebSocket connection to `/ws/front_panel`. Exposes reactive LED state (`pwrStatus`, `hddStatus`), HDMI signal state (`videoStatus`), and control methods (`powerPress`, `powerHold`, `reset`). Resets all state to `'unknown'` on disconnect.

## Project Structure
- `/src/components`: UI components including the WebRTC player, capture overlays, and `FrontPanelControls`.
- `/src/composables`: Specialized logic for WebRTC, HID, input processing, and front-panel control.
- `/src/types`: TypeScript interfaces (`KvmNode` and related types).
- `/src/utils`: Helper functions for HID scancode mapping and Base64 encoding.
- `/src/views`: Main application pages (Dashboard, Stream View, Login).

## Getting Started
To run the project locally for development:

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Build for production: `npm run build`
