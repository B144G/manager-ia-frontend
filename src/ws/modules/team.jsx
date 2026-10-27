import { useState } from 'react';
import { getLocale, useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';
import { Audit, Transfer } from '../parts/w3/TeamExtras.jsx';

/* Sous-application : Équipe et antennes (rôles, invitations, extensions de l'organisation). */

const ROLES = [['member', 'Membre'], ['manager', 'Responsable'], ['admin', 'Administrateur']];
const RL = { owner: 'Propriétaire', admin: 'Administrateur', manager: 'Responsable', member: 'Membre' };

export default function Team() {
  const { info, can, dateFr, modal } = useWs();
  const t = useT();
  const [iv, setIv] = useState(0);
  const invite = () => modal(t("Inviter quelqu'un"), (close) => <InviteBox close={() => { close(); setIv((n) => n + 1); }} />);
  return (
    <>
      <div className="ws-head">
        <div>
          <h1>{t('Équipe et antennes')}</h1>
          <p className="muted">{t("{used} personne(s) sur {max} permises par l'offre {plan}. IA : {ai} message(s) utilisé(s) sur {aiMax} (pour toute l'organisation), renouvelés le {date}.", { used: info.limits.membersUsed, max: info.limits.members, plan: t(info.org.plan), ai: info.limits.aiUsed.toLocaleString(getLocale()), aiMax: info.limits.aiMonth.toLocaleString(getLocale()), date: dateFr(info.limits.aiResetAt) })}</p>
        </div>
        {can('admin') ? <button className="btn primary small" type="button" onClick={invite}>{t("Inviter quelqu'un")}</button> : null}
      </div>
      <div className="ws-cols">
        <div><TeamBox /></div>
        <div><Branches />{can('admin') ? <Invites ver={iv} /> : null}</div>
      </div>
      {can('owner') ? <Transfer /> : null}
      {can('admin') ? <Audit /> : null}
    </>
  );
}

function useBranchTools() {
  const { info } = useWs();
  const t = useT();
  const branchName = (id) => { const b = info.branches.find((x) => x.id === id); return b ? b.name : ''; };
  const branchOpts = () => [['', t("Toute l'organisation")]].concat(info.branches.map((b) => [String(b.id), b.name]));
  return { branchName, branchOpts };
}

/* ----- Équipe ----- */
function TeamBox() {
  const { info, oapi, can, modal, confirm, fail } = useWs();
  const t = useT();
  const me = info.me;
  const { branchName, branchOpts } = useBranchTools();
  const st = useLoad(() => oapi('GET', '/members'), []);

  const editMember = (m) => {
    modal(t('Modifier {name}', { name: m.name }), (close) => (
      <Form
        fields={[
          { k: 'role', label: t('Rôle'), type: 'select', options: ROLES.filter((r) => r[0] !== 'admin' || me.role === 'owner').map((r) => [r[0], t(r[1])]), value: m.role, hint: t('Membre : tâches et demandes. Responsable : + projets et budget. Administrateur : + équipe, organisation, procédures.') },
          { k: 'title', label: t('Poste'), value: m.title },
          { k: 'branchId', label: t('Antenne'), type: 'select', options: branchOpts(), value: m.branchId ? String(m.branchId) : '', hint: t('Une personne rattachée à une antenne ne voit que les données de cette antenne et les données communes.') },
        ]}
        submitText={t('Enregistrer')}
        onSubmit={(v) => oapi('PUT', '/members/' + m.userId, { role: v.role, title: v.title, branchId: v.branchId || null }).then(() => { close(); st.reload(); })}
      />
    ));
  };

  return (
    <div className="ws-card">
      {st.loading && !st.data ? <Loading /> : null}
      {st.error ? <p className="ws-err" role="alert">{tsrv(st.error.message)}</p> : null}
      {st.data ? (
        <>
          <h2>{t('Équipe')}</h2>
          {st.data.members.map((m) => (
            <div className="line" key={m.userId}>
              <span><b>{m.name + (m.userId === me.userId ? ' ' + t('(vous)') : '')}</b><small>{' ' + t(RL[m.role]) + (m.title ? ' · ' + m.title : '') + (m.branchId ? ' · ' + branchName(m.branchId) : '') + (m.contact ? ' · ' + m.contact : '')}</small></span>
              <span className="row">
                {can('admin') && m.role !== 'owner' ? <button className="link" type="button" onClick={() => editMember(m)}>{t('Modifier')}</button> : null}
                {m.userId === me.userId && m.role !== 'owner' ? (
                  <button className="link" type="button" onClick={() => confirm(t('Quitter cette organisation ?'), () => { oapi('DELETE', '/members/' + m.userId).then(() => { window.location.assign('/app'); }).catch(fail); })}>{t('Quitter')}</button>
                ) : null}
                {can('admin') && m.role !== 'owner' && m.userId !== me.userId ? (
                  <button className="link" type="button" onClick={() => confirm(t("Retirer {name} de l'organisation ?", { name: m.name }), () => { oapi('DELETE', '/members/' + m.userId).then(st.reload).catch(fail); })}>{t('Retirer')}</button>
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
  const t = useT();

  const editBranch = (b0) => {
    const b = b0 || {};
    modal(b.id ? t("Modifier l'antenne") : t('Nouvelle antenne'), (close) => (
      <Form
        fields={[{ k: 'name', label: t('Nom'), required: true, value: b.name }, { k: 'location', label: t('Lieu'), value: b.location }]}
        submitText={t('Enregistrer')}
        onSubmit={(v) => oapi(b.id ? 'PUT' : 'POST', '/branches' + (b.id ? '/' + b.id : ''), v).then(() => { close(); reloadOrg(); })}
      />
    ));
  };

  return (
    <div className="ws-card">
      <h2>{t('Antennes')}</h2>
      <p className="muted small">{t('Une antenne est une succursale, un point de vente ou une extension de votre organisation.')}</p>
      {!info.branches.length ? <Empty text={t("Aucune antenne : toute l'activité est centrale.")} /> : null}
      {info.branches.map((b) => (
        <div className="line" key={b.id}>
          <span><b>{b.name}</b>{b.location ? <small>{' ' + b.location}</small> : null}</span>
          {can('admin') ? (
            <span className="row">
              <button className="link" type="button" onClick={() => editBranch(b)}>{t('Modifier')}</button>
              <button className="link" type="button" onClick={() => confirm(t("Supprimer l'antenne « {name} » ? Ses données restent, rattachées à toute l'organisation.", { name: b.name }), () => { oapi('DELETE', '/branches/' + b.id).then(reloadOrg).catch(fail); })}>{t('Supprimer')}</button>
            </span>
          ) : null}
        </div>
      ))}
      {can('admin') ? <button className="btn small" type="button" onClick={() => editBranch()}>{t('Ajouter une antenne')}</button> : null}
    </div>
  );
}

/* ----- Invitations en cours ----- */
function Invites({ ver }) {
  const { oapi, dateFr, copy, fail } = useWs();
  const t = useT();
  const { branchName } = useBranchTools();
  const st = useLoad(() => oapi('GET', '/invites'), [ver]);
  return (
    <div className="ws-card">
      <h2>{t('Invitations en cours')}</h2>
      {st.data ? (
        <>
          {!st.data.invites.length ? <Empty text={t('Aucune invitation active.')} /> : null}
          {st.data.invites.map((i) => {
            const link = window.location.origin + window.location.pathname + '#join=' + i.code;
            return (
              <div className="line" key={i.code}>
                <span><b className="mono">{i.code}</b><small>{' ' + t(RL[i.role]) + (i.branchId ? ' · ' + branchName(i.branchId) : '') + ' · ' + t("jusqu'au {date}", { date: dateFr(i.expiresAt) })}</small></span>
                <span className="row">
                  <button className="link" type="button" onClick={() => copy(link, t("Lien d'invitation copié."))}>{t('Copier le lien')}</button>
                  <button className="link" type="button" onClick={() => { oapi('DELETE', '/invites/' + i.code).then(st.reload).catch(fail); }}>{t('Annuler')}</button>
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
  const t = useT();
  const { branchOpts } = useBranchTools();
  const [link, setLink] = useState(null);
  if (link) {
    return (
      <>
        <p>{t("Envoyez ce lien à la personne (elle devra créer un compte ou se connecter). Il ne marche qu'une fois, pendant 7 jours.")}</p>
        <input value={link} readOnly onFocus={(e) => e.target.select()} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary small" type="button" onClick={() => copy(link, t('Lien copié.'))}>{t('Copier le lien')}</button>
          <button className="btn small" type="button" onClick={close}>{t('Fermer')}</button>
        </div>
      </>
    );
  }
  return (
    <Form
      fields={[
        { k: 'role', label: t('Rôle'), type: 'select', options: ROLES.filter((r) => r[0] !== 'admin' || info.me.role === 'owner').map((r) => [r[0], t(r[1])]) },
        { k: 'title', label: t('Poste (facultatif)') },
        { k: 'branchId', label: t('Antenne'), type: 'select', options: branchOpts() },
      ]}
      submitText={t("Créer l'invitation")}
      onSubmit={(v) => oapi('POST', '/invites', { role: v.role, title: v.title, branchId: v.branchId || null }).then((j) => setLink(window.location.origin + window.location.pathname + '#join=' + j.code))}
    />
  );
}
