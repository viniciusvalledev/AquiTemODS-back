import { Request, Response } from "express";
import Curso from "../entities/Curso.entity";
import fs from "fs";
import path from "path";

const toSlug = (str: string) => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export class CursoController {
  // --- LISTAR ---
  static async getAll(req: Request, res: Response) {
    try {
      const cursos = await Curso.findAll({ order: [["createdAt", "DESC"]] });
      return res.status(200).json(cursos);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao buscar cursos." });
    }
  }

  // --- CRIAR ---
  static async create(req: Request, res: Response) {
    try {
      const { titulo, linkDestino } = req.body;

      if (!req.file)
        return res.status(400).json({ message: "Imagem é obrigatória." });
      if (!titulo || !linkDestino)
        return res
          .status(400)
          .json({ message: "Título e Link são obrigatórios." });

      const slug = toSlug(titulo);
      // Salva em uploads/cursos/nome-do-curso
      const baseDir = path.resolve(process.cwd(), "uploads", "cursos", slug);

      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }

      const oldPath = req.file.path;
      const newFilename = `${Date.now()}-${req.file.originalname}`;
      const newPath = path.join(baseDir, newFilename);

      fs.renameSync(oldPath, newPath);

      const dbImageUrl = `/uploads/cursos/${slug}/${newFilename}`;

      const novoCurso = await Curso.create({
        titulo,
        linkDestino,
        imagemUrl: dbImageUrl,
      });

      return res.status(201).json(novoCurso);
    } catch (error: any) {
      console.error(error);
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);

      if (error.name === "SequelizeUniqueConstraintError") {
        return res
          .status(400)
          .json({ message: "Já existe um curso com este título." });
      }
      return res.status(500).json({ message: "Erro ao criar curso." });
    }
  }

  // --- EDITAR ---
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { titulo, linkDestino } = req.body;
      const curso = await Curso.findByPk(id);

      if (!curso)
        return res.status(404).json({ message: "Curso não encontrado." });

      let currentSlug = toSlug(curso.titulo);
      let newSlug = titulo ? toSlug(titulo) : currentSlug;
      let finalImageUrl = curso.imagemUrl;

      // Se mudou o título, renomeia a pasta
      if (titulo && titulo !== curso.titulo) {
        const oldDir = path.resolve(
          process.cwd(),
          "uploads",
          "cursos",
          currentSlug
        );
        const newDir = path.resolve(
          process.cwd(),
          "uploads",
          "cursos",
          newSlug
        );

        if (fs.existsSync(oldDir)) {
          if (!fs.existsSync(newDir)) {
            fs.renameSync(oldDir, newDir);
          }
        }

        finalImageUrl = finalImageUrl.replace(
          `/cursos/${currentSlug}/`,
          `/cursos/${newSlug}/`
        );
        currentSlug = newSlug;
      }

      // Se enviou nova imagem
      if (req.file) {
        const targetDir = path.resolve(
          process.cwd(),
          "uploads",
          "cursos",
          currentSlug
        );

        if (!fs.existsSync(targetDir))
          fs.mkdirSync(targetDir, { recursive: true });

        const newFilename = `${Date.now()}-${req.file.originalname}`;
        const newPath = path.join(targetDir, newFilename);

        // Deleta imagem antiga
        if (curso.imagemUrl) {
          const oldFile = path.resolve(
            process.cwd(),
            curso.imagemUrl.replace(/^\//, "")
          );
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        }

        fs.renameSync(req.file.path, newPath);
        finalImageUrl = `/uploads/cursos/${currentSlug}/${newFilename}`;
      }

      await curso.update({
        titulo: titulo || curso.titulo,
        linkDestino: linkDestino || curso.linkDestino,
        imagemUrl: finalImageUrl,
      });

      return res.status(200).json(curso);
    } catch (error: any) {
      console.error(error);
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
      return res.status(500).json({ message: "Erro ao atualizar curso." });
    }
  }

  // --- DELETAR ---
  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const curso = await Curso.findByPk(id);

      if (!curso)
        return res.status(404).json({ message: "Curso não encontrado." });

      // Deletar a pasta inteira do item
      const slug = toSlug(curso.titulo);
      const dirPath = path.resolve(process.cwd(), "uploads", "cursos", slug);

      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }

      await curso.destroy();
      return res.status(200).json({ message: "Curso removido com sucesso." });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erro ao remover curso." });
    }
  }
}