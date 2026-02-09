import { Router } from "express";
import { CursoController } from "../controllers/CursoController";
import { adminAuthMiddleware } from "../middlewares/adminAuth.middleware";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Pasta temporária antes do controller mover
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "temp-curso-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const router = Router();

router.get("/", CursoController.getAll);

router.post(
  "/",
  adminAuthMiddleware,
  upload.single("imagem"),
  CursoController.create
);

router.put(
  "/:id",
  adminAuthMiddleware,
  upload.single("imagem"),
  CursoController.update
);

router.delete(
  "/:id",
  adminAuthMiddleware,
  CursoController.delete
);

export default router;