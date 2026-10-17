# Composants communs des aperçus (maquettes d'application MANAGER-IA). Génère du SVG propre, sans image externe ni police à charger.
import html

W, H = 960, 630
FONT = "Inter,'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif"
C = dict(bg1='#0f1c3a', bg2='#091226', panel='#132246', panel2='#1a2c58', line='#ffffff14', line2='#ffffff22', text='#eef3ff', muted='#93a4cc', dim='#5f719f',
         blue='#6f9bff', blue2='#3d6df2', green='#4fd1a1', amber='#ffb84d', pink='#ff7aa8', purple='#a78bfa', red='#ff6b6b', white='#ffffff')
SIDE = [('dash', 'Tableau de bord'), ('support', 'Service client'), ('projets', 'Projets'), ('budget', 'Budget'), ('stock', 'Stock et achats'),
        ('clients', 'Clients et ventes'), ('sales', 'Assistant commercial'), ('rh', 'Ressources humaines'), ('compta', 'Comptabilité'), ('equipe', 'Équipe')]
ICON = {  # tracés 24x24 (même famille que l'application)
    'dash': 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z', 'support': 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5', 'projets': 'M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h9',
    'budget': 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2', 'stock': 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', 'clients': 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    'sales': 'M4 5h16v11H9l-5 4zM9 9l2 2 4-4', 'rh': 'M3 5h18v14H3zM8 11a2 2 0 100-4 2 2 0 000 4zM5 16a3 3 0 016 0M14 9h5M14 13h4', 'compta': 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
    'equipe': 'M16 11a4 4 0 10-8 0M4 21a8 8 0 0116 0M20 8a3 3 0 010 6', 'ai': 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
    'bell': 'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 004 0', 'check': 'M5 12l4 4 10-10', 'search': 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5', 'plus': 'M12 5v14M5 12h14',
    'phone': 'M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zM11 18h2', 'send': 'M3 11l18-8-8 18-2-8z', 'clock': 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', 'warn': 'M12 3l10 18H2zM12 10v5M12 18v.5',
}


def esc(s):
    return html.escape(str(s), quote=True)


def t(x, y, s, size=12, fill=None, weight=400, anchor='start', opacity=None, extra=''):
    op = ' opacity="%s"' % opacity if opacity else ''
    return ('<text x="%s" y="%s" font-size="%s" font-weight="%s" fill="%s" text-anchor="%s"%s %s>%s</text>' % (x, y, size, weight, fill or C["text"], anchor, op, extra, esc(s)))


def rect(x, y, w, h, r=8, fill=None, stroke=None, op=None, extra=''):
    st = ' stroke="%s"' % stroke if stroke else ''
    o = ' opacity="%s"' % op if op else ''
    return '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"%s%s %s/>' % (x, y, w, h, r, fill or C["panel"], st, o, extra)


def card(x, y, w, h, r=14, fill=None, stroke=True):
    return rect(x, y, w, h, r, fill or C['panel'], C['line'] if stroke else None)


def icon(name, x, y, size=16, stroke=None, sw=1.8):
    s = size / 24
    return f'<path d="{ICON[name]}" transform="translate({x} {y}) scale({s})" fill="none" stroke="{stroke or C["muted"]}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'


def chip(x, y, label, color, h=20, size=10.5, filled=True, anchor='start'):
    w = round(len(label) * size * 0.58 + 16)
    if anchor == 'end':
        x = x - w
    bg = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" fill="{color}" opacity="{0.18 if filled else 0}"/>'
    bd = '' if filled else f'<rect x="{x+.5}" y="{y+.5}" width="{w-1}" height="{h-1}" rx="{h/2}" fill="none" stroke="{color}" opacity=".6"/>'
    return bg + bd + t(x + w / 2, y + h / 2 + size * 0.35, label, size, color, 600, 'middle'), w


def avatar(x, y, label, color, r=14):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}" opacity=".22"/>' + t(x, y + r * .33, label, r * .85, color, 700, 'middle')


