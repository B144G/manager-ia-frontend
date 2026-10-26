import { useRef, useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';
import { DST, Pill, docText } from '../parts/crm/common.jsx';
import MailForm from '../parts/crm/MailForm.jsx';
import MailTab from '../parts/crm/MailTab.jsx';
import { ReminderView, SalesProposalView, Sheet } from '../parts/crm/Views.jsx';

/* Clients et ventes (fiches clients, devis, factures, paiements reçus, relances avec l'IA). */
export default function Crm() {
  const t = useT();
  const { oapi, info, can, money, dateFr, toast, fail, modal, confirm, copy, propose } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState('customers');
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const st = useLoad(async () => {
    const j = await oapi('GET', '/crm/customers');
    if (tab === 'customers' || tab === 'mail') return { customers: j.customers, docs: null };
    return { customers: j.customers, docs: await oapi('GET', '/crm/documents?kind=' + tab) };
  }, [tab]);
  const load = st.reload;
  const customers = (st.data && st.data.customers) || [];

  const findCustomer = (id) => customers.find((x) => x.id === id);

  function composeMail(cu, init) {
    modal(t('E-mail à {name}', { name: cu.name }), (close) => <MailForm cu={cu} init={init} close={close} onSent={() => { if (tabRef.current === 'mail') load(); }} />, { wide: true });
  }

  function setDoc(d, p) { oapi('PUT', '/crm/documents/' + d.id, p).then(load).catch(fail); }

  function pay(d) {
    modal(t('Paiement reçu : {number}', { number: d.number }), (close) => (
      <>
        <p className="muted small">{t('Reste à payer : {amount}. Le paiement sera aussi inscrit comme une entrée « Ventes » dans votre budget.', { amount: money(d.balance) })}</p>
        <Form
          submitText={t("Enregistrer le paiement")}
          fields={[{ k: 'amount', label: t('Montant reçu ({currency})', { currency: info.org.currency }), required: true, value: d.balance }]}
          onSubmit={(v) => oapi('POST', '/crm/documents/' + d.id + '/payments', { amount: v.amount }).then(() => { close(); load(); })}
        />
      </>
    ));
  }

  function remind(d) {
    const cu = findCustomer(d.customerId);
    propose('payment-reminder', { documentId: d.id }, { title: t('Message de relance'), apply: false, render: (p) => <ReminderView p={p} d={d} cu={cu} composeMail={composeMail} /> });
  }

  function editCustomer(cu) {
    cu = cu || {};
    modal(cu.id ? t('Modifier le client') : t('Nouveau client'), (close) => (
      <Form
        submitText={t("Enregistrer")}
        fields={[
          { k: 'name', label: t('Nom'), required: true, value: cu.name },
          { k: 'phone', label: t('Téléphone / WhatsApp'), value: cu.phone },
          { k: 'email', label: t('E-mail'), value: cu.email },
          { k: 'notes', label: t('Notes'), type: 'textarea', rows: 3, value: cu.notes, hint: t('Préférences, habitudes de paiement…') },
        ]}
        onSubmit={(v) => oapi(cu.id ? 'PUT' : 'POST', '/crm/customers' + (cu.id ? '/' + cu.id : ''), v).then(() => { close(); load(); })}
      />
    ));
  }

  function sheet(cu) { modal(cu.name, () => <Sheet cu={cu} />); }

  function newDoc(kind) {
    oapi('GET', '/crm/customers').then((j) => openDoc(kind, j.customers)).catch(fail);
  }
  function openDoc(kind, list) {
    modal(kind === 'quote' ? t('Nouveau devis') : t('Nouvelle facture'), (close) => {
      if (!list.length) return <Empty text={t("Ajoutez d'abord un client.")} />;
      return (
        <Form
          submitText={t("Créer (brouillon)")}
          fields={[
            { k: 'customerId', label: t('Client'), type: 'select', options: list.map((x) => [String(x.id), x.name]) },
            { k: 'lines', label: t('Lignes (une par ligne)'), type: 'textarea', rows: 5, required: true, placeholder: t('Pagne ; 2 ; 15000\nLivraison ; 1 ; 2000'), hint: t('Format : libellé ; quantité ; prix unitaire. Le total est calculé pour vous.') },
            { k: 'due', label: kind === 'quote' ? t("Valable jusqu'au (facultatif)") : t('À payer avant le'), type: 'date' },
          ]}
          onSubmit={(v) => {
            const lines = v.lines.split('\n').map((l) => { const p = l.split(';'); return p.length >= 2 && l.trim() ? { label: p[0].trim(), quantity: p.length >= 3 ? p[1].trim() : '1', price: (p.length >= 3 ? p[2] : p[1]).trim() } : null; }).filter(Boolean);
            return oapi('POST', '/crm/documents', { kind, customerId: v.customerId, lines, due: v.due || null }).then(() => { close(); setTab(kind); load(); });
          }}
        />
      );
    });
  }

  /* Proposition commerciale rédigée par l'IA (offre, appel d'offres, prospection, relance de devis) */
  function proposal() {
    const list = customers;
    modal(t("Proposition avec l'IA"), (close) => (
      <>
        <p className="muted small">{t("Décrivez le besoin ou le marché visé. L'IA rédige un message prêt à envoyer, avec des crochets [comme ceci] là où il manque une information. Elle n'invente ni prix ni référence.")}</p>
        <Form
          submitText={t("Rédiger avec l'IA")}
          fields={[
            { k: 'kind', label: t('Type de message'), type: 'select', options: [['proposal', t('Offre commerciale')], ['tender', t("Réponse à un appel d'offres ou à une demande de devis")], ['prospecting', t('Prospection (premier contact)')], ['followup', t("Relance d'un devis sans réponse")]] },
            { k: 'customerId', label: t('Client concerné (facultatif)'), type: 'select', options: [['', t('Aucun client précis')]].concat(list.map((x) => [String(x.id), x.name])) },
            { k: 'need', label: t('Le besoin du client ou le marché visé'), type: 'textarea', rows: 5, required: true, placeholder: t('Ex : il veut 200 chemises pour son équipe avant fin novembre') },
          ]}
          onSubmit={(v) => {
            close();
            const cu = v.customerId ? list.find((x) => String(x.id) === v.customerId) : null;
            propose('sales-proposal', { kind: v.kind, customerId: v.customerId || null, need: v.need }, { title: t("Message proposé par l'IA"), apply: false, render: (p) => <SalesProposalView p={p} cu={cu} composeMail={composeMail} /> });
            return Promise.resolve();
          }}
        />
      </>
    ));
  }

  function docRow(d) {
    const stt = DST[d.status] || ['', ''];
    const a = [];
    if (d.status === 'draft') a.push([t('Marquer envoyé'), () => setDoc(d, { status: 'sent' })]);
    if (d.kind === 'invoice' && d.status === 'sent') a.push([t('Paiement reçu'), () => pay(d)]);
    if (d.overdue) a.push([t("Relancer avec l'IA"), () => remind(d)]);
    if (d.kind === 'quote' && d.status === 'sent') { a.push([t('Accepté'), () => setDoc(d, { status: 'accepted' })]); a.push([t('Refusé'), () => setDoc(d, { status: 'refused' })]); }
    if (d.kind === 'quote' && d.status === 'accepted') a.push([t('Créer la facture'), () => { oapi('POST', '/crm/documents/' + d.id + '/convert', {}).then(() => { setTab('invoice'); load(); }).catch(fail); }]);
    a.push([t('Envoyer par e-mail'), () => {
      const cu = findCustomer(d.customerId);
      if (!cu || !cu.email) return toast(t("Ajoutez d'abord l'adresse e-mail de ce client sur sa fiche (Clients → Modifier)."), 'bad');
      return composeMail(cu, { subject: d.kind === 'quote' ? t('Votre devis {number}', { number: d.number }) : t('Votre facture {number}', { number: d.number }), body: t('Bonjour {name},', { name: cu.name.split(' ')[0] }) + '\n\n' + (d.kind === 'quote' ? t('Veuillez trouver ci-dessous votre devis.') : t('Veuillez trouver ci-dessous votre facture.')) + '\n\n' + docText(d, money, dateFr, info.org.name) + '\n\n' + t('Cordialement.') });
    }]);
    a.push([t('Copier le texte'), () => copy(docText(d, money, dateFr, info.org.name), t('Texte copié : collez-le dans WhatsApp ou un e-mail.'))]);
    if (d.kind === 'invoice' && d.status !== 'paid' && d.status !== 'cancelled' && d.status !== 'draft') a.push([t('Annuler'), () => confirm(t('Annuler cette facture ?'), () => setDoc(d, { status: 'cancelled' }))]);
    if (d.status === 'draft' || (can('admin') && !d.paid)) a.push([t('Supprimer'), () => confirm(t('Supprimer {number} ?', { number: d.number }), () => { oapi('DELETE', '/crm/documents/' + d.id).then(load).catch(fail); })]);
    return (
      <div className="line" key={d.id}>
        <span>
          <b>{d.number}</b>{' '}<span>{d.customer || ''}</span>{' '}<Pill t={d.overdue ? ['En retard', 'bad'] : stt} />
          <small>{' ' + money(d.total) + (d.kind === 'invoice' && d.paid ? ' · ' + t('payé {amount}', { amount: money(d.paid) }) : '') + (d.due ? ' · ' + t('échéance {date}', { date: dateFr(d.due) }) : '')}</small>
        </span>
        <span className="row">{a.map((x) => <button className="link" type="button" key={x[0]} onClick={x[1]}>{x[0]}</button>)}</span>
      </div>
    );
  }

  function showCustomers() {
    return (
      <div className="ws-card">
        <h2>{t('Clients')}</h2>
        {!customers.length ? <Empty text={t("Aucun client. Ajoutez le premier : son historique de ventes se construira ici.")} /> : null}
        {customers.map((cu) => (
          <div className="line" key={cu.id}>
            <span>
              <b>{cu.name}</b>
              {cu.stage === 'prospect' ? <span className="pill mid">{t('Prospect')}</span> : null}
              <small>{' ' + [cu.phone, cu.email].filter(Boolean).join(' · ') + (cu.source ? ' · ' + t('via {source}', { source: cu.source }) : '')}</small>
              {cu.owed ? <small className="late">{'  ' + t('doit {amount}', { amount: money(cu.owed) })}</small> : null}
            </span>
            <span className="row">
              {mgr && cu.email ? <button className="link" type="button" onClick={() => composeMail(cu, {})}>{t('E-mail')}</button> : null}
              {mgr ? <button className="link" type="button" onClick={() => sheet(cu)}>{t('Fiche')}</button> : null}
              <button className="link" type="button" onClick={() => editCustomer(cu)}>{t('Modifier')}</button>
              {mgr ? <button className="link" type="button" onClick={() => confirm(t('Supprimer « {name} » et tous ses devis et factures ?', { name: cu.name }), () => { oapi('DELETE', '/crm/customers/' + cu.id).then(load).catch(fail); })}>{t('Supprimer')}</button> : null}
            </span>
          </div>
        ))}
      </div>
    );
  }

  function showDocs(j) {
    const s = j.summary;
    return (
      <>
        <div className="kpis">
          <div className="stat"><b>{money(s.owed)}</b><span>{t('à encaisser')}</span></div>
          <div className={'stat' + (s.overdueCount ? ' bad' : '')}><b>{money(s.overdue)}</b><span>{t('{n} facture(s) en retard', { n: s.overdueCount })}</span></div>
          <div className="stat"><b>{money(s.invoicedMonth)}</b><span>{t('facturé ce mois')}</span></div>
          <div className="stat"><b className="ok">{money(s.paidMonth)}</b><span>{t('encaissé ce mois')}</span></div>
        </div>
        <div className="ws-card">
          <h2>{tab === 'quote' ? t('Devis') : t('Factures')}</h2>
          {!j.documents.length ? <Empty text={tab === 'quote' ? t('Aucun devis.') : t('Aucune facture.')} /> : null}
          {j.documents.map(docRow)}
        </div>
      </>
    );
  }

  let content;
  if (st.loading) content = <Loading />;
  else if (st.error) content = <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  else if (tab === 'customers') content = showCustomers();
  else if (tab === 'mail') content = <MailTab />;
  else if (st.data && st.data.docs) content = showDocs(st.data.docs);

  const tabs = mgr ? [['customers', t('Clients')], ['quote', t('Devis')], ['invoice', t('Factures')], ['mail', t('E-mails')]] : [['customers', t('Clients')]];
  return (
    <>
      <div className="ws-head">
        <div>
          <h1>{t('Clients et ventes')}</h1>
          <p className="muted">{mgr ? t("Vos clients, vos devis, vos factures et ce qu'il reste à encaisser.") : t('Vos clients.')}</p>
        </div>
        <div className="row">
          {mgr ? <button className="btn signal small" type="button" onClick={proposal}>{t("Proposition avec l'IA")}</button> : null}
          {mgr ? <button className="btn small" type="button" onClick={() => newDoc('quote')}>{t('Nouveau devis')}</button> : null}
          {mgr ? <button className="btn small" type="button" onClick={() => newDoc('invoice')}>{t('Nouvelle facture')}</button> : null}
          <button className="btn primary small" type="button" onClick={() => editCustomer()}>{t('Ajouter un client')}</button>
        </div>
      </div>
      <div className="ws-tabs">
        {tabs.map((x) => <button key={x[0]} type="button" className={'tab' + (tab === x[0] ? ' on' : '')} onClick={() => { setTab(x[0]); load(); }}>{x[1]}</button>)}
      </div>
      <div>{content}</div>
    </>
  );
}
