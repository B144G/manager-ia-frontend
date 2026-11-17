import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Kpis, Progress, Tag, WMS, qty, usePdf } from './kit.jsx';
import Scanner from './Scanner.jsx';

/* Poste d'emballage : la marchandise préparée va dans des colis (poids, dimensions), chaque article scanné entre dans le colis ouvert ;
   un contrôle par scan compare ce qui est emballé à ce qui a été prélevé, puis la liste de colisage s'imprime. */
const BOX_ST = { open: ['Ouvert', 'mid'], closed: ['Fermé', 'good'], shipped: ['Expédié', 'good'] };
const dimsText = (b) => [b.weight ? qty(b.weight) + ' kg' : '', b.length && b.width && b.height ? qty(b.length) + ' × ' + qty(b.width) + ' × ' + qty(b.height) + ' cm' : ''].filter(Boolean).join(' · ');
const DIM_FIELDS = (t, b = {}) => [
  { k: 'weight', label: t('Poids (kg)'), value: b.weight == null ? '' : String(b.weight) },
  { k: 'length', label: t('Longueur (cm)'), value: b.length == null ? '' : String(b.length) },
  { k: 'width', label: t('Largeur (cm)'), value: b.width == null ? '' : String(b.width) },
  { k: 'height', label: t('Hauteur (cm)'), value: b.height == null ? '' : String(b.height) },
];

/** Contrôle par scan : chaque code scanné compte pour une unité. */
function Verify({ pickId, box, close }) {
  const t = useT();
  const { oapi } = useWs();
  const [codes, setCodes] = useState([]); const [res, setRes] = useState(null); const [err, setErr] = useState('');
  const check = () => { setErr(''); oapi('POST', WMS + '/packing/' + pickId + '/verify', { boxId: box ? box.id : undefined, codes }).then(setRes).catch((e) => setErr(tsrv(e.message))); };
  return (
    <div className="wms-run">
      <p className="muted small">{box ? t('Scannez chaque article du colis {code}, un par un.', { code: box.code }) : t('Scannez chaque article préparé, un par un.')}</p>
      <Scanner autoFocus label={t("Scanner l'article")} onCode={(c) => { setRes(null); setCodes(codes.concat([c])); }} />
      <p>{t('{n} article(s) scanné(s)', { n: codes.length })}</p>
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      {res ? (
        <div className="ws-card">
          <p>{res.ok ? <Tag tone="good">{t('Conforme')}</Tag> : <Tag tone="bad">{t('Écart')}</Tag>}</p>
          {res.lines.map((l) => <div className="line" key={l.itemId}><span>{l.name}</span><span className={Math.abs(l.diff) > 1e-9 ? 'late' : 'ok'}>{t('{s} scanné(s) / {e} attendu(s)', { s: qty(l.scanned), e: qty(l.expected) })}</span></div>)}
          {res.unknown.length ? <p className="ws-err">{t('Codes inconnus : {list}', { list: res.unknown.join(', ') })}</p> : null}
        </div>
      ) : null}
      <div className="row">
        <button className="btn primary" type="button" disabled={!codes.length} onClick={check}>{t('Contrôler')}</button>
        <button className="btn" type="button" onClick={() => { setCodes([]); setRes(null); }}>{t('Recommencer')}</button>
        <button className="btn" type="button" onClick={close}>{t('Fermer')}</button>
      </div>
    </div>
  );
}

