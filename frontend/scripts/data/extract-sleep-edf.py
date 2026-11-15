#!/usr/bin/env python3
"""Extract nightly total sleep time (hours) from PhysioNet Sleep-EDF hypnograms.

Purpose:
    Produces frontend/data/sleep-history.json, the nightly total-sleep series used
    to seed the simulated check-in history (T088). For each hypnogram file the
    script sums the durations of the sleep stages "Sleep stage 1", "2", "3", "4"
    and "R" (REM). "Sleep stage W", "Sleep stage ?" and "Movement time" are not
    sleep and are excluded. The total is converted to hours and rounded to 0.1.
    Files are processed in file-name order, but file names are never written to
    the output.

Input format:
    EDF+ files with a single "EDF Annotations" signal (the hypnogram files of
    sleep-edfx, named <subject>-Hypnogram.edf). Annotations are read from the
    time-stamped annotation lists (TALs): "+onset\\x15duration\\x14label\\x14\\x00".

Output format:
    { "source": "PhysioNet Sleep-EDF Expanded (sleep-cassette), ODC-By 1.0",
      "hours": [7.2, 6.8, ...] }   (exactly 14 values, no subject IDs, no file names)

License and credit:
    Open Data Commons Attribution License v1.0 (ODC-By). Attribution is required.
    See frontend/data/SOURCES.md, entry "PhysioNet Sleep-EDF Expanded".
    Citations: Kemp B., Zwinderman A.H., Tuk B., Kamphuisen H.A.C., Oberye J.J.L.,
    "Analysis of a sleep-dependent neuronal feedback loop: the slow-wave
    microcontinuity of the EEG", IEEE-BME 47(9):1185-1194, 2000; Goldberger A.L.
    et al., "PhysioBank, PhysioToolkit, and PhysioNet", Circulation 101(23):e215-e220,
    2000. Do not commit the raw dataset.

Validation:
    Exactly 14 hypnogram files are required. Every value must lie in 3-11 hours;
    otherwise the script fails and writes nothing. Error messages name only the
    1-based position of the file, never its name.

Dependencies:
    Python 3 standard library only.

Usage:
    python3 -I frontend/scripts/data/extract-sleep-edf.py <input_dir> <output_json>

    <input_dir> holds the downloaded hypnogram files. Run with -I so that no local
    module can shadow the standard library.
"""

import json
import os
import sys

SOURCE = "PhysioNet Sleep-EDF Expanded (sleep-cassette), ODC-By 1.0"
HYPNOGRAM_SUFFIX = "-Hypnogram.edf"
EXPECTED_NIGHTS = 14
MIN_HOURS = 3.0
MAX_HOURS = 11.0
MAX_FILE_BYTES = 1 << 20
ANNOTATION_LABEL = "EDF Annotations"
SLEEP_LABELS = frozenset(
    "Sleep stage " + stage for stage in ("1", "2", "3", "4", "R")
)

EDF_FIXED_HEADER = 256
EDF_SIGNAL_FIELDS = (16, 80, 8, 8, 8, 8, 8, 80, 8, 32)
EDF_SIGNAL_HEADER = sum(EDF_SIGNAL_FIELDS)
FIELD_LABEL = 0
FIELD_SAMPLES = 8
TAL_SEPARATOR = b"\x00"
ANNOTATION_SEPARATOR = b"\x14"
DURATION_SEPARATOR = b"\x15"


def _text(raw):
    return raw.decode("ascii").strip()


def _int_field(raw, name):
    try:
        return int(_text(raw))
    except ValueError:
        raise ValueError(f"invalid {name} in EDF header") from None


def _duration(raw):
    if not raw:
        return 0.0
    try:
        value = float(raw.decode("ascii"))
    except (ValueError, UnicodeDecodeError):
        raise ValueError("invalid TAL duration") from None
    if value < 0:
        raise ValueError("negative TAL duration")
    return value


def _signal_field(data, n_signals, index, field):
    """Bytes of one per-signal header field for signal `index`."""
    offset = (
        EDF_FIXED_HEADER
        + sum(EDF_SIGNAL_FIELDS[:field]) * n_signals
        + index * EDF_SIGNAL_FIELDS[field]
    )
    return data[offset : offset + EDF_SIGNAL_FIELDS[field]]


