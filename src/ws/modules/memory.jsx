import { useState } from 'react';
import { API_BASE } from '../../lib/api.js';
import { useT } from '../../lib/i18n.jsx';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../ui.jsx';
import { saveBlob } from '../parts/sales/util.jsx';

/* Sous-application : Mémoire de l'entreprise (décisions, incidents, procédures, réunions, leçons, accords, historiques).
   Recherche rapide, « Demander à la mémoire » (l'IA répond uniquement à partir des notes, en les citant), versions, export. */

const Q0 = { q: '', kind: '', tag: '', from: '', to: '' };

export default function Memory() {
  const t = useT();
  const { oapi, orgId, modal, confirm, dateFr, toast, fail } = useWs();
  const [f, setF] = useState(Q0);
  const [applied, setApplied] = useState(Q0);
  const st = useLoad(() => {
    const p = new URLSearchParams();
    Object.entries(applied).forEach(([k, v]) => { if (v) p.set(k, v); });
    return oapi('GET', '/memory?' + p.toString());
  }, [applied]);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const edit = (e0) => {
    oapi('GET', '/memory/links').then((links) => {
      const j = st.data;
      const opts = [['', t('Aucun lien')]];
      const names = { customer: t('Client'), supplier: t('Fournisseur'), project: t('Projet') };
      Object.keys(names).forEach((k) => (links[k] || []).forEach((x) => opts.push([k + ':' + x.id, names[k] + ' : ' + x.name])));
      modal(e0 ? t('Modifier la note') : t('Nouvelle note'), (close) => {
        const fields = [
          { k: 'kind', label: t('Type'), type: 'select', options: Object.entries(j.kinds).map(([k, l]) => [k, t(l)]), value: e0 ? e0.kind : 'decision' },
          { k: 'title', label: t('Titre'), required: true, value: e0 ? e0.title : '', placeholder: t('Ex. : Changement de fournisseur de savon') },
          { k: 'content', label: t('Contenu'), type: 'textarea', rows: 8, required: true, value: e0 ? e0.content : '', hint: t("Ce qui a été décidé ou appris, et pourquoi. Plus c'est précis, mieux la mémoire pourra répondre plus tard.") },
          { k: 'tags', label: t('Étiquettes (séparées par des virgules)'), value: e0 ? e0.tags.join(', ') : '', placeholder: t('fournisseur, prix') },
          { k: 'date', label: t('Date'), type: 'date', value: e0 ? e0.date : new Date().toISOString().slice(0, 10) },
          { k: 'link', label: t('Relier à'), type: 'select', options: opts, value: e0 && e0.link ? e0.link.kind + ':' + e0.link.id : '' },
        ];
        if (j.canRestrict) fields.push({ k: 'restricted', label: t('Qui peut la lire ?'), type: 'select', options: [['0', t("Toute l'équipe")], ['1', t('Réservée aux responsables')]], value: e0 && e0.restricted ? '1' : '0' });
        return (
          <Form
            fields={fields}
            submitText={t("Enregistrer")}
            onSubmit={(v) => {
              const [lk, li] = (v.link || '').split(':');
              const body = { kind: v.kind, title: v.title, content: v.content, tags: v.tags, date: v.date, linkKind: lk || '', linkId: li || undefined };
              if (j.canRestrict) body.restricted = v.restricted === '1';
              return oapi(e0 ? 'PUT' : 'POST', '/memory' + (e0 ? '/' + e0.id : ''), body).then(() => { close(); st.reload(); toast(t('Note enregistrée.')); });
            }}
          />
        );
      }, { wide: true });
    }, fail);
  };

  const open = (id) => {
    oapi('GET', '/memory/' + id).then((e) => {
      modal(e.title, (close) => (
        <div>
          <p className="muted small">
            <span className="pill good">{t(e.kindLabel)}</span>{' '}{dateFr(e.date)}{e.author ? ' · ' + t('par {name}', { name: e.author }) : ''}{' · ' + t('version {n}', { n: e.version })}
            {e.restricted ? ' · ' + t('réservée aux responsables') : ''}
          </p>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '12px 0' }}>{e.content}</p>
          {e.tags.length ? <p className="small">{e.tags.map((tg) => <span className="pill mid" key={tg} style={{ marginRight: 6 }}>{tg}</span>)}</p> : null}
          {e.link ? <p className="small muted">{t(e.link.kindLabel) + ' : ' + e.link.label}</p> : null}
          {e.versions.length ? (
            <details style={{ marginTop: 12 }}>
              <summary>{t('Historique des modifications ({n})', { n: e.versions.length })}</summary>
              {e.versions.map((v) => (
                <div className="ws-card" key={v.version} style={{ marginTop: 8 }}>
                  <p className="small muted">{t('Version {n}', { n: v.version }) + ' · ' + dateFr(v.at)}</p>
                  <b>{v.title}</b>
                  <p className="small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{v.content}</p>
                </div>
              ))}
            </details>
          ) : null}
          <div className="row" style={{ marginTop: 16 }}>
            {e.canEdit ? <button className="btn primary small" type="button" onClick={() => { close(); edit(e); }}>{t('Modifier')}</button> : null}
            {e.canEdit ? <button className="btn small" type="button" onClick={() => confirm(t('Supprimer cette note et son historique ?'), () => { oapi('DELETE', '/memory/' + e.id).then(() => { close(); st.reload(); }).catch(fail); })}>{t('Supprimer')}</button> : null}
            <button className="btn small" type="button" onClick={close}>{t('Fermer')}</button>
          </div>
        </div>
      ), { wide: true });
    }, fail);
  };

  const download = (format) => {
    fetch(API_BASE + '/api/ws/orgs/' + orgId + '/memory/export' + (format === 'csv' ? '?format=csv' : ''), { credentials: 'include' })
      .then((r) => (r.ok ? r.blob() : r.json().then((j) => { throw new Error(t(j.error || 'Export impossible.')); })))
      .then((b) => saveBlob(b, 'memoire-entreprise.' + format, 2000))
      .catch(fail);
  };

  const ask = () => {
    modal(t('Demander à la mémoire'), (close) => <Ask close={close} open={open} />, { wide: true });
  };

  return (
    <>
      <div className="ws-head">
        <div><h1>{t("Mémoire de l'entreprise")}</h1><p className="muted">{t("Décisions, incidents, procédures, réunions et leçons apprises : retrouvez ce que l'entreprise a déjà vécu.")}</p></div>
        <div className="row">
          <button className="btn signal small" type="button" onClick={ask}>{t('Demander à la mémoire')}</button>
          <button className="btn primary small" type="button" onClick={() => edit(null)}>{t('Nouvelle note')}</button>
        </div>
      </div>
      <Loaded state={st}>{(j) => (
        <>
          <div className="kpis">
            <div className="stat"><b>{j.kpis.total}</b><span>{t('notes enregistrées')}</span></div>
            <div className="stat"><b>{j.kpis.month}</b><span>{t('ce mois-ci')}</span></div>
            <div className="stat"><b>{j.kpis.decisions}</b><span>{t('décisions')}</span></div>
          </div>
          <div className="ws-card">
            <form className="ws-form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', alignItems: 'end' }} onSubmit={(ev) => { ev.preventDefault(); setApplied(f); }}>
              <label className="fld" htmlFor="m_q" style={{ gridColumn: '1 / -1' }}><span>{t('Rechercher')}</span><input id="m_q" type="search" placeholder={t('Un mot, un nom de fournisseur, un sujet…')} value={f.q} onChange={(e) => set('q', e.target.value)} /></label>
              <label className="fld" htmlFor="m_k"><span>{t('Type')}</span>
                <select id="m_k" value={f.kind} onChange={(e) => set('kind', e.target.value)}><option value="">{t('Tous les types')}</option>{Object.entries(j.kinds).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
              </label>
              <label className="fld" htmlFor="m_t"><span>{t('Étiquette')}</span>
                <select id="m_t" value={f.tag} onChange={(e) => set('tag', e.target.value)}><option value="">{t('Toutes')}</option>{j.tags.map((x) => <option key={x.tag} value={x.tag}>{x.tag + ' (' + x.count + ')'}</option>)}</select>
              </label>
              <label className="fld" htmlFor="m_a"><span>{t('Du')}</span><input id="m_a" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></label>
              <label className="fld" htmlFor="m_b"><span>{t('Au')}</span><input id="m_b" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></label>
              <div className="row" style={{ gridColumn: '1 / -1' }}>
                <button className="btn primary small" type="submit">{t('Rechercher')}</button>
                <button className="btn small" type="button" onClick={() => { setF(Q0); setApplied(Q0); }}>{t('Effacer')}</button>
              </div>
            </form>
          </div>
          <div className="ws-card">
            <h2>{t('Notes')}</h2>
            {!j.entries.length ? <Empty text={j.kpis.total ? t('Aucune note ne correspond à votre recherche.') : t("Aucune note pour le moment. Ajoutez votre première décision ou leçon apprise : elle servira de mémoire à toute l'équipe.")} /> : null}
            {j.entries.map((e) => (
              <div className="line" key={e.id}>
                <span style={{ minWidth: 0, flex: '1 1 240px' }}>
                  <b>{e.title}</b>{' '}<span className="pill good">{t(e.kindLabel)}</span>{e.restricted ? <span className="pill mid" style={{ marginLeft: 6 }}>{t('Responsables')}</span> : null}
                  <br /><small style={{ overflowWrap: 'anywhere' }}>{e.excerpt}</small>
                  {e.tags.length ? <><br /><small>{e.tags.map((tg) => '#' + tg).join(' ')}</small></> : null}
                </span>
                <span className="row">
                  <small>{dateFr(e.date)}</small>
                  <button className="link" type="button" onClick={() => open(e.id)}>{t('Ouvrir')}</button>
                </span>
              </div>
            ))}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn small" type="button" disabled={!j.kpis.total} onClick={() => download('csv')}>{t('Exporter (tableur)')}</button>
              <button className="btn small" type="button" disabled={!j.kpis.total} onClick={() => download('json')}>{t('Exporter (JSON)')}</button>
            </div>
          </div>
        </>
      )}
      </Loaded>
      <p className="muted small">{t("L'IA répond uniquement à partir des notes enregistrées ici et cite ses sources ; si elle ne trouve rien, elle le dit.")}</p>
    </>
  );
}

