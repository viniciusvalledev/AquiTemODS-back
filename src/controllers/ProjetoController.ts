import { Request, Response } from "express";
import ProjetoService from "../services/ProjetoService";
import fs from "fs/promises";
import path from "path";
import Projeto from "../entities/Projeto.entity";

class ProjetoController {
  private _deleteUploadedFilesOnFailure = async (req: Request) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files) return;
    const filesToDelete = Object.values(files).flat();
    await Promise.all(
      filesToDelete.map((file) =>
        fs
          .unlink(file.path)
          .catch((err) =>
            console.error(
              `Falha ao deletar arquivo ${file.path} durante rollback: ${err.message}`
            )
          )
      )
    );
  };

  private _handleError = (error: any, res: Response): Response => {
    if (error.message.includes("já cadastrado")) {
        return res.status(400).json({ message: error.message });
    }
    if (error.message.includes("não encontrado")) {
      return res.status(404).json({ message: error.message });
    }
    return res
      .status(500)
      .json({ message: "Ocorreu um erro interno no servidor." });
  };

  private _moveFilesAndPrepareData = async (
    req: Request,
    existingInfo?: { ods: string; nomeProjeto: string }
  ): Promise<any> => {
    const dadosDoFormulario = req.body;
    const arquivos = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const ods = existingInfo?.ods || dadosDoFormulario.ods;
    const nomeProjeto =
      existingInfo?.nomeProjeto || dadosDoFormulario.nomeProjeto;

    const sanitize = (name: string) =>
      (name || "").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const safeOds = sanitize(ods || "geral");
    const safeNomeProjeto = sanitize(nomeProjeto || "projeto_sem_nome");

    const targetDir = path.resolve("uploads", safeOds, safeNomeProjeto);
    await fs.mkdir(targetDir, { recursive: true });

    const moveFile = async (
      file?: Express.Multer.File
    ): Promise<string | undefined> => {
      if (!file) return undefined;
      const oldPath = file.path;
      const newPath = path.join(targetDir, file.filename);
      await fs.rename(oldPath, newPath);
      return path
        .join("uploads", safeOds, safeNomeProjeto, file.filename)
        .replace(/\\/g, "/");
    };

    const logoPath = await moveFile(arquivos["logo"]?.[0]);

    const imagensPaths: string[] = [];
    if (arquivos["imagens"]) {
      for (const file of arquivos["imagens"]) {
        const newPath = await moveFile(file);
        if (newPath) imagensPaths.push(newPath);
      }
    }

    return {
      ...dadosDoFormulario,
      ...(logoPath && { logo: logoPath }),
      ...(imagensPaths.length > 0 && { imagens: imagensPaths }),
    };
  };

  public cadastrar = async (req: Request, res: Response): Promise<Response> => {
    try {
      const dadosCompletos = await this._moveFilesAndPrepareData(req);
      const novoProjeto =
        await ProjetoService.cadastrarProjetoComImagens(
          dadosCompletos
        );
      return res.status(201).json(novoProjeto);
    } catch (error: any) {
      await this._deleteUploadedFilesOnFailure(req);
      return this._handleError(error, res);
    }
  };

    public solicitarAtualizacao = async (
        req: Request,
        res: Response
      ): Promise<Response> => {
        try {
          const id = parseInt(req.params.id);
          if (!id) {
            return res.status(400).json({
              message: "O ID do projeto é obrigatório para solicitar uma atualização.",
            });
          }

          const projetoExistente = await Projeto.findByPk(id);
          if (!projetoExistente) {
            await this._deleteUploadedFilesOnFailure(req);
            return res.status(404).json({
              message:
                "Projeto não encontrado para atualização, verifique o ID e tente novamente.",
            });
          }

          const dadosCompletos = await this._moveFilesAndPrepareData(req, {
            ods: projetoExistente.ods,
            nomeProjeto: projetoExistente.nomeProjeto,
          });

          const projeto =
            await ProjetoService.solicitarAtualizacaoPorId(
              id,
              dadosCompletos
            );

          return res.status(200).json({
            message: "Solicitação de atualização enviada para análise.",
            projeto,
          });
        } catch (error: any) {
          await this._deleteUploadedFilesOnFailure(req);
          return this._handleError(error, res);
        }
      };

      public solicitarExclusao = async (
        req: Request,
        res: Response
      ): Promise<Response> => {
        try {
            const id = parseInt(req.params.id);
          if (!id) {
            return res.status(400).json({
              message: "O ID do projeto é obrigatório para solicitar uma exclusão.",
            });
          }
          await ProjetoService.solicitarExclusaoPorId(id);
          return res
            .status(200)
            .json({ message: "Solicitação de exclusão enviada para análise." });
        } catch (error: any) {
          return this._handleError(error, res);
        }
      };

  public listarTodos = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const projetos = await ProjetoService.listarTodos();
      return res.status(200).json(projetos);
    } catch (error: any) {
      return this._handleError(error, res);
    }
  };

  public buscarPorNome = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const nome = req.query.nome as string;
      const projetos = await ProjetoService.buscarPorNome(nome);
      return res.status(200).json(projetos);
    } catch (error: any) {
      return this._handleError(error, res);
    }
  };

  public buscarPorId = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const id = parseInt(req.params.id);
      const projeto = await ProjetoService.buscarPorId(id);

      if (!projeto) {
        return res.status(404).json({
          message:
            "Projeto não encontrado.",
        });
      }

      const projetoJSON = projeto.toJSON();

      let media = 0;
      if (
        projetoJSON.avaliacoes &&
        projetoJSON.avaliacoes.length > 0
      ) {
        const somaDasNotas = projetoJSON.avaliacoes.reduce(
          (acc: number, avaliacao: { nota: number }) => acc + avaliacao.nota,
          0
        );
        const mediaCalculada =
          somaDasNotas / projetoJSON.avaliacoes.length;
        media = parseFloat(mediaCalculada.toFixed(1));
      }

      const dadosParaFront = {
        ...projetoJSON,
        media: media,
      };

      return res.status(200).json(dadosParaFront);
    } catch (error: any) {
      return this._handleError(error, res);
    }
  };

    public alterarStatus = async (
        req: Request,
        res: Response
      ): Promise<Response> => {
        try {
          const id = parseInt(req.params.id);
          const { ativo } = req.body;
          if (typeof ativo !== "boolean") {
            return res.status(400).json({
              message:
                "O corpo da requisição deve conter a chave 'ativo' com um valor booleano (true/false).",
            });
          }
          const projeto = await ProjetoService.alterarStatusAtivo(
            id,
            ativo
          );
          return res.status(200).json(projeto);
        } catch (error: any) {
          return this._handleError(error, res);
        }
      };
}

export default new ProjetoController();