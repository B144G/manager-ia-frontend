import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Équipe et antennes (rôles, invitations, extensions de l'organisation). */

const ROLES = [['member', 'Membre'], ['manager', 'Responsable'], ['admin', 'Administrateur']];
const RL = { owner: 'Propriétaire', admin: 'Administrateur', manager: 'Responsable', member: 'Membre' };

export default function Team() {
  const { info, can, dateFr, modal } = useWs();
  const [iv, setIv] = useState(0);
  const invite = () => modal('Inviter quelqu\'un', (close) => <InviteBox close={() => { close(); setIv((n) => n + 1); }} />);
  return (
    <>
      <div className="ws-head">
        <div>
          <h1>Équipe et antennes</h1>
          <p className="muted">{info.limits.membersUsed + ' personne(s) sur ' + info.limits.members + ' permises par l\'offre ' + info.org.plan + '. IA : ' + info.limits.aiUsed.toLocaleString('fr-FR') + ' message(s) utilisé(s) sur ' + info.limits.aiMonth.toLocaleString('fr-FR') + ' (pour toute l\'organisation), renouvelés le ' + dateFr(info.limits.aiResetAt) + '.'}</p>
        </div>
        {can('admin') ? <button className="btn primary small" type="button" onClick={invite}>Inviter quelqu'un</button> : null}
      </div>
      <div className="ws-cols">
        <div><TeamBox /></div>
        <div><Branches />{can('admin') ? <Invites ver={iv} /> : null}</div>
      </div>
    </>
  );
}

function useBranchTools() {
  const { info } = useWs();
  const branchName = (id) => { const b = info.branches.find((x) => x.id === id); return b ? b.name : ''; };
  const branchOpts = () => [['', 'Toute l\'organisation']].concat(info.branches.map((b) => [String(b.id), b.name]));
  return { branchName, branchOpts };
}

/* ----- Équipe ----- */
function TeamBox() {
  const { info, oapi, can, modal, confirm, fail } = useWs();
  const me = info.me;
  const { branchName, branchOpts } = useBranchTools();
  const st = useLoad(() => oapi('GET', '/members'), []);

  const editMember = (m) => {
    modal('Modifier ' + m.name, (close) => (
      <Form
        fields={[
          { k: 'role', label: 'Rôle', type: 'select', options: ROLES.filter((r) => r[0] !== 'admin' || me.role === 'owner'), value: m.role, hint: 'Membre : tâches et demandes. Responsable : + projets et budget. Administrateur : + équipe, organisation, procédures.' },
          { k: 'title', label: 'Poste', value: m.title },
          { k: 'branchId', label: 'Antenne', type: 'select', options: branchOpts(), value: m.branchId ? String(m.branchId) : '', hint: 'Une personne rattachée à une antenne ne voit que les données de cette antenne et les données communes.' },
        ]}
        submitText="Enregistrer"
        onSubmit={(v) => oapi('PUT', '/members/' + m.userId, { role: v.role, title: v.title, branchId: v.branchId || null }).then(() => { close(); st.reload(); })}
      />
    ));
  };

  return (
    <div className="ws-card">
      {st.loading && !st.data ? <Loading /> : null}
      {st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : null}
      {st.data ? (
        <>
          <h2>Équipe</h2>
          {st.data.members.map((m) => (
            <div className="line" key={m.userId}>
              <span><b>{m.name + (m.userId === me.userId ? ' (vous)' : '')}</b><small>{' ' + RL[m.role] + (m.title ? ' · ' + m.title : '') + (m.branchId ? ' · ' + branchName(m.branchId) : '') + (m.contact ? ' · ' + m.contact : '')}</small></span>
              <span className="row">
                {can('admin') && m.role !== 'owner' ? <button className="link" type="button" onClick={() => editMember(m)}>Modifier</button> : null}
                {m.userId === me.userId && m.role !== 'owner' ? (
                  <button className="link" type="button" onClick={() => confirm('Quitter cette organisation ?', () => { oapi('DELETE', '/members/' + m.userId).then(() => { window.location.assign('/app'); }).catch(fail); })}>Quitter</button>
                ) : null}
                {can('admin') && m.role !== 'owner' && m.userId !== me.userId ? (
                  <button className="link" type="button" onClick={() => confirm('Retirer ' + m.name + ' de l\'organisation ?', () => { oapi('DELETE', '/members/' + m.userId).then(st.reload).catch(fail); })}>Retirer</button>
                ) : null}
              </span>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

/* ----- Antennes ----- */
function Branches() {
  const { info, oapi, can, modal, confirm, fail, reloadOrg } = useWs();

  const editBranch = (b0) => {
    const b = b0 || {};
    modal(b.id ? 'Modifier l\'antenne' : 'Nouvelle antenne', (close) => (
      <Form
        fields={[{ k: 'name', label: 'Nom', required: true, value: b.name }, { k: 'location', label: 'Lieu', value: b.location }]}
        submitText="Enregistrer"
        onSubmit={(v) => oapi(b.id ? 'PUT' : 'POST', '/branches' + (b.id ? '/' + b.id : ''), v).then(() => { close(); reloadOrg(); })}
      />
    ));
  };

  return (
    <div className="ws-card">
      <h2>Antennes</h2>
      <p className="muted small">Une antenne est une succursale, un point de vente ou une extension de votre organisation.</p>
      {!info.branches.length ? <Empty text="Aucune antenne : toute l'activité est centrale." /> : null}
      {info.branches.map((b) => (
        <div className="line" key={b.id}>
          <span><b>{b.name}</b>{b.location ? <small>{' ' + b.location}</small> : null}</span>
          {can('admin') ? (
            <span className="row">
              <button className="link" type="button" onClick={() => editBranch(b)}>Modifier</button>
              <button className="link" type="button" onClick={() => confirm('Supprimer l\'antenne « ' + b.name + ' » ? Ses données restent, rattachées à toute l\'organisation.', () => { oapi('DELETE', '/branches/' + b.id).then(reloadOrg).catch(fail); })}>Supprimer</button>
            </span>
          ) : null}
        </div>
      ))}
      {can('admin') ? <button className="btn small" type="button" onClick={() => editBranch()}>Ajouter une antenne</button> : null}
    </div>
  );
}

/* ----- Invitations en cours ----- */
function Invites({ ver }) {
  const { oapi, dateFr, copy, fail } = useWs();
  const { branchName } = useBranchTools();
  const st = useLoad(() => oapi('GET', '/invites'), [ver]);
  return (
    <div className="ws-card">
      <h2>Invitations en cours</h2>
      {st.data ? (
        <>
          {!st.data.invites.length ? <Empty text="Aucune invitation active." /> : null}
          {st.data.invites.map((i) => {
            const link = window.location.origin + window.location.pathname + '#join=' + i.code;
            return (
              <div className="line" key={i.code}>
                <span><b className="mono">{i.code}</b><small>{' ' + RL[i.role] + (i.branchId ? ' · ' + branchName(i.branchId) : '') + ' · jusqu\'au ' + dateFr(i.expiresAt)}</small></span>
                <span className="row">
                  <button className="link" type="button" onClick={() => copy(link, 'Lien d\'invitation copié.')}>Copier le lien</button>
                  <button className="link" type="button" onClick={() => { oapi('DELETE', '/invites/' + i.code).then(st.reload).catch(fail); }}>Annuler</button>
                </span>
              </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
}

/* ----- Fenêtre « Inviter quelqu'un » ----- */
function InviteBox({ close }) {
  const { info, oapi, copy } = useWs();
  const { branchOpts } = useBranchTools();
  const [link, setLink] = useState(null);
  if (link) {
    return (
      <>
        <p>Envoyez ce lien à la personne (elle devra créer un compte ou se connecter). Il ne marche qu'une fois, pendant 7 jours.</p>
        <input value={link} readOnly onFocus={(e) => e.target.select()} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary small" type="button" onClick={() => copy(link, 'Lien copié.')}>Copier le lien</button>
          <button className="btn small" type="button" onClick={close}>Fermer</button>
        </div>
      </>
    );
  }
  return (
    <Form
      fields={[
        { k: 'role', label: 'Rôle', type: 'select', options: ROLES.filter((r) => r[0] !== 'admin' || info.me.role === 'owner') },
        { k: 'title', label: 'Poste (facultatif)' },
        { k: 'branchId', label: 'Antenne', type: 'select', options: branchOpts() },
      ]}
      submitText="Créer l'invitation"
      onSubmit={(v) => oapi('POST', '/invites', { role: v.role, title: v.title, branchId: v.branchId || null }).then((j) => setLink(window.location.origin + window.location.pathname + '#join=' + j.code))}
    />
  );
}
