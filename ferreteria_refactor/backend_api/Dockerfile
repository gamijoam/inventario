# Production Dockerfile for FastAPI Backend
FROM python:3.12-slim

# Install system dependencies (postgres client for healthchecks/migrations)
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Base WORKDIR for the whole project context (root)
WORKDIR /app

# Copy requirements from the root context
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code from the root context (context is .)
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

# Expose port (FastAPI default)
EXPOSE 8000

# CRITICAL: Change working directory to the parent folder so 'backend_api' is seen as a module
WORKDIR /app/ferreteria_refactor

# Run using module notation (folder.file:app) to enable relative imports
CMD ["uvicorn", "backend_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
