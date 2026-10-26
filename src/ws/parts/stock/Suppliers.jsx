import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';

/** Fournisseur : création / modification. */
export function SupplierForm({ supplier, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const s = supplier || {};
  return (
    <Form
      fields={[
        { k: 'name', label: t('Nom'), required: true, value: s.name },
        { k: 'contact', label: t('Contact (téléphone, WhatsApp)'), value: s.contact },
        { k: 'notes', label: t('Notes'), type: 'textarea', rows: 3, value: s.notes, hint: t('Fiabilité, conditions de paiement, jours de livraison…') },
      ]}
      submitText={t("Enregistrer")}
      onSubmit={(v) => oapi(s.id ? 'PUT' : 'POST', '/stock/suppliers' + (s.id ? '/' + s.id : ''), v).then(() => { close(); done(); })}
    />
  );
}

/** Contenu de la fenêtre « Fournisseurs ». */
export default function Suppliers() {
  const t = useT();
  const { oapi, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/stock/suppliers'), []);
  const editSupplier = (s) => modal(s ? t('Modifier le fournisseur') : t('Nouveau fournisseur'), (close) => <SupplierForm supplier={s} close={close} done={st.reload} />);
  return (
    <>
      <div>
        {st.loading && !st.data ? <Loading /> : null}
        {st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : null}
        {st.data && !st.data.suppliers.length ? <Empty text={t("Aucun fournisseur.")} /> : null}
        {st.data ? st.data.suppliers.map((s) => (
          <div className="line" key={s.id}>
            <span><b>{s.name}</b>{s.contact ? <small>{' ' + s.contact}</small> : null}</span>
            <span className="row">
              <button className="link" type="button" onClick={() => editSupplier(s)}>{t('Modifier')}</button>
              <button className="link" type="button" onClick={() => confirm(t('Supprimer {name} ?', { name: s.name }), () => { oapi('DELETE', '/stock/suppliers/' + s.id).then(st.reload).catch(fail); })}>{t('Supprimer')}</button>
            </span>
          </div>
        )) : null}
      </div>
      <button className="btn primary small" type="button" onClick={() => editSupplier(null)}>{t('Ajouter un fournisseur')}</button>
    </>
  );
}
