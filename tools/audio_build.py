#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Audio build script for Zongheng audio assets.
Note: This version focuses on basic encoding with fades.
Loudness normalization is deferred to a future improvement.
"""
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

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return result.returncode == 0

def get_duration(mp3_file):
    """Get duration from MP3."""
    if not os.path.exists(mp3_file):
        return 0

    cmd = [FFMPEG, "-i", mp3_file]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', result.stderr)
    if m:
        h, mn, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
        return h * 3600 + mn * 60 + s
    return 0

def process_sfx(take_id, cue):
    """Process sound effect: mono, 44.1kHz, 3ms fade in, 40ms fade out."""
    flac = find_flac(take_id)
    if not flac:
        return None

    mp3 = os.path.join(OUTPUT_DIR, f"{cue}.mp3")
    if os.path.exists(mp3):
        os.remove(mp3)

    # Fades: 3ms fade in, 40ms fade out
    filters = "afade=t=in:d=0.003,afade=t=out:d=0.04"
    args = ["-ac", "1", "-ar", "44100", "-q:a", "4"]

    if not ffmpeg_cmd(flac, mp3, filters, args):
        return None

    duration = get_duration(mp3)
    size = os.path.getsize(mp3)

    return {
        "duration": round(duration, 2),
        "size": size
    }

def process_bgm(take_id, cue):
    """Process background music: stereo, 20ms fade in, 60ms fade out."""
    flac = find_flac(take_id)
    if not flac:
        return None

    mp3 = os.path.join(OUTPUT_DIR, f"{cue}.mp3")
    if os.path.exists(mp3):
        os.remove(mp3)

    # Fades: 20ms fade in, 60ms fade out
    filters = "afade=t=in:d=0.02,afade=t=out:d=0.06"
    args = ["-q:a", "5"]

    if not ffmpeg_cmd(flac, mp3, filters, args):
        return None

    duration = get_duration(mp3)
    size = os.path.getsize(mp3)

    return {
        "duration": round(duration, 2),
        "size": size
    }

def main():
    # Load accepted
    accepted_path = "C:/Users/sheep/AppData/Local/Temp/claude/C--Users-sheep-code-obsidian/1d166e4e-76ed-44ee-930b-f3675bbfddc6/scratchpad/audio/accepted.json"
    with open(accepted_path, 'r', encoding='utf-8') as f:
        accepted = json.load(f)

    # Load job files for prompts
    jobs_map = {}
    job_dir = "C:/Users/sheep/AppData/Local/Temp/claude/C--Users-sheep-code-obsidian/1d166e4e-76ed-44ee-930b-f3675bbfddc6/scratchpad/audio/"
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
    ok_count = 0

    for cue in sorted(accepted.keys()):
        take_id = accepted[cue]
        is_bgm = cue.startswith("bgm.")

        print(f"  {cue}... ", end="", flush=True)

        result = process_bgm(take_id, cue) if is_bgm else process_sfx(take_id, cue)

        if result is None:
            print("SKIP")
            continue

        print("OK")
        ok_count += 1

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

    # Write outputs
    with open(os.path.join(OUTPUT_DIR, "manifest.json"), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write('\n')

    with open(os.path.join(OUTPUT_DIR, "prompts.json"), 'w', encoding='utf-8') as f:
        json.dump(prompts, f, indent=2, ensure_ascii=False)
        f.write('\n')

    total_size = sum(os.path.getsize(os.path.join(OUTPUT_DIR, f"{cue}.mp3"))
                     for cue in manifest["cues"] if os.path.exists(os.path.join(OUTPUT_DIR, f"{cue}.mp3")))

    print(f"\nSuccess: {ok_count}/{len(accepted)}")
    print(f"Total size: {total_size / 1024 / 1024:.1f} MB")

    return 0 if ok_count == len(accepted) else 1

if __name__ == "__main__":
    sys.exit(main())
