const KSA_OFFSET_HOURS = 3;

const getKsaDate = () => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  return new Date(utcTime + (KSA_OFFSET_HOURS * 60 * 60 * 1000));
};

const extractDateOnly = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

export const resolveEffectiveStartDate = (
  configuredStartDate: string | null | undefined,
  referenceDate?: string | null | undefined,
): string | null => {
  const configuredDateOnly = extractDateOnly(configuredStartDate);
  if (!configuredDateOnly) return null;

  const monthDay = configuredDateOnly.slice(5);
  const referenceYear = extractDateOnly(referenceDate)?.slice(0, 4) || String(getKsaDate().getUTCFullYear());

  return `${referenceYear}-${monthDay}`;
};

export const getStartDateGuard = (
  candidateDate: string | null | undefined,
  configuredStartDate: string | null | undefined,
) => {
  const orderDateOnly = extractDateOnly(candidateDate);
  const effectiveStartDate = resolveEffectiveStartDate(configuredStartDate, orderDateOnly);

  return {
    orderDateOnly,
    effectiveStartDate,
    isBeforeStartDate: Boolean(orderDateOnly && effectiveStartDate && orderDateOnly < effectiveStartDate),
  };
};