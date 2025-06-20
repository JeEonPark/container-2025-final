"""
Audio session management for real-time VAD processing
"""

import time
import numpy as np
from typing import Optional, Tuple

from config import (
    SAMPLE_RATE, MAX_BUFFER_DURATION, OVERLAP_DURATION,
    MIN_SPEECH_DURATION, MAX_SPEECH_DURATION, 
    SILENCE_THRESHOLD, SILENCE_DURATION_THRESHOLD,
    DEFAULT_TARGET_LANGUAGE
)


class AudioSession:
    """Manages audio session state and VAD processing"""
    
    def __init__(self):
        self.sample_rate = SAMPLE_RATE
        self.audio_buffer = []
        self.last_process_time = time.perf_counter()
        self.processing = False
        
        # Real-time VAD settings
        self.min_speech_duration = MIN_SPEECH_DURATION
        self.max_speech_duration = MAX_SPEECH_DURATION
        self.silence_threshold = SILENCE_THRESHOLD
        self.silence_duration_threshold = SILENCE_DURATION_THRESHOLD
        
        # VAD state tracking
        self.is_speech_active = False
        self.speech_start_time = 0
        self.last_speech_time = 0
        self.silence_start_time = 0
        
        # Sliding window settings
        self.processed_samples = 0  # Track how many samples have been processed
        self.last_transcription = ""  # Store last transcription for deduplication
        self.overlap_duration = OVERLAP_DURATION
        
        # Translation settings
        self.target_language = DEFAULT_TARGET_LANGUAGE
        
    def add_audio(self, pcm_data: np.ndarray) -> None:
        """Add audio data to buffer with automatic trimming"""
        self.audio_buffer.extend(pcm_data)
        
        # Remove old data if buffer is too large
        max_samples = self.sample_rate * MAX_BUFFER_DURATION
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
