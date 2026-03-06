import re

with open("main/assets/map_overlay_inf.svg", "r") as f:
    text = f.read()

rects = re.findall(r'x="([\d.]+)"\s+y="([\d.]+)"', text)
rects = [{"x": float(m[0]), "y": float(m[1])} for m in rects]

bottom_row_indices = []
for i in range(0, len(rects), 3):
    is_bottom = False
    if i + 3 >= len(rects):
        is_bottom = True
    else:
        # Check if the next row's x differs heavily from our x
        if abs(rects[i]['x'] - rects[i+3]['x']) > 10:
            is_bottom = True
    if is_bottom:
        bottom_row_indices.append(i)
        bottom_row_indices.append(i+1)
        bottom_row_indices.append(i+2)

print("Bottom row indices:", bottom_row_indices)