export function PackStation({ id, back }) {
  const t = useT();
  const { oapi, modal, toast, fail, confirm } = useWs();
  const pdf = usePdf();
  const st = useLoad(() => oapi('GET', WMS + '/packing/' + id), []);
  const [boxSel, setBoxSel] = useState(null);
  const [err, setErr] = useState(''); const [last, setLast] = useState('');
  const reload = () => st.reload();
  const newBox = () => modal(t('Nouveau colis'), (close) => (
    <Form submitText={t('Créer le colis')} fields={DIM_FIELDS(t)} onSubmit={(v) => oapi('POST', WMS + '/packing/' + id + '/boxes', v).then((j) => { close(); setBoxSel(j.id); toast(t('Colis {code} créé.', { code: j.code })); reload(); })} />
  ));
  const pack = (box, body) => { setErr(''); return oapi('POST', WMS + '/packing/' + id + '/pack', { boxId: box.id, ...body }).then((j) => { setLast(t('{q} × {name} dans {box}', { q: qty(j.quantity), name: j.item, box: j.box })); reload(); }).catch((e) => { if (e && e.status === 401) fail(e); setErr(tsrv(e.message)); }); };
  const packQty = (box, it) => modal(t('Emballer « {name} »', { name: it.name }), (close) => (
    <Form submitText={t('Mettre dans le colis')} fields={[{ k: 'q', label: t('Quantité ({unit})', { unit: it.unit }), value: String(it.toPack), required: true }]}
      onSubmit={(v) => oapi('POST', WMS + '/packing/' + id + '/pack', { boxId: box.id, itemId: it.itemId, quantity: v.q }).then(() => { close(); reload(); })} />
  ));
  const closeBox = (b) => modal(t('Fermer le colis {code}', { code: b.code }), (close) => (
    <Form submitText={t('Fermer le colis')} fields={DIM_FIELDS(t, b)} onSubmit={(v) => oapi('POST', WMS + '/packing/boxes/' + b.id + '/close', v).then(() => { close(); toast(t('Colis fermé.')); reload(); })} />
  ));
  const finish = () => oapi('POST', WMS + '/packing/' + id + '/finish', {}).then(() => { toast(t('Emballage terminé : la commande est prête à expédier.')); reload(); }).catch((e) => setErr(tsrv(e.message)));
  return (
    <Loaded state={st}>{({ pick: p }) => {
      const openBoxes = p.boxes.filter((b) => b.status === 'open');
      const active = p.boxes.find((b) => b.id === boxSel && b.status === 'open') || openBoxes[openBoxes.length - 1] || null;
      const can = p.status === 'picked';
      return (
        <div className="wms-run">
          <div className="row" style={{ justifyContent: 'space-between' }}><h2>{p.code}</h2>{back ? <button className="btn small" type="button" onClick={back}>{t('Retour')}</button> : null}</div>
          <p>{p.packedAt ? <Tag tone="good">{t('Emballée')}</Tag> : <Tag tone="mid">{t('À emballer')}</Tag>} <small className="muted">{[p.documentNumber, p.customer, p.label, p.station && t('poste : {s}', { s: p.station })].filter(Boolean).join(' · ')}</small></p>
          <Kpis list={[{ label: t('prélevé'), value: qty(p.picked) }, { label: t('emballé'), value: qty(p.packed) }, { label: t('reste à emballer'), value: qty(p.toPack), bad: p.toPack > 0 }, { label: t('colis'), value: String(p.boxes.length) }]} />
          <Progress value={p.picked ? (100 * p.packed) / p.picked : 0} label={t('Emballé')} />
          {err ? <p className="ws-err" role="alert">{err}</p> : null}
          {last ? <p className="small ok" role="status">{last}</p> : null}
          {can ? (
            <div className="ws-card">
              {active ? (
                <>
                  <p>{t('Colis ouvert : {code}', { code: active.code })}{openBoxes.length > 1 ? <> · <select style={{ fontSize: 16 }} value={active.id} onChange={(e) => setBoxSel(Number(e.target.value))} aria-label={t('Colis ouvert')}>{openBoxes.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select></> : null}</p>
                  <Scanner autoFocus label={t('Scanner un article à mettre dans le colis')} hint={t('Chaque scan met une unité dans le colis ouvert.')} onCode={(c) => pack(active, { itemCode: c })} />
                </>
              ) : <p className="muted">{t('Créez un colis pour commencer à emballer.')}</p>}
              <div className="row wms-toolbar">
                <button className={'btn' + (active ? '' : ' primary')} type="button" onClick={newBox}>{t('Nouveau colis')}</button>
                <button className="btn" type="button" onClick={() => modal(t('Contrôle par scan'), (close) => <Verify pickId={id} close={close} />)}>{t('Contrôler la commande')}</button>
                <button className="btn primary" type="button" disabled={p.toPack > 0 || !p.boxes.length || Boolean(p.packedAt)} onClick={finish}>{t("Terminer l'emballage")}</button>
              </div>
            </div>
          ) : null}
          <div className="ws-card">
            <h3>{t('Articles')}</h3>
            {p.items.map((it) => (
              <div className="line" key={it.itemId}>
                <span><b>{it.name}</b> <small>{t('{p} prélevé(s) · {k} emballé(s)', { p: qty(it.picked) + ' ' + it.unit, k: qty(it.packed) })}{it.picked < it.quantity ? ' · ' + t('commandé : {q}', { q: qty(it.quantity) }) : ''}</small></span>
                {can && active && it.toPack > 0 ? <button className="btn small" type="button" onClick={() => packQty(active, it)}>{t('Emballer {q}', { q: qty(it.toPack) })}</button> : it.toPack > 0 ? <Tag tone="bad">{t('{q} à emballer', { q: qty(it.toPack) })}</Tag> : <Tag tone="good">{t('emballé')}</Tag>}
              </div>
            ))}
          </div>
          {p.boxes.map((b) => (
            <div className="ws-card" key={b.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span><b>{b.code}</b> <Tag tone={(BOX_ST[b.status] || ['', 'mid'])[1]}>{t((BOX_ST[b.status] || [b.status])[0])}</Tag> <small className="muted">{[dimsText(b), b.location, b.shipment && t('expédition {code}', { code: b.shipment })].filter(Boolean).join(' · ')}</small></span>
              </div>
              {!b.contents.length ? <Empty text={t('Colis vide.')} /> : null}
              {b.contents.map((c) => (
                <div className="line" key={c.itemId + '-' + (c.lotNo || '')}>
                  <span>{c.name}{c.lotNo ? <small>{' · ' + t('lot {x}', { x: c.lotNo })}</small> : null}</span>
                  <span className="row"><span>{qty(c.quantity) + ' ' + c.unit}</span>
                    {can && b.status === 'open' ? <button className="link" type="button" onClick={() => confirm(t('Retirer « {name} » du colis ? La marchandise reste au poste d\'emballage.', { name: c.name }), () => oapi('POST', WMS + '/packing/' + id + '/unpack', { boxId: b.id, itemId: c.itemId }).then(reload).catch(fail))}>{t('Retirer')}</button> : null}</span>
                </div>
              ))}
              <div className="row wms-toolbar">
                {can && b.status === 'open' ? <button className="btn small primary" type="button" onClick={() => closeBox(b)}>{t('Fermer le colis')}</button> : null}
                {can && b.status === 'closed' && !b.shipment ? <button className="btn small" type="button" onClick={() => oapi('POST', WMS + '/packing/boxes/' + b.id + '/reopen', {}).then(reload).catch(fail)}>{t('Rouvrir')}</button> : null}
                {b.status !== 'shipped' ? <button className="btn small" type="button" onClick={() => modal(t('Poids et dimensions'), (close) => <Form submitText={t('Enregistrer')} fields={DIM_FIELDS(t, b)} onSubmit={(v) => oapi('PUT', WMS + '/packing/boxes/' + b.id, v).then(() => { close(); reload(); })} />)}>{t('Poids et dimensions')}</button> : null}
                {b.contents.length ? <button className="btn small" type="button" onClick={() => modal(t('Contrôle par scan'), (close) => <Verify pickId={id} box={b} close={close} />)}>{t('Contrôler')}</button> : null}
                <button className="btn small" type="button" onClick={() => pdf('/packing/boxes/' + b.id + '/packing-list', 'colisage-' + b.code)}>{t('Liste de colisage')}</button>
                <button className="btn small" type="button" onClick={() => pdf('/hus/' + b.id + '/label', b.code)}>{t('Étiquette')}</button>
              </div>
            </div>
          ))}
        </div>
      );
    }}</Loaded>
  );
}

export default function Packing() {
  const t = useT();
  const { oapi, toast } = useWs();
  const [open, setOpen] = useState(null);
  const st = useLoad(() => oapi('GET', WMS + '/packing'), []);
  const scanPick = (code) => oapi('GET', WMS + '/scan?code=' + encodeURIComponent(code)).then((r) => { if (r.type === 'pick') setOpen(r.id); else throw new Error(t("Ce code n'est pas une liste de préparation.")); });
  if (open) return <PackStation id={open} back={() => { setOpen(null); st.reload(); }} />;
  return (
    <>
      <div className="ws-card"><Scanner label={t('Scanner une liste de préparation (PR-…)')} onCode={(c) => scanPick(c).catch((e) => toast(tsrv(e.message)))} /></div>
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.picks.length ? <Empty text={t('Aucune commande préparée en attente d\'emballage.')} /> : null}
          {j.picks.map((p) => (
            <div className="line" key={p.id}>
              <span><b>{p.code}</b> {p.packedAt ? <Tag tone="good">{t('Emballée')}</Tag> : <Tag tone="mid">{t('À emballer')}</Tag>}
                <small>{' ' + [p.documentNumber, p.customer, p.label, p.waveCode, t('{a} / {b} emballé', { a: qty(p.packed), b: qty(p.picked) }), t('{n} colis', { n: p.boxes })].filter(Boolean).join(' · ')}</small></span>
              <button className="btn small primary" type="button" onClick={() => setOpen(p.id)}>{p.packedAt ? t('Ouvrir') : t('Emballer')}</button>
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}
