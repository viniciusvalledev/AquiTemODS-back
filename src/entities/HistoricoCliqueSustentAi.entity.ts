import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

class HistoricoCliqueSustentAi extends Model {
  public id!: number;
  public sustentAiId!: number;
}

HistoricoCliqueSustentAi.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sustentAiId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "sustentai_id",
    },
  },
  {
    sequelize,
    tableName: "historico_cliques_sustentai",
    timestamps: true, // Isso cria a coluna 'createdAt' automaticamente com a data e hora do clique
  },
);

export default HistoricoCliqueSustentAi;
