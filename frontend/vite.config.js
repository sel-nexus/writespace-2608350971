/** Configure the static app's React transform and environment-driven server. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !env.HOST) {
    throw new Error('Set PORT (1-65535) and HOST in .env using .env.example.');
  }
  return {
    plugins: [react()],
    server: { host: env.HOST, port, strictPort: true },
    preview: { host: env.HOST, port, strictPort: true },
  };
});
