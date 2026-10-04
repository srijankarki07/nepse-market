#!/usr/bin/env python3
"""
Draws the raster brand assets: the favicon, the app icons and the share card.

## This is a one-off, and the files it writes are what ship

Nothing in the build runs this. It was run once by hand, its output was committed, and the
build copies those files like any other static asset. Re-run it only when the mark or the
palette changes.

    python3 scripts/make-icons.py

It is a script rather than four image files with no explanation because a PNG in a
repository is a fact nobody can review. Here the mark is a few lines that can be read.

## Why a font is loaded and not drawn around

The mark is a letter, and the alternative to loading one is drawing an N as three
rectangles, which is four numbers that have to agree at every size. Liberation Sans is a
neutral grotesque and stands in for Geist, which is the site's face but only ships as a
woff2 to the build and has no bold here.

## Why the images are not generated at build time

`icon.tsx` and `opengraph-image.tsx` would generate these with `next/og`, and that is the
documented way. It was tried, and the export writes them as extensionless files
(`out/opengraph-image`), which a plain static host serves as `application/octet-stream`.
A favicon and an og:image that arrive with the wrong content type are ignored by exactly
the consumers they exist for. Extensionless routes also look like directories to a host
honouring `trailingSlash`, which is on in `next.config.ts`. Real files with real
extensions have neither problem.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

APP = Path(__file__).resolve().parent.parent / "src" / "app"
PUBLIC = Path(__file__).resolve().parent.parent / "public"

FONT_REGULAR = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

# The same tokens as globals.css, which cannot be imported here. Literal on purpose.
BG = (13, 13, 13, 255)          # --plane, dark
INK = (255, 255, 255, 255)      # --ink, dark
PLANE = (249, 249, 247, 255)    # --plane, light
INK_LIGHT = (11, 11, 11, 255)   # --ink, light
INK_2 = (82, 81, 78, 255)       # --ink-2, light
MUTED = (137, 135, 129, 255)    # --muted
UP = (12, 163, 12, 255)         # --up

# Everything is drawn at 4x and reduced once. Downscaling is what gives the curves and the
# letter their edges; drawing at the final size leaves them visibly stepped.
SS = 4


def n_glyph(height: int) -> Image.Image:
    """The letter, cropped to its ink and scaled to an exact height."""
    font = ImageFont.truetype(FONT_BOLD, 400)
    left, top, right, bottom = font.getbbox("N")

    glyph = Image.new("RGBA", (right - left, bottom - top), (0, 0, 0, 0))
    ImageDraw.Draw(glyph).text((-left, -top), "N", font=font, fill=INK)

    width = round(glyph.width * height / glyph.height)
    return glyph.resize((width, height), Image.LANCZOS)


def tile(size: int, rounded: bool) -> Image.Image:
    """
    The mark on its tile.

    `rounded` is for a browser tab, where a square mark in a rounded slot looks like it was
    cut off; iOS masks its own icons, so the home-screen and manifest versions are drawn
    full bleed instead.
    """
    edge = size * SS
    canvas = Image.new("RGBA", (edge, edge), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    if rounded:
        draw.rounded_rectangle([0, 0, edge - 1, edge - 1], radius=int(edge * 0.22), fill=BG)
    else:
        draw.rectangle([0, 0, edge - 1, edge - 1], fill=BG)

    glyph = n_glyph(int(edge * 0.62))
    canvas.alpha_composite(glyph, ((edge - glyph.width) // 2, (edge - glyph.height) // 2))

    return canvas.resize((size, size), Image.LANCZOS)


def wrap(text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    """Satori wraps for free; PIL does not."""
    lines: list[str] = []
    current = ""

    for word in text.split():
        candidate = f"{current} {word}".strip()
        if font.getlength(candidate) <= width:
            current = candidate
        else:
            lines.append(current)
            current = word

    if current:
        lines.append(current)
    return lines


def share_card() -> Image.Image:
    """
    1200x630, the size every scraper wants and the ratio they crop to.

    The disclaimer is on the card rather than left for the page because a price site pasted
    into a group chat is read as a current price by everyone who sees it, and the card is
    the last place that can be corrected before the click.
    """
    width, height, pad = 1200, 630, 72
    card = Image.new("RGB", (width, height), PLANE)
    draw = ImageDraw.Draw(card)

    mark = tile(64, rounded=True)
    card.paste(mark, (pad, pad), mark)
    draw.text(
        (pad + 64 + 20, pad + 32),
        "NEPSE end-of-day",
        font=ImageFont.truetype(FONT_REGULAR, 30),
        fill=INK_2,
        anchor="lm",
    )

    headline_font = ImageFont.truetype(FONT_BOLD, 74)
    headline = wrap("Every scrip on the Nepal Stock Exchange", headline_font, width - 2 * pad)

    body_font = ImageFont.truetype(FONT_REGULAR, 31)
    body = wrap(
        "Closing prices from 2011 to today, read from a public archive of the exchange's "
        "end-of-day figures.",
        body_font,
        width - 2 * pad,
    )

    y = 208
    for line in headline:
        draw.text((pad, y), line, font=headline_font, fill=INK_LIGHT)
        y += 84
    y += 20
    for line in body:
        draw.text((pad, y), line, font=body_font, fill=INK_2)
        y += 44

    baseline = height - pad - 20
    draw.rounded_rectangle([pad, baseline - 3, pad + 72, baseline + 3], radius=3, fill=UP)
    draw.text(
        (pad + 72 + 16, baseline),
        "End-of-day only · not a live feed · from 2011",
        font=ImageFont.truetype(FONT_REGULAR, 26),
        fill=MUTED,
        anchor="lm",
    )

    return card


def main() -> None:
    # The tab icon: .ico for the legacy `/favicon.ico` request and older clients, .png for
    # everything current. Both are the same mark so the two cannot disagree.
    tile(256, rounded=True).save(APP / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    tile(48, rounded=True).save(APP / "icon.png")

    # iOS composites over black and applies its own mask: full bleed, no transparency.
    tile(180, rounded=False).save(APP / "apple-icon.png")

    # Not `src/app/opengraph-image.png`, which is the file convention and would be the
    # tidier home for it. It is a plain file instead because the convention attaches the
    # image to the segment it sits in, and a nested page that sets its own `openGraph`
    # replaces the parent's object rather than merging into it, so `/about` and `/symbol`
    # silently lost the card. `openGraphFor` in `lib/site.ts` sets it for every page.
    share_card().save(PUBLIC / "og.png")

    # The manifest's own sizes. Android masks these too, so they are full bleed.
    tile(192, rounded=False).save(PUBLIC / "icon-192.png")
    tile(512, rounded=False).save(PUBLIC / "icon-512.png")

    for path in sorted([*APP.glob("*.png"), *APP.glob("*.ico"), *PUBLIC.glob("icon-*.png"), PUBLIC / "og.png"]):
        if path.name in {"og.png", "icon.png", "apple-icon.png", "favicon.ico"} or path.name.startswith("icon-"):
            print(f"{path.relative_to(path.parents[2])}  {path.stat().st_size:>7,} bytes")


if __name__ == "__main__":
    main()
