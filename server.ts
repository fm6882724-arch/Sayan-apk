import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './server/config.ts';
import { getAppSecretBuffer } from './server/db.ts';
import { createApiRouter } from './server/routes.ts';

async function startServer(): Promise<void> {
  // Initialize secret & SQLite database on boot
  getAppSecretBuffer();

  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      frameguard: false,
      contentSecurityPolicy: config.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  app.use('/api', createApiRouter());

  if (!config.isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `SAYAN MODE server running on http://0.0.0.0:${config.port} (mode=${config.nodeEnv}, version=v${config.currentAppVersion})`,
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start SAYAN MODE server:', err);
  process.exit(1);
});
