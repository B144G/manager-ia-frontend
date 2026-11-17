import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGraduationCap, faStore, faUtensils } from '@fortawesome/free-solid-svg-icons';

// Icônes propres à la vitrine (métiers) : importées ici, hors de la bibliothèque partagée src/lib/fa.jsx.
const MAP = { store: faStore, school: faGraduationCap, food: faUtensils };
export default function Ic({ name }) { return MAP[name] ? <FontAwesomeIcon icon={MAP[name]} aria-hidden="true" /> : null; }
