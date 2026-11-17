import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, Loading, useLoad } from '../../ui.jsx';
import { YearBar } from './common.jsx';

/* Comptabilité analytique : résultat par section (projet, antenne, activité). */

const KINDS = { project: 'Projet', branch: 'Antenne', custom: 'Activité' };

function SectionLines({ code, year }) {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/analytics/report/' + encodeURIComponent(code) + '/lines?year=' + year), []);
  if (st.loading) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{tsrv(st.error.message)}</p>;
  const lines = st.data.lines || [];
  return (
    <div>
      {!lines.length ? <Empty text={t('Aucune écriture dans cette section.')} /> : null}
      {lines.map((l, i) => (
        <div className="line" key={(l.number || '') + '-' + i}>
          <span><b>{dateFr(l.date)}</b><small>{' ' + (l.number || '') + ' · ' + tsrv(l.label || '')}</small></span>
          <span>{l.account + ' · ' + (l.debit ? t('D {amount}', { amount: money(l.debit) }) : t('C {amount}', { amount: money(l.credit) }))}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsTab({ year, setYear }) {
  const t = useT();
  const { oapi, money, modal, toast, fail } = useWs();
  const secs = useLoad(() => oapi('GET', '/accounting/analytics/sections'), []);
  const rep = useLoad(() => oapi('GET', '/accounting/analytics/report?year=' + year), [year]);
  const reloadAll = () => { secs.reload(); rep.reload(); };

  const importAll = () => oapi('POST', '/accounting/analytics/sections/import', {}).then((r) => { toast(r.created ? t('{n} section(s) créée(s) depuis vos projets et antennes.', { n: r.created }) : t('Vos projets et antennes ont déjà leur section.')); reloadAll(); }).catch(fail);
  const add = () => modal(t('Nouvelle section'), (close) => (
    <Form
      submitText={t('Ajouter')}
      fields={[
        { k: 'code', label: t('Code (2 à 20 lettres, chiffres ou tirets)'), required: true, placeholder: 'CHANTIER-A' },
        { k: 'label', label: t('Nom de la section'), required: true },
        { k: 'kind', label: t('Type'), type: 'select', options: Object.entries(KINDS).map(([k, v]) => [k, t(v)]) },
      ]}
      onSubmit={(v) => oapi('POST', '/accounting/analytics/sections', { code: v.code.trim().toUpperCase(), label: v.label.trim(), kind: v.kind }).then(() => { close(); toast(t('Section ajoutée.')); reloadAll(); })}
    />
  ));
  const toggle = (s) => oapi('PUT', '/accounting/analytics/sections/' + s.id, { active: !s.active }).then(() => { toast(s.active ? t('Section désactivée.') : t('Section réactivée.')); reloadAll(); }).catch(fail);
  const rename = (s) => modal(t('Renommer la section {code}', { code: s.code }), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'label', label: t('Nom de la section'), required: true, value: s.label }]}
      onSubmit={(v) => oapi('PUT', '/accounting/analytics/sections/' + s.id, { label: v.label.trim() }).then(() => { close(); reloadAll(); })} />
  ));
  const lines = (r) => modal(t('Écritures de la section {code}', { code: r.code }), () => <SectionLines code={r.code} year={year} />, { wide: true });

  return (
    <>
      <div className="ws-card">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <h2 className="grow">{t('Résultat par section {year}', { year })}</h2>
          <YearBar year={year} setYear={setYear} />
        </div>
        <p className="muted small">{t("Ventilez vos écritures par projet, antenne ou activité pour savoir ce qui rapporte vraiment : produits, charges et marge de chaque section.")}</p>
        <Loaded state={rep}>
          {(j) => {
            const rows = j.sections || [];
            const nv = j.nonVentile || { produits: 0, charges: 0, resultat: 0 };
            const tot = j.total || { produits: 0, charges: 0, resultat: 0 };
            if (!rows.length && !nv.produits && !nv.charges) return <Empty text={t("Aucune section utilisée pour l'instant. Créez vos sections ci-dessous, puis choisissez-en une sur les lignes d'écriture (Nouvelle écriture).")} />;
            return (
              <>
                {rows.map((r) => (
                  <div className="line" key={r.code} style={{ flexWrap: 'wrap' }}>
                    <span><b>{r.code}</b><small>{' ' + tsrv(r.label) + ' · ' + t(KINDS[r.kind] || 'Activité')}</small></span>
                    <span className="row" style={{ flexWrap: 'wrap' }}>
                      <small>{t('Produits {p} · Charges {c}', { p: money(r.produits), c: money(r.charges) })}</small>
                      <b className={r.resultat >= 0 ? 'ok' : 'late'}>{money(r.resultat)}</b>
                      {r.margePct === null || r.margePct === undefined ? null : <span className={'pill ' + (r.margePct >= 0 ? 'good' : 'bad')}>{r.margePct + ' %'}</span>}
                      <button className="link" type="button" onClick={() => lines(r)}>{t('Écritures')}</button>
                    </span>
                  </div>
                ))}
                <div className="line">
                  <span><b>{t('Non ventilé')}</b><small>{' ' + t('lignes sans section')}</small></span>
                  <span className="row"><small>{t('Produits {p} · Charges {c}', { p: money(nv.produits), c: money(nv.charges) })}</small><b>{money(nv.resultat)}</b></span>
                </div>
                <div className="line">
                  <b>{t('Total')}</b>
                  <span className="row"><small>{t('Produits {p} · Charges {c}', { p: money(tot.produits), c: money(tot.charges) })}</small><b className={tot.resultat >= 0 ? 'ok' : 'late'}>{money(tot.resultat)}</b></span>
                </div>
              </>
            );
          }}
        </Loaded>
      </div>
      <div className="ws-card">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <h2 className="grow">{t('Sections')}</h2>
          <button className="btn small" type="button" onClick={importAll}>{t('Importer mes projets et antennes')}</button>
          <button className="btn primary small" type="button" onClick={add}>{t('Nouvelle section')}</button>
        </div>
        <Loaded state={secs}>
          {(j) => (
            <>
              {!(j.sections || []).length ? <Empty text={t("Aucune section. « Importer mes projets et antennes » en crée une pour chacun en un clic.")} /> : null}
              {(j.sections || []).map((s) => (
                <div className="line" key={s.id} style={{ flexWrap: 'wrap' }}>
                  <span><b>{s.code}</b><small>{' ' + tsrv(s.label) + ' · ' + t(KINDS[s.kind] || 'Activité') + ' · ' + t('{n} ligne(s)', { n: s.used })}</small></span>
                  <span className="row">
                    <span className={'pill ' + (s.active ? 'good' : '')}>{s.active ? t('Active') : t('Inactive')}</span>
                    <button className="link" type="button" onClick={() => rename(s)}>{t('Renommer')}</button>
                    <button className="link" type="button" onClick={() => toggle(s)}>{s.active ? t('Désactiver') : t('Réactiver')}</button>
                  </span>
                </div>
              ))}
              <p className="muted small">{t("Une section déjà utilisée ne se supprime pas : désactivez-la, elle reste dans vos rapports.")}</p>
            </>
          )}
        </Loaded>
      </div>
    </>
  );
}
