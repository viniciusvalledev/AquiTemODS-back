import { Request, Response } from "express";
import Estabelecimento, {
  StatusEstabelecimento,
} from "../entities/Estabelecimento.entity";
import * as jwt from "jsonwebtoken";
import ImagemProduto from "../entities/ImagemProduto.entity";
import sequelize from "../config/database"; // Importe a instância do sequelize
import fs from "fs/promises"; // Para deletar arquivos antigos
import path from "path";
import EmailService from "../utils/EmailService";

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
        model: ImagemProduto,
        as: "produtosImg",
        attributes: ["url"],
      };

      const cadastros = await Estabelecimento.findAll({
        where: { status: StatusEstabelecimento.PENDENTE_APROVACAO },
        include: [includeOptions],
      });
      const atualizacoes = await Estabelecimento.findAll({
        where: { status: StatusEstabelecimento.PENDENTE_ATUALIZACAO },
        include: [includeOptions],
      });
      const exclusoes = await Estabelecimento.findAll({
        where: { status: StatusEstabelecimento.PENDENTE_EXCLUSAO },
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
      const estabelecimento = await Estabelecimento.findByPk(id, {
        transaction,
      });
      if (!estabelecimento) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ message: "Estabelecimento não encontrado." });
      }
      let emailInfo: { subject: string; html: string } | null = null;

      switch (estabelecimento.status) {
        case StatusEstabelecimento.PENDENTE_APROVACAO:
          estabelecimento.status = StatusEstabelecimento.ATIVO;
          estabelecimento.ativo = true;
          await estabelecimento.save({ transaction });

          emailInfo = {
            subject: "Seu cadastro no MeideSaquá foi Aprovado!",
            html: `
            <h1>Olá, ${estabelecimento.nomeResponsavel}!</h1>
            <p>Temos uma ótima notícia: o seu estabelecimento, <strong>${estabelecimento.nomeFantasia}</strong>, foi aprovado e já está visível na nossa plataforma!</p>
            <p>A partir de agora, clientes podem encontrar o seu negócio e deixar avaliações.</p>
            <p>Agradecemos por fazer parte da comunidade de empreendedores de Saquarema.</p>
            <br>
            <p>Atenciosamente,</p>
            <p><strong>Equipe MeideSaquá.</strong></p>
          `,
          };
          break;

        case StatusEstabelecimento.PENDENTE_ATUALIZACAO:
          if (estabelecimento.dados_atualizacao) {
            const dadosRecebidos = estabelecimento.dados_atualizacao as any;
            const dadosParaAtualizar: { [key: string]: any } = {
              ...dadosRecebidos,
            };

            // 1. LÓGICA PARA ATUALIZAR A LOGO
            if (dadosRecebidos.logo) {
              const logoAntigaUrl = estabelecimento.logoUrl;
              if (logoAntigaUrl) {
                try {
                  // Deleta o arquivo antigo
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
              // Mapeia o novo caminho para a coluna correta do banco
              dadosParaAtualizar.logoUrl = dadosRecebidos.logo;
              delete dadosParaAtualizar.logo; // Remove a chave antiga
            }

            // 2. LÓGICA PARA ATUALIZAR AS IMAGENS DE PRODUTOS
            if (
              dadosRecebidos.produtos &&
              Array.isArray(dadosRecebidos.produtos)
            ) {
              const imagensAntigas = await ImagemProduto.findAll({
                where: { estabelecimentoId: estabelecimento.estabelecimentoId },
                transaction,
              });

              // Deleta os arquivos antigos
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

              // Deleta as referências antigas no banco
              await ImagemProduto.destroy({
                where: { estabelecimentoId: estabelecimento.estabelecimentoId },
                transaction,
              });

              // Cria as novas referências no banco
              const novasImagens = dadosRecebidos.produtos.map(
                (url: string) => ({
                  url,
                  estabelecimentoId: estabelecimento.estabelecimentoId,
                })
              );
              await ImagemProduto.bulkCreate(novasImagens, { transaction });
              delete dadosParaAtualizar.produtos; // Remove a chave antiga
            }

            // 3. ATUALIZA O STATUS E LIMPA OS DADOS TEMPORÁRIOS
            dadosParaAtualizar.dados_atualizacao = null;
            dadosParaAtualizar.status = StatusEstabelecimento.ATIVO;

            // 4. APLICA TODAS AS MUDANÇAS NO BANCO
            await estabelecimento.update(dadosParaAtualizar, { transaction });
          } else {
            // Caso não hajam dados, apenas reativa
            estabelecimento.dados_atualizacao = null;
            estabelecimento.status = StatusEstabelecimento.ATIVO;
            await estabelecimento.save({ transaction });
          }
          emailInfo = {
            subject:
              "Sua solicitação de atualização no MeideSaquá foi Aprovada!",
            html: `
            <h1>Olá, ${estabelecimento.nomeResponsavel}!</h1>
            <p>A sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> foi aprovada.</p>
            <p>As novas informações já estão visíveis para todos na plataforma.</p>
            <br>
            <p>Atenciosamente,</p>
            <p><strong>Equipe MeideSaquá</strong></p>
          `,
          };
          break;

        case StatusEstabelecimento.PENDENTE_EXCLUSAO:
          emailInfo = {
            subject:
              "Seu estabelecimento foi removido da plataforma MeideSaquá",
            html: `
            <h1>Olá, ${estabelecimento.nomeResponsavel}.</h1>
            <p>Informamos que a sua solicitação para remover o estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> da nossa plataforma foi concluída com sucesso.</p>
            <p>Lamentamos a sua partida e esperamos poder colaborar com você novamente no futuro.</p>
            <br>
            <p>Atenciosamente,</p>
            <p><strong>Equipe MeideSaquá</strong></p>
          `,
          };
          await estabelecimento.destroy({ transaction });
          await transaction.commit(); // Commit antes de retornar
          return res
            .status(200)
            .json({ message: "Estabelecimento excluído com sucesso." });
      }

      // Se tudo deu certo, efetiva as mudanças
      await transaction.commit();

      if (emailInfo) {
        try {
          await EmailService.sendGenericEmail({
            to: estabelecimento.emailEstabelecimento,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(
            `Email de notificação enviado com sucesso para ${estabelecimento.emailEstabelecimento}`
          );
        } catch (error) {
          console.error(
            `Falha ao enviar email de notificação para ${estabelecimento.emailEstabelecimento}:`,
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
      const estabelecimento = await Estabelecimento.findByPk(id);
      if (!estabelecimento) {
        return res
          .status(404)
          .json({ message: "Estabelecimento não encontrado." });
      }

      if (estabelecimento.status === StatusEstabelecimento.PENDENTE_APROVACAO) {
        await estabelecimento.destroy();
      } else {
        estabelecimento.status = StatusEstabelecimento.ATIVO;
        estabelecimento.dados_atualizacao = null;
      }

      await estabelecimento.save();
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
