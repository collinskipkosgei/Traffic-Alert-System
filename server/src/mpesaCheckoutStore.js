/**
 * In-memory store for STK CheckoutRequestID → receipt details.
 * Safaricom sends the real M-Pesa receipt in the async callback; the STK Query
 * response often omits CallbackMetadata, so we merge from here in /api/mpesa/status.
 */
const TTL_MS = 2 * 60 * 60 * 1000

const checkoutData = new Map()

function prune() {
  const now = Date.now()
  for (const [id, row] of checkoutData.entries()) {
    if (row.storedAt && now - row.storedAt > TTL_MS) {
      checkoutData.delete(id)
    }
  }
}

function setCheckoutResult(checkoutRequestID, payload) {
  if (!checkoutRequestID) return
  prune()
  checkoutData.set(checkoutRequestID, {
    ...payload,
    storedAt: Date.now(),
  })
}

function getCheckoutResult(checkoutRequestID) {
  if (!checkoutRequestID) return undefined
  prune()
  return checkoutData.get(checkoutRequestID)
}

function receiptFromCallbackItems(items) {
  if (items == null) return undefined
  const list = Array.isArray(items) ? items : [items]
  const names = ['MpesaReceiptNumber', 'ReceiptNo', 'MpesaReceiptNo']
  for (const name of names) {
    const hit = list.find((x) => x && (x.Name === name || x.Key === name))
    if (hit != null && hit.Value != null && String(hit.Value).trim() !== '') {
      return String(hit.Value)
    }
  }
  return undefined
}

/** Parse Daraja STK callback body (same shape for /payment/callback and /mpesa/callback). */
function ingestSafaricomStkCallback(reqBody) {
  const stk = reqBody?.Body?.stkCallback
  if (!stk || stk.CheckoutRequestID == null) return

  const checkoutRequestID = String(stk.CheckoutRequestID)
  const items = stk.CallbackMetadata?.Item
  const list = items == null ? [] : Array.isArray(items) ? items : [items]
  const receipt = receiptFromCallbackItems(items)
  const amount = list.find((x) => x && x.Name === 'Amount')?.Value

  setCheckoutResult(checkoutRequestID, {
    resultCode: stk.ResultCode,
    resultDesc: stk.ResultDesc,
    mpesaReceiptNumber: receipt,
    amount: amount != null ? amount : undefined,
  })

  return { checkoutRequestID, receipt }
}

module.exports = {
  setCheckoutResult,
  getCheckoutResult,
  receiptFromCallbackItems,
  ingestSafaricomStkCallback,
}
