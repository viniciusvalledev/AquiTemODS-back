import { Request, Response } from "express";
import Projeto, { StatusProjeto } from "../entities/Projeto.entity"; // Assumindo que Projeto.entity.ts existe
import * as jwt from "jsonwebtoken";
import ImagemProjeto from "../entities/ImagemProjeto.entity"; // Verifique se o caminho está correto
import sequelize from "../config/database";
import fs from "fs/promises";
import path from "path";
import EmailService from "../utils/EmailService";
import ProjetoService from "../services/ProjetoService";
import Avaliacao from "../entities/Avaliacao.entity";
import Usuario from "../entities/Usuario.entity";

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Senha@Forte123";
const JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "seu-segredo-admin-super-secreto";

export class AdminController {
  static async login(req: Request, res: Response) {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ username, role: "admin" }, JWT_SECRET, {
        expiresIn: "8h",
      });
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
        as: "projetoImg", // Alias correto para a associação Projeto <-> ImagemProjeto
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
      // *** VARIÁVEL DE RESPOSTA INICIALIZADA ***
      let responseMessage = "Solicitação aprovada com sucesso.";

      const projeto = await Projeto.findByPk(id, {
        transaction,
        // Inclui ImagemProjeto para lidar com a atualização de imagens
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

            // *** CORREÇÃO: Inicializa vazio para atualização seletiva ***
            const dadosParaAtualizar: Partial<Projeto> & {
              [key: string]: any;
            } = {};

            // *** CORREÇÃO: Define campos permitidos (ajuste conforme seu modelo Projeto) ***
            const camposPermitidos: (keyof Projeto | string)[] = [
              // Use `keyof Projeto` se tiver a definição
              "prefeitura",
              "secretaria",
              "responsavel",
              "nomeProjeto",
              "descricaoDiferencial",
              "responsavelProjeto",
              "emailContato",
              "telefoneContato",
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
            ];

            // *** CORREÇÃO: Copia apenas os campos permitidos e existentes ***
            for (const key of camposPermitidos) {
              // Verifica se a chave existe em dadosRecebidos e não é nula/undefined
              if (
                dadosRecebidos.hasOwnProperty(key) &&
                dadosRecebidos[key] != null
              ) {
                // Atribui o valor ao objeto de atualização
                (dadosParaAtualizar as any)[key] = dadosRecebidos[key];
              }
            }

            // Lógica para LOGO (mantida e ajustada)
            if (dadosRecebidos.logo) {
              const logoAntigaUrl = projeto.logoUrl;
              if (logoAntigaUrl) {
                try {
                  const filePath = path.join(
                    __dirname,
                    "..",
                    "..",
                    logoAntigaUrl
                  );
                  await fs.unlink(filePath);
                } catch (err) {
                  console.error(
                    `AVISO: Falha ao deletar logo antiga: ${logoAntigaUrl}`,
                    err
                  );
                }
              }
              dadosParaAtualizar.logoUrl = dadosRecebidos.logo;
            }

            // Lógica para IMAGENS (mantida e ajustada para ImagemProjeto)
            if (
              dadosRecebidos.imagens && // O campo em dados_atualizacao chama-se 'imagens'
              Array.isArray(dadosRecebidos.imagens) &&
              dadosRecebidos.imagens.length > 0
            ) {
              // Busca imagens antigas DENTRO da transação
              const imagensAntigas = await ImagemProjeto.findAll({
                where: { projetoId: projeto.projetoId }, // Usa projetoId
                transaction,
              });

              // Deleta arquivos antigos
              for (const imagem of imagensAntigas) {
                try {
                  const filePath = path.join(__dirname, "..", "..", imagem.url);
                  await fs.unlink(filePath);
                } catch (err) {
                  console.error(
                    `AVISO: Falha ao deletar imagem antiga: ${imagem.url}`,
                    err
                  );
                }
              }

              // Deleta referências antigas no banco (DENTRO da transação)
              await ImagemProjeto.destroy({
                where: { projetoId: projeto.projetoId }, // Usa projetoId
                transaction,
              });

              // Cria novas referências no banco (DENTRO da transação)
              const novasImagens = dadosRecebidos.imagens.map(
                (url: string) => ({
                  url,
                  projetoId: projeto.projetoId, // Usa projetoId
                })
              );
              await ImagemProjeto.bulkCreate(novasImagens, { transaction });
            }

            // Atualiza status e limpa dados temporários
            dadosParaAtualizar.dados_atualizacao = null;
            dadosParaAtualizar.status = StatusProjeto.ATIVO;
            dadosParaAtualizar.ativo = true; // Garante ativação

            // Aplica mudanças no banco com dados filtrados
            await projeto.update(dadosParaAtualizar, { transaction });
          } else {
            // Caso não haja dados, apenas reativa
            projeto.dados_atualizacao = null;
            projeto.status = StatusProjeto.ATIVO;
            projeto.ativo = true;
            await projeto.save({ transaction });
          }

          // Prepara email de confirmação de atualização
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
          break; // Fim do case PENDENTE_ATUALIZACAO

        case StatusProjeto.PENDENTE_EXCLUSAO:
          // *** CORREÇÃO LÓGICA EXCLUSÃO ***
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

          await projeto.destroy({ transaction });
          responseMessage = "Projeto excluído com sucesso.";

          break;
      }

      // *** CORREÇÃO LÓGICA EXCLUSÃO: Commit fora do case ***
      await transaction.commit();

      // Envio de e-mail após o commit
      if (emailInfo && projeto.emailContato) {
        // Verifica email antes de enviar
        try {
          await EmailService.sendGenericEmail({
            to: projeto.emailContato, // Usa o campo de email correto do Projeto
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(
            `Email de notificação enviado com sucesso para ${projeto.emailContato}`
          );
        } catch (error) {
          console.error(
            `Falha ao enviar email de notificação para ${projeto.emailContato}:`,
            error
          );
        }
      } else if (emailInfo) {
        console.warn(
          `Tentativa de enviar email para projeto ID ${projeto.projetoId} sem emailContato definido.`
        );
      }

      // *** RESPOSTA FINAL USA A VARIÁVEL ***
      return res.status(200).json({ message: responseMessage }); // Usa a variável de mensagem
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A APROVAÇÃO:", error);
      // TODO: Considerar deletar arquivos movidos/criados antes do erro no rollback, se aplicável.
      return res
        .status(500)
        .json({ message: "Erro ao aprovar a solicitação." });
    }
  }

  static async editAndApproveRequest(req: Request, res: Response) {
    const { id } = req.params;
    const adminEditedData = req.body; // Dados finais editados pelo admin
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
      const dadosPendentes = projeto.dados_atualizacao || {};

      // 1. LÓGICA DE MANIPULAÇÃO DE ARQUIVOS (copiada de 'approveRequest')
      // Esta lógica ainda se baseia no que o *usuário* enviou em 'dados_atualizacao'
      // O admin não pode enviar NOVOS arquivos por este formulário, apenas editar texto.

      if (
        statusOriginal === StatusProjeto.PENDENTE_ATUALIZACAO &&
        projeto.dados_atualizacao
      ) {
        const dadosRecebidos = projeto.dados_atualizacao as any;

        // Lógica para LOGO (se o usuário enviou uma nova)
        if (dadosRecebidos.logo) {
          const logoAntigaUrl = projeto.logoUrl;
          if (logoAntigaUrl) {
            try {
              const filePath = path.join(__dirname, "..", "..", logoAntigaUrl);
              await fs.unlink(filePath);
            } catch (err) {
              console.error(
                `AVISO: Falha ao deletar logo antiga: ${logoAntigaUrl}`,
                err
              );
            }
          }
          // Importante: Nós garantimos que a nova logoUrl seja mantida
          adminEditedData.logoUrl = dadosRecebidos.logo;
        }

        // Lógica para IMAGENS (se o usuário enviou novas)
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
                err
              );
            }
          }

          await ImagemProjeto.destroy({
            where: { projetoId: projeto.projetoId },
            transaction,
          });

          const novasImagens = dadosRecebidos.imagens.map((url: string) => ({
            url,
            projetoId: projeto.projetoId,
          }));
          await ImagemProjeto.bulkCreate(novasImagens, { transaction });
        }
      }

      // 2. APLICA AS ALTERAÇÕES FINAIS (Texto do Admin + Arquivos do Usuário)
      // O adminEditedData já vem com os textos alterados.
      // E nós acabamos de adicionar 'logoUrl' a ele, se estava pendente.
      await projeto.update(
        {
          ...adminEditedData, // Aplica todas as edições de texto do admin
          status: StatusProjeto.ATIVO,
          ativo: true,
          dados_atualizacao: null, // Limpa os dados pendentes
        },
        { transaction }
      );

      // 3. LÓGICA DE E-MAIL (copiada de 'approveRequest')
      if (statusOriginal === StatusProjeto.PENDENTE_APROVACAO) {
        emailInfo = {
          subject: "Seu cadastro no Aqui Tem ODS foi Aprovado!",
          html: `<h1>Olá, ${projeto.prefeitura}!</h1> <p>Temos uma ótima notícia: o seu projeto, <strong>${projeto.nomeProjeto}</strong>, foi aprovado e já está visível na nossa plataforma!</p><p>O ID do seu projeto é: <strong>${projeto.projetoId}</strong>.<p><strong>Atenção:</strong> É muito importante que você guarde este número de ID em um local seguro. Ele será <strong>necessário</strong> sempre que você precisar solicitar uma <strong>atualização</strong> ou a <strong>exclusão</strong> do seu projeto em nossa plataforma. Sem ele, não será possível realizar essas ações.</p><p>Agradecemos por fazer parte do Aqui Tem ODS.</p><br><p>Atenciosamente,</p><p><strong>Equipe Aqui Tem ODS.</strong></p>`,
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
      // (Não há e-mail para PENDENTE_EXCLUSAO, pois não permitiremos editar e aprovar exclusão)

      await transaction.commit();

      // Envio de e-mail após o commit
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
            error
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
      // Reutiliza a lógica que já existe no seu ProjetoService
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
    const transaction = await sequelize.transaction();

    try {
      const projeto = await Projeto.findByPk(id, { transaction });

      if (!projeto) {
        await transaction.rollback();
        return res.status(404).json({ message: "Projeto não encontrado." });
      }

      // Remove campos que não devem ser atualizados diretamente
      delete adminEditedData.projetoId;
      delete adminEditedData.status;
      delete adminEditedData.ativo;
      delete adminEditedData.dados_atualizacao;

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
    res: Response
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

      // Deleta o projeto do banco de dados
      await projeto.destroy();

      // Retorna 204 No Content (sucesso, sem corpo de resposta)
      // Isso é o correto para um DELETE e não causará o erro de JSON
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
    const transaction = await sequelize.transaction(); // Usa transação
    try {
      const projeto = await Projeto.findByPk(id, { transaction });
      if (!projeto) {
        await transaction.rollback();
        return res.status(404).json({ message: "Projeto não encontrado." });
      }

      let responseMessage = "Solicitação rejeitada com sucesso.";
      let emailInfo: { subject: string; html: string } | null = null;
      const emailParaNotificar = projeto.emailContato; // Guarda antes de modificar

      if (projeto.status === StatusProjeto.PENDENTE_APROVACAO) {
        // TODO: Adicionar lógica para deletar arquivos (logo, imagens) associados a ESTE projeto
        // antes de destruir o registro no banco.
        // Ex: if (projeto.logoUrl) await fs.unlink(...).catch(e => console.error(e));
        // const imagens = await ImagemProjeto.findAll({ where: { projetoId: projeto.projetoId }, transaction });
        // for (const img of imagens) { await fs.unlink(...).catch(e => console.error(e)); }
        // await ImagemProjeto.destroy({ where: { projetoId: projeto.projetoId }, transaction });

        await projeto.destroy({ transaction });
        responseMessage = "Cadastro de projeto rejeitado e removido.";

        emailInfo = {
          subject: "Seu cadastro no Aqui Tem ODS foi Rejeitado",
          html: `<h1>Olá, ${projeto.prefeitura}.</h1><p>Lamentamos informar que o cadastro do projeto <strong>${projeto.nomeProjeto}</strong> não foi aprovado.</p><p>Recomendamos verificar os dados fornecidos ou entrar em contato conosco para mais informações.</p><br><p>Atenciosamente,</p><p><strong>Equipe Aqui Tem ODS</strong></p>`,
        };
      } else if (
        projeto.status === StatusProjeto.PENDENTE_ATUALIZACAO ||
        projeto.status === StatusProjeto.PENDENTE_EXCLUSAO
      ) {
        // TODO: Adicionar lógica para deletar os arquivos temporários que estavam em `dados_atualizacao`, se houver.
        // Ex: const dadosRejeitados = projeto.dados_atualizacao as any;
        // if (dadosRejeitados?.logo) await fs.unlink(...).catch(e => console.error(e));
        // if (dadosRejeitados?.imagens) { for (const url of dadosRejeitados.imagens) { await fs.unlink(...).catch(e => console.error(e)); } }

        const statusAnterior = projeto.status; // Guarda para o email
        projeto.status = StatusProjeto.ATIVO;
        projeto.dados_atualizacao = null;
        await projeto.save({ transaction }); // Salva dentro da transação

        // Email para atualização/exclusão rejeitada
        if (statusAnterior === StatusProjeto.PENDENTE_ATUALIZACAO) {
          emailInfo = {
            subject:
              "Sua solicitação de atualização no Aqui Tem ODS foi Rejeitada",
            html: `<h1>Olá, ${projeto.prefeitura}.</h1><p>Informamos que a sua solicitação para atualizar os dados do projeto <strong>${projeto.nomeProjeto}</strong> não foi aprovada.</p><p>Os dados anteriores foram mantidos. Entre em contato conosco se precisar de esclarecimentos.</p><br><p>Atenciosamente,</p><p><strong>Equipe Aqui Tem ODS</strong></p>`,
          };
        } else {
          // PENDENTE_EXCLUSAO
          emailInfo = {
            subject:
              "Sua solicitação de exclusão no Aqui Tem ODS foi Rejeitada",
            html: `<h1>Olá, ${projeto.prefeitura}.</h1><p>Informamos que a sua solicitação para remover o projeto <strong>${projeto.nomeProjeto}</strong> não foi aprovada.</p><p>Seu projeto continua ativo na plataforma. Entre em contato conosco se precisar de esclarecimentos.</p><br><p>Atenciosamente,</p><p><strong>Equipe Aqui Tem ODS</strong></p>`,
          };
        }
      } else {
        await transaction.rollback();
        return res.status(400).json({
          message: "O projeto não está em um estado pendente para rejeição.",
        });
      }

      await transaction.commit(); // Comita as alterações

      // Envio do e-mail de rejeição (fora da transação)
      if (emailInfo && emailParaNotificar) {
        try {
          await EmailService.sendGenericEmail({
            to: emailParaNotificar,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(
            `Email de rejeição enviado com sucesso para ${emailParaNotificar}`
          );
        } catch (error) {
          console.error(
            `Falha ao enviar email de rejeição para ${emailParaNotificar}:`,
            error
          );
        }
      }

      return res.status(200).json({ message: responseMessage });
    } catch (error) {
      await transaction.rollback(); // Rollback em caso de erro inesperado
      console.error("Erro ao rejeitar a solicitação:", error);
      // TODO: Considerar deletar arquivos temporários aqui também, se aplicável
      return res
        .status(500)
        .json({ message: "Erro ao rejeitar a solicitação." });
    }
  }

  static async getAvaliacoesByProjeto(req: Request, res: Response) {
    // <--- NOME MUDOU
    try {
      const { projetoId } = req.params; // <--- PEGA O ID DA URL

      // 1. Busca o projeto para termos o nome e para validar
      const projeto = await Projeto.findByPk(projetoId, {
        attributes: ["projetoId", "nomeProjeto", "ods"],
      });

      if (!projeto) {
        return res.status(404).json({ message: "Projeto não encontrado." });
      }

      // 2. Busca as avaliações DAQUELE projeto
      const avaliacoes = await Avaliacao.findAll({
        where: { projetoId: projetoId, parent_id: null }, // <--- FILTRO AQUI
        include: [
          {
            model: Usuario,
            as: "usuario",
            attributes: ["usuarioId", "nomeCompleto", "email"],
          },
          {
            // 2. Incluir as respostas
            model: Avaliacao,
            as: "respostas",
            required: false,
            include: [
              {
                // 3. E o usuário da resposta
                model: Usuario,
                as: "usuario",
                attributes: ["usuarioId", "nomeCompleto", "email"],
              },
            ],
          },
        ],
        order: [
          ["avaliacoesId", "DESC"], // Pais mais novos primeiro
          [{ model: Avaliacao, as: "respostas" }, "avaliacoesId", "ASC"], // Respostas em ordem cronológica
        ],
      });

      // 3. Retorna o projeto e suas avaliações
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

      // Admin não precisa de verificação de propriedade, apenas exclui
      await avaliacao.destroy();

      return res
        .status(200)
        .json({ message: "Avaliação excluída com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir avaliação (admin):", error);
      return res.status(500).json({ message: "Erro ao excluir a avaliação." });
    }
  }
}
