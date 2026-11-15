#!/usr/bin/env python3
"""Extract resting heart rate (beats per minute) from WESAD baseline segments.

Purpose:
    Produces frontend/data/wesad-hr.json, the pulse series replayed by the simulated
    device adapter (T022). Only label 1 (baseline) is used, cut into fixed
    60-second windows that lie entirely inside a baseline segment. Beats are
    counted as R-peaks of the chest ECG (700 Hz); a window is kept when its
    rate is within 40-140 bpm. The output holds the rates only, with no
    subject identifiers.

Output format:
    { "source": "WESAD (UCI)", "bpm": [62.0, 61.0, ...] }

License and credit:
    WESAD is provided by its owners for scientific, non-commercial purposes,
    and credit to the owners is required when publishing work based on it.
    See frontend/data/SOURCES.md, entry "WESAD (UCI)". Do not commit the raw dataset.
    Citation: Schmidt P., Reiss A., Duerichen R., Marberger C., Van Laerhoven K.,
    "Introducing WESAD, a Multimodal Dataset for Wearable Stress and Affect
    Detection", ICMI 2018.

Safety:
    WESAD subject files are Python pickles, and unpickling can run code chosen
    by the file's author. This script resolves only a fixed allow-list of numpy
    array globals and refuses every other class, which limits what a crafted
    file can do, but it is not a sandbox. Use only the official WESAD archive
    from the dataset owners.

Dependencies:
    Python 3 standard library only. numpy is not required.

Usage:
    python3 -I frontend/scripts/data/extract-wesad-hr.py <path-to-WESAD-dir> <output-json>

    <path-to-WESAD-dir> is the extracted archive root, containing S<n>/S<n>.pkl.
    Run with -I so that no local module can shadow the standard library.
"""

import bisect
import json
import os
import pickle
import re
import struct
import sys
from itertools import accumulate

SOURCE = "WESAD (UCI)"
ECG_HZ = 700
BASELINE_LABEL = 1
WINDOW_S = 60
MIN_BPM = 40.0
MAX_BPM = 140.0
LOWPASS_S = 0.02
ENERGY_SMOOTH_S = 0.12
REFRACTORY_S = 0.3
THRESHOLD_FRACTION = 0.5
SUBJECT_DIR = re.compile(r"S(\d+)")

# (numpy kind, item size) -> struct format code
_STRUCT_CODES = {
    ("f", 4): "f",
    ("f", 8): "d",
    ("i", 1): "b",
    ("i", 2): "h",
    ("i", 4): "i",
    ("i", 8): "q",
    ("u", 1): "B",
    ("u", 2): "H",
    ("u", 4): "I",
    ("u", 8): "Q",
    ("b", 1): "?",
}


class _DType:
    """Stands in for numpy.dtype: keeps the element kind, size and byte order."""

    def __init__(self, name, *_args):
        self.kind = name[0]
        self.size = int(name[1:]) if name[1:].isdigit() else 0
        self.order = "<"

    def __setstate__(self, state):
        # numpy state: (version, byteorder, subarray, names, fields, itemsize, alignment, flags)
        if len(state) > 1 and state[1] in ("<", ">"):
            self.order = state[1]


class _NdarrayTag:
    """Stands in for numpy.ndarray; only used as the first argument of _reconstruct."""


class _Array:
    """Stands in for numpy.ndarray: keeps the flat values in C order."""

    def __init__(self):
        self.values = []

    def __setstate__(self, state):
        # numpy state: (version, shape, dtype, is_fortran, raw_bytes)
        _version, _shape, dtype, _fortran, raw = state
        if not isinstance(dtype, _DType):
            raise ValueError("unsupported array dtype")
        code = _STRUCT_CODES.get((dtype.kind, dtype.size))
        if code is None:
            raise ValueError("unsupported element type")
        # Python 2 pickles read with latin1 may hold the raw bytes as str.
        if isinstance(raw, str):
            raw = raw.encode("latin1")
        self.values = [
            item[0] for item in struct.iter_unpack(dtype.order + code, bytes(raw))
        ]


def _reconstruct(_cls, _shape, _typecode):
    return _Array()


_ALLOWED_GLOBALS = {
    ("numpy.core.multiarray", "_reconstruct"): _reconstruct,
    ("numpy._core.multiarray", "_reconstruct"): _reconstruct,
    ("numpy", "ndarray"): _NdarrayTag,
    ("numpy", "dtype"): _DType,
}


class _ArrayOnlyUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        try:
            return _ALLOWED_GLOBALS[(module, name)]
        except KeyError:
            raise pickle.UnpicklingError(
                f"global not allowed: {module}.{name}"
            ) from None


def load_subject_pickle(path):
    with open(path, "rb") as handle:
        return _ArrayOnlyUnpickler(handle, encoding="latin1").load()


