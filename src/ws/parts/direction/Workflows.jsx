import { useState } from 'react';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, Card, Loaded, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';

const DIRS = { dtech: 'Direction technique', daf: 'Direction administrative et financière', dstock: 'Direction du stockage et des achats', drh: 'Direction des ressources humaines', dcom: 'Direction commerciale', dprod: 'Direction de la production', dlog: 'Direction de la logistique', dit: 'Direction informatique et maintenance', dsec: 'Direction de la sécurité', dmkt: 'Direction marketing' };
const who = (a) => (a.type === 'dg' ? 'Direction générale' : a.type === 'direction' ? DIRS[a.key] : a.role === 'owner' ? 'Propriétaire' : 'Administrateur');

/* Entreprise › Circuits de validation : les opérations de la spécification (achat, budget, commande, recrutement, paiement, marché, réception, clôture), leurs validateurs et leurs seuils.
   Ce sont des circuits du moteur d'Administration : séparation des tâches (on ne valide pas sa propre demande), délégations, journal. */
export default function Workflows() {
  const { oapi, orgId, modal, fail, toast, confirm } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/entreprise/workflows'), [orgId]);
  const install = (keys) => oapi('POST', '/entreprise/workflows/install', { keys }).then(() => { toast(t('Circuits installés.')); st.reload(); }).catch(fail);
  return (
    <Loaded state={st}>{(j) => (
      <Card title={t('Circuits de validation')} subtitle={t("Chaque opération a un initiateur et un validateur : jamais la même personne. Les circuits sont ceux du moteur d'Administration (délégations, intérim, escalade, journal).")}
        actions={j.can.manage ? <Button variant="primary" icon="circle-check" onClick={() => confirm(t("Installer ou mettre à jour les 8 circuits de validation de direction ?"), () => install(), t('Installer'))}>{t('Installer les circuits')}</Button> : null}>
        <ul className="ent-list">{(j.workflows || []).map((w) => (
          <li className="ent-person" key={w.key}>
            <div className="ent-person-h"><div><b>{tsrv(w.label)}</b><div className="muted small">{tsrv(w.desc)}</div></div><Badge tone={w.installed ? 'ok' : 'neutral'}>{w.installed ? t('En service') : t('Non installé')}</Badge></div>
            <div className="muted small">{t('Initiateur : {i}', { i: tsrv(w.initiator) })}</div>
            <ol className="ent-steps-list">{w.steps.map((s, i) => <li key={i}><b>{tsrv(s.name)}</b> → {tsrv(who(s.approver))}{s.minAmount ? ' · ' + t('à partir de {n}', { n: s.minAmount.toLocaleString(getLocale()) }) : ''}{s.maxAmount ? ' · ' + t("jusqu'à {n}", { n: s.maxAmount.toLocaleString(getLocale()) }) : ''}</li>)}</ol>
            {j.can.manage ? <div className="ent-actions"><Button size="sm" icon="pen" onClick={() => modal(t('Régler : {w}', { w: tsrv(w.label) }), (close) => <Edit w={w} dirs={j.directions} done={() => { close(); st.reload(); }} />, { wide: true })}>{t('Régler')}</Button></div> : null}
          </li>
        ))}</ul>
      </Card>
    )}</Loaded>
  );
}

