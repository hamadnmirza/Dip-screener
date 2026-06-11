import { Router, type IRouter } from "express";
import healthRouter from "./health";
import securitiesRouter from "./securities";
import verdictsRouter from "./verdicts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(securitiesRouter);
router.use(verdictsRouter);

export default router;
