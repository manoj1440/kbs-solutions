import { namesMatch, normalizeNameTokens } from './name-match';

describe('namesMatch (strict rule shared by the Cashfree PAN and DigiLocker adapters)', () => {
  it('ignores case, extra spaces, dots and other punctuation', () => {
    expect(namesMatch('Rajesh Kumar Sharma', 'RAJESH KUMAR SHARMA')).toBe(true);
    expect(namesMatch('  rajesh   kumar\tsharma ', 'Rajesh Kumar Sharma')).toBe(true);
    expect(namesMatch('R.K. Sharma', 'R K Sharma')).toBe(true);
    expect(namesMatch("D'Souza, Maria", 'Maria D Souza')).toBe(true);
    expect(namesMatch('Anne-Marie Thomas', 'Anne Marie Thomas')).toBe(true);
    expect(namesMatch('José Fernandes', 'JOSE FERNANDES')).toBe(true);
  });

  it('drops a leading honorific, and only a leading one', () => {
    expect(namesMatch('Mr. Rajesh Sharma', 'Rajesh Sharma')).toBe(true);
    expect(namesMatch('Smt Sunita Devi', 'SUNITA DEVI')).toBe(true);
    expect(namesMatch('Dr Mrs Asha Rao', 'Asha Rao')).toBe(true);
    expect(normalizeNameTokens('Sunita Kumari')).toEqual(['SUNITA', 'KUMARI']); // a real second name stays
    expect(namesMatch('Sunita Kumari', 'Sunita')).toBe(false);
    expect(normalizeNameTokens('Dr')).toEqual(['DR']); // never strips the whole name
  });

  it('accepts the same words in another order (surname-first documents) and names written without spaces', () => {
    expect(namesMatch('Sharma Rajesh Kumar', 'Rajesh Kumar Sharma')).toBe(true);
    expect(namesMatch('RAJESHKUMAR SHARMA', 'Rajesh Kumar Sharma')).toBe(true);
    expect(namesMatch('RK Sharma', 'R.K. Sharma')).toBe(true);
  });

  it('refuses a missing or extra word, an initial for a full word, spelling variants and a different person', () => {
    expect(namesMatch('Rajesh Sharma', 'Rajesh Kumar Sharma')).toBe(false);
    expect(namesMatch('R Sharma', 'Rajesh Sharma')).toBe(false);
    expect(namesMatch('Mohd Imran', 'Mohammed Imran')).toBe(false);
    expect(namesMatch('Rajesh Sharma', 'Rakesh Sharma')).toBe(false);
    expect(namesMatch('Rajesh Sharma', 'Rajesh Rajesh')).toBe(false);
  });

  it('never matches an empty, punctuation-only or missing name', () => {
    expect(namesMatch('', '')).toBe(false);
    expect(namesMatch(' . ', ' . ')).toBe(false);
    expect(namesMatch(undefined, 'Rajesh')).toBe(false);
    expect(namesMatch('Rajesh', null)).toBe(false);
  });
});
