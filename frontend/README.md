# KVM Control Plane - Frontend

This is a modern web interface for remote server management via IP-KVM, built with Vue 3, TypeScript, and WebRTC. It is designed to provide high-performance, low-latency remote control and monitoring.

## Core Features

### High-Performance Remote Control
A custom input handling system captures and proxies keyboard and mouse events directly to the KVM node.

- **Intelligent Mouse Scaling**: Automatically calculates the ratio between the video's stream resolution and its display size to ensure consistent 1:1 movement accuracy.
- **Event Coalescing**: Consecutive mouse movements are merged in the message queue to prevent network congestion while maintaining absolute movement precision.
- **RAF Batching**: Input events are dispatched using the browser's `requestAnimationFrame` loop, reducing WebSocket overhead and ensuring smooth window dragging even under high-frequency movement.
- **HID Protocol Mapping**: Maps JavaScript keyboard events to raw USB HID scancodes for maximum compatibility with remote BIOS/UEFI and operating systems.

### Remote Escape Logic
Special handling for the Escape key allows for both local interface control and remote system interaction:
- **Local Exit**: Press `ESC` to release the mouse and exit the capture mode.
- **Remote Escape**: Press `Alt + ESC` to send a raw Escape key to the remote computer.

### Low-Latency Video Streaming
Utilizes WebRTC for near-instant provides video feedback from the KVM node.
- Automatic reconnection logic for both Video and HID channels.
- Status overlays for monitoring connection quality and capture state.

## Technical Architecture

### Tech Stack
- **Framework**: Vue 3 (Composition API)
- **Language**: TypeScript (Strict Mode)
- **UI Blueprint**: Vuetify 4 (Material Design)
- **State Management**: Pinia
- **Build Tool**: Vite

### Key Composables
- `useWebRTC`: Manages the RTCPeerConnection, signaling, and video stream lifecycle.
- `useHID`: Handles WebSocket communication for HID reports, including message queuing and performance optimizations.
- `usePlayerInput`: Central logic for capturing raw browser events and converting them into KVM-compatible payloads.

## Project Structure
- `/src/components`: UI components including the WebRTC player and capture overlays.
- `/src/composables`: Specialized logic for WebRTC, HID, and input processing.
- `/src/utils`: Helper functions for HID scancode mapping and Base64 encoding.
- `/src/views`: Main application pages (Dashboard, Stream View, Login).

## Getting Started
To run the project locally for development:

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Build for production: `npm run build`
