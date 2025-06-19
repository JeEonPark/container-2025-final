#!/usr/bin/env python3
"""
Real-time STT Server with Whisper VAD
Modular WebSocket-based Speech-to-Text server using faster-whisper
"""

import asyncio
import base64
import json
import re
import threading
import time
from typing import Dict, List, Optional, Tuple

import numpy as np
import websockets
from faster_whisper import WhisperModel
from transformers import M2M100ForConditionalGeneration, M2M100Tokenizer

# Global variables
model: WhisperModel = None
translation_model: M2M100ForConditionalGeneration = None
translation_tokenizer: M2M100Tokenizer = None
audio_sessions: Dict[str, 'AudioSession'] = {}
connected_clients = set()


class AudioSession:
    """Manages audio session state and VAD processing"""
    
    def __init__(self):
        self.sample_rate = 16000
        self.audio_buffer = []
        self.last_process_time = time.perf_counter()
        self.processing = False
        
        # Real-time VAD settings
        self.min_speech_duration = 0.4  # Minimum 0.4 seconds of speech
        self.max_speech_duration = 30.0  # Maximum 30 seconds
        self.silence_threshold = 0.01  # Audio level threshold for silence
        self.silence_duration_threshold = 0.2  # 0.2 seconds of silence to trigger processing
        
        # VAD state tracking
        self.is_speech_active = False
        self.speech_start_time = 0
        self.last_speech_time = 0
        self.silence_start_time = 0
        
        # Sliding window settings
        self.processed_samples = 0  # Track how many samples have been processed
        self.last_transcription = ""  # Store last transcription for deduplication
        self.overlap_duration = 0.1  # Keep 0.1 seconds of overlap for context
        
        # Translation settings
        self.target_language = 'en'  # Default to Korean
        
    def add_audio(self, pcm_data: np.ndarray) -> None:
        """Add audio data to buffer with automatic trimming"""
        self.audio_buffer.extend(pcm_data)
        
        # Remove old data if buffer is too large (max 60 seconds)
        max_samples = self.sample_rate * 60
        if len(self.audio_buffer) > max_samples:
            # Calculate how many samples we're removing
            samples_to_remove = len(self.audio_buffer) - max_samples
            
            # Update processed_samples to account for removed samples
            self.processed_samples = max(0, self.processed_samples - samples_to_remove)
            
            # Keep only the last max_samples
            self.audio_buffer = self.audio_buffer[-max_samples:]
            
            # print(f"🧹 Buffer trimmed: removed {samples_to_remove} samples, adjusted processed_samples to {self.processed_samples}")
    
    def should_process(self, current_audio_level: float) -> bool:
        """Check if it's time to process based on real-time VAD"""
        if self.processing:
            return False
            
        current_time = time.perf_counter()
        is_speech = current_audio_level > self.silence_threshold
        
        # State transitions
        if is_speech:
            if not self.is_speech_active:
                # Speech started
                self.is_speech_active = True
                self.speech_start_time = current_time
                self.silence_start_time = 0
                print(f"🎤 Speech started (level: {current_audio_level:.4f})")
            else:
                # Continue speech - reset silence timer
                self.silence_start_time = 0
            
            self.last_speech_time = current_time
            
        else:  # Silence
            if self.is_speech_active:
                if self.silence_start_time == 0:
                    # Silence just started
                    self.silence_start_time = current_time
                    print(f"🔇 Silence started after speech (level: {current_audio_level:.4f})")
                
                # Check if silence duration is enough to trigger processing
                silence_duration = current_time - self.silence_start_time
                speech_duration = self.last_speech_time - self.speech_start_time
                print(f"🔍 Silence duration: {silence_duration:.4f}s, Speech duration: {speech_duration:.4f}s")
                
                if (silence_duration >= self.silence_duration_threshold and 
                    speech_duration >= self.min_speech_duration):
                    
                    print(f"✅ VAD trigger: speech={speech_duration:.4f}s, silence={silence_duration:.4f}s")
                    self.is_speech_active = False
                    self.silence_start_time = 0
                    return True
        
        # Emergency processing if speech is too long
        if (self.is_speech_active and 
            current_time - self.speech_start_time > self.max_speech_duration):
            print(f"⚠️ Emergency processing: speech too long ({current_time - self.speech_start_time:.4f}s)")
            return True
            
        return False
    
    def get_audio_for_processing(self) -> Optional[Tuple[np.ndarray, int]]:
        """Get audio data for processing with sliding window"""
        if not self.audio_buffer:
            return None
            
        # Calculate overlap samples for context
        overlap_samples = int(self.sample_rate * self.overlap_duration)
        
        # Start from processed position minus overlap, but ensure it's within buffer bounds
        start_pos = max(0, self.processed_samples - overlap_samples)
        start_pos = min(start_pos, len(self.audio_buffer) - 1)  # Ensure within buffer bounds
        
        # Get audio data from start position
        audio_data = self.audio_buffer[start_pos:]
        
        # If we don't have enough new data, return None
        if len(audio_data) < int(self.sample_rate * 0.5):  # At least 0.5 seconds
            print(f"🔄 Not enough new audio data: {len(audio_data)} samples")
            return None
        
        # Limit to max speech duration
        max_samples = int(self.sample_rate * self.max_speech_duration)
        if len(audio_data) > max_samples:
            audio_data = audio_data[:max_samples]
        
        print(f"📊 Processing audio: start_pos={start_pos}, length={len(audio_data)}, buffer_size={len(self.audio_buffer)}")
        return np.array(audio_data, dtype=np.int16), start_pos


