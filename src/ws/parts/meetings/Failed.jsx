import { tsrv } from '../../../lib/srv.js';
import { Alert } from '../../ui/index.jsx';

/** Message d'erreur du serveur (traduit si connu). */
export function Failed({ e }) {
  return <Alert tone="danger">{tsrv((e && e.message) || 'Erreur')}</Alert>;
}
