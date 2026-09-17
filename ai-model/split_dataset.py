"""
Splits a flat folder of labeled images into train/ and val/ folders.

Expected input layout (you build this by collecting/sorting photos):

    data/raw/pothole/*.jpg
    data/raw/street_light_electricity/*.jpg
    data/raw/water_leakage/*.jpg
    data/raw/drainage/*.jpg
    data/raw/garbage/*.jpg

Produces:

    data/train/<category>/...   (80% by default)
    data/val/<category>/...     (20% by default)

Usage:
    python split_dataset.py
    python split_dataset.py --val-ratio 0.15
"""

import argparse
import random
import shutil
from pathlib import Path

from labels import CATEGORY_MAP

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def split_dataset(raw_dir: Path, train_dir: Path, val_dir: Path, val_ratio: float, seed: int) -> None:
    random.seed(seed)

    if not raw_dir.exists():
        raise SystemExit(
            f"Expected raw dataset at {raw_dir} — create one subfolder per "
            f"category ({', '.join(CATEGORY_MAP.keys())}) full of images first."
        )

    total_copied = 0
    for folder_name in CATEGORY_MAP:
        src = raw_dir / folder_name
        if not src.exists():
            print(f"  ! skipping '{folder_name}' — no folder at {src}")
            continue

        # Searches recursively (not just the top level) so it doesn't
        # matter whether your images sit directly in data/raw/<category>/
        # or are nested inside subfolders — e.g. a downloaded dataset like
        # data/raw/garbage/cardboard/*.jpg, data/raw/garbage/glass/*.jpg,
        # or data/raw/pothole/images/*.jpg all get picked up the same way.
        images = [p for p in src.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS]
        if not images:
            print(f"  ! skipping '{folder_name}' — no images found anywhere under {src}")
            continue

        random.shuffle(images)
        split_index = max(1, int(len(images) * (1 - val_ratio)))
        train_images, val_images = images[:split_index], images[split_index:]

        for subset_name, subset_images, subset_dir in [
            ("train", train_images, train_dir),
            ("val", val_images, val_dir),
        ]:
            dest = subset_dir / folder_name
            dest.mkdir(parents=True, exist_ok=True)
            # Re-index every filename on copy — this both guarantees no
            # collisions when flattening images pulled from several
            # differently-named subfolders, and keeps re-runs clean
            # (old stale files don't linger from a previous split).
            for idx, img_path in enumerate(subset_images):
                safe_name = f"{folder_name}_{idx:05d}{img_path.suffix.lower()}"
                shutil.copy2(img_path, dest / safe_name)

        print(f"  {folder_name}: {len(train_images)} train, {len(val_images)} val")
        total_copied += len(images)

    if total_copied == 0:
        raise SystemExit("No images were found in data/raw/<category>/ — nothing to split.")

    print(f"\nDone. {total_copied} images split into {train_dir} and {val_dir}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", default="data/raw")
    parser.add_argument("--train-dir", default="data/train")
    parser.add_argument("--val-dir", default="data/val")
    parser.add_argument("--val-ratio", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    split_dataset(Path(args.raw_dir), Path(args.train_dir), Path(args.val_dir), args.val_ratio, args.seed)
