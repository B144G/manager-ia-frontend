import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { YearBar } from './common.jsx';
import { LedgerBox } from './Tabs.jsx';

/* Écrans autonomes du menu de la comptabilité : Grand livre et Plan comptable.
   Ils ne font que lire (et, pour le plan, ajouter un compte) avec les routes existantes. */

/** Grand livre : on choisit un compte du plan, puis on voit ses mouvements. */
export function LedgerScreen({ year, setYear }) {
  const t = useT();
  const { oapi } = useWs();
  const [account, setAccount] = useState('');
  const st = useLoad(() => oapi('GET', '/accounting/accounts'), []);
  const accounts = (st.data && st.data.accounts) || [];
  const code = account.trim().split(' ')[0];
  const known = accounts.some((a) => a.code === code);
  return (
    <div className="ws-card">
      <YearBar year={year} setYear={setYear} />
      <h2>{t('Grand livre')}</h2>
      <label className="fld">
        <span>{t('Compte')}</span>
        <input list="acc-ledger-list" value={account} onChange={(e) => setAccount(e.target.value)} placeholder={t('Numéro ou nom du compte (ex. 521)')} />
        <datalist id="acc-ledger-list">{accounts.map((a) => <option key={a.code} value={a.code + ' ' + t(a.label)} />)}</datalist>
      </label>
      {st.loading ? <Loading /> : null}
      {known ? <LedgerBox key={code + '-' + year} account={code} year={year} /> : <Empty text={t('Choisissez un compte pour voir ses mouvements.')} />}
    </div>
  );
}

/** Plan comptable : liste du plan de l'entreprise avec recherche, et ajout d'un compte personnalisé. */
export function ChartScreen({ onAccountAdded }) {
  const t = useT();
  const { oapi, toast, modal } = useWs();
  const [q, setQ] = useState('');
  const st = useLoad(() => oapi('GET', '/accounting/accounts?q=' + encodeURIComponent(q.trim())), [q]);
  const rows = (st.data && st.data.accounts) || [];
  return (
    <div className="ws-card">
      <h2>{t('Plan comptable')}</h2>
      <p className="muted small">{t('Plan de base inspiré du SYSCOHADA révisé. Ajoutez vos propres comptes (3 à 8 chiffres) si besoin.')}</p>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Rechercher un compte (numéro ou nom)')} aria-label={t('Rechercher un compte (numéro ou nom)')} style={{ maxWidth: 360 }} />
        <button className="btn small" type="button" onClick={() => modal(t('Nouveau compte'), (close) => (
          <Form
            submitText={t('Ajouter')}
            fields={[{ k: 'code', label: t('Numéro (ex. 6221)'), required: true }, { k: 'label', label: t('Nom du compte'), required: true }]}
            onSubmit={(v) => oapi('POST', '/accounting/accounts', v).then(() => { if (onAccountAdded) onAccountAdded(); close(); toast(t('Compte ajouté.')); st.reload(); })}
          />
        ))}>{t('Ajouter un compte')}</button>
      </div>
      {st.loading && !st.data ? <Loading /> : null}
      {!st.loading && !rows.length ? <Empty text={t('Aucun compte trouvé.')} /> : null}
      {rows.map((a) => (
        <div className="line" key={a.code}>
          <span><b>{a.code}</b><small>{' ' + t(a.label)}</small></span>
          {a.custom ? <small className="muted">{t('Compte personnalisé')}</small> : null}
        </div>
      ))}
    </div>
  );
}
