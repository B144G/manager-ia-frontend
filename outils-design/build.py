import os, sys
from xml.dom import minidom
sys.path.insert(0, os.path.dirname(__file__))
import kit, screens
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img')
os.makedirs(out, exist_ok=True)
only = sys.argv[1:]
for name, active, title, fn in screens.SCREENS:
    if only and name not in only:
        continue
    svg = kit.frame(title, active, fn())
    minidom.parseString(svg.encode('utf-8'))  # vérifie que le SVG est bien formé
    open(os.path.join(out, name + '.svg'), 'w', encoding='utf-8').write(svg)
    print(name, len(svg))
