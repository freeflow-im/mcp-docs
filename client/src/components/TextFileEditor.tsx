// A stored file that is plain text (StoredFile.text: UTF-8, which ASCII is, found by looking at its bytes),
// edited as text whatever its name: a log, a config file, source code, a file with no extension. Saved with
// the Save button or Cmd/Ctrl+S, over the file (the server keeps the version before for one undo), with the
// line endings and byte order mark it had.
// In the desktop app, Tail follows a file that grows, a log say: it asks for the bytes past those it has
// every second, adds them and keeps the end in view (unless the person scrolled up); a file that shrank, or was
// replaced, is read again from the start. The text is read-only meanwhile.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StoredFile } from '../../../shared/types.ts';
import { api } from '../api.ts';

const BOM = '﻿';
const TAIL_EVERY_MS = 1000;

/** The text of a file's bytes, without its byte order mark, in \n lines; and how it was written. */
function readText(bytes: ArrayBuffer) {
  const raw = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
  const bom = raw.startsWith(BOM);
  const body = bom ? raw.slice(1) : raw;
  return { text: body.replace(/\r\n/g, '\n'), crlf: /\r\n/.test(body), bom };
}

export function TextFileEditor({ file, onSaved, canTail = false }: { file: StoredFile; onSaved(file: StoredFile): void; canTail?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  // How the file was written, so a save keeps it: Windows line ends, a byte order mark.
  const form = useRef({ crlf: false, bom: false });
  const dirty = text !== null && text !== saved;
  const [tail, setTail] = useState(false);
  // The bytes read so far, where the next ones start.
  const bytesRead = useRef(0);
  const area = useRef<HTMLTextAreaElement>(null);
  // Whether the end is in view, so new lines keep it there.
  const atEnd = useRef(true);

  useEffect(() => {
    let gone = false;
    fetch(file.url, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not read the file (${res.status})`);
        const bytes = await res.arrayBuffer();
        if (gone) return;
        // The text area works in \n; the file's own line ends come back when it is saved.
        const { text: lf, crlf, bom } = readText(bytes);
        form.current = { crlf, bom };
        bytesRead.current = bytes.byteLength;
        setText(lf);
        setSaved(lf);
      })
      .catch((e: unknown) => !gone && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      gone = true;
    };
  }, [file.url]);

  useEffect(() => {
    if (!tail) return;
    let gone = false;
    let timer: ReturnType<typeof setTimeout>;
    // A line end or a character may be split between two reads: the bytes after the last whole line wait.
    let rest = new Uint8Array(0);
    // A file that shrank is read whole again.
    let whole = false;
    const show = (next: (text: string) => string) => {
      const el = area.current;
      atEnd.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      setText((t) => next(t ?? ''));
      setSaved((t) => next(t));
    };
    const poll = async () => {
      try {
        const res = await fetch(file.url, { credentials: 'same-origin', cache: 'no-store', headers: whole ? {} : { Range: `bytes=${bytesRead.current}-` } });
        if (gone) return;
        if (res.status === 206) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (gone) return;
          bytesRead.current += bytes.byteLength;
          const all = new Uint8Array(rest.length + bytes.length);
          all.set(rest);
          all.set(bytes, rest.length);
          const cut = all.lastIndexOf(10) + 1;
          rest = all.slice(cut);
          if (cut) {
            const added = new TextDecoder().decode(all.subarray(0, cut)).replace(/\r\n/g, '\n');
            show((t) => t + added);
          }
        } else if (res.status === 416) {
          // Nothing new, or the file is shorter than what was read: it was cut or replaced, so read it all again.
          const size = Number(/\/(\d+)/.exec(res.headers.get('Content-Range') ?? '')?.[1] ?? NaN);
          whole = size < bytesRead.current;
        } else if (res.ok) {
          // The whole file (a server that ignores ranges, or one read again from the start).
          const bytes = await res.arrayBuffer();
          if (gone) return;
          bytesRead.current = bytes.byteLength;
          rest = new Uint8Array(0);
          whole = false;
          const { text: all } = readText(bytes);
          show(() => all);
        } else throw new Error(`Could not read the file (${res.status})`);
        setError(null);
      } catch (e) {
        if (!gone) setError(e instanceof Error ? e.message : String(e));
      }
      if (!gone) timer = setTimeout(() => void poll(), TAIL_EVERY_MS);
    };
    atEnd.current = true;
    void poll();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [tail, file.url]);

  // Keep the end in view as lines come in, and when Tail starts.
  useLayoutEffect(() => {
    const el = area.current;
    if (tail && el && atEnd.current) el.scrollTop = el.scrollHeight;
  }, [tail, text]);

  const save = async () => {
    if (text === null || !dirty || state === 'saving') return;
    setState('saving');
    setError(null);
    try {
      const body = (form.current.bom ? BOM : '') + (form.current.crlf ? text.replace(/\n/g, '\r\n') : text);
      const updated = await api.updateFile(file.id, body);
      setSaved(text);
      setState('saved');
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('idle');
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return (
    <div className="text-file">
      <div className="text-file-bar">
        <span className="save-status">{state === 'saving' ? 'Saving…' : dirty ? 'Unsaved changes' : state === 'saved' ? 'Saved' : 'Plain text'}</span>
        {canTail && (
          <label className="text-file-tail" title={dirty ? 'Save your changes first' : undefined}>
            <input type="checkbox" checked={tail} disabled={dirty || text === null} onChange={(e) => setTail(e.target.checked)} />
            Tail
          </label>
        )}
        <button className="btn primary" disabled={!dirty || tail || state === 'saving'} onClick={() => void save()} title="Save (⌘S)">
          Save
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {text === null ? (
        !error && <div className="muted text-file-wait">Loading…</div>
      ) : (
        <textarea
          ref={area}
          className="md-editor text-file-editor"
          value={text}
          readOnly={tail}
          onChange={(e) => (setText(e.target.value), state === 'saved' && setState('idle'))}
          spellCheck={false}
          autoFocus
          aria-label={file.filename}
          onKeyDown={(e) => {
            // Tab types a tab, as in any text editor.
            if (e.key !== 'Tab' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: a, selectionEnd: b } = el;
            const next = `${el.value.slice(0, a)}\t${el.value.slice(b)}`;
            setText(next);
            requestAnimationFrame(() => el.setSelectionRange(a + 1, a + 1));
          }}
        />
      )}
    </div>
  );
}
