import wave
import math
import struct
import random
import os

def write_wav(filename, samples, sample_rate=44100):
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        for s in samples:
            s = math.tanh(s)
            int_sample = int(s * 32767)
            wav_file.writeframesraw(struct.pack('<h', int_sample))
    print(f"Generated {filename}")

def generate_cyber_pop(bpm=124):
    num_samples = 30 * 44100
    samples_per_beat = int((60/bpm) * 44100)
    samples = []
    for i in range(num_samples):
        time = i / 44100
        beat_idx = i // samples_per_beat
        sub_beat = (i % samples_per_beat) / samples_per_beat
        chord_freqs = [220, 261, 329] if (beat_idx // 4) % 2 == 0 else [196, 246, 293]
        chord = 0
        for f in chord_freqs:
            chord += 0.2 * ((i * f / 44100) % 1.0 < 0.5) # Pulse wave
        chord *= 0.3 * (0.6 + 0.4 * math.sin(2 * math.pi * time * 4))
        kick = 0
        if (beat_idx % 1 == 0) and sub_beat < 0.15:
            kick = math.sin(2 * math.pi * 120 * math.exp(-30 * sub_beat) * time)
        samples.append(chord + kick * 0.6)
    return samples

def generate_dance_energy(bpm=130):
    num_samples = 30 * 44100
    samples_per_beat = int((60/bpm) * 44100)
    samples = []
    for i in range(num_samples):
        time = i / 44100
        beat_idx = i // samples_per_beat
        sub_beat = (i % samples_per_beat) / samples_per_beat
        # Disco Bass
        bass_freq = 110 if beat_idx % 2 == 0 else 165
        bass = math.sin(2 * math.pi * bass_freq * time) * 0.5
        # Funky Synth
        syn = 0
        if (i // (samples_per_beat // 4)) % 8 < 4:
            syn = math.sin(2 * math.pi * 440 * time) * 0.2 * math.exp(-10 * (i % (samples_per_beat // 4)) / (samples_per_beat // 4))
        # 4/4 Kick
        kick = math.sin(2 * math.pi * 80 * math.exp(-40 * sub_beat) * time) * 0.8 if sub_beat < 0.1 else 0
        samples.append(bass + syn + kick)
    return samples

def generate_lofi_pop(bpm=90):
    num_samples = 30 * 44100
    samples_per_beat = int((60/bpm) * 44100)
    samples = []
    for i in range(num_samples):
        time = i / 44100
        beat_idx = i // samples_per_beat
        sub_beat = (i % samples_per_beat) / samples_per_beat
        # Soft electric piano
        piano = math.sin(2 * math.pi * 329.63 * time) * 0.3 * (0.8 + 0.2 * math.sin(2 * math.pi * time * 2))
        # Boombap beat
        kick = math.sin(2 * math.pi * 60 * math.exp(-15 * sub_beat) * time) * 0.7 if (beat_idx % 4 == 0 or beat_idx % 4 == 2.5) and sub_beat < 0.2 else 0
        snare = random.uniform(-1, 1) * 0.3 * math.exp(-10 * sub_beat) if beat_idx % 4 == 2 and sub_beat < 0.2 else 0
        samples.append(piano + kick + snare)
    return samples

if __name__ == "__main__":
    os.makedirs("public/audio", exist_ok=True)
    write_wav("public/audio/track-pop.wav", generate_cyber_pop())
    write_wav("public/audio/track-dance.wav", generate_dance_energy())
    write_wav("public/audio/track-lofi.wav", generate_lofi_pop())
    write_wav("public/audio/track-dark.wav", generate_dance_energy()) # Replaced old dark with dance for now
