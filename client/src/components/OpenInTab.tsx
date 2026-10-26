// The desktop app's Open Folder… and Open file by path… at the top of each editor's File menu. Both open in a
// new tab, leaving the file being edited where it is: a folder or file inside the open folder is a new tab of this
// folder (window.open, which the app makes a tab), one outside it a new tab on its own folder (desktop/main.js).
// After them, Open in Finder shows the file being edited in the system's file browser.
import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { fileAt, fileBrowserName } from '../desktopBridge.ts';
import type { MenuItem } from './Menu.tsx';
import { PromptModal } from './Modal.tsx';

/** The File menu's first items (none outside the desktop app), and the dialog Open file by path… asks in. */
export function useOpenInTab(): { items: MenuItem[]; dialog: ReactNode } {
  const local = !!useAuth().local;
  const [asking, setAsking] = useState(false);
  const shown = fileAt(useLocation().pathname);
  if (!local) return { items: [], dialog: null };
  return {
    items: [
      { label: 'Open Folder…', action: () => void api.chooseLocalFolder(true) },
      { label: 'Open file by path…', action: () => setAsking(true) },
      ...(shown ? [{ label: `Open in ${fileBrowserName()}`, action: () => void api.revealLocal(shown).catch(() => {}) }] : []),
      'sep',
    ],
    dialog: asking && (
      <PromptModal
        title="Open file by path"
        label="File or folder"
        initial=""
        placeholder="~/Documents/report.docx"
        maxLength={4096}
        confirmText="Open"
        onConfirm={async (p) => {
          const res = await api.openLocalPath(p, true);
          if (res.file !== undefined) window.open(`/open?file=${encodeURIComponent(res.file)}`, '_blank');
          else if (res.folder !== undefined) window.open(res.folder ? `/?folder=${encodeURIComponent(res.folder)}` : '/', '_blank');
        }}
        onClose={() => setAsking(false)}
      />
    ),
  };
}
