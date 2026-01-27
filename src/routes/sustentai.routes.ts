import { Router } from "express";
import { SustentAiController } from "../controllers/SustentAiController";
import { adminAuthMiddleware } from "../middlewares/adminAuth.middleware";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "temp-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const router = Router();

router.get("/", SustentAiController.getAll);

// Rota POST (Criar)
router.post(
  "/",
  adminAuthMiddleware,
  upload.single("imagem"),
  SustentAiController.create,
);

router.post("/click-nav", SustentAiController.registerNavClick);
router.post("/click-card/:id", SustentAiController.registerCardClick);

// Rota PUT (Editar) - Adicionada
router.put(
  "/:id",
  adminAuthMiddleware,
  upload.single("imagem"),
  SustentAiController.update,
);

router.delete(
  "/:titulo",
  adminAuthMiddleware,
  SustentAiController.deleteByTitle,
);

export default router;
