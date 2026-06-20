#!/usr/bin/env python3
"""Generate the "PR" brand icon set for Peanut Run.

Matches the in-game PEANUT RUN title styling (see .title in index.html):
  - Luckiest Guy font
  - mustard fill (--mustard #ffc62e)
  - dark outline stroke (--grease-dk #1a0805)
  - solid red 3D drop / extrude (--ketchup-dk #8f1500)  <- the "3-step shadow"
  - a soft dark blur underneath for depth

Outputs PNGs at 32/64/128/256/512 and .ico files (favicon.ico multi-size incl. 32,
plus a large favicon-512.ico). Run from the project root:  python tools/make_pr_icons.py
"""
import os
import io
import struct
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_PATH = os.path.join(ROOT, "assets", "fonts", "LuckiestGuy-Regular.ttf")
TEXT = "PR"

MUSTARD = (255, 198, 46, 255)
GREASE  = (26, 8, 5, 255)     # near-black outline
KET_DK  = (143, 21, 0, 255)   # red 3D side
SHADOW  = (0, 0, 0, 150)      # soft blur shadow

M = 2048                      # master render size (supersampled, then downscaled)


def fit_font(draw, target_w, stroke_frac):
    """Pick a font size so 'PR' (with stroke) is about target_w wide."""
    fs = 400
    font = ImageFont.truetype(FONT_PATH, fs)
    bbox = draw.textbbox((0, 0), TEXT, font=font, stroke_width=int(fs * stroke_frac))
    w = bbox[2] - bbox[0]
    fs = int(fs * target_w / w)
    return ImageFont.truetype(FONT_PATH, fs), fs


def make_master():
    img = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    stroke_frac = 0.052
    font, fs = fit_font(d, int(M * 0.84), stroke_frac)
    stroke = max(2, int(fs * stroke_frac))
    ext = int(fs * 0.10)          # 3D extrude depth (the chunky red step)

    # measure + center (account for stroke + extrude room below)
    bbox = d.textbbox((0, 0), TEXT, font=font, stroke_width=stroke)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (M - tw) // 2 - bbox[0]
    y = (M - th - ext) // 2 - bbox[1]

    # 1) soft blur shadow underneath, for depth (drawn on its own layer + blurred)
    sh = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.text((x, y + ext + int(fs * 0.06)), TEXT, font=font, fill=SHADOW,
            stroke_width=stroke, stroke_fill=SHADOW)
    sh = sh.filter(ImageFilter.GaussianBlur(int(fs * 0.05)))
    img.alpha_composite(sh)

    # 2) solid red 3D extrude (stacked offsets straight down -> a clean red side/step)
    for i in range(ext, 0, -1):
        d.text((x, y + i), TEXT, font=font, fill=KET_DK,
               stroke_width=stroke, stroke_fill=KET_DK)

    # 3) the face: mustard fill + dark outline, on top
    d.text((x, y), TEXT, font=font, fill=MUSTARD, stroke_width=stroke, stroke_fill=GREASE)
    return img


def main():
    master = make_master()
    png_sizes = [32, 64, 128, 256, 512]
    for s in png_sizes:
        out = os.path.join(ROOT, f"favicon-{s}.png")
        master.resize((s, s), Image.LANCZOS).save(out)
        print("wrote", out)

    # multi-size favicon.ico (includes 32; standard ICO maxes at 256)
    ico_master = master.resize((256, 256), Image.LANCZOS)
    ico = os.path.join(ROOT, "favicon.ico")
    ico_master.save(ico, format="ICO",
                    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("wrote", ico, "(16-256, incl. 32)")

    # large 512 .ico — standard ICO can't store >256 via the size byte, so hand-build
    # a single PNG-payload entry with the size field = 0 (modern readers use the PNG's
    # real dimensions). This yields a genuinely 512x512 .ico.
    big = os.path.join(ROOT, "favicon-512.ico")
    buf = io.BytesIO()
    master.resize((512, 512), Image.LANCZOS).save(buf, format="PNG")
    png = buf.getvalue()
    with open(big, "wb") as f:
        f.write(struct.pack("<HHH", 0, 1, 1))                       # ICONDIR: reserved, type=icon, count=1
        f.write(struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32,         # entry: w=0,h=0 (=>large), planes, bpp
                            len(png), 22))                          # bytes, offset (6+16)
        f.write(png)
    print("wrote", big, f"({len(png)} byte PNG payload, 512x512)")


if __name__ == "__main__":
    main()
