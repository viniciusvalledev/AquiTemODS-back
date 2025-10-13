import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class ImagemProduto extends Model {
  public id!: number;
  public url!: string;
  public projetoId!: number; 
}

ImagemProduto.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  projetoId: { // Alterado
    type: DataTypes.INTEGER,
    field: 'projeto_id'
  }
}, {
  sequelize,
  tableName: 'imagens_produto',
  timestamps: false
});

export default ImagemProduto;