/* Boutons du module Juridique : hauteur d'au moins 44 px (doigt sur téléphone). */
export const Act = ({ children, ...p }) => <button type="button" className="link" style={{ minHeight: 44, minWidth: 44, padding: '0 8px' }} {...p}>{children}</button>;
export const Btn = ({ children, className = 'btn', ...p }) => <button type="button" className={className} style={{ minHeight: 44 }} {...p}>{children}</button>;
