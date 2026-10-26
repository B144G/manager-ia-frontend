import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';

/* Logistique : transporteurs, zones de livraison et tournées. */

export function Carriers() {
  const t = useT();
  const { oapi, can, money, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/logistics/carriers'), []);
  const mgr = can('manager');
  const edit = (c) => modal(c ? t('Modifier le transporteur') : t('Nouveau transporteur / livreur'), (close) => (
    <Form
      submitText={t("Enregistrer")}
      fields={[
        { k: 'name', label: t('Nom'), required: true, value: c && c.name }, { k: 'contact', label: t('Téléphone ou contact'), value: c && c.contact },
        { k: 'zones', label: t('Zones couvertes'), value: c && c.zones, placeholder: 'Douala, Bonabéri…' }, { k: 'rate', label: t('Tarif habituel'), value: c && c.rate ? c.rate : '', hint: t('Par course. Laissez vide si variable.') },
        { k: 'note', label: t('Note'), value: c && c.note },
        { k: 'active', label: t('Disponible'), type: 'select', options: [['yes', t('Oui')], ['no', t('Non, en pause')]], value: c && !c.active ? 'no' : 'yes' },
      ]}
      onSubmit={(v) => oapi(c ? 'PUT' : 'POST', '/logistics/carriers' + (c ? '/' + c.id : ''), { ...v, active: v.active === 'yes' }).then(() => { close(); st.reload(); })}
    />
  ));
  return (
    <div className="ws-card">
      <div className="ws-head"><h2>{t('Transporteurs et livreurs')}</h2>{mgr ? <button className="btn primary small" type="button" onClick={() => edit()}>{t('Ajouter')}</button> : null}</div>
      <Loaded state={st}>{(j) => (
        <>
          {!j.carriers.length ? <Empty text={t('Aucun transporteur. Ajoutez vos livreurs ou sociétés de transport avec leurs zones et leur tarif.')} /> : null}
          {j.carriers.map((c) => (
            <div className="line" key={c.id}>
              <span><b>{c.name}</b>{!c.active ? <span className="pill">{t('En pause')}</span> : null}<small>{' ' + [c.contact, c.zones, c.rate ? money(c.rate) : '', c.note].filter(Boolean).join(' · ')}</small></span>
              {mgr ? (
                <span className="row">
                  <button className="link" type="button" onClick={() => edit(c)}>{t('Modifier')}</button>
                  <button className="link" type="button" onClick={() => confirm(t('Supprimer « {name} » ? Ses livraisons restent, sans transporteur.', { name: c.name }), () => { oapi('DELETE', '/logistics/carriers/' + c.id).then(st.reload).catch(fail); })}>{t('Supprimer')}</button>
                </span>
              ) : null}
            </div>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}

export function Zones() {
  const t = useT();
  const { oapi, can, money, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/logistics/zones'), []);
  const mgr = can('manager');
  const edit = (z) => modal(z ? t('Modifier la zone') : t('Nouvelle zone'), (close) => (
    <Form
      submitText={t("Enregistrer")}
      fields={[
        { k: 'name', label: t('Nom de la zone'), required: true, value: z && z.name, placeholder: t('Douala centre') },
        { k: 'fee', label: t('Frais de livraison'), value: z ? z.fee : '', placeholder: '1500' },
        { k: 'delayDays', label: t('Délai (jours)'), value: z ? z.delayDays : 1 },
        { k: 'note', label: t('Note'), value: z && z.note },
      ]}
      onSubmit={(v) => oapi(z ? 'PUT' : 'POST', '/logistics/zones' + (z ? '/' + z.id : ''), v).then(() => { close(); st.reload(); })}
    />
  ));
  return (
    <div className="ws-card">
      <div className="ws-head"><h2>{t('Zones de livraison')}</h2>{mgr ? <button className="btn primary small" type="button" onClick={() => edit()}>{t('Ajouter')}</button> : null}</div>
      <Loaded state={st}>{(j) => (
        <>
          {!j.zones.length ? <Empty text={t('Aucune zone. Définissez vos zones avec leur tarif et leur délai : ils seront proposés automatiquement à chaque livraison.')} /> : null}
          {j.zones.map((z) => (
            <div className="line" key={z.id}>
              <span><b>{z.name}</b><small>{' ' + money(z.fee) + ' · ' + t('{n} jour(s)', { n: z.delayDays }) + (z.note ? ' · ' + z.note : '')}</small></span>
              {mgr ? (
                <span className="row">
                  <button className="link" type="button" onClick={() => edit(z)}>{t('Modifier')}</button>
                  <button className="link" type="button" onClick={() => confirm(t('Supprimer la zone « {name} » ?', { name: z.name }), () => { oapi('DELETE', '/logistics/zones/' + z.id).then(st.reload).catch(fail); })}>{t('Supprimer')}</button>
                </span>
              ) : null}
            </div>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}

export function Rounds({ deliveries, onChange }) {
  const t = useT();
  const { oapi, can, dateFr, today, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/logistics/rounds'), []);
  const reload = () => { st.reload(); onChange(); };
  const create = () => oapi('GET', '/logistics/carriers').then((cj) => modal(t('Nouvelle tournée'), (close) => (
    <Form
      submitText={t("Créer la tournée")}
      fields={[
        { k: 'name', label: t('Nom'), required: true, placeholder: t('Tournée du matin') }, { k: 'date', label: t('Jour'), type: 'date', required: true, value: today() },
        { k: 'carrierId', label: t('Livreur'), type: 'select', options: [['', t('Non choisi')]].concat(cj.carriers.filter((c) => c.active).map((c) => [String(c.id), c.name])) },
        { k: 'note', label: t('Note') },
      ]}
      onSubmit={(v) => oapi('POST', '/logistics/rounds', v).then(() => { close(); reload(); })}
    />
  ))).catch(fail);
  const save = (r, ids) => oapi('PUT', '/logistics/rounds/' + r.id + '/order', { deliveryIds: ids }).then(reload).catch(fail);
  const add = (r) => {
    const free = deliveries.filter((d) => !d.roundId && ['to_prepare', 'shipped', 'on_route'].includes(d.status));
    modal(t('Ajouter à la tournée'), (close) => (free.length ? (
      <Form submitText={t('Ajouter')} fields={[{ k: 'id', label: t('Livraison'), type: 'select', options: free.map((d) => [String(d.id), d.customerName + (d.address ? ' : ' + d.address : '')]) }]}
        onSubmit={(v) => save(r, r.deliveries.map((d) => d.id).concat(Number(v.id))).then(close)} />
    ) : <Empty text={t('Aucune livraison libre à ajouter.')} />));
  };
  const move = (r, i, step) => { const ids = r.deliveries.map((d) => d.id); const j = i + step; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; save(r, ids); };
  return (
    <div className="ws-card">
      <div className="ws-head"><h2>{t('Tournées')}</h2><button className="btn primary small" type="button" onClick={create}>{t('Nouvelle tournée')}</button></div>
      <Loaded state={st}>{(j) => (
        <>
          {!j.rounds.length ? <Empty text={t("Aucune tournée. Regroupez les livraisons d'un jour pour un livreur et choisissez l'ordre de passage.")} /> : null}
          {j.rounds.map((r) => (
            <div className="ws-card" key={r.id}>
              <div className="line">
                <span><b>{r.name}</b><small>{' ' + dateFr(r.date) + (r.carrier ? ' · ' + r.carrier : '')}</small></span>
                <span className="row">
                  <button className="link" type="button" onClick={() => add(r)}>{t('Ajouter une livraison')}</button>
                  {can('manager') ? <button className="link" type="button" onClick={() => confirm(t('Supprimer la tournée « {name} » ? Les livraisons restent.', { name: r.name }), () => { oapi('DELETE', '/logistics/rounds/' + r.id).then(reload).catch(fail); })}>{t('Supprimer')}</button> : null}
                </span>
              </div>
              {!r.deliveries.length ? <Empty text={t('Aucune livraison dans cette tournée.')} /> : null}
              {r.deliveries.map((d, i) => (
                <div className="line" key={d.id}>
                  <span>{(i + 1) + '. '}<b>{d.customerName}</b><small>{' ' + [d.address, t(d.statusLabel || '')].filter(Boolean).join(' · ')}</small></span>
                  <span className="row">
                    <button className="link" type="button" aria-label={t('Monter')} disabled={i === 0} onClick={() => move(r, i, -1)}>{t('Monter')}</button>
                    <button className="link" type="button" aria-label={t('Descendre')} disabled={i === r.deliveries.length - 1} onClick={() => move(r, i, 1)}>{t('Descendre')}</button>
                    <button className="link" type="button" onClick={() => save(r, r.deliveries.filter((x) => x.id !== d.id).map((x) => x.id))}>{t('Retirer')}</button>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}
