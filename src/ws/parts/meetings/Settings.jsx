import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Failed } from './Failed.jsx';
import { Alert, Badge, Button, Card, Field, Skeleton } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { ROLE_IDS, ROLE_IDS_Q, TYPE_IDS, useLabels, useMtg } from './common.jsx';

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

const num = (v) => (v === '' || v === undefined ? 0 : Number(v));
function QuorumEditor({ value, onChange }) {
  const t = useT();
  const L = useLabels();
  const q = value || {};
  const on = (ty) => Boolean(q[ty]);
  const upd = (ty, patch) => onChange({ ...q, [ty]: { ...q[ty], ...patch } });
  const empty = { minCount: 0, minPercent: 0, roles: {}, reduced: { allowed: false, minCount: 0, minPercent: 0, delayDays: 7 } };
  return (
    <Card title={t('Quorum par type de réunion')} subtitle={t("Nombre ou pourcentage de présents requis, et présences minimales par rôle. Calculé en direct pendant la séance ; sans quorum, aucune décision n'est valable.")}>
      <div className="mtg-sec">
        {TYPE_IDS.map((ty) => (
          <div className="mtg-rule" key={ty}>
            <label className="mtg-check"><input type="checkbox" checked={on(ty)} onChange={(e) => { const n = { ...q }; if (e.target.checked) n[ty] = { ...empty, minCount: 2 }; else delete n[ty]; onChange(n); }} /><b>{L.types[ty]}</b>{on(ty) ? null : <span className="mtg-muted"> — {t('quorum non exigé')}</span>}</label>
            {on(ty) ? (
              <div className="mtg-sec">
                <div className="mtg-grid2">
                  <Field label={t('Nombre minimal de présents')}>{(p) => <input {...p} type="number" min="0" max="100" value={q[ty].minCount} onChange={(e) => upd(ty, { minCount: num(e.target.value) })} />}</Field>
                  <Field label={t('Pourcentage minimal des convoqués (%)')}>{(p) => <input {...p} type="number" min="0" max="100" value={q[ty].minPercent} onChange={(e) => upd(ty, { minPercent: num(e.target.value) })} />}</Field>
                </div>
                <b>{t('Présences minimales par rôle')}</b>
                <div className="mtg-grid2">{ROLE_IDS_Q.map((r) => <Field key={r} label={L.roles4[r]}>{(p) => <input {...p} type="number" min="0" max="100" value={(q[ty].roles || {})[r] || 0} onChange={(e) => upd(ty, { roles: { ...q[ty].roles, [r]: num(e.target.value) } })} />}</Field>)}</div>
                <label className="mtg-check"><input type="checkbox" checked={Boolean(q[ty].reduced && q[ty].reduced.allowed)} onChange={(e) => upd(ty, { reduced: { ...empty.reduced, ...q[ty].reduced, allowed: e.target.checked } })} />{t("Autoriser une 2ᵉ convocation à quorum réduit si le quorum n'est pas atteint")}</label>
                {q[ty].reduced && q[ty].reduced.allowed ? (
                  <div className="mtg-grid2">
                    <Field label={t('Quorum réduit : nombre minimal')}>{(p) => <input {...p} type="number" min="0" max="100" value={q[ty].reduced.minCount} onChange={(e) => upd(ty, { reduced: { ...q[ty].reduced, minCount: num(e.target.value) } })} />}</Field>
                    <Field label={t('Quorum réduit : pourcentage (%)')}>{(p) => <input {...p} type="number" min="0" max="100" value={q[ty].reduced.minPercent} onChange={(e) => upd(ty, { reduced: { ...q[ty].reduced, minPercent: num(e.target.value) } })} />}</Field>
                    <Field label={t('Délai avant la nouvelle convocation (jours)')}>{(p) => <input {...p} type="number" min="1" max="60" value={q[ty].reduced.delayDays} onChange={(e) => upd(ty, { reduced: { ...q[ty].reduced, delayDays: num(e.target.value) } })} />}</Field>
                  </div>
                ) : null}
              </div>
            ) : null}
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
            <div><b>{t('Quorum exigé :')}</b><div className="mtg-row" style={{ marginTop: 6 }}>{Object.keys(s.quorum || {}).length ? Object.entries(s.quorum).map(([ty, q]) => <Badge key={ty} tone="outline">{L.types[ty]} : {[q.minCount ? t('{n} présent(s)', { n: q.minCount }) : '', q.minPercent ? q.minPercent + ' %' : ''].filter(Boolean).join(' / ')}</Badge>) : <span className="mtg-muted">{t('aucune règle de quorum')}</span>}</div></div>
            <div><b>{t('Vous pouvez valider les comptes rendus :')}</b><div className="mtg-row" style={{ marginTop: 6 }}>{s.me.validate.length ? s.me.validate.map((x) => <Badge key={x} tone="ok">{L.types[x]}</Badge>) : <span className="mtg-muted">{t('aucun type de réunion')}</span>}</div></div>
          </div>
        </Card>
      </div>
    );
  }
  const c = cfg || s.config;
  const save = () => {
    setBusy(true);
    oapi('PUT', '/meetings/settings', { convene: c.convene, validate: c.validate, distinct: c.distinct, quorum: c.quorum || {}, noticeH: c.noticeH, blockConflicts: c.blockConflicts, signOrdered: c.signOrdered, maxParticipants: Number(c.maxParticipants) || 60 }).then((r) => { setCfg(r.config); setWarn(r.warnings || []); toast(t('Réglages enregistrés.')); }).catch(fail).finally(() => setBusy(false));
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
      <QuorumEditor value={c.quorum} onChange={(v) => setCfg({ ...c, quorum: v })} />
      <Card title={t('Préavis minimal des convocations')} subtitle={t("Délai minimal entre la convocation et la réunion ; une réunion urgente ou critique a un préavis réduit. Un préavis trop court déclenche un avertissement.")}>
        <div className="mtg-grid2">{[['normal', t('Réunion normale (heures)')], ['urgent', t('Réunion urgente (heures)')], ['critical', t('Réunion critique (heures)')]].map(([k, lab]) => <Field key={k} label={lab}>{(p) => <input {...p} type="number" min="0" max="720" value={(c.noticeH || {})[k]} onChange={(e) => setCfg({ ...c, noticeH: { ...c.noticeH, [k]: num(e.target.value) } })} />}</Field>)}</div>
      </Card>
      <Card title={t('Limites')} subtitle={t('Nombre maximal de participants par réunion (de 10 à 500). Le partage d’écran se fait dans la salle de visioconférence, quel que soit le nombre de membres.')}>
        <Field label={t('Participants par réunion')}>{(p) => <input {...p} type="number" min="10" max="500" value={c.maxParticipants || 60} onChange={(e) => setCfg({ ...c, maxParticipants: num(e.target.value) })} />}</Field>
      </Card>
      <Card title={t("Conflits d'agenda et signatures")}>
        <div className="mtg-sec">
          <label className="mtg-check"><input type="checkbox" checked={Boolean(c.blockConflicts)} onChange={(e) => setCfg({ ...c, blockConflicts: e.target.checked })} />{t("Bloquer la convocation en cas de conflit d'agenda (sinon : simple avertissement)")}</label>
          <label className="mtg-check"><input type="checkbox" checked={Boolean(c.signOrdered)} onChange={(e) => setCfg({ ...c, signOrdered: e.target.checked })} />{t('Procès-verbaux : signatures dans l’ordre de la liste par défaut')}</label>
        </div>
      </Card>
      {warn.map((w) => <Alert key={w.code} tone="warn" title={t("Attention : un seul validateur possible")}>{t("Pour ces types de réunion, une seule personne peut valider : {types}. Désignez-en une deuxième, sinon aucun compte rendu rédigé par elle ne pourra être validé.", { types: w.types.map((x) => L.types[x]).join(', ') })}</Alert>)}
      <div className="mtg-row"><Button variant="primary" icon="check" loading={busy} onClick={save}>{t('Enregistrer les réglages')}</Button></div>
    </div>
  );
}
