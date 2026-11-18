/**
 * Chain Balance Reconciliation & Ledger Integrity Auditor
 * Validates the chronological sequence of transactions where running balances are reported.
 */

function auditChainBalances(transactions, initialBalance = null) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return {
      status: 'empty',
      issues: [],
      integrityScore: 100,
      summary: 'No transactions to audit.'
    };
  }

  // Sort chronologically ascending
  const sorted = [...transactions].sort((a, b) => {
    const timeA = new Date(`${a.date || '1970-01-01'} ${a.time || '00:00'}`).getTime();
    const timeB = new Date(`${b.date || '1970-01-01'} ${b.time || '00:00'}`).getTime();
    return timeA - timeB;
  });

  const issues = [];
  let previousBalance = initialBalance !== null ? Number(initialBalance) : null;
  let matches = 0;
  let totalWithBalance = 0;

  for (let i = 0; i < sorted.length; i++) {
    const tx = sorted[i];
    const amount = Number(tx.amount || 0);
    const fee = Number(tx.fee || 0);
    const reportedBalance = tx.balance !== null && tx.balance !== undefined ? Number(tx.balance) : null;
    const direction = tx.direction; // 'in' or 'out'

    if (previousBalance !== null && reportedBalance !== null) {
      totalWithBalance++;
      const expectedBalance = direction === 'in' 
        ? previousBalance + amount - fee 
        : previousBalance - amount - fee;

      const diff = Math.round((reportedBalance - expectedBalance) * 100) / 100;

      if (Math.abs(diff) > 0.05) { // Allow minor floating point rounding
        issues.push({
          type: 'chain_break',
          severity: 'warning',
          txId: tx.id || tx.receipt,
          receipt: tx.receipt,
          date: tx.date,
          time: tx.time,
          counterparty: tx.counterparty,
          previousBalance,
          expectedBalance,
          reportedBalance,
          gapAmount: diff,
          message: diff > 0 
            ? `Unrecorded credit: Balance is KES ${Math.abs(diff).toLocaleString()} higher than expected before this transaction. A deposit or incoming payment may have been skipped.`
            : `Missing transaction gap: Balance is KES ${Math.abs(diff).toLocaleString()} lower than expected. An expense or cash withdrawal might not be recorded.`
        });
      } else {
        matches++;
      }
    }

    if (reportedBalance !== null) {
      previousBalance = reportedBalance;
    }
  }

  const auditedCount = totalWithBalance || 1;
  const integrityScore = Math.max(0, Math.round(((auditedCount - issues.length) / auditedCount) * 100));

  return {
    status: issues.length === 0 ? 'perfect' : 'discrepancies_found',
    totalTransactions: sorted.length,
    auditedWithBalance: totalWithBalance,
    issues,
    integrityScore,
    summary: issues.length === 0
      ? `Audit passed: All ${sorted.length} transactions reconcile perfectly with M-Pesa running balances.`
      : `Integrity Alert: Found ${issues.length} balance discrepancy gap(s). Review highlighted rows.`
  };
}

module.exports = {
  auditChainBalances
};
