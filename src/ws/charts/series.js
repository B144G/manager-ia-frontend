export const SERIES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
export const compact = (n) => {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + ' Md';
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + ' M';
  if (a >= 1e3) return Math.round(n / 1e3) + ' k';
  return String(Math.round(n));
};

