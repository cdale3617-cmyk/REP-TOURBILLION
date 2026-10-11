"""Exercise the installed release APK on an isolated Android emulator.

Emulator evidence is not physical Samsung or on-course GPS verification.
"""
import json
import re
import struct
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

out = Path("generated-artifacts/native-hole-tests")
out.mkdir(parents=True, exist_ok=True)
package = "com.drc.golftourbillion"
screen_width, screen_height = 1440, 3120


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
    x = str(screen_width // 2)
    a, b = int(screen_height * 0.30), int(screen_height * 0.70)
    adb("shell", "input", "swipe", x, str(a if up else b),
        x, str(b if up else a), "900")
    time.sleep(1.5)


def find_button(label):
    ids = {"Next": "course-map-next", "Previous": "course-map-previous",
           "Enable live GPS": "course-map-gps", "Stop live GPS": "course-map-gps"}
    for _ in range(6):
        root = dump()
        for n in root.iter("node"):
            resource = n.get("resource-id", "").split("/")[-1]
            matches = resource == ids.get(label) or n.get("text", "").casefold() == label.casefold()
            if matches:
                bounds = re.findall(r"\d+", n.get("bounds", ""))
                if len(bounds) == 4:
                    a, b, c, d = map(int, bounds)
                    if 100 <= b < d <= screen_height - 150 and d - b >= 20:
                        return ((a + c) // 2, (b + d) // 2)
        scroll()
    raise AssertionError(f"Native button not reachable: {label}")


def tap(label):
    x, y = find_button(label)
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(1)


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
    # A Pixel Launcher ANR can remain above the successfully opened app on a
    # cold QHD emulator. Stop only the launcher, never suppress an app failure.
    adb("shell", "am", "force-stop", "com.google.android.apps.nexuslauncher")
    adb("shell", "am", "force-stop", "com.android.launcher3")
    for _ in range(40):
        time.sleep(1)
        try:
            if re.search(r"Current hole:?\s*1\b", text(dump()), re.I):
                return
        except ET.ParseError:
            pass
    raise AssertionError("Installed app did not load its sourced hole viewer")


try:
    # The AVD profile supplies a real 1440x3120 display. Do not use a wm
    # override: it can change accessibility coordinates without the framebuffer.
    adb("shell", "wm", "size", "reset")
    adb("shell", "wm", "density", "560")
    screen_width, screen_height = struct.unpack(">II", adb("exec-out", "screencap", "-p")[16:24])
    assert (screen_width, screen_height) == (1440, 3120), (screen_width, screen_height)
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
    tap("Enable live GPS")
    for _ in range(3):
        if re.search(r"Stop live GPS", text(dump()), re.I):
            break
        tap("Enable live GPS")
    assert re.search(r"Stop live GPS", text(dump()), re.I), "GPS toggle was not activated"
    for _ in range(3):
        adb("emu", "geo", "fix", "150.75047", "-23.05807")
        time.sleep(2)
    gps = capture("emulator-gps")
    reading = re.search(r"Green ref\s*(\d+)\s*m\b", gps, re.I)
    assert reading and int(reading.group(1)) <= 30, gps
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
        "screen": f"{screen_width}x{screen_height}, density 560 (S24 Ultra-sized viewport)",
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
