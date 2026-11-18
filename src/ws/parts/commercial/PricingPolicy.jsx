import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, Field, Loading, Table, useLoad } from '../../ui.jsx';
import { Failed, num, useCp, useForm, useL } from './common.jsx';
import { useL3 } from './labels3.jsx';

/* Politique tarifaire (plafonds de remise par rôle, seuil de marge) et listes de prix par segment et canal. */

export function PolicyScreen() {
  const t = useT();
  const L = useL();
  const { api, has, tick, bump } = useCp();
  const { toast } = useWs();
  const st = useLoad(() => api('GET', '/pricing/policy'), [tick]);
  const f = useForm(null);
  const [v, setV] = useState(null);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const cur = v || { caps: { ...st.data.discountCaps }, marginMinPct: st.data.marginMinPct, quoteValidityDays: st.data.quoteValidityDays, elasticity: st.data.elasticity };
  const edit = has('pricing');
  const setCap = (k, val) => setV({ ...cur, caps: { ...cur.caps, [k]: val } });
  const save = (e) => {
    e.preventDefault();
    f.run(async () => {
      await api('PUT', '/pricing/policy', { discountCaps: Object.fromEntries(Object.entries(cur.caps).map(([k, x]) => [k, num(x)])), marginMinPct: num(cur.marginMinPct), quoteValidityDays: num(cur.quoteValidityDays), elasticity: num(cur.elasticity) });
      toast(t('Politique tarifaire enregistrée.')); setV(null); st.reload(); bump();
    });
  };
  return (
    <Card title={t('Politique tarifaire')} subtitle={t('Un devis dont la remise dépasse le plafond du rôle de son auteur doit être validé par le responsable commercial.')}>
      {!edit ? <Alert tone="info">{t('Seul le responsable commercial modifie la politique tarifaire.')}</Alert> : null}
      <form className="ws-form" noValidate onSubmit={save}>
        <fieldset className="cp-fs" disabled={!edit}>
          <div className="cp-grid">
            {Object.keys(cur.caps).map((k) => <Field key={k} label={t('Remise maximale : {r}', { r: L.cRole[k] || k })} hint={t('En % du prix de liste (0 à 100)')}>{(p) => <input {...p} type="text" inputMode="decimal" value={cur.caps[k]} onChange={(e) => setCap(k, e.target.value)} />}</Field>)}
            <Field label={t('Seuil de marge (%)')} hint={t('En dessous, une alerte est affichée.')}>{(p) => <input {...p} type="text" inputMode="decimal" value={cur.marginMinPct} onChange={(e) => setV({ ...cur, marginMinPct: e.target.value })} />}</Field>
            <Field label={t('Validité des devis (jours)')}>{(p) => <input {...p} type="text" inputMode="numeric" value={cur.quoteValidityDays} onChange={(e) => setV({ ...cur, quoteValidityDays: e.target.value })} />}</Field>
            <Field label={t('Élasticité par défaut')} hint={t('Négative : une hausse de prix fait baisser le volume (de -10 à 0).')}>{(p) => <input {...p} type="text" inputMode="decimal" value={cur.elasticity} onChange={(e) => setV({ ...cur, elasticity: e.target.value })} />}</Field>
          </div>
        </fieldset>
        <p className="ws-err" role="alert">{f.err}</p>
        {edit ? <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div> : null}
      </form>
    </Card>
  );
}

