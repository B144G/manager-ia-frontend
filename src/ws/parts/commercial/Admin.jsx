import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Alert, Button, Card, Field, Loading, Table, useLoad } from '../../ui.jsx';
import { Failed, MemberSelect, fmtDT, num, useCp, useForm, useL } from './common.jsx';

/* Zones et équipes, journal de traçabilité, réglages (poids des sources, seuils A/B/C, délais). Réservé à qui définit les règles. */

function NameForm({ pre, kind, close, onSaved }) {
  const t = useT();
  const { api } = useCp();
  const zone = kind === 'zone';
  const f = useForm({ name: pre ? pre.name : '', cities: pre ? pre.cities : '', leaderId: pre && pre.leaderId ? String(pre.leaderId) : '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.name.trim()) throw new Error(zone ? t('Indiquez le nom de la zone.') : t("Indiquez le nom de l'équipe."));
      const base = zone ? '/zones' : '/teams';
      const body = zone ? { name: f.v.name, cities: f.v.cities } : { name: f.v.name, leaderId: f.v.leaderId || null };
      if (pre) await api('PUT', base + '/' + pre.id, body); else await api('POST', base, body);
      close(); onSaved();
    }); }}>
      <Field label={t('Nom')} required>{(p) => <input {...p} type="text" maxLength={80} value={f.v.name} onChange={f.set('name')} />}</Field>
      {zone ? <Field label={t('Villes')} hint={t('Séparées par des virgules : sert à rattacher un prospect à sa zone.')}>{(p) => <input {...p} type="text" maxLength={400} value={f.v.cities} onChange={f.set('cities')} />}</Field>
        : <Field label={t("Chef d'équipe")}>{(p) => <MemberSelect {...p} value={f.v.leaderId} onChange={f.set('leaderId')} none={t('Aucun')} />}</Field>}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

