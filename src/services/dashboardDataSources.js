export const loadDashboardDataSources = async ({
  loadZoho,
  loadCmp,
  previousZoho = { debtors: [], clientsByAgent: [], trackerLogs: null },
  previousCmp = { rows: [], expected: 0 }
}) => {
  let zoho = previousZoho;
  let cmp = previousCmp;
  let zohoError = null;
  let cmpError = null;

  const [zohoResult, cmpResult] = await Promise.allSettled([loadZoho(), loadCmp()]);

  if (zohoResult.status === 'fulfilled') zoho = zohoResult.value;
  else zohoError = zohoResult.reason;

  if (cmpResult.status === 'fulfilled') cmp = cmpResult.value;
  else cmpError = cmpResult.reason;

  return { zoho, cmp, zohoError, cmpError };
};
