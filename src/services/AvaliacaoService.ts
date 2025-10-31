import { Avaliacao, Projeto, Usuario } from "../entities";
import ProfanityFilter from "../utils/ProfanityFilter";
import { containsEmoji } from "../utils/ValidationEmoji";

class AvaliacaoService {
  public async submeterAvaliacao(dadosAvaliacao: any, usuarioLogadoId: number) {
    // 1. Obter 'parent_id' junto com os outros dados
    const { nota, comentario, projetoId, parent_id } = dadosAvaliacao;

    // 2. Validações que se aplicam a todos (comentários E respostas)
    if (!projetoId) {
      throw new Error("O ID do projeto é obrigatório.");
    }
    if (ProfanityFilter.contemPalavrao(comentario)) {
      throw new Error("Você utilizou palavras inapropriadas.");
    }
    if (containsEmoji(comentario)) {
      throw new Error("O comentário não pode conter emojis.");
    }

    const projeto = await Projeto.findByPk(projetoId);
    if (!projeto) {
      throw new Error(`Projeto não encontrado com o ID: ${projetoId}`);
    }

    let notaFinal: number | null = nota;

    // 3. Lógica condicional
    if (parent_id) {
      // É UMA RESPOSTA
      notaFinal = null; // Respostas NUNCA têm nota

      // Verifica se o comentário pai existe
      const parentAvaliacao = await Avaliacao.findByPk(parent_id);
      if (!parentAvaliacao) {
        throw new Error("Comentário pai não encontrado.");
      }

      if (parentAvaliacao.parent_id !== null) {
        throw new Error("Não é possível responder a uma resposta.");
      }
    } else {
      // É UM COMENTÁRIO PRINCIPAL

      // 4. Mover a validação da nota PARA DENTRO do 'else'
      if (nota < 1 || nota > 5) {
        throw new Error("A nota da avaliação deve estar entre 1 e 5.");
      }

      // Verifica se o usuário já avaliou este projeto (apenas para comentários principais)
      const avaliacaoExistente = await Avaliacao.findOne({
        where: {
          usuarioId: usuarioLogadoId,
          projetoId: projetoId,
          parent_id: null, // <-- Importante
        },
      });

      if (avaliacaoExistente) {
        throw new Error("Este utilizador já avaliou este Projeto.");
      }
    }

    // 5. Criar a avaliação/resposta
    return Avaliacao.create({
      nota: notaFinal, // Será 'null' para respostas
      comentario,
      projetoId,
      usuarioId: usuarioLogadoId,
      parent_id: parent_id || null, // Salva o ID do pai
    });
  }

  public async atualizarAvaliacao(
    avaliacaoId: number,
    dadosAvaliacao: any,
    usuarioLogadoId: number
  ) {
    const avaliacao = await Avaliacao.findByPk(avaliacaoId);
    if (!avaliacao) {
      throw new Error(`Avaliação não encontrada com o ID: ${avaliacaoId}`);
    }
    if (avaliacao.usuarioId !== usuarioLogadoId) {
      throw new Error("Você não tem permissão para editar esta avaliação.");
    }

    if (
      dadosAvaliacao.comentario &&
      ProfanityFilter.contemPalavrao(dadosAvaliacao.comentario)
    ) {
      throw new Error("Você utilizou palavras inapropriadas.");
    }

    if (
      dadosAvaliacao.nota &&
      (dadosAvaliacao.nota < 1 || dadosAvaliacao.nota > 5)
    ) {
      throw new Error("A nota da avaliação deve estar entre 1 e 5.");
    }

    avaliacao.comentario = dadosAvaliacao.comentario ?? avaliacao.comentario;
    avaliacao.nota = dadosAvaliacao.nota ?? avaliacao.nota;

    return await avaliacao.save();
  }

  public async excluirAvaliacao(avaliacaoId: number, usuarioLogadoId: number) {
    const avaliacao = await Avaliacao.findByPk(avaliacaoId);
    if (!avaliacao) {
      throw new Error(`Avaliação não encontrada com o ID: ${avaliacaoId}`);
    }
    if (avaliacao.usuarioId !== usuarioLogadoId) {
      throw new Error("Você não tem permissão para excluir esta avaliação.");
    }
    await avaliacao.destroy();
  }

  public async listarPorProjetoDTO(projetoId: number) {
    return Avaliacao.findAll({
      where: {
        projetoId,
        parent_id: null, // Buscar APENAS comentários principais
      },
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: {
            exclude: [
              "password",
              "email",
              "cpf",
              "dataNascimento",
              "createdAt",
              "updatedAt",
            ],
          },
        },
        {
          // Inclui as respostas aninhadas
          model: Avaliacao,
          as: "respostas",
          required: false,
          include: [
            {
              // Inclui o usuário da resposta
              model: Usuario,
              as: "usuario",
              attributes: {
                exclude: [
                  /*... (seus excludes)*/
                ],
              },
            },
          ],
        },
      ],
      order: [
        ["avaliacoesId", "DESC"],
        [{ model: Avaliacao, as: "respostas" }, "avaliacoesId", "ASC"],
      ],
    });
  }
}

export default new AvaliacaoService();
