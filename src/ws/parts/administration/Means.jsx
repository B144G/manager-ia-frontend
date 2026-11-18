import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Badge, Button, ChartFrame, Drawer, Stat, Table } from '../../ui.jsx';
import { Bars, Donut, compact } from '../../charts/lazy.jsx';
import { Grid, Kpis, Pill, Section, View, memberOptions, num, toInt, useAdm, useData, useFormModal, useMembers } from './kit.jsx';

/* Moyens généraux : inventaire, attribution, véhicules, échéances, coûts, locaux et salles, fournitures, demandes de moyens. */

const useCats = () => { const t = useT(); return { furniture: t('Mobilier'), it: t('Informatique'), vehicle: t('Véhicule'), equipment: t('Équipement'), tool: t('Outillage'), other: t('Autre') }; };
const useAssetSt = () => { const t = useT(); return { in_use: t('En service'), stock: t('En stock'), repair: t('En réparation'), retired: t('Réformé'), lost: t('Perdu') }; };

export function Assets() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { money, dateFr, can, toast, fail } = useWs();
  const members = useMembers();
  const form = useFormModal();
  const CAT = useCats(); const ST = useAssetSt();
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [mine, setMine] = useState(false);
  const [open, setOpen] = useState(null);
  const units = useData('/org/chart');
  const edit = async (a) => {
    let linkable = [];
    if (can('admin')) { try { linkable = (await api('GET', '/means/assets/linkable')).assets; } catch { /* module Comptabilité absent */ } }
    form(a ? t('Modifier le bien') : t('Nouveau bien'), [
      { k: 'name', label: t('Nom du bien'), value: a ? a.name : '', required: true }, { k: 'category', label: t('Catégorie'), type: 'select', value: a ? a.category : 'equipment', options: Object.entries(CAT) },
      { k: 'brand', label: t('Marque / modèle'), value: a ? a.brand : '' }, { k: 'serial', label: t('Numéro de série'), value: a ? a.serial : '' }, { k: 'plate', label: t('Immatriculation (véhicule)'), value: a ? a.plate : '' },
      { k: 'location', label: t('Emplacement'), value: a ? a.location : '' }, { k: 'purchaseDate', label: t('Date d’achat'), type: 'date', value: a ? a.purchaseDate || '' : '' }, { k: 'cost', label: t('Coût d’achat'), value: a ? String(a.cost) : '0' },
      { k: 'status', label: t('Statut'), type: 'select', value: a ? a.status : 'in_use', options: Object.entries(ST) },
      ...(linkable.length || (a && a.fixedAssetId) ? [{ k: 'fixedAssetId', label: t('Immobilisation comptable liée'), type: 'select', value: a && a.fixedAssetId ? String(a.fixedAssetId) : '', options: [['', t('— Aucune —')], ...(a && a.fixedAssetId ? [[String(a.fixedAssetId), t('(actuelle)')]] : []), ...linkable.map((x) => [String(x.id), `${x.label} · ${money(x.cost)}`])] }] : []),
    ], (v) => api(a ? 'PUT' : 'POST', a ? `/means/assets/${a.id}` : '/means/assets', { ...v, cost: num(v.cost) || 0, purchaseDate: v.purchaseDate || null, ...(v.fixedAssetId !== undefined ? { fixedAssetId: toInt(v.fixedAssetId) } : {}) }), { wide: true });
  };
  const qs = `?${q ? 'q=' + encodeURIComponent(q) + '&' : ''}${cat ? 'category=' + cat + '&' : ''}${mine ? 'mine=1' : ''}`;
  return (
    <View path={'/means/assets' + qs} deps={[qs]}>{(d) => (
      <>
        <Kpis><Stat icon="boxes-stacked" label={t('Biens')} value={d.summary.total} /><Stat icon="coins" label={t('Valeur d’achat')} value={money(d.summary.value)} />{d.summary.byStatus.filter((s) => s.key === 'repair').map((s) => <Stat key={s.key} icon="wrench" label={t('En réparation')} value={s.count} tone={s.count ? 'warn' : 'ok'} />)}</Kpis>
        <Grid cols={2}>
          <ChartFrame title={t('Biens par catégorie')} summary={t('Nombre de biens par catégorie.')} height={200}><Donut data={d.summary.byCategory.filter((c) => c.count).map((c) => ({ name: CAT[c.key], value: c.count }))} center={String(d.summary.total)} sub={t('biens')} /></ChartFrame>
          <ChartFrame title={t('Valeur par catégorie')} summary={t('Valeur d’achat par catégorie.')} height={200}><Bars data={d.summary.byCategory.filter((c) => c.count).map((c) => ({ label: CAT[c.key], value: c.value }))} xKey="label" series={[{ key: 'value', label: t('Valeur') }]} fmt={compact} /></ChartFrame>
        </Grid>
        <Section title={t('Inventaire des biens et équipements')} actions={perms.assets_manage ? <Button variant="primary" icon="plus" onClick={() => edit(null)}>{t('Bien')}</Button> : null}>
          <div className="adm-filters"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Nom, code, série, plaque…')} aria-label={t('Rechercher un bien')} /><select aria-label={t('Catégorie')} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">{t('Toutes les catégories')}</option>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><label className="adm-chk"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{t('Mes biens')}</label></div>
          <Table caption={t('Biens')} rows={d.assets} empty={t('Aucun bien.')} onRowClick={(a) => setOpen(a)} columns={[
            { key: 'code', label: t('Code') }, { key: 'name', label: t('Bien'), render: (a) => <><b>{a.name}</b><small>{a.plate || a.serial}</small></> }, { key: 'cat', label: t('Catégorie'), render: (a) => CAT[a.category] },
            { key: 'who', label: t('Attribué à'), render: (a) => a.assignee || a.unit || '—' }, { key: 'cost', label: t('Coût'), align: 'r', render: (a) => money(a.cost) },
            { key: 'st', label: t('Statut'), render: (a) => <Pill k={a.status}>{ST[a.status]}</Pill> },
          ]} />
        </Section>
        {open ? <AssetDrawer a={open} onClose={() => setOpen(null)} edit={edit} members={members} units={units.data ? units.data.units : []} toast={toast} fail={fail} dateFr={dateFr} money={money} reload={reload} /> : null}
      </>
    )}
    </View>
  );
}
function AssetDrawer({ a, onClose, edit, members, units, toast, fail, dateFr, money, reload }) { // eslint-disable-line no-unused-vars
  const t = useT();
  const { api, perms, tick } = useAdm();
  const form = useFormModal();
  const ST = useAssetSt();
  const [d, setD] = useState(null);
  useEffect(() => { api('GET', `/means/assets/${a.id}`).then(setD, fail); }, [a.id, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const EV = { purchase: t('Achat'), maintenance: t('Entretien'), repair: t('Réparation'), fuel: t('Carburant'), insurance: t('Assurance'), tax: t('Taxe'), other: t('Autre') };
  return (
    <Drawer title={a.name} onClose={onClose} wide>
      {!d ? <p className="muted">{t('Chargement…')}</p> : (
        <div className="adm-form">
          <p><Pill k={d.asset.status}>{ST[d.asset.status]}</Pill> {d.asset.code} · {d.asset.assignee || d.asset.unit || t('Non attribué')} {d.asset.mileage ? `· ${d.asset.mileage} km` : ''} {d.asset.fixedAssetId ? <Badge tone="info">{t('Lié à la comptabilité')}</Badge> : null}</p>
          {perms.assets_manage ? <div className="row">
            <Button icon="pen" onClick={() => edit(d.asset)}>{t('Modifier')}</Button>
            <Button onClick={() => form(t('Attribuer le bien'), [{ k: 'userId', label: t('Personne'), type: 'select', options: memberOptions(members, t) }, { k: 'unitId', label: t('Service'), type: 'select', options: [['', t('— Aucun —')], ...units.map((u) => [String(u.id), u.name])] }, { k: 'note', label: t('Note') }], (v) => api('POST', `/means/assets/${a.id}/assign`, { userId: toInt(v.userId), unitId: toInt(v.unitId), note: v.note }))}>{t('Attribuer')}</Button>
            <Button onClick={async () => { try { await api('POST', `/means/assets/${a.id}/return`); toast(t('Bien restitué.')); reload(); } catch (e) { fail(e); } }}>{t('Restituer')}</Button>
            <Button onClick={() => form(t('Enregistrer un coût'), [{ k: 'kind', label: t('Nature'), type: 'select', options: Object.entries(EV) }, { k: 'date', label: t('Date'), type: 'date', value: new Date().toISOString().slice(0, 10) }, { k: 'amount', label: t('Montant'), value: '0' }, { k: 'vendor', label: t('Prestataire') }, { k: 'note', label: t('Note') }, ...(a.category === 'vehicle' ? [{ k: 'mileage', label: t('Kilométrage') }] : [])], (v) => api('POST', `/means/assets/${a.id}/events`, { kind: v.kind, date: v.date, amount: num(v.amount) || 0, vendor: v.vendor, note: v.note, mileage: v.mileage ? num(v.mileage) : undefined }))}>{t('Coût')}</Button>
            <Button onClick={() => form(t('Nouvelle échéance'), [{ k: 'kind', label: t('Nature'), type: 'select', options: [['insurance', t('Assurance')], ['inspection', t('Contrôle technique')], ['maintenance', t('Entretien')], ['warranty', t('Garantie')], ['tax', t('Taxe')], ['license', t('Licence')], ['other', t('Autre')]] }, { k: 'title', label: t('Objet'), required: true }, { k: 'dueDate', label: t('Échéance'), type: 'date', required: true }, { k: 'recurrenceMonths', label: t('Se répète tous les (mois, 0 = jamais)'), value: '0' }, { k: 'cost', label: t('Coût prévu'), value: '0' }], (v) => api('POST', '/means/deadlines', { assetId: a.id, kind: v.kind, title: v.title, dueDate: v.dueDate, recurrenceMonths: Number(v.recurrenceMonths) || 0, cost: num(v.cost) || 0 }))}>{t('Échéance')}</Button>
          </div> : null}
          <h3>{t('Historique d’attribution')}</h3>
          <Table caption={t('Attributions')} rows={d.history} empty={t('Jamais attribué.')} columns={[{ key: 'who', label: t('À'), render: (h) => h.user || h.unit || '—' }, { key: 'from', label: t('Du'), render: (h) => dateFr(h.from) }, { key: 'to', label: t('Au'), render: (h) => (h.to ? dateFr(h.to) : t('en cours')) }, { key: 'note', label: t('Note') }]} />
          <h3>{t('Échéances')}</h3>
          <Table caption={t('Échéances')} rows={d.deadlines.filter((x) => x.status === 'open')} empty={t('Aucune échéance.')} columns={[{ key: 'title', label: t('Objet') }, { key: 'due', label: t('Échéance'), render: (x) => <Pill k={x.overdue ? 'overdue' : 'pending'}>{dateFr(x.dueDate)}</Pill> }]} />
          <h3>{t('Coûts')} · {money(d.totalCost)}</h3>
          <Table caption={t('Coûts')} rows={d.events} empty={t('Aucun coût.')} columns={[{ key: 'date', label: t('Date'), render: (e) => dateFr(e.eventDate) }, { key: 'kind', label: t('Nature'), render: (e) => EV[e.kind] }, { key: 'vendor', label: t('Prestataire') }, { key: 'amount', label: t('Montant'), align: 'r', render: (e) => money(e.amount) }]} />
        </div>
      )}
    </Drawer>
  );
}

// ---------- Échéances et coûts ----------
export function Deadlines() {
  const t = useT();
  const { api, perms } = useAdm();
  const { dateFr, money, toast } = useWs();
  const form = useFormModal();
  const KIND = { insurance: t('Assurance'), inspection: t('Contrôle technique'), maintenance: t('Entretien'), warranty: t('Garantie'), tax: t('Taxe'), license: t('Licence'), other: t('Autre') };
  const costs = useData(perms.assets_manage ? '/means/costs' : '/means/summary');
  return (
    <>
      <View path="/means/deadlines">{(d) => (
        <>
          <Kpis><Stat icon="calendar-days" label={t('Échéances ouvertes')} value={d.summary.open} /><Stat icon="clock" label={t('Dépassées')} value={d.summary.overdue} tone={d.summary.overdue ? 'danger' : 'ok'} /><Stat icon="bell" label={t('Proches')} value={d.summary.soon} tone={d.summary.soon ? 'warn' : 'ok'} /></Kpis>
          <Section title={t('Échéances : assurances, contrôles, entretien')} subtitle={t('Une échéance qui se répète est recalculée quand vous la marquez faite.')}
            actions={perms.assets_manage ? <Button variant="primary" icon="plus" onClick={() => form(t('Nouvelle échéance'), [{ k: 'kind', label: t('Nature'), type: 'select', options: Object.entries(KIND) }, { k: 'title', label: t('Objet'), required: true }, { k: 'dueDate', label: t('Échéance'), type: 'date', required: true }, { k: 'recurrenceMonths', label: t('Se répète tous les (mois, 0 = jamais)'), value: '0' }, { k: 'cost', label: t('Coût prévu'), value: '0' }], (v) => api('POST', '/means/deadlines', { kind: v.kind, title: v.title, dueDate: v.dueDate, recurrenceMonths: Number(v.recurrenceMonths) || 0, cost: num(v.cost) || 0 }))}>{t('Échéance')}</Button> : null}>
            <Table caption={t('Échéances')} rows={d.deadlines} empty={t('Aucune échéance ouverte.')} columns={[
              { key: 'title', label: t('Objet'), render: (x) => <><b>{x.title}</b><small>{x.asset || ''}</small></> }, { key: 'kind', label: t('Nature'), render: (x) => KIND[x.kind] },
              { key: 'due', label: t('Échéance'), render: (x) => <Pill k={x.overdue ? 'overdue' : x.daysLeft <= 30 ? 'pending' : 'ok'}>{dateFr(x.dueDate)}</Pill> }, { key: 'rec', label: t('Répétition'), render: (x) => (x.recurrenceMonths ? `${x.recurrenceMonths} ${t('mois')}` : '—') }, { key: 'cost', label: t('Coût prévu'), align: 'r', render: (x) => (x.cost ? money(x.cost) : '—') },
              { key: 'a', label: '', render: (x) => (perms.assets_manage ? <Button size="sm" variant="primary" onClick={() => form(t('Marquer comme faite'), [{ k: 'doneOn', label: t('Date'), type: 'date', value: new Date().toISOString().slice(0, 10) }, { k: 'cost', label: t('Coût réel'), value: String(x.cost) }, { k: 'vendor', label: t('Prestataire') }], async (v) => { const r = await api('POST', `/means/deadlines/${x.id}/done`, { doneOn: v.doneOn, cost: num(v.cost) || 0, vendor: v.vendor }); if (r.next) toast(t('Prochaine échéance : {d}', { d: dateFr(r.next) })); })}>{t('Faite')}</Button> : null) },
            ]} />
          </Section>
        </>
      )}
      </View>
      {perms.assets_manage && costs.data && costs.data.byMonth ? (
        <Grid cols={2}>
          <ChartFrame title={t('Coûts par mois')} subtitle={`${t('Total sur 12 mois')} : ${money(costs.data.total)}`} summary={t('Coûts des moyens généraux par mois.')} height={220}><Bars data={costs.data.byMonth} xKey="month" series={[{ key: 'amount', label: t('Coût') }]} fmt={compact} /></ChartFrame>
          <ChartFrame title={t('Biens les plus coûteux')} summary={t('Les cinq biens qui ont coûté le plus.')} height={220}><Bars data={costs.data.top.map((x) => ({ label: x.name, amount: x.amount }))} xKey="label" series={[{ key: 'amount', label: t('Coût') }]} fmt={compact} /></ChartFrame>
        </Grid>
      ) : null}
    </>
  );
}

// ---------- Locaux, salles, réservations ----------
export function Places() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { dateFr, money, fail, toast } = useWs();
  const form = useFormModal();
  const PK = { premises: t('Local'), room: t('Salle'), storeroom: t('Réserve'), parking: t('Parking') };
  const book = (p) => form(`${t('Réserver')} · ${p.name}`, [{ k: 'title', label: t('Objet'), required: true }, { k: 'startAt', label: t('Début'), type: 'datetime-local', required: true }, { k: 'endAt', label: t('Fin'), type: 'datetime-local', required: true }], (v) => api('POST', '/means/bookings', { placeId: p.id, title: v.title, startAt: v.startAt, endAt: v.endAt }), { done: t('Réservation enregistrée.') });
  return (
    <>
      <View path="/means/places">{(d) => (
        <Section title={t('Locaux et salles')} subtitle={`${t('Loyers mensuels')} : ${money(d.totalRent)}`}
          actions={perms.assets_manage ? <Button variant="primary" icon="plus" onClick={() => form(t('Nouveau local'), [{ k: 'name', label: t('Nom'), required: true }, { k: 'kind', label: t('Type'), type: 'select', options: Object.entries(PK) }, { k: 'address', label: t('Adresse') }, { k: 'capacity', label: t('Capacité (personnes)'), value: '0' }, { k: 'surface', label: t('Surface (m²)'), value: '0' }, { k: 'monthlyRent', label: t('Loyer mensuel'), value: '0' }], (v) => api('POST', '/means/places', { ...v, capacity: Number(v.capacity) || 0, surface: num(v.surface) || 0, monthlyRent: num(v.monthlyRent) || 0 }))}>{t('Local')}</Button> : null}>
          <Table caption={t('Locaux')} rows={d.places} empty={t('Aucun local.')} columns={[{ key: 'name', label: t('Nom'), render: (p) => <b>{p.name}</b> }, { key: 'kind', label: t('Type'), render: (p) => PK[p.kind] }, { key: 'address', label: t('Adresse') }, { key: 'capacity', label: t('Capacité'), align: 'r' }, { key: 'surface', label: 'm²', align: 'r' }, { key: 'rent', label: t('Loyer'), align: 'r', render: (p) => (p.monthlyRent ? money(p.monthlyRent) : '—') },
            { key: 'a', label: '', render: (p) => <span className="row"><Button size="sm" onClick={() => book(p)}>{t('Réserver')}</Button>{perms.assets_manage ? <Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Supprimer')} onClick={async () => { try { await api('DELETE', `/means/places/${p.id}`); reload(); } catch (e) { fail(e); } }} /> : null}</span> }]} />
        </Section>
      )}
      </View>
      <View path="/means/bookings">{(d) => (
        <Section title={t('Réservations à venir')} subtitle={t('Une salle ne peut pas être réservée deux fois sur le même créneau.')}>
          <Table caption={t('Réservations')} rows={d.bookings} empty={t('Aucune réservation.')} columns={[{ key: 'place', label: t('Salle') }, { key: 'title', label: t('Objet') }, { key: 'user', label: t('Par') }, { key: 'when', label: t('Créneau'), render: (b) => `${dateFr(b.startAt.slice(0, 10))} ${b.startAt.slice(11)} → ${b.endAt.slice(11)}` },
            { key: 'a', label: '', render: (b) => (b.mine || perms.assets_manage ? <Button size="sm" variant="ghost" onClick={async () => { try { await api('DELETE', `/means/bookings/${b.id}`); toast(t('Réservation annulée.')); reload(); } catch (e) { fail(e); } }}>{t('Annuler')}</Button> : null) }]} />
        </Section>
      )}
      </View>
    </>
  );
}

// ---------- Fournitures ----------
export function Supplies() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { money, fail } = useWs();
  const form = useFormModal();
  return (
    <View path="/means/supplies">{(d) => (
      <>
        <Kpis><Stat icon="box-open" label={t('Fournitures')} value={d.summary.total} /><Stat icon="triangle-exclamation" label={t('Sous le seuil')} value={d.summary.low} tone={d.summary.low ? 'warn' : 'ok'} /><Stat icon="coins" label={t('Valeur en stock')} value={money(d.summary.value)} /></Kpis>
        <Section title={t('Fournitures de bureau et consommables')} actions={perms.assets_manage ? <Button variant="primary" icon="plus" onClick={() => form(t('Nouvelle fourniture'), [{ k: 'name', label: t('Nom'), required: true }, { k: 'unit', label: t('Unité'), value: 'pièce' }, { k: 'quantity', label: t('Quantité en stock'), value: '0' }, { k: 'minQuantity', label: t('Seuil d’alerte'), value: '0' }, { k: 'unitCost', label: t('Coût unitaire'), value: '0' }, { k: 'location', label: t('Emplacement') }], (v) => api('POST', '/means/supplies', { ...v, quantity: num(v.quantity) || 0, minQuantity: num(v.minQuantity) || 0, unitCost: num(v.unitCost) || 0 }))}>{t('Fourniture')}</Button> : null}>
          <Table caption={t('Fournitures')} rows={d.supplies} empty={t('Aucune fourniture.')} columns={[{ key: 'name', label: t('Nom'), render: (s) => <b>{s.name}</b> }, { key: 'q', label: t('Stock'), align: 'r', render: (s) => <>{s.quantity} {s.unit} {s.low ? <Badge tone="warn">{t('Bas')}</Badge> : null}</> }, { key: 'min', label: t('Seuil'), align: 'r', render: (s) => s.minQuantity }, { key: 'loc', label: t('Emplacement'), render: (s) => s.location }, { key: 'v', label: t('Valeur'), align: 'r', render: (s) => money(s.value) },
            { key: 'a', label: '', render: (s) => (perms.assets_manage ? <span className="row"><Button size="sm" onClick={() => form(`${t('Mouvement')} · ${s.name}`, [{ k: 'delta', label: t('Quantité (+ entrée, − sortie)'), required: true }], (v) => api('POST', `/means/supplies/${s.id}/move`, { delta: num(v.delta) }))}>{t('Entrée / sortie')}</Button><Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Supprimer')} onClick={async () => { try { await api('DELETE', `/means/supplies/${s.id}`); reload(); } catch (e) { fail(e); } }} /></span> : null) }]} />
        </Section>
      </>
    )}
    </View>
  );
}

// ---------- Demandes de moyens ----------
export function MeansRequests() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { dateFr, money, fail, toast } = useWs();
  const form = useFormModal();
  const KIND = { supply: t('Fourniture'), equipment: t('Équipement'), vehicle: t('Véhicule'), room: t('Salle'), maintenance: t('Maintenance'), other: t('Autre') };
  const ST = { new: t('Nouvelle'), approved: t('Acceptée'), rejected: t('Refusée'), fulfilled: t('Satisfaite'), cancelled: t('Annulée') };
  const supplies = useData('/means/supplies');
  return (
    <View path="/means/requests">{(d) => (
      <>
        <Kpis><Stat icon="inbox" label={t('Ouvertes')} value={d.summary.open} /><Stat icon="bell" label={t('Nouvelles')} value={d.summary.new} tone={d.summary.new ? 'warn' : 'ok'} /></Kpis>
        <Section title={t('Demandes de moyens')} subtitle={perms.assets_manage ? t('Toutes les demandes de l’équipe.') : t('Vos demandes.')}
          actions={<Button variant="primary" icon="plus" onClick={() => form(t('Nouvelle demande de moyens'), [{ k: 'kind', label: t('Type'), type: 'select', options: Object.entries(KIND) }, { k: 'title', label: t('Ce dont vous avez besoin'), required: true }, { k: 'quantity', label: t('Quantité'), value: '1' }, { k: 'needDate', label: t('Besoin pour le'), type: 'date' }, { k: 'estCost', label: t('Coût estimé'), value: '0' }, { k: 'detail', label: t('Détail'), type: 'textarea', rows: 3 }], (v) => api('POST', '/means/requests', { ...v, quantity: num(v.quantity) || 1, estCost: num(v.estCost) || 0, needDate: v.needDate || null }), { done: t('Demande envoyée.') })}>{t('Demander')}</Button>}>
          <Table caption={t('Demandes')} rows={d.requests} empty={t('Aucune demande.')} columns={[
            { key: 'title', label: t('Objet'), render: (r) => <><b>{r.title}</b><small>{r.detail}</small></> }, { key: 'kind', label: t('Type'), render: (r) => KIND[r.kind] }, { key: 'q', label: t('Qté'), align: 'r', render: (r) => r.quantity }, { key: 'requester', label: t('Demandeur') },
            { key: 'cost', label: t('Coût estimé'), align: 'r', render: (r) => (r.estCost ? money(r.estCost) : '—') }, { key: 'need', label: t('Pour le'), render: (r) => (r.needDate ? dateFr(r.needDate) : '—') }, { key: 'st', label: t('Statut'), render: (r) => <Pill k={r.status}>{ST[r.status]}</Pill> },
            { key: 'a', label: '', render: (r) => (perms.assets_manage && ['new', 'approved'].includes(r.status) ? <span className="row">
              {r.status === 'new' ? <Button size="sm" onClick={async () => { try { await api('POST', `/means/requests/${r.id}/decide`, { status: 'approved' }); reload(); } catch (e) { fail(e); } }}>{t('Accepter')}</Button> : null}
              <Button size="sm" variant="primary" onClick={() => form(t('Remise effectuée'), [...(r.kind === 'supply' ? [{ k: 'supplyId', label: t('Sortie de stock sur'), type: 'select', options: [['', t('— Aucune —')], ...(supplies.data ? supplies.data.supplies.map((s) => [String(s.id), `${s.name} (${s.quantity})`]) : [])] }] : []), { k: 'note', label: t('Note') }], (v) => api('POST', `/means/requests/${r.id}/decide`, { status: 'fulfilled', supplyId: toInt(v.supplyId), note: v.note }))}>{t('Satisfaite')}</Button>
              <Button size="sm" variant="danger-outline" onClick={() => form(t('Refuser la demande'), [{ k: 'note', label: t('Motif du refus'), required: true }], (v) => api('POST', `/means/requests/${r.id}/decide`, { status: 'rejected', note: v.note }))}>{t('Refuser')}</Button></span>
              : r.status === 'new' && !perms.assets_manage ? <Button size="sm" variant="ghost" onClick={async () => { try { await api('POST', `/means/requests/${r.id}/cancel`); toast(t('Demande annulée.')); reload(); } catch (e) { fail(e); } }}>{t('Annuler')}</Button> : null) },
          ]} />
        </Section>
      </>
    )}
    </View>
  );
}