export function ZonesTeams() {
  const t = useT();
  const { zones, teams, reloadTeam, api, fail, has, memberName } = useCp();
  const { modal, confirm } = useWs();
  const edit = has('rules');
  const form = (kind, pre) => modal(kind === 'zone' ? (pre ? t('Modifier la zone') : t('Nouvelle zone')) : (pre ? t("Modifier l'équipe") : t('Nouvelle équipe')), (close) => <NameForm kind={kind} pre={pre} close={close} onSaved={reloadTeam} />);
  const del = (base, id, q) => confirm(q, () => api('DELETE', base + '/' + id).then(reloadTeam, fail));
  return (
    <div className="cp-two">
      <Card title={t('Zones')} subtitle={t('Territoires commerciaux (par villes).')} actions={edit ? <Button variant="primary" icon="plus" onClick={() => form('zone')}>{t('Nouvelle zone')}</Button> : null}>
        {!zones.length ? <p className="muted">{t('Aucune zone.')}</p> : zones.map((z) => (
          <div className="line" key={z.id}><span><b>{z.name}</b><br /><small>{z.cities || t('Aucune ville')}</small></span>
            {edit ? <span className="row"><Button size="sm" onClick={() => form('zone', z)}>{t('Modifier')}</Button><Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer {nom}', { nom: z.name })} onClick={() => del('/zones', z.id, t('Supprimer cette zone ?'))} /></span> : null}</div>
        ))}
      </Card>
      <Card title={t('Équipes')} actions={edit ? <Button variant="primary" icon="plus" onClick={() => form('team')}>{t('Nouvelle équipe')}</Button> : null}>
        {!teams.length ? <p className="muted">{t('Aucune équipe.')}</p> : teams.map((x) => (
          <div className="line" key={x.id}><span><b>{x.name}</b><br /><small>{t('{n} membre(s)', { n: x.members })}{x.leaderId ? ' · ' + t('chef : {nom}', { nom: memberName(x.leaderId) }) : ''}</small></span>
            {edit ? <span className="row"><Button size="sm" onClick={() => form('team', x)}>{t('Modifier')}</Button><Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer {nom}', { nom: x.name })} onClick={() => del('/teams', x.id, t('Supprimer cette équipe ?'))} /></span> : null}</div>
        ))}
      </Card>
    </div>
  );
}

export function Audit() {
  const t = useT();
  const L = useL();
  const { api, tick } = useCp();
  const [filter, setFilter] = useState('');
  const st = useLoad(() => api('GET', '/audit?limit=300'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const q = filter.trim().toLowerCase();
  const rows = st.data.events.filter((e) => !q || `${e.user} ${e.entity} ${e.action} ${e.detail}`.toLowerCase().includes(q));
  return (
    <Card title={t('Journal de traçabilité')} subtitle={t('Qui a fait quoi : créations, changements de propriétaire, fusions, dépassements de règles.')}>
      <div className="cp-filters"><Field label={t('Filtrer')}>{(p) => <input {...p} type="search" value={filter} onChange={(e) => setFilter(e.target.value)} />}</Field></div>
      <Table caption={t('Journal de traçabilité')} columns={[
        { key: 'at', label: t('Date'), render: (e) => fmtDT(e.at) }, { key: 'user', label: t('Personne'), render: (e) => e.user || '—' }, { key: 'roleLabel', label: t('Rôle'), render: (e) => L.cRole[e.crole] || e.roleLabel },
        { key: 'entity', label: t('Objet'), render: (e) => (L.entity[e.entity] || e.entity) + (e.entityId ? ' #' + e.entityId : '') }, { key: 'action', label: t('Action') },
        { key: 'detail', label: t('Détail'), render: (e) => <span className="cp-detail">{e.detail}</span> },
      ]} rows={rows} empty={t('Aucun événement.')} />
    </Card>
  );
}

const GROUPS = ['sourceWeights', 'tempWeights', 'bantWeights', 'leadGrades'];
export function Settings() {
  const t = useT();
  const L = useL();
  const { api, has, tick } = useCp();
  const { toast } = useWs();
  const st = useLoad(() => api('GET', '/settings'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  return <SettingsForm key={JSON.stringify(st.data.settings)} data={st.data} edit={has('rules')} L={L} t={t} api={api} toast={toast} />;
}
function SettingsForm({ data, edit, L, t, api, toast }) {
  const f = useForm({});
  const [v, setV] = useState(() => JSON.parse(JSON.stringify(data.settings)));
  const GL = { sourceWeights: L.source, tempWeights: { chaud: L.temp.chaud, tiede: L.temp.tiede, froid: L.temp.froid }, bantWeights: { budget: t('Budget'), authority: t('Autorité'), need: t('Besoin'), timing: t('Délai') }, leadGrades: { A: t('Note A'), B: t('Note B'), C: t('Note C') } };
  const TITLE = { sourceWeights: t('Poids des sources de prospects (points de score)'), tempWeights: t("Poids de l'intérêt exprimé (points de score)"), bantWeights: t('Poids de chaque critère BANT'), leadGrades: t('Seuils des notes (score minimal)') };
  const setG = (g, k, val) => setV((s) => ({ ...s, [g]: { ...s[g], [k]: val } }));
  const save = (e) => {
    e.preventDefault();
    f.run(async () => {
      const g = v.leadGrades;
      if (!(num(g.A) > num(g.B) && num(g.B) > num(g.C))) throw new Error(t('Les seuils doivent décroître : A > B > C.'));
      const body = {};
      for (const [k, val] of Object.entries(v)) body[k] = typeof val === 'object' ? Object.fromEntries(Object.entries(val).map(([a, b]) => [a, num(b)])) : num(val);
      await api('PUT', '/settings', body);
      toast(t('Réglages enregistrés.'));
    });
  };
  return (
    <form className="cp-stack" noValidate onSubmit={save}>
      {!edit ? <Alert tone="info">{t('Seul le responsable commercial modifie ces réglages.')}</Alert> : null}
      {GROUPS.map((g) => (
        <Card key={g} title={TITLE[g]}>
          <div className="cp-grid">
            {Object.keys(data.defaults[g]).map((k) => (
              <Field key={k} label={GL[g][k] || k} hint={t('Par défaut : {n}', { n: data.defaults[g][k] })}>{(p) => <input {...p} type="text" inputMode="numeric" disabled={!edit} value={v[g][k] ?? ''} onChange={(e) => setG(g, k, e.target.value)} />}</Field>
            ))}
          </div>
        </Card>
      ))}
      <Card title={t('Délais')}>
        <div className="cp-grid">
          <Field label={t('Jours sans contact avant « prospect à relancer »')}>{(p) => <input {...p} type="text" inputMode="numeric" disabled={!edit} value={v.staleLeadDays} onChange={(e) => setV((s) => ({ ...s, staleLeadDays: e.target.value }))} />}</Field>
          <Field label={t('Mois d’achats pris en compte (segmentation)')}>{(p) => <input {...p} type="text" inputMode="numeric" disabled={!edit} value={v.rfmWindowMonths} onChange={(e) => setV((s) => ({ ...s, rfmWindowMonths: e.target.value }))} />}</Field>
          <Field label={t('Jours de stagnation par défaut')}>{(p) => <input {...p} type="text" inputMode="numeric" disabled={!edit} value={v.defaultStagnantDays} onChange={(e) => setV((s) => ({ ...s, defaultStagnantDays: e.target.value }))} />}</Field>
        </div>
      </Card>
      <p className="ws-err" role="alert">{f.err ? tsrv(f.err) : ''}</p>
      {edit ? <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button><Button type="button" onClick={() => setV(JSON.parse(JSON.stringify(data.defaults)))}>{t('Remettre les valeurs par défaut')}</Button></div> : null}
    </form>
  );
}
