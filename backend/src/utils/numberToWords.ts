/**
 * Convert a numeric currency amount into English words (with Naira and Kobo).
 * Example: 45000 -> "Forty-Five Thousand Naira Only"
 * Example: 12500.50 -> "Twelve Thousand Five Hundred Naira and Fifty Kobo Only"
 */
export function amountToWords(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Zero Naira Only';
  }

  const rounded = Math.round(amount * 100) / 100;
  const naira = Math.floor(rounded);
  const kobo = Math.round((rounded - naira) * 100);

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHundreds(num: number): string {
    let str = '';
    if (num >= 100) {
      str += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    } else if (num >= 10) {
      str += teens[num - 10] + ' ';
      num = 0;
    }
    if (num > 0) {
      str += units[num] + ' ';
    }
    return str.trim();
  }

  function convertFull(num: number): string {
    if (num === 0) return 'Zero';

    const billions = Math.floor(num / 1000000000);
    num %= 1000000000;
    const millions = Math.floor(num / 1000000);
    num %= 1000000;
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;

    const parts: string[] = [];
    if (billions > 0) parts.push(convertHundreds(billions) + ' Billion');
    if (millions > 0) parts.push(convertHundreds(millions) + ' Million');
    if (thousands > 0) parts.push(convertHundreds(thousands) + ' Thousand');
    if (remainder > 0) parts.push(convertHundreds(remainder));

    return parts.join(' ').trim();
  }

  const nairaWords = convertFull(naira);
  let result = `${nairaWords} Naira`;

  if (kobo > 0) {
    const koboWords = convertFull(kobo);
    result += ` and ${koboWords} Kobo`;
  }

  return `${result} Only`;
}

