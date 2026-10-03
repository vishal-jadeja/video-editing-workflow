"""NeetCode 150 Part 1 — minimalist motion-graphics edit, v3.

Glass-card overlays on the full face cam, plus split scenes where a frosted graphics band takes the top 38% of the
frame and the face cam glides into the bottom 62%. Colour: decode and encode explicitly in BT.709 (TV range) and tag
the output, so players don't guess a profile and shift skin tones.

    python3 edit.py render            # full render (run `python3 sfx.py` first)
    python3 edit.py stills 1.5 16 ... # preview stills (PNG) at given seconds

Media is read from and written to MEDIA_DIR (default: this folder's parent). SPLITS = [] gives the all-card layout.
"""
import math
import os
import re
import subprocess
import sys
from functools import lru_cache

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
MEDIA = os.environ.get("MEDIA_DIR", os.path.dirname(HERE))   # source footage, SRT and renders live here
SRC = os.path.join(MEDIA, "Neetcode 150 part 1.mov")
SRT = os.path.join(MEDIA, "Neetcode150 part 1.srt")
OUT = os.path.join(MEDIA, "Neetcode 150 part 1 - edit v3.mp4")

W, H, FPS = 2160, 3840, 30
DUR = 56.833

# ---------------------------------------------------------------- design tokens
WHITE = (255, 255, 255)
MUTED = (165, 172, 184)
MINT = (110, 231, 168)      # "good" / accent
CORAL = (255, 107, 107)     # duplicates / slow
AMBER = (251, 191, 36)      # middle-ground complexity
CELL = (255, 255, 255, 22)
CELL_EDGE = (255, 255, 255, 40)
INK = np.array([12, 14, 18], np.float32)

SF = "/System/Library/Fonts/SFNS.ttf"
MONO = os.path.expanduser("~/Library/Fonts/JetBrainsMonoNerdFont-Bold.ttf")
MONO_MED = os.path.expanduser("~/Library/Fonts/JetBrainsMonoNerdFont-Medium.ttf")

# Colour pipeline: BT.709 TV-range in, BT.709 TV-range out, tags written into the container.
DECODE_VF = "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24"
ENCODE_VF = ("scale=in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p,"
             "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv")


@lru_cache(None)
def sf(size, weight=700):
    f = ImageFont.truetype(SF, size)
    f.set_variation_by_axes([100, min(96, max(17, size / 4)), 400, weight])
    return f


@lru_cache(None)
def mono(size, medium=False):
    return ImageFont.truetype(MONO_MED if medium else MONO, size)


# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def prog(t, t0, d):
    return clamp((t - t0) / d) if d > 0 else float(t >= t0)


def out_cubic(x):
    return 1 - (1 - x) ** 3


def in_out_cubic(x):
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def out_back(x, s=1.4):
    x -= 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def lerp(a, b, x):
    return a + (b - a) * x


def window(t, t_in, t_out, fade_in=0.3, fade_out=0.25):
    """0..1 envelope: eased in at t_in, eased out ending at t_out."""
    if t < t_in or t > t_out:
        return 0.0
    return out_cubic(prog(t, t_in, fade_in)) * (1 - in_out_cubic(prog(t, t_out - fade_out, fade_out)))


# ---------------------------------------------------------------- sprites
@lru_cache(4096)
def text_sprite(text, size, color, font="sf", weight=700, shadow=True, track=0):
    f = sf(size, weight) if font == "sf" else mono(size, font == "mono_med")
    pad = int(size * 0.5) if shadow else 4
    if track:
        widths = [f.getlength(c) + track for c in text]
        tw = int(sum(widths) - track)
    else:
        tw = int(f.getlength(text))
    asc, desc = f.getmetrics()
    img = Image.new("RGBA", (tw + pad * 2, asc + desc + pad * 2), (0, 0, 0, 0))

    def draw_text(d, fill):
        if track:
            x = pad
            for c, w_ in zip(text, widths):
                d.text((x, pad), c, font=f, fill=fill)
                x += w_
        else:
            d.text((pad, pad), text, font=f, fill=fill)

    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw_text(ImageDraw.Draw(sh), (0, 0, 0, 150))
        sh = sh.filter(ImageFilter.GaussianBlur(size * 0.09))
        img = Image.alpha_composite(img, sh)
    draw_text(ImageDraw.Draw(img), tuple(color) + (255,) if len(color) == 3 else color)
    return img


@lru_cache(512)
def rrect_sprite(w, h, r, fill, outline=None, width=0):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=fill, outline=outline, width=width)
    return img


