import { useRef, useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { getLocale, tr, useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';

/* Éléments communs de la vague 3 : liste + formulaire générique (Crud), réglages, pièces jointes chiffrées, téléchargement de fichiers. */

export const BTN = { minHeight: 44 };

/** Enregistre sur l'appareil un fichier lu avec la session (CSV, pièce jointe). */
export async function saveFile(path, name, fail) {
  try {
    const r = await fetch(API_BASE + '/api/ws' + path, { credentials: 'include' });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(tsrv(j.error || 'Téléchargement impossible.')); }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) { fail(e); }
}

const asForm = (f, item) => {
  let v = item ? item[f.k] : f.def;
  if (f.type === 'bool') v = item ? (v ? '1' : '0') : (f.def === undefined ? '1' : String(f.def));
  return { k: f.k, label: f.label, type: f.type === 'bool' ? 'select' : f.type === 'number' ? 'text' : f.type, options: f.type === 'bool' ? [['1', tr('Oui')], ['0', tr('Non')]] : f.options, required: f.required, hint: f.hint, rows: f.rows, placeholder: f.placeholder, value: v === null || v === undefined ? '' : v };
};

/** Formulaire d'un élément (création ou modification) dans une fenêtre. */
export function RecordForm({ path, fields, item, close, done, submitText, fixed }) {
  const { oapi, toast } = useWs();
  const t = useT();
  return (
    <Form
      fields={fields.map((f) => asForm(f, item))}
      submitText={submitText || t('Enregistrer')}
      onSubmit={(v) => {
        const body = { ...fixed };
        for (const f of fields) body[f.k] = f.type === 'bool' ? v[f.k] === '1' : v[f.k];
        return (item ? oapi('PUT', path + '/' + item.id, body) : oapi('POST', path, body)).then(() => { close(); toast(t('Enregistré.')); done(); });
      }}
    />
  );
}

/**
 * Liste simple branchée sur les routes de base du serveur (GET/POST/PUT/DELETE {path}).
 * fields : [{k, label, type: text|date|number|select|textarea|bool, options, required, hint, def}]
 * row(item) -> { main, sub, pill: [texte, 'bad'|'mid'|''] }
 */
export function Crud({ path, query = '', fields, row, canWrite = true, canDelete, addLabel, empty, title, intro, extraRow, fixed, ver = 0 }) {
  const t = useT();
  const { oapi, modal, confirm, fail } = useWs();
  const [v, setV] = useState(0);
  const st = useLoad(() => oapi('GET', path + query), [path, query, v, ver]);
  const reload = () => setV((n) => n + 1);
  const open = (item) => modal(item ? t('Modifier') : addLabel || t('Ajouter'), (close) => <RecordForm path={path} fields={fields} item={item} close={close} done={reload} fixed={fixed} />);
  return (
    <div className="ws-card">
      <div className="row"><h2 className="grow">{title}</h2>{canWrite ? <button className="btn primary small" type="button" style={BTN} onClick={() => open(null)}>{addLabel || t('Ajouter')}</button> : null}</div>
      {intro ? <p className="muted small">{intro}</p> : null}
      <Loaded state={st}>{(j) => (
        <>
          {!j.items.length ? <Empty text={empty || t('Rien pour le moment.')} /> : null}
          {j.items.map((it) => {
            const r = row(it);
            return (
              <div className="line" key={it.id}>
                <span><b>{r.main}</b>{r.pill ? <span className={'pill ' + (r.pill[1] || '')}>{r.pill[0]}</span> : null}{r.sub ? <><br /><small className="muted">{r.sub}</small></> : null}</span>
                <span className="row">
                  {extraRow ? extraRow(it, reload) : null}
                  {canWrite ? <button className="link" type="button" style={BTN} onClick={() => open(it)}>{t('Modifier')}</button> : null}
                  {(canDelete === undefined ? canWrite : canDelete) ? <button className="link" type="button" style={BTN} onClick={() => confirm(t('Supprimer cet élément ?'), () => { oapi('DELETE', path + '/' + it.id).then(reload).catch(fail); })}>{t('Supprimer')}</button> : null}
                </span>
              </div>
            );
          })}
        </>
      )}
      </Loaded>
    </div>
  );
}

/** Réglages numériques d'une organisation : keys = [[clé, libellé, aide]] ; GET/PUT {path}/settings. */
export function SettingsCard({ path, keys, canEdit, title, intro }) {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', path + '/settings'), [path]);
  const [vals, setVals] = useState(null);
  return (
    <div className="ws-card">
      <h2>{title}</h2>
      {intro ? <p className="muted small">{intro}</p> : null}
      <Loaded state={st}>{(j) => {
        const cur = vals || j.settings;
        return (
          <>
            {keys.map(([k, label, hint]) => (
              <label className="fld" key={k}><span>{label}</span>
                <input style={{ fontSize: 16 }} inputMode="decimal" disabled={!canEdit} value={cur[k]} onChange={(e) => setVals({ ...cur, [k]: e.target.value })} />{hint ? <small>{hint}</small> : null}
              </label>
            ))}
            {canEdit ? <button className="btn primary small" type="button" style={BTN} onClick={() => oapi('PUT', path + '/settings', cur).then((r) => { setVals(r.settings); toast(t('Enregistré.')); }).catch(fail)}>{t('Enregistrer')}</button> : <p className="muted small">{t('Réservé aux administrateurs.')}</p>}
          </>
        );
      }}
      </Loaded>
    </div>
  );
}

const sizeText = (n) => (n >= 1048576 ? tr('{n} Mo', { n: (n / 1048576).toLocaleString(getLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }) }) : tr('{n} Ko', { n: Math.max(1, Math.round(n / 1024)) }));