class TranslationProcessor:
    """Handles M2M100 translation"""
    
    def __init__(self, model: M2M100ForConditionalGeneration, tokenizer: M2M100Tokenizer):
        self.model = model
        self.tokenizer = tokenizer
        
        # Language code mapping for M2M100 (use correct M2M100 language tokens)
        self.lang_codes = {
            'ja': 'ja',      # Japanese
            'ko': 'ko',      # Korean  
            'en': 'en',      # English
            'zh': 'zh',      # Chinese (Simplified)
            'es': 'es',      # Spanish
            'fr': 'fr',      # French
            'de': 'de',      # German
            'ru': 'ru',      # Russian
            'pt': 'pt',      # Portuguese
            'it': 'it',      # Italian
            'unknown': 'en'  # Default to English for unknown languages
        }
        
        # Language display names for frontend
        self.lang_names = {
            'ko': '한국어',
            'en': 'English', 
            'ja': '日本語',
            'zh': '中文',
            'es': 'Español',
            'fr': 'Français',
            'de': 'Deutsch',
            'ru': 'Русский',
            'pt': 'Português',
            'it': 'Italiano'
        }
    
    def get_supported_languages(self) -> Dict[str, str]:
        """Get supported languages for frontend"""
        return self.lang_names
    
    def translate(self, text: str, src_lang: str, target_lang: str = 'ko') -> str:
        """Translate text from source language to target language"""
        try:
            if not text.strip():
                return ""
            
            # Map language codes
            src_code = self.lang_codes.get(src_lang, 'en')
            tgt_code = self.lang_codes.get(target_lang, 'ko')
            
            # Skip translation if source and target are the same
            if src_code == tgt_code:
                return text
            
            print(f"🌐 Translating ({src_code} → {tgt_code}): {text[:50]}...")
            
            # Set source language properly for M2M100
            self.tokenizer.src_lang = src_code
            
            # Tokenize with proper source language setting
            encoded = self.tokenizer(text, return_tensors="pt", max_length=512, truncation=True)
            
            # Debug: Print language IDs
            src_lang_id = self.tokenizer.get_lang_id(src_code)
            tgt_lang_id = self.tokenizer.get_lang_id(tgt_code)
            print(f"🔍 Language IDs: {src_code}={src_lang_id}, {tgt_code}={tgt_lang_id}")
            
            # Generate translation with correct target language token
            generated_tokens = self.model.generate(
                **encoded,
                forced_bos_token_id=tgt_lang_id,
                max_length=512,
                num_beams=5,  # Increased beams for better quality
                early_stopping=True,
                no_repeat_ngram_size=2,
                do_sample=False,  # Use greedy decoding for more consistent results
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id
            )
            
            # Decode
            translated = self.tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]
            
            print(f"✅ Translation result: {translated}")
            return translated
            
        except Exception as e:
            print(f"❌ Translation error: {e}")
            import traceback
            traceback.print_exc()
            return text  # Return original text on error


