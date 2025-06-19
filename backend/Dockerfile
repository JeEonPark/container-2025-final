FROM python:3.10-slim

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose both ports (WebSocket and HTTP)
EXPOSE 8080 8081

CMD ["python", "app.py"]
