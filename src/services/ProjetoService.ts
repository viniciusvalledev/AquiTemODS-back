import { Op } from "sequelize";
import { Projeto, ImagemProduto, Avaliacao } from "../entities";
import sequelize from "../config/database";
import { StatusProjeto } from "../entities/Projeto.entity";

class ProjetoService {
  public async cadastrarProjetoComImagens(dto: any) {
    const { produtos, ...dadosProjeto } = dto;
    const novoProjeto = await Projeto.create({
      ...dadosProjeto,
      logoUrl: dadosProjeto.logo,
    });

    if (produtos && produtos.length > 0) {
      const imagensPromises = produtos.map((urlDaImagem: string) => {
        return ImagemProduto.create({
          url: urlDaImagem,
          projetoId: novoProjeto.projetoId,
        });
      });
      await Promise.all(imagensPromises);
    }

    return novoProjeto;
  }
  
  public async solicitarAtualizacao(id: number, dadosAtualizacao: any) {
    if (dadosAtualizacao.descricao && dadosAtualizacao.descricao.length > 500) {
        throw new Error("Data too long for column 'descricao'");
    }
    if (dadosAtualizacao.descricaoDiferencial && dadosAtualizacao.descricaoDiferencial.length > 130) {
        throw new Error("Data too long for column 'descricao_diferencial'");
    }

    const projeto = await Projeto.findByPk(id);

    if (!projeto) {
      throw new Error("Projeto não encontrado com o ID fornecido.");
    }

    if (projeto.status !== StatusProjeto.ATIVO) {
      throw new Error("Não é possível solicitar atualização para um projeto que não está ativo.");
    }
    
    projeto.dados_atualizacao = dadosAtualizacao;
    projeto.status = StatusProjeto.PENDENTE_ATUALIZACAO;

    return await projeto.save({ fields: ["dados_atualizacao", "status"] });
  }

  public async solicitarExclusao(id: number) {
    const projeto = await Projeto.findByPk(id);

    if (!projeto) {
      throw new Error("Projeto não encontrado com o ID fornecido.");
    }

    if (projeto.status !== StatusProjeto.ATIVO) {
      throw new Error("Não é possível solicitar exclusão para um projeto que não está ativo.");
    }
    
    projeto.status = StatusProjeto.PENDENTE_EXCLUSAO;

    return await projeto.save({ fields: ["status"] });
  }

  public async listarTodos() {
    return Projeto.findAll({
      where: { status: StatusProjeto.ATIVO },
      include: [
        { model: ImagemProduto, as: "produtosImg", attributes: [] },
        { model: Avaliacao, as: "avaliacoes", attributes: [] },
      ],
      attributes: {
        include: [
          [sequelize.fn("AVG", sequelize.col("avaliacoes.nota")), "media"],
          [sequelize.fn("GROUP_CONCAT", sequelize.col("produtosImg.url")), "produtosImgUrls"],
        ],
      },
      group: ["Projeto.projeto_id"],
      order: [["projeto_id", "DESC"]],
    });
  }

  public async buscarPorId(id: number) {
    return Projeto.findOne({
      where: { projetoId: id, status: StatusProjeto.ATIVO }, 
      include: [
        { model: ImagemProduto, as: "produtosImg", attributes: [] },
        { model: Avaliacao, as: "avaliacoes", attributes: [] },
      ],
      attributes: {
        include: [
          [sequelize.fn("AVG", sequelize.col("avaliacoes.nota")), "media"],
          [sequelize.fn("GROUP_CONCAT", sequelize.col("produtosImg.url")), "produtosImgUrls"],
        ],
      },
      group: ["Projeto.projeto_id"],
    });
  }

  public async buscarPorNome(nome: string) {
    return Projeto.findAll({
      where: {
        nomeProjeto: { [Op.like]: `%${nome}%` },
        status: StatusProjeto.ATIVO,
      },
      include: [{ model: ImagemProduto, as: "produtosImg" }],
    });
  }

  public async alterarStatusAtivo(id: number, novoStatus: boolean) {
    const projeto = await Projeto.findByPk(id);
    if (!projeto) {
      throw new Error(`Projeto não encontrado com o ID: ${id}`);
    }
    projeto.ativo = novoStatus;
    if (!novoStatus && projeto.status === StatusProjeto.ATIVO) {
        // Lógica futura pode ser adicionada aqui
    }
    return await projeto.save();
  }
}

export default new ProjetoService();