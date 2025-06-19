import asyncio
import queue
from stt_whisper_vad import WhisperVAD, list_microphones
from translator_gpt import GPTTranslator

# 음성 인식 결과를 담는 큐
result_queue = queue.Queue()

# 출력 언어 선택
langs = {
    "1": {"name": "Korean", "code": "ko"},
    "2": {"name": "English", "code": "en"},
    "3": {"name": "Japanese", "code": "ja"},
    "4": {"name": "Chinese", "code": "zh"},
}

print("\n🌐 번역 출력 언어를 선택하세요:")
for k, v in langs.items():
    print(f"[{k}] {v['name']}")

choice = input("번호 입력: ").strip()
if choice not in langs:
    print("❌ 잘못된 선택입니다. 기본값으로 한국어로 설정합니다.")
    choice = "1"

output_lang = langs[choice]["name"]
output_lang_code = langs[choice]["code"]

translator = GPTTranslator(tgt_lang=output_lang, secret_path=".openai_secret")


async def print_loop():
    while True:
        if not result_queue.empty():
            item = result_queue.get()
            if isinstance(item, tuple) and len(item) == 2:
                text, detected_lang = item
            else:
                text, detected_lang = item, "unknown"

            # print(f"📝 ({detected_lang}) {text}")
            try:
                if detected_lang == output_lang_code:
                    print(f"🌐 {text}")
                else:
                    translated = translator.translate(text, detected_lang)
                    print(f"🌐 {translated}")
            except Exception as e:
                print(f"❗ 번역 에러: {e}")
        await asyncio.sleep(0.05)


async def main():
    list_microphones()
    try:
        device_index = int(input("🎙️ 사용할 마이크 번호를 입력하세요: "))
    except ValueError:
        print("⚠️ 숫자로 입력해주세요.")
        return

    stt = WhisperVAD(result_queue, device_index=device_index)
    stt.start()
    print(f"🟢 실시간 다국어 → {output_lang} 통역 시작! (Ctrl+C로 종료)")
    try:
        await print_loop()
    except KeyboardInterrupt:
        print("🛑 종료 중...")
    finally:
        stt.stop()


if __name__ == "__main__":
    asyncio.run(main())