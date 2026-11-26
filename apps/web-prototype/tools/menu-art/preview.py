import sys; from PIL import Image, ImageDraw
sys.path.insert(0, '.'); from crops import CROPS
REF = '/mnt/project-files/menu-redesign/ref/'
names = sys.argv[2:] or list(CROPS)
tiles = []
for n in names:
    f, b = CROPS[n]; im = Image.open(REF + f).convert('RGB').crop(b); im.thumbnail((240, 240)); tiles.append((n, im))
W = 260; cols = 6; rows = (len(tiles) + cols - 1) // cols
sh = Image.new('RGB', (W * cols, 270 * rows), (20, 20, 20)); d = ImageDraw.Draw(sh)
for i, (n, im) in enumerate(tiles):
    x, y = (i % cols) * W, (i // cols) * 270; sh.paste(im, (x + 10, y + 5)); d.text((x + 10, y + 252), n, fill='yellow')
sh.save(sys.argv[1])
