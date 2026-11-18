import { LedgerEntry } from '../types';

export interface MpesaSmartLegsResult {
  entries: LedgerEntry[];
  counterparty: string;
  category: string;
  isTransfer: boolean;
  notes: string;
}

/**
 * Intelligent Double-Entry leg generator for Kenyan Mobile Money
 */
export function buildMpesaDoubleEntryLegs({
  type,
  amountCents,
  feeCents = 0,
  fulizaCents = 0,
  counterparty = '',
  rawText = ''
}: {
  type: string;
  amountCents: number;
  feeCents?: number;
  fulizaCents?: number;
  counterparty?: string;
  rawText?: string;
}): MpesaSmartLegsResult {
  const entries: LedgerEntry[] = [];
  let category = 'cat_misc';
  let isTransfer = false;
  let notes = '';

  const cleanCounterparty = counterparty.trim();
  const lowerText = rawText.toLowerCase();

  // 1. M-Pesa Agent Cash Withdrawal
  if (type === 'cash_withdrawal' || lowerText.includes('from agent') || lowerText.includes('at agent')) {
    isTransfer = true;
    category = 'acc_cash';
    notes = 'Cash withdrawal into physical wallet';

    // Debit cash wallet with net cash received
    entries.push({ accountId: 'acc_cash', debitCents: amountCents, creditCents: 0 });

    // Debit withdrawal fee if any
    if (feeCents > 0) {
      entries.push({ accountId: 'cat_fees', debitCents: feeCents, creditCents: 0 });
    }

    // Credit M-Pesa asset with total outflow
    entries.push({ accountId: 'acc_mpesa', debitCents: 0, creditCents: amountCents + feeCents });
    return { entries, counterparty: cleanCounterparty || 'M-Pesa Agent', category, isTransfer, notes };
  }

  // 2. M-Shwari Savings Deposit
  if (type === 'mshwari_deposit' || lowerText.includes('to m-shwari') || lowerText.includes('lock savings')) {
    isTransfer = true;
    category = 'acc_mshwari';
    notes = 'Deposit into M-Shwari savings lock';

    entries.push({ accountId: 'acc_mshwari', debitCents: amountCents, creditCents: 0 });
    entries.push({ accountId: 'acc_mpesa', debitCents: 0, creditCents: amountCents });
    return { entries, counterparty: 'M-Shwari Savings', category, isTransfer, notes };
  }

  // 3. M-Shwari Savings Withdrawal
  if (type === 'mshwari_withdraw' || lowerText.includes('from m-shwari')) {
    isTransfer = true;
    category = 'acc_mshwari';
    notes = 'Withdrawal from M-Shwari savings into M-Pesa';

    entries.push({ accountId: 'acc_mpesa', debitCents: amountCents, creditCents: 0 });
    entries.push({ accountId: 'acc_mshwari', debitCents: 0, creditCents: amountCents });
    return { entries, counterparty: 'M-Shwari Savings', category, isTransfer, notes };
  }

  // 4. Bank Transfer (Bank to M-Pesa or M-Pesa to Bank)
  if (lowerText.includes('equity') || lowerText.includes('kcb') || lowerText.includes('stanbic') || lowerText.includes('coop')) {
    isTransfer = true;
    category = 'acc_bank';
    const bankName = lowerText.includes('equity') ? 'Equity Bank' : lowerText.includes('kcb') ? 'KCB Bank' : 'Bank Account';
    
    if (type === 'income' || lowerText.includes('received') || lowerText.includes('transferred from')) {
      notes = `Transfer from ${bankName} to M-Pesa`;
      entries.push({ accountId: 'acc_mpesa', debitCents: amountCents, creditCents: 0 });
      entries.push({ accountId: 'acc_bank', debitCents: 0, creditCents: amountCents });
    } else {
      notes = `Transfer from M-Pesa to ${bankName}`;
      entries.push({ accountId: 'acc_bank', debitCents: amountCents, creditCents: 0 });
      if (feeCents > 0) entries.push({ accountId: 'cat_fees', debitCents: feeCents, creditCents: 0 });
      entries.push({ accountId: 'acc_mpesa', debitCents: 0, creditCents: amountCents + feeCents });
    }
    return { entries, counterparty: bankName, category, isTransfer, notes };
  }

  // 5. Incoming Money / Income / Freelance / Client Deposit
  if (type === 'income' || type === 'received_money' || lowerText.includes('received ksh') || lowerText.includes('deposited ksh')) {
    category = 'cat_income';
    notes = `Received from ${cleanCounterparty}`;

    entries.push({ accountId: 'acc_mpesa', debitCents: amountCents, creditCents: 0 });
    entries.push({ accountId: 'cat_income', debitCents: 0, creditCents: amountCents });
    return { entries, counterparty: cleanCounterparty || 'Direct Deposit', category, isTransfer: false, notes };
  }

  // 6. Outgoing Expenses (Merchant Till, Paybill, Send Money, Airtime)
  if (type === 'merchant_buygoods' || lowerText.includes('paid to') || lowerText.includes('buy goods')) {
    category = 'cat_groceries';
    const lowerName = cleanCounterparty.toLowerCase();
    if (lowerName.includes('cafe') || lowerName.includes('restaurant') || lowerName.includes('kitchen') || lowerName.includes('hotel') || lowerName.includes('foods')) {
      category = 'cat_eating';
    } else if (lowerName.includes('pharmacy') || lowerName.includes('chemist') || lowerName.includes('hospital')) {
      category = 'cat_household';
    } else if (lowerName.includes('petrol') || lowerName.includes('shell') || lowerName.includes('total') || lowerName.includes('rubis') || lowerName.includes('oil')) {
      category = 'cat_transport';
    }
  } else if (type === 'paybill' || lowerText.includes('pay bill')) {
    category = 'cat_bills';
  } else if (type === 'airtime' || lowerText.includes('airtime')) {
    category = 'cat_airtime';
  }

  // Handle Fuliza Overdraft Split if applicable
  if (fulizaCents > 0 && fulizaCents < (amountCents + feeCents)) {
    const cashPortion = (amountCents + feeCents) - fulizaCents;
    entries.push({ accountId: category, debitCents: amountCents, creditCents: 0 });
    if (feeCents > 0) entries.push({ accountId: 'cat_fees', debitCents: feeCents, creditCents: 0 });
    if (cashPortion > 0) entries.push({ accountId: 'acc_mpesa', debitCents: 0, creditCents: cashPortion });
    entries.push({ accountId: 'acc_fuliza', debitCents: 0, creditCents: fulizaCents });
    notes = `Funded partially via Fuliza Overdraft (KES ${(fulizaCents / 100).toLocaleString()})`;
  } else {
    // Normal single-source M-Pesa expense
    entries.push({ accountId: category, debitCents: amountCents, creditCents: 0 });
    if (feeCents > 0) entries.push({ accountId: 'cat_fees', debitCents: feeCents, creditCents: 0 });
    entries.push({ accountId: 'acc_mpesa', debitCents: 0, creditCents: amountCents + feeCents });
  }

  return {
    entries,
    counterparty: cleanCounterparty,
    category,
    isTransfer: false,
    notes
  };
}
