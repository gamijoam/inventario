# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Copy frontend configuration
COPY ferreteria_refactor/frontend_web/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and build
COPY ferreteria_refactor/frontend_web/ ./
RUN npm run build

# Stage 2: Runtime Backend
FROM python:3.11-slim-bookworm
WORKDIR /app

# Install system dependencies (gcc, libpq-dev)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code directly to /app (v29 flat structure)
# This includes alembic.ini, alembic/, backend_api/, etc.
COPY ferreteria_refactor/ /app/

# Copy built frontend from Stage 1 to /app/static
COPY --from=frontend-build /app/frontend/dist /app/static

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Env vars
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Use entrypoint script to run migrations before starting server
ENTRYPOINT ["/app/docker-entrypoint.sh"]
