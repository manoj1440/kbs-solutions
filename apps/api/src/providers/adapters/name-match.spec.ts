import { namesMatch, normalizeNameTokens } from './name-match';

describe('namesMatch (rule shared by the Cashfree PAN and DigiLocker adapters)', () => {
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

  it("accepts a left-out middle or father's name, and an initial, when two full words still agree", () => {
    expect(namesMatch('Rajesh Sharma', 'Rajesh Kumar Sharma')).toBe(true);
    expect(namesMatch('Rajesh Kumar Sharma', 'Rajesh Sharma')).toBe(true); // either side may be the longer one
    expect(namesMatch('Rajesh K Sharma', 'Rajesh Kumar Sharma')).toBe(true);
    expect(namesMatch('Rajesh Kumar Sharma', 'Sharma Rajesh K')).toBe(true);
    expect(namesMatch('Amit Kumar', 'Amit Kumar Singh Rathore')).toBe(true);
    expect(namesMatch('K Rajesh Sharma', 'Kumar Rajesh Sharma')).toBe(true);
  });

  it('refuses one shared word, a missing word, spelling variants and a different person', () => {
    expect(namesMatch('Rajesh', 'Rajesh Sharma')).toBe(false); // one word is not enough
    expect(namesMatch('R Sharma', 'Rajesh Sharma')).toBe(false); // an initial plus one word is not enough
    expect(namesMatch('S Karthik', 'Subramanian Karthik')).toBe(false);
    expect(namesMatch('Rajesh Verma Sharma', 'Rajesh Kumar Sharma')).toBe(false); // a word the document does not have
    expect(namesMatch('Rajesh Sharma', 'Rajesh Kumar Verma')).toBe(false);
    expect(namesMatch('Mohd Imran', 'Mohammed Imran')).toBe(false);
    expect(namesMatch('Rajesh Sharma', 'Rakesh Sharma')).toBe(false);
    expect(namesMatch('Rajesh Sharma', 'Rajesh Rajesh')).toBe(false);
    expect(namesMatch('Rajesh Kumar', 'Rajesh K K')).toBe(false); // an initial cannot be used twice for one word
    expect(namesMatch('Sunita Kumari', 'Sunita')).toBe(false);
  });

  it('never matches an empty, punctuation-only or missing name', () => {
    expect(namesMatch('', '')).toBe(false);
    expect(namesMatch(' . ', ' . ')).toBe(false);
    expect(namesMatch(undefined, 'Rajesh')).toBe(false);
    expect(namesMatch('Rajesh', null)).toBe(false);
  });
});