def place(layer, spr, cx, cy, scale=1.0, alpha=1.0, anchor="c"):
    """Composite a sprite onto the layer centred (or left-anchored) at cx, cy."""
    if alpha <= 0.003 or scale <= 0.01:
        return
    if abs(scale - 1) > 1e-3:
        spr = spr.resize((max(1, round(spr.width * scale)), max(1, round(spr.height * scale))), Image.BICUBIC)
    if alpha < 0.999:
        a = spr.getchannel("A").point(lambda v: int(v * alpha))
        spr = spr.copy()
        spr.putalpha(a)
    x = cx - spr.width / 2 if anchor == "c" else cx
    layer.alpha_composite(spr, (int(round(x)), int(round(cy - spr.height / 2))))


# ---------------------------------------------------------------- layout: split scenes
SPLIT_H = 1460                      # graphics band = top 38% of the frame; face cam keeps the bottom 62%
FACE_ANCHOR = (1080, 1450)          # roughly the face: zooms and the split move pivot here
SPLIT_DY = 1030                     # face drops ~1030px so the head sits in the upper half of the face band
SPLITS = [(10.75, 19.95), (41.95, 54.95)]   # (start, end) of each split scene; eases take SPLIT_EASE
SPLIT_EASE = 0.55


def split_k(t):
    """0 = full face cam, 1 = settled split."""
    k = 0.0
    for a, b in SPLITS:
        if a <= t <= b + SPLIT_EASE:
            k = max(k, in_out_cubic(prog(t, a, SPLIT_EASE)) * (1 - in_out_cubic(prog(t, b, SPLIT_EASE))))
    return k


# ---------------------------------------------------------------- captions
def parse_srt(path):
    raw = open(path, encoding="utf-8").read().strip()
    out = []
    for block in re.split(r"\n\s*\n", raw):
        lines = block.strip().splitlines()
        m = re.match(r"(\S+) --> (\S+)", lines[1])
        ts = [sum(float(x) * k for x, k in zip(s.replace(",", ".").split(":"), (3600, 60, 1))) for s in m.groups()]
        out.append((ts[0], ts[1], " ".join(lines[2:])))
    return out


FIXES = {"O(n^2)": "O(n²)", "Neetcode 150: part 1": "NeetCode 150: Part 1", "of Neetcode150": "of NeetCode 150"}
KEYWORDS = {"duplicate", "100,000", "O(n²)", "billions", "sort", "neighbors", "O(n", "log", "n)",
            "set", "length", "O(n)", "hash", "early", "exit", "true", "shrinks", "repeat", "whole"}
CAPTION_MUTE = [(3.2, 6.0), (55.0, 99)]   # title card / outro carry the words instead
CAP_Y_FULL, CAP_Y_SPLIT = 2235, 1335
CAP_SIZE = 112
CAPS = [(s, e, FIXES.get(txt, txt)) for s, e, txt in parse_srt(SRT)]


def draw_caption(layer, t):
    if any(a <= t < b for a, b in CAPTION_MUTE):
        return
    cur = None
    for i, (s, e, txt) in enumerate(CAPS):
        nxt = CAPS[i + 1][0] if i + 1 < len(CAPS) else DUR
        if s <= t < max(e, min(nxt, e + 0.4)):
            cur = (s, e, txt)
    if not cur:
        return
    s, e, txt = cur
    # During a split move, fade out at the old position and back in at the new one; never glide across the face.
    k = split_k(t)
    if k < 0.5:
        cap_y, cap_a = CAP_Y_FULL, clamp(1 - k / 0.2)
    else:
        cap_y, cap_a = CAP_Y_SPLIT, clamp((k - 0.8) / 0.2)
    if cap_a <= 0:
        return
    words = txt.split(" ")
    sprs = []
    for w_ in words:
        key = w_.strip(",.:")
        hot = key.lower() in KEYWORDS or key in KEYWORDS
        sprs.append(text_sprite(w_, CAP_SIZE, MINT if hot else WHITE))
    space = sf(CAP_SIZE).getlength(" ")
    pad = int(CAP_SIZE * 0.5)
    widths = [sp.width - 2 * pad for sp in sprs]
    total = sum(widths) + space * (len(words) - 1)
    x = W / 2 - total / 2
    # each word lands proportionally to its character offset through the phrase
    chars = [len(w_) + 1 for w_ in words]
    span = max(0.2, (e - s) * 0.8)
    acc = 0
    for sp, w_, c in zip(sprs, widths, chars):
        tw = s + span * acc / sum(chars)
        acc += c
        p = out_cubic(prog(t, tw - 0.04, 0.2))
        place(layer, sp, x - pad + sp.width / 2, cap_y + (1 - p) * 26, scale=lerp(0.94, 1, p), alpha=p * cap_a)
        x += w_ + space


