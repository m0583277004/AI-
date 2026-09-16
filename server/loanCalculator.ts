/**
 * Loan Calculator module for Extension 12
 * Calculates Spitzer loan schedule:
 * Formula: M = P * [ r*(1+r)^n ] / [ (1+r)^n - 1 ]
 * where:
 *   P = Principal loan amount (קרן)
 *   r = Monthly interest rate (ריבית חודשית = ריבית שנתית / 12 / 100)
 *   n = Number of monthly payments (מספר חודשים = שנים * 12)
 */

export interface LoanInput {
  principal: number;       // סכום ההלוואה בש"ח
  annualInterest: number;  // ריבית שנתית באחוזים (לדוגמה: 5 עבור 5%)
  years: number;           // תקופה בשנים
}

export interface LoanResult {
  monthlyPayment: number;       // החזר חודשי בשפיצר
  totalPayment: number;         // סך כל ההחזרים
  totalInterest: number;        // סך הריבית שתשולם
  months: number;               // סך כל החודשים
  spokenSummary: string;        // תיאור מילולי ברור להקראה טלפונית
}

export function calculateSpitzerLoan(input: LoanInput): LoanResult {
  const P = Math.max(1, input.principal);
  const annualRate = Math.max(0, input.annualInterest);
  const years = Math.max(0.1, input.years);
  const n = Math.round(years * 12);

  let monthlyPayment = 0;

  if (annualRate === 0) {
    // 0% interest (גמ"ח ללא ריבית)
    monthlyPayment = P / n;
  } else {
    const r = (annualRate / 100) / 12; // ריבית חודשית
    const factor = Math.pow(1 + r, n);
    monthlyPayment = P * (r * factor) / (factor - 1);
  }

  const roundedMonthly = Math.round(monthlyPayment);
  const totalPayment = Math.round(monthlyPayment * n);
  const totalInterest = Math.max(0, totalPayment - P);

  const spokenSummary = `עבור הלוואה בסך ${P.toLocaleString('he-IL')} שקלים בריבית של ${annualRate} אחוזים לתקופה של ${years} שנים, שהם ${n} חודשים. התשלום החודשי בלוח שפיצר הינו ${roundedMonthly.toLocaleString('he-IL')} שקלים לחודש. סך כל ההחזר הינו ${totalPayment.toLocaleString('he-IL')} שקלים, מתוכם סך הריבית הינו ${totalInterest.toLocaleString('he-IL')} שקלים.`;

  return {
    monthlyPayment: roundedMonthly,
    totalPayment,
    totalInterest,
    months: n,
    spokenSummary,
  };
}
