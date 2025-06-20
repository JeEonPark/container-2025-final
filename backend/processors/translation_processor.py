"""
GPT-based translation processing
"""

import os
from typing import Dict
from openai import OpenAI
from config import LANGUAGE_NAMES, GPT_MODEL, OPENAI_SECRET_PATH


class TranslationProcessor:
    """Handles GPT-based translation"""
    
    def __init__(self, secret_path=None):
        """
        Initialize GPT translator
        
        Args:
            secret_path: Path to OpenAI API key file (optional, uses config default)
        """
        if secret_path is None:
            secret_path = OPENAI_SECRET_PATH
        self.client = self._load_openai_client(secret_path)
        self.history = []  # Keep translation history for context
        
    def _load_openai_client(self, secret_path: str):
        """Load OpenAI client with API key"""
        if not os.path.exists(secret_path):
            raise FileNotFoundError(f"❌ API 키 파일이 없습니다: {secret_path}")
        with open(secret_path, "r") as f:
            key = f.read().strip()
        if not key:
            raise ValueError("❌ API 키가 비어 있습니다.")
        return OpenAI(api_key=key)
        
    def get_supported_languages(self) -> Dict[str, str]:
        """Get supported languages for frontend"""
        return LANGUAGE_NAMES
    
    def translate(self, text: str, src_lang: str, target_lang: str = 'ko') -> str:
        """
        Translate text using GPT
        
        Args:
            text: Text to translate
            src_lang: Source language code (detected language)
            target_lang: Target language code
            
        Returns:
            Translated text
        """
        try:
            if not text.strip():
                return ""
            
            # Get language names
            src_lang_name = self._get_language_name(src_lang)
            target_lang_name = self._get_language_name(target_lang)
            
            # Skip translation if source and target are the same
            if src_lang.lower() == target_lang.lower():
                return text.strip()
                
            print(f"🌐 Translating ({src_lang_name} → {target_lang_name}): {text[:50]}...")
            
            # Create system message for GPT
            messages = [
                {
                    "role": "system",
                    "content": (
                        f"You are a professional interpreter.\n\n"
                        f"You will receive short spoken sentences from a live transcription system.\n"
                        f"The input sentence is in {src_lang_name} and may contain minor transcription errors.\n\n"
                        f"Your job is to translate ONLY the input sentence into natural, fluent spoken {target_lang_name}.\n\n"
                        f"⚠️ CRITICAL RULES:\n"
                        f"1. Translate the meaning of the input sentence **exactly as it is**.\n"
                        f"   → Do NOT add or remove any nuance.\n"
                        f"   → If the original is incomplete, keep the translation incomplete too.\n"
                        f"2. Do NOT assume or guess the speaker's intention.\n"
                        f"   → If it doesn't say 'Can I', 'May I', 'Is it okay to', etc., DO NOT add it.\n"
                        f"3. Do NOT make the sentence more polite or more casual than the original.\n"
                        f"4. Keep punctuation and sentence boundaries similar to the original.\n"
                        f"5. If the sentence is unnatural or incomplete, STILL translate it **as is**.\n\n"
                        f"Respond ONLY with the translated sentence. No extra words, no explanation, no commentary."
                    )
                },
                {
                    "role": "user",
                    "content": text.strip()
                }
            ]
            
            # Call GPT API
            response = self.client.chat.completions.create(
                model=GPT_MODEL,
                messages=messages,
                temperature=0.3,
                max_tokens=256,
            )
            
            translated = response.choices[0].message.content.strip()
            print(f"✅ Translation result: {translated}")
            
            # Save to history
            self.history.append({
                'original': text,
                'translated': translated,
                'src_lang': src_lang,
                'target_lang': target_lang
            })
            
            return translated
            
        except Exception as e:
            print(f"❌ Translation error: {e}")
            print(f"❌ Error type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            return text  # Return original text on error
    
    def _get_language_name(self, lang_code: str) -> str:
        """Convert language code to language name"""
        lang_map = {
            'ko': 'Korean',
            'en': 'English', 
            'ja': 'Japanese',
            'zh': 'Chinese',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'ru': 'Russian',
            'pt': 'Portuguese',
            'it': 'Italian'
        }
        return lang_map.get(lang_code, 'English') 
