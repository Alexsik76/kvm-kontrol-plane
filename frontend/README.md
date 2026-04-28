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
When a node has `has_front_panel` set to `true`, a dedicated control panel appears in the session sidebar. It connects directly to the node's `/ws/front_panel` WebSocket endpoint (bypassing the backend, same pattern as HID) and provides:

- **PWR / HDD LED indicators** with live status (`on`/`off`/`blinking`/`active`/`idle`/`unknown`) updated every 100 ms from the RP2040 module.
- **Power** button — sends a short press pulse.
- **Reset** button — sends a reset pulse (with a confirmation dialog).
- **Force off** button — sends a long-press pulse; requires a second click within 3 seconds to prevent accidental shutdown.

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
- `useFrontPanel`: Manages the WebSocket connection to `/ws/front_panel`, exposes reactive LED state (`pwrStatus`, `hddStatus`) and control methods (`powerPress`, `powerHold`, `reset`).

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
