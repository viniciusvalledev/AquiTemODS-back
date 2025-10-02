import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export enum StatusProjeto {
  PENDENTE_APROVACAO = "pendente_aprovacao",
  ATIVO = "ativo",
  PENDENTE_ATUALIZACAO = "pendente_atualizacao",
  PENDENTE_EXCLUSAO = "pendente_exclusao",
  REJEITADO = "rejeitado",
}

class Projeto extends Model {
  public projetoId!: number;
  public ods!: string;
  public prefeitura!: string;
  public nomeProjeto!: string;
  public emailContato!: string;
  public endereco!: string;
  public descricao!: string;
  public descricaoDiferencial!: string;
  public odsRelacionadas!: string;
  public website!: string;
  public instagram!: string;
  public logoUrl!: string;
  public ativo!: boolean;
  public status!: StatusProjeto;
  public dados_atualizacao!: object | null;
}

Projeto.init(
  {
    projetoId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "projeto_id",
    },
    ods: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    prefeitura: {
        type: DataTypes.STRING(18),
        allowNull: true,
    },
    nomeProjeto: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "nome_projeto",
    },
    emailContato: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "email_contato",
    },
    endereco: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    descricao: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    descricaoDiferencial: {
      type: DataTypes.STRING(130),
      allowNull: true,
      field: "descricao_diferencial",
    },
    odsRelacionadas: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "ods_relacionadas"
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    instagram: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    logoUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(StatusProjeto)),
      allowNull: false,
      defaultValue: StatusProjeto.PENDENTE_APROVACAO,
    },
    dados_atualizacao: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "projeto", // Nome da tabela no novo banco
    timestamps: true, // Habilitar createdAt e updatedAt
  }
);

export default Projeto;