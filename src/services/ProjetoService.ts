import { Op } from "sequelize";
import sequelize from "../config/database";
import Projeto, { StatusProjeto } from "../entities/Projeto.entity";
import ImagemProjeto from "../entities/ImagemProjeto.entity";
import Avaliacao from "../entities/Avaliacao.entity";

class ProjetoService {
  public async cadastrarProjetoComImagens(dados: any): Promise<Projeto> {
    const transaction = await sequelize.transaction();
    try {
      const dadosParaCriacao = {
        nomeProjeto: dados.nomeProjeto,
        ods: dados.ods,
        prefeitura: dados.prefeitura,
        secretaria: dados.secretaria,
        emailContato: dados.emailContato,
        endereco: dados.endereco,
        descricao: dados.descricao,
        descricaoDiferencial: dados.descricaoDiferencial,
        odsRelacionadas: dados.odsRelacionadas,
        website: dados.website,
        instagram: dados.instagram,
        logoUrl: dados.logo, // O 'logo' vem do _moveFilesAndPrepareData
      };

      const projeto = await Projeto.create(dadosParaCriacao, {
        transaction,
      });

      // Salva as imagens do projeto, se houver
      if (dados.imagens && dados.imagens.length > 0) {
        const imagensParaSalvar = dados.imagens.map((url: string) => ({
          url,
          projetoId: projeto.projetoId,
        }));
        await ImagemProjeto.bulkCreate(imagensParaSalvar, { transaction });
      }

      await transaction.commit();
      return projeto;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async buscarPorOds(ods: string): Promise<Projeto[]> {
    if (!ods) {
      // Retorna um array vazio se nenhuma ODS for fornecida
      return [];
    }

    const projetos = await Projeto.findAll({
      where: {
        ods: ods,
        ativo: true, // Garante que apenas projetos ativos sejam retornados
      },
      order: [["nomeProjeto", "ASC"]],
    });

    return projetos;
  }

  public async solicitarAtualizacaoPorId(
    id: number,
    dadosAtualizacao: any
  ): Promise<Projeto> {
    const projeto = await Projeto.findByPk(id);

    if (!projeto) {
      throw new Error("Projeto não encontrado.");
    }

    projeto.status = StatusProjeto.PENDENTE_ATUALIZACAO;
    projeto.dados_atualizacao = dadosAtualizacao;
    await projeto.save();

    return projeto;
  }

  public async solicitarExclusaoPorId(id: number): Promise<void> {
    const projeto = await Projeto.findByPk(id);

    if (!projeto) {
      throw new Error("Projeto não encontrado.");
    }

    projeto.status = StatusProjeto.PENDENTE_EXCLUSAO;
    await projeto.save();
  }

  public async listarTodos(): Promise<Projeto[]> {
    return Projeto.findAll({
      where: {
        status: StatusProjeto.ATIVO,
      },
      include: [
        {
          model: ImagemProjeto,
          as: "projetoImg",
          attributes: ["url"],
        },
      ],
    });
  }

  public async buscarPorNome(nome: string): Promise<Projeto[]> {
    return Projeto.findAll({
      where: {
        nomeProjeto: {
          [Op.like]: `%${nome}%`,
        },
        status: StatusProjeto.ATIVO,
      },
      include: [
        {
          model: ImagemProjeto,
          as: "projetoImg",
          attributes: ["url"],
        },
      ],
    });
  }

  public async buscarPorId(id: number): Promise<Projeto | null> {
    return Projeto.findOne({
      where: {
        projetoId: id,
        status: StatusProjeto.ATIVO,
      },
      include: [
        {
          model: ImagemProjeto,
          as: "projetoImg",
          attributes: ["url"],
        },
        {
          model: Avaliacao,
          as: "avaliacoes",
          attributes: ["nota"],
        },
      ],
    });
  }

  public async alterarStatusAtivo(
    id: number,
    ativo: boolean
  ): Promise<Projeto> {
    const projeto = await Projeto.findByPk(id);
    if (!projeto) {
      throw new Error("Projeto não encontrado.");
    }
    projeto.ativo = ativo;
    await projeto.save();
    return projeto;
  }

  public async listarPendentes(): Promise<{
    cadastros: Projeto[];
    atualizacoes: Projeto[];
    exclusoes: Projeto[];
  }> {
    const commonOptions = {
      include: [
        {
          model: ImagemProjeto,
          as: "projetoImg",
          attributes: ["url"],
        },
      ],
    };

    const cadastros = await Projeto.findAll({
      where: { status: StatusProjeto.PENDENTE_APROVACAO },
      ...commonOptions,
    });

    const atualizacoes = await Projeto.findAll({
      where: { status: StatusProjeto.PENDENTE_ATUALIZACAO },
      ...commonOptions,
    });

    const exclusoes = await Projeto.findAll({
      where: { status: StatusProjeto.PENDENTE_EXCLUSAO },
      ...commonOptions,
    });

    return { cadastros, atualizacoes, exclusoes };
  }
}

export default new ProjetoService();
