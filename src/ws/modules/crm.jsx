import { useRef, useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';
import { DST, Pill, docText } from '../parts/crm/common.jsx';
import MailForm from '../parts/crm/MailForm.jsx';
import MailTab from '../parts/crm/MailTab.jsx';
import { ReminderView, SalesProposalView, Sheet } from '../parts/crm/Views.jsx';

/* Clients et ventes (fiches clients, devis, factures, paiements reçus, relances avec l'IA). */
export default function Crm() {
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
    modal('E-mail à ' + cu.name, (close) => <MailForm cu={cu} init={init} close={close} onSent={() => { if (tabRef.current === 'mail') load(); }} />, { wide: true });
  }

  function setDoc(d, p) { oapi('PUT', '/crm/documents/' + d.id, p).then(load).catch(fail); }

  function pay(d) {
    modal('Paiement reçu : ' + d.number, (close) => (
      <>
        <p className="muted small">{'Reste à payer : ' + money(d.balance) + '. Le paiement sera aussi inscrit comme une entrée « Ventes » dans votre budget.'}</p>
        <Form
          submitText="Enregistrer le paiement"
          fields={[{ k: 'amount', label: 'Montant reçu (' + info.org.currency + ')', required: true, value: d.balance }]}
          onSubmit={(v) => oapi('POST', '/crm/documents/' + d.id + '/payments', { amount: v.amount }).then(() => { close(); load(); })}
        />
      </>
    ));
  }

  function remind(d) {
    const cu = findCustomer(d.customerId);
    propose('payment-reminder', { documentId: d.id }, { title: 'Message de relance', apply: false, render: (p) => <ReminderView p={p} d={d} cu={cu} composeMail={composeMail} /> });
  }

  function editCustomer(cu) {
    cu = cu || {};
    modal(cu.id ? 'Modifier le client' : 'Nouveau client', (close) => (
      <Form
        submitText="Enregistrer"
        fields={[
          { k: 'name', label: 'Nom', required: true, value: cu.name },
          { k: 'phone', label: 'Téléphone / WhatsApp', value: cu.phone },
          { k: 'email', label: 'E-mail', value: cu.email },
          { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, value: cu.notes, hint: 'Préférences, habitudes de paiement…' },
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
    modal(kind === 'quote' ? 'Nouveau devis' : 'Nouvelle facture', (close) => {
      if (!list.length) return <Empty text="Ajoutez d'abord un client." />;
      return (
        <Form
          submitText="Créer (brouillon)"
          fields={[
            { k: 'customerId', label: 'Client', type: 'select', options: list.map((x) => [String(x.id), x.name]) },
            { k: 'lines', label: 'Lignes (une par ligne)', type: 'textarea', rows: 5, required: true, placeholder: 'Pagne ; 2 ; 15000\nLivraison ; 1 ; 2000', hint: 'Format : libellé ; quantité ; prix unitaire. Le total est calculé pour vous.' },
            { k: 'due', label: kind === 'quote' ? "Valable jusqu'au (facultatif)" : 'À payer avant le', type: 'date' },
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
    modal("Proposition avec l'IA", (close) => (
      <>
        <p className="muted small">Décrivez le besoin ou le marché visé. L'IA rédige un message prêt à envoyer, avec des crochets [comme ceci] là où il manque une information. Elle n'invente ni prix ni référence.</p>
        <Form
          submitText="Rédiger avec l'IA"
          fields={[
            { k: 'kind', label: 'Type de message', type: 'select', options: [['proposal', 'Offre commerciale'], ['tender', "Réponse à un appel d'offres ou à une demande de devis"], ['prospecting', 'Prospection (premier contact)'], ['followup', "Relance d'un devis sans réponse"]] },
            { k: 'customerId', label: 'Client concerné (facultatif)', type: 'select', options: [['', 'Aucun client précis']].concat(list.map((x) => [String(x.id), x.name])) },
            { k: 'need', label: 'Le besoin du client ou le marché visé', type: 'textarea', rows: 5, required: true, placeholder: 'Ex : il veut 200 chemises pour son équipe avant fin novembre' },
          ]}
          onSubmit={(v) => {
            close();
            const cu = v.customerId ? list.find((x) => String(x.id) === v.customerId) : null;
            propose('sales-proposal', { kind: v.kind, customerId: v.customerId || null, need: v.need }, { title: "Message proposé par l'IA", apply: false, render: (p) => <SalesProposalView p={p} cu={cu} composeMail={composeMail} /> });
            return Promise.resolve();
          }}
        />
      </>
    ));
  }

  function docRow(d) {
    const stt = DST[d.status] || ['', ''];
    const a = [];
    if (d.status === 'draft') a.push(['Marquer envoyé', () => setDoc(d, { status: 'sent' })]);
    if (d.kind === 'invoice' && d.status === 'sent') a.push(['Paiement reçu', () => pay(d)]);
    if (d.overdue) a.push(["Relancer avec l'IA", () => remind(d)]);
    if (d.kind === 'quote' && d.status === 'sent') { a.push(['Accepté', () => setDoc(d, { status: 'accepted' })]); a.push(['Refusé', () => setDoc(d, { status: 'refused' })]); }
    if (d.kind === 'quote' && d.status === 'accepted') a.push(['Créer la facture', () => { oapi('POST', '/crm/documents/' + d.id + '/convert', {}).then(() => { setTab('invoice'); load(); }).catch(fail); }]);
    a.push(['Envoyer par e-mail', () => {
      const cu = findCustomer(d.customerId);
      if (!cu || !cu.email) return toast("Ajoutez d'abord l'adresse e-mail de ce client sur sa fiche (Clients → Modifier).", 'bad');
      return composeMail(cu, { subject: (d.kind === 'quote' ? 'Votre devis ' : 'Votre facture ') + d.number, body: 'Bonjour ' + cu.name.split(' ')[0] + ',\n\nVeuillez trouver ci-dessous ' + (d.kind === 'quote' ? 'votre devis' : 'votre facture') + '.\n\n' + docText(d, money, dateFr, info.org.name) + '\n\nCordialement.' });
    }]);
    a.push(['Copier le texte', () => copy(docText(d, money, dateFr, info.org.name), 'Texte copié : collez-le dans WhatsApp ou un e-mail.')]);
    if (d.kind === 'invoice' && d.status !== 'paid' && d.status !== 'cancelled' && d.status !== 'draft') a.push(['Annuler', () => confirm('Annuler cette facture ?', () => setDoc(d, { status: 'cancelled' }))]);
    if (d.status === 'draft' || (can('admin') && !d.paid)) a.push(['Supprimer', () => confirm('Supprimer ' + d.number + ' ?', () => { oapi('DELETE', '/crm/documents/' + d.id).then(load).catch(fail); })]);
    return (
      <div className="line" key={d.id}>
        <span>
          <b>{d.number}</b>{' '}<span>{d.customer || ''}</span>{' '}<Pill t={d.overdue ? ['En retard', 'bad'] : stt} />
          <small>{' ' + money(d.total) + (d.kind === 'invoice' && d.paid ? ' · payé ' + money(d.paid) : '') + (d.due ? ' · échéance ' + dateFr(d.due) : '')}</small>
        </span>
        <span className="row">{a.map((x) => <button className="link" type="button" key={x[0]} onClick={x[1]}>{x[0]}</button>)}</span>
      </div>
    );
  }

  function showCustomers() {
    return (
      <div className="ws-card">
        <h2>Clients</h2>
        {!customers.length ? <Empty text="Aucun client. Ajoutez le premier : son historique de ventes se construira ici." /> : null}
        {customers.map((cu) => (
          <div className="line" key={cu.id}>
            <span>
              <b>{cu.name}</b>
              {cu.stage === 'prospect' ? <span className="pill mid">Prospect</span> : null}
              <small>{' ' + [cu.phone, cu.email].filter(Boolean).join(' · ') + (cu.source ? ' · via ' + cu.source : '')}</small>
              {cu.owed ? <small className="late">{'  doit ' + money(cu.owed)}</small> : null}
            </span>
            <span className="row">
              {mgr && cu.email ? <button className="link" type="button" onClick={() => composeMail(cu, {})}>E-mail</button> : null}
              {mgr ? <button className="link" type="button" onClick={() => sheet(cu)}>Fiche</button> : null}
              <button className="link" type="button" onClick={() => editCustomer(cu)}>Modifier</button>
              {mgr ? <button className="link" type="button" onClick={() => confirm('Supprimer « ' + cu.name + ' » et tous ses devis et factures ?', () => { oapi('DELETE', '/crm/customers/' + cu.id).then(load).catch(fail); })}>Supprimer</button> : null}
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
          <div className="stat"><b>{money(s.owed)}</b><span>à encaisser</span></div>
          <div className={'stat' + (s.overdueCount ? ' bad' : '')}><b>{money(s.overdue)}</b><span>{s.overdueCount + ' facture(s) en retard'}</span></div>
          <div className="stat"><b>{money(s.invoicedMonth)}</b><span>facturé ce mois</span></div>
          <div className="stat"><b className="ok">{money(s.paidMonth)}</b><span>encaissé ce mois</span></div>
        </div>
        <div className="ws-card">
          <h2>{tab === 'quote' ? 'Devis' : 'Factures'}</h2>
          {!j.documents.length ? <Empty text={tab === 'quote' ? 'Aucun devis.' : 'Aucune facture.'} /> : null}
          {j.documents.map(docRow)}
        </div>
      </>
    );
  }

  let content;
  if (st.loading) content = <Loading />;
  else if (st.error) content = <p className="ws-err" role="alert">{st.error.message}</p>;
  else if (tab === 'customers') content = showCustomers();
  else if (tab === 'mail') content = <MailTab />;
  else if (st.data && st.data.docs) content = showDocs(st.data.docs);

  const tabs = mgr ? [['customers', 'Clients'], ['quote', 'Devis'], ['invoice', 'Factures'], ['mail', 'E-mails']] : [['customers', 'Clients']];
  return (
    <>
      <div className="ws-head">
        <div>
          <h1>Clients et ventes</h1>
          <p className="muted">{mgr ? "Vos clients, vos devis, vos factures et ce qu'il reste à encaisser." : 'Vos clients.'}</p>
        </div>
        <div className="row">
          {mgr ? <button className="btn signal small" type="button" onClick={proposal}>Proposition avec l'IA</button> : null}
          {mgr ? <button className="btn small" type="button" onClick={() => newDoc('quote')}>Nouveau devis</button> : null}
          {mgr ? <button className="btn small" type="button" onClick={() => newDoc('invoice')}>Nouvelle facture</button> : null}
          <button className="btn primary small" type="button" onClick={() => editCustomer()}>Ajouter un client</button>
        </div>
      </div>
      <div className="ws-tabs">
        {tabs.map((t) => <button key={t[0]} type="button" className={'tab' + (tab === t[0] ? ' on' : '')} onClick={() => { setTab(t[0]); load(); }}>{t[1]}</button>)}
      </div>
      <div>{content}</div>
    </>
  );
}
