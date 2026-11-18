import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Badge, ChartFrame, Form, Loaded, Stat, Table, Tabs, useLoad } from '../../ui.jsx';
import { Bars, Donut, HBars } from '../../charts/lazy.jsx';
import { day, when } from './util.jsx';
import { condLabel } from './Catalog.jsx';

/* Inventaire (récolement) et suivi des ressources : campagnes avec lecture de codes, écarts, pertes, acquisitions, usage. */

function Campaign({ L, id, back }) {
  const t = useT();
  const { toast, confirm } = useWs();
  const st = useLoad(() => L.lib('GET', `/inventories/${id}`), [id]);
  const [code, setCode] = useState(''); const [loc, setLoc] = useState(''); const [msg, setMsg] = useState({ text: '', bad: false });
  const KIND = { ok: t('Conforme.'), already: t('Déjà lue.'), misplaced: t('Mal placée : emplacement différent de celui du catalogue.'), extra: t('En trop : absente de la liste de départ.'), unknown: t('Code inconnu du catalogue.') };
  const scan = (e) => { e.preventDefault(); if (!code.trim()) return; L.lib('POST', `/inventories/${id}/scan`, { code: code.trim(), location: loc }).then((j) => { setMsg({ text: `${j.record ? j.record.title + ' — ' : ''}${KIND[j.kind]}`, bad: ['misplaced', 'extra', 'unknown'].includes(j.kind) }); setCode(''); st.reload(); }, (x) => setMsg({ text: tsrv(x.message), bad: true })); };
  const close = (inv) => confirm(t("Clore l'inventaire ? Les ressources manquantes seront déclarées perdues et les emplacements des ressources mal placées corrigés."), () => L.lib('POST', `/inventories/${inv.id}/close`, { applyMissing: true, applyLocations: true }).then((r) => { toast(t('Inventaire clos : {l} perte(s), {m} emplacement(s) corrigé(s).', { l: r.markedLost, m: r.relocated })); st.reload(); L.reload(); }, (x) => toast(tsrv(x.message), true)), t('Clore'));
  return (
    <Loaded state={st}>{({ inventory: inv, report: r }) => {
      const open = inv.status === 'open';
      const list = (title, rows, cols) => (rows.length ? <><h3>{title} ({rows.length})</h3><Table caption={title} rows={rows} columns={cols} /></> : null);
      const base = [{ key: 'inventoryNo', label: t("N° d'inventaire") }, { key: 'title', label: t('Ressource') }];
      return (
        <>
          <div className="row"><button className="btn small" type="button" onClick={back}>{t('← Les inventaires')}</button>{open ? <button className="btn small" type="button" onClick={() => close(inv)}>{t("Clore l'inventaire")}</button> : <Badge>{t('Clos le {date}', { date: day(inv.closedAt) })}</Badge>}</div>
          <h2>{inv.name}</h2>
          <div className="ui-stats"><Stat label={t('Attendues')} value={r.counts.expected} /><Stat label={t('Conformes')} value={r.counts.ok} tone="ok" /><Stat label={t('Mal placées')} value={r.counts.misplaced} tone={r.counts.misplaced ? 'warn' : 'ok'} /><Stat label={t('Manquantes')} value={r.counts.missing} tone={r.counts.missing ? 'danger' : 'ok'} /><Stat label={t('En prêt')} value={r.counts.onLoan} tone="info" /><Stat label={t('En trop')} value={r.counts.extra} tone={r.counts.extra ? 'warn' : 'ok'} /></div>
          <div className="meter" role="img" aria-label={t('Avancement : {n} %', { n: r.progress })}><i style={{ width: `${r.progress}%` }} /></div>
          {open ? (
            <form className="lib-bar lib-desk" onSubmit={scan}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('Lire ou saisir le code')} aria-label={t('Lire ou saisir le code')} autoComplete="off" />
              <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder={t('Emplacement constaté (facultatif)')} aria-label={t('Emplacement constaté (facultatif)')} />
              <button className="btn primary small" type="submit">{t('Enregistrer la lecture')}</button>
            </form>
          ) : null}
          <p className={msg.bad ? 'ws-err' : 'muted'} role="status">{msg.text}</p>
          {list(t('Manquantes'), r.missing, base)}
          {list(t('Mal placées'), r.misplaced, [...base, { key: 'expectedLocation', label: t('Attendu') }, { key: 'foundLocation', label: t('Trouvé') }])}
          {list(t('En trop'), r.extra, [...base, { key: 'foundLocation', label: t('Trouvé') }])}
          {list(t('Codes inconnus'), r.unknown, [{ key: 'code', label: t('Code') }, { key: 'scannedAt', label: t('Lu le'), render: (x) => when(x.scannedAt) }])}
          {list(t('En prêt (absence normale)'), r.onLoan, base)}
        </>
      );
    }}
    </Loaded>
  );
}

