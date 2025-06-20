"""
WebSocket connection and message handling
"""

import asyncio
import base64
import json
import threading
import time
import numpy as np
from typing import Dict, Set, Optional

from aiohttp import web
from aiohttp.web import WebSocketResponse, WSMsgType

from models.audio_session import AudioSession
from processors.whisper_processor import WhisperProcessor
from processors.translation_processor import TranslationProcessor
from utils.websocket_utils import send_result, send_status


class WebSocketHandler:
    """Handles WebSocket connections and message processing"""
    
    def __init__(self, whisper_model, translation_processor: Optional[TranslationProcessor]):
        self.whisper_model = whisper_model
        self.translation_processor = translation_processor
        self.audio_sessions: Dict[str, AudioSession] = {}
        self.connected_clients: Set[WebSocketResponse] = set()
    
    async def websocket_handler(self, request):
        """Handle WebSocket connections"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        
        session_id = f"session_{len(self.connected_clients)}_{int(time.time())}"
        self.connected_clients.add(ws)
        print(f"🔌 WebSocket connected (session: {session_id}, total: {len(self.connected_clients)})")
        
        try:
            # Connection confirmation message
            await ws.send_json({
                'type': 'connected',
                'message': 'Whisper VAD STT server connected',
                'session_id': session_id
            })
            
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        
                        if data['type'] == 'audio':
                            # Decode Base64 to extract PCM data
                            pcm_base64 = data['data']
                            pcm_bytes = base64.b64decode(pcm_base64)
                            pcm_data = np.frombuffer(pcm_bytes, dtype=np.int16)
                            
                            # Process VAD
                            await self._process_audio_chunk(ws, pcm_data, session_id)
                            
                        elif data['type'] == 'start':
                            print(f"🎤 Streaming started (session: {session_id})")
                            await send_status(ws, "🎤 Speech recognition started")
                            
                        elif data['type'] == 'stop':
                            print(f"🛑 Streaming stopped (session: {session_id})")
                            if session_id in self.audio_sessions:
                                del self.audio_sessions[session_id]
                            await send_status(ws, "🛑 Speech recognition stopped")
                        
                        elif data['type'] == 'set_target_language':
                            # Set translation target language
                            target_lang = data.get('language', 'ko')
                            # Create session if it doesn't exist
                            if session_id not in self.audio_sessions:
                                self.audio_sessions[session_id] = AudioSession()
                                print(f"🎤 New audio session created for language setting: {session_id}")
                            
                            self.audio_sessions[session_id].target_language = target_lang
                            print(f"🌐 Target language set to: {target_lang} (session: {session_id})")
                            await send_status(ws, f"🌐 Translation target set to: {target_lang}")
                        
                        elif data['type'] == 'get_supported_languages':
                            # Send supported languages list
                            if self.translation_processor:
                                supported_langs = self.translation_processor.get_supported_languages()
                                await ws.send_json({
                                    'type': 'supported_languages',
                                    'languages': supported_langs
                                })
                            else:
                                await ws.send_json({
                                    'type': 'supported_languages',
                                    'languages': {}
                                })
                        
                    except json.JSONDecodeError:
                        print(f"❌ JSON parsing error")
                    except Exception as e:
                        print(f"❌ Message processing error: {e}")
                        
                elif msg.type == WSMsgType.ERROR:
                    print(f"❌ WebSocket error: {ws.exception()}")
                    
        except Exception as e:
            print(f"❌ WebSocket processing error: {e}")
        finally:
            self.connected_clients.discard(ws)
            if session_id in self.audio_sessions:
                del self.audio_sessions[session_id]
            print(f"❌ WebSocket disconnected (session: {session_id}, remaining: {len(self.connected_clients)})")
        
        return ws
    
    async def _process_audio_chunk(self, websocket, pcm_data: np.ndarray, session_id: str) -> None:
        """Process audio chunk with real-time VAD"""
        try:
            if session_id not in self.audio_sessions:
                self.audio_sessions[session_id] = AudioSession()
                print(f"🎤 New audio session created: {session_id}")
            
            session = self.audio_sessions[session_id]
            session.add_audio(pcm_data)
            
            # Calculate current audio level for VAD
            audio_level = np.sqrt(np.mean(pcm_data.astype(np.float32) ** 2)) / 32768.0
            
            buffer_duration = len(session.audio_buffer) / session.sample_rate
            
            # Log audio activity more frequently for VAD debugging
            if audio_level > 0.002:  # Lower threshold for logging
                speech_duration = 0
                silence_duration = 0
                if session.is_speech_active and session.speech_start_time > 0:
                    speech_duration = time.perf_counter() - session.speech_start_time
                if session.silence_start_time > 0:
                    silence_duration = time.perf_counter() - session.silence_start_time
                    
                # print(f"📊 Level: {audio_level:.4f}, Speech: {session.is_speech_active}, SpeechDur: {speech_duration:.4f}s, SilenceDur: {silence_duration:.4f}s")
            
            # Check if it's time to process based on real-time VAD
            if session.should_process(audio_level):
                print(f"🔍 VAD triggered STT processing... (buffer: {buffer_duration:.4f}s)")
                session.processing = True
                session.last_process_time = time.perf_counter()
                
                # Process VAD + STT in separate thread
                audio_result = session.get_audio_for_processing()
                if audio_result is not None:
                    audio_data, start_pos = audio_result
                    # Get current event loop to pass to thread
                    loop = asyncio.get_event_loop()
                    
                    # Use GPT translation processor
                    processor = WhisperProcessor(self.whisper_model, self.translation_processor)
                    threading.Thread(
                        target=processor.process_audio,
                        args=(audio_data, session_id, start_pos, websocket, loop, self.audio_sessions),
                        daemon=True
                    ).start()
                else:
                    session.processing = False
                    
        except Exception as e:
            print(f"❌ Audio processing error: {e}") 
