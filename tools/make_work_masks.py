"""Маски яркости для подписей карточек Works.

Для каждой картинки images/work-N.webp строит две маленькие PNG-маски (только альфа-канал):
  images/mask-work-N-dark.png   там, где фон почти чёрный (под ней виден БЕЛЫЙ слой подписи)
  images/mask-work-N-light.png  там, где фон серый или светлый (виден ТЁМНЫЙ слой подписи)
js/main.js только двигает маски вслед за подписью, поэтому в браузере ничего не считается.
Запуск после замены картинок работ:  python3 tools/make_work_masks.py
"""
import cv2
import numpy as np

MAP_W = 720      # ширина маски в пикселях
BLUR = 2.0       # размытие (в пикселях маски): убирает зерно картинки
THRESHOLD = 0.07 # линейная яркость фона (примерно 74 из 255): темнее — белый текст, светлее — тёмный
SOFT = 0.0006    # ширина перехода вокруг порога (почти ноль: граница резкая)


def srgb_to_linear(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


for n in range(1, 6):
    img = cv2.imread(f"images/work-{n}.webp")
    h = max(1, round(MAP_W * img.shape[0] / img.shape[1]))
    small = cv2.resize(img, (MAP_W, h), interpolation=cv2.INTER_AREA)
    b, g, r = [srgb_to_linear(small[..., i].astype(np.float32)) for i in range(3)]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    lum = cv2.GaussianBlur(lum, (0, 0), BLUR)
    dark = 1 - smooth(THRESHOLD - SOFT, THRESHOLD + SOFT, lum)
    for name, alpha in (("dark", dark), ("light", 1 - dark)):
        out = np.zeros((h, MAP_W, 4), np.uint8)
        out[..., 3] = np.round(alpha * 255).astype(np.uint8)
        cv2.imwrite(f"images/mask-work-{n}-{name}.png", out, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    print(n, MAP_W, h)
