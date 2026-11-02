import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { invoiceRouter } from './invoice.routes.js';
import { museumRouter } from './museum.routes.js';

export const router = Router();

router.use('/auth', authRouter);
router.use('/museums', museumRouter);
router.use('/my', invoiceRouter);
