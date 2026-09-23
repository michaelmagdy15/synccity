// @ts-ignore
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { listen, type Server } from 'colyseus';
import { ROOM_NAME } from '@synccity/shared/protocol';
import { CityRoom } from './rooms/CityRoom.js';

const port = Number(process.env.PORT) || 2567;

async function main() {
  const gameServer = await listen(
    {
      initializeGameServer: (server: Server) => {
        server.define(ROOM_NAME, CityRoom as any);
      },
      initializeExpress: (app: any) => {
        app.get('/health', (_req: any, res: any) => {
          res.json({
            status: 'ok',
            time: Date.now(),
            service: 'synccity-server',
            port,
          });
        });

        // Serve built web client assets when present
        const candidates = [
          path.resolve(process.cwd(), 'dist'),
          path.resolve(process.cwd(), '../../dist'),
        ];
        const distDir = candidates.find((p) => fs.existsSync(p));
        if (distDir) {
          console.log(`[SyncCity Server] Serving web assets from ${distDir}`);
          app.use(express.static(distDir));
          app.get('*', (req: any, res: any, next: any) => {
            if (req.path.startsWith('/matchmake') || req.path.startsWith('/health')) {
              return next();
            }
            res.sendFile(path.join(distDir, 'index.html'));
          });
        }
      },
    } as any,
    port
  );

  console.log(`[SyncCity Server] Initialized on port ${port}`);

  const shutdown = async () => {
    console.log('[SyncCity Server] Graceful shutdown initiated...');
    try {
      await gameServer.gracefullyShutdown();
    } catch (err) {
      console.error('[SyncCity Server] Error during shutdown:', err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[SyncCity Server] Startup error:', err);
  process.exit(1);
});
