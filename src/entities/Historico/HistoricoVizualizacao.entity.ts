import { DataTypes, Model } from "sequelize";
import sequelize from "../../config/database";

class HistoricoVisualizacao extends Model {
  public id!: number;
  public chave!: string;
}

HistoricoVisualizacao.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    chave: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "historico_visualizacoes",
    timestamps: true, // Isso salva automaticamente o createdAt de cada clique
  },
);

export default HistoricoVisualizacao;
