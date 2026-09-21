#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Audio build script for Zongheng audio assets."""
import json
import os
import subprocess
import sys
import re
from pathlib import Path

FFMPEG = "C:/Users/sheep/code/ComfyUI/.venv/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
SOURCE_DIR = "C:/Users/sheep/code/ComfyUI/output/zongheng_audio/"
OUTPUT_DIR = "public/audio"

def find_flac(take_id):
    """Find source FLAC file for take_id."""
    pattern = f"{take_id}_"
    for f in os.listdir(SOURCE_DIR):
        if f.startswith(pattern) and f.endswith(".flac"):
            return os.path.join(SOURCE_DIR, f)
    return None

def ffmpeg_cmd(input_file, output_file, filters, args):
    """Run ffmpeg command."""
    cmd = [FFMPEG, "-i", input_file, "-y"]
    if filters:
        cmd.extend(["-af", filters])
    cmd.extend(args)
    cmd.extend(["-c:a", "libmp3lame", output_file])
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0, result.stderr

def get_duration(mp3_file):
    """Get duration from MP3."""
    cmd = [FFMPEG, "-i", mp3_file]
    result = subprocess.run(cmd, capture_output=True, text=True)
    m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', result.stderr)
    if m:
        h, mn, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
        return h * 3600 + mn * 60 + s
    return 0

