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

            const dadosAvaliacao = { ...req.body, projetoId: req.body.projeto.projetoId };
            
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

    public async listarPorProjeto(req: Request, res: Response): Promise<Response> {
        try {
            const projetoId = parseInt(req.params.id);
            const avaliacoes = await AvaliacaoService.listarPorProjetoDTO(projetoId);
            return res.json(avaliacoes);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }
}

export default new AvaliacaoController();