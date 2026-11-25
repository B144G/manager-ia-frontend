/* Compte d'entreprise : aides communes (espaces, niveaux, copie d'un code d'invitation). */
export const SPACE_ORDER = ['direction', 'commercial', 'finances', 'stock', 'rh', 'operations', 'projets', 'gestion', 'compte'];
export const SPACE_TITLE = {
  direction: 'Direction et pilotage', commercial: 'Commercial', finances: 'Comptabilité et finances', stock: 'Stock et achats', rh: 'Ressources humaines',
  operations: 'Opérations', projets: 'Projets et réunions', gestion: 'Administration et juridique', compte: 'Administration du compte',
};
export const LEVELS = ['view', 'write', 'manage'];
export const KIND_LABEL = { director: 'Directeur', head: 'Responsable', staff: 'Équipe' };

/** Adresse à donner à la personne invitée : ouvre MABAH avec son code déjà saisi. */
export const joinLink = (code) => `${window.location.origin}/app#join=${code}`;
