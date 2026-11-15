"""Two Worlds photo pipeline v3 — natural, clean edit (global adjustments only; no local contrast, no colour shifts).
python3 photo3.py IN SLUG Place Country DATE Caption [crop l,t,r,b]"""
import sys, numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont
src, slug, place, country, date, caption = sys.argv[1:7]
crop = tuple(int(v) for v in sys.argv[7].split(',')) if len(sys.argv) > 7 and sys.argv[7] else None
im = Image.open(src).convert('RGB')
if crop: im = im.crop(crop)
a = np.asarray(im).astype(np.float32) / 255
L = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
# 1 levels: set true black and white points, same for all channels (no colour cast)
lo, hi = np.percentile(L, 0.3), np.percentile(L, 99.8)
lo = min(lo, 0.06); hi = max(hi, 0.9)
a = np.clip((a - lo) / (hi - lo), 0, 1)
L = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
# 2 one smooth tone curve on luminance: gentle shadow lift + mild S, applied as a ratio so hues stay put
f = L ** 0.9
f = f * 0.88 + 0.12 * (3 * f * f - 2 * f ** 3)
r = np.where(L > 1e-4, f / np.maximum(L, 1e-4), 1.0)[..., None]
a = a * r
over = np.clip(a.max(2, keepdims=True), 1, None)        # keep highlights from clipping to odd hues
a = a / over
# 3 a touch of warmth and saturation, uniform across the frame
a[..., 0] *= 1.012; a[..., 2] *= 0.988
L = (a @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
a = np.clip(L + (a - L) * 1.06, 0, 1)
out = Image.fromarray((a * 255 + np.random.uniform(-0.5, 0.5, a.shape)).clip(0, 255).astype(np.uint8))
out = out.filter(ImageFilter.UnsharpMask(radius=1.0, percent=45, threshold=4))
year = date[:4]
def meta(img):
    ex = img.getexif(); ex[0x013B] = 'Shaun Ji-Thompson'
    ex[0x8298] = f'Copyright {year} Shaun Ji-Thompson. All rights reserved.'
    ex[0x010E] = f'{place}, {country}, {date}. {caption}'; return ex
out.save(f'{slug}-master.jpg', quality=95, subsampling=0, exif=meta(out))
k = 2000 / max(out.size); web = out.resize((round(out.width * k), round(out.height * k)), Image.LANCZOS).convert('RGBA')
lay = Image.new('RGBA', web.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(lay)
font = ImageFont.truetype('/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf', 22)
text = '© SHAUN JI-THOMPSON'; sp = 3
ws = [dr.textlength(c, font=font) for c in text]; tw = sum(ws) + sp * (len(text) - 1)
x0 = web.width - tw - 36; y0 = web.height - 58
for ox, oy, col in [(1, 1, (0, 0, 0, 70)), (0, 0, (241, 238, 231, 165))]:
    x = x0 + ox
    for c, cw in zip(text, ws): dr.text((x, y0 + oy), c, font=font, fill=col); x += cw + sp
web = Image.alpha_composite(web, lay).convert('RGB')
web.save(f'{slug}.jpg', quality=88, optimize=True, progressive=True, exif=meta(web))
