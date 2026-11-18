import { useMemo } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Badge, ChartFrame, Form, Loaded, useLoad } from '../../ui.jsx';
import { HBars } from '../../charts/lazy.jsx';
import { confLabel } from './Catalog.jsx';

/* Plan de classement : arborescence de classes (code, nom, durée de conservation, confidentialité par défaut), modèles pour PME. */

function ClassForm({ L, cls, parent, all, onDone }) {
  const t = useT();
  const { toast } = useWs();
  const c = cls || {};
  return (
    <Form submitText={cls ? t('Enregistrer') : t('Ajouter la classe')}
      fields={[
        { k: 'code', label: t('Code (lettres, chiffres, point, tiret)'), required: true, value: c.code || (parent ? `${parent.code}.` : ''), placeholder: 'FIN.1' },
        { k: 'name', label: t('Nom de la classe'), required: true, value: c.name || '' },
        { k: 'parentId', label: t('Classe parente'), type: 'select', value: c.parentId || (parent ? parent.id : ''), options: [['', t('— Aucune (niveau principal) —')], ...all.filter((x) => !cls || x.id !== cls.id).map((x) => [String(x.id), `${x.code} — ${x.name}`])] },
        { k: 'retentionMonths', label: t('Durée de conservation (mois)'), type: 'number', value: c.retentionMonths === null || c.retentionMonths === undefined ? '' : c.retentionMonths, hint: t('Laissez vide si elle n’est pas fixée. 120 mois = 10 ans.') },
        { k: 'confidentiality', label: t('Confidentialité par défaut des nouvelles notices'), type: 'select', value: c.confidentiality || '', options: [['', t('— Interne (par défaut) —')], ['public', t('Libre')], ['internal', t('Interne')], ['restricted', t('Restreint')], ['secret', t('Secret')]] },
      ]}
      onSubmit={(v) => L.lib(cls ? 'PUT' : 'POST', cls ? `/classes/${cls.id}` : '/classes', { code: v.code, name: v.name, parentId: v.parentId ? Number(v.parentId) : null, retentionMonths: v.retentionMonths === '' ? null : Number(v.retentionMonths), confidentiality: v.confidentiality || null })
        .then(() => { toast(cls ? t('Classe enregistrée.') : t('Classe ajoutée.')); onDone(); })} />
  );
}

function Node({ c, kids, depth, ctx }) {
  const t = useT();
  const { can } = useWs();
  const children = kids.get(c.id) || [];
  return (
    <li>
      <div className="lib-node" style={{ paddingLeft: depth * 18 }}>
        <span className="lib-code mono">{c.code}</span>
        <span className="lib-node-name">{c.name}</span>
        <span className="lib-node-meta">
          <Badge tone={c.total ? 'brand' : 'neutral'}>{t('{n} notice(s)', { n: c.total })}</Badge>
          {c.retentionMonths !== null ? <small className="muted">{c.retentionMonths % 12 === 0 && c.retentionMonths ? t('{n} an(s)', { n: c.retentionMonths / 12 }) : t('{n} mois', { n: c.retentionMonths })}</small> : null}
          {c.confidentiality ? <small className="muted">{t(confLabel(c.confidentiality))}</small> : null}
        </span>
        {can('admin') ? (
          <span className="row lib-node-act">
            <button className="btn small" type="button" onClick={() => ctx.add(c)}>{t('+ Sous-classe')}</button>
            <button className="btn small" type="button" onClick={() => ctx.edit(c)}>{t('Modifier')}</button>
            <button className="btn small" type="button" onClick={() => ctx.del(c)}>{t('Supprimer')}</button>
          </span>
        ) : null}
      </div>
      {children.length ? <ul className="lib-tree">{children.map((k) => <Node key={k.id} c={k} kids={kids} depth={depth + 1} ctx={ctx} />)}</ul> : null}
    </li>
  );
}

