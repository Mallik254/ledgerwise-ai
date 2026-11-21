const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLocalSms, splitSmsMessages } = require('../services/semanticParser');

test('Ziidi investment is an asset transfer, not an expense', () => {
  const row = parseLocalSms('TA12345678 Confirmed. Unit Trust Invest To Ziidi MMF Ksh1,000.00 on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh4,000.00. Transaction cost, Ksh0.00.');
  assert.equal(row.type, 'ziidi_investment');
  assert.equal(row.direction, 'out');
  assert.equal(row.suggestedCategory, 'acc_ziidi');
  assert.equal(row.amount, 1000);
  assert.equal(row.balance, 4000);
  assert.equal(row.needsReview, false);
});

test('Ziidi withdrawal moves value back into M-Pesa', () => {
  const row = parseLocalSms('TB12345678 Confirmed. Unit Trust Withdraw From Ziidi MMF Ksh500.00 on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh4,500.00.');
  assert.equal(row.type, 'ziidi_withdrawal');
  assert.equal(row.direction, 'in');
  assert.equal(row.amount, 500);
});

test('unknown person-to-person outgoing transfer is held for review', () => {
  const row = parseLocalSms('TC12345678 Confirmed. Ksh750.00 sent to SOME PERSON 0712345678 on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh3,250.00. Transaction cost, Ksh11.00.');
  assert.equal(row.type, 'review_transfer');
  assert.equal(row.needsReview, true);
  assert.equal(row.reviewReason.includes('classify'), true);
  assert.equal(row.amount, 750);
  assert.equal(row.fee, 11);
});

test('PayBill principal and transaction charge are extracted separately', () => {
  const row = parseLocalSms('TD12345678 Confirmed. Ksh2,000.00 paid to ZETECH UNIVERSITY for account 1234 on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh1,000.00. Transaction cost, Ksh25.00.');
  assert.equal(row.type, 'paybill');
  assert.equal(row.suggestedCategory, 'cat_bills');
  assert.equal(row.amount, 2000);
  assert.equal(row.fee, 25);
  assert.equal(row.balance, 1000);
});

test('paired statement-style records sharing a receipt are not split away', () => {
  const rows = splitSmsMessages('TE12345678 Confirmed. Paid in Ksh1,000.00.\nTE12345678 Confirmed. Withdrawn Ksh1,000.00.');
  assert.equal(rows.length, 2);
});

test('reversal is flagged for matching rather than imported as income/expense', () => {
  const row = parseLocalSms('TF12345678 Confirmed. Reversal of transaction Ksh300.00.');
  assert.equal(row.type, 'reversal');
  assert.equal(row.needsReview, true);
});

test('standalone M-Pesa charge SMS becomes a fee expense', () => {
  const row = parseLocalSms('TG12345678 Confirmed. Customer Transfer of Funds Charge Ksh11.00 on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh3,239.00.');
  assert.equal(row.type, 'transaction_fee');
  assert.equal(row.suggestedCategory, 'cat_fees');
  assert.equal(row.amount, 11);
  assert.equal(row.fee, 0);
  assert.equal(row.needsReview, false);
});

test('known bank transfer is treated as an account transfer', () => {
  const row = parseLocalSms('TH12345678 Confirmed. Ksh3,000.00 sent to KCB BANK on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh1,000.00. Transaction cost, Ksh25.00.');
  assert.equal(row.type, 'account_transfer');
  assert.equal(row.suggestedCategory, 'acc_bank');
  assert.equal(row.needsReview, false);
});

test('M-Shwari withdrawal is not mistaken for a generic bank transfer', () => {
  const row = parseLocalSms('TJ12345678 Confirmed. You have received Ksh2,000.00 from M-SHWARI on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh5,000.00.');
  assert.equal(row.type, 'mshwari_withdrawal');
  assert.equal(row.suggestedCategory, 'acc_mshwari');
  assert.equal(row.needsReview, false);
});

test('incoming transfer from an unmapped bank is held for account mapping', () => {
  const row = parseLocalSms('TK12345678 Confirmed. You have received Ksh2,000.00 from NCBA BANK on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh5,000.00.');
  assert.equal(row.type, 'review_transfer');
  assert.equal(row.needsReview, true);
  assert.match(row.reviewReason, /no matching ledger account/);
});

test('outgoing transfer to an unmapped bank is held for account mapping', () => {
  const row = parseLocalSms('TL12345678 Confirmed. Ksh2,000.00 sent to CO-OPERATIVE BANK on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh5,000.00.');
  assert.equal(row.type, 'review_transfer');
  assert.equal(row.needsReview, true);
  assert.match(row.reviewReason, /no matching ledger account/);
});
