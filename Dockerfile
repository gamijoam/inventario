# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Copy frontend configuration
COPY ferreteria_refactor/frontend_web/package.json ./
# Note: copying package-lock.json would be better for determinism, but user only mentioned package.json. 
# Safe to include lock if it exists, or just package.json as requested.
# I'll stick to user instructions strictly but generally good practice to copy lock. 
# The directory listing showed package-lock.json exists. I'll include it implicitly if I copy dir, 
# but for cache invalidation, better to copy specifically.
# User said: "Copia el package.json del frontend". I will allow npm ci to fail back to install or warn if lock missing implies different content.
# Actually `npm ci` REQUIRES package-lock.json. So I MUST copy it if I use `npm ci`.
COPY ferreteria_refactor/frontend_web/package-lock.json ./

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

# Copy backend code
# Only copying the necessary package structure
COPY ferreteria_refactor /app/ferreteria_refactor
COPY ferreteria_refactor/alembic.ini /app/ferreteria_refactor/alembic.ini

# Copy built frontend from Stage 1 to /app/static
COPY --from=frontend-build /app/frontend/dist /app/static

# Env vars
ENV PYTHONPATH=/app

# Run uvicorn
CMD ["uvicorn", "ferreteria_refactor.backend_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
