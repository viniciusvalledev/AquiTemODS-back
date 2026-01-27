import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

class SustentAi extends Model {
  public id!: number;
  public titulo!: string;
  public linkDestino!: string;
  public imagemUrl!: string;
}

SustentAi.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    titulo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    linkDestino: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "link_destino",
    },
    imagemUrl: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "imagem_url",
    },
  },
  {
    sequelize,
    tableName: "sustentai_cards",
    timestamps: true,
  },
);

export default SustentAi;
