import Usuario from "./Usuario.entity";
import Projeto from "./Projeto.entity";
import Avaliacao from "./Avaliacao.entity";
import ImagemProjeto from "./ImagemProjeto.entity";

Usuario.hasMany(Avaliacao, { foreignKey: "usuarioId", as: "avaliacoes" });
Avaliacao.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

Projeto.hasMany(Avaliacao, {
  foreignKey: "projetoId",
  as: "avaliacoes",
});
Avaliacao.belongsTo(Projeto, {
  foreignKey: "projetoId",
  as: "projeto",
});

Projeto.hasMany(ImagemProjeto, {
  foreignKey: "projetoId",
  as: "projetoImg",
});
ImagemProjeto.belongsTo(Projeto, { foreignKey: "projetoId" });

export { Usuario, Projeto, Avaliacao, ImagemProjeto };
