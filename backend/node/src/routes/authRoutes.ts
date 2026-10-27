import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { authRateLimiter, loginRateLimiter } from '../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  loginOtpVerifySchema,
  loginOtpResendSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '../validators/authValidators.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), AuthController.register);
// Registration email link activates the account; a new link can be requested from the sign-in page
router.post('/verify-email', authRateLimiter, validate(verifyEmailSchema), AuthController.verifyEmail);
router.post('/resend-verification', authRateLimiter, validate(resendVerificationSchema), AuthController.resendVerification);
router.post('/login', authRateLimiter, loginRateLimiter, validate(loginSchema), AuthController.login);
// Customer login step 2: the emailed 6-digit code (valid 2 minutes)
router.post('/login/verify-otp', authRateLimiter, validate(loginOtpVerifySchema), AuthController.verifyLoginOtp);
router.post('/login/resend-otp', authRateLimiter, validate(loginOtpResendSchema), AuthController.resendLoginOtp);
router.get('/me', authenticate, AuthController.me);
router.post('/logout', authenticate, AuthController.logout);

export default router;