/** Pièces jointes chiffrées : listPath = .../{id}/files, filePath = .../files (téléchargement et suppression : {filePath}/{fid}/file). */
export function FilesBox({ listPath, filePath, canDelete = true }) {
  const t = useT();
  const { oapi, orgId, confirm, fail, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', listPath), [listPath]);
  const [msg, setMsg] = useState('');
  const input = useRef(null);
  async function upload(ev) {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setMsg(t('« {name} » dépasse 2 Mo. Réduisez-le ou choisissez un autre fichier.', { name: f.name })); return; }
    setMsg(t('Envoi de « {name} »…', { name: f.name }));
    try {
      const r = await fetch(API_BASE + '/api/ws/orgs/' + orgId + listPath + '?name=' + encodeURIComponent(f.name.slice(0, 60)), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(tsrv(j.error || 'Envoi impossible.'));
      setMsg(t('Fichier ajouté.'));
      st.reload();
    } catch (e) { setMsg(e.message); }
  }
  return (
    <div>
      <p className="muted small">{t('PDF, JPEG, PNG ou WebP, 2 Mo au plus, 10 fichiers au plus. Les fichiers sont chiffrés sur le serveur.')}</p>
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={upload} aria-label={t('Ajouter un fichier')} style={{ fontSize: 16 }} />
      <p className="muted small" role="status">{msg}</p>
      <Loaded state={st}>{(j) => (
        <>
          {!j.files.length ? <Empty text={t('Aucun fichier.')} /> : null}
          {j.files.map((x) => (
            <div className="line" key={x.id}>
              <span>{x.name}<br /><small className="muted">{sizeText(x.size) + ' · ' + dateFr(x.createdAt)}</small></span>
              <span className="row">
                <button className="link" type="button" style={BTN} onClick={() => saveFile('/orgs/' + orgId + filePath + '/' + x.id + '/file', x.name, fail)}>{t('Télécharger')}</button>
                {canDelete ? <button className="link" type="button" style={BTN} onClick={() => confirm(t('Supprimer ce fichier ?'), () => { oapi('DELETE', filePath + '/' + x.id).then(st.reload).catch(fail); })}>{t('Supprimer')}</button> : null}
              </span>
            </div>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}
