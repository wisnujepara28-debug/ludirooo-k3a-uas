# Security Specification — HRM Backoffice & Mobile PWA

## 1. Data Invariants
1. **Admin Authority**: Only verified admins (`wisnujepara28@gmail.com` with `email_verified == true` or documents in `/admins/{uid}`) may create, update, or delete `/positions`, `/workSchedules`, `/payrolls`, `/admins`, or arbitrary `/employees` records.
2. **PII Isolation**: Regular employees may only `get` or `list` `/employees`, `/attendance`, and `/payrolls` documents where `resource.data.authUid == request.auth.uid` or `resource.data.email == request.auth.token.email` (`employeeEmail` for attendance/payrolls). Blanket `list` queries are rejected at the rule level.
3. **Referential Integrity & Rate Locking**: Self-registered employees must reference an existing `/positions/{positionId}` and their `dailyRate` / `dailyAllowance` must match the official values on that position. Attendance creation verifies the referenced `/employees/{employeeId}` exists and enforces `dailyRateSnapshot == employee.dailyRate`.
4. **Terminal State Locking**: Once an attendance record has `hasClockOut == true`, an employee cannot re-modify it; only an Admin can override or adjust verification status.
5. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation, and `updatedAt` must equal `request.time` on update while `createdAt` remains immutable.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: Read `/employees/emp-1` with `auth == null`.
2. **Unverified Email Write**: Create `/attendance/att-1` with `email_verified: false`.
3. **Privilege Escalation (Self-Admin)**: Non-admin writes `/admins/{uid}` to grant themselves admin access.
4. **Blanket Employee Scrape**: Non-admin executes `list` on `/employees` without `where('email', '==', ...)` or `where('authUid', '==', ...)`.
5. **Cross-User Attendance Forgery**: Employee A attempts to create `/attendance/att-b` with `employeeId` belonging to Employee B.
6. **Salary Manipulation on Self-Registration**: Employee creates `/employees/emp-self` with `dailyRate: 99999999` differing from `/positions/{positionId}.dailyRate`.
7. **Shadow Field Injection**: Employee updates `/attendance/att-1` adding `"isBonus": true` or `"verificationStatus": "Terverifikasi"`.
8. **Post-ClockOut Tampering**: Employee updates `/attendance/att-1` where `hasClockOut == true` to alter `clockOutTime`.
9. **Resource Exhaustion / ID Poisoning**: Write to `/positions/<200-char-invalid-id!@#>` or send a `>250KB` photo string or `>100` char name.
10. **Timestamp Spoofing**: Create `/attendance/att-1` with client-supplied `createdAt` in the past (`2020-01-01`).
11. **Non-Admin Payroll Generation**: Employee attempts to create or mark `/payrolls/pay-1` as `Dibayarkan`.
12. **Immutable Field Mutation**: Employee updates `/employees/emp-self` trying to change `createdAt` or `dailyRate`.
