import { sendResponse } from '../utils/response.js';
import { asyncHandler, getRequestMeta, parseIdParam } from '../utils/http.js';
import { BankAccountService } from '../services/bankAccountService.js';
import { streamFile } from './financeController.js';

/**
 * Bank account change requests: customers ask, admins approve or reject
 */
export class BankChangeController {
  // --------------------------------------------------------------- customer
  public static listMine = asyncHandler(async (req, res) => {
    const items = await BankAccountService.listMine(req.user!.id);
    sendResponse({ res, message: 'Bank change requests retrieved', data: items });
  });

  public static create = asyncHandler(async (req, res) => {
    const request = await BankAccountService.createRequest(req.user!.id, req.body, req.file, getRequestMeta(req));
    sendResponse({
      res,
      statusCode: 201,
      message: 'Bank change request submitted. Withdrawals keep going to your current account until it is approved.',
      data: request,
    });
  });

  public static cancel = asyncHandler(async (req, res) => {
    const request = await BankAccountService.cancelRequest(req.user!.id, parseIdParam(req.params.id, 'request ID'), getRequestMeta(req));
    sendResponse({ res, message: 'Bank change request cancelled', data: request });
  });

  // ------------------------------------------------------------------ admin
  public static list = asyncHandler(async (req, res) => {
    const result = await BankAccountService.listForAdmin(req.query as any, req.user!.role);
    sendResponse({ res, message: 'Bank change requests retrieved', data: result.items, meta: result.meta as any });
  });

  public static pendingCount = asyncHandler(async (_req, res) => {
    sendResponse({ res, message: 'Pending bank change requests counted', data: await BankAccountService.pendingCount() });
  });

  public static get = asyncHandler(async (req, res) => {
    const data = await BankAccountService.getForAdmin(parseIdParam(req.params.id, 'request ID'), req.user!.role);
    sendResponse({ res, message: 'Bank change request retrieved', data });
  });

  public static proof = asyncHandler(async (req, res) => {
    const file = await BankAccountService.getProof(parseIdParam(req.params.id, 'request ID'));
    streamFile(res, file, 'bank_proof');
  });

  public static approve = asyncHandler(async (req, res) => {
    const data = await BankAccountService.approve(req.user!.id, parseIdParam(req.params.id, 'request ID'), req.body, getRequestMeta(req));
    sendResponse({ res, message: 'Bank change approved. New withdrawals go to the new account.', data });
  });

  public static reject = asyncHandler(async (req, res) => {
    const data = await BankAccountService.reject(req.user!.id, parseIdParam(req.params.id, 'request ID'), req.body, getRequestMeta(req));
    sendResponse({ res, message: 'Bank change rejected', data });
  });
}
