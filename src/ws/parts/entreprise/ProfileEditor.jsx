import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, Card, Loaded, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import { MODULE_TITLES, SPACE_TITLE } from './lib.js';

/* Profils de rôle : l'entreprise adapte les blocs du tableau de bord, les écrans, les actions rapides et le mode mobile de chaque profil. Un profil ne donne aucun droit. */
export default function ProfileEditor() {
  const { oapi, can, modal, confirm, fail, toast } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/entreprise/profiles'), []);
  const edit = can('admin');
  const reset = (p) => confirm(t('Revenir au profil de base « {nom} » ? Vos modifications seront perdues.', { nom: tsrv(p.title) }), () => oapi('DELETE', '/entreprise/profiles/' + p.key).then(() => { toast(t('Profil réinitialisé.')); st.reload(); }).catch(fail), t('Réinitialiser'));
  return (
    <Card title={t('Profils de rôle')} subtitle={t("Chaque poste a un profil : ce qu'il voit en arrivant, ses écrans et ses actions rapides. Le profil n'ouvre aucun droit en plus de ceux du poste.")}>
      <Loaded state={st}>{(j) => (
        <ul className="ent-list">
          {j.profiles.map((p) => (
            <li className="ent-person" key={p.key}>
              <div className="ent-person-h"><div><b>{tsrv(p.title)}</b><div className="muted small">{tsrv(p.desc)}</div></div>
                {p.custom ? <Badge tone="brand">{t('Modifié')}</Badge> : <Badge>{t('De base')}</Badge>}
                <Badge tone={p.config.mobile.layout === 'driver' ? 'warn' : 'neutral'}>{p.config.mobile.layout === 'driver' ? t('Écran mobile chauffeur') : p.config.mobile.layout === 'compact' ? t('Mobile compact') : t('Mobile standard')}</Badge></div>
              <div className="ent-holders">{p.posts.length ? p.posts.map((x, i) => <span className="ent-chip" key={i}>{tsrv(x)}</span>) : <span className="muted small">{t('Aucun poste actif ne l\'utilise')}</span>}</div>
              <div className="muted small">{t('{b} bloc(s) · {m} écran(s) · {q} action(s) rapide(s)', { b: p.config.blocks.length, m: p.config.modules.length, q: p.config.quick.length })}</div>
              {edit ? <div className="ent-actions">
                <Button size="sm" icon="pen" onClick={() => modal(t('Profil : {nom}', { nom: tsrv(p.title) }), (close) => <Editor p={p} cat={j.catalogue} done={() => { close(); st.reload(); }} />, { wide: true })}>{t('Modifier')}</Button>
                {p.custom ? <Button size="sm" variant="ghost" icon="refresh" onClick={() => reset(p)}>{t('Revenir au profil de base')}</Button> : null}
              </div> : null}
            </li>
          ))}
        </ul>
      )}</Loaded>
    </Card>
  );
}