# ---------------------------------------------------------------- stages: glass card (full face) or split band
CARD = dict(cx=W // 2, cy=2720, w=1800, h=720, r=64)
BAND = dict(cx=W // 2, cy=880, w=1800, h=720, r=0)    # virtual box inside the split band, for shared layouts


def card_spans():
    """Cards fill every stretch the split band doesn't, so SPLITS = [] gives the all-card layout of the first edit."""
    spans, start = [], 0.05
    for a, b in SPLITS:
        spans.append((start, a))
        start = b + 0.1
    return spans + [(start, DUR + 1)]


CARD_SPANS = card_spans()


def stage(t0, t1):
    """Scenes inside a split draw in the band; otherwise on the glass card."""
    return BAND if any(a <= t0 and t1 <= b for a, b in SPLITS) else CARD


def card_env(t):
    return max(window(t, a, b, 0.4, 0.35) for a, b in CARD_SPANS)


def frosted(frame, x0, y0, x1, y1, alpha, mask=None, tint=0.58):
    """Frosted glass: blurred, ink-tinted copy of the frame blended in place over [y0:y1, x0:x1]."""
    x0, y0, x1, y1 = max(0, int(x0)), max(0, int(y0)), min(W, int(x1)), min(H, int(y1))
    if alpha <= 0.003 or x1 <= x0 or y1 <= y0:
        return
    reg = frame[y0:y1, x0:x1]
    small = cv2.resize(reg, (max(1, reg.shape[1] // 10), max(1, reg.shape[0] // 10)), interpolation=cv2.INTER_AREA)
    small = cv2.GaussianBlur(small, (0, 0), 3)
    blur = cv2.resize(small, (reg.shape[1], reg.shape[0]), interpolation=cv2.INTER_LINEAR).astype(np.float32)
    glassy = blur * (1 - tint) + INK * tint
    m = alpha if mask is None else mask * alpha
    frame[y0:y1, x0:x1] = (reg * (1 - m) + glassy * m).astype(np.uint8)


def rounded_mask(w, h, r):
    mask = np.zeros((h, w), np.uint8)
    cv2.rectangle(mask, (r, 0), (w - r, h), 255, -1)
    cv2.rectangle(mask, (0, r), (w, h - r), 255, -1)
    for px, py in ((r, r), (w - r - 1, r), (r, h - r - 1), (w - r - 1, h - r - 1)):
        cv2.circle(mask, (px, py), r, 255, -1, lineType=cv2.LINE_AA)
    return mask.astype(np.float32)[..., None] / 255


def card_geom(t):
    a = card_env(t)
    s = lerp(0.96, 1.0, a)
    return a, CARD["cx"], CARD["cy"] + (1 - a) * 30, CARD["w"] * s, CARD["h"] * s


def draw_card_glass(frame, t):
    a, cx, cy, w, h = card_geom(t)
    if a <= 0.003:
        return
    x0, y0 = int(cx - w / 2), int(cy - h / 2)
    frosted(frame, x0, y0, x0 + int(w), y0 + int(h), a * 0.97, rounded_mask(int(w), int(h), CARD["r"]))


def card_edge(layer, t):
    a, cx, cy, w, h = card_geom(t)
    if a > 0.003:
        place(layer, rrect_sprite(int(w), int(h), CARD["r"], None, (255, 255, 255, 34), 3), cx, cy, alpha=a)


def draw_band(frame, t):
    """Split band: frosted panel growing down from the top edge, slightly denser than the cards."""
    k = split_k(t)
    if k > 0.003:
        frosted(frame, 0, 0, W, SPLIT_H * k, 1.0, tint=0.86)


def band_seam(layer, t):
    k = split_k(t)
    if k > 0.003:
        draw = max(0.0, min(1.0, (k - 0.4) / 0.6))   # hairline draws once the band is mostly in
        if draw > 0:
            place(layer, rrect_sprite(max(4, int(W * draw)), 4, 2, MINT + (200,)), 0, SPLIT_H * k - 2, anchor="l")


# ---------------------------------------------------------------- shared visuals
CELL_W, CELL_GAP = 168, 26


def row_x(n, i, cx=W / 2, cw=CELL_W, gap=CELL_GAP):
    total = n * cw + (n - 1) * gap
    return cx - total / 2 + cw / 2 + i * (cw + gap)


def cell(layer, value, cx, cy, alpha=1.0, scale=1.0, tone=None, cw=CELL_W):
    if tone is None:
        box = rrect_sprite(cw, cw, 34, CELL, CELL_EDGE, 3)
        col = WHITE
    else:
        r, g, b = tone
        box = rrect_sprite(cw, cw, 34, (r, g, b, 52), (r, g, b, 255), 5)
        col = tone
    place(layer, box, cx, cy, scale, alpha)
    place(layer, text_sprite(str(value), int(cw * 0.46), col, "mono", shadow=False), cx, cy - 4, scale, alpha)


def tone_mix(a, b, x):
    if x <= 0:
        return a
    if x >= 1:
        return b
    a = a or (255, 255, 255)
    return tuple(int(lerp(p, q, x)) for p, q in zip(a, b))


def header(layer, t, st, num, title, t0, t1, badge=None, badge_t=None, badge_col=WHITE):
    a = window(t, t0, t1, 0.35, 0.25)
    if a <= 0:
        return
    top = st["cy"] - st["h"] / 2 + 100
    left = st["cx"] - st["w"] / 2 + 90
    dx = (1 - a) * -30
    place(layer, text_sprite(num, 64, MUTED, "mono", shadow=False), left + dx, top, alpha=a, anchor="l")
    place(layer, text_sprite(title, 80, WHITE, shadow=False, weight=650), left + 130 + dx, top, alpha=a, anchor="l")
    if badge:
        p = prog(t, badge_t, 0.45)
        b = text_sprite(badge, 66, badge_col, "mono", shadow=False)
        r, g, bb = badge_col
        pill = rrect_sprite(b.width + 40, 118, 59, (r, g, bb, 38), (r, g, bb, 200), 3)
        right = st["cx"] + st["w"] / 2 - 90 - pill.width / 2
        sc = out_back(p) if p < 1 else 1
        place(layer, pill, right, top, sc, a * min(1, p * 2))
        place(layer, b, right, top, sc, a * min(1, p * 2))


def fmt_int(n):
    return f"{int(n):,}"


def progress_bar(layer, cx, cy, w, frac, col, alpha, marker=None):
    h = 26
    place(layer, rrect_sprite(int(w), h, 13, (255, 255, 255, 30)), cx, cy, alpha=alpha)
    fw = int(w * clamp(frac))
    if fw > h:
        r, g, b = col
        place(layer, rrect_sprite(fw, h, 13, (r, g, b, 255)), cx - w / 2, cy, alpha=alpha, anchor="l")
    if marker is not None:
        place(layer, rrect_sprite(10, 64, 5, CORAL + (255,)), cx - w / 2 + w * marker, cy, alpha=alpha)


# ---------------------------------------------------------------- scenes
ARR = [3, 1, 4, 1, 5, 9]


def scene_hook(layer, t):
    a = window(t, 0.05, 3.1, 0.3, 0.3)
    if a <= 0:
        return
    CY = CARD["cy"] + 40
    vals = [4, 9, 2, 7, 5, 9, 1, 6]
    n = len(vals)
    morph = in_out_cubic(prog(t, 1.75, 0.55))   # cells -> dot field
    found = out_cubic(prog(t, 1.3, 0.3))
    for i, v in enumerate(vals):
        p = out_back(prog(t, 0.12 + i * 0.05, 0.4)) if t < 1 else 1
        tone = tone_mix(None, CORAL, found) if v == 9 else None
        cell(layer, v, row_x(n, i, cw=170, gap=22), CY - 20, a * (1 - morph), p * lerp(1, 0.4, morph), tone, cw=170)
    if found > 0 and morph < 1:
        x1, x2 = row_x(n, 1, cw=170, gap=22), row_x(n, 5, cw=170, gap=22)
        arc = Image.new("RGBA", (int(x2 - x1) + 20, 160), (0, 0, 0, 0))
        ImageDraw.Draw(arc).arc((10, 30, arc.width - 10, 290), 180, 180 + 180 * found, fill=CORAL + (255,), width=7)
        place(layer, arc, (x1 + x2) / 2, CY - 175, alpha=a * (1 - morph))
    if morph > 0:   # "Now do it for 100,000 numbers": dense dot field + counter
        cols, rows = 44, 9
        dot = rrect_sprite(16, 16, 8, (255, 255, 255, 150))
        for r in range(rows):
            for c in range(cols):
                k = (r * 7 + c * 3) % 23 / 23
                p = out_cubic(prog(t, 1.8 + k * 0.6, 0.35))
                if p > 0:
                    place(layer, dot, W / 2 + (c - (cols - 1) / 2) * 34, CY + 60 + (r - (rows - 1) / 2) * 34, p, a * p)
        cnt = 100000 * out_cubic(prog(t, 1.8, 1.0))
        place(layer, text_sprite(fmt_int(round(cnt / 7) * 7 if cnt < 100000 else 100000), 120, WHITE, "mono", shadow=False),
              W / 2, CY - 200, alpha=a * morph)


def scene_title(layer, t):
    a = window(t, 3.25, 6.05, 0.35, 0.35)
    if a <= 0:
        return
    y0 = CARD["cy"] - 230
    k = out_cubic(prog(t, 3.25, 0.5))
    place(layer, text_sprite("NEETCODE 150", 76, MINT, weight=700, track=20, shadow=False), W / 2, y0 + (1 - k) * 30, alpha=a * k)
    p2 = out_cubic(prog(t, 3.55, 0.5))
    place(layer, text_sprite("Part 1", 120, WHITE, weight=800, shadow=False), W / 2, y0 + 140 + (1 - p2) * 40, alpha=a * p2)
    p3 = out_cubic(prog(t, 4.9, 0.5))   # problem name lands on "Contains Duplicate"
    line_w = int(820 * in_out_cubic(prog(t, 4.75, 0.6)))
    if line_w > 4:
        place(layer, rrect_sprite(line_w, 5, 2, (255, 255, 255, 70)), W / 2, y0 + 250, alpha=a)
    place(layer, text_sprite("Contains Duplicate", 136, WHITE, weight=760, shadow=False), W / 2, y0 + 370 + (1 - p3) * 40, alpha=a * p3)
    p4 = out_cubic(prog(t, 5.2, 0.4))
    tag = text_sprite("#217  ·  EASY", 60, MINT, "mono", shadow=False)
    pill = rrect_sprite(tag.width + 56, 108, 54, (110, 231, 168, 30), (110, 231, 168, 170), 3)
    place(layer, pill, W / 2, y0 + 510, lerp(0.9, 1, p4), a * p4)
    place(layer, tag, W / 2, y0 + 510, lerp(0.9, 1, p4), a * p4)


def scene_problem(layer, t):
    a = window(t, 6.05, 10.6, 0.35, 0.3)
    if a <= 0:
        return
    CY, PS = CARD["cy"] + 40, 96
    left = CARD["cx"] - CARD["w"] / 2 + 130
    rows = [(6.15, "[1, 2, 3, 1]", "true", MINT, 7.7), (9.15, "[1, 2, 3, 4]", "false", CORAL, 9.9)]
    for i, (t0, arr, res, col, tr) in enumerate(rows):
        y = CY - 110 + i * 210
        p = out_cubic(prog(t, t0, 0.4))
        place(layer, text_sprite("nums = " + arr, PS, WHITE, "mono_med", shadow=False), left + (1 - p) * -20, y, alpha=a * p, anchor="l")
        q = out_cubic(prog(t, tr, 0.35))
        ax = left + mono(PS, True).getlength("nums = [1, 2, 3, 1]") + 60
        place(layer, text_sprite("→", PS, MUTED, "mono", shadow=False), ax, y, alpha=a * q, anchor="l")
        place(layer, text_sprite(res, PS, col, "mono", shadow=False), ax + 130 + (1 - q) * 20, y, alpha=a * q, anchor="l")
    u = in_out_cubic(prog(t, 7.75, 0.4))   # underline the repeated 1s
    f = mono(PS, True)
    base = left + f.getlength("nums = [")
    if u > 0:
        for idx in (0, 9):
            x = base + f.getlength("1, 2, 3, 1"[:idx])
            place(layer, rrect_sprite(max(2, int(f.getlength("1") * u)), 8, 4, CORAL + (255,)), x, CY - 40, alpha=a, anchor="l")


def scene_brute(layer, t):
    """Split scene: pair sweep, O(n²), then the 100,000-number cost."""
    t0, t1 = 11.15, 19.85
    st = stage(t0, t1)
    a = window(t, t0, t1, 0.35, 0.3)
    if a <= 0:
        return
    CY = st["cy"] + 60
    header(layer, t, st, "01", "Brute force", t0, t1, "O(n²)", 15.75, CORAL)
    n = len(ARR)
    stat = in_out_cubic(prog(t, 17.1, 0.5))
    pairs = [(i, j) for i in range(n) for j in range(i + 1, n)]
    sp = prog(t, 11.9, 3.7)
    k = min(len(pairs) - 1, int(sp * len(pairs))) if t >= 11.9 else -1
    for i, v in enumerate(ARR):
        p = out_back(prog(t, t0 + 0.1 + i * 0.05, 0.4))
        tone = None
        if k >= 0 and sp < 1 and i in pairs[k]:
            tone = CORAL if ARR[pairs[k][0]] == ARR[pairs[k][1]] else MINT
        cell(layer, v, row_x(n, i), CY + 10 - stat * 40, a * p * (1 - stat), p, tone)
    if 0 <= k and sp < 1:
        i, j = pairs[k]
        x1, x2 = row_x(n, i), row_x(n, j)
        arc = Image.new("RGBA", (int(x2 - x1) + 20, 120), (0, 0, 0, 0))
        col = CORAL if ARR[i] == ARR[j] else MINT
        ImageDraw.Draw(arc).arc((10, 20, arc.width - 10, 220), 180, 360, fill=col + (230,), width=6)
        place(layer, arc, (x1 + x2) / 2, CY - 134, alpha=a * (1 - stat))
    if stat < 1:
        cmp_n = min(15, int(out_cubic(sp) * 15)) if t >= 11.9 else 0
        place(layer, text_sprite(f"{cmp_n} comparisons for 6 numbers", 64, MUTED, shadow=False, weight=500),
              W / 2, CY + 190, alpha=a * (1 - stat) * out_cubic(prog(t, 11.9, 0.3)))
    if stat > 0:
        c = 5_000_000_000 * out_cubic(prog(t, 17.15, 1.6))
        place(layer, text_sprite("≈ " + fmt_int(round(c, -6)), 132, CORAL, "mono", shadow=False), W / 2, CY - 20 + (1 - stat) * 30, alpha=a * stat)
        place(layer, text_sprite("comparisons for 100,000 numbers", 64, MUTED, shadow=False, weight=500), W / 2, CY + 130, alpha=a * stat)


def scene_sort(layer, t):
    t0, t1 = 20.45, 28.05
    a = window(t, t0, t1, 0.35, 0.25)
    if a <= 0:
        return
    CY = CARD["cy"] + 40
    header(layer, t, CARD, "02", "Sort first", t0, t1, "O(n log n)", 26.55, AMBER)
    order = sorted(range(len(ARR)), key=lambda i: (ARR[i], i))
    slot = {src: dst for dst, src in enumerate(order)}
    n = len(ARR)
    s = prog(t, 20.95, 1.25)
    dup = out_cubic(prog(t, 23.0, 0.35))
    for i, v in enumerate(ARR):
        p = out_back(prog(t, t0 + 0.1 + i * 0.05, 0.4))
        si = in_out_cubic(clamp((s - i * 0.05) / 0.75))   # stagger each move for an organic shuffle
        x = lerp(row_x(n, i), row_x(n, slot[i]), si)
        lift = math.sin(si * math.pi) * (70 if slot[i] > i else -70)
        cell(layer, v, x, CY + 20 - lift, a * p, p, tone_mix(None, CORAL, dup) if v == 1 else None)
    w_ = prog(t, 24.35, 1.7)   # neighbour bracket walks across adjacent pairs
    if 24.35 < t < 26.3:
        k = min(n - 2, int(w_ * (n - 1)))
        x1, x2 = row_x(n, k), row_x(n, k + 1)
        br = rrect_sprite(int(x2 - x1 + CELL_W + 40), CELL_W + 40, 44, None, (255, 255, 255, 200), 4)
        place(layer, br, (x1 + x2) / 2, CY + 20, alpha=a * window(t, 24.35, 26.3, 0.2, 0.25))
    place(layer, text_sprite("duplicates end up side by side", 64, MUTED, shadow=False, weight=500), W / 2, CY + 210,
          alpha=window(t, 23.0, t1, 0.35, 0.25))


def scene_set(layer, t):
    t0, t1 = 28.05, 41.8
    a = window(t, t0, t1, 0.35, 0.3)
    if a <= 0:
        return
    CY = CARD["cy"] + 40
    header(layer, t, CARD, "03", "Set length", t0, t1, "O(n)", 35.1, WHITE)
    left = CARD["cx"] - CARD["w"] / 2 + 90
    phase2 = in_out_cubic(prog(t, 36.6, 0.5))
    place(layer, text_sprite("len(set(nums)) < len(nums)", 80, MINT, "mono_med", shadow=False),
          left, CY - 120, alpha=a * out_cubic(prog(t, 28.6, 0.4)) * (1 - phase2), anchor="l")
    drop = in_out_cubic(prog(t, 31.6, 0.7))   # the repeated 1 drops out and the row closes up
    n, uniq = len(ARR), [0, 1, 2, 4, 5]
    for i, v in enumerate(ARR):
        p = out_cubic(prog(t, 29.2 + i * 0.05, 0.4))
        if i == 3:
            cell(layer, v, row_x(n, i), CY + 90 + drop * 120, a * p * (1 - drop) * (1 - phase2), 1 - drop * 0.3, CORAL if drop > 0 else None)
            continue
        x = lerp(row_x(n, i), row_x(5, uniq.index(i)), in_out_cubic(prog(t, 32.2, 0.6)))
        cell(layer, v, x, CY + 90, a * p * (1 - phase2), 1)
    la = out_cubic(prog(t, 30.5, 0.4)) * (1 - phase2)
    shrink = prog(t, 33.2, 0.3)
    rspr = text_sprite("len 6  →  5" if shrink > 0 else "len 6", 64, CORAL if shrink > 0 else MUTED, "mono", shadow=False)
    place(layer, rspr, CARD["cx"] + CARD["w"] / 2 - 100 - rspr.width / 2, CY + 250, alpha=a * la)
    if phase2 > 0:   # always scans the whole array
        fill, bw = in_out_cubic(prog(t, 38.2, 3.2)), 1500
        place(layer, text_sprite("duplicate at index 1", 64, CORAL, shadow=False, weight=600), W / 2 - bw / 2, CY - 110,
              alpha=a * phase2, anchor="l")
        progress_bar(layer, W / 2, CY + 20, bw, fill, WHITE, a * phase2, marker=0.02)
        place(layer, text_sprite(f"scanned {fmt_int(fill * 100000)} / 100,000", 68, WHITE, "mono", shadow=False),
              W / 2, CY + 150, alpha=a * phase2)


def scene_hash(layer, t):
    """Split scene: hash-set walk with early exit, then scan-length comparison."""
    t0, t1 = 42.35, 54.85
    st = stage(t0, t1)
    a = window(t, t0, t1, 0.35, 0.35)
    if a <= 0:
        return
    CY = st["cy"] + 60
    header(layer, t, st, "04", "Hash set + early exit", t0, t1, "O(n)", 51.4, MINT)
    phase2 = in_out_cubic(prog(t, 51.35, 0.5))
    n = len(ARR)
    steps = [45.5, 46.2, 46.9, 47.7]       # visit i = 0..3, hit on i = 3
    hit = out_cubic(prog(t, steps[3] + 0.15, 0.3))
    cur = max([i for i, s_ in enumerate(steps) if t >= s_], default=-1)
    ya, cw = CY - 70, 150
    for i, v in enumerate(ARR):
        p = out_cubic(prog(t, t0 + 0.15 + i * 0.05, 0.4))
        tone = tone_mix(None, CORAL, hit) if (i == 3 and hit > 0) else MINT if i == cur else None
        dim = 0.35 if (cur == 3 and i > 3 and hit > 0) else 1   # never visited
        cell(layer, v, row_x(n, i, cw=cw, gap=24), ya, a * p * dim * (1 - phase2), 1, tone, cw=cw)
    if cur >= 0 and phase2 < 1:
        mv = in_out_cubic(prog(t, steps[cur], 0.25))
        x = lerp(row_x(n, max(0, cur - 1), cw=cw, gap=24), row_x(n, cur, cw=cw, gap=24), mv if cur > 0 else 1)
        place(layer, text_sprite("▲", 44, MINT if cur < 3 else CORAL, shadow=False), x, ya + 112, alpha=a * (1 - phase2))
    left = st["cx"] - st["w"] / 2 + 130
    sy = CY + 175
    sa = out_cubic(prog(t, 45.3, 0.4)) * (1 - phase2)
    place(layer, text_sprite("seen", 64, MUTED, "mono", shadow=False), left, sy, alpha=a * sa, anchor="l")
    for k, v in enumerate(ARR[:3]):
        p = out_back(prog(t, steps[k] + 0.25, 0.35))
        cell(layer, v, left + 300 + k * 160, sy, a * min(1, p) * (1 - phase2), p * 0.85, CORAL if (v == 1 and hit > 0) else None, cw=150)
    rt = out_back(prog(t, 48.95, 0.45))
    if rt > 0:
        b = text_sprite("return true", 72, MINT, "mono", shadow=False)
        pill = rrect_sprite(b.width + 60, 130, 65, (110, 231, 168, 40), (110, 231, 168, 220), 3)
        px = st["cx"] + st["w"] / 2 - 110 - pill.width / 2
        place(layer, pill, px, sy, rt, a * (1 - phase2) * min(1, rt * 2))
        place(layer, b, px, sy, rt, a * (1 - phase2) * min(1, rt * 2))
    if phase2 > 0:   # set length scans everything; early exit stops at the repeat
        bw = 1060
        lx = st["cx"] - st["w"] / 2 + 130
        bx = st["cx"] + st["w"] / 2 - 110 - bw / 2
        fill = in_out_cubic(prog(t, 51.9, 1.6))
        for name, f_, col, y in (("set length", fill, WHITE, CY - 70), ("early exit", min(fill, 0.04), MINT, CY + 90)):
            place(layer, text_sprite(name, 62, MUTED if col == WHITE else MINT, "mono", shadow=False), lx, y, alpha=a * phase2, anchor="l")
            progress_bar(layer, bx, y, bw, f_, col, a * phase2)
        place(layer, text_sprite("stops at the first repeat", 62, MINT, shadow=False, weight=600),
              bx - bw / 2 + 60, CY + 175, alpha=a * phase2 * out_cubic(prog(t, 52.6, 0.4)), anchor="l")


def scene_outro(layer, t):
    a = window(t, 55.05, DUR + 1, 0.4, 0.3)
    if a <= 0:
        return
    k = out_back(prog(t, 55.05, 0.55))
    y = CARD["cy"] + 10
    place(layer, text_sprite("Follow for", 92, WHITE, weight=600, shadow=False), W / 2, y - 150 + (1 - k) * 30, alpha=a * min(1, k))
    b = text_sprite("Part 2  →", 120, (10, 12, 16), shadow=False, weight=800)
    breathe = 1 + 0.015 * math.sin((t - 55.6) * 5) * prog(t, 55.6, 0.3)
    pill = rrect_sprite(b.width + 120, 210, 105, MINT + (255,))
    place(layer, pill, W / 2, y + 60, lerp(0.85, 1, min(1, k)) * breathe, a * min(1, k))
    place(layer, b, W / 2, y + 60, lerp(0.85, 1, min(1, k)) * breathe, a * min(1, k))


def topbar(layer, t):
    """Persistent problem label once the problem is introduced."""
    a = window(t, 6.1, 55.0, 0.5, 0.35)
    if a <= 0:
        return
    s = text_sprite("CONTAINS DUPLICATE  ·  217", 58, (235, 238, 243), weight=650, track=6, shadow=False)
    place(layer, rrect_sprite(s.width + 64, 116, 58, (12, 14, 18, 160)), W / 2, 330, alpha=a)
    place(layer, s, W / 2, 330, alpha=a)


SCENES = [scene_hook, scene_title, scene_problem, scene_brute, scene_sort, scene_set, scene_hash, scene_outro]

# ---------------------------------------------------------------- camera
# Gentle eased punch-ins on beats, only while the face cam is full frame.
ZOOM_KEYS = [(0.0, 1.0), (1.72, 1.07), (3.2, 1.0), (6.0, 1.035), (10.2, 1.0), (20.5, 1.0), (26.5, 1.05), (28.0, 1.0),
             (35.0, 1.045), (41.4, 1.0), (55.5, 1.05)]
ZD = 0.45


def zoom_at(t):
    z = ZOOM_KEYS[0][1]
    for k, zk in ZOOM_KEYS[1:]:
        if t >= k:
            z = lerp(z, zk, in_out_cubic(prog(t, k, ZD)))
    return z


def camera(frame, t):
    """Zoom around the face, plus the split move that drops the face cam into the bottom 62%."""
    z, k = zoom_at(t), split_k(t)
    if abs(z - 1) < 1e-4 and k < 1e-4:
        return frame
    ax, ay = FACE_ANCHOR
    M = np.float32([[z, 0, ax - ax * z], [0, z, ay - ay * z + SPLIT_DY * k]])
    return cv2.warpAffine(frame, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


# ---------------------------------------------------------------- compositor
def composite(frame, t):
    frame = np.ascontiguousarray(camera(frame, t))
    draw_band(frame, t)
    draw_card_glass(frame, t)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    band_seam(layer, t)
    card_edge(layer, t)
    topbar(layer, t)
    for sc in SCENES:
        sc(layer, t)
    draw_caption(layer, t)
    bbox = layer.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        ov = np.asarray(layer.crop(bbox), dtype=np.uint16)
        al = ov[..., 3:4]
        reg = frame[y0:y1, x0:x1].astype(np.uint16)
        frame[y0:y1, x0:x1] = ((ov[..., :3] * al + reg * (255 - al) + 127) // 255).astype(np.uint8)
    return frame


def decoder(start=0.0):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start), "-i", SRC, "-map", "0:v:0", "-vf", DECODE_VF,
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=W * H * 3 * 2)


def read_frame(proc):
    buf = proc.stdout.read(W * H * 3)
    if len(buf) < W * H * 3:
        return None
    return np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()


def stills(times):
    out_dir = os.path.join(HERE, "stills")
    os.makedirs(out_dir, exist_ok=True)
    for t in times:
        p = decoder(t)
        f = read_frame(p)
        p.kill()
        Image.fromarray(composite(f, t)).resize((W // 4, H // 4), Image.LANCZOS).save(os.path.join(out_dir, f"s_{t:05.2f}.png"))
        print("still", t)


def render():
    audio = os.path.join(HERE, "audio_mix.wav")
    if not os.path.exists(audio):
        sys.exit("audio_mix.wav is missing: run `python3 sfx.py` first")
    enc = subprocess.Popen([
        "ffmpeg", "-v", "error", "-stats", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-color_range", "pc", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", audio, "-map", "0:v", "-map", "1:a",
        "-vf", ENCODE_VF,
        "-c:v", "libx264", "-preset", "medium", "-crf", "17",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
        "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart+write_colr", "-shortest", OUT,
    ], stdin=subprocess.PIPE)
    dec = decoder(0)
    i = 0
    while True:
        f = read_frame(dec)
        if f is None:
            break
        enc.stdin.write(composite(f, i / FPS).tobytes())
        i += 1
        if i % 150 == 0:
            print(f"frame {i}", flush=True)
    enc.stdin.close()
    if enc.wait() != 0 or dec.wait() != 0:
        sys.exit(f"ffmpeg failed after {i} frames")
    print("done", i, "frames ->", OUT)


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ("render", "stills"):
        sys.exit(__doc__)
    if sys.argv[1] == "stills":
        stills([float(x) for x in sys.argv[2:]])
    else:
        render()
