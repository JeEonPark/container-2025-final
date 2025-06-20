"""
WebSocket utility functions
"""

import time


async def send_result(websocket, result: dict) -> None:
    """Send result to client"""
    try:
        await websocket.send_json(result)
    except:
        pass


async def send_status(websocket, status: str) -> None:
    """Send status message"""
    message = {
        'type': 'status',
        'message': status,
        'timestamp': time.time()
    }
    try:
        await websocket.send_json(message)
    except:
        pass 
