import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, ChartFrame, Form, Loaded, Stat, Table, Tabs, useLoad } from '../../ui.jsx';
import { Bars } from '../../charts/lazy.jsx';
import { day, when } from './util.jsx';

/* Archivage et conservation : cycle de vie, échéancier, validation puis destruction avec certificat, gels légaux. Les règles sont appliquées par le serveur. */

const LIFE = { active: 'Actif', semi: 'Semi-actif', archived: 'Archivé', destroy_due: 'À détruire', destroyed: 'Détruit' };

function Schedule({ L, reload }) {
  const t = useT();
  const { toast, confirm, can } = useWs();
  const [state, setState] = useState('destroy_due');
  const [sel, setSel] = useState([]);
  const st = useLoad(() => L.lib('GET', `/archive/schedule?state=${state}`), [state, L.tick]);
  const fail = (e) => toast(tsrv(e.message), true);
  const done = () => { setSel([]); st.reload(); reload(); };
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const destroy = () => confirm(t('Détruire {n} notice(s) ? Les documents numériques liés sont effacés définitivement. Un certificat de destruction est établi.', { n: sel.length }), () => L.lib('POST', '/archive/destroy', { ids: sel, confirm: true, method: t('Effacement définitif') }).then((r) => { toast(t('{n} certificat(s) établi(s).', { n: r.certificates.length })); done(); }, fail), t('Détruire définitivement'));
  return (
    <>
      <Tabs items={Object.keys(LIFE).filter((k) => k !== 'destroyed').map((k) => ({ id: k, label: t(LIFE[k]) }))} value={state} onChange={(v) => { setState(v); setSel([]); }} label={t('Étape')} />
      {sel.length ? (
        <div className="row lib-actions"><b>{t('{n} sélectionnée(s)', { n: sel.length })}</b>
          {state === 'destroy_due' ? <button className="btn small" type="button" onClick={() => L.lib('POST', '/archive/validate', { ids: sel }).then((r) => { toast(t('{n} notice(s) validée(s) pour destruction.', { n: r.validated })); done(); }, fail)}>{t('Valider la destruction')}</button> : null}
          {state === 'destroy_due' ? <button className="btn small" type="button" onClick={() => L.lib('POST', '/archive/unvalidate', { ids: sel }).then(done, fail)}>{t('Retirer la validation')}</button> : null}
          {state === 'destroy_due' && can('admin') ? <button className="btn small" type="button" onClick={destroy}>{t('Détruire…')}</button> : null}
          {state !== 'destroy_due' ? ['active', 'semi', 'archived'].filter((k) => k !== state).map((k) => <button key={k} className="btn small" type="button" onClick={() => L.lib('POST', '/archive/transition', { ids: sel, to: k }).then(done, fail)}>{t('Passer en « {step} »', { step: t(LIFE[k]) })}</button>) : null}
        </div>
      ) : null}
      <Loaded state={st}>{(j) => (
        <Table caption={t('Échéancier')} empty={t('Aucune notice à cette étape.')} rows={j.records}
          columns={[
            { key: 'sel', label: '', render: (r) => <input type="checkbox" className="lib-sel" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} aria-label={t('Sélectionner « {name} »', { name: r.title })} /> },
            { key: 'title', label: t('Ressource'), render: (r) => <span><b>{r.title}</b><br /><small className="mono muted">{r.inventoryNo}</small></span> },
            { key: 'classCode', label: t('Classe') },
            { key: 'retUntil', label: t('Échéance'), render: (r) => (r.retUntil ? day(r.retUntil) : '—') },
            { key: 'flags', label: t('État'), render: (r) => <span className="row">{r.validated ? <Badge tone="info">{t('Validée')}</Badge> : null}{r.held ? <Badge tone="danger">{t('Gel légal')}</Badge> : null}{r.sealed ? <Badge tone="neutral">{t('Scellée')}</Badge> : null}</span> },
          ]} />
      )}
      </Loaded>
    </>
  );
}

