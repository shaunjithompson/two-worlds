"""Two Worlds photo pipeline v2 — refined edit.
python3 photo2.py IN SLUG Place Country DATE Caption [crop l,t,r,b] [shadows 0-1] [warmth]"""
import sys, cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont
src, slug, place, country, date, caption = sys.argv[1:7]
crop = tuple(int(v) for v in sys.argv[7].split(',')) if len(sys.argv) > 7 and sys.argv[7] else None
SH = float(sys.argv[8]) if len(sys.argv) > 8 else 0.5
WARM = float(sys.argv[9]) if len(sys.argv) > 9 else 1.0
bgr = cv2.imread(src)
if crop: l, t, r, b = crop; bgr = bgr[t:b, l:r]
# 1 noise reduction (phone sensor, mostly in shadows)
bgr = cv2.fastNlMeansDenoisingColored(bgr, None, 2, 3, 7, 21)
# smooth flat areas (sky) to remove JPEG blocking before any contrast work
f = bgr.astype(np.float32) / 255; g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
mu = cv2.GaussianBlur(g, (0, 0), 3); sd0 = np.sqrt(np.clip(cv2.GaussianBlur(g * g, (0, 0), 3) - mu * mu, 0, None))
edge = cv2.GaussianBlur(np.clip((sd0 - 0.008) / 0.02, 0, 1), (0, 0), 3)[..., None]
f = f * edge + cv2.GaussianBlur(f, (0, 0), 7) * (1 - edge)
lab = cv2.cvtColor(f, cv2.COLOR_BGR2LAB)
lab = np.dstack([lab[..., 0] * 255 / 100, lab[..., 1] + 128, lab[..., 2] + 128]).astype(np.float32)
L = lab[..., 0] / 255.0
# 2 tone: lift shadows, protect highlights, gentle S in mids
base = cv2.GaussianBlur(L, (0, 0), 25)                       # local luminance for masking
shadow_mask = np.clip(1 - base / 0.45, 0, 1) ** 1.5
L = L + SH * 0.22 * shadow_mask * (1 - L)
hi_mask = np.clip((base - 0.7) / 0.3, 0, 1)
L = L - 0.08 * hi_mask * L
L = np.clip(L, 0, 1)
L = L + 0.06 * np.sin((L - 0.5) * np.pi) * (1 - np.abs(L - 0.5) * 2) * 0  # placeholder no-op
L = 0.5 + (L - 0.5) * 1.06
# texture mask: clarity only where there is detail, never in smooth sky
m = cv2.GaussianBlur(L, (0, 0), 4); sd = np.sqrt(np.clip(cv2.GaussianBlur(L * L, (0, 0), 4) - m * m, 0, None))
tex = cv2.GaussianBlur(np.clip((sd - 0.012) / 0.03, 0, 1), (0, 0), 6)
# 3 local contrast (CLAHE on 16-bit) blended by texture
cl = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8)).apply((np.clip(L, 0, 1) * 65535).astype(np.uint16)) / 65535.0
L = L + 0.35 * tex * (cl - L)
# 4 clarity: midtone large-radius unsharp, texture only
blur = cv2.GaussianBlur(L, (0, 0), 12)
mid = 1 - np.abs(L - 0.5) * 2
L = np.clip(L + 0.30 * (L - blur) * mid * tex, 0, 1)
# levels: anchor true blacks and whites, then gentle S-curve
lo, hi = np.percentile(L, 0.4), np.percentile(L, 99.7)
L = np.clip((L - lo) / (hi - lo) * 0.96 + 0.02, 0, 1)
L = L * 0.78 + 0.22 * (3 * L * L - 2 * L ** 3)
lab[..., 0] = L * 255
# 5 split tone: warm highlights, cool deep shadows (in LAB a/b)
lab[..., 2] += WARM * (6 * np.clip((L - 0.55) / 0.45, 0, 1) - 4 * np.clip((0.35 - L) / 0.35, 0, 1))
lab[..., 1] += WARM * (1.5 * np.clip((L - 0.55) / 0.45, 0, 1))
# 6 vibrance: boost low-saturation colour more than saturated
a, b = lab[..., 1] - 128, lab[..., 2] - 128
chroma = np.sqrt(a * a + b * b)
boost = 1 + 0.22 * np.clip(1 - chroma / 40, 0, 1)
lab[..., 1] = 128 + a * boost; lab[..., 2] = 128 + b * boost
lab = lab + np.random.uniform(-0.5, 0.5, lab.shape).astype(np.float32)  # dither: no banding
bgr = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32) / 255
# 7 subtle vignette
h, w = bgr.shape[:2]; yy, xx = np.ogrid[:h, :w]
d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
bgr *= np.clip(1 - 0.16 * np.clip(d - 0.65, 0, None), 0.78, 1)[..., None]
bgr += np.random.normal(0, 0.006, bgr.shape[:2]).astype(np.float32)[..., None]  # fine film grain
img8 = (np.clip(bgr, 0, 1) * 255).astype(np.uint8)
# 8 output sharpening
sharp = cv2.addWeighted(img8, 1.35, cv2.GaussianBlur(img8, (0, 0), 1.1), -0.35, 0)
out = Image.fromarray(cv2.cvtColor(sharp, cv2.COLOR_BGR2RGB))
year = date[:4]
def meta(im):
    ex = im.getexif(); ex[0x013B] = 'Shaun Ji-Thompson'
    ex[0x8298] = f'Copyright {year} Shaun Ji-Thompson. All rights reserved.'
    ex[0x010E] = f'{place}, {country}, {date}. {caption}'; return ex
out.save(f'{slug}-master.jpg', quality=95, subsampling=0, exif=meta(out))
W = 2000; web = out.resize((W, round(out.height * W / out.width)), Image.LANCZOS).convert('RGBA')
lay = Image.new('RGBA', web.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(lay)
font = ImageFont.truetype('/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf', 22)
text = '© SHAUN JI-THOMPSON'; sp = 3
ws = [dr.textlength(c, font=font) for c in text]; tw = sum(ws) + sp * (len(text) - 1)
x0 = web.width - tw - 36; y0 = web.height - 58
for ox, oy, col in [(1, 1, (0, 0, 0, 70)), (0, 0, (241, 238, 231, 165))]:
    x = x0 + ox
    for c, cw in zip(text, ws): dr.text((x, y0 + oy), c, font=font, fill=col); x += cw + sp
web = Image.alpha_composite(web, lay).convert('RGB')
web.save(f'{slug}.jpg', quality=85, optimize=True, progressive=True, exif=meta(web))
print(slug, out.size)
