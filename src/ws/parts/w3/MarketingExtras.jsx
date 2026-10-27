import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { BTN, Crud, SettingsCard } from './common.jsx';
import { WorkNotice } from '../finance/util.jsx';

/* Marketing · vague 3 : consentement, segments, envoi groupé (e-mail / WhatsApp) avec quotas, codes promo. */

export function Audience() {
  const t = useT();
  const { oapi, toast, fail, modal } = useWs();
  const [f, setF] = useState({ stage: '', hasEmail: true, hasPhone: false, inactiveDays: '', minInvoiced: '', consentOnly: true });
  const [prev, setPrev] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [pick, setPick] = useState({});
  const [v, setV] = useState(0);
  const seg = useLoad(() => oapi('GET', '/marketing/segments'), [v]);
  useEffect(() => { oapi('GET', '/crm/customers').then((j) => setCustomers(j.customers), () => {}); }, [oapi, v]);
  const filter = { stage: f.stage, hasEmail: f.hasEmail, hasPhone: f.hasPhone, inactiveDays: Number(f.inactiveDays) || 0, minInvoiced: Number(f.minInvoiced) || 0, consentOnly: f.consentOnly };
  const preview = () => oapi('POST', '/marketing/segments/preview', { filter }).then(setPrev).catch(fail);
  const ids = Object.keys(pick).filter((k) => pick[k]).map(Number);
  const consent = (grant) => oapi('POST', '/marketing/consent', { customerIds: ids, consent: grant, confirm: grant, source: grant ? t('Accord recueilli par un membre de l’équipe') : '' }).then((r) => { toast(t('{n} client(s) mis à jour.', { n: r.updated })); setPick({}); setV((n) => n + 1); }).catch(fail);
  const saveSeg = () => modal(t('Enregistrer le segment'), (close) => <NameForm label={t('Nom du segment')} onSave={(name) => oapi('POST', '/marketing/segments', { name, filter }).then(() => { close(); setV((n) => n + 1); })} />);
  return (
    <>
      <WorkNotice>{t('Aucun envoi groupé sans consentement enregistré du client. Chaque e-mail contient un lien de désinscription ; les clients qui ont écrit « STOP » sur WhatsApp sont exclus.')}</WorkNotice>
      <div className="ws-card">
        <h2>{t('Segment de clients')}</h2>
        <div className="ws-form">
          <label className="fld"><span>{t('Statut')}</span><select style={{ fontSize: 16 }} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}><option value="">{t('Tous')}</option><option value="client">{t('Clients')}</option><option value="prospect">{t('Prospects')}</option></select></label>
          <label className="fld"><span>{t('Sans achat depuis (jours)')}</span><input style={{ fontSize: 16 }} inputMode="numeric" value={f.inactiveDays} onChange={(e) => setF({ ...f, inactiveDays: e.target.value })} /></label>
          <label className="fld"><span>{t('Total facturé au moins')}</span><input style={{ fontSize: 16 }} inputMode="numeric" value={f.minInvoiced} onChange={(e) => setF({ ...f, minInvoiced: e.target.value })} /></label>
          {[['hasEmail', t('Avec adresse e-mail')], ['hasPhone', t('Avec téléphone')], ['consentOnly', t('Avec consentement seulement')]].map(([k, l]) => <label key={k} style={{ display: 'flex', gap: 8, minHeight: 44, alignItems: 'center' }}><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} style={{ width: 24, height: 24 }} />{l}</label>)}
        </div>
        <div className="row"><button className="btn small" type="button" style={BTN} onClick={preview}>{t('Voir le résultat')}</button><button className="btn small" type="button" style={BTN} onClick={saveSeg}>{t('Enregistrer ce segment')}</button><button className="btn primary small" type="button" style={BTN} onClick={() => modal(t('Envoi groupé'), (close) => <Broadcast filter={filter} close={close} done={() => setV((n) => n + 1)} />, { wide: true })}>{t('Préparer un envoi')}</button></div>
        {prev ? <p className="small">{t('{n} client(s) dans ce segment, dont {c} avec consentement, {e} avec e-mail, {p} avec téléphone.', { n: prev.count, c: prev.withConsent, e: prev.withEmail, p: prev.withPhone }) + (prev.sample.length ? ' ' + prev.sample.join(', ') : '')}</p> : null}
        <Loaded state={seg}>{(j) => (j.items.length ? <><h3>{t('Segments enregistrés')}</h3>{j.items.map((s) => <div className="line" key={s.id}><span><b>{s.name}</b><br /><small className="muted">{t('{n} client(s), {c} avec consentement', { n: s.count, c: s.withConsent })}</small></span><button className="link" type="button" style={BTN} onClick={() => oapi('DELETE', '/marketing/segments/' + s.id).then(() => setV((n) => n + 1)).catch(fail)}>{t('Supprimer')}</button></div>)}</> : null)}</Loaded>
      </div>
      <div className="ws-card">
        <h2>{t('Consentement des clients')}</h2>
        <p className="muted small">{t('Cochez les clients, puis enregistrez leur accord (recueilli par écrit, en boutique ou par message) ou son retrait.')}</p>
        {!customers.length ? <Empty text={t('Aucun client.')} /> : null}
        {customers.slice(0, 80).map((c) => (
          <label className="line" key={c.id} style={{ minHeight: 44, cursor: 'pointer' }}>
            <span><input type="checkbox" checked={Boolean(pick[c.id])} onChange={(e) => setPick({ ...pick, [c.id]: e.target.checked })} style={{ width: 24, height: 24, marginRight: 8 }} /><b>{c.name}</b> <small className="muted">{[c.email, c.phone].filter(Boolean).join(' · ')}</small></span>
          </label>
        ))}
        <div className="row"><button className="btn primary small" type="button" style={BTN} disabled={!ids.length} onClick={() => consent(true)}>{t('Enregistrer leur accord')}</button><button className="btn small" type="button" style={BTN} disabled={!ids.length} onClick={() => consent(false)}>{t('Retirer le consentement')}</button></div>
      </div>
    </>
  );
}

