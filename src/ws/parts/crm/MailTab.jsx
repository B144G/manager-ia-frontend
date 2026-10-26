import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { Pill } from './common.jsx';

/** Onglet « E-mails » : envoi activé ?, e-mails envoyés, fichiers joints. */
export default function MailTab() {
  const t = useT();
  const { oapi, dateFr, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/mail'), []);
  return (
    <Loaded state={st}>
      {(j) => (
        <>
          <div className="kpis">
            <div className={'stat' + (j.enabled ? '' : ' bad')}><b>{j.enabled ? t('Activé') : t('Non activé')}</b><span>{t("envoi d'e-mails")}</span></div>
            <div className="stat"><b>{j.sentToday + ' / ' + j.limitPerDay}</b><span>{t("e-mails aujourd'hui")}</span></div>
            <div className="stat"><b>{String(j.files.length)}</b><span>{t('fichiers prêts à joindre')}</span></div>
          </div>
          {!j.enabled ? <p className="ws-err">{t("L'envoi d'e-mails n'est pas encore activé sur ce serveur : l'administrateur de la plateforme doit renseigner le serveur d'envoi.")}</p> : null}
          <div className="ws-card">
            <h2>{t('E-mails envoyés')}</h2>
            {!j.outbox.length ? <Empty text={t("Aucun e-mail envoyé. Ouvrez un devis, une facture ou une fiche client pour écrire à un client.")} /> : null}
            {j.outbox.map((o, i) => (
              <div className="line" key={o.id !== undefined ? o.id : i}>
                <span><b>{o.subject}</b><small>{' ' + t('à {email}', { email: o.toEmail }) + (o.attachments.length ? ' · ' + t('{n} pièce(s) jointe(s)', { n: o.attachments.length }) : '') + (o.sender ? ' · ' + t('par {name}', { name: o.sender }) : '')}</small></span>
                <span className="row"><Pill t={[o.status === 'sent' ? 'Envoyé' : 'Échec', o.status === 'sent' ? 'good' : 'bad']} /><small>{dateFr(o.at)}</small></span>
              </div>
            ))}
          </div>
          <div className="ws-card">
            <h2>{t('Fichiers joints (images, PDF)')}</h2>
            {!j.files.length ? <Empty text={t("Les fichiers que vous joignez à un e-mail apparaissent ici.")} /> : null}
            {j.files.map((f) => (
              <div className="line" key={f.id}>
                <span><b>{f.name}</b><small>{' ' + t('{n} Ko', { n: Math.round(f.size / 1024) })}</small></span>
                <button className="link" type="button" onClick={() => confirm(t('Supprimer {name} ?', { name: f.name }), () => oapi('DELETE', '/mail/files/' + f.id).then(st.reload).catch(fail))}>{t('Supprimer')}</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Loaded>
  );
}
