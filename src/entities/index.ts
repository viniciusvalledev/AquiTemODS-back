import Usuario from './Usuario.entity';
import Projeto from './Projeto.entity';
import Avaliacao from './Avaliacao.entity';
import ImagemProduto from './ImagemProjeto.entity';

// Relacionamentos
Usuario.hasMany(Avaliacao, { foreignKey: 'usuarioId', as: 'avaliacoes' });
Avaliacao.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

Projeto.hasMany(Avaliacao, { 
    foreignKey: 'projetoId',
    as: 'avaliacoes' 
});
Avaliacao.belongsTo(Projeto, { 
    foreignKey: 'projetoId',
    as: 'projeto' 
});

Projeto.hasMany(ImagemProduto, { 
    foreignKey: 'projetoId',
    as: 'produtosImg' 
});
ImagemProduto.belongsTo(Projeto, { foreignKey: 'projetoId' });

export {
    Usuario,
    Projeto,
    Avaliacao,
    ImagemProduto
};