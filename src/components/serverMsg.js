/* Messages d'erreur du serveur (en français) : traduit les messages statiques (via le dictionnaire) et ceux qui contiennent un nombre.
   Usage : serverMsg(t, e.message) avec t = useT(). */
export function serverMsg(t, msg) {
  const s = String(msg ?? '');
  let m = s.match(/^Patientez (\d+) s avant de redemander un code\.$/);
  if (m) return t('Patientez {n} s avant de redemander un code.', { n: m[1] });
  m = s.match(/^Trop d'échecs : connexion bloquée pendant encore (\d+) min\. Vous pouvez aussi réinitialiser votre mot de passe\.$/);
  if (m) return t("Trop d'échecs : connexion bloquée pendant encore {n} min. Vous pouvez aussi réinitialiser votre mot de passe.", { n: m[1] });
  return t(s);
}
