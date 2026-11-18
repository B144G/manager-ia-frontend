import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, EmptyState, Loading, useLoad } from '../../ui.jsx';
import { Failed, useCp, useL } from './common.jsx';

/* Doublons : groupes de fiches qui semblent être la même personne ou entreprise. On choisit la fiche à garder ; les autres sont fusionnées dedans. */

function Group({ g, onMerged }) {
  const t = useT();
  const L = useL();
  const { api, fail, openAccount } = useCp();
  const { modal, money } = useWs();
  const best = [...g.accounts].sort((a, b) => b.invoices - a.invoices || b.revenue - a.revenue || a.id - b.id)[0];
  const [keep, setKeep] = useState(best.id);
  const others = g.accounts.filter((a) => a.id !== keep);
  const [skip, setSkip] = useState(() => new Set());
  const ids = others.filter((a) => !skip.has(a.id)).map((a) => a.id);
  const toggle = (id) => setSkip((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const keepRow = g.accounts.find((a) => a.id === keep);
  const run = () => modal(t('Confirmer la fusion'), (close) => (
    <div>
      <p>{t('Les fiches suivantes seront fusionnées dans « {nom} » puis supprimées. Leurs factures, contacts, tâches, opportunités et conversations seront rattachés à la fiche conservée. Cette action ne peut pas être annulée.', { nom: keepRow.name })}</p>
      <ul>{g.accounts.filter((a) => ids.includes(a.id)).map((a) => <li key={a.id}>{a.name} <span className="muted small">({t('{n} facture(s)', { n: a.invoices })})</span></li>)}</ul>
      <div className="row"><Button variant="danger" onClick={() => { close(); api('POST', '/accounts/merge', { keepId: keep, mergeIds: ids }).then((r) => {
        const parts = Object.entries(r.moved || {}).map(([k, n]) => `${n} ${L.moved[k] || k}`);
        modal(t('Fusion terminée'), (c2) => <div><p>{t('{n} fiche(s) fusionnée(s) dans « {nom} ».', { n: r.merged.length, nom: keepRow.name })}</p><p>{parts.length ? t('Éléments rattachés : {liste}.', { liste: parts.join(', ') }) : t('Aucun élément à rattacher.')}</p><Button variant="primary" onClick={c2}>{t('Fermer')}</Button></div>);
        onMerged();
      }, fail); }}>{t('Fusionner')}</Button><Button onClick={close}>{t('Annuler')}</Button></div>
    </div>
  ));
  return (
    <Card title={g.accounts.map((a) => a.name).slice(0, 2).join(' / ')} subtitle={g.reasons.map((r) => L.dupReason[r] || r).join(', ')}>
      <fieldset className="cp-fs">
        <legend className="sr-only">{t('Fiche à conserver')}</legend>
        {g.accounts.map((a) => (
          <div className="cp-dup" key={a.id}>
            <label className="cp-check"><input type="radio" name={'keep' + g.accounts[0].id} checked={keep === a.id} onChange={() => setKeep(a.id)} /> <b>{a.name}</b> {keep === a.id ? <Badge tone="ok">{t('À conserver')}</Badge> : null}</label>
            <div className="small muted">{[a.phone, a.email, a.city].filter(Boolean).join(' · ')} · {t('{n} facture(s)', { n: a.invoices })} · {money(a.revenue)}</div>
            <div className="row">
              {keep !== a.id ? <label className="cp-check small"><input type="checkbox" checked={!skip.has(a.id)} onChange={() => toggle(a.id)} /> {t('Fusionner dans la fiche conservée')}</label> : null}
              <Button size="sm" variant="ghost" onClick={() => openAccount(a.id)}>{t('Voir la fiche')}</Button>
            </div>
          </div>
        ))}
      </fieldset>
      <div className="row"><Button variant="primary" disabled={!ids.length} onClick={run}>{t('Fusionner {n} fiche(s)', { n: ids.length })}</Button></div>
    </Card>
  );
}

export default function Duplicates() {
  const t = useT();
  const { api, tick, bump } = useCp();
  const st = useLoad(() => api('GET', '/duplicates'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  return (
    <div className="cp-stack">
      <Alert tone="info">{t('Deux fiches sont jugées semblables si elles ont le même téléphone, le même e-mail ou un nom très proche. Vérifiez avant de fusionner.')}</Alert>
      {!st.data.groups.length ? <EmptyState icon="circle-check" title={t('Aucun doublon détecté.')} /> : st.data.groups.map((g) => <Group key={g.accounts.map((a) => a.id).join('-')} g={g} onMerged={() => { st.reload(); bump(); }} />)}
    </div>
  );
}
