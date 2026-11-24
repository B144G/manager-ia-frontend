import { useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Loading, useLoad } from '../ui.jsx';

/* Équipe › Espaces par rôle : le propriétaire active les espaces, puis affecte à chaque personne un rôle fonctionnel et un niveau par espace. */

const LV = ['none', 'view', 'write', 'manage'];
const LV_LABEL = { none: 'Aucun accès', view: 'Visiteur (lecture seule)', write: "Membre de l'espace", manage: "Responsable de l'espace" };

export default function SpaceAdmin() {
  const { oapi, can, modal, confirm, fail, toast, reloadOrg, info } = useWs();
  const t = useT();
  const cfg = useLoad(() => oapi('GET', '/spaces/settings'), []);
  const asg = useLoad(() => oapi('GET', '/spaces/assignments'), []);
  const [busy, setBusy] = useState(false);
  const owner = can('owner');
  if (cfg.loading && !cfg.data) return <Loading />;
  if (!cfg.data) return null;
  const on = cfg.data.enabled;
  const set = (patch, msg) => { setBusy(true); oapi('PUT', '/spaces/settings', patch).then(() => { toast(msg || t('Réglage enregistré.')); cfg.reload(); asg.reload(); reloadOrg(); }).catch(fail).finally(() => setBusy(false)); };
  const toggle = () => (on
    ? confirm(t("Désactiver les espaces par rôle ? Tout le monde retrouve le menu général."), () => set({ enabled: false }), t('Désactiver'))
    : confirm(t("Réactiver les espaces par rôle ? Chaque personne retrouvera son espace. Une personne sans affectation garde ses accès actuels, regroupés par espace."), () => set({ enabled: true }), t('Activer')));
  const names = (ids) => (ids || []).map((id) => { const f = cfg.data.funcRoles.find((x) => x.id === id); return f ? tsrv(f.title) : id; }).join(', ');
  const edit = (m) => modal(t('Espaces de {name}', { name: m.name }), (close) => <AssignBox m={m} cfg={cfg.data} done={() => { close(); asg.reload(); }} />, { wide: true });
  return (
    <div className="ws-card" id="spaces-admin">
      <h2>{t('Espaces par rôle')}</h2>
      <p className="muted">{t("Chaque personne arrive dans son espace de travail (comptabilité, commercial, stock…) au lieu d'un menu général. Les autres espaces ne s'ouvrent qu'en consultation seule, selon ce que vous accordez.")}</p>
      {cfg.data.globalOff ? <p className="muted"><b>{t("Les espaces par rôle sont suspendus pour toutes les entreprises par un réglage du service.")}</b> {t("Ils reviendront automatiquement ; vos affectations sont conservées.")}</p> : null}
      <div className="line">
        <span><b>{on ? t('Activés') : t('Désactivés')}</b><small> {on ? t('Chaque personne voit son espace.') : t('Menu général habituel pour tout le monde.')}</small></span>
        {owner ? <button className={'btn small' + (on ? '' : ' primary')} type="button" disabled={busy} onClick={toggle}>{on ? t('Désactiver') : t('Réactiver les espaces par rôle')}</button> : <small>{t('Seul le propriétaire peut modifier ce réglage.')}</small>}
      </div>
      {on && owner ? (
        <label className="sp-check"><input type="checkbox" checked={cfg.data.openRead} disabled={busy} onChange={(e) => set({ openRead: e.target.checked })} /> {t('Consultation ouverte : chacun peut lire les autres espaces autorisés par son rôle (jamais les modifier)')}</label>
      ) : null}
      <h3>{t('Affectation des personnes')}</h3>
      {asg.loading && !asg.data ? <Loading /> : null}
      {asg.data ? asg.data.members.map((m) => (
        <div className="line" key={m.userId}>
          <span><b>{m.name}</b><small>{' ' + t(m.role === 'owner' ? 'Propriétaire' : m.role === 'admin' ? 'Administrateur' : m.role === 'manager' ? 'Responsable' : 'Membre') + (m.funcRoles.length ? ' · ' + names(m.funcRoles) : '')}</small>
            <small className="sp-sum">{m.fixed ? t('Tous les espaces') : Object.keys(m.effective).map((s) => { const sp = info.spaces && info.spaces.spaces.find((x) => x.id === s); return (sp ? tsrv(sp.title) : (cfg.data.catalogue.find((c) => c.id === s) || {}).title ? tsrv(cfg.data.catalogue.find((c) => c.id === s).title) : s) + ' (' + t(LV_LABEL[m.effective[s]]) + ')'; }).join(' · ')}</small></span>
          {m.fixed || !can('admin') ? null : <button className="link" type="button" onClick={() => edit(m)}>{t('Affecter')}</button>}
        </div>
      )) : null}
    </div>
  );
}

function AssignBox({ m, cfg, done }) {
  const { oapi, fail, toast } = useWs();
  const t = useT();
  const [funcs, setFuncs] = useState(m.funcRoles);
  const [lv, setLv] = useState(() => { const o = {}; for (const c of cfg.catalogue) o[c.id] = m.explicit[c.id] || (m.effective[c.id] && m.via[c.id] !== 'assigned' ? m.effective[c.id] : 'none'); return o; });
  const [busy, setBusy] = useState(false);
  const preset = (ids) => {
    const next = {}; for (const c of cfg.catalogue) next[c.id] = c.id === 'projets' ? 'write' : 'none';
    for (const id of ids) { const f = cfg.funcRoles.find((x) => x.id === id); if (f) for (const [sp, l] of Object.entries(f.preset)) if (LV.indexOf(l) > LV.indexOf(next[sp] || 'none')) next[sp] = l; }
    setLv(next);
  };
  const toggle = (id) => { const next = funcs.includes(id) ? funcs.filter((x) => x !== id) : [...funcs, id]; setFuncs(next); preset(next); };
  const save = () => {
    setBusy(true);
    const spaces = {}; for (const [k, v] of Object.entries(lv)) if (v !== 'none') spaces[k] = v;
    oapi('PUT', '/spaces/assignments/' + m.userId, { funcRoles: funcs, spaces }).then(() => { toast(t('Affectation enregistrée.')); done(); }).catch((e) => { setBusy(false); fail(e); });
  };
  return (
    <form className="sp-assign" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <fieldset><legend>{t('Rôle dans l\'entreprise (fonction)')}</legend>
        <p className="muted small">{t('Choisir une fonction propose les espaces habituels ; vous pouvez ensuite les ajuster.')}</p>
        <div className="sp-funcs">
          {cfg.funcRoles.map((f) => (
            <label key={f.id} className="sp-check"><input type="checkbox" checked={funcs.includes(f.id)} onChange={() => toggle(f.id)} /> <span><b>{tsrv(f.title)}</b><small>{tsrv(f.desc)}</small></span></label>
          ))}
        </div>
      </fieldset>
      <fieldset><legend>{t('Accès aux espaces')}</legend>
        {cfg.catalogue.map((c) => (
          <div className="line" key={c.id}>
            <label htmlFor={'sp-' + c.id}><b>{tsrv(c.title)}</b></label>
            <select id={'sp-' + c.id} value={lv[c.id]} onChange={(e) => setLv({ ...lv, [c.id]: e.target.value })}>
              {LV.map((l) => <option key={l} value={l}>{t(LV_LABEL[l])}</option>)}
            </select>
          </div>
        ))}
      </fieldset>
      <div className="row"><button className="btn primary" type="submit" disabled={busy}>{t('Enregistrer')}</button></div>
    </form>
  );
}
