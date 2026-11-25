import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, Icon, Loading } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import { NameBox } from './Chart.jsx';
import InfoForm from './InfoForm.jsx';
import { AddPerson, CodeBox, openPosts } from './People.jsx';
import PostForm from './PostForm.jsx';

/* Assistant « Configurer mon entreprise » : 5 étapes sautables et reprenables ; chaque action est enregistrée aussitôt (rien à perdre en fermant). */
const STEPS = ['info', 'dg', 'directions', 'departments', 'people'];

export default function Wizard({ close, onChange }) {
  const { oapi, can, fail, modal } = useWs();
  const t = useT();
  const [ov, setOv] = useState(null);
  const [chart, setChart] = useState(null);
  const [step, setStep] = useState(null);
  const label = { info: t("L'entreprise"), dg: t('Direction générale'), directions: t('Directions'), departments: t('Départements et postes'), people: t('Employés') };

  const load = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([oapi('GET', '/entreprise'), oapi('GET', '/entreprise/chart')]);
      setOv(o); setChart(c);
      setStep((cur) => cur || STEPS.find((s) => o.setup.steps[s] !== 'done' && o.setup.steps[s] !== 'skipped') || 'info');
      if (onChange) onChange();
    } catch (e) { fail(e); }
  }, [oapi, fail, onChange]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ov || !chart || !step) return <Loading />;
  if (!can('admin')) return <p className="muted">{t("Seuls les administrateurs configurent l'entreprise.")}</p>;

  const mark = (s, status) => oapi('PUT', '/entreprise/setup', { step: s, status }).then(() => load());
  const idx = STEPS.indexOf(step);
  const next = async (status) => {
    try {
      if (status) await mark(step, status); else await load();
      if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]); else close();
    } catch (e) { fail(e); }
  };
  const st = ov.setup.steps;
  const common = { ov, chart, reload: load };
  return (
    <div className="ent-wiz">
      <p className="muted">{t("Cinq étapes, toutes facultatives : passez celles que vous ne voulez pas faire maintenant, vous pourrez revenir à tout moment. Chaque changement est enregistré tout de suite.")}</p>
      <ol className="ent-steps" aria-label={t('Étapes')}>
        {STEPS.map((s, i) => (
          <li key={s}><button type="button" className={'ent-step' + (s === step ? ' cur' : '') + (st[s] === 'done' ? ' done' : st[s] === 'skipped' ? ' skip' : '')} aria-current={s === step ? 'step' : undefined} onClick={() => setStep(s)}>
            <span className="ent-n">{st[s] === 'done' ? <Icon name="check" /> : st[s] === 'skipped' ? <Icon name="minus" /> : i + 1}</span><span className="ent-sl">{label[s]}</span></button></li>
        ))}
      </ol>
      <div className="ent-body">
        {step === 'info' ? <><h3>{t("Informations de l'entreprise")}</h3><InfoForm ov={ov} wizard onSaved={() => next('done')} /></> : null}
        {step === 'dg' ? <StepDg {...common} /> : null}
        {step === 'directions' ? <StepDirections {...common} /> : null}
        {step === 'departments' ? <StepDepartments {...common} /> : null}
        {step === 'people' ? <StepPeople {...common} /> : null}
      </div>
      <div className="ent-foot">
        <Button variant="ghost" onClick={close}>{t('Plus tard')}</Button>
        <span className="grow" />
        {idx > 0 ? <Button onClick={() => setStep(STEPS[idx - 1])}>{t('Précédent')}</Button> : null}
        <Button onClick={() => next('skipped')}>{t('Passer cette étape')}</Button>
        {step !== 'info' ? <Button variant="primary" onClick={() => next('done')}>{idx === STEPS.length - 1 ? t('Terminer') : t('Enregistrer et continuer')}</Button> : null}
      </div>
    </div>
  );
}

