import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema, loginOtpVerifySchema, loginOtpResendSchema } from '../validators/authValidators.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authRateLimiter, validate(loginSchema), AuthController.login);
// Customer login step 2: the emailed 6-digit code (valid 2 minutes)
router.post('/login/verify-otp', authRateLimiter, validate(loginOtpVerifySchema), AuthController.verifyLoginOtp);
router.post('/login/resend-otp', authRateLimiter, validate(loginOtpResendSchema), AuthController.resendLoginOtp);
router.get('/me', authenticate, AuthController.me);
router.post('/logout', authenticate, AuthController.logout);

export default router;