function Edit({ w, dirs, done }) {
  const { oapi, fail, toast } = useWs();
  const t = useT();
  const [steps, setSteps] = useState(() => JSON.parse(JSON.stringify(w.steps)));
  const [busy, setBusy] = useState(false);
  const set = (i, patch) => setSteps((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const val = (a) => (a.type === 'dg' ? 'dg' : a.type === 'direction' ? 'd:' + a.key : 'r:' + (a.role || 'admin'));
  const parse = (v) => (v === 'dg' ? { type: 'dg' } : v.startsWith('d:') ? { type: 'direction', key: v.slice(2) } : { type: 'role', role: v.slice(2) });
  return (
    <div className="ws-form">
      {steps.map((s, i) => (
        <fieldset className="ent-legal" key={i}><legend>{t('Étape {n}', { n: i + 1 })}</legend>
          <label className="fld"><span>{t('Nom')}</span><input value={s.name} onChange={(e) => set(i, { name: e.target.value })} /></label>
          <label className="fld"><span>{t('Validateur')}</span>
            <select value={val(s.approver)} onChange={(e) => set(i, { approver: parse(e.target.value) })}>
              <option value="dg">{t('Direction générale')}</option>
              {dirs.map((d) => <option key={d} value={'d:' + d}>{tsrv(DIRS[d])}</option>)}
              <option value="r:admin">{t('Administrateur')}</option><option value="r:owner">{t('Propriétaire')}</option>
            </select></label>
          <div className="ent-two"><label className="fld"><span>{t('À partir du montant')}</span><input inputMode="numeric" value={s.minAmount || ''} onChange={(e) => set(i, { minAmount: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
            <label className="fld"><span>{t("Jusqu'au montant")} <small>({t('facultatif')})</small></span><input inputMode="numeric" value={s.maxAmount || ''} onChange={(e) => set(i, { maxAmount: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label></div>
          {steps.length > 1 ? <Button size="sm" variant="ghost" icon="trash" onClick={() => setSteps((x) => x.filter((_, k) => k !== i))}>{t("Retirer l'étape")}</Button> : null}
        </fieldset>
      ))}
      {steps.length < 4 ? <div className="row"><Button icon="plus" onClick={() => setSteps((x) => [...x, { name: t('Direction générale'), approver: { type: 'dg' }, minAmount: 0, maxAmount: 0 }])}>{t('Ajouter une étape')}</Button></div> : null}
      <p className="muted small">{t("Une étape ne s'applique que dans sa fourchette de montants (sans montant, toujours). Les demandes déjà en cours gardent leurs étapes.")}</p>
      <div className="row"><Button variant="primary" loading={busy} onClick={() => { setBusy(true); oapi('PUT', `/entreprise/workflows/${w.key}`, { steps }).then(() => { toast(t('Circuit enregistré.')); done(); }).catch(fail).finally(() => setBusy(false)); }}>{t('Enregistrer')}</Button></div>
    </div>
  );
}

/** « Mes demandes » : les opérations que mon poste peut lancer ; la demande part vers le validateur du circuit. */
export function StartCard() {
  const { oapi, orgId, modal, toast } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/entreprise/workflows'), [orgId]);
  return (
    <Loaded state={st}>{(j) => (j.mine || []).length === 0 ? null : (
      <section className="ws-card ent-block">
        <h2>{t('Lancer une demande de validation')}</h2>
        <div className="ent-holders">{j.mine.map((w) => <Button key={w.key} icon="circle-check" onClick={() => modal(tsrv(w.label), (close) => <StartForm w={w} done={() => { close(); toast(t('Demande envoyée pour validation.')); }} />)}>{tsrv(w.label)}</Button>)}</div>
        <p className="muted small">{t("Vous ne validez jamais votre propre demande : elle part vers le validateur prévu par l'entreprise.")}</p>
      </section>
    )}</Loaded>
  );
}
function StartForm({ w, done }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const [v, setV] = useState({ title: '', amount: '', detail: '' });
  const [busy, setBusy] = useState(false);
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); setBusy(true); oapi('POST', `/entreprise/workflows/${w.key}/request`, { title: v.title, amount: v.amount, detail: v.detail }).then(done).catch(fail).finally(() => setBusy(false)); }}>
      <p className="muted">{tsrv(w.desc)}</p>
      <label className="fld"><span>{t('Objet de la demande')}</span><input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus /></label>
      <label className="fld"><span>{t('Montant')} <small>({t('facultatif')})</small></span><input inputMode="numeric" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></label>
      <label className="fld"><span>{t('Précisions')} <small>({t('facultatif')})</small></span><textarea rows={4} value={v.detail} onChange={(e) => setV({ ...v, detail: e.target.value })} /></label>
      <div className="row"><Button variant="primary" type="submit" loading={busy}>{t('Envoyer pour validation')}</Button></div>
    </form>
  );
}
