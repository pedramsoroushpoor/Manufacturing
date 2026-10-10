/* =====================================================================
   اسکیمای mes — گام ۴: FRM-RM-04 «شیفت و برنامه‌ی حضور»

   پیش‌نیاز: mes_frm_rm01 تا mes_frm_rm03 اجرا شده باشند.
   قاعده‌ی مدل داده همان است که در سرآغاز mes_frm_rm01_setup.sql آمده.

   نگاشت جدول‌های این گام:
     mes.ProductionWorkingShift   = generalmfr.ProductionWorkingShift   (بدون تغییر) — الگوی شیفت
     mes.ProductionCalendar       = generalmfr.ProductionCalendar       (بدون تغییر) — یک ردیف به‌ازای هر روز.
                                    این گام فقط ستون‌های تاریخ را پر می‌کند؛ بقیه با FRM-RM-05
                                    «تقویم تولید» پر می‌شود.
     mes.ProductionCalendarDetail = generalmfr.ProductionCalendarDetail (بدون تغییر) — روز × شیفت × گروه
                                    کاری؛ همان «تقویم گروه‌ها» که از چرخه‌ی شیفت تولید می‌شود.
     mes.ProductionWorkingShiftBreak = جدید — استراحت‌های شیفت (شیفت شکسته = استراحت طولانی بدون مزد)
     mes.ShiftRotation، mes.ShiftRotationDay، mes.ShiftRotationAssignment = جدید — چرخه‌ی شیفت و
                                    تخصیص آن به گروه کاری
     mes.PersonnelAbsence         = جدید — غیبت و جایگزین

   فرض‌ها و کدهای موقت تا تأیید/رسیدن کدلیست اصلی:
     FromTime / ToTime / Duration (INT در نسخه‌ی قبل) = دقیقه از نیمه‌شب (۰ تا ۱۴۳۹) و مدت به دقیقه.
       شیفتِ گذرنده از نیمه‌شب: ToTime کوچک‌تر از FromTime.
     AbsenceTypeCode  1 = مرخصی، 2 = غیبت، 3 = آموزش/مأموریت
     ProductionCalendar.WorkDayTypeCode  1 = روز کاری، 2 = تعطیل (فعلاً فقط جمعه)

   فاز اول فقط فیچرهای الزامی را می‌پوشاند: F-RM-024، 025، 026.
   F-RM-027 (دریافت حضور و غیاب واقعی از HR — اولویت «مهم»، فاز ۳) جدول ندارد.
   این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */
IF OBJECT_ID('mes.ProductionWorkingShift','U') IS NULL
CREATE TABLE mes.ProductionWorkingShift (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionWorkingShift PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  ValidFromDate DATE NULL,
  ValidToDate DATE NULL,
  FromTime INT NULL CONSTRAINT DF_mes_ProductionWorkingShift_FromTime DEFAULT (0),
  ToTime INT NULL CONSTRAINT DF_mes_ProductionWorkingShift_ToTime DEFAULT (0),
  Duration INT NULL
);

IF OBJECT_ID('mes.ProductionWorkingShiftBreak','U') IS NULL
CREATE TABLE mes.ProductionWorkingShiftBreak (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionWorkingShiftBreak PRIMARY KEY,
  WorkingShiftId BIGINT NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  FromTime INT NOT NULL,
  ToTime INT NOT NULL,
  Duration INT NOT NULL,
  IsPaid BIT NOT NULL CONSTRAINT DF_mes_ProductionWorkingShiftBreak_IsPaid DEFAULT (0)
);

IF OBJECT_ID('mes.ProductionCalendar','U') IS NULL
CREATE TABLE mes.ProductionCalendar (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionCalendar PRIMARY KEY,
  UniqueId BIGINT NULL,
  SiteId BIGINT NULL,
  Description NVARCHAR(400) NULL,
  ShamsiDate NVARCHAR(10) NULL,
  GregorianDate DATE NULL,
  CalendarDayTypeCode INT NULL,
  DayofYear INT NULL,
  WorkDayTypeCode INT NULL,
  ManufacturingDay INT NULL,
  QuantityTypeCode INT NULL CONSTRAINT DF_mes_ProductionCalendar_QuantityTypeCode DEFAULT (30091),
  ProductionCapacity DECIMAL(20,2) NULL CONSTRAINT DF_mes_ProductionCalendar_ProductionCapacity DEFAULT (24),
  YearId BIGINT NULL,
  MonthCode INT NULL,
  DayofMonth INT NULL,
  DayCode INT NULL,
  WeekofYear INT NULL,
  DayofWeek INT NULL
);

