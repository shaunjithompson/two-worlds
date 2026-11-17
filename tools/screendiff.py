"""Compare two folders of screenshots (from tools/screens.py) and report what changed.

    python3 tools/screendiff.py <before> <after> <diff folder>

Writes a side-by-side image (before | after | changes in red) for every page that changed, and a table to
$GITHUB_STEP_SUMMARY (the pull request's Checks tab) or the terminal. It never fails: changes are often meant.
"""
import os, sys
from PIL import Image, ImageChops

def main(before, after, out):
    os.makedirs(out, exist_ok=True)
    rows = []
    for f in sorted(set(os.listdir(before)) | set(os.listdir(after))):
        if not f.endswith('.png'):
            continue
        a = os.path.join(before, f); b = os.path.join(after, f)
        if not os.path.exists(a) or not os.path.exists(b):
            rows.append((f, 'new page' if os.path.exists(b) else 'removed')); continue
        A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
        w, h = max(A.width, B.width), max(A.height, B.height)
        pa, pb = Image.new('RGB', (w, h)), Image.new('RGB', (w, h)); pa.paste(A); pb.paste(B)
        mask = ImageChops.difference(pa, pb).convert('L').point(lambda v: 255 if v > 24 else 0)
        changed = sum(mask.histogram()[255:]) / (w * h) * 100
        if changed < 1:  # small differences (photo decoding, sub-pixel text) are noise
            continue
        red = Image.new('RGB', (w, h), (230, 40, 30)); hl = pb.copy(); hl.paste(red, mask=mask)
        side = Image.new('RGB', (w * 3 + 40, h), (255, 255, 255))
        for i, im in enumerate((pa, pb, hl)):
            side.paste(im, (i * (w + 20), 0))
        side.thumbnail((2400, 6000)); side.save(os.path.join(out, f))
        rows.append((f, f'{changed:.1f}% of pixels'))
    lines = ['### Screenshots compared with main', '']
    if rows:
        lines += ['| Page | Change |', '|---|---|'] + [f'| {f[:-4].replace("--", " · ")} | {c} |' for f, c in rows]
        lines += ['', 'Side-by-side images (before · after · changes in red) are in the **screenshots** artifact.']
    else:
        lines.append('No visible changes.')
    text = '\n'.join(lines) + '\n'
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    open(summary, 'a').write(text) if summary else print(text)

if __name__ == '__main__':
    main(*sys.argv[1:4])