def btn(x, y, w, label, primary=True, h=28, size=11.5):
    if primary:
        return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" fill="url(#gBtn)"/>' + t(x + w / 2, y + h / 2 + size * .35, label, size, '#fff', 700, 'middle'))
    return (f'<rect x="{x+.5}" y="{y+.5}" width="{w-1}" height="{h-1}" rx="{h/2}" fill="{C["panel2"]}" stroke="{C["line2"]}"/>' + t(x + w / 2, y + h / 2 + size * .35, label, size, C['text'], 600, 'middle'))


def progress(x, y, w, pct, color=None, h=6):
    return rect(x, y, w, h, h / 2, '#ffffff14') + rect(x, y, max(h, w * pct / 100), h, h / 2, color or C['blue'])


def sparkline(x, y, w, h, pts, color):
    mx, mn = max(pts), min(pts)
    rng = (mx - mn) or 1
    xs = [x + i * w / (len(pts) - 1) for i in range(len(pts))]
    ys = [y + h - (p - mn) / rng * h for p in pts]
    d = 'M' + ' L'.join(f'{a:.1f} {b:.1f}' for a, b in zip(xs, ys))
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'


def area_chart(x, y, w, h, series, grid=4, labels=None, gid='g1'):
    """series = [(points, color, dashed)] ; première série remplie en dégradé."""
    allp = [p for s in series for p in s[0]]
    mx, mn = max(allp) * 1.08, 0
    out = []
    for i in range(grid + 1):
        gy = y + h - i * h / grid
        out.append(f'<line x1="{x}" y1="{gy:.1f}" x2="{x+w}" y2="{gy:.1f}" stroke="#ffffff12"/>')
    for k, (pts, col, dash) in enumerate(series):
        xs = [x + i * w / (len(pts) - 1) for i in range(len(pts))]
        ys = [y + h - (p - mn) / (mx - mn) * h for p in pts]
        # courbe lissée (Catmull-Rom → Bézier)
        d = f'M{xs[0]:.1f} {ys[0]:.1f}'
        for i in range(len(pts) - 1):
            x0, y0 = xs[max(i - 1, 0)], ys[max(i - 1, 0)]; x1, y1 = xs[i], ys[i]; x2, y2 = xs[i + 1], ys[i + 1]; x3, y3 = xs[min(i + 2, len(pts) - 1)], ys[min(i + 2, len(pts) - 1)]
            c1x, c1y = x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6; c2x, c2y = x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6
            d += f' C{c1x:.1f} {c1y:.1f} {c2x:.1f} {c2y:.1f} {x2:.1f} {y2:.1f}'
        if k == 0:
            out.append(f'<path d="{d} L{xs[-1]:.1f} {y+h} L{xs[0]:.1f} {y+h} Z" fill="url(#{gid})"/>')
        da = ' stroke-dasharray="6 6"' if dash else ''
        out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2.6" stroke-linecap="round"{da}/>')
        if k == 0:
            out.append(f'<circle cx="{xs[-1]:.1f}" cy="{ys[-1]:.1f}" r="4.5" fill="{col}" stroke="{C["panel"]}" stroke-width="2.5"/>')
    if labels:
        for i, lb in enumerate(labels):
            out.append(t(x + i * w / (len(labels) - 1), y + h + 18, lb, 10, C['dim'], 500, 'middle'))
    return ''.join(out)


def bars(x, y, w, h, vals, color, labels=None, gap=0.38, hi=None):
    mx = max(vals) * 1.1
    n = len(vals); bw = w / n * (1 - gap); out = []
    for i, v in enumerate(vals):
        bh = v / mx * h; bx = x + i * w / n + (w / n - bw) / 2
        col = (hi or color) if (hi is not None and i == n - 1) else color
        out.append(f'<rect x="{bx:.1f}" y="{y+h-bh:.1f}" width="{bw:.1f}" height="{bh:.1f}" rx="5" fill="{col}" opacity="{1 if i == n-1 else .75}"/>')
        if labels:
            out.append(t(bx + bw / 2, y + h + 16, labels[i], 10, C['dim'], 500, 'middle'))
    return ''.join(out)


def donut(cx, cy, r, parts, sw=16):
    import math
    tot = sum(p[0] for p in parts); a0 = -math.pi / 2; out = [f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#ffffff10" stroke-width="{sw}"/>']
    for v, col in parts:
        a1 = a0 + v / tot * 2 * math.pi - 0.05
        x0, y0, x1, y1 = cx + r * math.cos(a0 + .025), cy + r * math.sin(a0 + .025), cx + r * math.cos(a1), cy + r * math.sin(a1)
        large = 1 if (a1 - a0) > math.pi else 0
        out.append(f'<path d="M{x0:.1f} {y0:.1f} A{r} {r} 0 {large} 1 {x1:.1f} {y1:.1f}" fill="none" stroke="{col}" stroke-width="{sw}" stroke-linecap="round"/>')
        a0 += v / tot * 2 * math.pi
    return ''.join(out)


def kpi(x, y, w, h, label, value, delta=None, color=None, spark=None):
    o = [card(x, y, w, h), t(x + 16, y + 24, label, 11, C['muted'], 500), t(x + 16, y + 54, value, 22, color or C['text'], 800)]
    if delta:
        up = delta.startswith('+')
        o.append(t(x + 16, y + h - 14, delta, 10.5, C['green'] if up else C['pink'], 700))
    if spark:
        o.append(sparkline(x + w - 54, y + 34, 38, 22, spark, color or C['blue']))
    return ''.join(o)


def frame(title, active, body, extra_defs='', crumb='Boutique Awa', badge=None):
    side = []
    for i, (k, lb) in enumerate(SIDE):
        yy = 112 + i * 40
        on = k == active
        if on:
            side.append(f'<rect x="12" y="{yy-12}" width="174" height="34" rx="10" fill="url(#gSide)"/>')
        side.append(icon(k, 24, yy - 3, 16, '#ffffff' if on else C['muted']))
        side.append(t(48, yy + 10, lb, 12, '#ffffff' if on else C['muted'], 700 if on else 500))
    top = (
        rect(206, 18, 360, 34, 17, '#ffffff0d', C['line']) + icon('ai', 220, 27, 16, C['blue']) + t(244, 40, "Demandez à MANAGER-IA : « Quels sont les problèmes urgents ? »", 11, C['dim']) +
        icon('bell', 884, 27, 17, C['muted']) + '<circle cx="898" cy="29" r="4" fill="#ff6b6b"/>' + avatar(928, 36, 'AT', C['amber'], 15)
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="{FONT}" role="img">
<title>{esc(title)}</title>
<defs>
<linearGradient id="gBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C['bg1']}"/><stop offset="1" stop-color="{C['bg2']}"/></linearGradient>
<linearGradient id="gSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3d6df2"/><stop offset="1" stop-color="#6f9bff"/></linearGradient>
<linearGradient id="gBtn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a7bff"/><stop offset="1" stop-color="#7a5cff"/></linearGradient>
<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fd1a1" stop-opacity=".38"/><stop offset="1" stop-color="#4fd1a1" stop-opacity="0"/></linearGradient>
<linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f9bff" stop-opacity=".4"/><stop offset="1" stop-color="#6f9bff" stop-opacity="0"/></linearGradient>
<radialGradient id="gGlow" cx=".85" cy=".05" r=".7"><stop offset="0" stop-color="#4a7bff" stop-opacity=".28"/><stop offset="1" stop-color="#4a7bff" stop-opacity="0"/></radialGradient>
<clipPath id="win"><rect x="0" y="0" width="{W}" height="{H}" rx="22"/></clipPath>
{extra_defs}
</defs>
<g clip-path="url(#win)">
<rect width="{W}" height="{H}" fill="url(#gBg)"/><rect width="{W}" height="{H}" fill="url(#gGlow)"/>
<rect x="0" y="0" width="196" height="{H}" fill="#0a1329" opacity=".72"/><line x1="196" y1="0" x2="196" y2="{H}" stroke="#ffffff10"/>
<circle cx="22" cy="22" r="5.5" fill="#ff6b8a"/><circle cx="40" cy="22" r="5.5" fill="#ffc14d"/><circle cx="58" cy="22" r="5.5" fill="#43d9a0"/>
<text x="20" y="64" font-size="16" font-weight="800" fill="#fff">MANAGER<tspan fill="#6f9bff">-IA</tspan></text>
<text x="20" y="84" font-size="10.5" fill="{C['dim']}" font-weight="600">{esc(crumb.upper())}</text>
{''.join(side)}
{top}
{body}
</g>
<rect x=".5" y=".5" width="{W-1}" height="{H-1}" rx="22" fill="none" stroke="#ffffff1c"/>
</svg>
'''
