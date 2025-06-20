"""
HTTP route handlers
"""

from aiohttp import web


async def health_check(request):
    """Health check endpoint"""
    return web.json_response({'status': 'ok'})


async def offer_handler(request):
    """Offer endpoint for WebRTC"""
    return web.json_response({'status': 'ok'}) 
