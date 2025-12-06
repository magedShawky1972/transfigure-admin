/**
 * KSA Time Utility Functions
 * All time operations in this system use KSA timezone (UTC+3)
 * This file provides centralized functions for consistent timezone handling
 */

// KSA timezone offset in hours (UTC+3)
const KSA_OFFSET_HOURS = 3;
const KSA_OFFSET_MS = KSA_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Get current time as a Date object adjusted to KSA timezone
 * Note: The returned Date object's methods will return KSA-adjusted values
 */
export const getKSADate = (): Date => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  return new Date(utcTime + KSA_OFFSET_MS);
};

/**
 * Get current KSA date as YYYY-MM-DD string
 */
export const getKSADateString = (): string => {
  const ksaDate = getKSADate();
  const year = ksaDate.getFullYear();
  const month = (ksaDate.getMonth() + 1).toString().padStart(2, '0');
  const day = ksaDate.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get current KSA time in minutes from midnight
 */
export const getKSATimeInMinutes = (): number => {
  const ksaDate = getKSADate();
  return ksaDate.getHours() * 60 + ksaDate.getMinutes();
};

/**
 * Convert a UTC ISO timestamp to KSA Date object
 */
export const convertToKSA = (isoString: string): Date => {
  const date = new Date(isoString);
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  return new Date(utcTime + KSA_OFFSET_MS);
};

/**
 * Format a UTC ISO timestamp to KSA date/time string
 * Format: DD/MM/YYYY HH:MM:SS AM/PM
 */
export const formatKSADateTime = (isoString: string | null, includeSeconds: boolean = true): string => {
  if (!isoString) return "-";
  
  const ksaDate = convertToKSA(isoString);
  
  const day = ksaDate.getDate().toString().padStart(2, '0');
  const month = (ksaDate.getMonth() + 1).toString().padStart(2, '0');
  const year = ksaDate.getFullYear();
  const hours = ksaDate.getHours();
  const minutes = ksaDate.getMinutes().toString().padStart(2, '0');
  const seconds = ksaDate.getSeconds().toString().padStart(2, '0');
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  if (includeSeconds) {
    return `${year}-${month}-${day} ${hour12.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
  }
  return `${day}/${month} ${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

/**
 * Format a UTC ISO timestamp to KSA time only (no date)
 * Format: HH:MM ص/م (Arabic AM/PM)
 */
export const formatKSATimeArabic = (isoString: string | null): string => {
  if (!isoString) return "-";
  
  const ksaDate = convertToKSA(isoString);
  
  const hours = ksaDate.getHours();
  const minutes = ksaDate.getMinutes().toString().padStart(2, '0');
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'م' : 'ص';
  
  return `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

/**
 * Get KSA date formatted for Hijri calendar display
 */
export const getKSAHijriDate = (): string => {
  const ksaDate = getKSADate();
  // Use the correct date parts for Hijri formatting
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(ksaDate);
};

/**
 * Get KSA date formatted for Gregorian display
 */
export const getKSAGregorianDate = (): string => {
  const ksaDate = getKSADate();
  const day = ksaDate.getDate().toString().padStart(2, '0');
  const month = (ksaDate.getMonth() + 1).toString().padStart(2, '0');
  const year = ksaDate.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Get KSA weekday in Arabic
 */
export const getKSAWeekdayArabic = (): string => {
  const ksaDate = getKSADate();
  const weekdays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return weekdays[ksaDate.getDay()];
};

/**
 * Get KSA time formatted for display
 * Format: HH:MM ص/م
 */
export const getKSATimeFormatted = (): string => {
  const ksaDate = getKSADate();
  const hours = ksaDate.getHours();
  const minutes = ksaDate.getMinutes().toString().padStart(2, '0');
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'م' : 'ص';
  return `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

/**
 * Check if a UTC timestamp falls on a specific KSA date
 */
export const isOnKSADate = (isoString: string, ksaDateString: string): boolean => {
  const ksaDate = convertToKSA(isoString);
  const year = ksaDate.getFullYear();
  const month = (ksaDate.getMonth() + 1).toString().padStart(2, '0');
  const day = ksaDate.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}` === ksaDateString;
};

/**
 * Get KSA date/time components for full display
 */
export const getKSADateTimeComponents = () => {
  const ksaDate = getKSADate();
  
  const hours = ksaDate.getHours();
  const minutes = ksaDate.getMinutes().toString().padStart(2, '0');
  const seconds = ksaDate.getSeconds().toString().padStart(2, '0');
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'م' : 'ص';
  
  return {
    date: getKSAGregorianDate(),
    time: `${hour12.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`,
    hijri: getKSAHijriDate(),
    weekday: getKSAWeekdayArabic(),
    fullTime: `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`
  };
};
