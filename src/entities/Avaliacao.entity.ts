import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";
import Usuario from "./Usuario.entity";

class Avaliacao extends Model {
  public avaliacoesId!: number;
  public comentario!: string;
  public nota!: number | null;
  public usuarioId!: number;
  public projetoId!: number;
  public parent_id!: number | null; // <-- Adicionado

  public readonly respostas?: Avaliacao[];
  public readonly pai?: Avaliacao;
  public readonly usuario?: Usuario;
}

Avaliacao.init(
  {
    avaliacoesId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "avaliacoes_id",
    },
    comentario: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    nota: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },

    usuarioId: {
      type: DataTypes.INTEGER,
      field: "usuario_id",
    },
    projetoId: {
      type: DataTypes.INTEGER,
      field: "projeto_id",
    },
    parent_id: {
      // <-- Adicionado
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "parent_id",
      references: {
        model: "avaliacoes", // Nome da tabela
        key: "avaliacoes_id",
      },
    },
  },
  {
    sequelize,
    tableName: "avaliacoes",
    timestamps: false,
  }
);

Avaliacao.hasMany(Avaliacao, {
  as: "respostas",
  foreignKey: "parent_id",
});

// Uma Avaliação (resposta) pertence a uma Avaliação (pai)
Avaliacao.belongsTo(Avaliacao, {
  as: "pai",
  foreignKey: "parent_id",
});

export default Avaliacao;
