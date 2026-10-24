// Folders in the file library. A folder is named by its path from the top of the library, parts joined
// with "/" ("reports/2026"); the top itself is the empty string.

export const MAX_FOLDER_DEPTH = 12;
const MAX_NAME_CHARS = 100;

/** A folder name as typed, tidied; null if it cannot be one (empty, "." or "..", or with a character file systems refuse). A hidden one (".config") can. */
export function cleanFolderName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.trim().replace(/[. ]+$/, '');
  if (!name || name.length > MAX_NAME_CHARS) return null;
  if (/[\u0000-\u001f\\/<>:"|?*]/.test(name)) return null;
  return name;
}

/** A folder path as sent by a client, normalized; null if it is not a valid one. "" is the top. */
export function cleanFolderPath(input: unknown): string | null {
  if (input === undefined || input === null || input === '') return '';
  if (typeof input !== 'string') return null;
  const parts = input.split('/').filter((p) => p !== '');
  if (parts.length > MAX_FOLDER_DEPTH) return null;
  const clean: string[] = [];
  for (const p of parts) {
    const name = cleanFolderName(p);
    if (name === null || name !== p) return null;
    clean.push(name);
  }
  return clean.join('/');
}

export const joinFolder = (parent: string, name: string): string => (parent ? `${parent}/${name}` : name);
export const folderName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
export const parentFolder = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/** The folders from the top down to this one, for breadcrumbs. */
export function folderTrail(path: string): { name: string; path: string }[] {
  const out: { name: string; path: string }[] = [];
  let at = '';
  for (const name of path ? path.split('/') : []) {
    at = joinFolder(at, name);
    out.push({ name, path: at });
  }
  return out;
}
