import { Request, Response } from "express";
import SustentAi from "../entities/SustentAi.entity";
import fs from "fs";
import path from "path";
import ContadorODS from "../entities/ContadorODS.entity";
import { Op } from "sequelize";
import sequelize from "../config/database";
import HistoricoCliqueSustentAi from "../entities/Historico/HistoricoCliqueSustentAi.entity";
import HistoricoAcessoMenu from "../entities/Historico/HistoricoAcessoMenu.entity";

const toSlug = (str: string) => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export class SustentAiController {
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
      const baseDir = path.resolve(
        process.cwd(),
        "uploads",
        "newsletter",
        slug,
      );

      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }

      const oldPath = req.file.path;
      const newFilename = `${Date.now()}-${req.file.originalname}`;
      const newPath = path.join(baseDir, newFilename);

      fs.renameSync(oldPath, newPath);

      const dbImageUrl = `/uploads/newsletter/${slug}/${newFilename}`;

      const novoCard = await SustentAi.create({
        titulo,
        linkDestino,
        imagemUrl: dbImageUrl,
      });

      return res.status(201).json(novoCard);
    } catch (error: any) {
      console.error(error);
      // Limpar arquivo se der erro
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);

      if (error.name === "SequelizeUniqueConstraintError") {
        return res
          .status(400)
          .json({ message: "Já existe uma box com este título." });
      }
      return res.status(500).json({ message: "Erro ao criar box." });
    }
  }

  // --- EDITAR (Novo) ---
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { titulo, linkDestino } = req.body;
      const card = await SustentAi.findByPk(id);

      if (!card)
        return res.status(404).json({ message: "Box não encontrada." });

      let currentSlug = toSlug(card.titulo);
      let newSlug = titulo ? toSlug(titulo) : currentSlug;
      let finalImageUrl = card.imagemUrl;

      if (titulo && titulo !== card.titulo) {
        const oldDir = path.resolve(
          process.cwd(),
          "uploads",
          "newsletter",
          currentSlug,
        );
        const newDir = path.resolve(
          process.cwd(),
          "uploads",
          "newsletter",
          newSlug,
        );

        if (fs.existsSync(oldDir)) {
          if (!fs.existsSync(newDir)) {
            fs.renameSync(oldDir, newDir);
          }
        }

        finalImageUrl = finalImageUrl.replace(
          `/newsletter/${currentSlug}/`,
          `/newsletter/${newSlug}/`,
        );
        currentSlug = newSlug;
      }

      if (req.file) {
        const targetDir = path.resolve(
          process.cwd(),
          "uploads",
          "newsletter",
          currentSlug,
        );

        if (!fs.existsSync(targetDir))
          fs.mkdirSync(targetDir, { recursive: true });

        const newFilename = `${Date.now()}-${req.file.originalname}`;
        const newPath = path.join(targetDir, newFilename);

        if (card.imagemUrl) {
          const oldFile = path.resolve(
            process.cwd(),
            card.imagemUrl.replace(/^\//, ""),
          );
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        }

        fs.renameSync(req.file.path, newPath);
        finalImageUrl = `/uploads/newsletter/${currentSlug}/${newFilename}`;
      }

      await card.update({
        titulo: titulo || card.titulo,
        linkDestino: linkDestino || card.linkDestino,
        imagemUrl: finalImageUrl,
      });

      return res.status(200).json(card);
    } catch (error: any) {
      console.error(error);
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
      return res.status(500).json({ message: "Erro ao atualizar box." });
    }
  }

  // --- LISTAR ---
  static async getAll(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const cards = await SustentAi.findAll({ order: [["createdAt", "DESC"]] });

      if (!startDate || !endDate) {
        return res.status(200).json(cards);
      }

      const start = new Date(`${startDate}T00:00:00.000Z`);
      const end = new Date(`${endDate}T23:59:59.999Z`);

      const historico = await HistoricoCliqueSustentAi.findAll({
        attributes: [
          "sustentAiId",
          [sequelize.fn("COUNT", sequelize.col("id")), "totalCliques"],
        ],
        where: {
          createdAt: { [Op.between]: [start, end] },
        },
        group: ["sustentAiId"],
      });

      const cliquesPorCard: Record<number, number> = {};
      historico.forEach((row: any) => {
        cliquesPorCard[row.sustentAiId] = parseInt(
          row.getDataValue("totalCliques"),
          10,
        );
      });

      const cardsFiltrados = cards.map((card) => {
        const cardData = card.toJSON();
        cardData.visualizacoes = cliquesPorCard[card.id] || 0;
        return cardData;
      });

      return res.status(200).json(cardsFiltrados);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erro ao buscar boxes." });
    }
  }

  // --- DELETAR ---
  static async deleteByTitle(req: Request, res: Response) {
    try {
      const { titulo } = req.params;
      const card = await SustentAi.findOne({ where: { titulo } });

      if (!card)
        return res.status(404).json({ message: "Box não encontrada." });

      // Deletar a pasta inteira do item
      const slug = toSlug(card.titulo);
      const dirPath = path.resolve(
        process.cwd(),
        "uploads",
        "newsletter",
        slug,
      );

      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }

      await card.destroy();
      return res.status(200).json({ message: "Box removida com sucesso." });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erro ao remover box." });
    }
  }

  // Registrar Clique na Navbar ---
  static async registerNavClick(req: Request, res: Response) {
    try {
      const chave = "SUSTENTAI_NAV";
      let contador = await ContadorODS.findOne({ where: { ods: chave } });

      if (!contador) {
        contador = await ContadorODS.create({ ods: chave, visualizacoes: 1 });
      } else {
        await contador.increment("visualizacoes");
      }
      await HistoricoAcessoMenu.create({ chave });
      return res.status(200).json({ message: "Clique navbar OK" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erro navbar" });
    }
  }

  // 2. REGISTRAR CLIQUE NO CARD
  static async registerCardClick(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const card = await SustentAi.findByPk(id);
      if (!card) return res.status(404).json({ message: "Card não existe" });

      await card.increment("visualizacoes");
      await HistoricoCliqueSustentAi.create({ sustentAiId: card.id });
      return res.status(200).json({ message: "Clique card OK" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erro card" });
    }
  }
}
