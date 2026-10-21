import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';

/** Fournisseur : création / modification. */
export function SupplierForm({ supplier, close, done }) {
  const { oapi } = useWs();
  const s = supplier || {};
  return (
    <Form
      fields={[
        { k: 'name', label: 'Nom', required: true, value: s.name },
        { k: 'contact', label: 'Contact (téléphone, WhatsApp)', value: s.contact },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, value: s.notes, hint: 'Fiabilité, conditions de paiement, jours de livraison…' },
      ]}
      submitText="Enregistrer"
      onSubmit={(v) => oapi(s.id ? 'PUT' : 'POST', '/stock/suppliers' + (s.id ? '/' + s.id : ''), v).then(() => { close(); done(); })}
    />
  );
}

/** Contenu de la fenêtre « Fournisseurs ». */
export default function Suppliers() {
  const { oapi, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/stock/suppliers'), []);
  const editSupplier = (s) => modal(s ? 'Modifier le fournisseur' : 'Nouveau fournisseur', (close) => <SupplierForm supplier={s} close={close} done={st.reload} />);
  return (
    <>
      <div>
        {st.loading && !st.data ? <Loading /> : null}
        {st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : null}
        {st.data && !st.data.suppliers.length ? <Empty text="Aucun fournisseur." /> : null}
        {st.data ? st.data.suppliers.map((s) => (
          <div className="line" key={s.id}>
            <span><b>{s.name}</b>{s.contact ? <small>{' ' + s.contact}</small> : null}</span>
            <span className="row">
              <button className="link" type="button" onClick={() => editSupplier(s)}>Modifier</button>
              <button className="link" type="button" onClick={() => confirm('Supprimer ' + s.name + ' ?', () => { oapi('DELETE', '/stock/suppliers/' + s.id).then(st.reload).catch(fail); })}>Supprimer</button>
            </span>
          </div>
        )) : null}
      </div>
      <button className="btn primary small" type="button" onClick={() => editSupplier(null)}>Ajouter un fournisseur</button>
    </>
  );
}
