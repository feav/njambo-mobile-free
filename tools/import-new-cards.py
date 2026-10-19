#!/usr/bin/env python3
from pathlib import Path
from collections import deque
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "NEW CARTE"
TARGET = ROOT / "src/assets/images/cards"
OUTPUT_MAX_SIZE = (235, 360)
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"]
SUITS = {
    "S": (0, 0),
    "H": (1, 0),
    "D": (0, 1),
    "C": (1, 1),
}


def foreground_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    rgb = image.convert("RGB")
    pixels = rgb.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = pixels[x, y]
            # Le fond des planches est vert très sombre. Le filet doré et la
            # surface ivoire fournissent une boîte stable sans dépendre des signes.
            if (r > 62 and g > 44 and r + g + b > 155) or r > 105:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise ValueError("Contour de carte introuvable")
    return max(0, min(xs) - 2), max(0, min(ys) - 2), min(rgb.width, max(xs) + 3), min(rgb.height, max(ys) + 3)


def remove_green_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = pixels[x, y]
            if r < 58 and g > r * 1.16 and g > b * 1.18 and b < 70:
                pixels[x, y] = (r, g, b, 0)
    return rgba


def keep_largest_component(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    width, height = image.size
    visible = alpha.load()
    visited = bytearray(width * height)
    largest: list[tuple[int, int]] = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or visible[x, y] < 24:
                continue
            component: list[tuple[int, int]] = []
            queue = deque([(x, y)])
            visited[index] = 1
            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    neighbor = ny * width + nx
                    if not visited[neighbor] and visible[nx, ny] >= 24:
                        visited[neighbor] = 1
                        queue.append((nx, ny))
            if len(component) > len(largest):
                largest = component
    if not largest:
        raise ValueError("Carte détourée introuvable")
    mask = Image.new("L", image.size, 0)
    mask_pixels = mask.load()
    for x, y in largest:
        mask_pixels[x, y] = visible[x, y]
    cleaned = image.copy()
    cleaned.putalpha(mask)
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError("Carte vide après détourage")
    return cleaned.crop(bbox)


def trim_above_card_surface(image: Image.Image) -> Image.Image:
    pixels = image.convert("RGB").load()
    threshold = round(image.width * 0.46)
    for y in range(image.height):
        ivory_pixels = 0
        for x in range(image.width):
            r, g, b = pixels[x, y]
            if r > 112 and g > 92 and b > 62 and abs(r - g) < 105:
                ivory_pixels += 1
        if ivory_pixels >= threshold:
            return image.crop((0, max(0, y - 5), image.width, image.height))
    return image


def quadrant(sheet: Image.Image, column: int, row: int) -> Image.Image:
    half_width = sheet.width // 2
    half_height = sheet.height // 2
    left = column * half_width
    top = row * half_height
    right = sheet.width if column else half_width
    bottom = sheet.height if row else half_height
    region = sheet.crop((left, top, right, bottom))
    if row == 1:
        # Les planches contiennent un reflet horizontal détaché exactement à la
        # jonction des rangées. Il ne fait pas partie du bord supérieur des cartes.
        region = region.crop((0, 12, region.width, region.height))
    return region.crop(foreground_bbox(region))


def normalize(card: Image.Image) -> Image.Image:
    card = remove_green_background(card)
    card = trim_above_card_surface(card)
    card = keep_largest_component(card)
    max_width, max_height = OUTPUT_MAX_SIZE
    scale = min(max_width / card.width, max_height / card.height)
    return card.resize(
        (round(card.width * scale), round(card.height * scale)),
        Image.Resampling.LANCZOS,
    )


def main() -> None:
    generated: list[Path] = []
    for rank in RANKS:
        source = SOURCE / f"{rank}.png"
        if not source.exists():
            raise FileNotFoundError(source)
        with Image.open(source) as sheet:
            sheet.load()
            for suit, (column, row) in SUITS.items():
                output = TARGET / f"{rank}{suit}.png"
                normalize(quadrant(sheet, column, row)).save(
                    output,
                    format="PNG",
                    optimize=True,
                    compress_level=9,
                )
                generated.append(output)
    print(f"{len(generated)} cartes importées et optimisées dans {TARGET}")


if __name__ == "__main__":
    main()
