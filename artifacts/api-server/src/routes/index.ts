import { Router, type IRouter } from "express";
import healthRouter from "./health";
import securitiesRouter from "./securities";

const router: IRouter = Router();

router.use(healthRouter);
router.use(securitiesRouter);

export default router;
