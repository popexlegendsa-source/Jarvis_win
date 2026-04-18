import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { glob } from 'glob';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // --- API ЭНДПОИНТ ДЛЯ ПРЯМОЙ СИНХРОНИЗАЦИИ (OTA) ---
  app.get('/api/sync/bundle', async (req, res) => {
    try {
      console.log("[SYNC] Generating update bundle...");
      const zip = new AdmZip();
      
      // Список файлов для включения (только код, без мусора и секретов)
      const patterns = [
        'src/**/*',
        'package.json',
        'run_local.bat',
        'agent_runner.py',
        'release.bat',
        'CHANGELOG.md',
        'index.html',
        'vite.config.ts',
        'tsconfig.json'
      ];

      const files = await glob(patterns, { 
        nodir: true, 
        ignore: ['node_modules/**', 'dist/**', '.git/**'] 
      });

      for (const file of files) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          const zipPath = path.dirname(file);
          zip.addLocalFile(filePath, zipPath === '.' ? '' : zipPath);
        }
      }

      const buffer = zip.toBuffer();
      
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=jarvis-update.zip',
        'Content-Length': buffer.length
      });
      
      res.send(buffer);
      console.log("[SYNC] Bundle sent successfully.");
    } catch (error) {
      console.error("[SYNC] Error creating bundle:", error);
      res.status(500).json({ error: "Failed to generate update bundle" });
    }
  });

  // Остальные API маршруты
  app.get('/api/status', (req, res) => {
    res.json({ status: 'online', version: '2.8.0', identity: 'JARVIS' });
  });

  // Настройка Vite middleware
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS Sync Server running at http://localhost:${PORT}`);
  });
}

startServer();
