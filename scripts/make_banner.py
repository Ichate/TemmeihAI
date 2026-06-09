from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import random

W, H = 1280, 640
BG = (10, 10, 10)
ACCENT = (95, 207, 101)
TEXT = (232, 232, 232)
DIM = (58, 58, 58)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

for y in range(0, H, 4):
    draw.line([(0, y), (W, y)], fill=(18, 18, 18))

random.seed(42)
for _ in range(120):
    x = random.randint(0, W)
    y = random.randint(0, H)
    s = random.choice([2, 2, 3, 4])
    a = random.choice([(30, 30, 30), (40, 60, 40), (25, 25, 25)])
    draw.rectangle([x, y, x + s, y + s], fill=a)

block_size = 28
margin_x = 80
margin_y = 60
for i in range(8):
    x = margin_x + i * (block_size + 4)
    y = margin_y
    if i % 2 == 0:
        draw.rectangle([x, y, x + block_size, y + block_size], outline=ACCENT, width=2)
    else:
        draw.rectangle([x, y, x + block_size, y + block_size], outline=DIM, width=2)

for i in range(8):
    x = W - margin_x - (i + 1) * (block_size + 4)
    y = H - margin_y - block_size
    if i % 2 == 0:
        draw.rectangle([x, y, x + block_size, y + block_size], outline=ACCENT, width=2)
    else:
        draw.rectangle([x, y, x + block_size, y + block_size], outline=DIM, width=2)

def load_font(size, prefer_pixel=True):
    candidates = []
    if prefer_pixel:
        candidates += [
            "C:/Windows/Fonts/PressStart2P-Regular.ttf",
            "C:/Windows/Fonts/VT323-Regular.ttf",
        ]
    candidates += [
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/lucon.ttf",
        "C:/Windows/Fonts/cour.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

title_font = load_font(120)
sub_font   = load_font(38, prefer_pixel=False)
foot_font  = load_font(22, prefer_pixel=False)

def text_size(font, text):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

LOGO_CELL = 6
LOGO_GRID = 32
LOGO_PX = LOGO_GRID * LOGO_CELL

def draw_logo(ox, oy, cell, color=ACCENT, bg=BG):
    draw.rectangle([ox, oy, ox + LOGO_GRID * cell, oy + LOGO_GRID * cell], fill=bg)
    rects = [
        (8, 8, 4, 4),
        (20, 8, 4, 4),
        (8, 16, 4, 4),
        (12, 20, 8, 4),
        (20, 16, 4, 4),
    ]
    for x, y, w, h in rects:
        draw.rectangle(
            [ox + x * cell, oy + y * cell, ox + (x + w) * cell, oy + (y + h) * cell],
            fill=color,
        )

title = "temmeihAI"
sub   = "ai bots that actually play minecraft with you"
foot  = "open-source // mineflayer + multi-llm"

tw, th = text_size(title_font, title)
sw, sh = text_size(sub_font, sub)

logo_size = LOGO_PX
gap_logo_text = 32

bracket_w = 22
group_w = logo_size + gap_logo_text + bracket_w + 10 + tw + 18 + bracket_w
group_x = (W - group_w) // 2
group_y = (H - (max(logo_size, th) + 30 + sh)) // 2

logo_x = group_x
logo_y = group_y + (max(logo_size, th) - logo_size) // 2

draw_logo(logo_x, logo_y, LOGO_CELL, color=ACCENT)

title_x = group_x + logo_size + gap_logo_text + bracket_w + 10
title_y = group_y + (max(logo_size, th) - th) // 2

shadow_offset = 6
draw.text((title_x + shadow_offset, title_y + shadow_offset), title, font=title_font, fill=(20, 60, 22))
draw.text((title_x, title_y), title, font=title_font, fill=ACCENT)

bracket_h = th
left_bx = title_x - bracket_w - 10
right_bx = title_x + tw + 18
draw.line([(left_bx, title_y), (left_bx, title_y + bracket_h)], fill=ACCENT, width=4)
draw.line([(left_bx, title_y), (left_bx + 12, title_y)], fill=ACCENT, width=4)
draw.line([(left_bx, title_y + bracket_h), (left_bx + 12, title_y + bracket_h)], fill=ACCENT, width=4)
draw.line([(right_bx + bracket_w, title_y), (right_bx + bracket_w, title_y + bracket_h)], fill=ACCENT, width=4)
draw.line([(right_bx + bracket_w - 12, title_y), (right_bx + bracket_w, title_y)], fill=ACCENT, width=4)
draw.line([(right_bx + bracket_w - 12, title_y + bracket_h), (right_bx + bracket_w, title_y + bracket_h)], fill=ACCENT, width=4)

sub_x = (W - sw) // 2
sub_y = group_y + max(logo_size, th) + 36
draw.text((sub_x, sub_y), sub, font=sub_font, fill=TEXT)

line_y = sub_y + sh + 22
line_w = sw + 100
draw.line([((W - line_w) // 2, line_y), ((W + line_w) // 2, line_y)], fill=DIM, width=2)

fw, fh = text_size(foot_font, foot)
draw.text(((W - fw) // 2, H - 50), foot, font=foot_font, fill=DIM)

border = 6
draw.rectangle([0, 0, W - 1, H - 1], outline=DIM, width=2)
draw.rectangle([border, border, W - 1 - border, H - 1 - border], outline=ACCENT, width=2)

out_path = Path(__file__).resolve().parent.parent / "banner.png"
img.save(out_path, "PNG")
print(f"saved {out_path} ({W}x{H})")