function Editor({ p, cat, done }) {
  const { oapi, fail, toast } = useWs();
  const t = useT();
  const [c, setC] = useState(() => JSON.parse(JSON.stringify(p.config)));
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState('tasks');
  const bl = (b) => b.type === 'tiles' ? t('Indicateurs : {espace}', { espace: tsrv(SPACE_TITLE[b.space] || b.space) }) : b.type === 'list' ? tsrv((cat.lists.find((x) => x.key === b.source) || {}).title || b.source) : b.type === 'tasks' ? t('Mes tâches') : b.name === 'driver' ? t('Missions du jour') : b.name === 'fuel' ? t('Carburant') : t('Incident');
  const move = (i, d) => setC((s) => { const a = [...s.blocks]; const j = i + d; if (j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return { ...s, blocks: a }; });
  const addBlock = () => {
    const [type, val] = add.split(':');
    const b = type === 'tiles' ? { type, space: val } : type === 'list' ? { type, source: val } : type === 'component' ? { type, name: val } : { type: 'tasks' };
    setC((s) => ({ ...s, blocks: [...s.blocks, b].slice(0, 12) }));
  };
  const toggleMod = (m) => setC((s) => ({ ...s, modules: s.modules.includes(m) ? s.modules.filter((x) => x !== m) : [...s.modules, m] }));
  const save = () => { setBusy(true); oapi('PUT', '/entreprise/profiles/' + p.key, { config: c }).then(() => { toast(t('Profil enregistré.')); done(); }).catch(fail).finally(() => setBusy(false)); };
  return (
    <div className="ws-form ent-editor">
      <h3>{t('Blocs du tableau de bord')}</h3>
      <ul className="ent-list">{c.blocks.map((b, i) => (
        <li className="ent-row" key={i}><div className="ent-row-b">{bl(b)}</div>
          <Button size="sm" variant="ghost" icon="arrow-up" label={t('Monter')} iconOnly onClick={() => move(i, -1)} />
          <Button size="sm" variant="ghost" icon="down" label={t('Descendre')} iconOnly onClick={() => move(i, 1)} />
          <Button size="sm" variant="ghost" icon="trash" label={t('Retirer')} iconOnly onClick={() => setC((s) => ({ ...s, blocks: s.blocks.filter((_, k) => k !== i) }))} /></li>
      ))}</ul>
      <div className="ent-tpl">
        <label className="fld"><span>{t('Ajouter un bloc')}</span>
          <select value={add} onChange={(e) => setAdd(e.target.value)}>
            <option value="tasks">{t('Mes tâches')}</option>
            <optgroup label={t('Indicateurs')}>{cat.spaces.map((s) => <option key={s} value={'tiles:' + s}>{tsrv(SPACE_TITLE[s] || s)}</option>)}</optgroup>
            <optgroup label={t('Listes')}>{cat.lists.map((l) => <option key={l.key} value={'list:' + l.key}>{tsrv(l.title)}</option>)}</optgroup>
            <optgroup label={t('Écrans du chauffeur')}><option value="component:driver">{t('Missions du jour')}</option><option value="component:fuel">{t('Carburant')}</option><option value="component:incident">{t('Incident')}</option></optgroup>
          </select></label>
        <Button icon="plus" onClick={addBlock}>{t('Ajouter')}</Button>
      </div>
      <h3>{t('Écrans proposés')}</h3>
      <div className="ent-modgrid">{cat.modules.map((m) => <label key={m.id} className="ent-pick"><input type="checkbox" checked={c.modules.includes(m.id)} onChange={() => toggleMod(m.id)} /> {tsrv(MODULE_TITLES[m.id] || m.title)}</label>)}</div>
      <h3>{t('Actions rapides')}</h3>
      {c.quick.map((x, i) => (
        <div className="ent-row" key={i}>
          <input value={x.label} aria-label={t('Nom')} onChange={(e) => setC((s) => ({ ...s, quick: s.quick.map((y, k) => (k === i ? { ...y, label: e.target.value } : y)) }))} />
          <select value={x.module} aria-label={t('Écran')} onChange={(e) => setC((s) => ({ ...s, quick: s.quick.map((y, k) => (k === i ? { ...y, module: e.target.value } : y)) }))}>{cat.modules.map((m) => <option key={m.id} value={m.id}>{tsrv(MODULE_TITLES[m.id] || m.title)}</option>)}</select>
          <Button size="sm" variant="ghost" icon="trash" label={t('Retirer')} iconOnly onClick={() => setC((s) => ({ ...s, quick: s.quick.filter((_, k) => k !== i) }))} />
        </div>
      ))}
      {c.quick.length < 8 ? <div className="row"><Button icon="plus" onClick={() => setC((s) => ({ ...s, quick: [...s.quick, { label: t('Nouvelle action'), module: cat.modules[0].id }] }))}>{t('Ajouter une action rapide')}</Button></div> : null}
      <label className="fld"><span>{t('Mode mobile')}</span>
        <select value={c.mobile.layout} onChange={(e) => setC((s) => ({ ...s, mobile: { layout: e.target.value } }))}>
          <option value="standard">{t('Standard')}</option><option value="compact">{t('Compact (une colonne, gros boutons)')}</option><option value="driver">{t('Chauffeur (missions, carburant, incidents)')}</option>
        </select></label>
      <div className="row"><Button variant="primary" loading={busy} onClick={save}>{t('Enregistrer le profil')}</Button></div>
    </div>
  );
}
