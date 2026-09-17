"""
Generates a small SYNTHETIC placeholder dataset so you can smoke-test the
train/serve pipeline (split_dataset.py -> train.py -> serve.py) before
you've collected any real photos.

IMPORTANT: these are NOT real photos and a model trained only on this
data will NOT recognize real potholes/garbage/etc. — the images are
random colored shapes, distinguishable from each other only by their
generated pattern, not by any real-world visual feature. Their only
purpose is to prove the code runs without errors (correct folder
structure, correct image decoding, correct training loop, correct
label mapping end-to-end) so you can find pipeline bugs before you've
spent time on real data collection.

Once you have real photos, delete data/raw/*/placeholder_*.jpg and
replace them with actual images (see ai-model/README.md).

Usage:
    python generate_placeholder_dataset.py
    python generate_placeholder_dataset.py --count 30
"""

import argparse
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from labels import CATEGORY_MAP

IMG_SIZE = (224, 224)

# A distinct base color + shape "signature" per category, so the smoke-test
# images are at least trivially separable (proves the training loop can
# learn *something*) without pretending to look like real photos.
SIGNATURES = {
    "pothole": {"color": (60, 60, 60), "shape": "ellipse"},
    "street_light_electricity": {"color": (235, 200, 60), "shape": "line"},
    "water_leakage": {"color": (70, 130, 200), "shape": "wave"},
    "drainage": {"color": (110, 80, 50), "shape": "rect"},
    "garbage": {"color": (110, 150, 70), "shape": "scatter"},
}


def draw_shape(draw: ImageDraw.ImageDraw, shape: str, color: tuple, rng: random.Random) -> None:
    w, h = IMG_SIZE
    if shape == "ellipse":
        x0, y0 = rng.randint(20, 80), rng.randint(20, 80)
        x1, y1 = x0 + rng.randint(60, 120), y0 + rng.randint(40, 90)
        draw.ellipse([x0, y0, x1, y1], fill=color)
    elif shape == "line":
        for _ in range(rng.randint(3, 6)):
            x0, y0 = rng.randint(0, w), rng.randint(0, h)
            x1, y1 = rng.randint(0, w), rng.randint(0, h)
            draw.line([x0, y0, x1, y1], fill=color, width=rng.randint(3, 8))
    elif shape == "wave":
        points = [(x, h // 2 + int(30 * random_sin(x, rng))) for x in range(0, w, 8)]
        draw.line(points, fill=color, width=6)
    elif shape == "rect":
        x0, y0 = rng.randint(10, 60), rng.randint(10, 60)
        x1, y1 = x0 + rng.randint(80, 140), y0 + rng.randint(80, 140)
        draw.rectangle([x0, y0, x1, y1], fill=color)
    elif shape == "scatter":
        for _ in range(rng.randint(15, 30)):
            x, y = rng.randint(0, w), rng.randint(0, h)
            r = rng.randint(4, 14)
            draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def random_sin(x, rng):
    import math
    return math.sin(x / 15 + rng.random())


def jitter(color: tuple, rng: random.Random, amount: int = 25) -> tuple:
    return tuple(max(0, min(255, c + rng.randint(-amount, amount))) for c in color)


def generate_image(folder_name: str, index: int, rng: random.Random) -> Image.Image:
    sig = SIGNATURES[folder_name]
    bg = jitter((225, 225, 220), rng, 15)
    img = Image.new("RGB", IMG_SIZE, color=bg)
    draw = ImageDraw.Draw(img)
    draw_shape(draw, sig["shape"], jitter(sig["color"], rng), rng)
    return img


def main(args):
    rng = random.Random(args.seed)
    raw_dir = Path(args.raw_dir)
    total = 0

    for folder_name in CATEGORY_MAP:
        dest = raw_dir / folder_name
        dest.mkdir(parents=True, exist_ok=True)
        for i in range(args.count):
            img = generate_image(folder_name, i, rng)
            img.save(dest / f"placeholder_{i:03d}.jpg", quality=85)
            total += 1
        print(f"  {folder_name}: {args.count} placeholder images")

    print(f"\nGenerated {total} SYNTHETIC placeholder images under {raw_dir}/")
    print("Reminder: these are for pipeline smoke-testing only, not real training data.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw-dir", default="data/raw")
    parser.add_argument("--count", type=int, default=20, help="Images per category")
    parser.add_argument("--seed", type=int, default=42)
    main(parser.parse_args())
