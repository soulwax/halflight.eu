// PM2 process definition for the self-hosted build.
//
//   pnpm build:node                     # ADAPTER=node vite build  ->  ./build
//   pm2 start ecosystem.config.cjs      # or: pnpm pm2:start
//
// The adapter-node server in ./build reads PORT, ORIGIN and every secret straight
// from process.env. It does not load .env itself, so Node's --env-file does it
// here. PORT is set in .env (4555); change it there, not in this file.

const os = require('node:os');
const path = require('node:path');

// PM2's own daemon is long-lived, but a plain `'node'` interpreter resolves
// through whatever PATH was active in the shell that last spawned the daemon.
// `fnm` puts node on PATH via a per-session symlink dir
// (`fnm_multishells/<pid>_<ts>`) that gets torn down when that shell exits —
// so the daemon silently starts failing every spawn with `spawn node ENOENT`
// (status still reports "online", but pid is never assigned and no port
// binds) the next time it tries to (re)start this app after that session is
// gone. `fnm`'s `aliases/default` symlink is stable across sessions and
// reboots, so pointing directly at it survives daemon restarts regardless of
// which shell launched them.
const fnmDefaultNode = path.join(os.homedir(), '.local/share/fnm/aliases/default/bin/node');

module.exports = {
	apps: [
		{
			name: 'syn',
			cwd: __dirname,
			script: 'build/index.js',
			interpreter: fnmDefaultNode,
			node_args: '--env-file=.env',
			exec_mode: 'fork',
			instances: 1,
			env: {
				NODE_ENV: 'production'
			},
			autorestart: true,
			watch: false,
			max_memory_restart: '2048M',
			kill_timeout: 10000,
			time: true
		}
	]
};
