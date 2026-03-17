

## Fix: WFH Check-In Page — Show Cairo Local Time Instead of KSA

### Problem
The WFH Check-In page displays all times in KSA timezone (UTC+3), but the employee working from home is in Cairo (UTC+2). The real-time clock and check-in/check-out times all show KSA time, which is 1 hour ahead of their actual local time.

### Solution
Change the WFH Check-In page to display times in **Cairo timezone (Africa/Cairo, UTC+2)** instead of KSA:

### Changes in `src/pages/WFHCheckIn.tsx`

1. **Real-time clock** (line 30, 35): Replace `getKSATimeFormatted()` with a Cairo-timezone formatted time using `toLocaleTimeString('ar-SA', { timeZone: 'Africa/Cairo' })`

2. **`formatTime` function** (line 158-163): Change `timeZone: 'Asia/Riyadh'` → `timeZone: 'Africa/Cairo'`

3. **Date header** (line 207): Add Cairo timezone label so users know the displayed time is Cairo local time

The check-in date (`checkin_date`) will still use KSA date via `getKSADateString()` to stay consistent with the rest of the system's date logic. Only the **displayed time** changes to Cairo.