IF OBJECT_ID('mes.ProductionCalendarDetail','U') IS NULL
CREATE TABLE mes.ProductionCalendarDetail (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionCalendarDetail PRIMARY KEY,
  ProductionCalendarId BIGINT NOT NULL,
  WorkingShiftId BIGINT NOT NULL,
  WorkingGroupId BIGINT NULL,
  FromTime INT NOT NULL CONSTRAINT DF_mes_ProductionCalendarDetail_FromTime DEFAULT (0),
  ToTime INT NOT NULL CONSTRAINT DF_mes_ProductionCalendarDetail_ToTime DEFAULT (0),
  Duration INT NOT NULL CONSTRAINT DF_mes_ProductionCalendarDetail_Duration DEFAULT (0)
);

IF OBJECT_ID('mes.ShiftRotation','U') IS NULL
CREATE TABLE mes.ShiftRotation (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ShiftRotation PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  CycleDays INT NOT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ShiftRotationDay','U') IS NULL
CREATE TABLE mes.ShiftRotationDay (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ShiftRotationDay PRIMARY KEY,
  ShiftRotationId BIGINT NOT NULL,
  DayNo INT NOT NULL,
  WorkingShiftId BIGINT NULL
);

IF OBJECT_ID('mes.ShiftRotationAssignment','U') IS NULL
CREATE TABLE mes.ShiftRotationAssignment (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ShiftRotationAssignment PRIMARY KEY,
  ShiftRotationId BIGINT NOT NULL,
  WorkingGroupId BIGINT NOT NULL,
  ValidFromDate DATE NOT NULL,
  ValidToDate DATE NULL,
  OffsetDays INT NOT NULL CONSTRAINT DF_mes_ShiftRotationAssignment_OffsetDays DEFAULT (0)
);

IF OBJECT_ID('mes.PersonnelAbsence','U') IS NULL
CREATE TABLE mes.PersonnelAbsence (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_PersonnelAbsence PRIMARY KEY,
  PersonnelPartyId BIGINT NOT NULL,
  AbsenceDate DATE NOT NULL,
  AbsenceTypeCode INT NOT NULL CONSTRAINT CK_mes_PersonnelAbsence_Type CHECK (AbsenceTypeCode IN (1, 2, 3)),
  SubstitutePartyId BIGINT NULL,
  Description NVARCHAR(400) NULL
);
GO

/* -------------------------------------------------------------------
   بخش ۲ — ستون‌های استاندارد پایان جدول، برای هر جدول mes که هنوز ندارد.
   ------------------------------------------------------------------- */
DECLARE @t SYSNAME, @sql NVARCHAR(MAX);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('mes');
OPEN c; FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH('mes.' + @t, 'RowVersion') IS NULL
  BEGIN
    SET @sql = N'ALTER TABLE mes.' + QUOTENAME(@t) + N' ADD
      CompanyId  BIGINT NOT NULL,
      BranchId   BIGINT NOT NULL CONSTRAINT ' + QUOTENAME('DF_mes_' + @t + '_BranchId') + N' DEFAULT (100),
      RecGuid    UNIQUEIDENTIFIER NOT NULL CONSTRAINT ' + QUOTENAME('DF_mes_' + @t + '_RecGuid') + N' DEFAULT (NEWID()),
      OwnerId    BIGINT NOT NULL CONSTRAINT ' + QUOTENAME('DF_mes_' + @t + '_OwnerId') + N' DEFAULT (1),
      CreatedBy  BIGINT NOT NULL CONSTRAINT ' + QUOTENAME('DF_mes_' + @t + '_CreatedBy') + N' DEFAULT (1),
      CreatedOn  DATETIME NOT NULL CONSTRAINT ' + QUOTENAME('DF_mes_' + @t + '_CreatedOn') + N' DEFAULT (GETDATE()),
      ModifiedBy BIGINT NOT NULL CONSTRAINT ' + QUOTENAME('DF_mes_' + @t + '_ModifiedBy') + N' DEFAULT (1),
      ModifiedOn DATETIME NULL CONSTRAINT ' + QUOTENAME('DF_mes_' + @t + '_ModifiedOn') + N' DEFAULT (GETDATE()),
      StateCode  INT NOT NULL CONSTRAINT ' + QUOTENAME('DF_mes_' + @t + '_StateCode') + N' DEFAULT (1),
      IsDeleted  BIT NOT NULL CONSTRAINT ' + QUOTENAME('DF_mes_' + @t + '_IsDeleted') + N' DEFAULT (0),
      RowVersion TIMESTAMP NOT NULL;';
    EXEC (@sql);
  END
  FETCH NEXT FROM c INTO @t;
END
CLOSE c; DEALLOCATE c;
GO

/* -------------------------------------------------------------------
   بخش ۳ — تابع دامنه‌ی انتخاب برای گروه کاری
   ------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION mes.fnWorkingGroupsInScope (@OrgNodeId BIGINT, @LineId BIGINT, @StationId BIGINT)
RETURNS TABLE
AS
RETURN
(
  /* همان قاعده‌ی mes.GetWorkingGroupsInScope: گروه در دامنه است اگر محل تخصیصش
     در دامنه باشد. در سطح ایستگاه فقط گروهِ همان ایستگاه؛ گروهِ بدون تخصیص فقط
     در سطح گره‌ی سازمانی. */
  SELECT g.Id AS WorkingGroupId
  FROM mes.ProductionWorkingGroup g
  LEFT JOIN mes.WorkCenter w ON w.Id = g.WorkCenterId
  LEFT JOIN mes.ProductionLine al ON al.Id = ISNULL(g.ProductionLineId, w.ProductionLineId)
  WHERE g.IsDeleted = 0
    AND (
      (@StationId IS NOT NULL AND g.WorkCenterId = @StationId)
      OR (@StationId IS NULL AND @LineId IS NOT NULL AND al.Id = @LineId)
      OR (@StationId IS NULL AND @LineId IS NULL AND (al.Id IS NULL
          OR al.OrgNodeId IN (SELECT OrgNodeId FROM mes.fnOrgNodesUnder(@OrgNodeId))))
    )
);
GO

