import { Request, Response } from "express";
import Projeto, { StatusProjeto } from "../entities/Projeto.entity";
import * as jwt from "jsonwebtoken";
import ImagemProjeto from "../entities/ImagemProjeto.entity";
import sequelize from "../config/database";
import fs from "fs/promises";
import path from "path";
import EmailService from "../utils/EmailService";
import ImagemProduto from "../entities/ImagemProjeto.entity";

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
        as: "projetoImg", // <-- ALIAS CORRIGIDO PARA 'projetoImg'
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
      const projeto = await Projeto.findByPk(id, {
        transaction,
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
              <p>O ID do seu projeto é: <strong>${projeto.projetoId}</strong>.<p><strong>Atenção:</strong> É muito importante que você guarde este número de ID em um local seguro. Ele será <strong>necessário</strong> sempre que você precisar solicitar uma <strong>atualização</strong> ou a <strong>exclusão</strong> do seu projeto em nossa plataforma. Sem ele, não será possível realizar essas ações.</p>
              <p>Agradecemos por fazer parte do Aqui Tem ODS.</p>
              <br>
              <p>Atenciosamente,</p>
              <p><strong>Equipe Aqui Tem ODS.</strong></p>
            `,
          };
          break;

        case StatusProjeto.PENDENTE_ATUALIZACAO:
          if (projeto.dados_atualizacao) {
            const dadosRecebidos = projeto.dados_atualizacao as any;
            const dadosParaAtualizar: { [key: string]: any } = {
              ...dadosRecebidos,
            };

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
                    `AVISO: Falha ao deletar arquivo de logo antigo: ${logoAntigaUrl}`,
                    err
                  );
                }
              }
              dadosParaAtualizar.logoUrl = dadosRecebidos.logo;
              delete dadosParaAtualizar.logo;
            }

            if (
              dadosRecebidos.imagens &&
              Array.isArray(dadosRecebidos.imagens)
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
                    `AVISO: Falha ao deletar arquivo antigo: ${imagem.url}`,
                    err
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
                })
              );
              await ImagemProjeto.bulkCreate(novasImagens, { transaction });
              delete dadosParaAtualizar.imagens;
            }

            dadosParaAtualizar.dados_atualizacao = null;
            dadosParaAtualizar.status = StatusProjeto.ATIVO;

            await projeto.update(dadosParaAtualizar, { transaction });
          } else {
            projeto.dados_atualizacao = null;
            projeto.status = StatusProjeto.ATIVO;
            await projeto.save({ transaction });
          }
          emailInfo = {
            subject:
              "Sua solicitação de atualização no Aqui Tem ODS foi Aprovada!",
            html: `
              <h1>Olá, ${projeto.prefeitura}!</h1>
              <p>A sua solicitação para atualizar os dados do projeto <strong>${projeto.nomeProjeto}</strong> foi aprovada.</p>
              <p>As novas informações já estão visíveis para todos na plataforma.</p>
              <p>Relembrando, o ID do seu projeto é: <strong${projeto.projetoId}</strong>.</p>
              <br>
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
              <p><strong>Equipe Aqui Tem ODS</strong></p>
            `,
          };
          await projeto.destroy({ transaction });
          await transaction.commit();
          return res
            .status(200)
            .json({ message: "Projeto excluído com sucesso." });
      }

      await transaction.commit();

      if (emailInfo) {
        try {
          await EmailService.sendGenericEmail({
            to: projeto.emailContato,
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
      }

      return res
        .status(200)
        .json({ message: "Solicitação aprovada com sucesso." });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A APROVAÇÃO:", error);
      return res
        .status(500)
        .json({ message: "Erro ao aprovar a solicitação." });
    }
  }

  static async rejectRequest(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const projeto = await Projeto.findByPk(id);
      if (!projeto) {
        return res.status(404).json({ message: "Projeto não encontrado." });
      }

      if (projeto.status === StatusProjeto.PENDENTE_APROVACAO) {
        await projeto.destroy();
      } else {
        projeto.status = StatusProjeto.ATIVO;
        projeto.dados_atualizacao = null;
      }

      await projeto.save();
      return res
        .status(200)
        .json({ message: "Solicitação rejeitada com sucesso." });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erro ao rejeitar a solicitação." });
    }
  }
}
