import { Router } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import FileController from "../controllers/FileController";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    cb(null, `${uuidv4()}${extension}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite de 10 MB para cada arquivo
  },
});

router.post("/upload", upload.single("file"), FileController.uploadFile);

router.post(
  "/upload-multiple",
  upload.array("files"),
  FileController.uploadMultipleFiles
);

export default router;
