# stt_whisper_vad.py
import sounddevice as sd
import numpy as np
import webrtcvad
import threading
import queue
import time
import re
from faster_whisper import WhisperModel


class WhisperVAD:
    def __init__(
        self, result_queue: queue.Queue, device_index: int = None, model_size="small"
    ):
        self.result_queue = result_queue
        self.device_index = device_index
        self.sample_rate = 16000
        self.frame_duration = 30  # ms
        self.frame_size = int(self.sample_rate * self.frame_duration / 1000)
        self.vad = webrtcvad.Vad(1)
        self.model = WhisperModel(model_size, compute_type="int8")
        self.running = False

        self.buffer = []
        self.speeching = False
        self.silence_count = 0
        self.voice_start_time = None

        self.SILENCE_END_FRAMES = 10
        self.MAX_SPEECH_DURATION = 20.0  # seconds

    def _is_speech(self, frame_bytes):
        return self.vad.is_speech(frame_bytes, self.sample_rate)

    def _split_sentences(self, text):
        return re.split(r"(?<=[.!?\u3002])\s+", text)  # Includes Korean period 。

    def _transcribe(self, audio_bytes):
        audio_np = (
            np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        )
        if np.max(np.abs(audio_np)) < 0.02:
            return

        segments, info = self.model.transcribe(audio_np, language=None)
        detected_lang = info.language if info and hasattr(info, "language") else "unknown"
        
        hallucination_phrases = {
            # Basic "you" variations
            "you",
            "you.",
            "you!",
            
            # "Thank you" variations
            "thank you",
            "thank you.",
            "thank you!",
            
            "thanks",
            "thanks.",
            "thanks!",
            
            # "Thanks for watching" variations
            "thanks for watching",
            "thanks for watching.",
            "thanks for watching!",
            
            # "Thank you for watching" variations
            "thank you for watching",
            "thank you for watching.",
            "thank you for watching!",
            
            # Incomplete phrases
            "you for watching",
            "you for watching.",
            "you for watching!"
        }

        for seg in segments:
            for sentence in self._split_sentences(seg.text.strip()):
                lowercased_sentence = sentence.lower()
                if sentence and lowercased_sentence not in hallucination_phrases:
                    self.result_queue.put((sentence, detected_lang))  # ✅ 튜플로 넣기

    def _audio_callback(self, indata, frames, time_info, status):
        if status:
            print("⚠️", status)
        frame_bytes = bytes(indata)

        if self._is_speech(frame_bytes):
            self.buffer.append(frame_bytes)
            self.silence_count = 0
            if not self.speeching:
                self.voice_start_time = time.time()
            self.speeching = True

            # 강제 종료 조건: 너무 길게 말할 때
            if self.voice_start_time and (
                time.time() - self.voice_start_time > self.MAX_SPEECH_DURATION
            ):
                self._end_utterance()

        elif self.speeching:
            self.silence_count += 1
            if self.silence_count > self.SILENCE_END_FRAMES:
                self._end_utterance()

    def _end_utterance(self):
        audio_data = b"".join(self.buffer)
        self.buffer = []
        self.silence_count = 0
        self.speeching = False
        self.voice_start_time = None
        threading.Thread(
            target=self._transcribe, args=(audio_data,), daemon=True
        ).start()

    def _run_stream(self):
        with sd.RawInputStream(
            samplerate=self.sample_rate,
            blocksize=self.frame_size,
            device=self.device_index,
            dtype="int16",
            channels=1,
            callback=self._audio_callback,
        ):
            while self.running:
                sd.sleep(100)

    def start(self):
        self.running = True
        threading.Thread(target=self._run_stream, daemon=True).start()

    def stop(self):
        self.running = False


def list_microphones():
    print("🔍 사용 가능한 마이크 목록:")
    devices = sd.query_devices()
    for idx, dev in enumerate(devices):
        if dev["max_input_channels"] > 0:
            print(f"[{idx}] {dev['name']}")