function Holds({ L }) {
  const t = useT();
  const { toast, can } = useWs();
  const st = useLoad(() => L.lib('GET', '/archive/holds'), [L.tick]);
  const fail = (e) => toast(tsrv(e.message), true);
  return (
    <div className="ws-cols">
      <div className="ws-card"><h2>{t('Gels légaux')}</h2>
        <p className="muted small">{t("Une notice sous gel légal ne peut être ni détruite, ni modifiée, ni supprimée, tant que le gel n'est pas levé (litige, contrôle, enquête).")}</p>
        <Loaded state={st}>{(j) => (j.holds.length ? <ul className="lib-audit">{j.holds.map((x) => (
          <li key={x.id} className={x.active ? '' : 'muted'}><b>{x.name}</b><span>{x.reason || '—'} · {t('{n} notice(s)', { n: x.items })} · {x.createdBy} · {day(x.createdAt)}</span>
            {x.active && can('admin') ? <button className="btn small" type="button" onClick={() => L.lib('POST', `/archive/holds/${x.id}/release`, {}).then(() => { toast(t('Gel levé.')); st.reload(); }, fail)}>{t('Lever le gel')}</button> : <Badge>{t('Levé')}</Badge>}</li>))}</ul> : <p className="ws-empty">{t('Aucun gel légal.')}</p>)}</Loaded></div>
      {can('admin') ? <div className="ws-card"><h2>{t('Poser un gel légal')}</h2>
        <Form submitText={t('Poser le gel')} fields={[{ k: 'name', label: t('Nom'), required: true, value: '' }, { k: 'reason', label: t('Motif'), value: '' }, { k: 'classId', label: t('Numéro de classe à geler (facultatif)'), type: 'number', value: '' }, { k: 'ids', label: t('Numéros de notices (séparés par des virgules)'), value: '' }]}
          onSubmit={(v) => L.lib('POST', '/archive/holds', { name: v.name, reason: v.reason, ...(v.classId ? { classId: Number(v.classId) } : {}), recordIds: v.ids.split(',').map((x) => Number(x.trim())).filter(Boolean) }).then((r) => { toast(t('{n} notice(s) sous gel légal.', { n: r.items })); st.reload(); })} /></div> : null}
    </div>
  );
}

function Certificates({ L }) {
  const t = useT();
  const { modal } = useWs();
  const st = useLoad(() => L.lib('GET', '/archive/certificates'), [L.tick]);
  const chain = useLoad(() => L.lib('GET', '/archive/certificates/verify'), [L.tick]);
  const open = (c) => modal(c.certNo, () => <Cert L={L} id={c.id} />, { wide: true });
  return (
    <>
      <Loaded state={chain}>{(j) => <Alert tone={j.ok ? 'success' : 'danger'} title={j.ok ? t('Chaîne des certificats intacte ({n})', { n: j.count }) : t('Altération détectée au certificat {no}', { no: j.brokenAt })}>{t("Chaque certificat porte une empreinte qui dépend du précédent : retirer ou modifier un certificat casse la chaîne.")}</Alert>}</Loaded>
      <Loaded state={st}>{(j) => <Table caption={t('Certificats de destruction')} empty={t('Aucune destruction.')} rows={j.certificates} onRowClick={open}
        columns={[{ key: 'certNo', label: t('Certificat') }, { key: 'title', label: t('Ressource') }, { key: 'destroyedAt', label: t('Date'), render: (c) => when(c.destroyedAt) }, { key: 'validatedBy', label: t('Validée par') }, { key: 'destroyedBy', label: t('Détruite par') }, { key: 'method', label: t('Méthode') }]} />}</Loaded>
    </>
  );
}
function Cert({ L, id }) {
  const t = useT();
  const st = useLoad(() => L.lib('GET', `/archive/certificates/${id}`), [id]);
  return (
    <Loaded state={st}>{({ certificate: c }) => (
      <div>
        <div className="row lib-noprint"><button className="btn primary small" type="button" onClick={() => window.print()}>{t('Imprimer')}</button></div>
        <h2>{t('Certificat de destruction {no}', { no: c.certNo })}</h2>
        <dl className="lib-meta">
          <div><dt>{t('Ressource')}</dt><dd>{c.title}</dd></div><div><dt>{t("Numéro d'inventaire")}</dt><dd className="mono">{c.inventoryNo}</dd></div>
          <div><dt>{t('Classe')}</dt><dd>{c.classCode || '—'}</dd></div><div><dt>{t('Échéance de conservation')}</dt><dd>{c.retentionUntil ? day(c.retentionUntil) : '—'}</dd></div>
          <div><dt>{t('Validée par')}</dt><dd>{c.validatedBy}</dd></div><div><dt>{t('Détruite par')}</dt><dd>{c.destroyedBy}</dd></div>
          <div><dt>{t('Date')}</dt><dd>{when(c.destroyedAt)}</dd></div><div><dt>{t('Méthode')}</dt><dd>{c.method}</dd></div>
          {c.documentName ? <div><dt>{t('Document détruit')}</dt><dd>{c.documentName}</dd></div> : null}
          {c.documentSha256 ? <div><dt>{t('Empreinte du document')}</dt><dd className="mono lib-hash">{c.documentSha256}</dd></div> : null}
          <div><dt>{t('Empreinte du certificat')}</dt><dd className="mono lib-hash">{c.hash}</dd></div>
        </dl>
      </div>
    )}
    </Loaded>
  );
}

