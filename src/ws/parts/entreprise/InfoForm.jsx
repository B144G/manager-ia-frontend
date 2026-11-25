import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Button } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';

/* Informations propres de l'entreprise. Les identifiants légaux sont facultatifs : MABAH n'en propose, n'en devine et n'en invente jamais. */
export default function InfoForm({ ov, onSaved, wizard }) {
  const { oapi, can, fail, toast } = useWs();
  const t = useT();
  const e = ov.entreprise;
  const edit = can('admin');
  const [v, setV] = useState({ name: e.name || '', sector: e.sector || '', country: e.country || '', currency: e.currency || 'FCFA', city: e.city || '', address: e.address || '', size: e.size || '', phone: e.phone || '', email: e.email || '', website: e.website || '', legalForm: e.legalForm || '', rccm: e.rccm || '', niu: e.niu || '', vatNumber: e.vatNumber || '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const save = async (ev) => {
    ev.preventDefault();
    if (!v.name.trim()) { setErr(t('Indiquez la raison sociale.')); return; }
    setBusy(true); setErr('');
    try {
      await oapi('PUT', '/entreprise/info', v);
      // Secteur choisi pour la première fois : on prépare départements et postes adaptés (modifiables ensuite).
      if (v.sector && !ov.setup.template) await oapi('POST', '/entreprise/template', { sector: v.sector });
      toast(t('Informations enregistrées.'));
      onSaved();
    } catch (x) { setErr(tsrv(x.message)); if (x.status === 401) fail(x); }
    setBusy(false);
  };
  const tx = (k, label, extra = {}) => <label className="fld"><span>{label}{extra.opt ? <small> ({t('facultatif')})</small> : null}</span><input type={extra.type || 'text'} value={v[k]} disabled={!edit} onChange={(ev) => set(k, ev.target.value)} placeholder={extra.ph || ''} /></label>;
  const sel = ov.sectors.find((s) => s.id === v.sector);
  return (
    <form className="ws-form ent-info" noValidate onSubmit={save}>
      {tx('name', t('Raison sociale'))}
      <label className="fld"><span>{t("Secteur d'activité")}</span>
        <select value={v.sector} disabled={!edit} onChange={(ev) => set('sector', ev.target.value)}>
          <option value="">{t('À choisir')}</option>
          {ov.sectors.map((s) => <option key={s.id} value={s.id}>{tsrv(s.title)}</option>)}
        </select>
        <small>{sel ? tsrv(sel.desc) : t('Le secteur prépare les départements et postes adaptés à votre activité (modifiables ensuite).')}</small></label>
      <div className="ent-two">{tx('country', t('Pays'))}{tx('currency', t('Devise'))}</div>
      <div className="ent-two">{tx('city', t('Ville'))}{tx('address', t('Adresse'), { opt: true })}</div>
      <label className="fld"><span>{t("Taille de l'entreprise")}</span>
        <select value={v.size} disabled={!edit} onChange={(ev) => set('size', ev.target.value)}>
          <option value="">{t('Non précisée')}</option>
          {ov.sizes.map((s) => <option key={s} value={s}>{s === '200+' ? t('Plus de 200 personnes') : t('{n} personnes', { n: s })}</option>)}
        </select></label>
      <div className="ent-two">{tx('phone', t('Téléphone'), { opt: true })}{tx('email', t('E-mail de contact'), { opt: true, type: 'email' })}</div>
      {tx('website', t('Site web'), { opt: true })}
      <fieldset className="ent-legal">
        <legend>{t('Identifiants légaux')} <small>({t('facultatifs')})</small></legend>
        <p className="muted small">{t("Renseignez-les seulement si vous les avez sous la main : ils ne sont jamais obligatoires et MABAH ne les complète pas à votre place.")}</p>
        {tx('legalForm', t('Forme juridique'), { opt: true, ph: 'SARL, SA, entreprise individuelle…' })}
        <div className="ent-two">{tx('rccm', t('N° RCCM'), { opt: true })}{tx('niu', t('N° d’identifiant unique (NIU)'), { opt: true })}</div>
        {tx('vatNumber', t('N° de TVA'), { opt: true })}
      </fieldset>
      <p className="ws-err" role="alert">{err}</p>
      {edit ? <div className="row"><Button variant="primary" type="submit" loading={busy}>{wizard ? t('Enregistrer et continuer') : t('Enregistrer')}</Button></div> : <p className="muted small">{t('Seuls les administrateurs modifient ces informations.')}</p>}
    </form>
  );
}