function ListForm({ pre, segments, channels, items, close, onSaved }) {
  const t = useT();
  const L = useL();
  const L3 = useL3();
  const { api } = useCp();
  const f = useForm({ name: pre ? pre.name : '', segment: pre ? pre.segment : '', channel: pre ? pre.channel : 'all', discountPct: pre ? String(pre.discountPct) : '0', validFrom: pre ? pre.validFrom || '' : '', validUntil: pre ? pre.validUntil || '' : '', priority: pre ? String(pre.priority) : '100', active: pre ? pre.active : true });
  const [prices, setPrices] = useState(() => Object.fromEntries((pre ? pre.items : []).map((i) => [i.itemId, String(i.price)])));
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.name.trim()) throw new Error(t('Nommez la liste de prix.'));
      const body = { name: f.v.name, segment: f.v.segment, channel: f.v.channel, discountPct: num(f.v.discountPct), validFrom: f.v.validFrom || null, validUntil: f.v.validUntil || null, priority: num(f.v.priority), active: f.v.active, items: Object.entries(prices).filter(([, p]) => String(p).trim() !== '').map(([itemId, price]) => ({ itemId: Number(itemId), price: num(price) })) };
      if (pre) await api('PUT', '/pricing/lists/' + pre.id, body); else await api('POST', '/pricing/lists', body);
      close(); onSaved();
    }); }}>
      <div className="cp-grid">
        <Field label={t('Nom')} required>{(p) => <input {...p} type="text" maxLength={80} value={f.v.name} onChange={f.set('name')} />}</Field>
        <Field label={t('Segment de clients')}>{(p) => <select {...p} value={f.v.segment} onChange={f.set('segment')}><option value="">{t('Tous')}</option>{segments.map((s) => <option key={s} value={s}>{L3.seg[s] || L.rfm[s] || s}</option>)}</select>}</Field>
        <Field label={t('Canal')}>{(p) => <select {...p} value={f.v.channel} onChange={f.set('channel')}>{channels.map((c) => <option key={c} value={c}>{L3.channel[c] || c}</option>)}</select>}</Field>
        <Field label={t('Remise sur le prix de liste (%)')}>{(p) => <input {...p} type="text" inputMode="decimal" value={f.v.discountPct} onChange={f.set('discountPct')} />}</Field>
        <Field label={t('Début')}>{(p) => <input {...p} type="date" value={f.v.validFrom} onChange={f.set('validFrom')} />}</Field>
        <Field label={t('Fin')}>{(p) => <input {...p} type="date" value={f.v.validUntil} onChange={f.set('validUntil')} />}</Field>
        <Field label={t('Priorité')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.priority} onChange={f.set('priority')} />}</Field>
      </div>
      <label className="cp-check"><input type="checkbox" checked={f.v.active} onChange={f.set('active')} /> {t('Liste active')}</label>
      <fieldset className="cp-fs cp-pick"><legend>{t('Prix fixes par article (facultatif)')}</legend>
        {items.map((it) => <label className="cp-pl" key={it.id}><span>{it.name} <span className="muted small">({it.price})</span></span><input type="text" inputMode="numeric" aria-label={t('Prix de {nom}', { nom: it.name })} value={prices[it.id] ?? ''} onChange={(e) => setPrices({ ...prices, [it.id]: e.target.value })} /></label>)}
        {!items.length ? <p className="muted small">{t('Aucun article au catalogue.')}</p> : null}
      </fieldset>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

export function PriceLists() {
  const t = useT();
  const L3 = useL3();
  const L = useL();
  const { api, has, fail, tick } = useCp();
  const { modal, confirm } = useWs();
  const st = useLoad(() => api('GET', '/pricing/lists'), [tick]);
  const items = useLoad(() => api('GET', '/pricing/items'), []);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const form = (pre) => modal(pre ? t('Modifier la liste de prix') : t('Nouvelle liste de prix'), (close) => <ListForm pre={pre} segments={st.data.segments} channels={st.data.channels} items={items.data ? items.data.items : []} close={close} onSaved={st.reload} />, { wide: true });
  const cols = [
    { key: 'name', label: t('Liste'), render: (l) => <b>{l.name}</b> }, { key: 'segment', label: t('Segment'), render: (l) => (l.segment ? L3.seg[l.segment] || L.rfm[l.segment] || l.segment : t('Tous')) },
    { key: 'channel', label: t('Canal'), render: (l) => L3.channel[l.channel] || l.channel }, { key: 'discountPct', label: t('Remise'), align: 'r', render: (l) => l.discountPct + ' %' },
    { key: 'items', label: t('Articles'), align: 'r', render: (l) => l.items.length }, { key: 'valid', label: t('Période'), render: (l) => [l.validFrom, l.validUntil].filter(Boolean).join(' → ') || '—' },
    { key: 'active', label: t('État'), render: (l) => <Badge tone={l.active ? 'ok' : 'neutral'}>{l.active ? t('Active') : t('Inactive')}</Badge> },
    { key: 'act', label: '', render: (l) => (has('pricing') ? <span className="row"><Button size="sm" onClick={() => form(l)}>{t('Modifier')}</Button><Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer {nom}', { nom: l.name })} onClick={() => confirm(t('Supprimer cette liste de prix ?'), () => api('DELETE', '/pricing/lists/' + l.id).then(st.reload, fail))} /></span> : null) },
  ];
  return (
    <Card title={t('Listes de prix')} subtitle={t('Prix par segment de clients et par canal. Une liste ne fait jamais descendre sous le prix plancher.')} actions={has('pricing') ? <Button variant="primary" icon="plus" onClick={() => form(null)}>{t('Nouvelle liste de prix')}</Button> : null}>
      <Table caption={t('Listes de prix')} columns={cols} rows={st.data.lists} empty={t('Aucune liste de prix.')} />
    </Card>
  );
}
