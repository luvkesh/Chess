"""A sheet of pictures side by side, to choose between candidates:
  python3 tools/model/picture/contact.py OUT.jpg COLUMNS picture [picture ...]
Each picture is labelled with its file name. Any Python with Pillow."""
import os
import sys

from PIL import Image, ImageDraw

out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
W, H = 300, 400
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, H * rows), (40, 40, 40))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    im.thumbnail((W, H - 16))
    x, y = (i % cols) * W, (i // cols) * H
    sheet.paste(im, (x + (W - im.width) // 2, y + 16))
    d.text((x + 4, y + 2), os.path.splitext(os.path.basename(f))[0], fill=(255, 220, 150))
sheet.save(out, quality=86)
print(out, sheet.size)
