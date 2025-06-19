# Use multi-stage build for better caching
FROM python:3.10-slim as base

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create a non-root user
RUN useradd --create-home --shell /bin/bash app

# Set working directory
WORKDIR /app

# Create pip cache directory
RUN mkdir -p /app/.cache/pip

# Copy requirements first for better layer caching
COPY requirements-prod.txt requirements.txt

# Install Python dependencies with better caching
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --cache-dir /app/.cache/pip -r requirements.txt

# Switch to non-root user
USER app

# Copy application code
COPY --chown=app:app . .

# Expose both ports (WebSocket and HTTP)
EXPOSE 8080 8081

CMD ["python", "app.py"]