function NameForm({ label, onSave }) {
  const t = useT();
  const [v, setV] = useState('');
  return <div className="ws-form"><label className="fld"><span>{label}</span><input style={{ fontSize: 16 }} value={v} onChange={(e) => setV(e.target.value)} /></label><button className="btn primary" type="button" disabled={!v.trim()} onClick={() => onSave(v)}>{t('Enregistrer')}</button></div>;
}

function Broadcast({ filter, close, done }) {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const [b, setB] = useState({ name: '', channel: 'email', subject: '', body: '', templateId: '' });
  const [tpls, setTpls] = useState([]);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { oapi('GET', '/sales/wa').then((j) => setTpls((j.templates || []).filter((x) => x.purpose === 'general')), () => {}); }, [oapi]);
  const body = () => ({ ...b, filter, templateId: b.templateId || undefined, subject: b.channel === 'email' ? b.subject : undefined });
  const preview = () => oapi('POST', '/marketing/broadcasts', { ...body(), preview: true }).then(setPlan).catch(fail);
  const send = () => { setBusy(true); oapi('POST', '/marketing/broadcasts', body()).then((r) => { toast(t('{n} message(s) envoyé(s).', { n: r.sent })); close(); done(); }).catch((e) => { setBusy(false); fail(e); }); };
  return (
    <div className="ws-form">
      <label className="fld"><span>{t("Nom de l'envoi")}</span><input style={{ fontSize: 16 }} value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></label>
      <label className="fld"><span>{t('Canal')}</span><select style={{ fontSize: 16 }} value={b.channel} onChange={(e) => setB({ ...b, channel: e.target.value })}><option value="email">{t('E-mail')}</option><option value="whatsapp">{t('WhatsApp (modèle approuvé)')}</option></select></label>
      {b.channel === 'email' ? <label className="fld"><span>{t('Objet')}</span><input style={{ fontSize: 16 }} value={b.subject} onChange={(e) => setB({ ...b, subject: e.target.value })} /></label> : (
        <label className="fld"><span>{t('Modèle WhatsApp')}</span><select style={{ fontSize: 16 }} value={b.templateId} onChange={(e) => setB({ ...b, templateId: e.target.value })}><option value="">{t('Choisir…')}</option>{tpls.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      )}
      <label className="fld"><span>{t('Message')}</span><textarea rows={5} style={{ fontSize: 16 }} value={b.body} onChange={(e) => setB({ ...b, body: e.target.value })} /><small>{t('{nom} est remplacé par le prénom du client.')}</small></label>
      {plan ? <p className="small">{t('{r} destinataire(s) ; {c} sans consentement, {a} sans adresse, {o} au-delà du quota du jour (reste {q}).', { r: plan.recipients, c: plan.noConsent, a: plan.noAddress, o: plan.overQuota, q: plan.quotaLeft })}</p> : null}
      <div className="row"><button className="btn small" type="button" style={BTN} onClick={preview}>{t('Vérifier les destinataires')}</button><button className="btn primary small" type="button" style={BTN} disabled={busy || !plan || !plan.recipients || !b.name || !b.body} onClick={send}>{t('Envoyer')}</button></div>
      {void tsrv}
    </div>
  );
}

