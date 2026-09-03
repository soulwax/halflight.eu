// PM2 process definition for the self-hosted build.
//
//   pnpm build:node                     # ADAPTER=node vite build  ->  ./build
//   pm2 start ecosystem.config.cjs      # or: pnpm pm2:start
//
// The adapter-node server in ./build reads PORT, ORIGIN and every secret straight
// from process.env. It does not load .env itself, so Node's --env-file does it
// here. PORT is set in .env (4555); change it there, not in this file.

module.exports = {
	apps: [
		{
			name: 'syn',
			cwd: __dirname,
			script: 'build/index.js',
			node_args: '--env-file=.env',
			exec_mode: 'fork',
			instances: 1,
			env: {
				NODE_ENV: 'production'
			},
			autorestart: true,
			watch: false,
			max_memory_restart: '512M',
			kill_timeout: 10000,
			time: true
		}
	]
};
