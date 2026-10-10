// Sample bets for tests and the local preview. Not real tips.
export function sampleCard(date) {
  const leg = (event, selection, odds) => ({ sport: 'football', event, start_uk: '15:00', selection, odds, reasoning: `Reasoning for ${selection}` });
  return {
    date,
    generated_at: `${date}T08:20:00Z`,
    summary: 'Sample summary.',
    passed_on: 'Sample passed-on note.',
    sources: [{ title: 'Example', url: 'https://example.com/' }],
    bets: [
      {
        id: `${date}-cmd`, tier: 'cmd', title: 'Sample CMD', sport: 'football', bet_type: 'bet_builder',
        legs: [leg('Arsenal v Leeds', 'Arsenal to win', '1/2'), leg('Arsenal v Leeds', 'SECRET Saka 1+ shot on target', '4/9')],
        odds: '4/1', decimal_odds: 5, value_case: 'Sample value case.', check: 'Saka starts.',
        stake_pts: 1, result: 'pending', profit_pts: null, settled_note: null,
      },
      {
        id: `${date}-cash`, tier: 'cash', title: 'Sample <CASH> & co', sport: 'mixed', bet_type: 'acca',
        legs: [leg('A v B', 'SECRET A to win', '6/1'), leg('C v D', 'SECRET D to win', '13/1')],
        odds: '110/1', decimal_odds: 111, value_case: 'Sample.', check: 'Team news.',
        stake_pts: 0.25, result: 'pending', profit_pts: null, settled_note: null,
      },
    ],
  };
}
