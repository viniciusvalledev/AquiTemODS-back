import { Op } from "sequelize";
import sequelize from "../config/database";
import Projeto, {
 StatusProjeto,
} from "../entities/Projeto.entity";
import ImagemProjeto from "../entities/ImagemProjeto.entity";
import Avaliacao from "../entities/Avaliacao.entity";
import CnpjService from "./CnpjService";

class ProjetoService {
 public async cadastrarProjetoComImagens(
  dados: any
 ): Promise<Projeto> {
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
   // Captura o erro do CnpjService e o relança.
   throw new Error(error.message);
  }

  const transaction = await sequelize.transaction();
  try {
   const emailExistente = await Projeto.findOne({
    where: { emailProjeto: dados.emailProjeto },
    transaction,
   });
   if (emailExistente) {
    throw new Error("E-mail já cadastrado no sistema.");
   }

   const cnpjExistente = await Projeto.findOne({
    where: { cnpj: dados.cnpj },
    transaction,
   });
   if (cnpjExistente) {
    throw new Error("CNPJ já cadastrado no sistema.");
   }

   const dadosParaCriacao = {
    nomeFantasia: dados.nomeFantasia,
    cnpj: dados.cnpj,
    categoria: dados.categoria,
    nomeResponsavel: dados.nome_responsavel,
    cpfResponsavel: dados.cpf_responsavel,
    cnae: dados.cnae,
    emailProjeto: dados.emailProjeto,
    contatoProjeto: dados.contatoProjeto,
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

   const projeto = await Projeto.create(dadosParaCriacao, { // 'projeto' é a instância criada
    transaction,
   });

  
   if (dados.Projetos && dados.Projetos.length > 0) {
    const imagens = dados.Projetos.map((url: string) => ({
     url,
     projetoId: projeto.projetoId, 
    }));
    await ImagemProjeto.bulkCreate(imagens, { transaction });
   }

   await transaction.commit();
   return projeto; 
  } catch (error) {
   await transaction.rollback();
   throw error;
  }
 }

 public async solicitarAtualizacaoPorCnpj(
  cnpj: string,
  dadosAtualizacao: any
 ): Promise<Projeto> {
  
  const projeto = await Projeto.findOne({ where: { cnpj } });

  if (!projeto) {
   throw new Error("Projeto não encontrado.");
  }

  projeto.status = StatusProjeto.PENDENTE_ATUALIZACAO;
  projeto.dados_atualizacao = dadosAtualizacao;
  await projeto.save();

  return projeto;
 }

 public async solicitarExclusaoPorCnpj(
  cnpj: string,
  motivo: string
 ): Promise<void> {
  
  const projeto = await Projeto.findOne({ where: { cnpj } });

  if (!projeto) {
   throw new Error("Projeto não encontrado.");
  }

  projeto.status = StatusProjeto.PENDENTE_EXCLUSAO;
  projeto.dados_atualizacao = { motivo: motivo };
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
     as: "ProjetosImg",
     attributes: ["url"],
    },
   ],
  });
 }

 public async buscarPorNome(nome: string): Promise<Projeto[]> {
  return Projeto.findAll({
   where: {
    nomeFantasia: {
     [Op.like]: `%${nome}%`,
    },
    status: StatusProjeto.ATIVO,
   },
   include: [
    {
     model: ImagemProjeto,
     as: "ProjetosImg",
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
     as: "ProjetosImg",
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
     as: "ProjetosImg", // ESSA ASSOCIAÇÃO É CRUCIAL
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