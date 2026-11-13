// Find the firmware library's own ELF for a crash. Library firmware is built with
// its ELF's SHA-256 embedded, and a crash prints the start of it ("ELF file
// SHA256: 1a2b3c4d5"). The firmware library publishes each ELF, gzipped, as
// elf/<first 32 hex digits>.gz with an index, so a pasted crash from a library
// project decodes without the user having any .elf.

export interface LibraryElf {
  /** First 32 hex digits of the ELF's SHA-256: its file name */
  sha: string;
  project: string;
  board: string;
  builtAt: string;
  core: string;
}

const LINE = /ELF file SHA256:\s*([0-9a-f]{8,64})/i;

/** The ELF hash a crash log printed, lower case, or null. */
export function elfShaIn(log: string): string | null {
  return LINE.exec(log)?.[1].toLowerCase() ?? null;
}

/** The index entry whose hash starts with the printed one. Pure, for tests. */
export function matchElf(entries: Record<string, Omit<LibraryElf, "sha">>, printed: string): LibraryElf | null {
  const want = printed.toLowerCase().slice(0, 32);
  const hits = Object.keys(entries).filter((sha) => sha.startsWith(want));
  // A short printed hash (9 digits by default) could in theory match two builds; refuse to guess.
  if (hits.length !== 1) return null;
  return { sha: hits[0], ...entries[hits[0]] };
}

/** Look a printed hash up in the published ELF index. Null when it is not a library build or the index is unreachable. */
export async function findLibraryElf(fwBase: string, printed: string): Promise<LibraryElf | null> {
  try {
    const res = await fetch(`${fwBase}/elf/index.json`);
    if (!res.ok) return null;
    const { entries } = (await res.json()) as { entries?: Record<string, Omit<LibraryElf, "sha">> };
    return entries ? matchElf(entries, printed) : null;
  } catch {
    return null;
  }
}

/** Download and unzip a library ELF. */
export async function fetchLibraryElf(fwBase: string, sha: string): Promise<Uint8Array> {
  const res = await fetch(`${fwBase}/elf/${sha}.gz`);
  if (!res.ok || !res.body) throw new Error(`The firmware's ELF could not be downloaded (${res.status}).`);
  const unzipped = res.body.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(unzipped).arrayBuffer());
}