function Campaigns({ L }) {
  const t = useT();
  const { toast } = useWs();
  const [open, setOpen] = useState(null);
  const st = useLoad(() => L.lib('GET', '/inventories'), [L.tick]);
  if (open) return <Campaign L={L} id={open} back={() => { setOpen(null); st.reload(); }} />;
  return (
    <div className="ws-cols">
      <div className="ws-card"><h2>{t('Inventaires')}</h2>
        <Loaded state={st}>{(j) => (j.inventories.length ? <ul className="lib-audit">{j.inventories.map((i) => (
          <li key={i.id}><b>{i.name}</b><span>{i.status === 'open' ? t('Ouvert') : t('Clos')} · {t('{a} manquante(s), {b} mal placée(s), {c} en trop', { a: i.counts.missing, b: i.counts.misplaced, c: i.counts.extra })} · {day(i.startedAt)}</span>
            <button className="btn small" type="button" onClick={() => setOpen(i.id)}>{t('Ouvrir')}</button></li>))}</ul> : <p className="ws-empty">{t('Aucun inventaire pour le moment.')}</p>)}</Loaded></div>
      <div className="ws-card"><h2>{t('Nouvel inventaire')}</h2>
        <p className="muted small">{t("L'inventaire photographie les ressources physiques attendues ; vous lisez ensuite leurs codes. Les écarts apparaissent au fur et à mesure.")}</p>
        <Form submitText={t("Ouvrir l'inventaire")} fields={[{ k: 'name', label: t('Nom'), required: true, value: '' }, { k: 'scopeType', label: t('Périmètre'), type: 'select', value: 'all', options: [['all', t('Toutes les ressources physiques')], ['location', t('Un emplacement')], ['class', t('Une classe (numéro)')]] }, { k: 'scopeValue', label: t("Emplacement (début du nom) ou numéro de classe"), value: '' }]}
          onSubmit={(v) => L.lib('POST', '/inventories', { name: v.name, scopeType: v.scopeType, scopeValue: v.scopeValue }).then((r) => { toast(t('{n} ressource(s) attendue(s).', { n: r.expected })); st.reload(); setOpen(r.id); })} /></div>
    </div>
  );
}

function Usage({ L }) {
  const t = useT();
  const st = useLoad(() => L.lib('GET', '/usage'), [L.tick]);
  return (
    <Loaded state={st}>{(j) => {
      const top = j.topBorrowed.map((x) => ({ name: x.title.slice(0, 24), value: x.count }));
      const cons = j.topConsulted.map((x) => ({ name: x.title.slice(0, 24), value: x.count }));
      const acq = j.acquisitions.map((x) => ({ x: x.year, n: x.count }));
      const lm = j.loansPerMonth.map((x) => ({ x: x.month.slice(2), n: x.count }));
      const cond = j.conditions.map((x) => ({ name: t(condLabel(x.value)), value: x.count }));
      const card = (title, node, h = 240) => <div className="ws-card"><ChartFrame title={title} height={h}>{node}</ChartFrame></div>;
      const empty = <p className="ws-empty">{t('Pas encore de données.')}</p>;
      return (
        <>
          <div className="ui-stats"><Stat label={t('Jamais empruntées')} value={j.neverBorrowed} tone={j.neverBorrowed ? 'warn' : 'ok'} sub={t('depuis plus de 90 jours')} /><Stat label={t('Jamais consultées')} value={j.neverConsulted} tone={j.neverConsulted ? 'warn' : 'ok'} /><Stat label={t('Pertes')} value={j.lost.count} sub={t('valeur : {n}', { n: j.lost.value })} tone={j.lost.count ? 'danger' : 'ok'} /><Stat label={t("Valeur d'acquisition")} value={j.acquiredValue} /></div>
          <div className="ws-cols">
            {card(t('Les plus empruntées'), top.length ? <HBars data={top} valueLabel={t('Prêts')} height={240} /> : empty)}
            {card(t('Les plus consultées'), cons.length ? <HBars data={cons} valueLabel={t('Consultations')} height={240} /> : empty)}
          </div>
          <div className="ws-cols">
            {card(t('Prêts par mois'), <Bars data={lm} height={240} series={[{ key: 'n', label: t('Prêts'), color: 'var(--c1)' }]} />)}
            {card(t('Acquisitions par année'), acq.length ? <Bars data={acq} height={240} series={[{ key: 'n', label: t('Acquisitions'), color: 'var(--c2)' }]} /> : empty)}
          </div>
          <div className="ws-cols">
            {card(t('État des ressources physiques'), cond.length ? <Donut data={cond} center={cond.reduce((a, x) => a + x.value, 0)} sub={t('ressources')} /> : empty)}
            <div className="ws-card"><h3>{t('Jamais empruntées')}</h3>{j.neverBorrowedList.length ? <ul className="lib-audit">{j.neverBorrowedList.map((x) => <li key={x.id}><b>{x.title}</b><span className="mono">{x.inventoryNo}</span></li>)}</ul> : <p className="ws-empty">{t('Toutes ont été empruntées.')}</p>}
              {j.lost.list.length ? <><h3>{t('Pertes')}</h3><ul className="lib-audit">{j.lost.list.map((x) => <li key={x.id} className="bad"><b>{x.title}</b><span>{x.price} {x.lostAt ? `· ${day(x.lostAt)}` : ''}</span></li>)}</ul></> : null}</div>
          </div>
        </>
      );
    }}
    </Loaded>
  );
}

export default function Inventory({ L }) {
  const t = useT();
  const [tab, setTab] = useState('usage');
  return (
    <>
      <div className="ws-head"><div><h1>{t('Inventaire et suivi')}</h1><p className="muted">{t("Récolement des ressources physiques, pertes, acquisitions et usage : ce qui sort le plus, ce qui ne sort jamais.")}</p></div></div>
      <Tabs items={[{ id: 'usage', label: t('Usage et acquisitions') }, { id: 'inv', label: t('Inventaires') }]} value={tab} onChange={setTab} label={t('Inventaire')} />
      {tab === 'usage' ? <Usage L={L} /> : <Campaigns L={L} />}
    </>
  );
}
