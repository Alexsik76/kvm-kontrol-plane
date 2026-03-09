# ==============================================================================
# Dockerfile for IP-KVM Control Plane Frontend (Production / Nginx Mode)
#
# This uses a multi-stage build:
# 1. Base stage: Installs dependencies and builds the static assets.
# 2. Production stage: Uses Nginx to serve the static assets securely and fast.
# ==============================================================================

# -------------------------
# Stage 1: Build
# -------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit

# Copy the rest of the application
COPY . .

# Build the SPA (creates /app/dist)
# Our vite.config.ts is configured to embed the string "__VITE_API_BASE_URL_PLACEHOLDER__" 
# during this build process.
RUN npm run build

# -------------------------
# Stage 2: Production (Nginx)
# -------------------------
FROM nginx:alpine

# Copy the built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx configuration (handles SPA routing and port 80)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the entrypoint script that does the ENV substitution
COPY entrypoint.sh /docker-entrypoint.d/40-substitute-env.sh
RUN chmod +x /docker-entrypoint.d/40-substitute-env.sh

# Expose Nginx port
EXPOSE 80

# Use Nginx default CMD
CMD ["nginx", "-g", "daemon off;"]
