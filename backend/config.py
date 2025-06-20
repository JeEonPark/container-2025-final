"""
Configuration settings for the STT server
"""

# Audio settings
SAMPLE_RATE = 16000
MAX_BUFFER_DURATION = 60  # seconds
OVERLAP_DURATION = 0.1  # seconds

# VAD settings
MIN_SPEECH_DURATION = 0.4  # seconds
MAX_SPEECH_DURATION = 30.0  # seconds
SILENCE_THRESHOLD = 0.005  # Audio level threshold for silence (increased to reduce noise detection)
SILENCE_DURATION_THRESHOLD = 0.2  # seconds of silence to trigger processing

# Whisper settings
WHISPER_MODEL_SIZE = "small"
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"

# GPT Translation settings
GPT_MODEL = "gpt-4.1-nano-2025-04-14"  # Cost-effective model for translation
OPENAI_SECRET_PATH = ".openai_secret"
DEFAULT_TARGET_LANGUAGE = 'ko'

# Server settings
HOST = "0.0.0.0"
PORT = 5000

# Language display names for frontend
LANGUAGE_NAMES = {
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

# Hallucination filter phrases
HALLUCINATION_PHRASES = {
    "you", "you.", "you!", "thank you", "thank you.", "thank you!",
    "thanks", "thanks.", "thanks!", "thanks for watching", "thanks for watching.",
    "thanks for watching!", "thank you for watching", "thank you for watching.",
    "thank you for watching!", "you for watching", "you for watching.",
    "you for watching!"
} 
