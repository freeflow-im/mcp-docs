// The desktop app's Scratch pad tile on the home page: a menu of the scratch pads in ~/.config/mcp-docs, last
// changed first, and New scratchpad, which makes one ("Scratch pad.md", then one named for the day) and opens it.
// A scratch pad outside the open folder moves the window to that folder, as Open file by path… does, with its
// breadcrumbs leading back to the folder shown here (listing.ts' returnTo).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.ts';

export function ScratchPadTile({ folder, onError }: { folder: string; onError(message: string): void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pads, setPads] = useState<{ name: string }[] | null>(null);

  useEffect(() => {
    if (!open) return;
    api.scratchPads().then(
      (r) => setPads(r.pads),
      () => setPads([]),
    );
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  const openPad = (name?: string) => {
    setOpen(false);
    api.openScratchPad(name, folder).then(
      (res) => res.file !== undefined && navigate(`/open?file=${encodeURIComponent(res.file)}`),
      (e: unknown) => onError(e instanceof Error ? e.message : String(e)),
    );
  };

  return (
    <div className="tile-box">
      <button
        className="new-sheet-tile help-tile scratch-tile"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="help-tile-title">Scratch pad</span>
        <span className="help-tile-sub">
          Jot something down <span aria-hidden="true">▾</span>
        </span>
      </button>
      {open && (
        <div className="dropdown tile-menu" role="menu">
          {pads?.map((p) => (
            <button key={p.name} role="menuitem" onClick={() => openPad(p.name)}>
              {p.name}
            </button>
          ))}
          {!!pads?.length && <div className="menu-sep" role="separator" />}
          <button role="menuitem" onClick={() => openPad()}>
            New scratchpad
          </button>
        </div>
      )}
    </div>
  );
}
