"""Exercise the installed release APK on an isolated Android emulator.

Emulator evidence is not physical Samsung or on-course GPS verification.
"""
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

out = Path("generated-artifacts/native-hole-tests")
out.mkdir(parents=True, exist_ok=True)
package = "com.drc.golftourbillion"


def adb(*args):
    return subprocess.check_output(["adb", *args], timeout=30)


def dump():
    adb("shell", "uiautomator", "dump", "/sdcard/hole-smoke.xml")
    raw = adb("shell", "cat", "/sdcard/hole-smoke.xml")
    (out / "latest.xml").write_bytes(raw)
    return ET.fromstring(raw)


def text(root):
    return " ".join((n.get("text", "") + " " + n.get("content-desc", "")) for n in root.iter("node"))


def scroll(up=False):
    adb("shell", "input", "swipe", "540", "650" if up else "1850",
        "540", "1850" if up else "650", "350")
    time.sleep(0.3)


def find_button(label):
    for _ in range(6):
        root = dump()
        for n in root.iter("node"):
            if n.get("content-desc", "").casefold() == label.casefold() or n.get("text", "").casefold() == label.casefold():
                bounds = re.findall(r"\d+", n.get("bounds", ""))
                if len(bounds) == 4:
                    a, b, c, d = map(int, bounds)
                    if 0 <= b < d <= 2400:
                        return ((a + c) // 2, (b + d) // 2)
        scroll()
    raise AssertionError(f"Native button not reachable: {label}")


def tap(label):
    x, y = find_button(label)
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(0.4)


def capture(name):
    for _ in range(3):
        scroll(up=True)
    root = dump()
    (out / f"{name}.xml").write_bytes(ET.tostring(root))
    (out / f"{name}.png").write_bytes(adb("exec-out", "screencap", "-p"))
    return text(root)


def open_course(course):
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d",
        f"drc-golf-tourbillion://course-map?courseId={course}", package)
    for _ in range(40):
        time.sleep(1)
        try:
            if re.search(r"Current hole:?\s*1\b", text(dump()), re.I):
                return
        except ET.ParseError:
            pass
    raise AssertionError("Installed app did not load its sourced hole viewer")


try:
    adb("shell", "wm", "size", "1080x2400")
    adb("shell", "wm", "density", "420")
    adb("shell", "pm", "grant", package, "android.permission.ACCESS_FINE_LOCATION")
    adb("shell", "pm", "grant", package, "android.permission.ACCESS_COARSE_LOCATION")
    adb("shell", "settings", "put", "secure", "location_mode", "3")
    open_course("capricorn-championship")
    first = capture("championship-1")
    assert re.search(r"Current hole:?\s*1\b", first, re.I), first
    assert re.search(r"Par\s*5\b", first, re.I), first
    tap("Next")
    second = capture("championship-2")
    assert re.search(r"Current hole:?\s*2\b", second, re.I), second
    assert re.search(r"Par\s*4\b", second, re.I), second
    for _ in range(16):
        tap("Next")
    last = capture("championship-18")
    assert re.search(r"Current hole:?\s*18\b", last, re.I), last
    assert re.search(r"Par\s*5\b", last, re.I), last
    tap("Previous")
    previous = capture("championship-17")
    assert re.search(r"Current hole:?\s*17\b", previous, re.I), previous
    # GPS is injected by the emulator, not a golfer's physical position.
    adb("emu", "geo", "fix", "150.75047", "-23.05807")
    tap("Enable live GPS")
    time.sleep(5)
    gps = capture("emulator-gps")
    assert re.search(r"Green ref\s*\d+\s*m\b", gps, re.I), gps
    tap("Stop live GPS")
    open_course("pacific-golf-club")
    pacific = capture("pacific-1")
    assert re.search(r"Current hole:?\s*1\b", pacific, re.I), pacific
    assert re.search(r"Pacific", pacific, re.I), pacific
    assert re.search(r"Par\s*5\b", pacific, re.I), pacific
    log = adb("logcat", "-d", "-s", "AndroidRuntime:E", "ReactNativeJS:E").decode(errors="replace")
    (out / "runtime.log").write_text(log)
    assert "FATAL EXCEPTION" not in log, log
    (out / "results.json").write_text(json.dumps({
        "status": "passed", "platform": "Android emulator, API 35",
        "screen": "1080x2400, density 420 (S24-sized logical viewport)",
        "checked": ["Championship 1/2/18 pars and viewer", "Next/Previous",
                    "Pacific course switch", "emulator location distance", "native startup"],
        "not_checked": ["physical Samsung hardware", "real on-course GPS accuracy"],
    }, indent=2))
    print("Installed release APK hole smoke checks passed.")
except Exception:
    try:
        (out / "failure.png").write_bytes(adb("exec-out", "screencap", "-p"))
        (out / "failure.log").write_bytes(adb("logcat", "-d", "-s", "AndroidRuntime:E", "ReactNativeJS:E"))
    finally:
        raise
