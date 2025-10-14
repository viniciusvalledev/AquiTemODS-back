import { Op } from "sequelize";
import sequelize from "../config/database";
import Estabelecimento, {
  StatusEstabelecimento,
} from "../entities/Estabelecimento.entity";
import ImagemProduto from "../entities/ImagemProduto.entity";
import Avaliacao from "../entities/Avaliacao.entity";
import CnpjService from "./CnpjService";

class EstabelecimentoService {
  public async cadastrarEstabelecimentoComImagens(
    dados: any
  ): Promise<Estabelecimento> {
    if (!dados.cnpj) {
      throw new Error("O campo CNPJ é obrigatório.");
    }

    try {
      const dadosCnpj = await CnpjService.consultarCnpj(dados.cnpj);
      if (dadosCnpj.opcao_pelo_mei !== true) {
        throw new Error(
          `O CNPJ não corresponde a um MEI. O porte identificado foi: "${dadosCnpj.porte}".`
        );
      }
      const situacao = String(dadosCnpj.situacao_cadastral);

      if (situacao !== "ATIVA" && situacao !== "2") {
        const mapaStatus: { [key: string]: string } = {
          "1": "NULA",
          "01": "NULA",
          "3": "SUSPENSA",
          "03": "SUSPENSA",
          "4": "INAPTA",
          "04": "INAPTA",
          "8": "BAIXADA",
          "08": "BAIXADA",
        };
        const statusLegivel = mapaStatus[situacao] || situacao;

        throw new Error(
          `O CNPJ está com a situação "${statusLegivel}". Apenas CNPJs com situação "ATIVA" são permitidos. Em caso de dúvidas, entre em contato com a Sala do Empreendedor.`
        );
      }

      const nomeCidade = dadosCnpj.municipio?.toUpperCase();
      if (nomeCidade !== "SAQUAREMA") {
        throw new Error(
          `Este CNPJ pertence à cidade de ${
            dadosCnpj.municipio || "desconhecida"
          }. Apenas CNPJs de Saquarema são permitidos. Em caso de dúvidas, entre em contato com a Sala do Empreendedor.`
        );
      }
    } catch (error: any) {
      throw new Error(error.message);
    }

    const transaction = await sequelize.transaction();
    try {
      const emailExistente = await Estabelecimento.findOne({
        where: { emailEstabelecimento: dados.emailEstabelecimento },
        transaction,
      });
      if (emailExistente) {
        throw new Error("E-mail já cadastrado no sistema.");
      }

      const cnpjExistente = await Estabelecimento.findOne({
        where: { cnpj: dados.cnpj },
        transaction,
      });
      if (cnpjExistente) {
        throw new Error("CNPJ já cadastrado no sistema.");
      }

      // *** CORREÇÃO APLICADA AQUI ***
      // Criamos um objeto apenas com os campos que o modelo Estabelecimento espera.
      const dadosParaCriacao = {
        nomeFantasia: dados.nomeFantasia,
        cnpj: dados.cnpj,
        categoria: dados.categoria,
        nomeResponsavel: dados.nome_responsavel,
        cpfResponsavel: dados.cpf_responsavel,
        cnae: dados.cnae,
        emailEstabelecimento: dados.emailEstabelecimento,
        contatoEstabelecimento: dados.contatoEstabelecimento,
        endereco: dados.endereco,
        descricao: dados.descricao,
        descricaoDiferencial: dados.descricaoDiferencial,
        areasAtuacao: dados.areasAtuacao,
        tagsInvisiveis: dados.tagsInvisiveis,
        website: dados.website,
        instagram: dados.instagram,
        logoUrl: dados.logo,
        ccmeiUrl: dados.ccmei,
      };

      const estabelecimento = await Estabelecimento.create(dadosParaCriacao, {
        transaction,
      });

      if (dados.produtos && dados.produtos.length > 0) {
        const imagens = dados.produtos.map((url: string) => ({
          url,
          estabelecimentoId: estabelecimento.estabelecimentoId,
        }));
        await ImagemProduto.bulkCreate(imagens, { transaction });
      }

      await transaction.commit();
      return estabelecimento;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async solicitarAtualizacaoPorCnpj(
    cnpj: string,
    dadosAtualizacao: any
  ): Promise<Estabelecimento> {
    const estabelecimento = await Estabelecimento.findOne({ where: { cnpj } });

    if (!estabelecimento) {
      throw new Error("Estabelecimento não encontrado.");
    }

    estabelecimento.status = StatusEstabelecimento.PENDENTE_ATUALIZACAO;
    estabelecimento.dados_atualizacao = dadosAtualizacao;
    await estabelecimento.save();

    return estabelecimento;
  }

  public async solicitarExclusaoPorCnpj(
    cnpj: string,
    motivo: string
  ): Promise<void> {
    const estabelecimento = await Estabelecimento.findOne({ where: { cnpj } });

    if (!estabelecimento) {
      throw new Error("Estabelecimento não encontrado.");
    }

    estabelecimento.status = StatusEstabelecimento.PENDENTE_EXCLUSAO;
    estabelecimento.dados_atualizacao = { motivo: motivo };
    await estabelecimento.save();
  }

  public async listarTodos(): Promise<Estabelecimento[]> {
    return Estabelecimento.findAll({
      where: {
        status: StatusEstabelecimento.ATIVO,
      },
      include: [
        {
          model: ImagemProduto,
          as: "produtosImg",
          attributes: ["url"],
        },
      ],
    });
  }

  public async buscarPorNome(nome: string): Promise<Estabelecimento[]> {
    return Estabelecimento.findAll({
      where: {
        nomeFantasia: {
          [Op.like]: `%${nome}%`,
        },
        status: StatusEstabelecimento.ATIVO,
      },
      include: [
        {
          model: ImagemProduto,
          as: "produtosImg",
          attributes: ["url"],
        },
      ],
    });
  }

  public async buscarPorId(id: number): Promise<Estabelecimento | null> {
    return Estabelecimento.findOne({
      where: {
        estabelecimentoId: id,
        status: StatusEstabelecimento.ATIVO,
      },
      include: [
        {
          model: ImagemProduto,
          as: "produtosImg",
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
  ): Promise<Estabelecimento> {
    const estabelecimento = await Estabelecimento.findByPk(id);
    if (!estabelecimento) {
      throw new Error("Estabelecimento não encontrado.");
    }
    estabelecimento.ativo = ativo;
    await estabelecimento.save();
    return estabelecimento;
  }

  public async listarPendentes(): Promise<{
    cadastros: Estabelecimento[];
    atualizacoes: Estabelecimento[];
    exclusoes: Estabelecimento[];
  }> {
    const commonOptions = {
      include: [
        {
          model: ImagemProduto,
          as: "produtosImg", // ESSA ASSOCIAÇÃO É CRUCIAL
          attributes: ["url"],
        },
      ],
    };

    const cadastros = await Estabelecimento.findAll({
      where: { status: StatusEstabelecimento.PENDENTE_APROVACAO },
      ...commonOptions,
    });

    const atualizacoes = await Estabelecimento.findAll({
      where: { status: StatusEstabelecimento.PENDENTE_ATUALIZACAO },
      ...commonOptions,
    });

    const exclusoes = await Estabelecimento.findAll({
      where: { status: StatusEstabelecimento.PENDENTE_EXCLUSAO },
      ...commonOptions,
    });

    return { cadastros, atualizacoes, exclusoes };
  }
}

export default new EstabelecimentoService();