class TextProcessor:
    """Handles text processing and filtering"""
    
    @staticmethod
    def split_sentences(text: str) -> List[str]:
        """Split sentences"""
        return re.split(r"(?<=[.!?\u3002])\s+", text)

    @staticmethod
    def is_hallucination(text: str) -> bool:
        """Filter hallucination text"""
        hallucination_phrases = {
            "you", "you.", "you!", "thank you", "thank you.", "thank you!",
            "thanks", "thanks.", "thanks!", "thanks for watching", "thanks for watching.",
            "thanks for watching!", "thank you for watching", "thank you for watching.",
            "thank you for watching!", "you for watching", "you for watching.",
            "you for watching!"
        }
        return text.lower().strip() in hallucination_phrases

    @staticmethod
    def remove_duplicate_text(new_text: str, last_text: str) -> str:
        """Remove duplicate text from new transcription"""
        if not last_text or not new_text:
            return new_text
        
        # Split into words
        new_words = new_text.split()
        last_words = last_text.split()
        
        # Find the longest common suffix in last_text and prefix in new_text
        max_overlap = min(len(new_words), len(last_words))
        overlap_len = 0
        
        for i in range(1, max_overlap + 1):
            if last_words[-i:] == new_words[:i]:
                overlap_len = i
        
        # Return only the new part
        if overlap_len > 0:
            result = " ".join(new_words[overlap_len:])
            print(f"🔄 Removed {overlap_len} overlapping words: '{' '.join(new_words[:overlap_len])}'")
            return result
        
        return new_text


