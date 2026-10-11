import { Router, type IRouter } from "express";
import healthRouter from "./health";
import installersRouter from "./installers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(installersRouter);

export default router;
