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

/** Titres français des écrans (les mêmes que le menu ; traduits à l'affichage). */
export const MODULE_TITLES = {
  dashboard: 'Tableau de bord', support: 'Service client', projects: 'Projets et tâches', budget: 'Budget', stock: 'Stock et achats', crm: 'Clients et ventes', sales: 'Assistant commercial', commercial: 'Commercial',
  aifollow: "Suivi de l'IA", hr: 'Ressources humaines', talents: 'Talents et compétences', payroll: 'Paie', fiscal: 'Fiscalité et liasse', marketing: 'Marketing', logistics: 'Logistique', production: 'Production',
  construction: 'Chantiers (BTP)', maintenance: 'Maintenance', legal: 'Juridique et conformité', memory: "Mémoire de l'entreprise", agents: 'Agents spécialisés', accounting: 'Comptabilité', treasury: 'Trésorerie',
  library: 'Bibliothèque', purchasing: 'Achats', parties: 'Clients et fournisseurs', meetings: 'Réunions', chat: 'Chat interne', structure: 'Organisation', history: "Histoire de l'entreprise",
  integrations: 'Intégrations', administration: 'Administration', billing: 'Abonnement', profil: 'Mon espace de travail', partners: 'Partenaires et espaces partagés', entreprise: 'Entreprise et organigramme',
};
