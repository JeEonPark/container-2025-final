import os
from openai import OpenAI


class GPTTranslator:
    """
    GPT 기반 문맥 번역기 (자동 소스 언어 감지 지원)

    - 입력 언어는 외부에서 감지되어 전달됨 (Whisper 등)
    - 대상 언어는 생성 시 지정됨
    """

    def __init__(self, tgt_lang="Korean", secret_path=".openai_secret"):
        self.tgt = tgt_lang
        self.history = []
        self.client = self._load_openai_client(secret_path)

    def _load_openai_client(self, secret_path: str):
        if not os.path.exists(secret_path):
            raise FileNotFoundError(f"❌ API 키 파일이 없습니다: {secret_path}")
        with open(secret_path, "r") as f:
            key = f.read().strip()
        if not key:
            raise ValueError("❌ API 키가 비어 있습니다.")
        return OpenAI(api_key=key)

    def translate(self, text: str, detected_lang: str) -> str:
        if not text.strip():
            return ""

        # 원본 언어가 대상 언어와 같으면 번역 안 함
        if detected_lang.lower() == self.tgt.lower():
            return text.strip()

        messages = [
            {
                "role": "system",
                "content": (
                    f"You are a professional interpreter.\n\n"
                    f"You will receive short spoken sentences from a live transcription system.\n"
                    f"The input sentence is in {detected_lang} and may contain minor transcription errors.\n\n"
                    f"Your job is to translate ONLY the input sentence into natural, fluent spoken {self.tgt}.\n\n"
                    f"⚠️ CRITICAL RULES:\n"
                    f"1. Translate the meaning of the input sentence **exactly as it is**.\n"
                    f"   → Do NOT add or remove any nuance.\n"
                    f"   → If the original ends at '〜しても', you MUST stop at '…해도'.\n"
                    f"2. Do NOT assume or guess the speaker's intention.\n"
                    f"   → If it doesn’t say 'Can I', 'May I', 'Is it okay to', etc., DO NOT add it.\n"
                    f"3. Do NOT make the sentence more polite or more casual than the original.\n"
                    f"4. Keep punctuation and sentence boundaries similar to the original.\n"
                    f"5. If the sentence is unnatural or incomplete, STILL translate it **as is**.\n\n"
                    f"Examples:\n"
                    f"• Input: 話しても\n"
                    f"  ✅ Output: 말해도\n"
                    f"  ❌ Wrong: 말해도 돼?, 말해도 괜찮아?\n\n"
                    f"Respond ONLY with the translated sentence. No extra words, no explanation, no commentary."
                )
            },
            {
                "role": "user",
                "content": text.strip()
            }
        ]
        
        # print(messages)

        try:
            response = self.client.chat.completions.create(
                model="gpt-4.1-nano-2025-04-14",
                messages=messages,
                temperature=0.3,
                max_tokens=256,
            )
            translated = response.choices[0].message.content.strip()
        except Exception as e:
            return f"❗ 번역 에러: {e}"

        self.history.append(text)
        return translated