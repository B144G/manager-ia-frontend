import { lazy } from 'react';

// Une sous-application = un fichier dans ./modules (nom du fichier = identifiant donné par le serveur), qui exporte par défaut un composant.
// Pour en ajouter une : créez le fichier, puis ajoutez son identifiant et son icône ici.
export const MODULE_ICONS = {
  dashboard: 'dashboard', alerts: 'alerts', support: 'support', projects: 'projects', budget: 'budget', stock: 'stock', crm: 'crm', hr: 'hr',
  accounting: 'budget', integrations: 'processes', billing: 'budget', sales: 'sales', structure: 'structure', processes: 'processes', team: 'team',
  payroll: 'payroll', fiscal: 'fiscal', marketing: 'marketing', logistics: 'logistics', production: 'production', construction: 'construction', maintenance: 'maintenance', legal: 'legal', memory: 'memory', agents: 'agents',
};

const loaders = import.meta.glob('./modules/*.jsx');
const cache = new Map();

export const hasModule = (id) => Boolean(loaders[`./modules/${id}.jsx`]);
export function moduleComponent(id) {
  if (!cache.has(id)) cache.set(id, lazy(loaders[`./modules/${id}.jsx`]));
  return cache.get(id);
}

// Conseils affichés dans le panneau de l'IA, selon la sous-application ouverte.
export const SUGGEST = {
  general: ["Fais le point sur mon organisation", "Que dois-je faire en premier aujourd'hui ?", 'Où perds-je du temps ou de l\'argent ?'],
  dashboard: ['Fais le point sur mon organisation', "Que dois-je faire en premier aujourd'hui ?"],
  support: ['Quelles demandes traiter en premier ?', 'Quels problèmes reviennent chez les clients ?', 'Comment répondre plus vite ?'],
  projects: ['Quelles tâches sont en retard et que faire ?', "Comment répartir le travail dans l'équipe ?"],
  budget: ['Où partent mes dépenses ?', 'Quelles limites mensuelles me conseilles-tu ?'],
  stock: ['Quels articles risquent la rupture ?', 'Quelles commandes passer en premier ?', 'Quel fournisseur choisir ?'],
  crm: ['Quelles factures relancer en premier ?', 'Qui sont mes meilleurs clients ?', 'Comment encaisser plus vite ?'],
  hr: ['Qui est absent cette semaine ?', 'Comment organiser le planning ?', 'Dois-je accepter cette demande de congé ?'],
  sales: ['Quelle campagne marche le mieux ?', 'Que dois-je faire des prospects non convertis ?', 'Que manque-t-il à mon catalogue ?'],
  structure: ['Quels postes me manquent ?', 'Y a-t-il des zones floues dans mon organisation ?'],
  processes: ['Quelles procédures devrais-je écrire en premier ?', 'Comment rendre mon équipe autonome ?'],
  payroll: ['Prépare la paie du mois', 'Quel est le coût total de mon équipe ?'],
  fiscal: ['Quelles déclarations dois-je préparer ?', 'Mes comptes sont-ils prêts pour la liasse ?'],
  marketing: ['Quelle campagne rapporte le plus ?', 'Écris une publicité pour mon produit phare'],
  logistics: ['Quelles livraisons sont en retard ?', 'Quel transporteur me coûte le moins cher ?'],
  production: ['Que puis-je produire avec mon stock actuel ?', 'Quelles matières vont manquer ?'],
  construction: ['Quels chantiers dépassent leur budget ?', 'Quelles phases sont en retard ?'],
  maintenance: ['Quelles machines ont une maintenance en retard ?', 'Quelles pannes reviennent le plus souvent ?'],
  legal: ['Quels contrats arrivent à échéance ?', 'Quelles obligations dois-je respecter ce mois-ci ?'],
  memory: ['Pourquoi avons-nous pris cette décision ?', 'Retrouve ce qui s\'est passé avec ce fournisseur'],
  team: ['Comment organiser mes antennes ?', 'Quels rôles donner à chacun ?'],
};
