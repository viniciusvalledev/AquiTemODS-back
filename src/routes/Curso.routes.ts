import { Router } from "express";
import { CursoController } from "../controllers/CursoController";
import { adminAuthMiddleware } from "../middlewares/adminAuth.middleware";
import multer from "multer";
import path from "path";

// --- Configuração do Multer (Uploads) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "temp-curso-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// Filtro para aceitar apenas imagens
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = [
    "image/jpeg",
    "image/pjpeg",
    "image/png",
    "image/webp",
    "image/jpg"
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Formato inválido. Apenas imagens são permitidas."));
  }
};

const upload = multer({ 
  storage: storage, 
  fileFilter: fileFilter 
});

const router = Router();

// --- ROTAS PÚBLICAS ---

// Listar cursos (aceita ?status=ativo|inativo)
router.get("/", CursoController.getAll);

// Registrar clique (contabilizar visualização)
router.patch("/:id/click", CursoController.registrarClique);


// --- ROTAS ADMINISTRATIVAS (Protegidas) ---

// Criar novo curso (com upload de imagem)
router.post(
  "/",
  adminAuthMiddleware,
  upload.single("imagem"),
  CursoController.create
);

// Editar curso existente (com upload opcional)
router.put(
  "/:id",
  adminAuthMiddleware,
  upload.single("imagem"),
  CursoController.update
);

// Arquivar curso (Soft Delete - torna inativo)
router.delete(
  "/:id",
  adminAuthMiddleware,
  CursoController.delete
);

// Reativar curso arquivado
router.patch(
  "/:id/restore",
  adminAuthMiddleware,
  CursoController.reactivate
);
router.delete("/:id/force", 
  adminAuthMiddleware, 
  CursoController.forceDelete
);

export default router;