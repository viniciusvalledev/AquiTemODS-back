import { Request, Response } from 'express';
import AuthService from '../services/AuthService';

interface AuthenticatedRequest extends Request {
    user?: {
        id: number; 
        username: string;
    }
}

class UserController {
    public async updateUserProfile(req: AuthenticatedRequest, res: Response): Promise<Response> {
        try {
            const userId = req.user?.id; 
            if (!userId) return res.status(401).json({ message: "Não autorizado" });

            const updatedUser = await AuthService.updateUserProfile(userId, req.body);
            const { password, ...userDTO } = updatedUser.get({ plain: true });

            return res.json(userDTO);
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async deleteUserProfile(req: AuthenticatedRequest, res: Response): Promise<Response> {
        try {
            const userId = req.user?.id; 
            if (!userId) return res.status(401).json({ message: "Não autorizado" });

            await AuthService.deleteUser(userId);
            return res.json({ message: "Perfil de utilizador excluído com sucesso." });
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async updateUserPassword(req: AuthenticatedRequest, res: Response): Promise<Response> {
        try {
            const userId = req.user?.id; 
            if (!userId) return res.status(401).json({ message: "Não autorizado" });

            await AuthService.updateUserPassword(userId, req.body);
            return res.json({ message: "Senha alterada com sucesso." });
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }
}

export default new UserController();