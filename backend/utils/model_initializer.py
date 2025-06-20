"""
Model initialization utilities
"""

from typing import Optional
from faster_whisper import WhisperModel
from processors.translation_processor import TranslationProcessor
from config import WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE


def initialize_whisper_model() -> WhisperModel:
    """Initialize Whisper model"""
    print("🚀 Loading Whisper model...")
    model = WhisperModel(WHISPER_MODEL_SIZE, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE_TYPE)
    print("✅ Whisper model loaded successfully")
    return model


def initialize_translation_processor(secret_path=".openai_secret") -> Optional[TranslationProcessor]:
    """Initialize GPT-based translation processor"""
    try:
        print("🌐 Loading GPT translation processor...")
        processor = TranslationProcessor(secret_path)
        print("✅ GPT translation processor loaded successfully")
        return processor
    except Exception as e:
        print(f"⚠️ Failed to load GPT translation processor: {e}")
        print("📝 Translation will be disabled. Make sure OpenAI API key is configured.")
        import traceback
        traceback.print_exc()  # 자세한 에러 메시지 출력
        return None 
