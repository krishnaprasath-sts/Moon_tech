import { Router } from 'express';
import { SupportController, GuestSupportController } from '../controllers/supportController.js';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { UserRole } from '../types/index.js';
import {
  sendSupportMessageSchema,
  supportReplySchema,
  supportListQuerySchema,
  supportThreadsQuerySchema,
  supportThreadQuerySchema,
  guestSendSchema,
  guestThreadSchema,
  guestThreadsQuerySchema,
} from '../validators/supportValidators.js';

const staff = authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR);
const managers = authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN);
const customer = authorize(UserRole.CUSTOMER);

// ---------------------------------------------------------------------------
// Customer: own support chat (mounted under /support)
// ---------------------------------------------------------------------------
const router = Router();
router.get('/', authenticate, customer, validate(supportListQuerySchema, 'query'), SupportController.listMine);
router.post('/', authenticate, customer, validate(sendSupportMessageSchema), SupportController.send);
router.get('/unread-count', authenticate, customer, SupportController.myUnreadCount);

// ---------------------------------------------------------------------------
// Visitors who are not signed in (home, sign-in and registration pages).
// The chat token travels in the body, never in the URL.
// ---------------------------------------------------------------------------
const guestSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please wait a few minutes and try again.' },
});
router.post('/guest', guestSendLimiter, validate(guestSendSchema), GuestSupportController.send);
router.post('/guest/thread', validate(guestThreadSchema), GuestSupportController.thread);
router.post('/guest/unread-count', validate(guestThreadSchema), GuestSupportController.unread);

// ---------------------------------------------------------------------------
// Admin: every customer thread (mounted under /admin/support)
// ---------------------------------------------------------------------------
export const adminSupportRouter = Router();
adminSupportRouter.use(authenticate);
adminSupportRouter.get('/threads', staff, validate(supportThreadsQuerySchema, 'query'), SupportController.listThreads);
adminSupportRouter.get('/unread-count', staff, SupportController.adminUnreadCount);
adminSupportRouter.get('/threads/:userId', staff, validate(supportThreadQuerySchema, 'query'), SupportController.getThread);
adminSupportRouter.post('/threads/:userId/reply', managers, validate(supportReplySchema), SupportController.reply);
adminSupportRouter.get('/guests', staff, validate(guestThreadsQuerySchema, 'query'), GuestSupportController.listThreads);
adminSupportRouter.get('/guests/:guestId', staff, GuestSupportController.getThread);
adminSupportRouter.post('/guests/:guestId/reply', managers, validate(supportReplySchema), GuestSupportController.reply);

export default router;