/* -------------------------------------------------------------------
   بخش ۴ — تولید خودکار تقویم گروه‌ها از چرخه‌ی شیفت (F-RM-025)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GenerateShiftCalendar
  @CompanyId BIGINT, @FromDate DATE, @ToDate DATE
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  IF @ToDate < @FromDate OR DATEDIFF(DAY, @FromDate, @ToDate) > 400
    THROW 50001, N'بازه‌ی تاریخ نامعتبر است (حداکثر ۴۰۰ روز).', 1;

  BEGIN TRAN;
  /* ۱) ردیف روز در تقویم، اگر نیست. DayofWeek: شنبه = ۱ … جمعه = ۷ (مستقل از DATEFIRST). */
  ;WITH d AS (
    SELECT @FromDate AS dt
    UNION ALL SELECT DATEADD(DAY, 1, dt) FROM d WHERE dt < @ToDate
  )
  INSERT mes.ProductionCalendar (CompanyId, GregorianDate, ShamsiDate, DayofWeek, WorkDayTypeCode)
  SELECT @CompanyId, d.dt, FORMAT(d.dt, 'yyyy/MM/dd', 'fa-IR'),
         (DATEDIFF(DAY, '2000-01-01', d.dt) % 7) + 1,
         CASE WHEN (DATEDIFF(DAY, '2000-01-01', d.dt) % 7) + 1 = 7 THEN 2 ELSE 1 END
  FROM d
  WHERE NOT EXISTS (SELECT 1 FROM mes.ProductionCalendar c
                    WHERE c.CompanyId = @CompanyId AND c.GregorianDate = d.dt AND c.IsDeleted = 0)
  OPTION (MAXRECURSION 400);

  /* ۲) تقویم قبلیِ همین بازه برای گروه‌هایی که چرخه دارند کنار می‌رود و از نو ساخته می‌شود. */
  DELETE cd
  FROM mes.ProductionCalendarDetail cd
  JOIN mes.ProductionCalendar c ON c.Id = cd.ProductionCalendarId
  WHERE c.CompanyId = @CompanyId AND c.GregorianDate BETWEEN @FromDate AND @ToDate
    AND cd.WorkingGroupId IN (SELECT WorkingGroupId FROM mes.ShiftRotationAssignment WHERE IsDeleted = 0 AND CompanyId = @CompanyId);

  /* ۳) روزِ چرخه = (فاصله از تاریخ شروع تخصیص + جابه‌جایی) به پیمانه‌ی طول چرخه. روزِ بدون شیفت = استراحت. */
  INSERT mes.ProductionCalendarDetail (CompanyId, ProductionCalendarId, WorkingShiftId, WorkingGroupId, FromTime, ToTime, Duration)
  SELECT @CompanyId, c.Id, s.Id, a.WorkingGroupId, s.FromTime, s.ToTime, s.Duration
  FROM mes.ShiftRotationAssignment a
  JOIN mes.ShiftRotation r ON r.Id = a.ShiftRotationId AND r.IsDeleted = 0
  JOIN mes.ProductionCalendar c ON c.CompanyId = @CompanyId AND c.IsDeleted = 0
       AND c.GregorianDate BETWEEN @FromDate AND @ToDate
       AND c.GregorianDate >= a.ValidFromDate AND (a.ValidToDate IS NULL OR c.GregorianDate <= a.ValidToDate)
  JOIN mes.ShiftRotationDay rd ON rd.ShiftRotationId = r.Id AND rd.IsDeleted = 0
       AND rd.DayNo = ((DATEDIFF(DAY, a.ValidFromDate, c.GregorianDate) + a.OffsetDays) % r.CycleDays) + 1
  JOIN mes.ProductionWorkingShift s ON s.Id = rd.WorkingShiftId AND s.IsDeleted = 0
  WHERE a.IsDeleted = 0 AND a.CompanyId = @CompanyId;
  COMMIT;
