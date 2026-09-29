#!/usr/bin/env python3
"""角印風のテスト用PNG（朱色の正方形＋白い内枠）を標準ライブラリだけで生成する。
出力: assets/stamp.png と assets/stamp.base64.txt
"""
import base64, pathlib, struct, zlib

SIZE = 160          # px
BORDER = 10         # 外枠の太さ
GAP = 8             # 外枠と内側の白い線の間隔
RED = (0xC0, 0x1E, 0x1E)
WHITE = (0xFF, 0xFF, 0xFF)


def pixel(x, y):
    inner = BORDER + GAP
    if x < BORDER or y < BORDER or x >= SIZE - BORDER or y >= SIZE - BORDER:
        return RED
    if x < inner or y < inner or x >= SIZE - inner or y >= SIZE - inner:
        return WHITE
    # 中央に「印」っぽい十字を白で抜く
    c = SIZE // 2
    if abs(x - c) < 6 or abs(y - c) < 6:
        return WHITE
    return RED


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


raw = b"".join(b"\x00" + b"".join(bytes(pixel(x, y)) for x in range(SIZE)) for y in range(SIZE))
png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(raw, 9))
       + chunk(b"IEND", b""))

out = pathlib.Path(__file__).resolve().parent.parent / "assets"
(out / "stamp.png").write_bytes(png)
(out / "stamp.base64.txt").write_text(base64.b64encode(png).decode())
print(f"stamp.png {len(png)} bytes, base64 {len(base64.b64encode(png))} chars")
