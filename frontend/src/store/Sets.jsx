import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB, listings } from '../data/db.js';
import { Seg, Empty } from '../components/ui.jsx';
import { LANG_SHORT } from '../lib/util.js';

export default function Sets() {
  const s = useDB();
  const all = useMemo(() => listings(s).filter((l) => l.type !== 'guard' && l.available > 0), [s]);
  const langs = ['All', ...new Set(all.map((l) => l.language))];
  const [lang, setLang] = useState('All');
  const sets = useMemo(() => {
    const m = new Map();
    for (const l of all) {
      if (lang !== 'All' && l.language !== lang) continue;
      const k = l.set;
      const e = m.get(k) || { set: k, code: l.setCode, year: l.releaseYear, count: 0, langs: new Set() };
      e.count += 1; e.langs.add(l.language); e.year = e.year || l.releaseYear;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => (b.year || 0) - (a.year || 0) || a.set.localeCompare(b.set));
  }, [all, lang]);
  return (
    <div className="wrap" style={{ paddingBottom: 120 }}>
      <div className="cat-head">
        <span className="jp">セット</span>
        <h1>Shop by set</h1>
        <Seg value={lang} onChange={setLang} options={langs.map((x) => ({ value: x, label: x === 'All' ? 'All' : LANG_SHORT[x] || x }))} />
      </div>
      {sets.length === 0 ? <Empty title="No sets yet">Stock in this language will appear here.</Empty> : (
        <div className="set-list" style={{ marginTop: 16 }}>
          {sets.map((x) => (
            <Link key={x.set} className="set-row" to={`/shop?set=${encodeURIComponent(x.set)}`}>
              <div className="code">{(x.code || '').toUpperCase().slice(0, 7) || '·'}</div>
              <div className="grow">
                <div className="nm">{x.set}</div>
                <div className="eyebrow muted" style={{ marginTop: 4 }}>{[x.year, `${x.count} item${x.count === 1 ? '' : 's'}`, [...x.langs].map((l) => LANG_SHORT[l] || l).join(' / ')].filter(Boolean).join(' · ')}</div>
              </div>
              <span className="muted">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
