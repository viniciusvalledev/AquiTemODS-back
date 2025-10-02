import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Avaliacao extends Model {
  public avaliacoesId!: number;
  public comentario!: string;
  public nota!: number;
  public usuarioId!: number;
  public projetoId!: number; // Alterado
}

Avaliacao.init({
  avaliacoesId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    field: 'avaliacoes_id'
  },
  comentario: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  nota: {
    type: DataTypes.DOUBLE,
    allowNull: false
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    field: 'usuario_id' 
  },
  projetoId: { // Alterado
    type: DataTypes.INTEGER,
    field: 'projeto_id'
  }
}, {
  sequelize,
  tableName: 'avaliacoes',
  timestamps: false
});

export default Avaliacao;