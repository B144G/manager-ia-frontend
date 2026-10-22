import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Loading, useLoad } from '../../ui.jsx';
import { BTN, Check, INP, TAP, WRAP } from '../finance/util.jsx';

/* Paramètres de paie : barème (retenues et charges, taux en %, plafond), modèle de pays (point de départ à compléter, jamais officiel),
   heures supplémentaires (paliers de majoration), comptabilisation automatique. */
const toRow = (r) => ({ kind: r.kind, target: r.target || 'social', label: r.label, rate: r.todo ? '' : String(r.rate), ceiling: r.ceiling ? String(r.ceiling) : '', todo: Boolean(r.todo) });

export default function Settings({ onSaved }) {
  const { oapi, toast, fail, info, confirm } = useWs();
  const [rules, setRules] = useState([]);
  const [opt, setOpt] = useState({ autoAccount: false, monthlyHours: '173.33', tiers: [], ratesAsOf: '', templateId: '' });
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const st = useLoad(() => oapi('GET', '/payroll/settings').then((j) => {
    setRules(j.rules.map(toRow));
    setOpt({ autoAccount: j.options.autoAccount, monthlyHours: String(j.options.monthlyHours), tiers: j.options.tiers.map((t) => ({ label: t.label, rate: String(t.rate) })), ratesAsOf: j.options.ratesAsOf || '', templateId: j.options.templateId || '' });
    return j;
  }), []);
  const tp = useLoad(() => oapi('GET', '/payroll/templates'), []);
  const set = (i, k, v) => setRules((l) => l.map((r, j) => (j === i ? { ...r, [k]: v, ...(k === 'rate' ? { todo: false } : {}) } : r)));
  const setTier = (i, k, v) => setOpt((o) => ({ ...o, tiers: o.tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const save = () => {
    setBusy(true);
    oapi('PUT', '/payroll/settings', {
      rules: rules.map((r) => ({ kind: r.kind, target: r.target, label: r.label, rate: r.rate, ceiling: r.ceiling, todo: r.todo && r.rate === '' })),
      options: { autoAccount: opt.autoAccount, monthlyHours: opt.monthlyHours, tiers: opt.tiers, ratesAsOf: opt.ratesAsOf, templateId: opt.templateId },
    }).then((r) => { toast(r.incomplete.length ? 'Enregistré. À compléter : ' + r.incomplete.join(' ') : 'Paramètres enregistrés.'); st.reload(); if (onSaved) onSaved(); }).catch(fail).finally(() => setBusy(false));
  };
  const apply = () => {
    const t = tp.data.templates.find((x) => x.id === pick);
    if (!t) return;
    confirm('Remplacer vos lignes actuelles par le modèle « ' + t.country + ' » ? Il ne contient aucun taux : vous devrez les compléter. Rien n\'est enregistré avant de cliquer sur Enregistrer.', () => {
      setRules(t.rules.map(toRow));
      setOpt((o) => ({ ...o, templateId: t.id, ratesAsOf: '' }));
    }, 'Appliquer le modèle');
  };
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  const cur = info.org.currency;
  const todo = rules.filter((r) => r.todo && r.rate === '').length;
  const tpl = tp.data && tp.data.templates.find((x) => x.id === opt.templateId);
  return (
    <>
      <div className="ws-card">
        <h2>Modèle de pays (point de départ)</h2>
        <p className="small" role="note"><b>À vérifier auprès de votre administration.</b>{' ' + (tp.data ? tp.data.warning : '')}</p>
        {tp.data ? (
          <div style={WRAP}>
            <label className="fld" style={{ flex: '1 1 200px', minWidth: 0 }}><span>Pays</span>
              <select style={INP} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Choisir un pays…</option>{tp.data.templates.map((t) => <option key={t.id} value={t.id}>{t.country}</option>)}</select>
            </label>
            <button className="btn small" type="button" style={BTN} disabled={!pick} onClick={apply}>Utiliser ce modèle</button>
          </div>
        ) : null}
        {tpl ? <p className="small">{'Modèle en cours : ' + tpl.country + (tpl.socialBody ? ' (organisme social habituel : ' + tpl.socialBody + ', à confirmer)' : '') + '.'}</p> : null}
        {opt.templateId ? (
          <label className="fld"><span>Barème à jour au (date à confirmer par vous)</span>
            <input style={INP} type="date" value={opt.ratesAsOf} onChange={(e) => setOpt((o) => ({ ...o, ratesAsOf: e.target.value }))} />
            <small>Indiquez la date à laquelle vous avez vérifié les taux auprès de l'administration ou de votre expert.</small>
          </label>
        ) : null}
        {st.data.incomplete.length ? <p className="small late" role="alert">{'À compléter : ' + st.data.incomplete.join(' ')}</p> : null}
      </div>
      <div className="ws-card">
        <h2>Retenues et charges</h2>
        <p className="small" role="note"><b>{st.data.disclaimer}</b></p>
        {st.data.isDefault ? <p className="small late">Ces lignes sont un exemple de départ : modifiez-les puis enregistrez pour les adopter.</p> : null}
        {todo ? <p className="small late">{todo + ' ligne(s) sans taux : à compléter (une ligne sans taux compte pour 0 %).'}</p> : null}
        {!rules.length ? <p className="ws-empty">Aucune ligne : les bulletins n'auront aucune retenue ni charge.</p> : null}
        {rules.map((r, i) => (
          <div className="ws-form" key={i} style={{ gridTemplateColumns: 'minmax(0, 1fr)', borderBottom: '1px solid var(--line)', paddingBottom: 10, marginBottom: 10 }}>
            <label className="fld"><span>Nom de la ligne</span><input style={INP} value={r.label} maxLength={100} onChange={(e) => set(i, 'label', e.target.value)} /></label>
            <div style={WRAP}>
              <label className="fld" style={{ flex: '1 1 200px', minWidth: 0 }}><span>Type</span>
                <select style={INP} value={r.kind} onChange={(e) => set(i, 'kind', e.target.value)}><option value="employee">Retenue sur le salaire</option><option value="employer">Charge patronale</option></select>
              </label>
              <label className="fld" style={{ flex: '1 1 200px', minWidth: 0 }}><span>Nature (comptabilité)</span>
                <select style={INP} value={r.target} onChange={(e) => set(i, 'target', e.target.value)}><option value="social">Organisme social</option><option value="tax">Impôt ou taxe</option></select>
              </label>
              <label className="fld" style={{ flex: '0 1 120px', minWidth: 0 }}><span>Taux (%)</span><input style={INP} inputMode="decimal" placeholder={r.todo ? 'À compléter' : ''} value={r.rate} onChange={(e) => set(i, 'rate', e.target.value)} /></label>
              <label className="fld" style={{ flex: '1 1 150px', minWidth: 0 }}><span>{'Plafond mensuel (' + cur + ')'}</span><input style={INP} inputMode="numeric" placeholder="Aucun" value={r.ceiling} onChange={(e) => set(i, 'ceiling', e.target.value)} /></label>
              <button className="link" type="button" style={TAP} onClick={() => setRules((l) => l.filter((_, j) => j !== i))}>Retirer</button>
            </div>
          </div>
        ))}
        <div className="row">
          <button className="btn small" type="button" style={BTN} disabled={rules.length >= 30} onClick={() => setRules((l) => l.concat([{ kind: 'employee', target: 'social', label: '', rate: '0', ceiling: '', todo: false }]))}>Ajouter une ligne</button>
        </div>
        <p className="muted small">Le taux s'applique au salaire brut (base + primes + heures supplémentaires + 13e mois), limité au plafond s'il est indiqué. Les bulletins validés ne changent jamais ; les brouillons utilisent les paramètres au moment où vous les modifiez.</p>
      </div>
      <div className="ws-card">
        <h2>Heures supplémentaires</h2>
        <p className="muted small">Chaque palier est une majoration du taux horaire (ex. +25 %, +50 %). Les paliers proposés sont des exemples : adaptez-les à votre pays et à votre convention collective.</p>
        {opt.tiers.map((t, i) => (
          <div key={i} style={WRAP}>
            <label className="fld" style={{ flex: '1 1 180px', minWidth: 0 }}><span>Nom du palier</span><input style={INP} maxLength={60} value={t.label} onChange={(e) => setTier(i, 'label', e.target.value)} /></label>
            <label className="fld" style={{ flex: '0 1 120px', minWidth: 0 }}><span>Majoration (%)</span><input style={INP} inputMode="decimal" value={t.rate} onChange={(e) => setTier(i, 'rate', e.target.value)} /></label>
            <button className="link" type="button" style={TAP} onClick={() => setOpt((o) => ({ ...o, tiers: o.tiers.filter((_, j) => j !== i) }))}>Retirer</button>
          </div>
        ))}
        <div className="row"><button className="btn small" type="button" style={BTN} disabled={opt.tiers.length >= 8} onClick={() => setOpt((o) => ({ ...o, tiers: o.tiers.concat([{ label: 'Nouveau palier', rate: '0' }]) }))}>Ajouter un palier</button></div>
        <label className="fld"><span>Heures de travail par mois (pour le taux horaire calculé)</span><input style={INP} inputMode="decimal" value={opt.monthlyHours} onChange={(e) => setOpt((o) => ({ ...o, monthlyHours: e.target.value }))} /><small>Exemple : 173,33 h (40 h par semaine). À adapter à votre entreprise.</small></label>
      </div>
      <div className="ws-card">
        <h2>Comptabilité</h2>
        <Check checked={opt.autoAccount} onChange={(v) => setOpt((o) => ({ ...o, autoAccount: v }))} label="Comptabiliser automatiquement"
          hint="À la validation d'un bulletin, une écriture est créée dans la Comptabilité (charges de personnel, organismes sociaux, impôts retenus, personnel) ; au paiement, une écriture banque, caisse ou mobile money. Désactivé par défaut." />
        <p className="muted small">Une seule écriture par événement. Si la période comptable est clôturée, la validation réussit mais l'écriture est refusée : vous le verrez sur le bulletin.</p>
      </div>
      <div className="row"><button className="btn primary" type="button" style={BTN} disabled={busy} onClick={save}>Enregistrer les paramètres</button></div>
    </>
  );
}