END
GO

/* -------------------------------------------------------------------
   بخش ۵ — رویه‌های خواندن (شناسه‌ها INT برمی‌گردند تا در JSON عدد بمانند)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetWorkingShifts
AS
BEGIN
  SET NOCOUNT ON;
  /* مدت خالص = مدت شیفت منهای استراحت‌های بدون مزد. «شکسته» = استراحت بدون مزدِ دو ساعت به بالا. */
  SELECT CAST(s.Id AS INT) AS ShiftId, s.Number AS Code, s.Name AS Title,
         s.FromTime, s.ToTime, s.Duration AS GrossMinutes,
         ISNULL(b.UnpaidMinutes, 0) AS UnpaidBreakMinutes,
         s.Duration - ISNULL(b.UnpaidMinutes, 0) AS NetMinutes,
         CAST(CASE WHEN s.ToTime < s.FromTime THEN 1 ELSE 0 END AS BIT) AS CrossesMidnight,
         CAST(CASE WHEN ISNULL(b.LongestUnpaid, 0) >= 120 THEN 1 ELSE 0 END AS BIT) AS IsSplit,
         s.ValidFromDate, s.ValidToDate
  FROM mes.ProductionWorkingShift s
  OUTER APPLY (
    SELECT SUM(CASE WHEN x.IsPaid = 0 THEN x.Duration ELSE 0 END) AS UnpaidMinutes,
           MAX(CASE WHEN x.IsPaid = 0 THEN x.Duration ELSE 0 END) AS LongestUnpaid
    FROM mes.ProductionWorkingShiftBreak x WHERE x.WorkingShiftId = s.Id AND x.IsDeleted = 0
  ) b
  WHERE s.IsDeleted = 0
  ORDER BY s.FromTime, s.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetWorkingShiftBreaks
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(b.WorkingShiftId AS INT) AS ShiftId, b.Name AS Title, b.FromTime, b.ToTime, b.Duration AS Minutes, b.IsPaid
  FROM mes.ProductionWorkingShiftBreak b
  WHERE b.IsDeleted = 0
  ORDER BY b.WorkingShiftId, b.Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetShiftRotationDays
AS
BEGIN
  SET NOCOUNT ON;
  /* یک ردیف به‌ازای هر روزِ هر چرخه؛ ShiftId خالی یعنی روز استراحت. */
  SELECT CAST(r.Id AS INT) AS RotationId, r.Number AS Code, r.Name AS Title, r.CycleDays, r.Description,
         d.DayNo, CAST(s.Id AS INT) AS ShiftId, s.Number AS ShiftCode, s.Name AS ShiftTitle
  FROM mes.ShiftRotation r
  JOIN mes.ShiftRotationDay d ON d.ShiftRotationId = r.Id AND d.IsDeleted = 0
  LEFT JOIN mes.ProductionWorkingShift s ON s.Id = d.WorkingShiftId AND s.IsDeleted = 0
  WHERE r.IsDeleted = 0
  ORDER BY r.Number, d.DayNo;
