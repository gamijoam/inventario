#!/usr/bin/env python3
"""Generate lightweight thumbnails for existing product images.

Creates /app/media/products/thumbs/<same-file>.webp from /app/media/products/*.webp.
Safe to run repeatedly: existing newer thumbnails are skipped.
"""
from pathlib import Path
import os
from PIL import Image, ImageOps

MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", "/app/media"))
PRODUCTS_DIR = MEDIA_ROOT / "products"
THUMBS_DIR = PRODUCTS_DIR / "thumbs"
THUMBNAIL_DIMENSION = int(os.environ.get("PRODUCT_THUMBNAIL_DIMENSION", "360"))
RESAMPLE_FILTER = getattr(Image, "Resampling", Image).LANCZOS


def has_alpha(image: Image.Image) -> bool:
    return image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)


def generate_thumbnail(source: Path, target: Path) -> int:
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        if max(image.size) > THUMBNAIL_DIMENSION:
            image.thumbnail((THUMBNAIL_DIMENSION, THUMBNAIL_DIMENSION), RESAMPLE_FILTER)
        if has_alpha(image):
            output = image.convert("RGBA")
            output.save(target, "WEBP", quality=78, lossless=False, method=6)
        else:
            output = image.convert("RGB") if image.mode != "RGB" else image
            output.save(target, "WEBP", quality=72, method=6)
    return target.stat().st_size


def main() -> int:
    if not PRODUCTS_DIR.exists():
        print(f"products_dir_missing={PRODUCTS_DIR}")
        return 0

    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    created = 0
    skipped = 0
    failed = 0
    source_bytes = 0
    thumb_bytes = 0

    for source in sorted(PRODUCTS_DIR.glob("*.webp")):
        target = THUMBS_DIR / source.name
        try:
            if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
                skipped += 1
                continue
            source_bytes += source.stat().st_size
            thumb_bytes += generate_thumbnail(source, target)
            created += 1
        except Exception as exc:
            failed += 1
            print(f"failed {source.name}: {exc}")

    print(
        "product_thumbnails",
        f"created={created}",
        f"skipped={skipped}",
        f"failed={failed}",
        f"source_mb={source_bytes / 1024 / 1024:.2f}",
        f"thumb_mb={thumb_bytes / 1024 / 1024:.2f}",
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
