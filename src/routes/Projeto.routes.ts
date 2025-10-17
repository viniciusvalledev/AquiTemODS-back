import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import ProjetoController from "../controllers/ProjetoController";
import { compressImages } from "../middlewares/compression.middleware";

// Define o caminho para a pasta de uploads de forma segura
const UPLOADS_DIR = path.resolve("uploads");

// Garante que a pasta de uploads exista ao iniciar a aplicação
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  // Define o destino para ser SEMPRE a pasta 'uploads' raiz
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  // Mantém a lógica para gerar um nome de arquivo único
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
    fileSize: 10 * 1024 * 1024, // Limite de 10 MB para cada arquivo
  },
});

const router = Router();

router.get("/", ProjetoController.listarTodos);
router.get("/buscar", ProjetoController.buscarPorNomeUnico);
router.get("/categoria/:ods", ProjetoController.buscarPorOds);
router.get("/nome/:nome", ProjetoController.buscarPorNomeUnico);
router.get("/:id", ProjetoController.buscarPorId);

router.post(
  "/",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "imagens", maxCount: 5 },
  ]),
  compressImages,
  ProjetoController.cadastrar
);

router.put(
  "/solicitar-atualizacao/:id",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "imagens", maxCount: 5 },
  ]),
  compressImages,
  ProjetoController.solicitarAtualizacao
);

// ROTA ATUALIZADA
router.post("/solicitar-exclusao/:id", ProjetoController.solicitarExclusao);
router.post("/:id/status", ProjetoController.alterarStatus);

export default router;
