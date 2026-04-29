# IP-KVM Control Plane

A modern, web-based control plane for managing a fleet of Raspberry Pi-based IP-KVM devices. It provides a centralized dashboard for connecting to KVM nodes via low-latency WebRTC streams, monitoring their status, and organizing device hardware specifications.

## Project Structure

The project is split into two main components:

- **Backend (`/backend`)**: A REST API built with Python, FastAPI, and SQLAlchemy. It handles KVM node management (CRUD operations), database persistence (PostgreSQL via Docker), WebRTC signaling (interfacing with MediaMTX), and periodic node health polling.
- **Frontend (`/frontend`)**: A reactive single-page application built with Vue 3, Vite, Vuetify 3, and Pinia. It offers a dark-themed, responsive dashboard, WebRTC video player interface, and a front-panel control panel.

## Quick Start

### 1. Start the Backend Infrastructure

The backend and the PostgreSQL database are fully dockerized.

```bash
cd backend
docker compose up -d
```

After the first start (or after pulling an update that includes new migrations), apply any pending schema changes:

```bash
docker compose exec backend alembic upgrade head
```

The API will be available at `http://localhost:8000`.

### 2. Start the Frontend Development Server

Ensure you have Node.js installed.

```bash
cd frontend
npm install
npm run dev
```

The frontend dashboard will be available at `http://localhost:5173`.

## Features

- **Centralized Dashboard**: View node status (Online/Offline) and last seen timestamps.
- **WebRTC Streaming**: Instantly connect to specific KVM nodes with sub-second latency video.
- **HID Proxying**: Keyboard and mouse events are captured in the browser and forwarded directly to the KVM node over a dedicated WebSocket connection.
- **Front-Panel Control**: Optional RP2040-Zero module support — remotely press Power/Reset buttons and monitor PWR/HDD LED states in real time. Enabled per-node via the `has_front_panel` flag set in the dashboard.
- **Cloudflare Tunnel Support**: Each node can be configured with a `tunnel_url` (e.g. `https://pi4.lab.vn.ua`) that overrides the internal IP for all backend → RPi calls.
- **Per-Node MediaMTX Authentication**: Each node stores its own MediaMTX credentials (`mediamtx_user`, `mediamtx_pass`) for the WebRTC stream endpoint.
- **Dynamic Snapshots**: Displays a responsive 16:9 thumbnail of the KVM node's screen.
- **Custom Hardware Specs**: Attach and display custom metadata (e.g. CPU, Location, Hypervisor) for each device.
- **Secure Access**: JWT-based authentication for the control panel.
