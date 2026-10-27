import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Pill } from './common.jsx';

/* Facturation : paiement (mode, référence, mobile money), liste des paiements, avoir, mentions légales et TVA. Les sorties sont des documents de travail. */

const PAY_STATUS = { confirmed: ['Confirmé', 'good'], pending: ['À vérifier', 'mid'], failed: ['Rejeté', 'bad'] };

/** Lignes « libellé ; quantité ; prix » -> tableau (même format que la création d'une facture). */
export function parseLines(text) {
  return String(text || '').split('\n').map((l) => { const p = l.split(';'); return p.length >= 2 && l.trim() ? { label: p[0].trim(), quantity: p.length >= 3 ? p[1].trim() : '1', price: (p.length >= 3 ? p[2] : p[1]).trim() } : null; }).filter(Boolean);
}

export function PayForm({ d, close, done }) {
  const t = useT();
  const { oapi, info, money } = useWs();
  return (
    <>
      <p className="muted small">{t('Reste à payer : {amount}. Le paiement confirmé sera aussi inscrit comme une entrée « Ventes » dans votre budget.', { amount: money(d.balance) })}</p>
      <Form
        submitText={t('Enregistrer le paiement')}
        fields={[
          { k: 'amount', label: t('Montant reçu ({currency})', { currency: info.org.currency }), required: true, value: d.balance },
          { k: 'method', label: t('Mode de paiement'), type: 'select', options: [['cash', t('Espèces')], ['mtn_momo', t('MTN Mobile Money')], ['orange_money', t('Orange Money')], ['transfer', t('Virement')], ['cheque', t('Chèque')]] },
          { k: 'reference', label: t('Référence de la transaction'), hint: t("Obligatoire sauf espèces : identifiant reçu par SMS (mobile money), référence du virement ou numéro du chèque. Une même référence ne peut servir qu'une fois.") },
          { k: 'payerPhone', label: t('Téléphone du payeur (facultatif)'), placeholder: '237670000000' },
          { k: 'status', label: t('État du paiement'), type: 'select', options: [['confirmed', t("Confirmé : l'argent est reçu")], ['pending', t("À vérifier : référence notée, argent pas encore contrôlé")]], hint: t("« À vérifier » ne change pas le solde de la facture tant que vous n'avez pas confirmé.") },
          { k: 'note', label: t('Note') },
        ]}
        onSubmit={(v) => oapi('POST', '/crm/documents/' + d.id + '/payments', v).then(() => { close(); done(); })}
      />
      <p className="muted small">{t("Le suivi Mobile Money est manuel : MANAGER-IA ne déclenche pas de demande de paiement sur le téléphone du client et ne vérifie pas la transaction chez l'opérateur.")}</p>
    </>
  );
}

export function PaymentsList({ d, done }) {
  const t = useT();
  const { oapi, money, dateFr, fail, confirm } = useWs();
  const st = useLoad(() => oapi('GET', '/crm/documents/' + d.id + '/payments'), []);
  const act = (p, action) => oapi('POST', '/crm/documents/' + d.id + '/payments/' + p.id + '/' + action).then(() => { st.reload(); done(); }).catch(fail);
  return (
    <Loaded state={st}>{(j) => (
      <>
        {!j.payments.length ? <Empty text={t('Aucun paiement.')} /> : null}
        {j.payments.map((p) => (
          <div className="line" key={p.id}>
            <span>
              <b>{money(p.amount)}</b>{' '}<Pill t={PAY_STATUS[p.status]} />
              <small>{' ' + [dateFr(p.date), p.methodLabel ? t(p.methodLabel) : t('Mode non précisé'), p.reference, p.payerPhone].filter(Boolean).join(' · ')}</small>
            </span>
            {p.status === 'pending' ? (
              <span className="row">
                <button className="link" type="button" onClick={() => act(p, 'confirm')}>{t('Confirmer')}</button>
                <button className="link" type="button" onClick={() => confirm(t('Rejeter ce paiement ?'), () => act(p, 'reject'))}>{t('Rejeter')}</button>
              </span>
            ) : null}
          </div>
        ))}
      </>
    )}
    </Loaded>
  );
}

export function CreditForm({ d, close, done }) {
  const t = useT();
  const { oapi, toast } = useWs();
  return (
    <>
      <p className="muted small">{t("Un avoir annule tout ou partie d'une facture. Laissez les lignes vides pour créditer toute la facture. Les prix sont saisis comme sur la facture ({mode}).", { mode: d.pricesIncl ? t('TTC') : t('HT') })}</p>
      <Form
        submitText={t("Émettre l'avoir")}
        fields={[
          { k: 'reason', label: t("Motif de l'avoir"), required: true, placeholder: t('Retour de marchandise, erreur de facturation, remise…') },
          { k: 'lines', label: t('Lignes à créditer (une par ligne, facultatif)'), type: 'textarea', rows: 3, placeholder: t('Remise ; 1 ; 5000'), hint: t('Format : libellé ; quantité ; prix unitaire.') },
        ]}
        onSubmit={(v) => {
          const body = { reason: v.reason };
          const lines = parseLines(v.lines);
          if (lines.length) body.lines = lines;
          return oapi('POST', '/crm/documents/' + d.id + '/credit-note', body).then((j) => { close(); done(); toast(j.accountingPosted ? t('Avoir {number} émis et écriture comptable passée.', { number: j.number }) : t('Avoir {number} émis.', { number: j.number })); });
        }}
      />
    </>
  );
}

export function InvoiceSettings({ close }) {
  const t = useT();
  const { oapi, toast } = useWs();
  const st = useLoad(() => oapi('GET', '/crm/invoice-settings'), []);
  return (
    <Loaded state={st}>{(s) => (
      <>
        <p className="muted small">{t("Ces mentions figurent sur vos factures. Les documents produits sont des documents de travail : faites-les valider par votre expert-comptable avant tout usage légal ou fiscal.")}</p>
        <Form
          submitText={t('Enregistrer')}
          fields={[
            { k: 'niu', label: t("NIU de l'entreprise"), value: s.niu, hint: t("Numéro d'identifiant unique, obligatoire sur les factures au Cameroun.") },
            { k: 'rccm', label: t('RCCM (facultatif)'), value: s.rccm },
            { k: 'address', label: t('Adresse'), type: 'textarea', rows: 2, value: s.address },
            { k: 'vatRate', label: t('Taux de TVA par défaut (%)'), value: String(s.vatRate), hint: t('19,25 % au Cameroun. 0 pour une entreprise non assujettie.') },
            { k: 'payInfo', label: t('Comment vous payer'), type: 'textarea', rows: 3, value: s.payInfo, placeholder: t('MTN MoMo : 670 00 00 00 (nom du compte)\nOrange Money : 690 00 00 00\nBanque : IBAN…'), hint: t('Affiché sur la facture et dans le message WhatsApp.') },
            { k: 'footer', label: t('Pied de page (conditions, pénalités de retard…)'), type: 'textarea', rows: 3, value: s.footer },
          ]}
          onSubmit={(v) => oapi('PUT', '/crm/invoice-settings', { ...v, vatRate: String(v.vatRate).replace(',', '.') }).then(() => { close(); toast(t('Mentions enregistrées.')); })}
        />
      </>
    )}
    </Loaded>
  );
}