class WhisperProcessor:
    """Handles Whisper STT processing"""
    
    def __init__(self, model: WhisperModel, translation_processor: Optional[TranslationProcessor] = None):
        self.model = model
        self.text_processor = TextProcessor()
        self.translation_processor = translation_processor
    
    def process_audio(self, audio_data: np.ndarray, session_id: str, start_pos: int, 
                     websocket, loop) -> None:
        """Process Whisper VAD + STT with sliding window"""
        try:
            print(f"🚀 Starting Whisper VAD + STT: {len(audio_data)/16000:.4f}s audio (start_pos: {start_pos})")
            
            # Normalize audio
            audio_float = audio_data.astype(np.float32) / 32768.0
            
            # Check audio level
            audio_level = np.sqrt(np.mean(audio_float ** 2))
            print(f"🔊 Audio level: {audio_level:.4f}")
            
            if audio_level < 0.01:  # Skip if too quiet
                print(f"🔇 Audio too quiet (level: {audio_level:.4f})")
                if session_id in audio_sessions:
                    audio_sessions[session_id].processing = False
                return
            
            # Run Whisper VAD + STT
            start_time = time.time()
            
            # Enable VAD to process only speech segments
            segments, info = self.model.transcribe(
                audio_float,
                language=None,  # Auto-detect language
                condition_on_previous_text=False,
                temperature=0.0,
                vad_filter=True,  # Enable VAD filter
                vad_parameters=dict(
                    min_silence_duration_ms=800,  # Longer silence to ensure speech quality
                    max_speech_duration_s=30,     # Max 30s speech
                    min_speech_duration_ms=400    # Longer minimum speech to avoid noise
                ),
                # Strict parameters to reduce hallucinations
                no_speech_threshold=0.8,  # Much higher threshold
                compression_ratio_threshold=2.0  # Detect repetitive text more aggressively
            )
            
            processing_time = time.time() - start_time
            detected_lang = info.language if info and hasattr(info, "language") else "unknown"
            
            # Process results
            results = []
            for seg in segments:
                for sentence in self.text_processor.split_sentences(seg.text.strip()):
                    if sentence and not self.text_processor.is_hallucination(sentence):
                        results.append(sentence.strip())
            
            if results:
                full_text = " ".join(results)
                
                # Remove duplicate text using sliding window
                if session_id in audio_sessions:
                    session = audio_sessions[session_id]
                    
                    # Remove overlapping content
                    clean_text = self.text_processor.remove_duplicate_text(full_text, session.last_transcription)
                    
                    if clean_text.strip():  # Only send if there's new content
                        print(f"✅ STT completed ({processing_time:.2f}s): [{detected_lang}] {clean_text}")
                        
                        # Translate if translation processor is available
                        translated_text = ""
                        translation_time = 0
                        if self.translation_processor:
                            translation_start = time.time()
                            # Get target language from session
                            target_lang = 'ko'  # Default
                            if session_id in audio_sessions:
                                target_lang = audio_sessions[session_id].target_language
                            
                            translated_text = self.translation_processor.translate(clean_text, detected_lang, target_lang)
                            translation_time = time.time() - translation_start
                            print(f"🌐 Translation completed ({translation_time:.2f}s): {translated_text}")
                        
                        # Send result to client
                        result = {
                            'type': 'stt_result',
                            'text': clean_text,
                            'translated_text': translated_text,
                            'language': detected_lang,
                            'processing_time': processing_time,
                            'translation_time': translation_time,
                            'audio_duration': len(audio_data) / 16000,
                            'audio_level': float(audio_level),
                            'timestamp': time.time()
                        }
                        asyncio.run_coroutine_threadsafe(send_result(websocket, result), loop)
                        
                        # Update tracking variables
                        session.last_transcription = full_text
                        session.processed_samples = start_pos + len(audio_data)
                        
                        print(f"🔄 Updated processed position: {session.processed_samples} samples")
                    else:
                        print(f"🔄 No new content after deduplication")
            else:
                print(f"🔇 No speech segments found ({processing_time:.2f}s processing)")
                asyncio.run_coroutine_threadsafe(send_status(websocket, "🔇 No speech segments found"), loop)
                
        except Exception as e:
            print(f"❌ Whisper VAD + STT error: {e}")
            asyncio.run_coroutine_threadsafe(send_status(websocket, f"❌ STT error: {str(e)}"), loop)
        finally:
            # Clear processing flag
            if session_id in audio_sessions:
                audio_sessions[session_id].processing = False


# WebSocket message handlers
async def send_result(websocket, result: dict) -> None:
    """Send result to client"""
    try:
        await websocket.send(json.dumps(result))
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
        await websocket.send(json.dumps(message))
    except:
        pass


async def process_audio_chunk(websocket, pcm_data: np.ndarray, session_id: str) -> None:
    """Process audio chunk with real-time VAD"""
    try:
        if session_id not in audio_sessions:
            audio_sessions[session_id] = AudioSession()
            print(f"🎤 New audio session created: {session_id}")
        
        session = audio_sessions[session_id]
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
                
                # Create processor with translation support
                translation_proc = None
                if translation_model and translation_tokenizer:
                    translation_proc = TranslationProcessor(translation_model, translation_tokenizer)
                
                processor = WhisperProcessor(model, translation_proc)
                threading.Thread(
                    target=processor.process_audio,
                    args=(audio_data, session_id, start_pos, websocket, loop),
                    daemon=True
                ).start()
            else:
                session.processing = False
                
    except Exception as e:
        print(f"❌ Audio processing error: {e}")


