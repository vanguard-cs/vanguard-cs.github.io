import re

with open("main/assets/map_overlay_inf.svg", "r") as f:
    text = f.read()

rects = re.findall(r'x="([\d.]+)"\s+y="([\d.]+)"', text)
rects = [{"x": float(m[0]), "y": float(m[1])} for m in rects]

print("Total rects:", len(rects))
errors = 0
for i in range(0, len(rects), 3):
    chunk = rects[i:i+3]
    if len(chunk) != 3:
        print("Not divisible by 3!")
    if chunk[0]['y'] != chunk[1]['y'] or chunk[1]['y'] != chunk[2]['y']:
        print("Y mismatch at", i)
        errors += 1
    if not (chunk[0]['x'] < chunk[1]['x'] < chunk[2]['x']):
        print("X not increasing at", i)
        errors += 1

print("Errors:", errors)