export default function Classes({ L }) {
  const t = useT();
  const { modal, toast, confirm, can } = useWs();
  const st = useLoad(() => L.lib('GET', '/classes'), [L.tick]);
  const fail = (e) => toast(tsrv(e.message), true);
  const reload = () => { st.reload(); L.reload(); };
  const ctxFor = (j) => ({
    add: (parent) => modal(parent ? t('Nouvelle sous-classe de {code}', { code: parent.code }) : t('Nouvelle classe'), (close) => <ClassForm L={L} parent={parent} all={j.classes} onDone={() => { close(); reload(); }} />),
    edit: (c) => modal(t('Modifier {code}', { code: c.code }), (close) => <ClassForm L={L} cls={c} all={j.classes} onDone={() => { close(); reload(); }} />),
    del: (c) => {
      if (c.own) {
        modal(t('Supprimer {code}', { code: c.code }), (close) => (
          <Form submitText={t('Déplacer les notices et supprimer')} fields={[{ k: 'to', label: t('Les {n} notice(s) de cette classe iront dans', { n: c.own }), type: 'select', value: '', required: true, options: [['', t('— Choisir une classe —')], ...j.classes.filter((x) => x.id !== c.id).map((x) => [String(x.id), `${x.code} — ${x.name}`])] }]}
            onSubmit={(v) => L.lib('DELETE', `/classes/${c.id}?moveTo=${v.to}`).then(() => { toast(t('Classe supprimée.')); close(); reload(); })} />
        ));
      } else confirm(t('Supprimer la classe {code} ?', { code: c.code }), () => L.lib('DELETE', `/classes/${c.id}`).then(() => { toast(t('Classe supprimée.')); reload(); }, fail), t('Supprimer'));
    },
  });
  return (
    <>
      <div className="ws-head"><div><h1>{t('Plan de classement')}</h1><p className="muted">{t("Les classes rangent les ressources par thème (ex. FIN Finance, RH, JUR Juridique). Chaque classe peut fixer une durée de conservation, utilisée par l'archivage.")}</p></div>
        {can('admin') ? <div className="row"><button className="btn primary small" type="button" onClick={() => st.data && ctxFor(st.data).add(null)}>{t('Nouvelle classe')}</button></div> : null}</div>
      <Loaded state={st}>{(j) => <Body j={j} L={L} ctx={ctxFor(j)} reload={reload} />}</Loaded>
    </>
  );
}

function Body({ j, L, ctx, reload }) {
  const t = useT();
  const { toast, can } = useWs();
  const kids = useMemo(() => { const m = new Map(); for (const c of j.classes) { const k = c.parentId || 0; if (!m.has(k)) m.set(k, []); m.get(k).push(c); } for (const arr of m.values()) arr.sort((a, b) => a.position - b.position || a.code.localeCompare(b.code, undefined, { numeric: true })); return m; }, [j.classes]);
  const roots = kids.get(0) || [];
  const chart = roots.filter((c) => c.total > 0).map((c) => ({ name: c.code, value: c.total }));
  if (!j.classes.length) {
    return (
      <div className="ws-card">
        <h2>{t('Partez d’un modèle')}</h2>
        <p className="muted">{t('Aucun plan de classement pour le moment. Choisissez un modèle adapté à votre activité ; vous pourrez ensuite ajouter, renommer ou supprimer des classes.')}</p>
        {can('admin') ? <div className="lib-tpls">{j.templates.map((x) => (
          <button key={x.key} type="button" className="lib-tpl" onClick={() => L.lib('POST', '/classes/template', { key: x.key }).then((r) => { toast(t('{n} classe(s) ajoutée(s).', { n: r.added })); reload(); }, (e) => toast(tsrv(e.message), true))}>
            <b>{t(x.name)}</b><small className="muted">{t('{n} classes', { n: x.count })}</small>
          </button>
        ))}</div> : <p className="ws-empty">{t('Un administrateur doit d’abord créer le plan de classement.')}</p>}
      </div>
    );
  }
  return (
    <div className="ws-cols lib-classes">
      <div className="ws-card">
        <h2>{t('Arborescence')}</h2>
        <ul className="lib-tree root">{roots.map((c) => <Node key={c.id} c={c} kids={kids} depth={0} ctx={ctx} />)}</ul>
        <p className="muted small">{j.unclassified ? t('{n} notice(s) sans classe.', { n: j.unclassified }) : t('Toutes les notices sont classées.')}</p>
        {can('admin') ? <details className="lib-more"><summary>{t('Ajouter un modèle de plan')}</summary>
          <p className="muted small">{t('Les classes déjà présentes ne sont pas modifiées ; seules les classes manquantes sont ajoutées.')}</p>
          <div className="lib-tpls">{j.templates.map((x) => <button key={x.key} type="button" className="lib-tpl" onClick={() => L.lib('POST', '/classes/template', { key: x.key }).then((r) => { toast(t('{n} classe(s) ajoutée(s).', { n: r.added })); reload(); }, (e) => toast(tsrv(e.message), true))}><b>{t(x.name)}</b><small className="muted">{t('{n} classes', { n: x.count })}</small></button>)}</div></details> : null}
      </div>
      <div className="ws-card">
        <ChartFrame title={t('Notices par classe principale')} subtitle={t('Sous-classes comprises')} height={Math.max(180, 40 + chart.length * 32)} summary={chart.map((c) => `${c.name} ${c.value}`).join(', ')}>
          {chart.length ? <HBars data={chart} valueLabel={t('Notices')} height={Math.max(180, 40 + chart.length * 32)} /> : <p className="ws-empty">{t('Aucune notice classée pour le moment.')}</p>}
        </ChartFrame>
      </div>
    </div>
  );
}
