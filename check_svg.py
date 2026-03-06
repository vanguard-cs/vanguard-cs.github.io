import re

with open("main/assets/map_overlay_inf.svg", "r") as f:
    text = f.read()

rects = re.findall(r'x="([\d.]+)"\s+y="([\d.]+)"', text)
rects = [{"x": float(m[0]), "y": float(m[1])} for m in rects]
print(rects[:15])
print("...")
print(rects[-15:])
