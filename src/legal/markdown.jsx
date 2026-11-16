/* Petit rendu Markdown (titres, paragraphes, listes, tableaux, citations, gras, italique, code, liens).
   Tout passe par React (échappé) : jamais de HTML brut. Seuls les liens http(s), mailto: et # sont acceptés. */

export const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const safeHref = (h) => (/^(https?:|mailto:|#|\/)/i.test(h) ? h : '#');

/** Éléments en ligne : **gras**, *italique*, `code`, [texte](lien). */
export function inline(text, key = 'i') {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0, m, n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = key + n++;
    if (m[2] !== undefined || m[3] !== undefined) out.push(<b key={k}>{inline(m[2] ?? m[3], k)}</b>);
    else if (m[4] !== undefined) out.push(<em key={k}>{inline(m[4], k)}</em>);
    else if (m[5] !== undefined) out.push(<code key={k}>{m[5]}</code>);
    else { const ext = /^https?:/i.test(m[7]); out.push(<a key={k} href={safeHref(m[7])} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{inline(m[6], k)}</a>); }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-');

/** Découpe le texte en blocs : { type, ... }. */
export function parse(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(l);
    if (m) { blocks.push({ type: 'h', level: m[1].length, text: m[2] }); i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { blocks.push({ type: 'hr' }); i++; continue; }
    if (l.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(l); const rows = []; i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(cells(lines[i])); i++; }
      blocks.push({ type: 'table', head, rows }); continue;
    }
    if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; } blocks.push({ type: 'quote', text: buf.join(' ') }); continue; }
    m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(l);
    if (m) {
      const ordered = /\d/.test(m[2]); const items = [];
      while (i < lines.length) {
        const mm = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (mm) { items.push(mm[3]); i++; }
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; }
        else break;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items }); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i]) && !(lines[i].includes('|') && lines[i + 1] && isTableSep(lines[i + 1]))) { buf.push(lines[i].trim()); i++; }
    blocks.push({ type: 'p', text: buf.join(' ') });
  }
  return blocks;
}

/** Titres de niveau 2 (pour le sommaire). */
export const outline = (blocks) => blocks.filter((b) => b.type === 'h' && b.level === 2).map((b) => ({ id: slugify(b.text), text: b.text }));

const CELL = { border: '1px solid var(--line, #d9dde6)', padding: '8px 10px', textAlign: 'left', verticalAlign: 'top', fontSize: 15 };

export function Markdown({ blocks }) {
  return blocks.map((b, k) => {
    switch (b.type) {
      case 'h': { const H = 'h' + Math.min(6, b.level); return <H key={k} id={slugify(b.text)}>{inline(b.text, 'h' + k)}</H>; }
      case 'p': return <p key={k}>{inline(b.text, 'p' + k)}</p>;
      case 'ul': return <ul key={k}>{b.items.map((x, j) => <li key={j}>{inline(x, `u${k}_${j}`)}</li>)}</ul>;
      case 'ol': return <ol key={k} style={{ paddingLeft: 22, display: 'grid', gap: 8, margin: '8px 0' }}>{b.items.map((x, j) => <li key={j}>{inline(x, `o${k}_${j}`)}</li>)}</ol>;
      case 'quote': return <blockquote key={k} style={{ borderLeft: '4px solid var(--line, #d9dde6)', margin: '12px 0', padding: '4px 14px' }}><p>{inline(b.text, 'q' + k)}</p></blockquote>;
      case 'hr': return <hr key={k} />;
      case 'table': return (
        <div key={k} style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
            <thead><tr>{b.head.map((c, j) => <th key={j} style={{ ...CELL, background: 'var(--surface, #f4f5f9)' }}>{inline(c, `th${k}_${j}`)}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, x) => <td key={x} style={CELL}>{inline(c, `td${k}_${j}_${x}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      default: return null;
    }
  });
}
