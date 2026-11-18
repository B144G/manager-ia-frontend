import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Failed } from './Failed.jsx';
import { Alert, Badge, Button, Card, Skeleton } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { ROLE_IDS, TYPE_IDS, useLabels, useMtg } from './common.jsx';

/* Réglages des réunions : le responsable du compte décide qui peut convoquer et qui peut valider un compte rendu, par personne, par rôle
   et, s'il le souhaite, par type de réunion. Par défaut, seul le propriétaire fait les deux. Le serveur applique ces réglages à chaque action. */

function RuleEditor({ rule, onChange, members, label }) {
  const t = useT();
  const L = useLabels();
  const toggle = (k, v) => { const cur = new Set(rule[k]); if (cur.has(v)) cur.delete(v); else cur.add(v); onChange({ ...rule, [k]: [...cur] }); };
  return (
    <div className="mtg-sec">
      <b>{t('Par rôle')}</b>
      <div className="mtg-row" role="group" aria-label={label + ' — ' + t('Par rôle')}>
        {ROLE_IDS.map((r) => <label className="mtg-check" key={r}><input type="checkbox" checked={rule.roles.includes(r)} onChange={() => toggle('roles', r)} />{L.roles[r]}</label>)}
      </div>
      <b>{t('Par personne')}</b>
      <div className="mtg-picks" role="group" aria-label={label + ' — ' + t('Par personne')}>
        {members.length ? members.map((m) => <label key={m.userId}><input type="checkbox" checked={rule.users.includes(m.userId)} onChange={() => toggle('users', m.userId)} /><span>{m.name}<small className="mtg-muted"> · {m.title || L.role1[m.role] || ''}</small></span></label>) : <p className="mtg-muted">{t("Aucun autre membre dans l'équipe pour l'instant.")}</p>}
      </div>
    </div>
  );
}

function Side({ side, value, onChange, members, title, subtitle }) {
  const t = useT();
  const L = useLabels();
  const [openTypes, setOpenTypes] = useState(() => new Set(Object.keys(value.types)));
  const own = (ty) => openTypes.has(ty);
  const setOwn = (ty, on) => {
    setOpenTypes((s) => { const n = new Set(s); if (on) n.add(ty); else n.delete(ty); return n; });
    const types = { ...value.types };
    if (on) types[ty] = { users: [...value.default.users], roles: [...value.default.roles] }; else delete types[ty];
    onChange({ ...value, types });
  };
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="mtg-sec">
        <div className="mtg-rule">
          <h4>{t('Règle générale (tous les types de réunion)')}</h4>
          <RuleEditor rule={value.default} members={members} label={title} onChange={(r) => onChange({ ...value, default: r })} />
          <p className="mtg-muted">{t('Le propriétaire du compte a toujours ce droit.')}</p>
        </div>
        <h4 style={{ margin: 0 }}>{t('Règle propre à un type de réunion')}</h4>
        <p className="mtg-muted">{t("Une règle propre à un type REMPLACE la règle générale pour ce type.")}</p>
        {TYPE_IDS.map((ty) => (
          <div className="mtg-rule" key={side + ty}>
            <label className="mtg-check"><input type="checkbox" checked={own(ty)} onChange={(e) => setOwn(ty, e.target.checked)} /><b>{L.types[ty]}</b>{own(ty) ? null : <span className="mtg-muted"> — {t('règle générale')}</span>}</label>
            {own(ty) ? <RuleEditor rule={value.types[ty]} members={members} label={title + ' — ' + L.types[ty]} onChange={(r) => onChange({ ...value, types: { ...value.types, [ty]: r } })} /> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function SettingsScreen() {
  const t = useT();
  const L = useLabels();
  const { oapi, toast, fail, info } = useMtg();
  const st = useLoad(() => Promise.all([oapi('GET', '/meetings/settings'), oapi('GET', '/members')]), []);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState([]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Skeleton lines={8} />;
  const [s, mem] = st.data;
  const members = mem.members.filter((m) => m.role !== 'owner' && m.userId !== info.me.userId);
  if (!s.me.isOwner) {
    return (
      <div className="mtg">
        <Alert tone="info" title={t('Ces réglages appartiennent au responsable du compte')}>{t('Le propriétaire de l\'organisation décide qui peut convoquer une réunion et qui peut valider un compte rendu. Voici ce qu\'il vous a accordé.')}</Alert>
        <Card title={t('Vos droits')}>
          <div className="mtg-sec">
            <div><b>{t('Vous pouvez convoquer :')}</b><div className="mtg-row" style={{ marginTop: 6 }}>{s.me.convene.length ? s.me.convene.map((x) => <Badge key={x} tone="brand">{L.types[x]}</Badge>) : <span className="mtg-muted">{t('aucun type de réunion')}</span>}</div></div>
            <div><b>{t('Vous pouvez valider les comptes rendus :')}</b><div className="mtg-row" style={{ marginTop: 6 }}>{s.me.validate.length ? s.me.validate.map((x) => <Badge key={x} tone="ok">{L.types[x]}</Badge>) : <span className="mtg-muted">{t('aucun type de réunion')}</span>}</div></div>
          </div>
        </Card>
      </div>
    );
  }
  const c = cfg || s.config;
  const save = () => {
    setBusy(true);
    oapi('PUT', '/meetings/settings', { convene: c.convene, validate: c.validate, distinct: c.distinct }).then((r) => { setCfg(r.config); setWarn(r.warnings || []); toast(t('Réglages enregistrés.')); }).catch(fail).finally(() => setBusy(false));
  };
  return (
    <div className="mtg">
      <Alert tone="info" title={t('Vous décidez qui convoque et qui valide')}>{t("Par défaut, seul le propriétaire du compte convoque les réunions et valide les comptes rendus. Vous pouvez déléguer à des personnes ou à des rôles, pour tous les types de réunion ou pour certains seulement, et en désigner plusieurs.")}</Alert>
      <Side side="convene" title={t('Qui peut convoquer une réunion')} subtitle={t("Créer, modifier, annuler la convocation et rédiger le compte rendu.")} value={c.convene} members={members} onChange={(v) => setCfg({ ...c, convene: v })} />
      <Side side="validate" title={t('Qui peut valider un compte rendu')} subtitle={t('Valider, renvoyer pour correction ou rouvrir un compte rendu validé.')} value={c.validate} members={members} onChange={(v) => setCfg({ ...c, validate: v })} />
      <Card title={t('Contrôle')}>
        <label className="mtg-check"><input type="checkbox" checked={c.distinct} onChange={(e) => setCfg({ ...c, distinct: e.target.checked })} />{t("Exiger un validateur distinct de l'auteur du compte rendu")}</label>
        <p className="mtg-muted">{t("La personne qui soumet le compte rendu ne peut pas le valider elle-même : une autre personne autorisée doit le faire.")}</p>
      </Card>
      {warn.map((w) => <Alert key={w.code} tone="warn" title={t("Attention : un seul validateur possible")}>{t("Pour ces types de réunion, une seule personne peut valider : {types}. Désignez-en une deuxième, sinon aucun compte rendu rédigé par elle ne pourra être validé.", { types: w.types.map((x) => L.types[x]).join(', ') })}</Alert>)}
      <div className="mtg-row"><Button variant="primary" icon="check" loading={busy} onClick={save}>{t('Enregistrer les réglages')}</Button></div>
    </div>
  );
}
