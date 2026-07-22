/* eslint-disable @typescript-eslint/no-explicit-any */
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ITOps Agent Platform API',
      version: '1.0.0',
      description: 'ITOps Agent 运维平台 API 文档',
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    './src/modules/*/routes.ts',
    './src/modules/*/routes/*.ts',
    // 旧版聚合路由（dc 仍保留在 src/routes/dc/，未迁入 modules/dc/routes/）
    './src/routes/*.ts',
    './src/routes/**/*.ts',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: any): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
  }));
  // Also serve the raw JSON
  app.get('/api-docs.json', (_req: any, res: any) => {
    res.json(swaggerSpec);
  });
}