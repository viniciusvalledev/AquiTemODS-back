import { Request, Response } from 'express';
import AvaliacaoService from '../services/AvaliacaoService';

interface AuthenticatedRequest extends Request {
    user?: { 
        id: number;
        username: string;
    }
}

class AvaliacaoController {
    public async submeterAvaliacao(req: AuthenticatedRequest, res: Response): Promise<Response> {
        try {
            const usuarioLogadoId = req.user?.id;
            if (!usuarioLogadoId) return res.status(401).json({ message: "Não autorizado" });

            const dadosAvaliacao = { ...req.body, estabelecimentoId: req.body.estabelecimento.estabelecimentoId };
            
            const novaAvaliacao = await AvaliacaoService.submeterAvaliacao(dadosAvaliacao, usuarioLogadoId);
            return res.status(201).json(novaAvaliacao);
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async atualizarAvaliacao(req: AuthenticatedRequest, res: Response): Promise<Response> {
        try {
            const usuarioLogadoId = req.user?.id;
            const avaliacaoId = parseInt(req.params.id);
            if (!usuarioLogadoId) return res.status(401).json({ message: "Não autorizado" });

            const avaliacaoAtualizada = await AvaliacaoService.atualizarAvaliacao(avaliacaoId, req.body, usuarioLogadoId);
            return res.json(avaliacaoAtualizada);
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async excluirAvaliacao(req: AuthenticatedRequest, res: Response): Promise<Response> {
        try {
            const usuarioLogadoId = req.user?.id;
            const avaliacaoId = parseInt(req.params.id);
            if (!usuarioLogadoId) return res.status(401).json({ message: "Não autorizado" });

            await AvaliacaoService.excluirAvaliacao(avaliacaoId, usuarioLogadoId);
            return res.status(204).send();
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async listarPorEstabelecimento(req: Request, res: Response): Promise<Response> {
        try {
            const estabelecimentoId = parseInt(req.params.id);
            const avaliacoes = await AvaliacaoService.listarPorEstabelecimentoDTO(estabelecimentoId);
            return res.json(avaliacoes);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }
}

export default new AvaliacaoController();