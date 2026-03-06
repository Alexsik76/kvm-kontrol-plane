# IP-KVM Control Plane

A modern, web-based control plane for managing a fleet of Raspberry Pi-based IP-KVM devices. It provides a centralized dashboard for connecting to KVM nodes via low-latency WebRTC streams, monitoring their status, and organizing device hardware specifications.

## Project Structure

The project is split into two main components:

- **Backend (`/backend`)**: A REST API built with Python, FastAPI, and SQLAlchemy. It handles KVM node management (CRUD operations), database persistence (PostgreSQL via Docker), and WebRTC signaling (interfacing with MediaMTX).
- **Frontend (`/frontend`)**: A reactive single-page application built with Vue 3, Vite, Vuetify 3, and Pinia. It offers a dark-themed, responsive dashboard and WebRTC video player interface.

## Quick Start

### 1. Start the Backend Infrastructure

The backend and the PostgreSQL database are fully dockerized.

```bash
cd backend
docker compose up -d
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
- **Dynamic Snapshots**: Displays a responsive 16:9 thumbnail of the KVM node's screen.
- **Custom Hardware Specs**: Attach and display custom metadata (e.g. CPU, Location, Hypervisor) for each device.
- **Secure Access**: JWT-based authentication for the control panel.
