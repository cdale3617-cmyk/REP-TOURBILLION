"""Check downloaded personal APKs without requiring a local Android SDK."""
import argparse
import hashlib
import json
import struct
import zipfile
from pathlib import Path


def length_prefixed(data, offset=0):
    size = struct.unpack_from("<I", data, offset)[0]
    start = offset + 4
    end = start + size
    if end > len(data):
        raise ValueError("Truncated APK signing record")
    return data[start:end], end


def certificate_sha256(apk):
    data = apk.read_bytes()
    eocd = data.rfind(b"PK\x05\x06", max(0, len(data) - 65557))
    if eocd < 0:
        raise ValueError("Missing ZIP directory")
    central = struct.unpack_from("<I", data, eocd + 16)[0]
    if data[central - 16:central] != b"APK Sig Block 42":
        raise ValueError("APK v2/v3 signing block missing")
    size = struct.unpack_from("<Q", data, central - 24)[0]
    start = central - size - 8
    if start < 0 or struct.unpack_from("<Q", data, start)[0] != size:
        raise ValueError("Invalid signing block length")
    cursor = start + 8
    while cursor < central - 24:
        pair_size = struct.unpack_from("<Q", data, cursor)[0]
        kind = struct.unpack_from("<I", data, cursor + 8)[0]
        end = cursor + 8 + pair_size
        if pair_size < 4 or end > central - 24:
            raise ValueError("Invalid signing block entry")
        if kind in (0x7109871A, 0xF05368C0):
            signers, _ = length_prefixed(data[cursor + 12:end])
            signer, _ = length_prefixed(signers)
            signed_data, _ = length_prefixed(signer)
            _, after_digests = length_prefixed(signed_data)
            certificates, _ = length_prefixed(signed_data, after_digests)
            certificate, _ = length_prefixed(certificates)
            return hashlib.sha256(certificate).hexdigest()
        cursor = end
    raise ValueError("Supported APK signer not found")


def unpack(archive_path, output):
    with zipfile.ZipFile(archive_path) as archive:
        name = "DRC-Golf-Tourbillion.apk"
        data = archive.read(name)
        expected = archive.read("SHA256SUMS.txt").decode().split()[0]
        actual = hashlib.sha256(data).hexdigest()
        if actual != expected:
            raise ValueError("Downloaded APK checksum differs from builder checksum")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
    return actual


parser = argparse.ArgumentParser()
parser.add_argument("archive", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--previous", type=Path)
args = parser.parse_args()
checksum = unpack(args.archive, args.output)
certificate = certificate_sha256(args.output)
if args.previous:
    if certificate != certificate_sha256(args.previous):
        raise ValueError("Signing identity changed; do not install or uninstall the old app")
    with zipfile.ZipFile(args.output) as apk:
        names = set(apk.namelist())
        assert "classes.dex" in names
        assert any(n.startswith("lib/arm64-v8a/") for n in names)
        bundle = apk.read("assets/index.android.bundle")
        required = [
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
            "worldwide-course-query",
            "capricorn-championship",
            "select-capricorn-championship",
        ]
        source = json.loads(Path("artifacts/drc-golf-tourbillion/data/pacific-surfaces.json").read_text())
        required.extend(feature["id"] for feature in source["features"][:5])
        for marker in required:
            if marker.encode() not in bundle:
                raise ValueError(f"New map code/data missing from embedded bundle: {marker}")
print(json.dumps({"apk": str(args.output), "sha256": checksum, "certificateSha256": certificate,
                  "previousSigningIdentityMatches": bool(args.previous)}, indent=2))
