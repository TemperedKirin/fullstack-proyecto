import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';                             

import employeesRouter from './routes/employees.routes.js';
import departmentsRouter from './routes/departments.routes.js';
import titlesRouter from './routes/titles.routes.js';
import weatherRouter from './routes/weather.routes.js';
import { swaggerSpec } from './swagger/swagger.js';
import swaggerUi from 'swagger-ui-express';
import { ping } from './db.js';

dotenv.config();
dns.setDefaultResultOrder?.('ipv4first');          // ← NUEVO

const app = express();
app.use(cors());
app.use(express.json());

// __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas API
app.use('/api/employees', employeesRouter);
app.use('/api/titles', titlesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/weather', weatherRouter);

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Healthcheck
app.get('/health', async (_req, res) => {
  try {
    const ok = await ping();
    res.json({ status: 'ok', db: ok ? 'up' : 'down' });
  } catch {
    res.status(500).json({ status: 'error' });
  }
});

// 404 para rutas API no encontradas (opcional)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  console.log(`Swagger UI disponible en      http://localhost:${PORT}/docs`);
});
