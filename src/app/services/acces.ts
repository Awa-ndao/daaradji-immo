// Qui a accès à quoi. Doit rester identique aux groupes de routes de routes/api.php (Laravel).
export type Role = 'proprietaire' | 'administrateur' | 'agent' | 'comptable' | 'receptionniste';

const TOUS: Role[] = ['proprietaire', 'administrateur', 'agent', 'comptable', 'receptionniste'];
const DIRECTION: Role[] = ['proprietaire', 'administrateur'];

export const ACCES: Record<string, Role[]> = {
  dashboard: TOUS,
  biens: [...DIRECTION, 'agent'],
  achats: [...DIRECTION, 'agent'],
  clients: [...DIRECTION, 'agent', 'receptionniste'],
  ventes: [...DIRECTION, 'agent'],
  locations: [...DIRECTION, 'agent'],
  constructions: [...DIRECTION, 'agent'],
  'rendez-vous': [...DIRECTION, 'agent', 'receptionniste'],
  contrats: [...DIRECTION, 'agent'],
  factures: [...DIRECTION, 'comptable'],
  paiements: [...DIRECTION, 'comptable'],
  utilisateurs: DIRECTION
};

export const ROLE_LIBELLES: Record<string, string> = {
  proprietaire: 'Propriétaire',
  administrateur: 'Administrateur',
  agent: 'Agent immobilier',
  comptable: 'Comptable',
  receptionniste: 'Réceptionniste'
};
