# ==============================================================================
# Multi-stage Dockerfile for IP-KVM Control Plane API
# Stage 1 (builder): installs deps into a venv to keep the final image clean.
# Stage 2 (runtime): copies only the venv and source; runs as non-root user.
# ==============================================================================

# ---- Stage 1: builder -------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build tools needed for some C-extension packages (e.g., asyncpg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create an isolated virtual environment so the runtime stage stays minimal
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


# ---- Stage 2: runtime -------------------------------------------------------
FROM python:3.11-slim AS runtime

# Copy venv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user for security
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --no-create-home appuser

WORKDIR /app
ENV PYTHONPATH=/app

# Copy application source
COPY . .

# Ensure the non-root user owns the app directory
RUN chown -R appuser:appgroup /app

USER appuser

# Expose the port Uvicorn will listen on inside the container
EXPOSE 8000

# Uvicorn runs the ASGI app; --proxy-headers trusts X-Forwarded-* from Caddy
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", \
    "--proxy-headers", "--forwarded-allow-ips=*"]
