"""Generate tray icons (clipboard glyph) without third-party dependencies."""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
ACCENT = (200, 120, 192)  # #c878c0
BACKGROUND = (23, 18, 26)  # #17121a, same as the app background


def glyph(size, fg, bg):
    """Return RGBA rows: a clipboard outline in `fg` on a rounded square in `bg`."""
    s = size / 16.0
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]

    # Rounded-square background.
    r = 3.5 * s
    for y in range(size):
        for x in range(size):
            cx = min(max(x + 0.5, r), size - r)
            cy = min(max(y + 0.5, r), size - r)
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                px[y][x] = (*bg, 255)

    k = 0.78  # shrink the glyph so it has padding inside the square

    def fill(x0, y0, x1, y1):
        def tx(v, c):
            return (c + (v - c) * k) * s
        for y in range(round(tx(y0, 7.5)), max(round(tx(y1, 7.5)), round(tx(y0, 7.5)) + 1)):
            for x in range(round(tx(x0, 8)), max(round(tx(x1, 8)), round(tx(x0, 8)) + 1)):
                px[y][x] = (*fg, 255)

    t = 1.6  # stroke thickness in 16px units
    fill(2.5, 3, 13.5, 3 + t)            # top edge
    fill(2.5, 14 - t, 13.5, 14)          # bottom edge
    fill(2.5, 3, 2.5 + t, 14)            # left edge
    fill(13.5 - t, 3, 13.5, 14)          # right edge
    fill(5.5, 1, 10.5, 4.5)              # clip
    fill(5, 7, 11, 7 + 1.2)              # text line 1
    fill(5, 9.5, 11, 9.5 + 1.2)          # text line 2
    return px


def write_png(path, px):
    h, w = len(px), len(px[0])
    raw = b"".join(b"\x00" + b"".join(bytes(p) for p in row) for row in px)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    # Same orchid-pink glyph on every platform. Electron picks tray@2x.png on high-DPI screens.
    write_png(os.path.join(OUT, "tray.png"), glyph(16, ACCENT, BACKGROUND))
    write_png(os.path.join(OUT, "tray@2x.png"), glyph(32, ACCENT, BACKGROUND))


if __name__ == "__main__":
    main()
