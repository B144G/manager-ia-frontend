import { useEffect, useState } from 'react';
import { rq } from '../../lib/api.js';

// Prix de repli (identiques aux prix par défaut du serveur) ; les vrais prix sont relus depuis /api/plans, comme avant la refonte.
export const DEFAULT_PRICES = { week: 21500, month: 80000, quarter: 224000, semester: 425000, year: 800000 };
export const fcfa = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0FCFA';
let cache = null;

/** Prix des offres : une seule lecture du serveur pour toute la page (tarifs et questions fréquentes). */
export function usePlans() {
  const [s, setS] = useState(cache || { prices: DEFAULT_PRICES, min: 10000 });
  useEffect(() => {
    if (cache) return;
    rq('GET', '/api/plans').then((j) => {
      const p = {}; for (const x of j.plans || []) if (x.period) p[x.period] = x.priceXAF;
      const next = { prices: Object.keys(p).length === 5 ? p : DEFAULT_PRICES, min: (j.custom && j.custom.minAmount) || 10000 };
      cache = next; setS(next);
    }, () => {});
  }, []);
  return s;
}