END
GO

CREATE OR ALTER PROCEDURE mes.GetShiftRotationAssignmentsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(a.Id AS INT) AS AssignmentId, CAST(g.Id AS INT) AS WorkingGroupId, g.Number AS GroupCode, g.Name AS GroupTitle,
         CAST(r.Id AS INT) AS RotationId, r.Number AS RotationCode, r.Name AS RotationTitle, r.CycleDays,
         a.ValidFromDate, a.ValidToDate, a.OffsetDays
  FROM mes.ShiftRotationAssignment a
  JOIN mes.ProductionWorkingGroup g ON g.Id = a.WorkingGroupId AND g.IsDeleted = 0
  JOIN mes.ShiftRotation r ON r.Id = a.ShiftRotationId AND r.IsDeleted = 0
  WHERE a.IsDeleted = 0
    AND a.WorkingGroupId IN (SELECT WorkingGroupId FROM mes.fnWorkingGroupsInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY g.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetShiftRosterInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL,
  @FromDate DATE = NULL, @Days INT = 14
AS
BEGIN
  SET NOCOUNT ON;
  SET @FromDate = ISNULL(@FromDate, CAST(GETDATE() AS DATE));
  DECLARE @ToDate DATE = DATEADD(DAY, @Days - 1, @FromDate);
  /* یک ردیف به‌ازای هر «روز × گروه»ی که شیفت دارد. اثر غیبت بر ظرفیت:
     حاضر = عضو جاری گروه − غایبِ آن روز + جایگزین‌هایی که برای غایبان همان گروه ثبت شده. */
  SELECT c.GregorianDate AS CalendarDate, c.ShamsiDate, c.DayofWeek AS DayOfWeek, c.WorkDayTypeCode,
         CAST(g.Id AS INT) AS WorkingGroupId, g.Number AS GroupCode, g.Name AS GroupTitle,
         CAST(s.Id AS INT) AS ShiftId, s.Number AS ShiftCode, s.Name AS ShiftTitle, cd.FromTime, cd.ToTime,
         ISNULL(m.PlannedCount, 0) AS PlannedCount, ISNULL(ab.AbsentCount, 0) AS AbsentCount,
         ISNULL(ab.SubstituteCount, 0) AS SubstituteCount,
         ISNULL(m.PlannedCount, 0) - ISNULL(ab.AbsentCount, 0) + ISNULL(ab.SubstituteCount, 0) AS AvailableCount
  FROM mes.ProductionCalendarDetail cd
  JOIN mes.ProductionCalendar c ON c.Id = cd.ProductionCalendarId AND c.IsDeleted = 0
  JOIN mes.ProductionWorkingGroup g ON g.Id = cd.WorkingGroupId AND g.IsDeleted = 0
  JOIN mes.ProductionWorkingShift s ON s.Id = cd.WorkingShiftId
  OUTER APPLY (
    SELECT COUNT(*) AS PlannedCount
    FROM mes.ProductionPersonnelGroupMapping pm
    WHERE pm.WorkingGroupId = g.Id AND pm.IsDeleted = 0
      AND pm.ValidFromDate <= c.GregorianDate AND (pm.ValidToDate IS NULL OR pm.ValidToDate >= c.GregorianDate)
  ) m
  OUTER APPLY (
    SELECT COUNT(*) AS AbsentCount, COUNT(a.SubstitutePartyId) AS SubstituteCount
    FROM mes.PersonnelAbsence a
    JOIN mes.ProductionPersonnelGroupMapping pm ON pm.PersonnelPartyId = a.PersonnelPartyId AND pm.WorkingGroupId = g.Id
         AND pm.IsDeleted = 0 AND pm.ValidFromDate <= c.GregorianDate AND (pm.ValidToDate IS NULL OR pm.ValidToDate >= c.GregorianDate)
    WHERE a.AbsenceDate = c.GregorianDate AND a.IsDeleted = 0
  ) ab
  WHERE cd.IsDeleted = 0 AND c.GregorianDate BETWEEN @FromDate AND @ToDate
    AND g.Id IN (SELECT WorkingGroupId FROM mes.fnWorkingGroupsInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY g.Number, c.GregorianDate;
END
GO

CREATE OR ALTER PROCEDURE mes.GetAbsencesInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL,
  @FromDate DATE = NULL, @Days INT = 14
AS
BEGIN
  SET NOCOUNT ON;
  SET @FromDate = ISNULL(@FromDate, CAST(GETDATE() AS DATE));
  DECLARE @ToDate DATE = DATEADD(DAY, @Days - 1, @FromDate);
  /* غیبت‌های بازه برای نفراتی که آن روز عضو یکی از گروه‌های دامنه‌اند. شیفتِ آن
     روز از تقویم گروه خوانده می‌شود؛ خالی یعنی گروه آن روز استراحت بوده. */
  SELECT CAST(a.Id AS INT) AS AbsenceId, a.AbsenceDate, a.AbsenceTypeCode,
         CASE a.AbsenceTypeCode WHEN 1 THEN 'leave' WHEN 3 THEN 'training' ELSE 'absent' END AS AbsenceType,
         p.Number AS PersonnelCode, p.Name AS PersonnelTitle, g.Name AS GroupTitle,
         sh.ShiftTitle, sub.Name AS SubstituteTitle, a.Description
  FROM mes.PersonnelAbsence a
  JOIN mes.ProductionPersonnel p ON p.Id = a.PersonnelPartyId AND p.IsDeleted = 0
  JOIN mes.ProductionPersonnelGroupMapping pm ON pm.PersonnelPartyId = p.Id AND pm.IsDeleted = 0
       AND pm.ValidFromDate <= a.AbsenceDate AND (pm.ValidToDate IS NULL OR pm.ValidToDate >= a.AbsenceDate)
  JOIN mes.ProductionWorkingGroup g ON g.Id = pm.WorkingGroupId AND g.IsDeleted = 0
  LEFT JOIN mes.ProductionPersonnel sub ON sub.Id = a.SubstitutePartyId
  OUTER APPLY (
    SELECT TOP 1 s.Name AS ShiftTitle
    FROM mes.ProductionCalendarDetail cd
    JOIN mes.ProductionCalendar c ON c.Id = cd.ProductionCalendarId AND c.IsDeleted = 0
    JOIN mes.ProductionWorkingShift s ON s.Id = cd.WorkingShiftId
    WHERE cd.WorkingGroupId = g.Id AND cd.IsDeleted = 0 AND c.GregorianDate = a.AbsenceDate
  ) sh
  WHERE a.IsDeleted = 0 AND a.AbsenceDate BETWEEN @FromDate AND @ToDate
    AND g.Id IN (SELECT WorkingGroupId FROM mes.fnWorkingGroupsInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY a.AbsenceDate, p.Number;
END
GO

/* -------------------------------------------------------------------
   بخش ۶ — داده‌ی نمونه (شرکت ۲۲۲). فقط وقتی جدول شیفت خالی است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductionWorkingShift)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  INSERT mes.ProductionWorkingShift (CompanyId, Number, Name, ValidFromDate, FromTime, ToTime, Duration) VALUES
    (@C, N'SH-M', N'صبح',          '2026-03-21',  360,  840, 480),
    (@C, N'SH-E', N'عصر',          '2026-03-21',  840, 1320, 480),
    (@C, N'SH-N', N'شب',           '2026-03-21', 1320,  360, 480),
    (@C, N'SH-D', N'روزکار',       '2026-03-21',  480, 1020, 540),
    (@C, N'SH-S', N'روزکار شکسته', '2026-03-21',  420, 1140, 720);

  INSERT mes.ProductionWorkingShiftBreak (CompanyId, WorkingShiftId, Name, FromTime, ToTime, Duration, IsPaid)
  SELECT @C, s.Id, v.Name, v.FromTime, v.ToTime, v.Duration, v.IsPaid
  FROM (VALUES
    (N'SH-M', N'صبحانه',            540,  560,  20, 1), (N'SH-M', N'استراحت',  720,  735, 15, 1),
    (N'SH-E', N'استراحت',          1020, 1035,  15, 1), (N'SH-E', N'شام',     1170, 1200, 30, 1),
    (N'SH-N', N'استراحت شب',         90,  120,  30, 1),
    (N'SH-D', N'ناهار و نماز',      720,  780,  60, 0),
    (N'SH-S', N'فاصله‌ی میان‌شیفت', 660,  900, 240, 0)
  ) v(ShiftNo, Name, FromTime, ToTime, Duration, IsPaid)
  JOIN mes.ProductionWorkingShift s ON s.Number = v.ShiftNo;

  INSERT mes.ShiftRotation (CompanyId, Number, Name, CycleDays, Description) VALUES
    (@C, N'ROT-DAY', N'روزکار — جمعه تعطیل',   7, N'شش روز کار، جمعه استراحت'),
    (@C, N'ROT-3G',  N'سه‌شیفت گردشی',          8, N'دو صبح، دو عصر، دو شب، دو روز استراحت'),
    (@C, N'ROT-42',  N'۴-۲ صبح‌کار',            6, N'چهار روز صبح، دو روز استراحت');

  INSERT mes.ShiftRotationDay (CompanyId, ShiftRotationId, DayNo, WorkingShiftId)
  SELECT @C, r.Id, v.DayNo, s.Id
  FROM (VALUES
    (N'ROT-DAY', 1, N'SH-D'), (N'ROT-DAY', 2, N'SH-D'), (N'ROT-DAY', 3, N'SH-D'), (N'ROT-DAY', 4, N'SH-D'),
    (N'ROT-DAY', 5, N'SH-D'), (N'ROT-DAY', 6, N'SH-D'), (N'ROT-DAY', 7, NULL),
    (N'ROT-3G', 1, N'SH-M'), (N'ROT-3G', 2, N'SH-M'), (N'ROT-3G', 3, N'SH-E'), (N'ROT-3G', 4, N'SH-E'),
    (N'ROT-3G', 5, N'SH-N'), (N'ROT-3G', 6, N'SH-N'), (N'ROT-3G', 7, NULL),    (N'ROT-3G', 8, NULL),
    (N'ROT-42', 1, N'SH-M'), (N'ROT-42', 2, N'SH-M'), (N'ROT-42', 3, N'SH-M'), (N'ROT-42', 4, N'SH-M'),
    (N'ROT-42', 5, NULL),    (N'ROT-42', 6, NULL)
  ) v(RotNo, DayNo, ShiftNo)
  JOIN mes.ShiftRotation r ON r.Number = v.RotNo
  LEFT JOIN mes.ProductionWorkingShift s ON s.Number = v.ShiftNo;

  /* روزکار از شنبه ۱۴۰۵/۰۷/۱۱ (2026-10-03) شروع می‌شود تا روز هفتمِ چرخه جمعه بیفتد. */
  INSERT mes.ShiftRotationAssignment (CompanyId, ShiftRotationId, WorkingGroupId, ValidFromDate, OffsetDays)
  SELECT @C, r.Id, g.Id, '2026-10-03', v.OffsetDays
  FROM (VALUES (N'ROT-DAY', N'TEAM-L1', 0), (N'ROT-3G', N'TEAM-L2', 0), (N'ROT-3G', N'TEAM-PRS', 4)) v(RotNo, TeamNo, OffsetDays)
  JOIN mes.ShiftRotation r ON r.Number = v.RotNo
  JOIN mes.ProductionWorkingGroup g ON g.Number = v.TeamNo;

  INSERT mes.PersonnelAbsence (CompanyId, PersonnelPartyId, AbsenceDate, AbsenceTypeCode, SubstitutePartyId, Description)
  SELECT @C, p.Id, v.AbsenceDate, v.TypeCode, s.Id, v.Description
  FROM (VALUES
    (N'10604', CAST('2026-10-08' AS DATE), 1, N'10790', N'مرخصی استحقاقی'),
    (N'10733', '2026-10-06', 2, NULL,     N'غیبت بدون اطلاع قبلی'),
    (N'10902', '2026-10-07', 3, NULL,     N'دوره‌ی بازآموزی GMP')
  ) v(PersonNo, AbsenceDate, TypeCode, SubNo, Description)
  JOIN mes.ProductionPersonnel p ON p.Number = v.PersonNo
  LEFT JOIN mes.ProductionPersonnel s ON s.Number = v.SubNo;
  COMMIT;

  /* تقویم گروه‌ها برای ۹۰ روز از شروع تخصیص ساخته می‌شود. */
  EXEC mes.GenerateShiftCalendar @CompanyId = 222, @FromDate = '2026-10-03', @ToDate = '2026-12-31';
END
GO
