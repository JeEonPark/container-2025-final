"""
Whisper STT processing with VAD
"""

import asyncio
import threading
import time
import numpy as np
from typing import Optional

from faster_whisper import WhisperModel
from processors.text_processor import TextProcessor
from processors.translation_processor import TranslationProcessor
from utils.websocket_utils import send_result, send_status


class WhisperProcessor:
    """Handles Whisper STT processing"""
    
    def __init__(self, model: WhisperModel, translation_processor: Optional[TranslationProcessor] = None):
        self.model = model
        self.text_processor = TextProcessor()
        self.translation_processor = translation_processor
    
    def process_audio(self, audio_data: np.ndarray, session_id: str, start_pos: int, 
                     websocket, loop, audio_sessions) -> None:
        """Process Whisper VAD + STT with sliding window"""
        try:
            print(f"🚀 Starting Whisper VAD + STT: {len(audio_data)/16000:.4f}s audio (start_pos: {start_pos})")
            
            # Normalize audio
            audio_float = audio_data.astype(np.float32) / 32768.0
            
            # Check audio level
            audio_level = np.sqrt(np.mean(audio_float ** 2))
            print(f"🔊 Audio level: {audio_level:.4f}")
            
            if audio_level < 0.005:  # Skip if too quiet (increased to filter out noise)
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
                        print(f"🔍 Translation processor available: {self.translation_processor is not None}")
                        if self.translation_processor:
                            translation_start = time.time()
                            # Get target language from session
                            target_lang = 'ko'  # Default
                            if session_id in audio_sessions and hasattr(audio_sessions[session_id], 'target_language'):
                                target_lang = audio_sessions[session_id].target_language
                                print(f"🎯 Using target language: {target_lang}")
                            
                            translated_text = self.translation_processor.translate(clean_text, detected_lang, target_lang)
                            translation_time = time.time() - translation_start
                            print(f"🌐 Translation completed ({translation_time:.2f}s): {translated_text}")
                        else:
                            print("⚠️ Translation processor is None, skipping translation")
                        
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
