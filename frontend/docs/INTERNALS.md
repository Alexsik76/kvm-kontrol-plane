# Frontend Architecture & Internal Details

This document describes the internal logic, communication protocols, and architectural patterns of the frontend application.

## Input Handling & Scancode Mapping

A custom input handling system (`usePlayerInput`) captures and proxies keyboard and mouse events directly to the KVM node over a WebSocket connection.

- **Intelligent Mouse Scaling**: Automatically calculates the ratio between the video stream resolution and display size to map relative/absolute pointer coordinates accurately.
- **Event Coalescing & RAF Batching**: Merges consecutive mouse events and dispatches them using `requestAnimationFrame` to ensure smooth performance without saturating the network.
- **HID Protocol Mapping**: Maps JavaScript keyboard events to raw USB HID scancodes for low-level compatibility with target system BIOS/UEFI and operating systems.
- **Modular Composables**: Logic is organized into modular composables for mouse, keyboard, and pointer lock state management.

## Input Shortcuts & Logic

### Windowed Mode
- **Local Exit**: Press `ESC` to release mouse focus and return control to the browser.
- **Remote Escape**: Press `Alt + ~` (Backtick/Tilde) to send a raw Escape scancode to the remote host.

### Professional Mode (Fullscreen)
- **Keyboard Lock**: Captures system hotkeys like `Alt+Tab` and `Windows Key` for a native remote desktop experience.
- **Panel Toggle**: Press `Alt + P` to toggle the Control Panel UI. This temporarily releases the local mouse for browser UI interaction.
- **Auto-Relock**: Clicking any control panel action (such as **Ctrl+Alt+Del**) or closing the panel automatically re-locks the pointer to the remote host.
- **Exit Fullscreen**: Press and hold `ESC` for 2 seconds to exit fullscreen and release keyboard lock.

## Front-Panel WebSocket Channel (`/ws/front_panel`)

The frontend opens a WebSocket connection to `/ws/front_panel` on session start to monitor node hardware state.

### Message Types

1. **LED Status** (`{"pwr": "...", "hdd": "..."}` — dispatched every 100ms from the RP2040 hardware module):
   - **PWR Indicator**: `'on'`, `'off'`, `'blinking'`, `'unknown'`
   - **HDD Indicator**: `'active'`, `'idle'`, `'unknown'`

2. **Typed Events** (`{"type": "...", ...}`):
   - `video_status`: `{"type":"video_status","status":"active"|"inactive"}` — Sent when HDMI signal presence changes on the TC358743 capture chip. Updates the `videoStatus` reactive ref (`'unknown' | 'active' | 'inactive'`).

### Front-Panel Controls
Visible when the node has `has_front_panel` set to `true`:
- **Power**: Sends a short power button pulse.
- **Reset**: Sends a reset pulse (with confirmation modal).
- **Force Off**: Sends a long-press power pulse (requires a second click within 3 seconds).

## WebRTC Stream Management & Overlay Priorities

`WebRTCStatusOverlay` manages connection state feedback using three priority tiers:

1. **No HDMI Signal** (`videoStatus === 'inactive'`) — Highest priority. Displayed even if the WebRTC stream connection is established. Shows `mdi-monitor-off` with a **Wake Host** action.
2. **Connecting** (`loading`) — Displays a spinner with current stream connection status.
3. **Connection Error** (`connectionError`) — Displays `mdi-video-off` with error details and **Retry Connection** / **Wake Host** actions.

### Guard-Free Reconnect Rationale
When `videoStatus` transitions from `'inactive'` back to `'active'`, `WebRTCPlayer` unconditionally invokes `startStream()`. This guard-free reconnect is necessary because MediaMTX does not tear down the WebRTC peer connection when the video source is lost—it simply stops delivering video frames. Unconditionally restarting the stream guarantees that stale WebRTC sessions are cleanly re-established.

## Real-Time Diagnostics Telemetry

Appending `?debug=1` to the stream URL (e.g. `http://localhost:5173/nodes/{id}/stream?debug=1`) activates `DiagnosticsOverlay`:
- **HID Network**: RTT and packet loss measured via WebSocket ping/pong messages.
- **WebRTC Network**: RTT, bitrate, and jitter buffer delay retrieved from WebRTC `getStats()`.
- **Video Decoding**: FPS, decode duration, dropped frames, and screen resolution.