function Ask({ close, open }) {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const go = (ev) => {
    ev.preventDefault();
    if (!q.trim() || busy) return;
    setBusy(true); setErr(''); setRes(null);
    oapi('POST', '/memory/ask', { question: q }).then(setRes, (e) => setErr(t(e.message))).then(() => setBusy(false));
  };
  return (
    <div>
      <form className="ws-form" onSubmit={go}>
        <label className="fld" htmlFor="ask_q"><span>{t('Votre question')}</span>
          <input id="ask_q" type="text" maxLength={500} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Pourquoi avons-nous changé de fournisseur ?')} />
        </label>
        <div className="row"><button className="btn primary" type="submit" disabled={busy}>{busy ? t('Recherche…') : t('Demander')}</button><button className="btn" type="button" onClick={close}>{t('Fermer')}</button></div>
      </form>
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      {res ? (
        <div style={{ marginTop: 12 }}>
          <p className="ai-out dc" style={{ padding: '12px 14px' }}>{res.answer}</p>
          {res.sources.length ? <p className="small muted">{t('Sources dans la mémoire :')}</p> : null}
          {res.sources.map((s) => (
            <div className="line" key={s.id}>
              <span><b>{s.title}</b>{' '}<small>{'(' + t(s.kindLabel) + ', ' + dateFr(s.date) + ')'}</small></span>
              <button className="link" type="button" onClick={() => { close(); open(s.id); }}>{t('Ouvrir la note')}</button>
            </div>
          ))}
          {res.uncited ? <p className="small muted">{t("L'IA n'a cité aucune note précise : vérifiez les notes ci-dessus avant de vous y fier.")}</p> : null}
          {!res.found ? <p className="small muted">{t("Astuce : essayez d'autres mots, ou ajoutez une note si ce souvenir n'a jamais été enregistré.")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
