import { Request, Response } from "express";
import Projeto, { StatusProjeto } from "../entities/Projeto.entity"; 
import * as jwt from "jsonwebtoken";
import ImagemProjeto from "../entities/ImagemProjeto.entity";
import sequelize from "../config/database";
import fs from "fs/promises";
import path from "path";
import EmailService from "../utils/EmailService";
import ProjetoService from "../services/ProjetoService";
import Avaliacao from "../entities/Avaliacao.entity";
import Usuario from "../entities/Usuario.entity";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import ContadorODS from "../entities/ContadorODS.entity";

const sanitize = (name: string) =>
  (name || "").replace(/[^a-z0-9]/gi, "_").toLowerCase();

const deleteProjectFolder = async (ods: string, nomeProjeto: string) => {
  try {
    const safeOds = sanitize(ods || "geral");
    const safeNomeProjeto = sanitize(nomeProjeto || "projeto_sem_nome");

    const projectDir = path.resolve(
      __dirname,
      "..",
      "..",
      "uploads",
      safeOds,
      safeNomeProjeto,
    );

    await fs.access(projectDir);
    await fs.rm(projectDir, { recursive: true, force: true });
    console.log(`[SYSTEM] Pasta do projeto excluída: ${projectDir}`);
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      console.error(`[SYSTEM] Erro ao excluir pasta do projeto:`, error);
    }
  }
};

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET;

if (!ADMIN_USER || !ADMIN_PASSWORD || !JWT_SECRET) {
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.error("ERRO CRÍTICO: Variáveis de ambiente do Admin não definidas.");
  console.error(
    "Por favor, defina ADMIN_USER, ADMIN_PASSWORD, e ADMIN_JWT_SECRET",
  );
  console.error(
    "no seu ficheiro .env (ou .env.local) antes de iniciar o servidor.",
  );
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  throw new Error(
    "Credenciais de administrador ou segredo JWT não configurados.",
  );
}

