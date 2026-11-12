import numpy as np
from PIL import Image, ImageFilter
ph = Image.open('/root/.claude/uploads/88ec58d0-7d7a-5e32-8290-d78e1148bb7e/68d5c37b-image.jpg').convert('RGB')
a = np.asarray(ph).astype(np.float32).copy()
r = np.random.default_rng(3)
for y in range(722, 738):           # remove the inflatable pool
    l, rr = a[y, 306], a[y, 388]
    for x in range(307, 388):
        f = (x - 306) / 82; a[y, x] = l * (1 - f) + rr * f + r.normal(0, 4, 3)
for y in range(738, 752):
    for x in range(312, 382):
        a[y, x] = a[min(y + 16, 767), x] * 0.5 + a[y, max(x - 70, 0)] * 0.5
ph = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
rd = Image.open('r3d/photo-full.png').convert('RGBA').resize((960, 1280), Image.LANCZOS)
rgb = rd.convert('RGB').filter(ImageFilter.GaussianBlur(0.45))
al = np.asarray(rd)[..., 3:4].astype(np.float32) / 255
c = np.asarray(rgb).astype(np.float32)
# match the photo: a touch warmer, more contrast, sensor grain
c = (c - 128) * 1.06 + 128; c *= np.array([1.03, 1.0, 0.95])
c += np.random.default_rng(1).normal(0, 2.2, c.shape[:2] + (1,))
o = np.asarray(ph).astype(np.float32)
out = o * (1 - al) + np.clip(c, 0, 255) * al
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save('final.jpg', quality=95)
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).crop((0, 640, 560, 900)).resize((1680, 780), Image.LANCZOS).save('final-zoom.png')