export function Broadcasts() {
  const t = useT();
  const { oapi, dateFr, can } = useWs();
  const st = useLoad(() => oapi('GET', '/marketing/broadcasts'), []);
  return (
    <>
      <div className="ws-card">
        <h2>{t('Envois groupés')}</h2>
        <Loaded state={st}>{(j) => (
          <>
            <p className="muted small">{t("Messages envoyés aujourd'hui : {n}.", { n: j.quotaToday })}</p>
            {!j.items.length ? <Empty text={t('Aucun envoi pour le moment.')} /> : null}
            {j.items.map((x) => <div className="line" key={x.id}><span><b>{x.name}</b><br /><small className="muted">{x.channel + ' · ' + dateFr(x.at)}</small></span><span>{t('{s} envoyé(s) · {f} échec(s) · {k} ignoré(s)', { s: x.sent, f: x.failed, k: x.skipped })}</span></div>)}
          </>
        )}
        </Loaded>
      </div>
      <SettingsCard path="/marketing" canEdit={can('admin')} title={t('Quota d’envois')} keys={[['mkt_day_quota', t('Messages groupés par jour au maximum')]]} />
    </>
  );
}

export function Promo() {
  const t = useT();
  const { dateFr } = useWs();
  return (
    <Crud path="/marketing/promo" title={t('Codes promo')} addLabel={t('Nouveau code')} empty={t('Aucun code promo.')}
      intro={t('Un code s’applique à un devis ou une facture en brouillon (Clients et ventes) : une ligne « Remise » est ajoutée et les totaux sont recalculés.')}
      fields={[{ k: 'code', label: t('Code'), required: true }, { k: 'kind', label: t('Type'), type: 'select', options: [['percent', t('Pourcentage')], ['amount', t('Montant fixe')]] }, { k: 'value', label: t('Valeur'), required: true, type: 'number' },
        { k: 'starts', label: t('Début'), type: 'date' }, { k: 'ends', label: t('Fin'), type: 'date' }, { k: 'maxUses', label: t("Utilisations maximales (0 = illimité)"), type: 'number' }, { k: 'active', label: t('Actif'), type: 'bool', def: 1 }]}
      row={(p) => ({ main: p.code + ' · ' + (p.kind === 'percent' ? p.value + ' %' : p.value), sub: [t('{n} utilisation(s)', { n: p.used }), p.ends && t("jusqu'au {d}", { d: dateFr(p.ends) })].filter(Boolean).join(' · '), pill: !p.active ? [t('Désactivé'), 'mid'] : p.expired ? [t('Expiré'), 'bad'] : null })} />
  );
}
