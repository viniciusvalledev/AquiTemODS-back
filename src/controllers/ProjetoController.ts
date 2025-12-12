import { Request, Response } from "express";
import ProjetoService from "../services/ProjetoService";
import fs from "fs/promises";
import path from "path";
import Projeto from "../entities/Projeto.entity";
import ContadorODS from "../entities/ContadorODS.entity";

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
    // Tratamento de erro específico de e-mail (agora o campo de unicidade principal)
    if (error.message.includes("E-mail de contato já cadastrado no sistema.")) {
      return res.status(400).json({ message: error.message });
    }

    if (
      error.message.includes("Já existe um projeto cadastrado com este nome.")
    ) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes("O nome do projeto é um campo obrigatório.")) {
      return res.status(400).json({ message: error.message });
    }

    // Tratamento de erro de tamanho de dados
    if (
      error.name === "SequelizeDatabaseError" &&
      error.message.includes("Data too long for column")
    ) {
      let friendlyMessage =
        "Um dos campos de texto excedeu o limite de caracteres.";
      if (error.message.includes("'descricao_diferencial'")) {
        friendlyMessage =
          "O campo 'Briefing' excedeu o limite de 150 caracteres.";
      } else if (error.message.includes("'descricao'")) {
        friendlyMessage =
          "O campo 'Descrição' excedeu o limite de 5000 caracteres.";
      }
      return res.status(400).json({ message: friendlyMessage });
    }

    // Tratamento de erro de unicidade (agora focado no email de contato)
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "O e-mail de contato informado já está cadastrado no sistema.",
      });
    }

    // Tratamento de projeto não encontrado
    if (error.message.includes("não encontrado")) {
      return res.status(404).json({ message: error.message });
    }

    console.error("ERRO NÃO TRATADO:", error);
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
    const oficioPath = await moveFile(arquivos["oficio"]?.[0]);

    const imagensPaths: string[] = [];
    if (arquivos["imagens"]) {
      // Renomeado "produtos" para "imagens"
      for (const file of arquivos["imagens"]) {
        const newPath = await moveFile(file);
        if (newPath) imagensPaths.push(newPath);
      }
    }

    return {
      ...dadosDoFormulario,
      ...(logoPath && { logo: logoPath }),
      ...(oficioPath && { oficio: oficioPath }),
      ...(imagensPaths.length > 0 && { imagens: imagensPaths }),
    };
  };

  public cadastrar = async (req: Request, res: Response): Promise<Response> => {
    try {
      const dadosCompletos = await this._moveFilesAndPrepareData(req);
      const novoProjeto = await ProjetoService.cadastrarProjetoComImagens(
        // Chama o novo service
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
      const id = parseInt(req.params.id); // Pega o ID dos parâmetros de rota
      if (isNaN(id)) {
        return res.status(400).json({
          message:
            "O ID do projeto é obrigatório para solicitar uma atualização.",
        });
      }

      const projetoExistente = await Projeto.findByPk(id); // Busca por PK (ID)
      if (!projetoExistente) {
        await this._deleteUploadedFilesOnFailure(req);
        return res.status(404).json({
          message:
            "Projeto não encontrado para atualização, verifique o ID e tente novamente.",
        });
      }

      // Prepara os dados, usando as informações existentes do projeto (ODS e Nome)
      const dadosCompletos = await this._moveFilesAndPrepareData(req, {
        ods: projetoExistente.ods,
        nomeProjeto: projetoExistente.nomeProjeto,
      });

      const projeto = await ProjetoService.solicitarAtualizacaoPorId(
        // Chama o novo método do service
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
      if (isNaN(id)) {
        return res.status(400).json({
          message: "O ID do projeto é obrigatório para solicitar uma exclusão.",
        });
      }

      const dadosDoFormulario = req.body;

      const { prefeitura, nomeProjeto, secretaria, emailContato, motivo } =
        dadosDoFormulario;
      if (
        !prefeitura ||
        !nomeProjeto ||
        !secretaria ||
        !emailContato ||
        !motivo
      ) {
        return res.status(400).json({
          message:
            "Todos os campos são obrigatórios para solicitar a exclusão.",
        });
      }
      const projetoExistente = await Projeto.findByPk(id);
      if (!projetoExistente) {
        return res.status(404).json({
          message:
            "Projeto não encontrado para exclusão, verifique o ID e tente novamente.",
        });
      }

      await ProjetoService.solicitarExclusaoPorId(id, dadosDoFormulario);

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

  public buscarPorNomeUnico = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const nome = decodeURIComponent(req.params.nome);

      const projeto = await ProjetoService.buscarPorNomeUnico(nome);

      if (!projeto) {
        console.log(
          "[CONTROLLER] O serviço retornou null. Projeto não encontrado."
        );
        return res.status(404).json({ message: "Projeto não encontrado." });
      }

      return res.status(200).json(projeto);
    } catch (error: any) {
      console.error(
        "[CONTROLLER] Ocorreu um erro inesperado ao buscar por nome:",
        error
      );
      return this._handleError(error, res);
    }
  };

  public buscarPorId = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "O ID do projeto é inválido." });
      }
      const projeto = await ProjetoService.buscarPorId(id);

      if (!projeto) {
        return res.status(404).json({
          message: "Projeto não encontrado.",
        });
      }

      // Converte a instância do Sequelize para um objeto JSON
      const projetoJSON = projeto.toJSON();

      // Calcula a média das avaliações
      let media = 0;
      if (projetoJSON.avaliacoes && projetoJSON.avaliacoes.length > 0) {
        const somaDasNotas = projetoJSON.avaliacoes.reduce(
          (acc: number, avaliacao: { nota: number }) => acc + avaliacao.nota,
          0
        );
        const mediaCalculada = somaDasNotas / projetoJSON.avaliacoes.length;
        media = parseFloat(mediaCalculada.toFixed(1)); // Garante uma casa decimal
      }

      // Adiciona o campo "media" ao objeto que será enviado ao frontend
      const dadosParaFront = {
        ...projetoJSON,
        media: media,
      };

      return res.status(200).json(dadosParaFront);
    } catch (error: any) {
      return this._handleError(error, res);
    }
  };

  public buscarPorOds = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      // O nome da ODS vem da URL, então precisamos decodificá-lo
      const ods = decodeURIComponent(req.params.ods);
      const projetos = await ProjetoService.buscarPorOds(ods);
      return res.status(200).json(projetos);
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
        // Variável renomeada
        id,
        ativo
      );
      return res.status(200).json(projeto);
    } catch (error: any) {
      return this._handleError(error, res);
    }
  };

  public registrarVisualizacaoOds = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const { ods } = req.params;

      let odsFormatado = "";

      if (
        ods === "HOME" ||
        ods === "ESPACO_ODS" ||
        ods === "GAME_CLICK" ||
        ods === "COMPARTILHAMENTO"
      ) {
        odsFormatado = ods;
      } else {
        const numeroOds = ods.replace(/\D/g, "");
        odsFormatado = numeroOds ? `ODS ${numeroOds}` : ods.toUpperCase();
      }

      if (!odsFormatado) {
        return res
          .status(400)
          .json({ success: false, message: "Identificador inválido" });
      }

      const [registro] = await ContadorODS.findOrCreate({
        where: { ods: odsFormatado },
        defaults: { visualizacoes: 0 },
      });

      await registro.increment("visualizacoes");

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erro ao registrar visualização:", error);
      return res.status(200).json({ success: false });
    }
  };
}

export default new ProjetoController();