def parse_edf_layout(data):
    """Return (header_bytes, record_bytes, n_records, signals) for an EDF+ file.

    `signals` is a list of (label, byte_offset_in_record, byte_size) tuples.
    """
    if len(data) < EDF_FIXED_HEADER:
        raise ValueError("file shorter than the EDF header")
    reserved = data[192:236]
    if not (reserved.startswith(b"EDF+C") or reserved.startswith(b"EDF+D")):
        raise ValueError("not an EDF+ file")

    header_bytes = _int_field(data[184:192], "header size")
    n_records = _int_field(data[236:244], "number of data records")
    n_signals = _int_field(data[252:256], "number of signals")
    if n_signals <= 0:
        raise ValueError("no signals in EDF header")
    if header_bytes != EDF_FIXED_HEADER + EDF_SIGNAL_HEADER * n_signals:
        raise ValueError("inconsistent header size")

    signals = []
    offset = 0
    for index in range(n_signals):
        label = _text(_signal_field(data, n_signals, index, FIELD_LABEL))
        samples = _int_field(
            _signal_field(data, n_signals, index, FIELD_SAMPLES), "samples per record"
        )
        if samples < 0:
            raise ValueError("invalid samples per record")
        size = samples * 2  # EDF+ annotation and int16 signals both use 2 bytes per sample
        signals.append((label, offset, size))
        offset += size
    record_bytes = offset
    if record_bytes <= 0:
        raise ValueError("empty data records")

    available = (len(data) - header_bytes) // record_bytes
    if n_records < 0:
        n_records = available
    if n_records > available:
        raise ValueError("truncated data records")
    return header_bytes, record_bytes, n_records, signals


def parse_tals(block):
    """Yield (duration_seconds, label) for each TAL that carries one label."""
    for tal in block.split(TAL_SEPARATOR):
        if not tal:
            continue
        fields = tal.split(ANNOTATION_SEPARATOR)
        timing = fields[0]
        if DURATION_SEPARATOR in timing:
            duration = _duration(timing.split(DURATION_SEPARATOR, 1)[1])
        else:
            duration = 0.0
        labels = [field for field in fields[1:] if field]
        if len(labels) > 1:
            raise ValueError("TAL with more than one annotation")
        if labels:
            try:
                label = labels[0].decode("utf-8")
            except UnicodeDecodeError:
                raise ValueError("annotation label is not UTF-8") from None
            yield duration, label


def iter_annotations(data):
    """Yield (duration_seconds, label) for every annotation in the file."""
    header_bytes, record_bytes, n_records, signals = parse_edf_layout(data)
    annotation_signals = [
        (offset, size) for label, offset, size in signals if label == ANNOTATION_LABEL
    ]
    if not annotation_signals:
        raise ValueError("no EDF Annotations signal")
    for record in range(n_records):
        base = header_bytes + record * record_bytes
        for offset, size in annotation_signals:
            start = base + offset
            yield from parse_tals(data[start : start + size])


def sleep_hours(data):
    """Total sleep (stages 1-4 and R) in hours, rounded to 0.1."""
    seconds = 0.0
    for duration, label in iter_annotations(data):
        if label in SLEEP_LABELS:
            seconds += duration
    return round(seconds / 3600.0, 1)


def find_hypnograms(root):
    """Sorted list of hypnogram file paths in `root` (names are not reported)."""
    found = []
    with os.scandir(root) as entries:
        for entry in entries:
            if entry.name.endswith(HYPNOGRAM_SUFFIX) and entry.is_file():
                found.append(entry.name)
    return [os.path.join(root, name) for name in sorted(found)]


def main(argv):
    if len(argv) != 3:
        print(
            "usage: python3 -I frontend/scripts/data/extract-sleep-edf.py "
            "<input_dir> <output_json>",
            file=sys.stderr,
        )
        return 2
    root, out_path = argv[1], argv[2]
    if not os.path.isdir(root):
        print("error: input directory not found", file=sys.stderr)
        return 2

    files = find_hypnograms(root)
    if len(files) != EXPECTED_NIGHTS:
        print(
            f"error: expected {EXPECTED_NIGHTS} hypnogram files, found {len(files)}; "
            "output not written",
            file=sys.stderr,
        )
        return 1

    hours = []
    for position, path in enumerate(files, start=1):
        # Do not print the path or the exception text: OSError messages contain it.
        try:
            if os.path.getsize(path) > MAX_FILE_BYTES:
                raise ValueError("file too large for a hypnogram")
            with open(path, "rb") as handle:
                value = sleep_hours(handle.read())
        except (OSError, ValueError) as exc:
            print(
                f"error: hypnogram #{position} could not be read "
                f"({type(exc).__name__}: {exc if isinstance(exc, ValueError) else 'I/O'}); "
                "output not written",
                file=sys.stderr,
            )
            return 1
        if not MIN_HOURS <= value <= MAX_HOURS:
            print(
                f"error: hypnogram #{position} gives {value} h, outside the plausible "
                f"range {MIN_HOURS}-{MAX_HOURS} h; output not written",
                file=sys.stderr,
            )
            return 1
        hours.append(value)

    print(f"hypnogram files: {len(files)}")
    print(f"total sleep hours: {hours}")

    parent = os.path.dirname(os.path.abspath(out_path))
    os.makedirs(parent, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump({"source": SOURCE, "hours": hours}, handle)
        handle.write("\n")
    print(f"wrote {len(hours)} values to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
