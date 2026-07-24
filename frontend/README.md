# KVM Control Plane - Frontend Application

A modern single-page web application for managing remote servers via IP-KVM. It provides real-time WebRTC video streaming, direct HID keyboard and mouse control, hardware monitoring, and node management.

## Tech Stack

- **Framework**: Vue 3 (Composition API)
- **Language**: TypeScript (Strict Mode)
- **UI Library**: Vuetify 3 (Material Design)
- **State Management**: Pinia
- **Build Tool**: Vite

## Key Features

- **Low-Latency WebRTC Player**: Displays sub-second video streams directly from MediaMTX on the KVM node.
- **Direct HID Control**: Transmits keyboard and mouse events over a direct WebSocket connection bypassing the backend.
- **Front-Panel Monitoring**: Displays PWR/HDD LED statuses and provides remote Power/Reset controls for RP2040-enabled nodes.
- **Node Management Dashboard**: Interactive dashboard to view, register, edit, and monitor KVM nodes.
- **Real-Time Telemetry Overlay**: Appending `?debug=1` enables telemetry for WebRTC bitrate, FPS, and HID network RTT.

## Directory Structure

- `src/components/` — Vue components (WebRTC player, front-panel controls, diagnostics overlays)
- `src/composables/` — Reusable logic (WebRTC, HID input, front-panel WebSocket, telemetry)
- `src/stores/` — Pinia state stores (authentication, nodes state)
- `src/types/` — TypeScript type definitions and interfaces
- `src/utils/` — Utility functions (HID scancode mapping, coordinate scaling)
- `src/views/` — Application pages (Dashboard, Login, Node Stream View)
- `docs/` — Internal architecture documentation

## Getting Started

### Prerequisites

Ensure you have installed:
- **Node.js**: Version 18 or higher
- **npm**: Package manager (included with Node.js)

### Backend Configuration

The frontend connects to the Control Plane API backend using the `VITE_API_BASE_URL` environment variable.

Create or edit the `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:8000
```

*Note:* If left blank during development, Vite defaults to proxying `/api` requests to `http://api:8000` or `http://localhost:8000`.

### Development and Build Commands

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   Access the dashboard at `http://localhost:5173`.

3. **Build for production**:
   ```bash
   npm run build
   ```

## Documentation & Internals

For detailed explanations of input scancode mapping, shortcut handling, front-panel WebSocket message formats, and stream recovery logic, see [docs/INTERNALS.md](docs/INTERNALS.md).

For root system architecture and multi-repo overview, refer to the [Root README](../README.md).

## Screenshots

<!-- Screenshot placeholders will be added here -->
