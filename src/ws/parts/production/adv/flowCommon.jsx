import { useEffect, useState } from 'react';
import { useWs } from '../../../WsContext.jsx';
import { useT } from '../../../../lib/i18n.jsx';
import { tsrv } from '../../../../lib/srv.js';
import { Alert, Button, Card, EmptyState } from '../../../ui/index.jsx';
import { Loaded, useLoad } from '../../../ui.jsx';
import { Cell } from '../../projects/ro-common.jsx';
import { FindingCard, findingText, stepBody } from '../Flow.jsx';
import { EdTable, Pick } from './common.jsx';

/* Production · Lean, TOC et JIT : briques communes. Ces trois techniques se calculent sur un circuit de production (onglet « Circuit de production »).
   FlowTech : sélecteur de circuit, chargement du résultat (/production/flows/:id/:tech) et du circuit complet, actions sur les avis, enregistrement du circuit. */

let lastSel = null; // le circuit choisi est gardé quand on passe d'une technique à l'autre

const cut = (s, n) => (tsrv(s).length > n ? tsrv(s).slice(0, n - 1) + '…' : tsrv(s));
export { cut };

function Body({ id, tech, children }) {
  const { oapi, can, fail, toast } = useWs();
  const t = useT();
  const st = useLoad(() => Promise.all([oapi('GET', `/production/flows/${id}/${tech}`), oapi('GET', `/production/flows/${id}`)]), [id, tech]);
  const act = (path, body, msg) => oapi('POST', `/production/flows/${id}/${path}`, body).then(() => { st.reload(); if (msg) toast(msg); }).catch(fail);
  /** patch : { steps?, extra?, targetPerDay?, hoursPerDay? } ; les étapes non fournies restent telles quelles. */
  const save = (flow, patch) => oapi('PUT', `/production/flows/${id}`, { name: flow.name, targetPerDay: flow.targetPerDay, hoursPerDay: flow.hoursPerDay, extra: flow.extra, steps: flow.steps.map(stepBody), ...patch })
    .then(() => { toast(t('Circuit enregistré.')); st.reload(); }).catch(fail);
  return <Loaded state={st}>{([r, flow]) => children({ r, flow, mgr: can('manager'), act, save: (patch) => save(flow, patch) })}</Loaded>;
}

/** Cadre commun : choix du circuit puis contenu children({ r, flow, mgr, act, save }). */
export function FlowTech({ tech, title, subtitle, children }) {
  const t = useT();
  const { oapi } = useWs();
  const list = useLoad(() => oapi('GET', '/production/flows'), []);
  const [sel, setSel] = useState(lastSel);
  const items = list.data ? list.data.items : [];
  useEffect(() => {
    if (!items.length) return;
    if (sel === null || !items.some((x) => x.id === sel)) { setSel(items[0].id); lastSel = items[0].id; }
  }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Card title={title} subtitle={subtitle}>
        <Loaded state={list}>{(d) => (!d.items.length
          ? <EmptyState icon="gear" title={t('Aucun circuit de production')}>{t('Cette technique s\'appuie sur un circuit : créez-en un dans l\'onglet « Circuit de production » (un modèle par secteur est proposé), puis revenez ici.')}</EmptyState>
          : (
            <div style={{ maxWidth: 420 }}>
              <label className="muted small" style={{ display: 'block' }}>{t('Circuit analysé')}</label>
              <Pick label={t('Circuit analysé')} value={sel === null ? '' : String(sel)} onChange={(v) => { setSel(Number(v)); lastSel = Number(v); }} options={d.items.map((c) => [String(c.id), c.name])} />
            </div>
          ))}
        </Loaded>
      </Card>
      {sel !== null && items.some((x) => x.id === sel) ? <Body key={sel} id={sel} tech={tech}>{children}</Body> : null}
    </>
  );
}

/** Avis du circuit dont le code est dans `codes`, avec boutons « appliquer la solution » / « écarter » (responsables) ; avis écartés repliés. */
export function FindingsBlock({ flow, codes, mgr, act, title, subtitle, okText }) {
  const t = useT();
  const [showOff, setShowOff] = useState(false);
  const all = flow.analysis.findings.filter((f) => codes.includes(f.code));
  const open = all.filter((f) => f.state === 'open'); const off = all.filter((f) => f.state === 'dismissed');
  return (
    <Card title={title} subtitle={subtitle}>
      {!open.length ? <Alert tone="ok" title={t('Aucun point à traiter')}>{okText}</Alert> : null}
      {open.map((x) => <FindingCard key={x.key} x={x} mgr={mgr} act={act} />)}
      {off.length ? <p><button className="link" type="button" onClick={() => setShowOff(!showOff)}>{showOff ? t('Masquer') : t('Voir')} {t('les {n} faille(s) écartée(s)', { n: off.length })}</button></p> : null}
      {showOff ? off.map((x) => (
        <div key={x.key} className={'ro-find off ' + x.severity}>
          <h3>{findingText(x, t)[0]}</h3>
          {mgr ? <Button size="sm" onClick={() => act('dismiss', { key: x.key, restore: true })}>{t('Rétablir')}</Button> : null}
        </div>
      )) : null}
    </Card>
  );
}

/**
 * Tableau de saisie rapide des champs d'étape. fields : [{ k, label, type: 'num' | 'bool' | 'text' | 'cls' }].
 * Enregistrer renvoie TOUTES les étapes avec tous leurs champs (le serveur remplace la liste).
 */
export function StepEditor({ flow, fields, mgr, save, title, subtitle }) {
  const t = useT();
  const [steps, setSteps] = useState(() => JSON.parse(JSON.stringify(flow.steps)));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSteps(JSON.parse(JSON.stringify(flow.steps))); setDirty(false); }, [flow]);
  const set = (i, k, v) => { setSteps((l) => l.map((s, j) => (j === i ? { ...s, [k]: v } : s))); setDirty(true); };
  const cell = (s, i, f) => {
    if (f.type === 'bool') return <input type="checkbox" aria-label={f.label} checked={Boolean(s[f.k])} onChange={(e) => set(i, f.k, e.target.checked)} />;
    if (f.type === 'cls') return <Pick label={f.label} value={s.cls || ''} onChange={(v) => set(i, 'cls', v || null)} options={[['', t('Automatique (selon le type)')], ['va', t('Valeur ajoutée')], ['bnva', t('Nécessaire sans valeur ajoutée')], ['nva', t('Gaspillage')]]} />;
    return <Cell type={f.type === 'text' ? 'text' : 'number'} label={f.label} value={s[f.k]} step={f.step} onChange={(v) => set(i, f.k, v)} />;
  };
  const submit = () => { setBusy(true); save({ steps: steps.map(stepBody) }).finally(() => setBusy(false)); };
  return (
    <Card title={title} subtitle={subtitle}>
      <fieldset disabled={!mgr} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <EdTable empty={t('Le circuit n\'a pas d\'étape.')} head={[t('Étape')].concat(fields.map((f) => f.label))}
          rows={steps.map((s, i) => [<b key="n">{i + 1}. {cut(s.name, 28)}</b>].concat(fields.map((f) => cell(s, i, f))))} />
      </fieldset>
      {mgr ? <div className="row" style={{ marginTop: 10 }}><Button variant="primary" icon="check" loading={busy} disabled={!dirty} onClick={submit}>{t('Enregistrer et recalculer')}</Button></div> : <p className="muted small">{t('Consultation seule : seuls les responsables modifient ces hypothèses.')}</p>}
      {dirty ? <p className="muted small">{t('Modifications non enregistrées : enregistrez pour mettre à jour les résultats.')}</p> : null}
    </Card>
  );
}