function StepDg({ chart, reload }) {
  const { oapi, can, fail, toast, modal } = useWs();
  const t = useT();
  const owner = can('owner');
  const [sel, setSel] = useState(() => new Set(chart.dg.map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = () => { setBusy(true); oapi('PUT', '/entreprise/dg', { personIds: [...sel] }).then(() => { toast(t('Direction générale enregistrée.')); reload(); }).catch(fail).finally(() => setBusy(false)); };
  const add = () => modal(t('Ajouter une personne'), (close) => <AddPerson chart={chart} done={(fin) => { reload(); if (fin) close(); }} />, { wide: true });
  return (
    <>
      <h3>{t('Direction générale')}</h3>
      <p className="muted">{t("Un ou plusieurs directeurs généraux. Le dirigeant qui a créé le compte l'est déjà ; vous pouvez en ajouter. Ils voient la direction de l'entreprise et consultent tous les espaces.")}</p>
      <ul className="ent-list">
        {chart.people.map((p) => (
          <li className="ent-pick" key={p.id}><label><input type="checkbox" checked={sel.has(p.id)} disabled={!owner} onChange={() => toggle(p.id)} /> <b>{p.name}</b> <small className="muted">{p.status === 'invited' ? t('invitation en attente') : p.memberTitle}</small></label></li>
        ))}
      </ul>
      <div className="row"><Button icon="user-plus" onClick={add}>{t('Ajouter une personne')}</Button>{owner ? <Button variant="primary" loading={busy} onClick={save}>{t('Enregistrer la direction générale')}</Button> : <small className="muted">{t('Seul le propriétaire modifie la direction générale.')}</small>}</div>
    </>
  );
}

function StepDirections({ ov, chart, reload }) {
  const { oapi, fail, toast, modal } = useWs();
  const t = useT();
  const [tpl, setTpl] = useState(null);
  const [sector, setSector] = useState(ov.entreprise.sector || '');
  useEffect(() => { oapi('GET', '/entreprise/templates').then((j) => setTpl(j.sectors), () => {}); }, [oapi]);
  const apply = () => oapi('POST', '/entreprise/template', { sector }).then((j) => { toast(t('Modèle appliqué : {n} élément(s) ajouté(s).', { n: j.added.directions + j.added.departments + j.added.posts })); reload(); }).catch(fail);
  const upd = (d, patch) => oapi('PUT', '/entreprise/directions/' + d.id, patch).then(reload).catch(fail);
  const cur = tpl && tpl.find((s) => s.id === sector);
  return (
    <>
      <h3>{t('Directions du pilotage')}</h3>
      <div className="ent-tpl">
        <label className="fld"><span>{t('Modèle selon votre secteur')}</span>
          <select value={sector} onChange={(e) => setSector(e.target.value)}><option value="">{t('À choisir')}</option>{ov.sectors.map((s) => <option key={s.id} value={s.id}>{tsrv(s.title)}</option>)}</select></label>
        <Button icon="wand-magic-sparkles" disabled={!sector} onClick={apply}>{t('Appliquer le modèle')}</Button>
      </div>
      {cur ? <p className="muted small">{t("Départements proposés actifs : {list}. Rien n'est supprimé ni écrasé si vous réappliquez le modèle.", { list: cur.departments.map((d) => tsrv(d.name)).join(', ') })}</p> : <p className="muted small">{t("Le modèle prépare directions, départements et postes adaptés. Vous gardez la main : renommer, ajouter, désactiver.")}</p>}
      {chart.directions.length === 0 ? <p className="muted">{t("Aucune direction pour l'instant : appliquez un modèle ou ajoutez-en une.")}</p> : null}
      <ul className="ent-list">
        {chart.directions.map((d) => (
          <li className="ent-row" key={d.id}>
            <label className="ent-chk"><input type="checkbox" checked={d.active} onChange={(e) => upd(d, { active: e.target.checked })} aria-label={t('Active')} /></label>
            <div className="ent-row-b"><b>{tsrv(d.name)}</b>{d.directors[0] ? <small className="muted"> · {tsrv(d.directors[0].title)}</small> : null}</div>
            <Button size="sm" variant="ghost" icon="pen" label={t('Renommer')} iconOnly onClick={() => modal(t('Renommer la direction'), (close) => <NameBox chart={chart} kind="rename-dir" item={d} done={() => { close(); reload(); }} />)} />
          </li>
        ))}
      </ul>
      <div className="row"><Button icon="plus" onClick={() => modal(t('Nouvelle direction'), (close) => <NameBox chart={chart} kind="direction" done={() => { close(); reload(); }} />)}>{t('Ajouter une direction')}</Button></div>
    </>
  );
}

/** Choix rapide de la personne d'un poste (directeur, responsable) : change l'affectation en une action. */
function Holder({ post, people, reload }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const cur = post.holders[0];
  const change = async (v) => {
    try {
      if (cur) await oapi('DELETE', '/entreprise/assignments/' + cur.assignmentId);
      if (v) await oapi('POST', '/entreprise/assignments', { postId: post.id, personId: Number(v) });
      reload();
    } catch (e) { fail(e); reload(); }
  };
  return (
    <select value={cur ? cur.personId : ''} onChange={(e) => change(e.target.value)} aria-label={t('Personne du poste {poste}', { poste: tsrv(post.title) })}>
      <option value="">{t('Poste vacant')}</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

function StepDepartments({ chart, reload }) {
  const { oapi, fail, modal } = useWs();
  const t = useT();
  const upd = (path, patch) => oapi('PUT', path, patch).then(reload).catch(fail);
  const depts = [...chart.directions.filter((d) => d.active).flatMap((d) => d.departments), ...chart.departments];
  return (
    <>
      <h3>{t('Départements et postes')}</h3>
      <p className="muted">{t("Cochez ce qui existe chez vous. Pour chaque directeur ou responsable, choisissez la personne (elle reçoit alors ses espaces automatiquement) ; les autres postes se remplissent à l'étape suivante.")}</p>
      {depts.length === 0 ? <p className="muted">{t("Aucun département : appliquez un modèle à l'étape précédente ou ajoutez-en un.")}</p> : null}
      {chart.directions.filter((d) => d.active).map((dir) => (
        <section className="ent-wd" key={'dir' + dir.id}>
          <h4><Icon name="sitemap" /> {tsrv(dir.name)}</h4>
          <ul className="ent-list">{dir.directors.map((p) => <PostRow key={p.id} p={p} chart={chart} reload={reload} upd={upd} />)}</ul>
          {dir.departments.map((d) => <DeptBlock key={d.id} d={d} chart={chart} reload={reload} upd={upd} />)}
        </section>
      ))}
      {chart.departments.length ? <section className="ent-wd"><h4><Icon name="folder" /> {t('Autres départements')}</h4>{chart.departments.map((d) => <DeptBlock key={d.id} d={d} chart={chart} reload={reload} upd={upd} />)}</section> : null}
      <div className="row"><Button icon="plus" onClick={() => modal(t('Nouveau département'), (close) => <NameBox chart={chart} kind="department" done={() => { close(); reload(); }} />)}>{t('Ajouter un département')}</Button></div>
    </>
  );
}

function DeptBlock({ d, chart, reload, upd }) {
  const { modal } = useWs();
  const t = useT();
  return (
    <div className={'ent-wdept' + (d.active ? '' : ' off')}>
      <div className="ent-row">
        <label className="ent-chk"><input type="checkbox" checked={d.active} onChange={(e) => upd('/entreprise/departments/' + d.id, { active: e.target.checked })} aria-label={t('Actif')} /></label>
        <div className="ent-row-b"><b><Icon name="folder-open" /> {tsrv(d.name)}</b></div>
        <Button size="sm" variant="ghost" icon="plus" onClick={() => modal(t('Nouveau poste'), (close) => <PostForm departmentId={d.id} done={() => { close(); reload(); }} />, { wide: true })}>{t('Poste')}</Button>
      </div>
      {d.active ? <ul className="ent-list ent-sub">{d.posts.map((p) => <PostRow key={p.id} p={p} chart={chart} reload={reload} upd={upd} />)}</ul> : null}
    </div>
  );
}

function PostRow({ p, chart, reload, upd }) {
  const t = useT();
  const quick = p.kind !== 'staff';
  return (
    <li className={'ent-row' + (p.active ? '' : ' off')}>
      <label className="ent-chk"><input type="checkbox" checked={p.active} onChange={(e) => upd('/entreprise/posts/' + p.id, { active: e.target.checked })} aria-label={t('Poste actif')} /></label>
      <div className="ent-row-b"><span>{tsrv(p.title)}</span> {p.kind !== 'staff' ? <Badge tone="brand">{p.kind === 'director' ? t('Directeur') : t('Responsable')}</Badge> : null}{p.headcount > 1 ? <small className="muted"> · {t('{n} places', { n: p.headcount })}</small> : null}</div>
      {quick && p.active ? <Holder post={p} people={chart.people} reload={reload} /> : null}
    </li>
  );
}

function StepPeople({ chart, reload }) {
  const { modal } = useWs();
  const t = useT();
  const add = () => modal(t('Ajouter une personne'), (close) => <AddPerson chart={chart} done={(fin) => { reload(); if (fin) close(); }} />, { wide: true });
  const vac = openPosts(chart).reduce((s, p) => s + p.vacant, 0);
  return (
    <>
      <h3>{t('Employés')}</h3>
      <p className="muted">{t("Ajoutez les personnes une à une : chacune reçoit son code d'invitation personnel (à usage unique) et retrouve son poste en arrivant. Aucune adresse e-mail n'est obligatoire.")}</p>
      <div className="row"><Button variant="primary" icon="user-plus" onClick={add}>{t('Ajouter une personne')}</Button><Badge tone={vac ? 'warn' : 'ok'}>{vac ? t('{n} place(s) à pourvoir', { n: vac }) : t('Tous les postes sont pourvus')}</Badge></div>
      <ul className="ent-list">
        {chart.people.map((p) => (
          <li className="ent-person" key={p.id}>
            <div className="ent-person-h"><span className="ent-av" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span><div><b>{p.name}</b><div className="muted small">{p.posts.map((x) => tsrv(x.title)).join(', ') || t('Aucun poste')}</div></div>
              <Badge tone={p.status === 'invited' ? 'warn' : 'ok'}>{p.status === 'invited' ? t('Invitation en attente') : t('Dans l’équipe')}</Badge></div>
            {p.status === 'invited' && p.inviteCode ? <CodeBox code={p.inviteCode} name={p.name} /> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
