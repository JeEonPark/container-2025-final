#!/usr/bin/env python3
"""
Real-time STT Server with Whisper VAD
Modular WebSocket-based Speech-to-Text server using faster-whisper
"""

import asyncio

import aiohttp_cors
from aiohttp import web

from config import HOST, PORT
from handlers.http_handlers import health_check, offer_handler
from handlers.websocket_handler import WebSocketHandler
from utils.model_initializer import initialize_whisper_model, initialize_translation_processor


async def main():
    """Main server function"""
    
    # Initialize Whisper model
    whisper_model = initialize_whisper_model()
    
    # Initialize GPT translation processor
    translation_processor = initialize_translation_processor()
    
    # Create WebSocket handler
    websocket_handler = WebSocketHandler(whisper_model, translation_processor)
    
    # Create aiohttp app
    app = web.Application()
    
    # Add routes
    app.router.add_get('/health', health_check)
    app.router.add_post('/offer', offer_handler)
    app.router.add_get('/ws', websocket_handler.websocket_handler)
    
    # Configure CORS
    cors = aiohttp_cors.setup(app, defaults={
        "*": aiohttp_cors.ResourceOptions(
            allow_credentials=True,
            expose_headers="*",
            allow_headers="*",
            allow_methods="*"
        )
    })
    
    # Add CORS to all routes
    for route in list(app.router.routes()):
        cors.add(route)
    
    # Start server
    print("🎤 Starting HTTP/WebSocket STT server on http://0.0.0.0:5000")
    print("🔗 WebSocket: ws://localhost:5000/ws")
    print("🔗 Health: http://localhost:5000/health")
    print("🔗 Offer: http://localhost:5000/offer")
    print("🛑 Press Ctrl+C to stop")
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()
    
    # Keep server running
    await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
