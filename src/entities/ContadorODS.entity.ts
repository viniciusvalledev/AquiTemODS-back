import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

class ContadorODS extends Model {
  public id!: number;
  public ods!: string;
  public visualizacoes!: number;
}

ContadorODS.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ods: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    visualizacoes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: "ods_visualizacoes",
  }
);

export default ContadorODS;
