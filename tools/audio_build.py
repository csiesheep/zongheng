#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Audio build script for Zongheng audio assets.
Implements exact processing spec per issue #61 with optional gap-closing per issue #63.

Options:
  --only <cue> [<cue> ...]    Process only specified cues (e.g. --only sfx.turn.yours)
                              Useful for rebuilding individual sounds without full rebuild.

Per-cue configuration (tools/audio_cues.json):
  "closeGaps": true           For SFX: prepend silenceremove filter to close gaps > 0.3s
                              in the middle of the sound before other processing.
                              Example: sfx.turn.yours (two knocks with a pause).
"""
import json
import os
import subprocess
import sys
import re
import argparse
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

def run_ffmpeg(cmd):
    """Run ffmpeg command with proper stderr handling."""
    result = subprocess.run(cmd, capture_output=True, timeout=600)
    stderr = result.stderr.decode(errors="replace")
    return result.returncode == 0, stderr

def get_duration_from_mp3(mp3_file):
    """Get duration from MP3."""
    if not os.path.exists(mp3_file):
        return None

    cmd = [FFMPEG, "-i", mp3_file]
    success, stderr = run_ffmpeg(cmd)
    m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', stderr)
    if m:
        h, mn, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
        return h * 3600 + mn * 60 + s
    return None

def get_peak_from_output(stderr):
    """Extract max_volume from volumedetect output."""
    m = re.search(r'max_volume: ([-\d.]+) dB', stderr)
    return float(m.group(1)) if m else None

def get_loudness_from_output(stderr):
    """Extract loudness parameters from stderr JSON."""
    # Find the last JSON object in stderr with input_i
    matches = re.findall(r'\{[^{}]*"input_i"[^{}]*\}', stderr)
    if matches:
        try:
            data = json.loads(matches[-1])
            return {
                'input_i': float(data.get('input_i', -20)),
                'input_tp': float(data.get('input_tp', -2)),
                'input_lra': float(data.get('input_lra', 0)),
                'input_thresh': float(data.get('input_thresh', -70)),
                'target_offset': float(data.get('target_offset', 0))
            }
        except:
            pass
    return None

def process_sfx(take_id, cue, close_gaps=False):
    """Process sound effect: trim silence, fade, normalize to -3dBFS.

    Args:
        take_id: Source FLAC take identifier
        cue: Output cue name
        close_gaps: If True, prepend gap-closing filter for mid-sound silences > 0.3s
    """
    flac = find_flac(take_id)
    if not flac:
        return None

    # Step 1: Measure peak
    # Trim head at -50dB, keep 0.15s of tail decay before 40ms fade
    base_chain = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,afade=t=in:d=0.04,areverse,afade=t=in:d=0.003"

    # Prepend gap-closing filter if needed (closes internal gaps > 0.3s)
    if close_gaps:
        silence_chain = "silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-50dB," + base_chain
    else:
        silence_chain = base_chain

    cmd = [FFMPEG, "-hide_banner", "-i", flac, "-af", f"{silence_chain},volumedetect", "-f", "null", "-"]
    success, stderr = run_ffmpeg(cmd)
    if not success:
        return None

    peak = get_peak_from_output(stderr)
    if peak is None:
        return None

    gain_db = -3.0 - peak

    # Step 2: Render to WAV with gain
    mp3_file = os.path.join(OUTPUT_DIR, f"{cue}.mp3")
    wav_file = mp3_file + ".wav"

    if os.path.exists(wav_file):
        os.remove(wav_file)

    cmd = [FFMPEG, "-y", "-i", flac, "-af", f"{silence_chain},volume={gain_db}dB", "-ac", "1", "-ar", "44100", wav_file]
    success, stderr = run_ffmpeg(cmd)
    if not success:
        return None

    # Step 3: Encode to MP3
    if os.path.exists(mp3_file):
        os.remove(mp3_file)

    cmd = [FFMPEG, "-y", "-i", wav_file, "-c:a", "libmp3lame", "-q:a", "4", mp3_file]
    success, stderr = run_ffmpeg(cmd)
    if not success:
        return None

    # Step 4: Verify peak
    cmd = [FFMPEG, "-i", mp3_file, "-af", "volumedetect", "-f", "null", "-"]
    success, stderr = run_ffmpeg(cmd)

    verified_peak = get_peak_from_output(stderr)

    # Clean up WAV
    if os.path.exists(wav_file):
        os.remove(wav_file)

    if verified_peak is None:
        return None

    # If peak is not in range, correct and retry
    if verified_peak < -3.5 or verified_peak > -2.5:
        correction = -3.0 - verified_peak
        gain_db += correction

        cmd = [FFMPEG, "-y", "-i", flac, "-af", f"{silence_chain},volume={gain_db}dB", "-ac", "1", "-ar", "44100", wav_file]
        success, stderr = run_ffmpeg(cmd)
        if not success:
            return None

        if os.path.exists(mp3_file):
            os.remove(mp3_file)

        cmd = [FFMPEG, "-y", "-i", wav_file, "-c:a", "libmp3lame", "-q:a", "4", mp3_file]
        success, stderr = run_ffmpeg(cmd)
        if not success:
            return None

        if os.path.exists(wav_file):
            os.remove(wav_file)

        # Verify again
        cmd = [FFMPEG, "-i", mp3_file, "-af", "volumedetect", "-f", "null", "-"]
        success, stderr = run_ffmpeg(cmd)
        verified_peak = get_peak_from_output(stderr)

    duration = get_duration_from_mp3(mp3_file)
    size = os.path.getsize(mp3_file)

    return {
        "duration": round(duration, 2) if duration else None,
        "peak": round(verified_peak, 2) if verified_peak else None,
        "size": size
    }

def process_bgm(take_id, cue):
    """Process background music: loudness normalize, fade, encode to 128k."""
    flac = find_flac(take_id)
    if not flac:
        return None

    # Step 1: Measure loudness
    cmd = [FFMPEG, "-hide_banner", "-i", flac, "-af", "loudnorm=I=-20:TP=-2:LRA=11:print_format=json", "-f", "null", "-"]
    success, stderr = run_ffmpeg(cmd)
    if not success:
        return None

    loudness_params = get_loudness_from_output(stderr)
    if loudness_params is None:
        return None

    # Step 2: Apply loudnorm with measured values and fades
    mp3_file = os.path.join(OUTPUT_DIR, f"{cue}.mp3")
    if os.path.exists(mp3_file):
        os.remove(mp3_file)

    loudnorm_filter = f"loudnorm=I=-20:TP=-2:LRA=11:measured_I={loudness_params['input_i']}:measured_TP={loudness_params['input_tp']}:measured_LRA={loudness_params['input_lra']}:measured_thresh={loudness_params['input_thresh']}:offset={loudness_params['target_offset']}:linear=true,afade=t=in:d=0.02,areverse,afade=t=in:d=0.06,areverse"

    cmd = [FFMPEG, "-y", "-i", flac, "-af", loudnorm_filter, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", mp3_file]
    success, stderr = run_ffmpeg(cmd)
    if not success:
        return None

    # Step 3: Verify loudness on output
    cmd = [FFMPEG, "-hide_banner", "-i", mp3_file, "-af", "loudnorm=I=-20:TP=-2:LRA=11:print_format=json", "-f", "null", "-"]
    success, stderr = run_ffmpeg(cmd)

    verified = get_loudness_from_output(stderr)

    # If true peak exceeds -1.5 dB, re-run pass 2 with TP=-3.5
    if verified and verified['input_tp'] > -1.5:
        loudnorm_filter = f"loudnorm=I=-20:TP=-3.5:LRA=11:measured_I={loudness_params['input_i']}:measured_TP={loudness_params['input_tp']}:measured_LRA={loudness_params['input_lra']}:measured_thresh={loudness_params['input_thresh']}:offset={loudness_params['target_offset']}:linear=true,afade=t=in:d=0.02,areverse,afade=t=in:d=0.06,areverse"

        if os.path.exists(mp3_file):
            os.remove(mp3_file)

        cmd = [FFMPEG, "-y", "-i", flac, "-af", loudnorm_filter, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", mp3_file]
        success, stderr = run_ffmpeg(cmd)
        if not success:
            return None

        # Verify again with TP=-3.5
        cmd = [FFMPEG, "-hide_banner", "-i", mp3_file, "-af", "loudnorm=I=-20:TP=-3.5:LRA=11:print_format=json", "-f", "null", "-"]
        success, stderr = run_ffmpeg(cmd)
        verified = get_loudness_from_output(stderr)

    duration = get_duration_from_mp3(mp3_file)
    size = os.path.getsize(mp3_file)

    return {
        "duration": round(duration, 2) if duration else None,
        "loudness": round(verified['input_i'], 2) if verified else None,
        "tp": round(verified['input_tp'], 2) if verified else None,
        "size": size,
        "tp_corrected": verified['input_tp'] <= -1.5 if verified else False
    }

def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="Build audio assets for Zongheng")
    parser.add_argument("--only", nargs='+', help="Process only specified cues")
    args = parser.parse_args()

    # Load accepted
    accepted_path = "C:/Users/sheep/AppData/Local/Temp/claude/C--Users-sheep-code-obsidian/1d166e4e-76ed-44ee-930b-f3675bbfddc6/scratchpad/audio/accepted.json"
    with open(accepted_path, 'r', encoding='utf-8') as f:
        accepted = json.load(f)

    # Load audio cues configuration (for closeGaps and loop flags)
    with open("tools/audio_cues.json", 'r', encoding='utf-8') as f:
        cues_config = json.load(f)

    # Filter to requested cues if --only specified
    if args.only:
        accepted = {cue: take for cue, take in accepted.items() if cue in args.only}
    else:
        # Exclude files that haven't been integrated yet (bgm.setup, bgm.tension, bgm.tutorial)
        # These are for future issues; skip them for now
        not_yet_ready = {"bgm.setup", "bgm.tension", "bgm.tutorial"}
        accepted = {cue: take for cue, take in accepted.items() if cue not in not_yet_ready}

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
    looped = {"bgm.landing", "bgm.setup", "bgm.tension", "bgm.tutorial",
              "bgm.table.alliance.chu", "bgm.table.alliance.qin",
              "bgm.table.conquest.chu", "bgm.table.conquest.qin",
              "bgm.table.reform.chu", "bgm.table.reform.qin"}

    print(f"Processing {len(accepted)} files...")
    results = {}

    for cue in sorted(accepted.keys()):
        take_id = accepted[cue]
        is_bgm = cue.startswith("bgm.")
        close_gaps = cues_config.get(cue, {}).get("closeGaps", False)

        print(f"  {cue}... ", end="", flush=True)

        result = process_bgm(take_id, cue) if is_bgm else process_sfx(take_id, cue, close_gaps)

        if result is None:
            print("FAILED")
            results[cue] = {"error": "processing failed"}
            continue

        print("OK")
        results[cue] = result

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

    # Summary
    ok_count = sum(1 for r in results.values() if "error" not in r)
    total_size = sum(r.get("size", 0) for r in results.values() if "error" not in r)

    print(f"\nSuccess: {ok_count}/{len(accepted)}")
    print(f"Total size: {total_size / 1024 / 1024:.1f} MB")

    # Print results table
    print("\nResults:")
    for cue in sorted(results.keys()):
        r = results[cue]
        if "error" not in r:
            if cue.startswith("bgm."):
                print(f"  {cue}: {r['duration']}s, {r['loudness']}LUFS/{r['tp']}TP, {r['size']}B")
            else:
                print(f"  {cue}: {r['duration']}s, {r['peak']}dBFS, {r['size']}B")
        else:
            print(f"  {cue}: {r['error']}")

    return 0 if ok_count == len(accepted) else 1

if __name__ == "__main__":
    sys.exit(main())
