# ==============================================================================
# Dockerfile for IP-KVM Control Plane Frontend (Development Mode)
#
# This Dockerfile is intended for high-speed local development using Vite's
# dev server with Hot Module Replacement (HMR).
# ==============================================================================

FROM node:20-slim

# Install simple http server for when we build for production (optional fallback)
RUN npm install -g serve

WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json ./
RUN npm install --no-fund --no-audit

# Copy the rest of the application
COPY . .

# Expose Vite's default dev port
EXPOSE 3000

# Start Vite dev server on 0.0.0.0 so it's accessible from the host
CMD ["npm", "run", "dev"]