def _values(obj):
    if not isinstance(obj, _Array):
        raise ValueError("expected a numeric array")
    return obj.values


def _centered_sum(values, win):
    """Centered moving sum over `win` samples (zero-padded at the end)."""
    n = len(values)
    trailing = [0.0] * n
    running = 0.0
    for i in range(n):
        running += values[i]
        if i >= win:
            running -= values[i - win]
        trailing[i] = running
    half = win // 2
    return trailing[half:] + [0.0] * half


def smoothed_energy(x, lowpass_win, energy_win):
    """QRS energy: squared slope of a low-passed ECG, moving-summed."""
    low = [v / lowpass_win for v in _centered_sum(x, lowpass_win)]
    slope = [0.0] * len(low)
    for i in range(1, len(low)):
        slope[i] = low[i] - low[i - 1]
    return _centered_sum([s * s for s in slope], energy_win)


def detect_peaks(energy, threshold, refractory):
    """Local maxima above threshold, at least `refractory` samples apart."""
    peaks = []
    for i in range(1, len(energy) - 1):
        v = energy[i]
        if v < threshold or v < energy[i - 1] or v <= energy[i + 1]:
            continue
        if peaks and i - peaks[-1] < refractory:
            if v > energy[peaks[-1]]:
                peaks[-1] = i
        else:
            peaks.append(i)
    return peaks


def subject_rates(data, stats):
    """Return the kept bpm values for one subject; update `stats` counters."""
    ecg = _values(data["signal"]["chest"]["ECG"])
    label = _values(data["label"])
    n = min(len(ecg), len(label))
    ecg = ecg[:n]
    label = label[:n]

    baseline = [1 if v == BASELINE_LABEL else 0 for v in label]
    energy = smoothed_energy(
        ecg, round(LOWPASS_S * ECG_HZ), round(ENERGY_SMOOTH_S * ECG_HZ)
    )

    baseline_energy = sorted(e for e, b in zip(energy, baseline) if b)
    if not baseline_energy:
        return []
    p99 = baseline_energy[int(0.99 * (len(baseline_energy) - 1))]
    peaks = detect_peaks(
        energy, THRESHOLD_FRACTION * p99, round(REFRACTORY_S * ECG_HZ)
    )

    win = WINDOW_S * ECG_HZ
    baseline_prefix = [0] + list(accumulate(baseline))
    rates = []
    for start in range(0, n - win + 1, win):
        end = start + win
        if baseline_prefix[end] - baseline_prefix[start] != win:
            continue
        stats["baseline_windows"] += 1
        beats = bisect.bisect_left(peaks, end) - bisect.bisect_left(peaks, start)
        bpm = round(beats * 60.0 / WINDOW_S, 1)
        if MIN_BPM <= bpm <= MAX_BPM:
            rates.append(bpm)
            stats["kept"] += 1
        else:
            stats["rejected_range"] += 1
    return rates


def find_subject_files(root):
    found = []
    for name in os.listdir(root):
        match = SUBJECT_DIR.fullmatch(name)
        path = os.path.join(root, name, name + ".pkl")
        if match and os.path.isfile(path):
            found.append((int(match.group(1)), path))
    return [path for _, path in sorted(found)]


def main(argv):
    if len(argv) != 3:
        print(
            "usage: python3 -I frontend/scripts/data/extract-wesad-hr.py "
            "<path-to-WESAD-dir> <output-json>",
            file=sys.stderr,
        )
        return 2
    root, out_path = argv[1], argv[2]
    if not os.path.isdir(root):
        print("error: WESAD directory not found", file=sys.stderr)
        return 2

    files = find_subject_files(root)
    if not files:
        print("error: no S<n>/S<n>.pkl files under the WESAD directory", file=sys.stderr)
        return 1

    stats = {"baseline_windows": 0, "kept": 0, "rejected_range": 0}
    skipped = 0
    bpm = []
    for path in files:
        try:
            data = load_subject_pickle(path)
            bpm.extend(subject_rates(data, stats))
        except (OSError, ValueError, KeyError, TypeError, pickle.UnpicklingError) as exc:
            # Do not print the path or the exception text: it can name a subject.
            skipped += 1
            print(f"skipped one subject file ({type(exc).__name__})")

    print(f"subject files found: {len(files)}")
    print(f"subject files skipped: {skipped}")
    print(f"baseline windows (60 s, fully label 1): {stats['baseline_windows']}")
    print(f"kept (40-140 bpm): {stats['kept']}")
    print(f"rejected (outside 40-140 bpm): {stats['rejected_range']}")

    if not bpm:
        print("error: no windows kept; output not written", file=sys.stderr)
        return 1

    parent = os.path.dirname(os.path.abspath(out_path))
    os.makedirs(parent, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump({"source": SOURCE, "bpm": bpm}, handle)
        handle.write("\n")
    print(f"wrote {len(bpm)} values to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
