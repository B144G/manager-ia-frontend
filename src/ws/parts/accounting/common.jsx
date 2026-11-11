import { useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';

/** Couleur d'une pastille selon le ton donné par le serveur (good/ok, watch, alert, na). */
export const TONE = { good: 'good', ok: 'good', watch: 'mid', warning: 'mid', alert: 'bad', error: 'bad', info: '' };

/** Téléchargement d'un fichier du module (cookie de connexion) : useDownload()('/export/balance.csv?year=2026', 'balance-2026.csv'). */
export function useDownload() {
  const t = useT();
  const { orgId, fail } = useWs();
  return (path, name) => fetch(API_BASE + '/api/ws/orgs/' + orgId + '/accounting' + path, { credentials: 'include' })
    .then((r) => { if (!r.ok) throw new Error(t('Export impossible.')); return r.blob(); })
    .then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }).catch(fail);
}

/** Boutons d'export CSV (balance, états, journal centralisateur, grand livre d'un compte). */
export function ExportBar({ year }) {
  const t = useT();
  const dl = useDownload();
  const [account, setAccount] = useState('');
  const acc = account.trim().replace(/[^0-9A-Za-z]/g, '');
  return (
    <div className="ws-card">
      <h2>{t('Exports pour Excel')}</h2>
      <p className="muted small">{t("Fichiers CSV (séparateur « ; ») à ouvrir dans Excel ou à remettre à votre expert-comptable.")}</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn small" type="button" onClick={() => dl('/export/balance.csv?year=' + year, 'balance-' + year + '.csv')}>{t('Balance')}</button>
        <button className="btn small" type="button" onClick={() => dl('/export/statements.csv?year=' + year, 'resultat-bilan-' + year + '.csv')}>{t('Résultat et bilan')}</button>
        <button className="btn small" type="button" onClick={() => dl('/export/journal-centralisateur.csv?year=' + year, 'journal-centralisateur-' + year + '.csv')}>{t('Journal centralisateur')}</button>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <input type="text" value={account} placeholder={t('Compte (ex. 571)')} aria-label={t('Compte')} style={{ width: 140, fontSize: 16 }} onChange={(e) => setAccount(e.target.value)} />
        <button className="btn small" type="button" disabled={!acc} onClick={() => dl('/export/ledger.csv?account=' + encodeURIComponent(acc) + '&year=' + year, 'grand-livre-' + acc + '-' + year + '.csv')}>{t('Grand livre du compte')}</button>
      </div>
    </div>
  );
}

/** Jauge de score 0..100 (vert, orange, rouge). */
export function ScoreBar({ score }) {
  const cls = score >= 80 ? 'ok' : score >= 50 ? 'amber' : 'over';
  return <div className={'meter ' + cls} role="img" aria-label={String(score)}><i style={{ width: Math.max(2, Math.min(100, score)) + '%' }} /></div>;
}

/** Sélecteur d'exercice (5 dernières années). */
export function YearBar({ year, setYear }) {
  const t = useT();
  const y = new Date().getFullYear();
  const years = [];
  for (let i = y; i >= y - 4; i--) years.push(String(i));
  return (
    <div className="row" style={{ marginBottom: 8 }}>
      <span className="muted small">{t('Exercice :')}</span>
      <select aria-label={t("Année")} value={year} onChange={(e) => setYear(e.target.value)}>
        {years.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
}

/** Une écriture comptable (carte). */
export function EntryCard({ e, canUndo, JN, onReverse }) {
  const t = useT();
  const { money, dateFr, confirm } = useWs();
  const tot = e.lines.reduce((a, l) => a + l.debit, 0);
  return (
    <div className="line" style={{ display: 'block' }}>
      <div className="row">
        <b>{e.number}</b>
        <span className="muted small">{dateFr(e.date) + ' · ' + (JN[e.journal] ? t(JN[e.journal]) : e.journal)}</span>
        <span className="grow" />
        <b>{money(tot)}</b>
        {canUndo && !e.reversedOf ? (
          <button className="link" type="button" onClick={() => confirm(t("Annuler l'écriture {number} par une écriture inverse ? (Elle reste visible dans le journal.)", { number: e.number }), () => onReverse(e))}>{t('Annuler')}</button>
        ) : null}
      </div>
      <div>{e.label}</div>
      {e.lines.map((l, i) => (
        <div className="muted small" style={{ display: 'flex', gap: 12 }} key={i}>
          <span style={{ minWidth: 60 }}>{l.account}</span>
          <span style={{ flex: 1 }}>{l.memo || ''}{l.section ? <b>{' [' + l.section + ']'}</b> : null}</span>
          <span style={{ minWidth: 90, textAlign: 'right' }}>{l.debit ? money(l.debit) : ''}</span>
          <span style={{ minWidth: 90, textAlign: 'right' }}>{l.credit ? money(l.credit) : ''}</span>
        </div>
      ))}
    </div>
  );
}

/** Ligne « compte + libellé + montant » des états. */
export function AmountLine({ x }) {
  const t = useT();
  const { money } = useWs();
  return (
    <div className="line">
      <span><b>{x.account}</b><small>{' ' + t(x.label)}</small></span>
      <span>{money(x.amount)}</span>
    </div>
  );
}