export default function Archive({ L }) {
  const t = useT();
  const { toast, can } = useWs();
  const [tab, setTab] = useState('schedule');
  const ov = useLoad(() => L.lib('GET', '/archive/overview'), [L.tick]);
  return (
    <>
      <div className="ws-head"><div><h1>{t('Archivage et conservation')}</h1><p className="muted">{t("Chaque classe fixe une durée de conservation. À l'échéance, la ressource est détruite (après validation, avec certificat) ou archivée pour de bon.")}</p></div>
        {can('admin') ? <div className="row"><button className="btn small" type="button" onClick={() => L.lib('POST', '/archive/sweep', {}).then((r) => { toast(t('{n} notice(s) changent d’étape.', { n: r.changed })); ov.reload(); L.reload(); }, (e) => toast(tsrv(e.message), true))}>{t('Recalculer les échéances')}</button></div> : null}</div>
      <Loaded state={ov}>{(j) => {
        const horizon = j.horizon.map((x) => ({ x: x.month.slice(2), n: x.count }));
        return (
          <>
            {j.overdue ? <Alert tone="warn" title={t('{n} échéance(s) dépassée(s)', { n: j.overdue })}>{t('Ces ressources sont arrivées au terme de leur conservation.')}</Alert> : null}
            <div className="ui-stats">
              {j.lifecycle.map((x) => <Stat key={x.value} label={t(x.label)} value={x.count} tone={x.value === 'destroy_due' && x.count ? 'warn' : 'brand'} />)}
              <Stat label={t('Validées')} value={j.validated} tone="info" /><Stat label={t('Gels légaux')} value={j.held} tone={j.held ? 'danger' : 'ok'} /><Stat label={t('Scellées')} value={j.sealed} /><Stat label={t('Sans durée fixée')} value={j.withoutRetention} tone={j.withoutRetention ? 'warn' : 'ok'} />
            </div>
            <div className="ws-card"><ChartFrame title={t('Échéances à venir (24 mois)')} height={220} summary={horizon.filter((h) => h.n).map((h) => `${h.x} ${h.n}`).join(', ') || t('Aucune échéance')}>
              <Bars data={horizon} height={220} series={[{ key: 'n', label: t('Échéances'), color: 'var(--c4)' }]} /></ChartFrame></div>
          </>
        );
      }}
      </Loaded>
      <Tabs items={[{ id: 'schedule', label: t('Échéancier') }, { id: 'holds', label: t('Gels légaux') }, { id: 'certs', label: t('Certificats') }]} value={tab} onChange={setTab} label={t('Archivage')} />
      {tab === 'schedule' ? <Schedule L={L} reload={ov.reload} /> : tab === 'holds' ? <Holds L={L} /> : <Certificates L={L} />}
    </>
  );
}
