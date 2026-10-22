import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';

/* Logistique : transporteurs, zones de livraison et tournées. */

export function Carriers() {
  const { oapi, can, money, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/logistics/carriers'), []);
  const mgr = can('manager');
  const edit = (c) => modal(c ? 'Modifier le transporteur' : 'Nouveau transporteur / livreur', (close) => (
    <Form
      submitText="Enregistrer"
      fields={[
        { k: 'name', label: 'Nom', required: true, value: c && c.name }, { k: 'contact', label: 'Téléphone ou contact', value: c && c.contact },
        { k: 'zones', label: 'Zones couvertes', value: c && c.zones, placeholder: 'Douala, Bonabéri…' }, { k: 'rate', label: 'Tarif habituel', value: c && c.rate ? c.rate : '', hint: 'Par course. Laissez vide si variable.' },
        { k: 'note', label: 'Note', value: c && c.note },
        { k: 'active', label: 'Disponible', type: 'select', options: [['yes', 'Oui'], ['no', 'Non, en pause']], value: c && !c.active ? 'no' : 'yes' },
      ]}
      onSubmit={(v) => oapi(c ? 'PUT' : 'POST', '/logistics/carriers' + (c ? '/' + c.id : ''), { ...v, active: v.active === 'yes' }).then(() => { close(); st.reload(); })}
    />
  ));
  return (
    <div className="ws-card">
      <div className="ws-head"><h2>Transporteurs et livreurs</h2>{mgr ? <button className="btn primary small" type="button" onClick={() => edit()}>Ajouter</button> : null}</div>
      <Loaded state={st}>{(j) => (
        <>
          {!j.carriers.length ? <Empty text="Aucun transporteur. Ajoutez vos livreurs ou sociétés de transport avec leurs zones et leur tarif." /> : null}
          {j.carriers.map((c) => (
            <div className="line" key={c.id}>
              <span><b>{c.name}</b>{!c.active ? <span className="pill">En pause</span> : null}<small>{' ' + [c.contact, c.zones, c.rate ? money(c.rate) : '', c.note].filter(Boolean).join(' · ')}</small></span>
              {mgr ? (
                <span className="row">
                  <button className="link" type="button" onClick={() => edit(c)}>Modifier</button>
                  <button className="link" type="button" onClick={() => confirm('Supprimer « ' + c.name + ' » ? Ses livraisons restent, sans transporteur.', () => { oapi('DELETE', '/logistics/carriers/' + c.id).then(st.reload).catch(fail); })}>Supprimer</button>
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
  const { oapi, can, money, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/logistics/zones'), []);
  const mgr = can('manager');
  const edit = (z) => modal(z ? 'Modifier la zone' : 'Nouvelle zone', (close) => (
    <Form
      submitText="Enregistrer"
      fields={[
        { k: 'name', label: 'Nom de la zone', required: true, value: z && z.name, placeholder: 'Douala centre' },
        { k: 'fee', label: 'Frais de livraison', value: z ? z.fee : '', placeholder: '1500' },
        { k: 'delayDays', label: 'Délai (jours)', value: z ? z.delayDays : 1 },
        { k: 'note', label: 'Note', value: z && z.note },
      ]}
      onSubmit={(v) => oapi(z ? 'PUT' : 'POST', '/logistics/zones' + (z ? '/' + z.id : ''), v).then(() => { close(); st.reload(); })}
    />
  ));
  return (
    <div className="ws-card">
      <div className="ws-head"><h2>Zones de livraison</h2>{mgr ? <button className="btn primary small" type="button" onClick={() => edit()}>Ajouter</button> : null}</div>
      <Loaded state={st}>{(j) => (
        <>
          {!j.zones.length ? <Empty text="Aucune zone. Définissez vos zones avec leur tarif et leur délai : ils seront proposés automatiquement à chaque livraison." /> : null}
          {j.zones.map((z) => (
            <div className="line" key={z.id}>
              <span><b>{z.name}</b><small>{' ' + money(z.fee) + ' · ' + z.delayDays + ' jour(s)' + (z.note ? ' · ' + z.note : '')}</small></span>
              {mgr ? (
                <span className="row">
                  <button className="link" type="button" onClick={() => edit(z)}>Modifier</button>
                  <button className="link" type="button" onClick={() => confirm('Supprimer la zone « ' + z.name + ' » ?', () => { oapi('DELETE', '/logistics/zones/' + z.id).then(st.reload).catch(fail); })}>Supprimer</button>
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
  const { oapi, can, dateFr, today, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/logistics/rounds'), []);
  const reload = () => { st.reload(); onChange(); };
  const create = () => oapi('GET', '/logistics/carriers').then((cj) => modal('Nouvelle tournée', (close) => (
    <Form
      submitText="Créer la tournée"
      fields={[
        { k: 'name', label: 'Nom', required: true, placeholder: 'Tournée du matin' }, { k: 'date', label: 'Jour', type: 'date', required: true, value: today() },
        { k: 'carrierId', label: 'Livreur', type: 'select', options: [['', 'Non choisi']].concat(cj.carriers.filter((c) => c.active).map((c) => [String(c.id), c.name])) },
        { k: 'note', label: 'Note' },
      ]}
      onSubmit={(v) => oapi('POST', '/logistics/rounds', v).then(() => { close(); reload(); })}
    />
  ))).catch(fail);
  const save = (r, ids) => oapi('PUT', '/logistics/rounds/' + r.id + '/order', { deliveryIds: ids }).then(reload).catch(fail);
  const add = (r) => {
    const free = deliveries.filter((d) => !d.roundId && ['to_prepare', 'shipped', 'on_route'].includes(d.status));
    modal('Ajouter à la tournée', (close) => (free.length ? (
      <Form submitText="Ajouter" fields={[{ k: 'id', label: 'Livraison', type: 'select', options: free.map((d) => [String(d.id), d.customerName + (d.address ? ' : ' + d.address : '')]) }]}
        onSubmit={(v) => save(r, r.deliveries.map((d) => d.id).concat(Number(v.id))).then(close)} />
    ) : <Empty text="Aucune livraison libre à ajouter." />));
  };
  const move = (r, i, step) => { const ids = r.deliveries.map((d) => d.id); const j = i + step; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; save(r, ids); };
  return (
    <div className="ws-card">
      <div className="ws-head"><h2>Tournées</h2><button className="btn primary small" type="button" onClick={create}>Nouvelle tournée</button></div>
      <Loaded state={st}>{(j) => (
        <>
          {!j.rounds.length ? <Empty text="Aucune tournée. Regroupez les livraisons d'un jour pour un livreur et choisissez l'ordre de passage." /> : null}
          {j.rounds.map((r) => (
            <div className="ws-card" key={r.id}>
              <div className="line">
                <span><b>{r.name}</b><small>{' ' + dateFr(r.date) + (r.carrier ? ' · ' + r.carrier : '')}</small></span>
                <span className="row">
                  <button className="link" type="button" onClick={() => add(r)}>Ajouter une livraison</button>
                  {can('manager') ? <button className="link" type="button" onClick={() => confirm('Supprimer la tournée « ' + r.name + ' » ? Les livraisons restent.', () => { oapi('DELETE', '/logistics/rounds/' + r.id).then(reload).catch(fail); })}>Supprimer</button> : null}
                </span>
              </div>
              {!r.deliveries.length ? <Empty text="Aucune livraison dans cette tournée." /> : null}
              {r.deliveries.map((d, i) => (
                <div className="line" key={d.id}>
                  <span>{(i + 1) + '. '}<b>{d.customerName}</b><small>{' ' + [d.address, d.statusLabel].filter(Boolean).join(' · ')}</small></span>
                  <span className="row">
                    <button className="link" type="button" aria-label="Monter" disabled={i === 0} onClick={() => move(r, i, -1)}>Monter</button>
                    <button className="link" type="button" aria-label="Descendre" disabled={i === r.deliveries.length - 1} onClick={() => move(r, i, 1)}>Descendre</button>
                    <button className="link" type="button" onClick={() => save(r, r.deliveries.filter((x) => x.id !== d.id).map((x) => x.id))}>Retirer</button>
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