export class AdminController {
  static async login(req: Request, res: Response) {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { username, role: "admin" },
        JWT_SECRET as string,
        {
          expiresIn: "8h",
        },
      );
      return res.json({ success: true, token });
    }

    return res
      .status(401)
      .json({ success: false, message: "Credenciais inválidas" });
  }

  static async getPending(req: Request, res: Response) {
    try {
      const includeOptions = {
        model: ImagemProjeto,
        as: "projetoImg",
        attributes: ["url"],
      };

      const cadastros = await Projeto.findAll({
        where: { status: StatusProjeto.PENDENTE_APROVACAO },
        include: [includeOptions],
      });
      const atualizacoes = await Projeto.findAll({
        where: { status: StatusProjeto.PENDENTE_ATUALIZACAO },
        include: [includeOptions],
      });
      const exclusoes = await Projeto.findAll({
        where: { status: StatusProjeto.PENDENTE_EXCLUSAO },
        include: [includeOptions],
      });

      return res.json({ cadastros, atualizacoes, exclusoes });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar solicitações pendentes." });
    }
  }

  static async approveRequest(req: Request, res: Response) {
    const { id } = req.params;
    const transaction = await sequelize.transaction();

    try {
      let responseMessage = "Solicitação aprovada com sucesso.";

      const projeto = await Projeto.findByPk(id, {
        transaction,
        include: [{ model: ImagemProjeto, as: "projetoImg" }],
      });
      if (!projeto) {
        await transaction.rollback();
        return res.status(404).json({ message: "Projeto não encontrado." });
      }
      let emailInfo: { subject: string; html: string } | null = null;

      switch (projeto.status) {
        case StatusProjeto.PENDENTE_APROVACAO:
          projeto.status = StatusProjeto.ATIVO;
          projeto.ativo = true;
          await projeto.save({ transaction });

          emailInfo = {
            subject: "Seu cadastro no Aqui Tem ODS foi Aprovado!",
            html: `
              <h1>Olá, ${projeto.prefeitura}!</h1> 
              <p>Temos uma ótima notícia: o seu projeto, <strong>${projeto.nomeProjeto}</strong>, foi aprovado e já está visível na nossa plataforma!</p>
              <p>O ID do seu projeto é: <strong>${projeto.projetoId}</strong>.<p><strong>Atenção:</strong> É muito importante que você guarde este número de ID em um local seguro. Ele será <strong>NECESSÁRIO</strong> sempre que você precisar solicitar uma <strong>atualização</strong> ou a <strong>exclusão</strong> do seu projeto em nossa plataforma. Sem ele, não será possível realizar essas ações.</p>
              <p>Agradecemos por fazer parte do Aqui Tem ODS.</p>
              <br>
              <p>Atenciosamente,</p>
              <p><strong>Equipe AquitemODS.</strong></p>
            `,
          };
          break;

        case StatusProjeto.PENDENTE_ATUALIZACAO:
          if (projeto.dados_atualizacao) {
            const dadosRecebidos = projeto.dados_atualizacao as any;

            //  Inicializa vazio para atualização seletiva
            const dadosParaAtualizar: Partial<Projeto> & {
              [key: string]: any;
            } = {};

            //  *** CORREÇÃO: ADICIONADO CAMPOS FALTANTES ***
            const camposPermitidos: (keyof Projeto | string)[] = [
              "nomeProjeto", // Adicionado
              "prefeitura", // Adicionado
              "secretaria", // Adicionado
              "responsavelProjeto", // Adicionado
              "emailContato", // Adicionado
              "linkProjeto", // Adicionado
              "endereco", // Adicionado
              "ods", // Adicionado
              "apoio_planejamento", // Adicionado
              "escala", // Adicionado
              "descricaoDiferencial",
              "descricao",
              "objetivo",
              "justificativa",
              "publicoAlvo",
              "impacto",
              "localizacao",
              "website",
              "instagram",
              "facebook",
              "youtube",
              "tagsInvisiveis",
              "odsRelacionadas",
              "odsId",
              "venceuPspe",
            ];

            //  Copia apenas os campos permitidos e existentes
            for (const key of camposPermitidos) {
              if (
                dadosRecebidos.hasOwnProperty(key) &&
                dadosRecebidos[key] != null
              ) {
                (dadosParaAtualizar as any)[key] = dadosRecebidos[key];
              }
            }

            // Lógica para LOGO
            if (dadosRecebidos.logo) {
              const logoAntigaUrl = projeto.logoUrl;
              if (logoAntigaUrl) {
                try {
                  const filePath = path.join(
                    __dirname,
                    "..",
                    "..",
                    logoAntigaUrl,
                  );
                  await fs.unlink(filePath);
                } catch (err) {
                  console.error(
                    `AVISO: Falha ao deletar logo antiga: ${logoAntigaUrl}`,
                    err,
                  );
                }
              }
              dadosParaAtualizar.logoUrl = dadosRecebidos.logo;
            }

            // *** CORREÇÃO: LÓGICA PARA OFÍCIO ***
            if (dadosRecebidos.oficio) {
              const oficioAntigoUrl = projeto.oficioUrl;
              if (oficioAntigoUrl) {
                try {
                  const filePath = path.join(
                    __dirname,
                    "..",
                    "..",
                    oficioAntigoUrl,
                  );
                  await fs.unlink(filePath);
                } catch (err) {
                  console.error(
                    `AVISO: Falha ao deletar ofício antigo: ${oficioAntigoUrl}`,
                    err,
                  );
                }
              }
              dadosParaAtualizar.oficioUrl = dadosRecebidos.oficio;
            }

            // Lógica para IMAGENS (Portfólio)
            if (
              dadosRecebidos.imagens &&
              Array.isArray(dadosRecebidos.imagens) &&
              dadosRecebidos.imagens.length > 0
            ) {
              const imagensAntigas = await ImagemProjeto.findAll({
                where: { projetoId: projeto.projetoId },
                transaction,
              });

              for (const imagem of imagensAntigas) {
                try {
                  const filePath = path.join(__dirname, "..", "..", imagem.url);
                  await fs.unlink(filePath);
                } catch (err) {
                  console.error(
                    `AVISO: Falha ao deletar imagem antiga: ${imagem.url}`,
                    err,
                  );
                }
              }

              await ImagemProjeto.destroy({
                where: { projetoId: projeto.projetoId },
                transaction,
              });

              const novasImagens = dadosRecebidos.imagens.map(
                (url: string) => ({
                  url,
                  projetoId: projeto.projetoId,
                }),
              );
              await ImagemProjeto.bulkCreate(novasImagens, { transaction });
            }

            // Atualiza status e limpa dados temporários
            dadosParaAtualizar.dados_atualizacao = null;
            dadosParaAtualizar.status = StatusProjeto.ATIVO;
            dadosParaAtualizar.ativo = true;

            await projeto.update(dadosParaAtualizar, { transaction });
          } else {
            projeto.dados_atualizacao = null;
            projeto.status = StatusProjeto.ATIVO;
            projeto.ativo = true;
            await projeto.save({ transaction });
          }

          emailInfo = {
            subject:
              "Sua solicitação de atualização no Aqui Tem ODS foi Aprovada!",
            html: `
              <h1>Olá, ${projeto.prefeitura}!</h1>
              <p>A sua solicitação para atualizar os dados do projeto <strong>${projeto.nomeProjeto}</strong> foi aprovada.</p>
              <p>As novas informações já estão visíveis para todos na plataforma.</p>
              <p>Relembrando, o ID do seu projeto é: <strong>${projeto.projetoId}</strong>.</p> 
              <p>Ele será <strong>NECESSÁRIO</strong> sempre que você precisar solicitar uma <strong>atualização</strong> ou a <strong>exclusão</strong> do seu projeto em nossa plataforma. Sem ele, não será possível realizar essas ações.</p>
              <br>
              <p>Agradecemos por fazer parte do Aqui Tem ODS.</p>
              <p>Atenciosamente,</p>
              <p><strong>Equipe Aqui Tem ODS</strong></p>
            `,
          };
          break;

        case StatusProjeto.PENDENTE_EXCLUSAO:
          emailInfo = {
            subject: "Seu projeto foi removido da plataforma Aqui Tem ODS",
            html: `
              <h1>Olá, ${projeto.prefeitura}.</h1> 
              <p>Informamos que a sua solicitação para remover o projeto <strong>${projeto.nomeProjeto}</strong> da nossa plataforma foi concluída com sucesso.</p>
              <p>Lamentamos a sua partida e esperamos poder colaborar com você novamente no futuro.</p>
              <br>
              <p>Atenciosamente,</p>
              <p><strong>Equipe AquitemODS</strong></p>
            `,
          };

          await deleteProjectFolder(projeto.ods, projeto.nomeProjeto);
          await projeto.destroy({ transaction });
          responseMessage = "Projeto excluído com sucesso.";
          break;
      }

      await transaction.commit();

      if (emailInfo && projeto.emailContato) {
        try {
          await EmailService.sendGenericEmail({
            to: projeto.emailContato,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(
            `Email de notificação enviado com sucesso para ${projeto.emailContato}`,
          );
        } catch (error) {
          console.error(
            `Falha ao enviar email de notificação para ${projeto.emailContato}:`,
            error,
          );
        }
      }

      return res.status(200).json({ message: responseMessage });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A APROVAÇÃO:", error);
      return res
        .status(500)
        .json({ message: "Erro ao aprovar a solicitação." });
    }
  }

  // ... (RESTANTE DO CÓDIGO PERMANECE O MESMO: editAndApproveRequest, rejectRequest, etc.)
  // Certifique-se de manter todo o resto da classe AdminController abaixo.

  static async editAndApproveRequest(req: Request, res: Response) {
    const { id } = req.params;
    const adminEditedData = req.body;
    const { urlsParaExcluir } = adminEditedData;
    const transaction = await sequelize.transaction();

    try {
      const projeto = await Projeto.findByPk(id, {
        transaction,
        include: [{ model: ImagemProjeto, as: "projetoImg" }],
      });

      if (!projeto) {
        await transaction.rollback();
        return res.status(404).json({ message: "Projeto não encontrado." });
      }

      let emailInfo: { subject: string; html: string } | null = null;
      const statusOriginal = projeto.status;
      const dadosRecebidos = (projeto.dados_atualizacao || {}) as any;

      if (
        statusOriginal === StatusProjeto.PENDENTE_ATUALIZACAO &&
        projeto.dados_atualizacao
      ) {
        // Lógica para LOGO
        if (
          adminEditedData.hasOwnProperty("logoUrl") &&
          adminEditedData.logoUrl === null
        ) {
          const logoAntigaUrl = projeto.logoUrl || dadosRecebidos.logo;
          if (logoAntigaUrl) {
            try {
              const filePath = path.join(__dirname, "..", "..", logoAntigaUrl);
              await fs.unlink(filePath);
            } catch (err) {
              console.error(
                `AVISO: Falha ao deletar logo (pendente ou antiga): ${logoAntigaUrl}`,
                err,
              );
            }
          }
        } else if (dadosRecebidos.logo) {
          const logoAntigaUrl = projeto.logoUrl;
          if (logoAntigaUrl) {
            try {
              const filePath = path.join(__dirname, "..", "..", logoAntigaUrl);
              await fs.unlink(filePath);
            } catch (err) {
              console.error(
                `AVISO: Falha ao deletar logo antiga: ${logoAntigaUrl}`,
                err,
              );
            }
          }
          adminEditedData.logoUrl = dadosRecebidos.logo;
        }

        // Lógica para IMAGENS
        if (
          dadosRecebidos.imagens &&
          Array.isArray(dadosRecebidos.imagens) &&
          dadosRecebidos.imagens.length > 0
        ) {
          const imagensAntigas = await ImagemProjeto.findAll({
            where: { projetoId: projeto.projetoId },
            transaction,
          });

          for (const imagem of imagensAntigas) {
            try {
              const filePath = path.join(__dirname, "..", "..", imagem.url);
              await fs.unlink(filePath);
            } catch (err) {
              /* ... log ... */
            }
          }

          await ImagemProjeto.destroy({
            where: { projetoId: projeto.projetoId },
            transaction,
          });

          const imagensParaCriar = dadosRecebidos.imagens.filter(
            (url: string) =>
              !(urlsParaExcluir && urlsParaExcluir.includes(url)),
          );

          const novasImagens = imagensParaCriar.map((url: string) => ({
            url,
            projetoId: projeto.projetoId,
          }));
          await ImagemProjeto.bulkCreate(novasImagens, { transaction });
        } else if (
          urlsParaExcluir &&
          Array.isArray(urlsParaExcluir) &&
          urlsParaExcluir.length > 0
        ) {
          const imagensParaDeletar = await ImagemProjeto.findAll({
            where: {
              url: urlsParaExcluir,
              projetoId: projeto.projetoId,
            },
            transaction,
          });

          for (const imagem of imagensParaDeletar) {
            try {
              const filePath = path.join(__dirname, "..", "..", imagem.url);
              await fs.unlink(filePath);
            } catch (err) {
              /* ... log ... */
            }
          }

          await ImagemProjeto.destroy({
            where: {
              id: imagensParaDeletar.map((img) => img.id),
            },
            transaction,
          });
        }
      }

      delete adminEditedData.urlsParaExcluir;

      await projeto.update(
        {
          ...adminEditedData,
          status: StatusProjeto.ATIVO,
          ativo: true,
          dados_atualizacao: null,
        },
        { transaction },
      );

      if (statusOriginal === StatusProjeto.PENDENTE_APROVACAO) {
        emailInfo = {
          subject: "Seu cadastro no Aqui Tem ODS foi Aprovado!",
          html: `<h1>Olá, ${projeto.prefeitura}!</h1> <p>Temos uma ótima notícia: o seu projeto, <strong>${projeto.nomeProjeto}</strong>, foi aprovado e já está visível na nossa plataforma!</p><p>O ID do seu projeto é: <strong>${projeto.projetoId}</strong>.<p><strong>Atenção:</strong> É muito importante que você guarde este número de ID em um local seguro. Ele será <strong>NECESSÁRIO</strong> sempre que você precisar solicitar uma <strong>atualização</strong> ou a <strong>exclusão</strong> do seu projeto em nossa plataforma. Sem ele, não será possível realizar essas ações.</p><p>Agradecemos por fazer parte do Aqui Tem ODS.</p><br><p>Atenciosamente,</p><p><strong>Equipe Aqui Tem ODS.</strong></p>`,
        };
      } else if (statusOriginal === StatusProjeto.PENDENTE_ATUALIZACAO) {
        emailInfo = {
          subject:
            "Sua solicitação de atualização no Aqui Tem ODS foi Aprovada!",
          html: `
            <h1>Olá, ${projeto.prefeitura}!</h1>
            <p>A sua solicitação para atualizar os dados do projeto <strong>${projeto.nomeProjeto}</strong> foi aprovada.</p>
            <p>As novas informações já estão visíveis para todos na plataforma.</p>
            <p>Relembrando, o ID do seu projeto é: <strong>${projeto.projetoId}</strong>.</p> 
            <p>Ele será <strong>NECESSÁRIO</strong> sempre que você precisar solicitar uma <strong>atualização</strong> ou a <strong>exclusão</strong> do seu projeto em nossa plataforma. Sem ele, não será possível realizar essas ações.</p>
            <br>
            <p>Agradecemos por fazer parte do Aqui Tem ODS.</p>
            <p>Atenciosamente,</p>
            <p><strong>Equipe Aqui Tem ODS</strong></p>
          `,
        };
      }

      await transaction.commit();

      if (emailInfo && projeto.emailContato) {
        try {
          await EmailService.sendGenericEmail({
            to: projeto.emailContato,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
        } catch (error) {
          console.error(
            `Falha ao enviar email de notificação para ${projeto.emailContato}:`,
            error,
          );
        }
      }

      return res
        .status(200)
        .json({ message: "Projeto editado e aprovado com sucesso." });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A EDIÇÃO E APROVAÇÃO:", error);
      return res
        .status(500)
        .json({ message: "Erro ao editar e aprovar a solicitação." });
    }
  }

  static async getAllActiveProjetos(req: Request, res: Response) {
    try {
      const projetos = await ProjetoService.listarTodos();
      return res.json(projetos);
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar projetos ativos." });
    }
  }

  static async adminUpdateProjeto(req: Request, res: Response) {
    const { id } = req.params;
    const adminEditedData = req.body;
    const { urlsParaExcluir } = req.body;

    const transaction = await sequelize.transaction();

    try {
      const projeto = await Projeto.findByPk(id, { transaction });

      if (!projeto) {
        await transaction.rollback();
        return res.status(404).json({ message: "Projeto não encontrado." });
      }

      if (
        adminEditedData.hasOwnProperty("logoUrl") &&
        adminEditedData.logoUrl === null &&
        projeto.logoUrl
      ) {
        const logoAntigaUrl = projeto.logoUrl;
        try {
          const filePath = path.join(__dirname, "..", "..", logoAntigaUrl);
          await fs.unlink(filePath);
          console.log(`Logo antiga deletada: ${logoAntigaUrl}`);
        } catch (err) {
          console.error(
            `AVISO: Falha ao deletar logo antiga: ${logoAntigaUrl}`,
            err,
          );
        }
      }

      if (
        urlsParaExcluir &&
        Array.isArray(urlsParaExcluir) &&
        urlsParaExcluir.length > 0
      ) {
        const imagensParaDeletar = await ImagemProjeto.findAll({
          where: {
            url: urlsParaExcluir,
            projetoId: projeto.projetoId,
          },
          transaction,
        });

        for (const imagem of imagensParaDeletar) {
          try {
            const filePath = path.join(__dirname, "..", "..", imagem.url);
            await fs.unlink(filePath);
            console.log(`Imagem de portfólio deletada: ${imagem.url}`);
          } catch (err) {
            console.error(
              `AVISO: Falha ao deletar imagem de portfólio: ${imagem.url}`,
              err,
            );
          }
        }

        await ImagemProjeto.destroy({
          where: {
            id: imagensParaDeletar.map((img) => img.id),
          },
          transaction,
        });
      }

      delete adminEditedData.projetoId;
      delete adminEditedData.status;
      delete adminEditedData.ativo;
      delete adminEditedData.dados_atualizacao;
      delete adminEditedData.urlsParaExcluir;

      await projeto.update(adminEditedData, { transaction });
      await transaction.commit();

      return res
        .status(200)
        .json({ message: "Projeto atualizado com sucesso." });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A ATUALIZAÇÃO ADMIN:", error);
      return res.status(500).json({ message: "Erro ao atualizar o projeto." });
    }
  }

  static adminDeleteProjeto = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID do projeto inválido." });
      }

      const projeto = await Projeto.findByPk(id);
      if (!projeto) {
        return res.status(404).json({ message: "Projeto não encontrado." });
      }

      await deleteProjectFolder(projeto.ods, projeto.nomeProjeto);
      await projeto.destroy();

      return res.status(204).send();
    } catch (error: any) {
      console.error("Falha ao excluir projeto (admin):", error);
      return res
        .status(500)
        .json({ message: "Erro interno ao excluir projeto." });
    }
  };

  static async rejectRequest(req: Request, res: Response) {
    const { id } = req.params;
    const { motivoRejeicao } = req.body;
    const transaction = await sequelize.transaction();
    try {
      const projeto = await Projeto.findByPk(id, { transaction });
      if (!projeto) {
        await transaction.rollback();
        return res.status(404).json({ message: "Projeto não encontrado." });
      }

      let responseMessage = "Solicitação rejeitada com sucesso.";
      let emailInfo: { subject: string; html: string } | null = null;
      const emailParaNotificar = projeto.emailContato;
      const motivoHtml = motivoRejeicao
        ? `<p><strong>Motivo da Rejeição:</strong> ${motivoRejeicao}</p>`
        : "<p>Para mais detalhes, entre em contato conosco.</p>";

      if (projeto.status === StatusProjeto.PENDENTE_APROVACAO) {
        await deleteProjectFolder(projeto.ods, projeto.nomeProjeto);

        await projeto.destroy({ transaction });
        responseMessage = "Cadastro de projeto rejeitado e removido.";

        emailInfo = {
          subject: "Seu cadastro no Aqui Tem ODS foi Rejeitado",
          html: `<h1>Olá, ${projeto.prefeitura}.</h1>
                 <p>Lamentamos informar que o cadastro do projeto <strong>${projeto.nomeProjeto}</strong> não foi aprovado.</p>
                 ${motivoHtml}
                 <br>
                 <p>Atenciosamente,</p>
                 <p><strong>Equipe Aqui Tem ODS</strong></p>`,
        };
      } else if (
        projeto.status === StatusProjeto.PENDENTE_ATUALIZACAO ||
        projeto.status === StatusProjeto.PENDENTE_EXCLUSAO
      ) {
        const statusAnterior = projeto.status;
        projeto.status = StatusProjeto.ATIVO;
        projeto.dados_atualizacao = null;
        await projeto.save({ transaction });

        if (statusAnterior === StatusProjeto.PENDENTE_ATUALIZACAO) {
          emailInfo = {
            subject:
              "Sua solicitação de atualização no Aqui Tem ODS foi Rejeitada",
            html: `<h1>Olá, ${projeto.prefeitura}.</h1>
                   <p>Informamos que a sua solicitação para atualizar os dados do projeto <strong>${projeto.nomeProjeto}</strong> não foi aprovada.</p>
                   <p>Os dados anteriores foram mantidos.</p>
                   ${motivoHtml}
                   <br>
                   <p>Atenciosamente,</p>
                   <p><strong>Equipe Aqui Tem ODS</strong></p>`,
          };
        } else {
          emailInfo = {
            subject:
              "Sua solicitação de exclusão no Aqui Tem ODS foi Rejeitada",
            html: `<h1>Olá, ${projeto.prefeitura}.</h1>
                   <p>Informamos que a sua solicitação para remover o projeto <strong>${projeto.nomeProjeto}</strong> não foi aprovada.</p>
                   <p>Seu projeto continua ativo na plataforma.</p>
                   ${motivoHtml}
                   <br>
                   <p>Atenciosamente,</p>
                   <p><strong>Equipe Aqui Tem ODS</strong></p>`,
          };
        }
      } else {
        await transaction.rollback();
        return res.status(400).json({
          message: "O projeto não está em um estado pendente para rejeição.",
        });
      }

      await transaction.commit();

      if (emailInfo && emailParaNotificar) {
        try {
          await EmailService.sendGenericEmail({
            to: emailParaNotificar,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(
            `Email de rejeição enviado com sucesso para ${emailParaNotificar}`,
          );
        } catch (error) {
          console.error(
            `Falha ao enviar email de rejeição para ${emailParaNotificar}:`,
            error,
          );
        }
      }

      return res.status(200).json({ message: responseMessage });
    } catch (error) {
      await transaction.rollback();
      console.error("Erro ao rejeitar a solicitação:", error);
      return res
        .status(500)
        .json({ message: "Erro ao rejeitar a solicitação." });
    }
  }

  static async getAvaliacoesByProjeto(req: Request, res: Response) {
    try {
      const { projetoId } = req.params;

      const projeto = await Projeto.findByPk(projetoId, {
        attributes: ["projetoId", "nomeProjeto", "ods"],
      });

      if (!projeto) {
        return res.status(404).json({ message: "Projeto não encontrado." });
      }

      const avaliacoes = await Avaliacao.findAll({
        where: { projetoId: projetoId, parent_id: null },
        include: [
          {
            model: Usuario,
            as: "usuario",
            attributes: ["usuarioId", "nomeCompleto", "email"],
          },
          {
            model: Avaliacao,
            as: "respostas",
            required: false,
            include: [
              {
                model: Usuario,
                as: "usuario",
                attributes: ["usuarioId", "nomeCompleto", "email"],
              },
            ],
          },
        ],
        order: [
          ["avaliacoesId", "DESC"],
          [{ model: Avaliacao, as: "respostas" }, "avaliacoesId", "ASC"],
        ],
      });

      return res.json({ projeto, avaliacoes });
    } catch (error) {
      console.error("Erro ao buscar avaliações por projeto (admin):", error);
      return res.status(500).json({ message: "Erro ao buscar avaliações." });
    }
  }

  static async adminDeleteAvaliacao(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const avaliacao = await Avaliacao.findByPk(id);

      if (!avaliacao) {
        return res.status(404).json({ message: "Avaliação não encontrada." });
      }

      await avaliacao.destroy();

      return res
        .status(200)
        .json({ message: "Avaliação excluída com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir avaliação (admin):", error);
      return res.status(500).json({ message: "Erro ao excluir a avaliação." });
    }
  }

  static async exportActiveProjetos(req: Request, res: Response) {
    try {
      const projetos = await ProjetoService.listarTodos();

      if (!projetos || projetos.length === 0) {
        return res
          .status(404)
          .json({ message: "Nenhum projeto ativo para exportar." });
      }

      const headers = [
        "ID",
        "Nome do Projeto",
        "ODS",
        "Prefeitura",
        "Secretaria",
        "Responsável",
        "Email Contato",
        "Telefone/Endereço",
        "Venceu PSPE",
        "Status",
        "Link Projeto",
        "Website",
        "Instagram",
        "Descrição",
        "Diferencial (Briefing)",
        "ODS Relacionadas",
        "Apoio Planejamento",
        "Escala",
        "Data de Criação",
      ];

      const SEPARATOR = ";";

      const escapeCsvField = (field: any) => {
        if (field === null || field === undefined) return '""';

        let stringField = String(field)
          .replace(/\r\n/g, " ")
          .replace(/\n/g, " ");

        if (stringField.includes('"') || stringField.includes(SEPARATOR)) {
          return `"${stringField.replace(/"/g, '""')}"`;
        }

        return stringField;
      };

      let csvContent = headers.join(SEPARATOR) + "\n";

      projetos.forEach((projeto) => {
        const row = [
          projeto.projetoId,
          projeto.nomeProjeto,
          projeto.ods,
          projeto.prefeitura,
          projeto.secretaria,
          projeto.responsavelProjeto,
          projeto.emailContato,
          projeto.endereco,
          projeto.venceuPspe ? "Sim" : "Não",
          projeto.status,
          projeto.linkProjeto,
          projeto.website,
          projeto.instagram,
          projeto.descricao,
          projeto.descricaoDiferencial,
          projeto.odsRelacionadas,
          projeto.apoio_planejamento,
          projeto.escala,
          "",
        ];

        csvContent += row.map(escapeCsvField).join(SEPARATOR) + "\n";
      });

      const csvWithBOM = "\uFEFF" + csvContent;

      res.header("Content-Type", "text/csv; charset=utf-8");
      res.attachment("projetos_ativos_aquitemods.csv");

      return res.status(200).send(csvWithBOM);
    } catch (error) {
      console.error("Erro ao exportar projetos:", error);
      return res
        .status(500)
        .json({ message: "Erro ao gerar arquivo de exportação." });
    }
  }

  static async getProjetosByPrefeitura(req: Request, res: Response) {
    try {
      const nomePrefeitura = decodeURIComponent(req.params.nome);

      const projetos = await Projeto.findAll({
        where: {
          status: StatusProjeto.ATIVO,
          prefeitura: nomePrefeitura,
        },
        order: [["projetoId", "DESC"]],
      });

      return res.json(projetos);
    } catch (error) {
      console.error("Erro ao buscar projetos por prefeitura:", error);
      return res.status(500).json({ message: "Erro ao buscar projetos." });
    }
  }

  static async getDashboardStats(req: Request, res: Response) {
    try {
      const projetos = await Projeto.findAll({
        where: { status: StatusProjeto.ATIVO },
        attributes: [
          "projetoId",
          "venceuPspe",
          "escala",
          "apoio_planejamento",
          "ods",
          "prefeitura",
        ],
      });

      const totalProjetos = projetos.length;
      const venceuPspeCount = projetos.filter((p) => p.venceuPspe).length;

      const somaEscala = projetos.reduce(
        (acc, curr) =>
          acc +
          (typeof curr.escala === "string"
            ? parseInt(curr.escala, 10)
            : curr.escala || 0),
        0,
      );
      const mediaEscala =
        totalProjetos > 0 ? (somaEscala / totalProjetos).toFixed(1) : 0;

      const escalaDistribuicao = Array(11).fill(0);
      projetos.forEach((p) => {
        const escalaNum =
          typeof p.escala === "string" ? parseInt(p.escala, 10) : p.escala || 0;
        if (escalaNum >= 0 && escalaNum <= 10) {
          escalaDistribuicao[escalaNum]++;
        }
      });

      const chartEscala = escalaDistribuicao.map((count, nota) => ({
        nota: `Nota ${nota}`,
        votos: count,
      }));

      const projetosPorOdsMap: { [key: string]: number } = {};

      for (let i = 1; i <= 17; i++) projetosPorOdsMap[`ODS ${i}`] = 0;
      projetosPorOdsMap["ODS 18"] = 0;

      projetos.forEach((p) => {
        if (p.ods) {
          const match = p.ods.match(/ODS \d+/i);
          if (match) {
            const chave = match[0].toUpperCase();
            if (projetosPorOdsMap[chave] !== undefined) {
              projetosPorOdsMap[chave]++;
            }
          }
        }
      });

      const chartProjetosPorOds = Object.entries(projetosPorOdsMap)
        .map(([ods, qtd]) => ({ ods, qtd }))
        .filter((item) => item.qtd > 0)
        .sort((a, b) => {
          const numA = parseInt(a.ods.replace(/\D/g, ""));
          const numB = parseInt(b.ods.replace(/\D/g, ""));
          return numA - numB;
        });

      const apoioMap: { [key: string]: number } = {};

      projetos.forEach((p) => {
        if (p.apoio_planejamento) {
          const opcoes = p.apoio_planejamento.split(",").map((s) => s.trim());
          opcoes.forEach((op) => {
            if (op) {
              apoioMap[op] = (apoioMap[op] || 0) + 1;
            }
          });
        }
      });

      const chartApoio = Object.entries(apoioMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

      const totalUsuarios = await Usuario.count();

      const visualizacoesRaw = await ContadorODS.findAll();

      const mapaOds: { [key: string]: number } = {};
      for (let i = 1; i <= 17; i++) mapaOds[`ODS ${i}`] = 0;
      mapaOds["ODS 18"] = 0;

      const pageViews = {
        home: 0,
        espacoOds: 0,
        gameClick: 0,
        compartilhamento: 0,
        sustentAiNav: 0,
      };

      visualizacoesRaw.forEach((v) => {
        const chave = v.ods.trim().toUpperCase();

        if (!chave) return;

        if (chave === "HOME") {
          pageViews.home += v.visualizacoes;
        } else if (chave === "ESPACO_ODS" || chave === "ESPAÇO_ODS") {
          pageViews.espacoOds += v.visualizacoes;
        } else if (chave === "GAME_CLICK") {
          pageViews.gameClick += v.visualizacoes;
        } else if (chave === "COMPARTILHAMENTO") {
          pageViews.compartilhamento += v.visualizacoes;
        } else if (chave === "SUSTENTAI_NAV") {
          pageViews.sustentAiNav += v.visualizacoes;
        } else {
          if (!mapaOds[chave]) mapaOds[chave] = 0;
          mapaOds[chave] += v.visualizacoes;
        }
      });

      const chartVisualizacoes = Object.entries(mapaOds)
        .map(([ods, views]) => ({ ods, views }))
        .sort((a, b) => {
          const numA = parseInt(a.ods.replace(/\D/g, ""));
          const numB = parseInt(b.ods.replace(/\D/g, ""));
          return numA - numB;
        });

      const prefeituraMap: { [key: string]: number } = {};

      projetos.forEach((p) => {
        const nome = p.prefeitura
          ? p.prefeitura.trim()
          : "Prefeitura Não Informada";
        prefeituraMap[nome] = (prefeituraMap[nome] || 0) + 1;
      });

      const chartPrefeituras = Object.entries(prefeituraMap)
        .map(([nome, qtd]) => ({ nome, qtd }))
        .sort((a, b) => b.qtd - a.qtd);

      return res.json({
        totalProjetos,
        mediaEscala,
        totalUsuarios,
        statsPspe: [
          {
            name: "Venceu PSPE",
            value: venceuPspeCount,
            fill: "var(--color-sim)",
          },
          {
            name: "Não Venceu",
            value: totalProjetos - venceuPspeCount,
            fill: "var(--color-nao)",
          },
        ],
        chartEscala,
        chartApoio,
        chartVisualizacoes,
        pageViews,
        chartProjetosPorOds,
        chartPrefeituras,
      });
    } catch (error) {
      console.error("Erro stats:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas." });
    }
  }

  static async getAllUsers(req: Request, res: Response) {
    try {
      const usuarios = await Usuario.findAll({
        attributes: {
          exclude: ["password", "confirmationToken", "resetPasswordToken"],
        },
        order: [["usuarioId", "ASC"]],
      });
      return res.json(usuarios);
    } catch (error) {
      console.error("Erro ao buscar usuários (admin):", error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar lista de usuários." });
    }
  }

  static async adminUpdateUser(req: Request, res: Response) {
    const { id } = req.params;
    const { nomeCompleto, email, username, enabled } = req.body;

    const transaction = await sequelize.transaction();

    try {
      const usuario = await Usuario.findByPk(id, { transaction });

      if (!usuario) {
        await transaction.rollback();
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      const dadosAtualizacao: any = {};
      if (nomeCompleto !== undefined)
        dadosAtualizacao.nomeCompleto = nomeCompleto;
      if (email !== undefined) dadosAtualizacao.email = email;
      if (username !== undefined) dadosAtualizacao.username = username;
      if (enabled !== undefined) dadosAtualizacao.enabled = enabled;

      await usuario.update(dadosAtualizacao, { transaction });
      await transaction.commit();

      return res
        .status(200)
        .json({ message: "Usuário atualizado com sucesso." });
    } catch (error) {
      await transaction.rollback();
      console.error("Erro ao atualizar usuário (admin):", error);
      return res.status(500).json({ message: "Erro ao atualizar usuário." });
    }
  }

  static async adminDeleteUser(req: Request, res: Response) {
    const { id } = req.params;

    const transaction = await sequelize.transaction();

    try {
      const usuario = await Usuario.findByPk(id, { transaction });

      if (!usuario) {
        await transaction.rollback();
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      const avaliacoesDoUsuario = await Avaliacao.findAll({
        where: { usuarioId: id },
        attributes: ["avaliacoesId"],
        transaction,
      });

      const idsAvaliacoes = avaliacoesDoUsuario.map((a) => a.avaliacoesId);

      if (idsAvaliacoes.length > 0) {
        await Avaliacao.destroy({
          where: { parent_id: idsAvaliacoes },
          transaction,
        });

        await Avaliacao.destroy({
          where: { usuarioId: id },
          transaction,
        });
      }

      await usuario.destroy({ transaction });

      await transaction.commit();

      return res.status(200).json({
        message: "Usuário e todos os seus dados vinculados foram excluídos.",
      });
    } catch (error) {
      await transaction.rollback();
      console.error("Erro ao excluir usuário (admin):", error);
      return res.status(500).json({ message: "Erro ao excluir usuário." });
    }
  }

  static async adminChangePassword(req: Request, res: Response) {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "A senha deve ter pelo menos 6 caracteres." });
    }

    try {
      const usuario = await Usuario.findByPk(id);

      if (!usuario) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      usuario.password = hashedPassword;
      usuario.resetPasswordToken = null;
      usuario.resetPasswordTokenExpiry = null;

      await usuario.save();

      return res.status(200).json({ message: "Senha alterada com sucesso." });
    } catch (error) {
      console.error("Erro ao alterar senha (admin):", error);
      return res.status(500).json({ message: "Erro ao alterar a senha." });
    }
  }

  static async resendConfirmationEmail(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const usuario = await Usuario.findByPk(id);

      if (!usuario) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      if (usuario.enabled) {
        return res
          .status(400)
          .json({ message: "Este usuário já está confirmado e ativo." });
      }

      const confirmationToken = crypto.randomBytes(20).toString("hex");
      usuario.confirmationToken = confirmationToken;
      await usuario.save();

      const confirmUrl = `${process.env.FRONTEND_URL}/confirmar-conta?token=${confirmationToken}`;

      const emailHtml = `
        <h1>Confirmação de Conta (Reenvio Admin)</h1>
        <p>Olá, ${usuario.nomeCompleto}.</p>
        <p>Um administrador solicitou o reenvio do seu link de confirmação.</p>
        <p>Por favor, confirme seu cadastro clicando no link abaixo:</p>
        <a href="${confirmUrl}" target="_blank">Confirmar minha conta</a>
        <p>Se você não solicitou isso, ignore este email.</p>
      `;

      await EmailService.sendGenericEmail({
        to: usuario.email,
        subject: "Confirme sua conta no MeideSaquá",
        html: emailHtml,
      });

      return res
        .status(200)
        .json({ message: "Email de confirmação reenviado com sucesso." });
    } catch (error) {
      console.error("Erro ao reenviar confirmação (admin):", error);
      return res
        .status(500)
        .json({ message: "Erro ao enviar email de confirmação." });
    }
  }
}