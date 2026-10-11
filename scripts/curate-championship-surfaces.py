"""Curate unchanged OSM green rings joined to reviewed Championship endpoints.

Run with a one-time OSM map extract; never fetch editing API data at app runtime.
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = ET.parse(sys.argv[1]).getroot()
base = Path("artifacts/drc-golf-tourbillion/data")
holes = json.loads((base / "capricorn-championship.json").read_text())["holes"]
nodes = {e.attrib["id"]: [float(e.attrib["lat"]), float(e.attrib["lon"])]
         for e in root.findall("node")}
features = []
matches = {}
for way in root.findall("way"):
    tags = {t.attrib["k"]: t.attrib["v"] for t in way.findall("tag")}
    if tags.get("golf") != "green":
        continue
    ring = [nodes[n.attrib["ref"]] for n in way.findall("nd")]
    membership = [h["hole"] for h in holes if h["path"][-1] in ring]
    if len(membership) != 1 or len(ring) < 4 or ring[0] != ring[-1]:
        raise ValueError("Green membership or closure is not unambiguous")
    hole = membership[0]
    if hole in matches:
        raise ValueError("Multiple greens share an endpoint")
    matches[hole] = "way-" + way.attrib["id"]
    features.append({"id": matches[hole], "kind": "green", "rings": [ring]})
assert set(matches) == set(range(1, 19)), "Expected all 18 reviewed green matches"
data = {
    "retrievedAt": "2026-10-11",
    "sourceUrl": "https://api.openstreetmap.org/api/0.6/map?bbox=150.740,-23.073,150.758,-23.055",
    "license": "OpenStreetMap contributors, ODbL",
    "review": "Each unchanged green ring contains the reviewed hole endpoint as an exact sourced vertex. Endpoints are edge references, not green centres or daily pins. No other surfaces were mapped in this extract.",
    "greenByHole": matches,
    "features": features,
}
destination = base / "capricorn-surfaces.json"
destination.write_text(json.dumps(data, indent=2) + "\n")
print(f"Curated {len(features)} source-matched greens: {destination}")
