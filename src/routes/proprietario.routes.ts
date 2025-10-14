import { Router } from 'express';
import ProprietarioController from '../controllers/ProprietarioController';

const router = Router();

router.post('/', ProprietarioController.cadastrar);

export default router;