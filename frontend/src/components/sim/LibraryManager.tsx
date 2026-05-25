// @ts-nocheck
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Search, X, BookOpen, Plus, Trash2, Loader2 } from 'lucide-react';

export default function LibraryManager({ isOpen, onClose, libraries, setLibraries }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const librariesTxt = useMemo(() => libraries.join('\n') + (libraries.length > 0 ? '\n' : ''), [libraries]);

  // Search logic with debounce
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      try {
        // ??$$$ Use legacy backend port 5000 if needed, or 4001 for now
        const res = await fetch(`http://localhost:4001/libraries/search?q=${encodeURIComponent(search)}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error('Failed to search libraries:', err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [search]);

  if (!isOpen) return null;

  const addLibrary = (name) => {
    if (!libraries.includes(name)) {
      setLibraries(prev => [...prev, name]);
    }
  };

  const removeLibrary = (name) => {
    setLibraries(prev => prev.filter(lib => lib !== name));
  };

  const applyLibrariesTxt = (raw) => {
    const next = raw
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .filter(Boolean);
    // de-dupe, stable order
    const deduped = Array.from(new Set(next));
    setLibraries(deduped);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-20"
        onClick={onClose}
        style={{ background: 'transparent' }}
      />

      {/* Panel */}
      <div className="absolute top-16 left-80 z-30 w-80 rounded-2xl border border-neutral-800 bg-neutral-900/97 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[500px]"
           style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white tracking-tight">
            <BookOpen className="h-4 w-4 text-emerald-400" />
            Library Manager
          </div>
          <button onClick={onClose} className="flex items-center justify-center h-6 w-6 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Installed Libraries */}
        {libraries.length > 0 && (
          <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/50 shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-2">Installed</div>
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[120px] scrollbar-thin">
              {libraries.map(lib => (
                <div key={lib} className="flex items-center justify-between bg-neutral-800/60 border border-neutral-700/50 rounded-lg px-2.5 py-1.5">
                  <span className="text-xs font-medium text-neutral-200 truncate">{lib}</span>
                  <button onClick={() => removeLibrary(lib)} className="text-red-400/70 hover:text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* libraries.txt (source of truth) */}
        <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950/30 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold">libraries.txt</div>
            <div className="text-[10px] text-neutral-600">edit to sync Libraries</div>
          </div>
          <textarea
            value={librariesTxt}
            onChange={(e) => applyLibrariesTxt(e.target.value)}
            placeholder="One library per line"
            className="w-full h-24 resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2 bg-neutral-800/60 rounded-lg px-3 py-2 ring-1 ring-transparent focus-within:ring-emerald-500/40 transition-all">
            <Search className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
            <input
              type="text"
              placeholder="Search Arduino libraries..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-neutral-200 placeholder-neutral-500 outline-none"
            />
            {loading && <Loader2 className="h-3 w-3 text-neutral-500 animate-spin shrink-0" />}
          </div>
        </div>

        {/* Search Results */}
        <div className="overflow-y-auto flex-1 py-2 scrollbar-thin">
          {!search.trim() ? (
            <div className="px-4 py-8 text-center text-neutral-500 text-sm">
              Type to search the official Arduino library registry
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-neutral-500 text-sm">
              No matching libraries found
            </div>
          ) : (
            <div className="flex flex-col">
              {results.map((lib, idx) => {
                const isInstalled = libraries.includes(lib.name);
                return (
                  <button
                    key={lib.name + idx}
                    onClick={() => !isInstalled && addLibrary(lib.name)}
                    disabled={isInstalled}
                    className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-white/5 active:bg-white/10 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors truncate pr-2">
                          {lib.name}
                        </span>
                        {isInstalled ? (
                          <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold shrink-0">Installed</span>
                        ) : (
                          <div className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Plus className="h-3 w-3" /> Add
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                        {lib.sentence || 'No description available.'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

