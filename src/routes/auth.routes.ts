import { Router } from 'express';
import {
  changePasswordHandler,
  loginHandler,
  meHandler,
  registerHandler,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from '../validators/auth.validator.js';

export const authRouter = Router();

authRouter.post('/register', validate({ body: registerSchema }), registerHandler);
authRouter.post('/login', validate({ body: loginSchema }), loginHandler);
authRouter.get('/me', requireAuth, meHandler);
authRouter.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  changePasswordHandler,
);

