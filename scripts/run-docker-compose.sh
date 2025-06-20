#!/bin/bash

echo "🚀 Starting STT Application with Docker Compose..."

# Build and start services
docker-compose up --build -d

echo "✅ Services started!"
echo ""
echo "📱 Frontend: http://localhost:4200"
echo "🔌 Backend WebSocket: ws://localhost:5000"
echo ""
echo "📋 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down" 
