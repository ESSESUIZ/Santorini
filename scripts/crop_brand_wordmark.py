from pathlib import Path
from PIL import Image

source = Path('public/santorini-wordmark.png')
target = Path('public/santorini-wordmark-cropped.png')
image = Image.open(source).convert('RGBA')
pixels = image.load()

for y in range(image.height):
    for x in range(image.width):
        red, green, blue, _ = pixels[x, y]
        if red > 225 and green > 225 and blue > 225:
            pixels[x, y] = (red, green, blue, 0)

bounds = image.getbbox()
if not bounds:
    raise RuntimeError('No se encontró el wordmark en la imagen de origen.')

padding = 14
left, top, right, bottom = bounds
image.crop((max(0, left - padding), max(0, top - padding), min(image.width, right + padding), min(image.height, bottom + padding))).save(target)
