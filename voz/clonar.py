"""Clona uma voz com Qwen3-TTS (CPU).
Uso: python clonar.py referencia.wav "transcrição exata da referência" "texto novo a falar" saida.wav [idioma]
"""
import sys, time, soundfile as sf, torch
from qwen_tts import Qwen3TTSModel

ref_audio, ref_text, text, out = sys.argv[1:5]
lang = sys.argv[5] if len(sys.argv) > 5 else "Portuguese"
torch.set_num_threads(torch.get_num_threads())
t = time.time()
model = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-0.6B-Base")
print(f"modelo carregado em {time.time()-t:.0f}s")
t = time.time()
wavs, sr = model.generate_voice_clone(text=text, language=lang, ref_audio=ref_audio, ref_text=ref_text)
sf.write(out, wavs[0], sr)
print(f"gerado {out} ({len(wavs[0])/sr:.1f}s de áudio) em {time.time()-t:.0f}s")
