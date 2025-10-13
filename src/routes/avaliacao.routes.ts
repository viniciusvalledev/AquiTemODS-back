import { Router } from "express";
import AvaliacaoController from "../controllers/AvaliacaoController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Rota atualizada para '/projeto/:id'
router.get(
  "/projeto/:id",
  AvaliacaoController.listarPorProjeto
);

router.post("/", authMiddleware, AvaliacaoController.submeterAvaliacao);
router.put("/:id", authMiddleware, AvaliacaoController.atualizarAvaliacao);
router.delete("/:id", authMiddleware, AvaliacaoController.excluirAvaliacao);

export default router;