import { Router } from "express";
import { AdminController } from "../controllers/AdminController";
import { adminAuthMiddleware } from "../middlewares/adminAuth.middleware";

const router = Router();

router.post("/login", AdminController.login);

router.get("/pending", adminAuthMiddleware, AdminController.getPending);
router.post("/approve/:id", adminAuthMiddleware, AdminController.approveRequest);
router.post("/reject/:id", adminAuthMiddleware, AdminController.rejectRequest);

export default router;
