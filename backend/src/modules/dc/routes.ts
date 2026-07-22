import { Router } from 'express';
// 2026-07-21 P1-#15：legacy `src/routes/dc` 已迁回 `modules/dc/routes/`（ADR 见 ADR-024）
// 2026-07-21 P1-#15d：用 `./routes/index` 显式指向，避免 depcruise 把 `./routes` 解析为自引用
import dcInfrastructureRoutes from './routes/index';

const router = Router();

router.use('/dc', dcInfrastructureRoutes);
router.use('/dc-infrastructure', dcInfrastructureRoutes);

export default router;
