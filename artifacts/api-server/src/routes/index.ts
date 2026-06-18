import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationRouter from "./organization";
import usersRouter from "./users";
import rolesRouter from "./roles";
import operationsRouter from "./operations";
import groupsRouter from "./groups";
import showBookRouter from "./show-book";
import agendaRouter from "./agenda";
import scalesRouter from "./scales";
import dailyBookRouter from "./daily-book";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(organizationRouter);
router.use(usersRouter);
router.use(rolesRouter);
router.use(operationsRouter);
router.use(groupsRouter);
router.use(showBookRouter);
router.use(agendaRouter);
router.use(scalesRouter);
router.use(dailyBookRouter);

export default router;
