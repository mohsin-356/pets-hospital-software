import DaySession from '../models/DaySession.js';
import DailyLog from '../models/DailyLog.js';
import JournalEntry from '../models/JournalEntry.js';

const CASH_CODE = '1001';
const BANK_CODE = '1002';

export async function getTodaySession({ portal }) {
  const date = new Date().toISOString().slice(0,10);
  return DaySession.findOne({ portal, date }).sort({ createdAt: -1 });
}

export async function computeTallies({ portal, date }) {
  const dayStr = date || new Date().toISOString().slice(0,10);
  const start = new Date(`${dayStr}T00:00:00.000Z`);
  const end = new Date(`${dayStr}T23:59:59.999Z`);

  const match = { portal, date: { $gte: start, $lte: end } };

  const entries = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
  ]);

  const map = Object.fromEntries(entries.map(e => [e._id, e]));
  const cash = map[CASH_CODE] || { debit: 0, credit: 0 };
  const bank = map[BANK_CODE] || { debit: 0, credit: 0 };

  // Income and Expense summaries
  // We infer using naming: revenue accounts start with '4', expense accounts start with '5'
  const totals = entries.reduce((acc, e) => {
    if (String(e._id).startsWith('4')) {
      acc.sales += (e.credit || 0) - (e.debit || 0);
      acc.income += (e.credit || 0) - (e.debit || 0);
    } else if (String(e._id).startsWith('5')) {
      acc.expenses += (e.debit || 0) - (e.credit || 0);
    }
    return acc;
  }, { sales: 0, income: 0, expenses: 0 });

  return {
    cashIn: cash.debit || 0,
    cashOut: cash.credit || 0,
    bankIn: bank.debit || 0,
    bankOut: bank.credit || 0,
    sales: totals.sales,
    income: totals.income,
    expenses: totals.expenses,
  };
}

export async function openDay({ portal, openingAmount, openedBy, openingNote }) {
  const today = new Date().toISOString().slice(0,10);

  // If a previous day is still open, and it's not today, auto late-close it
  const existsOpen = await DaySession.findOne({ portal, status: 'open' });
  if (existsOpen) {
    if (existsOpen.date === today) {
      const err = new Error(`A day is already open for ${portal} on ${existsOpen.date}`);
      err.status = 400;
      throw err;
    }
    // Auto-close previous open day as a late close with expected tallies
    const prevDate = existsOpen.date;
    const tallies = await computeTallies({ portal, date: prevDate });
    const adjTotal = (existsOpen.adjustments || []).reduce((s, a) => s + (a.type === 'subtract' ? -Math.abs(Number(a.amount||0)) : Math.abs(Number(a.amount||0))), 0);
    const expectedClosingCash = (existsOpen.openingAmount || 0) + (tallies.cashIn || 0) - (tallies.cashOut || 0);
    const expectedClosingBank = (tallies.bankIn || 0) - (tallies.bankOut || 0);
    const expectedTotal = expectedClosingCash + expectedClosingBank + adjTotal;

    existsOpen.status = 'closed';
    existsOpen.closingAmount = expectedClosingCash;
    existsOpen.cashCount = expectedClosingCash;
    existsOpen.bankBalance = expectedClosingBank;
    existsOpen.closeType = 'late';
    existsOpen.closedBy = openedBy || 'system-auto-rollover';
    existsOpen.closedAt = new Date();
    existsOpen.closeNote = `Auto late close during next day opening (${today})`;
    existsOpen.tallies = tallies;
    existsOpen.expectedClosingCash = expectedClosingCash;
    existsOpen.expectedClosingBank = expectedClosingBank;
    existsOpen.expectedTotal = expectedTotal;
    await existsOpen.save();

    await DailyLog.create({
      date: prevDate,
      portal,
      sessionId: existsOpen._id,
      action: 'close_day',
      description: `Auto late close. Cash ${expectedClosingCash}, Bank ${expectedClosingBank}`,
      amount: expectedTotal,
      by: openedBy || 'system-auto-rollover',
    });

    // If no opening amount was provided, carry forward expected closing cash
    if (openingAmount == null) {
      openingAmount = expectedClosingCash;
    }
  }

  const session = new DaySession({
    date: today,
    portal,
    status: 'open',
    openingAmount: Math.max(0, Number(openingAmount) || 0),
    openedBy: openedBy || 'system',
    openedAt: new Date(),
    openingNote: openingNote || '',
  });
  await session.save();

  await DailyLog.create({
    date: today,
    portal,
    sessionId: session._id,
    action: 'open_day',
    description: `Day opened with amount ${session.openingAmount}`,
    amount: session.openingAmount,
    by: openedBy || 'system',
  });

  return session;
}

export async function closeDay({ portal, closingAmount, cashCount, bankBalance, closeType = 'regular', closedBy, closeNote, adjustments = [] }) {
  const session = await DaySession.findOne({ portal, status: 'open' });
  if (!session) throw new Error('No open session to close');
  const date = session.date;

  const tallies = await computeTallies({ portal, date });

  const adjTotal = (adjustments || []).reduce((s, a) => s + (a.type === 'subtract' ? -Math.abs(Number(a.amount||0)) : Math.abs(Number(a.amount||0))), 0);

  const expectedClosingCash = (session.openingAmount || 0) + (tallies.cashIn || 0) - (tallies.cashOut || 0);
  const expectedClosingBank = (tallies.bankIn || 0) - (tallies.bankOut || 0);
  const expectedTotal = expectedClosingCash + expectedClosingBank + adjTotal;

  const cashCountNum = Math.max(0, Number(cashCount || closingAmount || 0));
  const bankBalNum = Number(bankBalance || 0);
  const actualTotal = cashCountNum + bankBalNum;

  // Validate tally matches within small tolerance
  const tolerance = 0.5;
  const diff = Math.abs(expectedTotal - actualTotal);
  if (diff > tolerance) {
    const msg = `Closing tally mismatch by ${diff.toFixed(2)}. Expected ${expectedTotal.toFixed(2)} = cash ${expectedClosingCash.toFixed(2)} + bank ${expectedClosingBank.toFixed(2)} + adjustments ${adjTotal.toFixed(2)}; got cash ${cashCountNum.toFixed(2)} + bank ${bankBalNum.toFixed(2)}`;
    const err = new Error(msg);
    err.status = 400;
    throw err;
  }

  session.status = 'closed';
  session.closingAmount = Math.max(0, Number(closingAmount || cashCountNum) || 0);
  session.cashCount = cashCountNum;
  session.bankBalance = bankBalNum;
  session.closeType = closeType;
  session.closedBy = closedBy || 'system';
  session.closedAt = new Date();
  session.closeNote = closeNote || '';
  session.adjustments = adjustments || [];
  session.tallies = tallies;
  session.expectedClosingCash = expectedClosingCash;
  session.expectedClosingBank = expectedClosingBank;
  session.expectedTotal = expectedTotal;

  await session.save();

  await DailyLog.create({
    date,
    portal,
    sessionId: session._id,
    action: 'close_day',
    description: `Day closed (${closeType}). Cash ${cashCountNum}, Bank ${bankBalNum}`,
    amount: actualTotal,
    by: closedBy || 'system',
  });

  return session;
}

export default {
  openDay,
  closeDay,
  computeTallies,
  getTodaySession,
};
