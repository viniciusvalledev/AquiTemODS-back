import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import ProjetoController from "../controllers/ProjetoController";
import { compressImages } from "../middlewares/compression.middleware";

const UPLOADS_DIR = path.resolve("uploads");

// Garante que a pasta de uploads exista
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite de 10 MB
  },
});

const router = Router();

router.get("/", ProjetoController.listarTodos);
router.get("/buscar", ProjetoController.buscarPorNome);
router.get("/:id", ProjetoController.buscarPorId);

router.post(
  "/",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "imagens", maxCount: 5 }, // Alterado de 'produtos' para 'imagens'
  ]),
  compressImages,
  ProjetoController.cadastrar
);

router.put(
  "/:id/solicitar-atualizacao", // Rota agora espera o ID do projeto
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "imagens", maxCount: 5 }, // Alterado de 'produtos' para 'imagens'
  ]),
  compressImages,
  ProjetoController.solicitarAtualizacao
);

router.post("/:id/solicitar-exclusao", ProjetoController.solicitarExclusao);
router.post("/:id/status", ProjetoController.alterarStatus);

export default router;