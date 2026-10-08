import { createServer } from 'vite';
import postgres from 'postgres';
import { writeFile } from 'node:fs/promises';
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const owners = await sql`select u.id, u.name from "user" u join administrator a on a.user_id = u.id join tidal_auth t on t.user_id = u.id where a.role = 'owner' and t.secret is not null`;
if (owners.length !== 1) { console.log(JSON.stringify({ error: 'Owner account is ambiguous', count: owners.length })); await sql.end(); process.exit(1); }
const owner = owners[0];
console.log(JSON.stringify({ phase: 'account', name: owner.name }));
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
 const { createDbTokenRowStore } = await server.ssrLoadModule('/src/lib/server/tidal/store.ts');
 const api = await server.ssrLoadModule('/src/lib/server/tidal/api.ts');
 const normalise = await server.ssrLoadModule('/src/lib/server/tidal/normalise.ts');
 const store = createDbTokenRowStore(owner.id);
 let calls = 0;
 const diagnosticFetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const response = await fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(25_000) });
  calls++;
  if (!response.ok || calls % 25 === 0) console.log(JSON.stringify({ phase: 'request', calls, host: url.host, path: url.pathname, status: response.status, retryAfter: response.headers.get('retry-after') }));
  return response;
 };
 const ctx = { store, fetch: diagnosticFetch };
 const collection = await api.getFullCollection('playlists', ctx);
 const matches = collection.items.map((item) => normalise.normalisePlaylist(collection.included.find((resource) => resource.id === item.id && resource.type === item.type) ?? item)).filter((playlist) => playlist?.title.toLowerCase() === 'family compilation');
 if (matches.length !== 1) { console.log(JSON.stringify({ phase: 'selection', count: matches.length })); process.exitCode = 1; }
 else {
  const playlist = matches[0];
  console.log(JSON.stringify({ phase: 'playlist', ...playlist }));
  const doc = await api.getFullPlaylist(playlist.id, { include: ['artists', 'albums'] }, ctx);
  await writeFile('/tmp/halflight-family-source.json', JSON.stringify({ userId: owner.id, playlistId: playlist.id, document: doc }), { mode: 0o600 });
  console.log(JSON.stringify({ phase: 'source', items: doc.data.relationships?.items?.data?.length, included: doc.included?.length, calls }));
  if (process.env.FAMILY_IMPORT_RUN === '1') {
   const { pullPlaylist } = await server.ssrLoadModule('/src/lib/server/playlists/sync.ts');
   const previous = await sql`select * from user_playlist where user_id = ${owner.id} and tidal_playlist_id = ${playlist.id}`;
   await writeFile('/tmp/halflight-family-before-import.json', JSON.stringify(previous), { mode: 0o600 });
   console.log(JSON.stringify({ phase: 'import-start', existingCopies: previous.length }));
   console.log(JSON.stringify({ phase: 'import-result', result: await pullPlaylist(playlist.id, { userId: owner.id, store, fetch: diagnosticFetch, cookies: {} }) }));
  }
 }
} catch (error) { console.log(JSON.stringify({ phase: 'failed', name: error?.name, status: error?.status, message: error?.status ? undefined : error?.message })); process.exitCode = 1; }
await server.close(); await sql.end(); process.exit(process.exitCode ?? 0);
