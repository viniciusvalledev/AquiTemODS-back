import { Op } from "sequelize";
import sequelize from "../config/database";
import Projeto, { StatusProjeto } from "../entities/Projeto.entity";
import ImagemProjeto from "../entities/ImagemProjeto.entity";
import Avaliacao from "../entities/Avaliacao.entity";
import Usuario from "../entities/Usuario.entity"; // Verifique se esta importação está correta e o ficheiro existe

class ProjetoService {
  public async cadastrarProjetoComImagens(dados: any): Promise<Projeto> {
    const transaction = await sequelize.transaction();
    try {
      const dadosParaCriacao = {
        nomeProjeto: dados.nomeProjeto,
        linkProjeto: dados.linkProjeto,
        ods: dados.ods,
        prefeitura: dados.prefeitura,
        secretaria: dados.secretaria,
        responsavelProjeto: dados.responsavelProjeto,
        emailContato: dados.emailContato,
        endereco: dados.endereco,
        descricao: dados.descricao,
        venceuPspe: dados.venceuPspe === "true",
        descricaoDiferencial: dados.descricaoDiferencial,
        odsRelacionadas: dados.odsRelacionadas,
        website: dados.website,
        instagram: dados.instagram,
        logoUrl: dados.logo,
        apoio_planejamento: dados.apoio_planejamento,
        escala: dados.escala,
      };

      const nomeProjeto = dados.nomeProjeto;
      if (!nomeProjeto) {
        throw new Error("O nome do projeto é um campo obrigatório.");
      }

      const projetoExistente = await Projeto.findOne({
        where: {
          [Op.and]: [
            sequelize.where(
              sequelize.fn("LOWER", sequelize.col("nome_projeto")),
              sequelize.fn("LOWER", nomeProjeto)
            ),
          ],
        },
        transaction,
      });

      if (projetoExistente) {
        throw new Error("Já existe um projeto cadastrado com este nome.");
      }

      const projeto = await Projeto.create(dadosParaCriacao, {
        transaction,
      });

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

  public async solicitarExclusaoPorId(
    id: number,
    dadosExclusao: any
  ): Promise<void> {
    const projeto = await Projeto.findByPk(id);

    if (!projeto) {
      throw new Error("Projeto não encontrado.");
    }

    projeto.status = StatusProjeto.PENDENTE_EXCLUSAO;

    projeto.dados_atualizacao = dadosExclusao;

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

  // --- MÉTODO CORRIGIDO E ADICIONADO ---
  public async buscarPorNomeUnico(nome: string): Promise<Projeto | null> {
    // --- LOG 4: INÍCIO DA BUSCA NO SERVICE ---

    try {
      const projeto = await Projeto.findOne({
        where: {
          [Op.and]: [
            sequelize.where(
              sequelize.fn("LOWER", sequelize.col("nome_projeto")),
              sequelize.fn("LOWER", nome)
            ),
            { status: "ativo" },
          ],
        },
        // Adicionando um log da query gerada pelo Sequelize
      });

      // --- LOG 5: RESULTADO DA BUSCA PRINCIPAL ---
      if (!projeto) {
        console.log(
          "[SERVICE] BUSCA PRINCIPAL: Nenhum projeto encontrado com os critérios. Retornando null."
        );
        return null;
      }

      // Carregar associações separadamente

      const imagens = await ImagemProjeto.findAll({
        where: { projetoId: projeto.projetoId },
      });

      const avaliacoes = await Avaliacao.findAll({
        where: {
          projetoId: projeto.projetoId,
          parent_id: null, // <-- BUSCA SÓ OS COMENTÁRIOS-PAI
        },
        include: [
          {
            model: Usuario,
            as: "usuario",
            attributes: ["nomeCompleto", "usuarioId"],
          },
          {
            // <-- ADICIONADO: Inclui as respostas
            model: Avaliacao,
            as: "respostas",
            required: false,
            include: [
              {
                // E o usuário da resposta
                model: Usuario,
                as: "usuario",
                attributes: ["nomeCompleto", "usuarioId"],
              },
            ],
          },
        ],
        order: [
          ["avaliacoesId", "DESC"], // Pais mais novos primeiro
          [{ model: Avaliacao, as: "respostas" }, "avaliacoesId", "ASC"], // Respostas em ordem cronológica
        ],
      });

      const projetoJSON = projeto.toJSON();
      (projetoJSON as any).projetoImg = imagens;
      (projetoJSON as any).avaliacoes = avaliacoes;

      if (avaliacoes && avaliacoes.length > 0) {
        const somaDasNotas = avaliacoes.reduce(
          (acc, avaliacao) => acc + (avaliacao.nota || 0),
          0
        );
        (projetoJSON as any).media = parseFloat(
          (somaDasNotas / avaliacoes.length).toFixed(1)
        );
      } else {
        (projetoJSON as any).media = 0;
      }
      return projetoJSON as Projeto;
    } catch (error) {
      // --- LOG DE ERRO NO SERVICE ---
      console.error(
        "[SERVICE] Ocorreu um erro durante a busca no banco de dados:",
        error
      );
      throw error; // Lança o erro para o controller lidar com ele
    }
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

  public async buscarPorOds(ods: string): Promise<Projeto[]> {
    if (!ods) {
      return [];
    }
    const projetos = await Projeto.findAll({
      where: {
        ods: ods,
        status: StatusProjeto.ATIVO,
      },
      order: [["nomeProjeto", "ASC"]],

      include: [
        {
          model: ImagemProjeto,
          as: "projetoImg",
          attributes: ["url"],
        },
      ],
    });
    return projetos;
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