def get_peak_dbfs(mp3_file):
    """Measure peak in dBFS."""
    cmd = [FFMPEG, "-i", mp3_file, "-af", "volumedetect", "-f", "null", "-"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    m = re.search(r'max_volume: ([-\d.]+) dB', result.stderr)
    return float(m.group(1)) if m else None

def get_loudness(mp3_file):
    """Measure integrated loudness and true peak."""
    cmd = [FFMPEG, "-i", mp3_file, "-af",
           "loudnorm=I=-20:TP=-2:LRA=11:print_format=json", "-f", "null", "-"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        m = re.search(r'\{[^}]+\}', result.stderr, re.DOTALL)
        if m:
            data = json.loads(m.group())
            return float(data.get('input_i', -20)), float(data.get('input_tp', -2))
    except:
        pass
    return None, None

def process_sfx(take_id, cue):
    """Process sound effect: mono, 44.1kHz, trim, 3ms fade in, 40ms fade out, -3dBFS."""
    flac = find_flac(take_id)
    if not flac:
        return {"error": f"FLAC not found for {take_id}"}

    mp3 = os.path.join(OUTPUT_DIR, f"{cue}.mp3")

    # Apply silence removal and fades
    # trim silence below -50dB, 3ms fade in, 40ms fade out
    filters = "silenceremove=start_periods=1:start_duration=1:start_threshold=-50dB,afade=t=in:d=0.003,afade=t=out:d=0.04"
    args = ["-ac", "1", "-ar", "44100", "-q:a", "4"]

    ok, err = ffmpeg_cmd(flac, mp3, filters, args)
    if not ok:
        return {"error": f"Encoding failed"}

    # Check peak and normalize if needed
    peak = get_peak_dbfs(mp3)
    if peak is None:
        return {"error": "Peak measurement failed"}

    # Normalize to -3dBFS if needed
    if abs(peak - (-3.0)) > 0.1:
        gain = -3.0 - peak
        temp = mp3 + ".tmp"
        ok, err = ffmpeg_cmd(mp3, temp, f"volume={gain}dB", ["-q:a", "4"])
        if ok:
            os.rename(temp, mp3)
            peak = get_peak_dbfs(mp3)
        else:
            if os.path.exists(temp):
                os.remove(temp)
            return {"error": "Normalization failed"}

    duration = get_duration(mp3)
    size = os.path.getsize(mp3)

    return {
        "duration": round(duration, 2),
        "peak_dbfs": round(peak, 2),
        "size": size
    }

def process_bgm(take_id, cue):
    """Process background music: stereo, loudnorm -20LUFS/-2dBTP, 20ms fade in, 60ms fade out."""
    flac = find_flac(take_id)
    if not flac:
        return {"error": f"FLAC not found for {take_id}"}

    mp3 = os.path.join(OUTPUT_DIR, f"{cue}.mp3")
    temp = mp3 + ".tmp"

    # Pass 1: encode with fades to measure loudness
    # 20ms fade in, 60ms fade out
    filters = "afade=t=in:d=0.02,afade=t=out:d=0.06"
    args = ["-q:a", "5"]

    ok, err = ffmpeg_cmd(flac, temp, filters, args)
    if not ok:
        return {"error": f"Pass 1 failed"}

    # Measure loudness
    loudness, tp = get_loudness(temp)
    os.remove(temp)

    # Pass 2: apply loudnorm with measured value
    if loudness is not None:
        filters = f"loudnorm=I=-20:TP=-2:LRA=11:measured_I={loudness},afade=t=in:d=0.02,afade=t=out:d=0.06"
    else:
        filters = "loudnorm=I=-20:TP=-2:LRA=11,afade=t=in:d=0.02,afade=t=out:d=0.06"

    args = ["-q:a", "5"]
    ok, err = ffmpeg_cmd(flac, mp3, filters, args)
    if not ok:
        return {"error": f"Pass 2 failed"}

    # Measure final loudness
    loudness, tp = get_loudness(mp3)
    duration = get_duration(mp3)
    size = os.path.getsize(mp3)

    return {
        "duration": round(duration, 2),
        "loudness": round(loudness, 2) if loudness else None,
        "tp_dbfs": round(tp, 2) if tp else None,
        "size": size
    }

def main():
    # Load accepted
    accepted_path = "C:/Users/sheep/AppData/Local/Temp/claude/C--Users-sheep-code-obsidian/1d166e4e-76ed-44ee-930b-f3675bbfddc6/scratchpad/audio/accepted.json"
    with open(accepted_path, 'r', encoding='utf-8') as f:
        accepted = json.load(f)

    # Load job files for prompts
    jobs_dirs = [
        "C:/Users/sheep/AppData/Local/Temp/claude/C--Users-sheep-code-obsidian/1d166e4e-76ed-44ee-930b-f3675bbfddc6/scratchpad/audio/"
    ]

    jobs_map = {}
    for job_dir in jobs_dirs:
        for fname in os.listdir(job_dir):
            if fname.startswith("jobs") and fname.endswith(".json"):
                with open(os.path.join(job_dir, fname), 'r', encoding='utf-8') as f:
                    for job in json.load(f):
                        jobs_map[job['id']] = job

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    manifest = {"version": 1, "cues": {}}
    prompts = {}
    looped = {"bgm.landing", "bgm.table.alliance.chu", "bgm.table.alliance.qin",
              "bgm.table.conquest.chu", "bgm.table.conquest.qin",
              "bgm.table.reform.chu", "bgm.table.reform.qin"}

    print(f"Processing {len(accepted)} files...")
    results = {}

    for cue in sorted(accepted.keys()):
        take_id = accepted[cue]
        is_bgm = cue.startswith("bgm.")

        print(f"  {cue}... ", end="", flush=True)

        try:
            result = process_bgm(take_id, cue) if is_bgm else process_sfx(take_id, cue)
            if "error" in result:
                print(f"ERROR: {result['error']}")
            else:
                print("OK")
            results[cue] = result

            if "error" not in result:
                manifest["cues"][cue] = {
                    "file": f"{cue}.mp3",
                    "kind": "bgm" if is_bgm else "sfx",
                    "seconds": result["duration"],
                    "gain": 1,
                    "loop": cue in looped,
                    "source": take_id
                }

                # Add prompts
                if take_id in jobs_map:
                    job = jobs_map[take_id]
                    prompts[cue] = {
                        "source": take_id,
                        "model": "minimax-music-3" if is_bgm else "stable-audio-3-medium",
                        "seed": job.get("seed", 0),
                        "prompt": job.get("prompt", job.get("caption", ""))
                    }
                    if "lyrics" in job:
                        prompts[cue]["lyrics"] = job["lyrics"]

        except Exception as e:
            print(f"EXCEPTION: {e}")
            results[cue] = {"error": str(e)}

    # Write outputs
    with open(os.path.join(OUTPUT_DIR, "manifest.json"), 'w') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write('\n')

    with open(os.path.join(OUTPUT_DIR, "prompts.json"), 'w') as f:
        json.dump(prompts, f, indent=2, ensure_ascii=False)
        f.write('\n')

    # Summary
    ok = sum(1 for r in results.values() if "error" not in r)
    err = len(results) - ok
    total_size = sum(r.get("size", 0) for r in results.values() if "error" not in r)

    print(f"\nSuccess: {ok}/{len(accepted)}")
    print(f"Errors: {err}")
    print(f"Total size: {total_size / 1024 / 1024:.1f} MB")

    return 0 if err == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
