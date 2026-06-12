import { Router, type IRouter } from "express";
import healthRouter from "./health";
import securitiesRouter from "./securities";
import verdictsRouter from "./verdicts";
import newsRouter from "./news";

const router: IRouter = Router();

router.use(healthRouter);
router.use(securitiesRouter);
router.use(verdictsRouter);
router.use(newsRouter);

export default router;
