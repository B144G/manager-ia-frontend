import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { Form2, Pill } from './util.jsx';

/** Onglet « Relances » : modèles WhatsApp approuvés par Meta, prospects silencieux, factures impayées. */
export function Followup({ admin }) {
  const t = useT();
  const ws = useWs();
  const { oapi, money, dateFr, confirm, toast, fail } = ws;
  const st = useLoad(() => oapi('GET', '/sales/wa'), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  if (!st.data) return null;
  const w = st.data;
  const reload = st.reload;
  const runSend = (kind) => oapi('POST', '/sales/wa/send', { kind }).then((r) => { toast(r.failed ? t('{sent} message(s) envoyé(s), {failed} en échec : {error}.', { sent: r.sent, failed: r.failed, error: r.error }) : t('{sent} message(s) envoyé(s).', { sent: r.sent })); reload(); }).catch(fail);
  return (
    <>
      {!w.connected ? <div className="ws-card"><h2>{t("WhatsApp n'est pas connecté")}</h2><p>{t("Connectez d'abord le numéro de l'entreprise (onglet Canaux) : les relances partent de ce numéro.")}</p></div> : null}
      <div className="ws-card">
        <h2>{t('Modèles de messages (approuvés par Meta)')}</h2>
        <p className="muted small">{t("WhatsApp interdit d'écrire librement à quelqu'un plus de 24 h après son dernier message : il faut un modèle, créé et approuvé dans le gestionnaire WhatsApp de Meta (en général quelques minutes à quelques heures). Enregistrez ici son nom exact.")}</p>
        {!w.templates.length ? <Empty text={t("Aucun modèle enregistré.")} /> : null}
        {w.templates.map((tp) => (
          <div className="line" key={tp.id}>
            <span><b>{tp.name}</b><small>{' ' + (w.purposes[tp.purpose] ? t(w.purposes[tp.purpose].label) : tp.purpose) + ' · ' + tp.language + ' · ' + t('{n} variable(s)', { n: tp.params }) + (tp.preview ? ' · ' + tp.preview : '')}</small></span>
            {admin ? <button className="link" type="button" onClick={() => confirm(t('Supprimer le modèle « {name} » de MANAGER-IA ? (Il reste dans Meta.)', { name: tp.name }), () => oapi('DELETE', '/sales/wa/templates/' + tp.id).then(reload).catch(fail))}>{t('Supprimer')}</button> : null}
          </div>
        ))}
        {admin ? <div className="row" style={{ marginTop: 8 }}><button className="btn small" type="button" onClick={() => ws.modal(t('Ajouter un modèle WhatsApp'), (close) => <AddTemplate w={w} close={close} done={reload} />)}>{t('Ajouter un modèle')}</button></div> : null}
      </div>

      <div className="ws-card">
        <h2>{t('Prospects à relancer ({n})', { n: w.silent.length })}</h2>
        <p className="muted small">{t("Des prospects qui vous ont écrit il y a plus de 24 h (et moins de 7 jours) sans commander. Chacun n'est relancé qu'une fois. Ceux qui ont répondu STOP sont exclus.")}</p>
        {w.silent.slice(0, 8).map((l, i) => <div className="line" key={l.contact || i}><span><b>{l.name || '+' + l.contact}</b><small>{' ' + t('dernier message le {date}', { date: dateFr(String(l.lastAt).slice(0, 10)) })}</small></span></div>)}
        {admin ? <div className="row" style={{ marginTop: 8 }}><button className="btn primary small" type="button" disabled={!w.silent.length || !w.connected} onClick={() => runSend('relance')}>{t('Relancer maintenant')}</button></div> : null}
      </div>

      <div className="ws-card">
        <h2>{t('Factures impayées ({n})', { n: w.overdue.length })}</h2>
        <p className="muted small">{t('Factures échues avec un numéro de téléphone. Un rappel au plus par semaine et par facture.')}</p>
        {w.overdue.slice(0, 8).map((i) => <div className="line" key={i.number}><span><b>{i.number + ' · ' + i.customer}</b><small>{' ' + t('reste {amount} · échue le {date}', { amount: money(i.left), date: dateFr(i.due) })}</small></span></div>)}
        {admin ? <div className="row" style={{ marginTop: 8 }}><button className="btn primary small" type="button" disabled={!w.overdue.length || !w.connected} onClick={() => runSend('impaye')}>{t('Envoyer les rappels')}</button></div> : null}
      </div>

      {admin ? (
        <div className="ws-card">
          <h2>{t('Relances automatiques')}</h2>
          <p>{w.autoFollowup ? t('Activées : chaque heure, MANAGER-IA relance les prospects silencieux et rappelle les factures échues (20 messages au plus par passage).') : t('Désactivées : vous envoyez les relances vous-même avec les boutons ci-dessus.')}</p>
          <button className="btn small" type="button" onClick={() => oapi('PUT', '/sales/wa/auto', { enabled: !w.autoFollowup }).then(reload).catch(fail)}>{w.autoFollowup ? t('Désactiver') : t('Activer')}</button>
          <p className="muted small">{t('Envoyés sur 24 h : {sent} sur {cap} autorisés. Personnes désabonnées (STOP) : {optouts}. Les messages par modèle sont facturés par Meta selon son tarif.', { sent: w.sentToday, cap: w.dayCap, optouts: w.optouts })}</p>
        </div>
      ) : null}

      {w.log.length ? (
        <div className="ws-card">
          <h2>{t('Derniers envois')}</h2>
          {w.log.slice(0, 10).map((l, i) => (
            <div className="line" key={i}>
              <span><b>{'+' + l.phone}</b><small>{' ' + l.template + ' · ' + dateFr(String(l.at).slice(0, 10)) + (l.error ? ' · ' + t(l.error) : '')}</small></span>
              <Pill t={[l.status === 'sent' ? 'Envoyé' : 'Échec', l.status === 'sent' ? 'good' : 'bad']} />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function AddTemplate({ w, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const [purpose, setPurpose] = useState('relance');
  const p = w.purposes[purpose] || {};
  return (
    <>
      <Form2
        submitText={t("Enregistrer")}
        onValues={(v) => setPurpose(v.purpose)}
        fields={[
          { k: 'purpose', label: t('Usage'), type: 'select', options: Object.keys(w.purposes).map((k) => [k, t(w.purposes[k].label)]), value: 'relance' },
          { k: 'name', label: t('Nom exact dans Meta (minuscules, chiffres, _)'), required: true, hint: t('Exemple : relance_prospect') },
          { k: 'language', label: t('Langue'), value: 'fr', hint: t('Exactement comme dans Meta (fr, fr_FR, en…)') },
          { k: 'preview', label: t("Texte du modèle (pour l'affichage)"), hint: t('Recopiez le texte approuvé, avec {{1}}, {{2}}…') },
        ]}
        onSubmit={(v) => oapi('POST', '/sales/wa/templates', v).then(() => { close(); done(); })}
      />
      <p className="muted small">{(p.hint ? t('Variables : {hint}.', { hint: t(p.hint) }) + ' ' : '') + (p.example ? t('Texte conseillé à créer dans Meta : « {text} »', { text: t(p.example) }) : '')}</p>
    </>
  );
}
