import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Button, EmptyState, Segmented } from '../../ui/index.jsx';
import { initials, loadMedia, stateIn, useLabels, frDate } from './util.jsx';

/* Organigramme : arbre dessiné en SVG (zoom, déplier / replier, impression PDF, image PNG) avec un curseur d'année.
   Pour une année : les personnes en poste (normales), celles qui partent cette année-là (bordure orange) et les anciens (grisés, tirets) ; ceux qui ne sont
   pas encore arrivés n'apparaissent pas. Si un supérieur n'est pas affiché, la personne se rattache au supérieur affiché le plus proche. */

const NW = 184; const NH = 72; const GX = 20; const GY = 52; const PAD = 24;

/** Construit la forêt visible puis calcule les positions (arbre « centré sur ses enfants »). */
export function layout(people, year, showFormer, collapsed) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const shown = new Map();
  for (const p of people) { const s = stateIn(p, year); if (s && (s !== 'former' || showFormer)) shown.set(p.id, { ...p, state: s, kids: [] }); }
  const up = (p) => { // supérieur affiché le plus proche
    for (let cur = p.parentId, n = 0; cur && n < 100; n++) { if (shown.has(cur)) return cur; cur = (byId.get(cur) || {}).parentId; }
    return null;
  };
  const roots = [];
  for (const n of shown.values()) { const u = up(n); if (u) shown.get(u).kids.push(n); else roots.push(n); }
  const order = (a, b) => a.level - b.level || (a.startDate || '').localeCompare(b.startDate || '') || a.id - b.id;
  roots.sort(order);
  const nodes = []; const links = [];
  let cursor = PAD;
  const place = (n, depth) => {
    n.kids.sort(order);
    const open = !collapsed.has(n.id);
    const kids = open ? n.kids : [];
    kids.forEach((k) => place(k, depth + 1));
    n.depth = depth;
    n.y = PAD + depth * (NH + GY);
    if (kids.length) n.x = (kids[0].x + kids[kids.length - 1].x) / 2;
    else { n.x = cursor + NW / 2; cursor += NW + GX; }
    n.open = open;
    nodes.push(n);
    kids.forEach((k) => links.push([n, k]));
  };
  roots.forEach((r) => place(r, 0));
  const width = Math.max(cursor + PAD - GX, NW + 2 * PAD);
  const height = nodes.length ? Math.max(...nodes.map((n) => n.y)) + NH + PAD + 14 : 120;
  return { nodes, links, width, height, total: shown.size };
}

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export default function OrgChart({ H }) {
  const t = useT();
  const L = useLabels();
  const people = H.people;
  const years = useMemo(() => {
    const ys = people.flatMap((p) => [p.startDate, p.endDate]).map((d) => Number(String(d || '').slice(0, 4))).filter(Boolean);
    const now = new Date().getFullYear();
    return { min: ys.length ? Math.min(...ys) : now, max: now };
  }, [people]);
  const [year, setYear] = useState(years.max);
  const [former, setFormer] = useState(true);
  const [mode, setMode] = useState('tree');
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const svgRef = useRef(null);
  const [pics, setPics] = useState({});
  const lay = useMemo(() => layout(people, year, former, collapsed), [people, year, former, collapsed]);

  useEffect(() => { // photos de profil (blob), chargées une fois par personne
    let live = true;
    people.filter((p) => p.photoId && !pics[p.photoId]).forEach((p) => loadMedia(H.orgId, p.photoId).then((u) => { if (live) setPics((s) => ({ ...s, [p.photoId]: u })); }, () => {}));
    return () => { live = false; };
  }, [people, H.orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allKids = useMemo(() => new Set(lay.nodes.filter((n) => n.kids.length).map((n) => n.id)), [lay]);
  const fit = () => { const box = svgRef.current && svgRef.current.parentElement; if (box) setZoom(Math.max(0.25, Math.min(1, (box.clientWidth - 4) / lay.width))); };

  const print = () => {
    document.body.classList.add('hst-printing');
    const done = () => { document.body.classList.remove('hst-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  };
  const exportPng = async () => {
    try {
      const svg = svgRef.current.cloneNode(true);
      const css = getComputedStyle(document.documentElement);
      const pageBg = css.getPropertyValue('--surface-2').trim() || '#f7f8fc';
      for (const im of svg.querySelectorAll('image')) { // les photos (blob:) deviennent des données intégrées, sinon l'image exportée serait vide
        const href = im.getAttribute('href');
        if (href && href.startsWith('blob:')) {
          const b = await (await fetch(href)).blob();
          const d = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
          im.setAttribute('href', d);
        }
      }
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', lay.width); svg.setAttribute('height', lay.height);
      svg.querySelectorAll('.hst-tgl').forEach((x) => x.remove());
      let str = new XMLSerializer().serializeToString(svg);
      str = str.replace(/var\((--[a-z0-9-]+)\)/g, (_, k) => css.getPropertyValue(k).trim() || '#888');
      // les règles .hst-… ne suivent pas le SVG exporté : on les recopie en style intégré
      const style = `.hst-node rect.card{fill:${css.getPropertyValue('--surface').trim()};stroke:${css.getPropertyValue('--border-strong').trim()};stroke-width:1.2}.hst-node.former rect.card{fill:${css.getPropertyValue('--surface-3').trim()};stroke-dasharray:4 3}.hst-node.former{opacity:.55}.hst-node.leaving rect.card{stroke:${css.getPropertyValue('--warn').trim()}}.hst-node text{font-family:Arial,sans-serif;fill:${css.getPropertyValue('--text').trim()}}.hst-node text.n{font-size:12.5px;font-weight:700}.hst-node text.p{font-size:11px;fill:${css.getPropertyValue('--muted').trim()}}.hst-node text.d{font-size:10px;fill:${css.getPropertyValue('--muted').trim()}}.hst-node .ring{fill:${css.getPropertyValue('--accent-soft-2').trim()}}.hst-node text.i{font-size:13px;font-weight:700;fill:${css.getPropertyValue('--accent').trim()}}.hst-link{fill:none;stroke:${css.getPropertyValue('--border-strong').trim()};stroke-width:1.5}`;
      str = str.replace('>', `><style>${style}</style><rect width="100%" height="100%" fill="${pageBg}"/>`);
      const img = new Image();
      await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str); });
      const k = 2;
      const cv = document.createElement('canvas'); cv.width = lay.width * k; cv.height = lay.height * k;
      const ctx = cv.getContext('2d'); ctx.scale(k, k); ctx.drawImage(img, 0, 0);
      cv.toBlob((bl) => {
        const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = `organigramme-${year}.png`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      });
    } catch { H.toast(t("L'image n'a pas pu être créée."), true); }
  };

  if (!people.length) {
    return (
      <EmptyState icon="sitemap" title={t("L'organigramme est vide")} action={H.canEdit ? <Button variant="primary" icon="plus" onClick={() => H.editPerson(null)}>{t('Ajouter le fondateur')}</Button> : null}>
        {t("Commencez par le fondateur, puis ajoutez la direction, les responsables et les équipes. Vous pourrez ensuite remonter dans le temps avec le curseur d'année.")}
      </EmptyState>
    );
  }

  const stateLabel = { active: t('en poste'), leaving: t('part cette année'), former: t('ancien') };
  return (
    <div className="hst-chart-wrap">
      <div className="hst-chart-tools">
        <div className="hst-year-slider">
          <label htmlFor="hst-year">{t('Année')}</label>
          <input id="hst-year" type="range" min={years.min} max={years.max} step={1} value={Math.min(Math.max(year, years.min), years.max)} onChange={(e) => setYear(Number(e.target.value))} aria-valuetext={String(year)} />
          <output htmlFor="hst-year">{year}</output>
        </div>
        <label className="check" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={former} onChange={(e) => setFormer(e.target.checked)} />{t('Montrer les anciens (grisés)')}</label>
        <Segmented label={t("Mode d'affichage")} value={mode} onChange={setMode} items={[{ id: 'tree', label: t('Arbre'), icon: 'sitemap' }, { id: 'list', label: t('Liste'), icon: 'list' }]} />
      </div>
      <div className="hst-chart-tools">
        {mode === 'tree' ? (
          <>
            <Button size="sm" iconOnly icon="minus" label={t('Réduire')} onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.15).toFixed(2)))} />
            <span className="muted small" aria-live="polite">{Math.round(zoom * 100)} %</span>
            <Button size="sm" iconOnly icon="plus" label={t('Agrandir')} onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))} />
            <Button size="sm" icon="expand" onClick={fit}>{t('Ajuster à la largeur')}</Button>
            <Button size="sm" onClick={() => setCollapsed(new Set())}>{t('Tout déplier')}</Button>
            <Button size="sm" onClick={() => setCollapsed(new Set([...allKids].filter((id) => lay.nodes.find((n) => n.id === id).depth >= 1)))}>{t('Tout replier')}</Button>
          </>
        ) : null}
        <span className="grow" style={{ flex: 1 }} />
        <Button size="sm" icon="print" onClick={print}>{t('Imprimer / PDF')}</Button>
        {mode === 'tree' ? <Button size="sm" icon="image" onClick={exportPng}>{t('Image PNG')}</Button> : null}
      </div>
      <div className="hst-print">
        <p className="hst-print-title">{t("Organigramme de l'entreprise")} — {year}</p>
        {lay.nodes.length === 0 ? <Alert tone="info">{t("Personne n'était encore dans l'entreprise cette année-là.")}</Alert> : mode === 'tree' ? (
          <div className="hst-canvas">
            <svg ref={svgRef} role="group" aria-label={t("Organigramme en {year}", { year })} viewBox={`0 0 ${lay.width} ${lay.height}`} width={lay.width * zoom} height={lay.height * zoom}>
              {lay.links.map(([a, b]) => {
                const y1 = a.y + NH; const y2 = b.y; const ym = y1 + GY / 2;
                return <path key={a.id + '-' + b.id} className="hst-link" d={`M${a.x} ${y1} V${ym} H${b.x} V${y2}`} />;
              })}
              {lay.nodes.map((n) => (
                <g key={n.id} transform={`translate(${n.x - NW / 2} ${n.y})`}>
                  <g className={'hst-node ' + n.state} tabIndex={0} role="button" aria-label={`${n.name}${n.title ? ', ' + n.title : ''} (${stateLabel[n.state]})`}
                    onClick={() => H.openPerson(n.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); H.openPerson(n.id); } }}>
                    <rect className="card" width={NW} height={NH} rx="10" />
                    <circle className="ring" cx="34" cy={NH / 2} r="22" />
                    {n.photoId && pics[n.photoId] ? <><clipPath id={`c${n.id}`}><circle cx="34" cy={NH / 2} r="22" /></clipPath><image href={pics[n.photoId]} x="12" y={NH / 2 - 22} width="44" height="44" preserveAspectRatio="xMidYMid slice" clipPath={`url(#c${n.id})`} /></> : <text className="i" x="34" y={NH / 2 + 5} textAnchor="middle">{initials(n.name)}</text>}
                    <text className="n" x="64" y="26">{cut(n.name, 19)}</text>
                    <text className="p" x="64" y="42">{cut(n.title || L.level[n.level] || '', 23)}</text>
                    <text className="d" x="64" y="57">{n.startDate ? frDate(n.startDate).slice(3) : ''}{n.endDate ? ' → ' + frDate(n.endDate).slice(3) : ''}</text>
                  </g>
                  {n.kids.length ? (
                    <g className="hst-tgl" role="button" tabIndex={0} aria-label={n.open ? t('Replier') : t('Déplier')} aria-expanded={n.open} transform={`translate(${NW / 2} ${NH + 12})`}
                      onClick={() => toggle(n.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(n.id); } }}>
                      <circle r="11" /><text y="4">{n.open ? '−' : n.kids.length}</text>
                    </g>
                  ) : null}
                </g>
              ))}
            </svg>
          </div>
        ) : (
          <div className="hst-list"><ul>{lay.nodes.filter((n) => n.depth === 0).map((r) => <ListNode key={r.id} n={r} H={H} pics={pics} L={L} stateLabel={stateLabel} collapsed={collapsed} />)}</ul></div>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 8 }}>
        {t('{n} personnes affichées en {year}.', { n: lay.total, year })} <span aria-hidden="true">▢</span> {t('bordure orange : part cette année-là')} · {t('grisé en tirets : ancien')}
      </p>
    </div>
  );
}

function ListNode({ n, H, pics, L, stateLabel, collapsed }) {
  const kids = collapsed.has(n.id) ? [] : n.kids;
  return (
    <li>
      <button type="button" className={'who ' + n.state} onClick={() => H.openPerson(n.id)}>
        <span className="hst-av">{n.photoId && pics[n.photoId] ? <img src={pics[n.photoId]} alt="" /> : initials(n.name)}</span>
        <span><b>{n.name}</b><br /><small className="muted">{n.title || L.level[n.level]} · {stateLabel[n.state]}</small></span>
      </button>
      {kids.length ? <ul>{kids.map((k) => <ListNode key={k.id} n={k} H={H} pics={pics} L={L} stateLabel={stateLabel} collapsed={collapsed} />)}</ul> : null}
    </li>
  );
}
