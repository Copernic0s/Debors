export const PROFILE_RESPECTS_WEEK_FILTER = false;

export const companyProfileRowMatchesWeek = (
  row,
  selectedWeek,
  respectsCmpWeekFilter = PROFILE_RESPECTS_WEEK_FILTER
) => {
  if (row.source === 'cmp' && !respectsCmpWeekFilter) return true;
  return selectedWeek === 'all' || String(row.weekLabel || '').trim() === selectedWeek;
};
