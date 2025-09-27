import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Employees API',
      version: '1.0.0',
      description: 'CRUD para la base de datos employees (MySQL) con Node.js/Express'
    },
    servers: [
      {
        url: process.env.SWAGGER_SERVER_URL || 'http://localhost:3000',
        description: 'Local'
      }
    ]
  },
  // Toma las anotaciones JSDoc de las rutas
  apis: [resolve(__dirname, '../routes/*.js')]
};

export const swaggerSpec = swaggerJSDoc(options);
