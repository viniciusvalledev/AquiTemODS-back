import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

class Curso extends Model {
  public id!: number;
  public titulo!: string;
  public linkDestino!: string;
  public imagemUrl!: string;
  public visualizacoes!: number;
}

Curso.init(
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
    visualizacoes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: "cursos", // Nome da tabela no banco
    timestamps: true,
  }
);

export default Curso;