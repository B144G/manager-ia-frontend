import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Button, Card, Table } from '../../ui/index.jsx';
import { Loaded, useLoad } from '../../ui.jsx';
import { downloadFile, frDate } from './util.jsx';

/* Administration : qui peut saisir (désigné par le responsable du compte), journal de traçabilité, exports. */

export function Settings({ H }) {
  const st = useLoad(() => H.oapi('GET', '/history/settings'), []);
  return (
    <Loaded state={st}>{(s) => <SettingsBody H={H} s={s} />}</Loaded>
  );
}
function SettingsBody({ H, s }) {
  const t = useT();
  const [role, setRole] = useState(s.editMinRole);
  const [ids, setIds] = useState(() => new Set(s.editorIds));
  const [busy, setBusy] = useState(false);
  const rl = { member: t('Tous les membres'), manager: t('Responsables et au-dessus'), admin: t('Administrateurs et propriétaire') };
  const save = async () => {
    setBusy(true);
    try { await H.oapi('PUT', '/history/settings', { editMinRole: role, editorIds: [...ids] }); H.toast(t('Droits enregistrés.')); H.reload(); } catch (e) { H.fail(e); }
    setBusy(false);
  };
  const toggle = (id) => setIds((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Card title={t('Qui peut saisir l’histoire ?')} subtitle={t('Tout le monde peut lire. Vous choisissez qui peut ajouter ou modifier.')}>
      <div className="hst-form">
        <label className="fld"><span>{t('Rôle minimum pour saisir')}</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>{s.roles.map((r) => <option key={r} value={r}>{rl[r]}</option>)}</select>
        </label>
        <div><b>{t('Personnes désignées en plus')}</b>
          <div className="hst-people-pick" style={{ marginTop: 6 }}>{s.members.map((m) => <label key={m.userId}><input type="checkbox" checked={ids.has(m.userId)} onChange={() => toggle(m.userId)} />{m.name}</label>)}</div>
        </div>
        <Alert tone="info">{t("Le propriétaire peut toujours saisir. Les événements et médias « direction seulement » ne sont visibles que des administrateurs.")}</Alert>
        <div className="row"><Button variant="primary" loading={busy} onClick={save}>{t('Enregistrer')}</Button></div>
      </div>
    </Card>
  );
}

export function Journal({ H }) {
  const t = useT();
  const st = useLoad(() => H.oapi('GET', '/history/journal'), [H.tick]);
  const act = { create: t('Création'), update: t('Modification'), delete: t('Suppression'), import: t('Import'), csv: t('Export CSV'), pdf: t('Export PDF') };
  const sum = (x) => (x ? Object.entries(x).filter(([, v]) => v !== null && v !== '' && v !== undefined).map(([k, v]) => `${k} : ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ').slice(0, 220) : '');
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Alert tone="info">{t('Chaque ajout, modification, suppression ou export est inscrit ici, avec la personne et l’heure. Les 300 derniers sont affichés.')}</Alert>
        <Table caption={t('Journal de traçabilité')} empty={t('Aucune modification enregistrée.')} rows={j.entries}
          columns={[
            { key: 'at', label: t('Quand'), render: (r) => frDate(r.at) + ' ' + String(r.at).slice(11, 16) },
            { key: 'by', label: t('Qui') },
            { key: 'action', label: t('Action'), render: (r) => `${act[r.action] || r.action} — ${r.entityLabel}` },
            { key: 'detail', label: t('Détail'), render: (r) => <span className="small" style={{ overflowWrap: 'anywhere' }}>{r.action === 'update' ? `${sum(r.before)} → ${sum(r.after)}` : sum(r.after || r.before)}</span> },
          ]} />
      </>
    )}</Loaded>
  );
}

export function Exports({ H }) {
  const t = useT();
  const go = (path, name) => downloadFile(H.orgId, path, name).catch(H.fail);
  return (
    <>
      <Button size="sm" icon="file-pdf" onClick={() => go('/export.pdf', 'histoire-entreprise.pdf')}>{t('PDF')}</Button>
      <Button size="sm" icon="download" onClick={() => go('/export.csv', 'histoire-evenements.csv')}>{t('CSV événements')}</Button>
      <Button size="sm" icon="download" onClick={() => go('/export.csv?what=people', 'histoire-personnes.csv')}>{t('CSV personnes')}</Button>
    </>
  );
}
