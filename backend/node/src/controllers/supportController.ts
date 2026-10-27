import { sendResponse } from '../utils/response.js';
import { asyncHandler, getRequestMeta, parseIdParam } from '../utils/http.js';
import { SupportService } from '../services/supportService.js';
import { GuestSupportService } from '../services/guestSupportService.js';

/**
 * Support chat: customers write to the admin team, admins reply per customer thread
 */
export class SupportController {
  // --------------------------------------------------------------- customer
  public static listMine = asyncHandler(async (req, res) => {
    const result = await SupportService.listForCustomer(req.user!.id, req.query as any);
    sendResponse({ res, message: 'Support messages retrieved successfully', data: result.messages, meta: result.meta });
  });

  public static send = asyncHandler(async (req, res) => {
    const message = await SupportService.sendFromCustomer(req.user!.id, req.body, getRequestMeta(req));
    sendResponse({ res, statusCode: 201, message: 'Message sent to support', data: message });
  });

  public static myUnreadCount = asyncHandler(async (req, res) => {
    const result = await SupportService.unreadCountForCustomer(req.user!.id);
    sendResponse({ res, message: 'Unread support messages counted', data: result });
  });

  // ------------------------------------------------------------------ admin
  public static listThreads = asyncHandler(async (req, res) => {
    const result = await SupportService.listThreadsForAdmin(req.query as any);
    sendResponse({ res, message: 'Support threads retrieved successfully', data: result.threads, meta: result.meta });
  });

  public static getThread = asyncHandler(async (req, res) => {
    const customerUserId = parseIdParam(req.params.userId, 'customer ID');
    const result = await SupportService.getThreadForAdmin(customerUserId, req.query as any);
    sendResponse({ res, message: 'Support thread retrieved successfully', data: result });
  });

  public static reply = asyncHandler(async (req, res) => {
    const customerUserId = parseIdParam(req.params.userId, 'customer ID');
    const message = await SupportService.replyFromAdmin(req.user!.id, customerUserId, req.body, getRequestMeta(req));
    sendResponse({ res, statusCode: 201, message: 'Reply sent', data: message });
  });

  public static adminUnreadCount = asyncHandler(async (_req, res) => {
    const [customers, visitors] = await Promise.all([SupportService.unreadCountForAdmin(), GuestSupportService.unreadCountForAdmin()]);
    // Totals cover both inboxes (sidebar badge); the breakdown drives the tabs on the Support page
    const result = {
      unreadCount: customers.unreadCount + visitors.unreadCount,
      openThreads: customers.openThreads + visitors.openThreads,
      customers,
      visitors,
    };
    sendResponse({ res, message: 'Unread support messages counted', data: result });
  });
}

/**
 * Support chat for visitors who are not signed in, and the admin side of it
 */
export class GuestSupportController {
  public static send = asyncHandler(async (req, res) => {
    const result = await GuestSupportService.send(req.body, getRequestMeta(req));
    sendResponse({ res, statusCode: 201, message: 'Message sent to support', data: result });
  });

  public static thread = asyncHandler(async (req, res) => {
    const result = await GuestSupportService.thread(req.body.token);
    sendResponse({ res, message: 'Support conversation retrieved', data: result });
  });

  public static unread = asyncHandler(async (req, res) => {
    const result = await GuestSupportService.unreadForGuest(req.body.token);
    sendResponse({ res, message: 'Unread support messages counted', data: result });
  });

  public static listThreads = asyncHandler(async (req, res) => {
    const result = await GuestSupportService.listThreadsForAdmin(req.query as any);
    sendResponse({ res, message: 'Visitor conversations retrieved', data: result.threads, meta: result.meta });
  });

  public static getThread = asyncHandler(async (req, res) => {
    const guestId = parseIdParam(req.params.guestId, 'visitor ID');
    const result = await GuestSupportService.getThreadForAdmin(guestId);
    sendResponse({ res, message: 'Visitor conversation retrieved', data: result });
  });

  public static reply = asyncHandler(async (req, res) => {
    const guestId = parseIdParam(req.params.guestId, 'visitor ID');
    const message = await GuestSupportService.replyFromAdmin(req.user!.id, guestId, req.body, getRequestMeta(req));
    sendResponse({ res, statusCode: 201, message: 'Reply sent', data: message });
  });
}
