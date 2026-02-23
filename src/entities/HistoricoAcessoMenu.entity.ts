import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

class HistoricoAcessoMenu extends Model {
  public id!: number;
  public chave!: string;
}

HistoricoAcessoMenu.init(
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
    tableName: "historico_acesso_menu",
    timestamps: true,
  },
);

export default HistoricoAcessoMenu;
