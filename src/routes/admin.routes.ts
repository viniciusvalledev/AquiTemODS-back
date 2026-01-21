import { Router } from "express";
import { AdminController } from "../controllers/AdminController";
import { adminAuthMiddleware } from "../middlewares/adminAuth.middleware";

const router = Router();

router.post("/login", AdminController.login);

router.get("/pending", adminAuthMiddleware, AdminController.getPending);

router.post(
  "/approve/:id",
  adminAuthMiddleware,
  AdminController.approveRequest
);

router.post(
  "/edit-and-approve/:id",
  adminAuthMiddleware,
  AdminController.editAndApproveRequest
);
router.post("/reject/:id", adminAuthMiddleware, AdminController.rejectRequest);

//VER TODOS NO ADM E PODER EDITAR
router.get(
  "/projetos-ativos",
  adminAuthMiddleware,
  AdminController.getAllActiveProjetos
);
router.patch(
  "/projeto/:id",
  adminAuthMiddleware,
  AdminController.adminUpdateProjeto
);
router.delete(
  "/projeto/:id",
  adminAuthMiddleware,
  AdminController.adminDeleteProjeto
);

router.get(
  "/avaliacoes/projeto/:projetoId",
  adminAuthMiddleware,
  AdminController.getAvaliacoesByProjeto
);

// Rota para admin excluir uma avaliação
router.delete(
  "/avaliacoes/:id",
  adminAuthMiddleware,
  AdminController.adminDeleteAvaliacao
);

router.get(
  "/exportar-projetos",
  adminAuthMiddleware,
  AdminController.exportActiveProjetos
);

router.get("/stats",  
  adminAuthMiddleware, 
  AdminController.getDashboardStats
);

router.get(
  "/prefeitura/:nome/projetos",
  adminAuthMiddleware,
  AdminController.getProjetosByPrefeitura
);

export default router;
