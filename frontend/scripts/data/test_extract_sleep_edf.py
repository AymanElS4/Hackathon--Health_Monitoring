"""Unit tests for extract-sleep-edf.py, using synthetic EDF+ hypnogram files.

Run from a neutral directory, never from inside a data directory:
    python3 -I -m unittest discover -s /abs/path/to/frontend/scripts/data -p "test_*.py"
"""

import importlib.util
import json
import io
import os
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extract-sleep-edf.py")
_spec = importlib.util.spec_from_file_location("extract_sleep_edf", SCRIPT)
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)

RECORD_SAMPLES = 1000  # annotation bytes per data record (2 bytes per sample)


def _field(text, width):
    return text.encode("ascii").ljust(width)[:width]


def make_edf(records, n_records=None, edf_plus=True):
    """Build an EDF+ file with one annotation signal.

    `records` is a list of lists of TAL byte strings; each record is padded with
    NUL bytes up to the record size.
    """
    n_records = len(records) if n_records is None else n_records
    header_bytes = 512
    reserved = "EDF+C" if edf_plus else "        "
    fixed = b"".join(
        [
            _field("0", 8),
            _field("X X X X", 80),
            _field("Startdate X X X X", 80),
            _field("01.01.00", 8),
            _field("00.00.00", 8),
            _field(str(header_bytes), 8),
            _field(reserved, 44),
            _field(str(n_records), 8),
            _field("30", 8),
            _field("1", 4),
        ]
    )
    signal = b"".join(
        [
            _field("EDF Annotations", 16),
            _field("", 80),
            _field("", 8),
            _field("-1", 8),
            _field("1", 8),
            _field("-32768", 8),
            _field("32767", 8),
            _field("", 80),
            _field(str(RECORD_SAMPLES), 8),
            _field("", 32),
        ]
    )
    body = b""
    for talls in records:
        content = b"".join(talls)
        if len(content) > RECORD_SAMPLES * 2:
            raise ValueError("test record too large")
        body += content + b"\x00" * (RECORD_SAMPLES * 2 - len(content))
    return fixed + signal + body


def stage(onset, duration, label):
    return f"+{onset}\x15{duration}\x14{label}\x14\x00".encode("utf-8")


def timekeeping(onset=0):
    return f"+{onset}\x14\x14\x00".encode("ascii")


def night(total_sleep_seconds):
    """A night with a 'W' block, a '?' block and a movement block that must be ignored."""
    talls = [timekeeping()]
    onset = 0
    talls.append(stage(onset, 600, "Sleep stage W"))
    onset += 600
    talls.append(stage(onset, 30, "Movement time"))
    onset += 30
    talls.append(stage(onset, 30, "Sleep stage ?"))
    onset += 30
    talls.append(stage(onset, total_sleep_seconds, "Sleep stage 2"))
    return talls


class ParserTests(unittest.TestCase):
    def test_sums_only_sleep_stages_across_records(self):
        records = [
            [timekeeping(), stage(0, 600, "Sleep stage W"), stage(600, 120, "Sleep stage 1")],
            [
                timekeeping(720),
                stage(720, 390, "Sleep stage 2"),
                stage(1110, 30, "Sleep stage 3"),
                stage(1140, 30, "Sleep stage 4"),
                stage(1170, 120, "Sleep stage R"),
                stage(1290, 60, "Sleep stage ?"),
                stage(1350, 30, "Movement time"),
                stage(1380, 60, "Sleep stage W"),
            ],
        ]
        data = make_edf(records)
        # 120 + 390 + 30 + 30 + 120 = 690 s
        self.assertEqual(mod.sleep_hours(data), round(690 / 3600, 1))
        seconds = sum(d for d, label in mod.iter_annotations(data) if label in mod.SLEEP_LABELS)
        self.assertEqual(seconds, 690)

    def test_rounds_to_tenth_of_an_hour(self):
        # 7 h 20 min = 7.333... h -> 7.3
        data = make_edf([night(7 * 3600)])
        self.assertEqual(mod.sleep_hours(data), 7.0)
        data = make_edf([night(int(7.34 * 3600))])
        self.assertEqual(mod.sleep_hours(data), 7.3)

    def test_empty_tal_padding_and_timekeeping_are_ignored(self):
        data = make_edf([[timekeeping()], [timekeeping(30)]])
        self.assertEqual(mod.sleep_hours(data), 0.0)

    def test_rejects_non_edf_plus(self):
        data = make_edf([night(3600)], edf_plus=False)
        with self.assertRaisesRegex(ValueError, "not an EDF\\+ file"):
            mod.sleep_hours(data)

    def test_rejects_tal_with_two_labels(self):
        bad = b"+0\x15600\x14Sleep stage 1\x14Sleep stage 2\x14\x00"
        with self.assertRaisesRegex(ValueError, "more than one annotation"):
            mod.sleep_hours(make_edf([[bad]]))

    def test_rejects_truncated_records(self):
        data = make_edf([night(3600)], n_records=5)
        with self.assertRaisesRegex(ValueError, "truncated"):
            mod.sleep_hours(data)


class MainTests(unittest.TestCase):
    def _write_nights(self, folder, sleep_seconds_per_night):
        for index, seconds in enumerate(sleep_seconds_per_night):
            name = f"SC40{index:02d}EC-Hypnogram.edf"
            with open(os.path.join(folder, name), "wb") as handle:
                handle.write(make_edf([night(seconds)]))

    def _run(self, argv):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = mod.main(["extract-sleep-edf.py"] + argv)
        return code, out.getvalue(), err.getvalue()

    def test_writes_fourteen_values_without_identifiers(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "in")
            os.mkdir(src)
            self._write_nights(src, [7 * 3600] * 14)
            dst = os.path.join(tmp, "out", "sleep-history.json")
            code, _, _ = self._run([src, dst])
            self.assertEqual(code, 0)
            with open(dst, encoding="utf-8") as handle:
                text = handle.read()
            payload = json.loads(text)
            self.assertEqual(set(payload), {"source", "hours"})
            self.assertEqual(payload["source"], mod.SOURCE)
            self.assertEqual(payload["hours"], [7.0] * 14)
            self.assertNotIn("SC40", text)
            self.assertNotIn("Hypnogram", text)

    def test_fails_when_not_fourteen_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "in")
            os.mkdir(src)
            self._write_nights(src, [7 * 3600] * 13)
            dst = os.path.join(tmp, "sleep-history.json")
            code, _, err = self._run([src, dst])
            self.assertEqual(code, 1)
            self.assertIn("expected 14", err)
            self.assertFalse(os.path.exists(dst))

    def test_fails_on_implausible_night_and_writes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "in")
            os.mkdir(src)
            values = [7 * 3600] * 13 + [1 * 3600]
            self._write_nights(src, values)
            dst = os.path.join(tmp, "sleep-history.json")
            code, _, err = self._run([src, dst])
            self.assertEqual(code, 1)
            self.assertIn("hypnogram #14", err)
            self.assertIn("outside the plausible range", err)
            self.assertNotIn("SC40", err)
            self.assertFalse(os.path.exists(dst))

    def test_usage_error(self):
        code, _, err = self._run([])
        self.assertEqual(code, 2)
        self.assertIn("usage", err)


if __name__ == "__main__":
    unittest.main()