async def handle_websocket(websocket, path: str) -> None:
    """Handle WebSocket connection"""
    session_id = f"session_{len(connected_clients)}_{int(time.time())}"
    connected_clients.add(websocket)
    print(f"🔌 WebSocket connected (session: {session_id}, total: {len(connected_clients)})")
    
    try:
        # Connection confirmation message
        await websocket.send(json.dumps({
            'type': 'connected',
            'message': 'Whisper VAD STT server connected',
            'session_id': session_id
        }))
        
        async for message in websocket:
            try:
                data = json.loads(message)
                
                if data['type'] == 'audio':
                    # Decode Base64 to extract PCM data
                    pcm_base64 = data['data']
                    pcm_bytes = base64.b64decode(pcm_base64)
                    pcm_data = np.frombuffer(pcm_bytes, dtype=np.int16)
                    
                    # Process VAD
                    await process_audio_chunk(websocket, pcm_data, session_id)
                    
                elif data['type'] == 'start':
                    print(f"🎤 Streaming started (session: {session_id})")
                    await send_status(websocket, "🎤 Speech recognition started")
                    
                elif data['type'] == 'stop':
                    print(f"🛑 Streaming stopped (session: {session_id})")
                    if session_id in audio_sessions:
                        del audio_sessions[session_id]
                    await send_status(websocket, "🛑 Speech recognition stopped")
                
                elif data['type'] == 'set_target_language':
                    # Set translation target language
                    target_lang = data.get('language', 'ko')
                    if session_id in audio_sessions:
                        audio_sessions[session_id].target_language = target_lang
                        print(f"🌐 Target language set to: {target_lang} (session: {session_id})")
                        await send_status(websocket, f"🌐 Translation target set to: {target_lang}")
                
                elif data['type'] == 'get_supported_languages':
                    # Send supported languages list
                    if translation_model and translation_tokenizer:
                        translation_proc = TranslationProcessor(translation_model, translation_tokenizer)
                        supported_langs = translation_proc.get_supported_languages()
                        await websocket.send(json.dumps({
                            'type': 'supported_languages',
                            'languages': supported_langs
                        }))
                    else:
                        await websocket.send(json.dumps({
                            'type': 'supported_languages',
                            'languages': {}
                        }))
                
            except json.JSONDecodeError:
                print(f"❌ JSON parsing error")
            except Exception as e:
                print(f"❌ Message processing error: {e}")
                
    except Exception as e:
        print(f"❌ WebSocket processing error: {e}")
    finally:
        connected_clients.discard(websocket)
        if session_id in audio_sessions:
            del audio_sessions[session_id]
        print(f"❌ WebSocket disconnected (session: {session_id}, remaining: {len(connected_clients)})")


def initialize_whisper_model() -> WhisperModel:
    """Initialize Whisper model"""
    print("🚀 Loading Whisper model...")
    model = WhisperModel("small", device="cpu", compute_type="int8")
    print("✅ Whisper model loaded successfully")
    return model


def initialize_translation_model() -> Tuple[M2M100ForConditionalGeneration, M2M100Tokenizer]:
    """Initialize M2M100 translation model"""
    try:
        print("🌐 Loading M2M100 translation model...")
        model = M2M100ForConditionalGeneration.from_pretrained("facebook/m2m100_418M")
        tokenizer = M2M100Tokenizer.from_pretrained("facebook/m2m100_418M")
        print("✅ M2M100 translation model loaded successfully")
        return model, tokenizer
    except Exception as e:
        print(f"⚠️ Failed to load translation model: {e}")
        print("📝 Translation will be disabled. Install transformers and torch to enable translation.")
        return None, None


async def main():
    """Main server function"""
    global model, translation_model, translation_tokenizer
    
    # Initialize Whisper model
    model = initialize_whisper_model()
    
    # Initialize translation model
    translation_model, translation_tokenizer = initialize_translation_model()
    
    # Start WebSocket server on port 5000 to match Kubernetes deployment
    print("🎤 Starting WebSocket STT server on ws://0.0.0.0:5000")
    
    async with websockets.serve(handle_websocket, "0.0.0.0", 5001):
        print("✅ WebSocket server started successfully")
        print("🔗 Connect to: ws://localhost:5000")
        print("🛑 Press Ctrl+C to stop")
        
        # Keep server running
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
