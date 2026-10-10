/* =====================================================================
   اسکیمای mes — گام ۵: FRM-RM-05 «تقویم تولید»

   پیش‌نیاز: mes_frm_rm01 تا mes_frm_rm04 اجرا شده باشند (ردیف‌های روز در
   mes.ProductionCalendar را گام ۴ می‌سازد).
   قاعده‌ی مدل داده همان است که در سرآغاز mes_frm_rm01_setup.sql آمده.

   نگاشت جدول‌های این گام:
     mes.ProductionCalendar        = generalmfr.ProductionCalendar (از گام ۴، بدون تغییر)
     mes.ProductionShutdownDetail  = generalmfr.ProductionShutdownDetail
                                     + WorkCenterId، RequestedByTitle — توقف برنامه‌ریزی‌شده (رزرو نت)
                                     روی همان تقویم؛ تقویم موازی برای نت ساخته نمی‌شود.
     mes.ProductionCalendarRule    = جدید — تعریف تقویم پایه در هر سطح (گره‌ی سازمانی، خط یا ایستگاه).
                                     ارث‌بری: هر خط نزدیک‌ترین تعریف را از خودش به بالا می‌گیرد.
     mes.ProductionCalendarException = جدید — استثنا با وضعیت تأیید

   فرض‌ها و کدهای موقت تا تأیید/رسیدن کدلیست اصلی:
     زمان‌ها = دقیقه از نیمه‌شب (مثل گام ۴).
     WorkDaysMask: بیت ۰ = شنبه … بیت ۶ = جمعه (۶۳ = شنبه تا پنجشنبه).
     ExceptionTypeCode   1 = تعطیل رسمی، 2 = تعطیلی فوق‌العاده، 3 = روز کاری فوق‌العاده
     ApprovalStatusCode  1 = در انتظار تأیید، 2 = تأییدشده، 3 = ردشده — فقط تأییدشده اثر دارد.
     ShutdownTypeCode    1 = نت پیشگیرانه، 2 = تعمیر اساسی، 3 = توقف برنامه‌ای غیر نت
     تعطیل رسمی روی تقویم پیوسته (۲۴/۷) اثر ندارد؛ تعطیلی فوق‌العاده روی همه اثر دارد.

   تقویم مؤثر در سطح «خط × روز» و با جمع دقیقه‌ها حساب می‌شود:
     در دسترس = کمینه‌ی (پایه، شیفت) − تعطیلی جزئی − رزرو نت.
     هم‌پوشانی ساعتیِ بازه‌ها هنوز حساب نمی‌شود.

   فاز اول: F-RM-030، 031، 032، 033، 034، 037. ویرایش روی گانت (035) و سناریو (036)
   اولویت «مهم» و فاز ۳ دارند و نیامده‌اند. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */
IF OBJECT_ID('mes.ProductionCalendarRule','U') IS NULL
CREATE TABLE mes.ProductionCalendarRule (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionCalendarRule PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  OrgNodeId BIGINT NULL,
  ProductionLineId BIGINT NULL,
  WorkCenterId BIGINT NULL,
  WorkDaysMask INT NOT NULL CONSTRAINT DF_mes_ProductionCalendarRule_WorkDaysMask DEFAULT (63),
  FromTime INT NOT NULL CONSTRAINT DF_mes_ProductionCalendarRule_FromTime DEFAULT (0),
  ToTime INT NOT NULL CONSTRAINT DF_mes_ProductionCalendarRule_ToTime DEFAULT (0),
  Is24x7 BIT NOT NULL CONSTRAINT DF_mes_ProductionCalendarRule_Is24x7 DEFAULT (0),
  CampaignDays INT NULL,
  ValidFromDate DATE NULL,
  ValidToDate DATE NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionCalendarException','U') IS NULL
CREATE TABLE mes.ProductionCalendarException (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionCalendarException PRIMARY KEY,
  OrgNodeId BIGINT NULL,
  ProductionLineId BIGINT NULL,
  WorkCenterId BIGINT NULL,
  FromDate DATE NOT NULL,
  ToDate DATE NOT NULL,
  ExceptionTypeCode INT NOT NULL CONSTRAINT CK_mes_ProductionCalendarException_Type CHECK (ExceptionTypeCode IN (1, 2, 3)),
  FromTime INT NULL,
  ToTime INT NULL,
  Description NVARCHAR(400) NULL,
  ApprovalStatusCode INT NOT NULL CONSTRAINT DF_mes_ProductionCalendarException_Approval DEFAULT (1)
    CONSTRAINT CK_mes_ProductionCalendarException_Approval CHECK (ApprovalStatusCode IN (1, 2, 3)),
  RequestedByTitle NVARCHAR(256) NULL,
  ApprovedByTitle NVARCHAR(256) NULL
);

IF OBJECT_ID('mes.ProductionShutdownDetail','U') IS NULL
CREATE TABLE mes.ProductionShutdownDetail (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionShutdownDetail PRIMARY KEY,
  ProductionCalendarId BIGINT NOT NULL,
  SiteId BIGINT NULL,
  ProductionLineId BIGINT NULL,
  ShutdownTypeCode INT NOT NULL,
  Description NVARCHAR(400) NULL,
  PlannedStartTime INT NOT NULL CONSTRAINT DF_mes_ProductionShutdownDetail_PlannedStartTime DEFAULT (0),
  PlannedEndTime INT NULL CONSTRAINT DF_mes_ProductionShutdownDetail_PlannedEndTime DEFAULT (0),
  PlannedDuration INT NULL CONSTRAINT DF_mes_ProductionShutdownDetail_PlannedDuration DEFAULT (0),
  ActualStartTime INT NULL CONSTRAINT DF_mes_ProductionShutdownDetail_ActualStartTime DEFAULT (0),
  ActualEndTime INT NULL CONSTRAINT DF_mes_ProductionShutdownDetail_ActualEndTime DEFAULT (0),
  ActualDuration INT NULL CONSTRAINT DF_mes_ProductionShutdownDetail_ActualDuration DEFAULT (0),
  WorkCenterId BIGINT NULL,
  RequestedByTitle NVARCHAR(256) NULL
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
   بخش ۳ — توابع ارث‌بری
   ------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION mes.fnLineOrgNodes ()
RETURNS TABLE
AS
RETURN
(
  /* هر خط با همه‌ی گره‌های سازمانی بالاسرش. Depth = ۱ برای واحدِ خودِ خط و به بالا بیشتر می‌شود. */
  WITH anc AS (
    SELECT l.Id AS LineId, l.OrgNodeId, 1 AS Depth
    FROM mes.ProductionLine l WHERE l.IsDeleted = 0
    UNION ALL
    SELECT a.LineId, n.ParentId, a.Depth + 1
    FROM anc a JOIN mes.OrgNode n ON n.Id = a.OrgNodeId
    WHERE n.ParentId IS NOT NULL
  )
  SELECT LineId, OrgNodeId, Depth FROM anc
);
GO

CREATE OR ALTER FUNCTION mes.fnLineCalendarRule ()
RETURNS TABLE
AS
RETURN
(
  /* قاعده‌ی ارث‌بری تقویم: تعریفِ خودِ خط (Depth = ۰) برنده است؛ وگرنه نزدیک‌ترین
     تعریف روی گره‌های سازمانی بالاسر. خطی که هیچ تعریفی به آن نمی‌رسد در خروجی نیست. */
  SELECT x.LineId, x.RuleId, x.Depth
  FROM (
    SELECT c.LineId, c.RuleId, c.Depth, ROW_NUMBER() OVER (PARTITION BY c.LineId ORDER BY c.Depth) AS rn
    FROM (
      SELECT l.Id AS LineId, r.Id AS RuleId, 0 AS Depth
      FROM mes.ProductionLine l
      JOIN mes.ProductionCalendarRule r ON r.ProductionLineId = l.Id AND r.WorkCenterId IS NULL AND r.IsDeleted = 0
      WHERE l.IsDeleted = 0
      UNION ALL
      SELECT a.LineId, r.Id, a.Depth
      FROM mes.fnLineOrgNodes() a
      JOIN mes.ProductionCalendarRule r ON r.OrgNodeId = a.OrgNodeId AND r.ProductionLineId IS NULL
           AND r.WorkCenterId IS NULL AND r.IsDeleted = 0
    ) c
  ) x
  WHERE x.rn = 1
);
GO

/* -------------------------------------------------------------------
   بخش ۴ — رویه‌های خواندن (شناسه‌ها INT برمی‌گردند تا در JSON عدد بمانند)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetCalendarRules
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(r.Id AS INT) AS RuleId, r.Number AS Code, r.Name AS Title,
         CASE WHEN r.WorkCenterId IS NOT NULL THEN 'station' WHEN r.ProductionLineId IS NOT NULL THEN 'line' ELSE 'org' END AS LevelKind,
         n.LevelCode AS OrgLevelCode,
         COALESCE(w.Number + N' — ' + w.Name, l.Name, n.Name) AS LevelTitle,
         r.WorkDaysMask, r.FromTime, r.ToTime, r.Is24x7, r.CampaignDays, r.ValidFromDate, r.ValidToDate, r.Description
  FROM mes.ProductionCalendarRule r
  LEFT JOIN mes.OrgNode n ON n.Id = r.OrgNodeId
  LEFT JOIN mes.ProductionLine l ON l.Id = r.ProductionLineId
  LEFT JOIN mes.WorkCenter w ON w.Id = r.WorkCenterId
  WHERE r.IsDeleted = 0
  ORDER BY CASE WHEN r.WorkCenterId IS NOT NULL THEN 3 WHEN r.ProductionLineId IS NOT NULL THEN 2 ELSE 1 END, r.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetCalendarInheritanceInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  /* برای هر خطِ دامنه: کدام تعریف تقویم به آن می‌رسد و از کدام سطح. */
  SELECT CAST(l.Id AS INT) AS LineId, l.Name AS LineTitle,
         CAST(r.Id AS INT) AS RuleId, r.Number AS RuleCode, r.Name AS RuleTitle,
         CAST(CASE WHEN lr.Depth > 0 THEN 1 ELSE 0 END AS BIT) AS IsInherited,
         CASE WHEN lr.Depth = 0 THEN N'خودِ خط' ELSE n.Name END AS SourceTitle,
         CASE WHEN lr.Depth = 0 THEN 'Line' ELSE n.LevelCode END AS SourceLevelCode
  FROM mes.ProductionLine l
  LEFT JOIN mes.fnLineCalendarRule() lr ON lr.LineId = l.Id
  LEFT JOIN mes.ProductionCalendarRule r ON r.Id = lr.RuleId
  LEFT JOIN mes.OrgNode n ON n.Id = r.OrgNodeId
  WHERE l.Id IN (SELECT LineId FROM mes.fnLinesInScope(@OrgNodeId, @LineId))
  ORDER BY l.Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetEffectiveCalendarInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL,
  @FromDate DATE = NULL, @Days INT = 14
AS
BEGIN
  SET NOCOUNT ON;
  SET @FromDate = ISNULL(@FromDate, CAST(GETDATE() AS DATE));
  DECLARE @ToDate DATE = DATEADD(DAY, @Days - 1, @FromDate);

  /* یک ردیف به‌ازای هر «خط × روز». لایه‌ها و منشأ هر کدام:
       پایه     تعریف تقویمِ به‌ارث‌رسیده + استثناهای تأییدشده (BaseOrigin می‌گوید چرا)
       شیفت     تقویم گروه‌های کاریِ همان خط (گام ۴)
       استثنا   تعطیلی جزئیِ تأییدشده
       نت       توقف‌های رزروشده روی همان روز
       نفر      حاضر / برنامه‌ای (اثر غیبت و جایگزین)
     در دسترس = کمینه‌ی (پایه، شیفت) − تعطیلی جزئی − نت. */
  SELECT d.GregorianDate AS CalendarDate, d.DayofWeek AS DayOfWeek,
         CAST(ln.LineId AS INT) AS LineId, ln.LineTitle,
         b.BaseMinutes, b.BaseOrigin,
         ISNULL(sh.ShiftMinutes, 0) AS ShiftMinutes,
         CASE WHEN b.BaseMinutes > 0 THEN ISNULL(ex.PartialClosureMinutes, 0) ELSE 0 END AS ExceptionMinutes,
         ISNULL(mt.MaintenanceMinutes, 0) AS MaintenanceMinutes,
         ISNULL(hd.PlannedCount, 0) AS PlannedCount, ISNULL(hd.AvailableCount, 0) AS AvailableCount,
         CASE WHEN e.Net < 0 THEN 0 ELSE e.Net END AS EffectiveMinutes,
         CASE WHEN b.BaseMinutes > ISNULL(sh.ShiftMinutes, 0) THEN b.BaseMinutes - ISNULL(sh.ShiftMinutes, 0) ELSE 0 END AS FreeMinutes
  FROM (
    SELECT l.Id AS LineId, l.Name AS LineTitle, r.Id AS RuleId, r.Is24x7, r.WorkDaysMask,
           CASE WHEN r.Is24x7 = 1 THEN 1440 ELSE r.ToTime - r.FromTime END AS RuleMinutes
    FROM mes.ProductionLine l
    LEFT JOIN mes.fnLineCalendarRule() lr ON lr.LineId = l.Id
    LEFT JOIN mes.ProductionCalendarRule r ON r.Id = lr.RuleId
    WHERE l.Id IN (SELECT LineId FROM mes.fnLinesInScope(@OrgNodeId, @LineId))
  ) ln
  CROSS JOIN (
    SELECT c.Id AS CalendarId, c.GregorianDate, c.DayofWeek
    FROM mes.ProductionCalendar c
    WHERE c.IsDeleted = 0 AND c.GregorianDate BETWEEN @FromDate AND @ToDate
  ) d
  OUTER APPLY (
    /* استثناهای تأییدشده‌ای که به این خط می‌رسند: روی خودِ خط یا روی گره‌های بالاسرش */
    SELECT MAX(CASE WHEN x.ExceptionTypeCode = 1 THEN 1 ELSE 0 END) AS HasHoliday,
           MAX(CASE WHEN x.ExceptionTypeCode = 2 AND x.FromTime IS NULL THEN 1 ELSE 0 END) AS HasFullClosure,
           SUM(CASE WHEN x.ExceptionTypeCode = 2 AND x.FromTime IS NOT NULL THEN x.ToTime - x.FromTime ELSE 0 END) AS PartialClosureMinutes,
           MAX(CASE WHEN x.ExceptionTypeCode = 3 THEN ISNULL(x.ToTime - x.FromTime, -1) END) AS ExtraMinutes
    FROM mes.ProductionCalendarException x
    WHERE x.IsDeleted = 0 AND x.ApprovalStatusCode = 2 AND d.GregorianDate BETWEEN x.FromDate AND x.ToDate
      AND (x.ProductionLineId = ln.LineId
        OR (x.ProductionLineId IS NULL AND x.WorkCenterId IS NULL
            AND x.OrgNodeId IN (SELECT a.OrgNodeId FROM mes.fnLineOrgNodes() a WHERE a.LineId = ln.LineId)))
  ) ex
  CROSS APPLY (
    SELECT CASE WHEN ln.RuleId IS NULL THEN 0
                WHEN ex.HasFullClosure = 1 THEN 0
                WHEN ex.HasHoliday = 1 AND ln.Is24x7 = 0 THEN 0
                WHEN ln.Is24x7 = 1 OR (ln.WorkDaysMask & POWER(2, d.DayofWeek - 1)) <> 0 THEN ln.RuleMinutes
                WHEN ex.ExtraMinutes IS NOT NULL THEN CASE WHEN ex.ExtraMinutes < 0 THEN ln.RuleMinutes ELSE ex.ExtraMinutes END
                ELSE 0 END AS BaseMinutes,
           CASE WHEN ln.RuleId IS NULL THEN 'no-rule'
                WHEN ex.HasFullClosure = 1 THEN 'closure'
                WHEN ex.HasHoliday = 1 AND ln.Is24x7 = 0 THEN 'holiday'
                WHEN ln.Is24x7 = 1 OR (ln.WorkDaysMask & POWER(2, d.DayofWeek - 1)) <> 0 THEN 'rule'
                WHEN ex.ExtraMinutes IS NOT NULL THEN 'extra-day'
                ELSE 'weekend' END AS BaseOrigin
  ) b
  OUTER APPLY (
    /* شیفت‌های متمایزِ آن روز برای گروه‌های کاریِ خط (گروهِ کل خط یا گروهِ یکی از ایستگاه‌هایش) */
    SELECT SUM(s.Duration) AS ShiftMinutes
    FROM (
      SELECT DISTINCT cd.WorkingShiftId, cd.Duration
      FROM mes.ProductionCalendarDetail cd
      JOIN mes.ProductionWorkingGroup g ON g.Id = cd.WorkingGroupId AND g.IsDeleted = 0
      LEFT JOIN mes.WorkCenter gw ON gw.Id = g.WorkCenterId
      WHERE cd.ProductionCalendarId = d.CalendarId AND cd.IsDeleted = 0
        AND ISNULL(g.ProductionLineId, gw.ProductionLineId) = ln.LineId
    ) s
  ) sh
  OUTER APPLY (
    SELECT SUM(ISNULL(m.PlannedDuration, 0)) AS MaintenanceMinutes
    FROM mes.ProductionShutdownDetail m
    WHERE m.ProductionCalendarId = d.CalendarId AND m.IsDeleted = 0 AND m.ProductionLineId = ln.LineId
  ) mt
  OUTER APPLY (
    SELECT SUM(q.PlannedCount) AS PlannedCount, SUM(q.PlannedCount - q.AbsentCount + q.SubstituteCount) AS AvailableCount
    FROM (
      SELECT (SELECT COUNT(*) FROM mes.ProductionPersonnelGroupMapping pm
              WHERE pm.WorkingGroupId = g.Id AND pm.IsDeleted = 0 AND pm.ValidFromDate <= d.GregorianDate
                AND (pm.ValidToDate IS NULL OR pm.ValidToDate >= d.GregorianDate)) AS PlannedCount,
             (SELECT COUNT(*) FROM mes.PersonnelAbsence a
              JOIN mes.ProductionPersonnelGroupMapping pm ON pm.PersonnelPartyId = a.PersonnelPartyId AND pm.WorkingGroupId = g.Id AND pm.IsDeleted = 0
              WHERE a.AbsenceDate = d.GregorianDate AND a.IsDeleted = 0) AS AbsentCount,
             (SELECT COUNT(a.SubstitutePartyId) FROM mes.PersonnelAbsence a
              JOIN mes.ProductionPersonnelGroupMapping pm ON pm.PersonnelPartyId = a.PersonnelPartyId AND pm.WorkingGroupId = g.Id AND pm.IsDeleted = 0
              WHERE a.AbsenceDate = d.GregorianDate AND a.IsDeleted = 0) AS SubstituteCount
      FROM mes.ProductionCalendarDetail cd
      JOIN mes.ProductionWorkingGroup g ON g.Id = cd.WorkingGroupId AND g.IsDeleted = 0
      LEFT JOIN mes.WorkCenter gw ON gw.Id = g.WorkCenterId
      WHERE cd.ProductionCalendarId = d.CalendarId AND cd.IsDeleted = 0
        AND ISNULL(g.ProductionLineId, gw.ProductionLineId) = ln.LineId
    ) q
  ) hd
  CROSS APPLY (
    SELECT CASE WHEN b.BaseMinutes < ISNULL(sh.ShiftMinutes, 0) THEN b.BaseMinutes ELSE ISNULL(sh.ShiftMinutes, 0) END
           - CASE WHEN b.BaseMinutes > 0 THEN ISNULL(ex.PartialClosureMinutes, 0) ELSE 0 END
           - ISNULL(mt.MaintenanceMinutes, 0) AS Net
  ) e
  ORDER BY ln.LineId, d.GregorianDate;
END
GO

CREATE OR ALTER PROCEDURE mes.GetCalendarExceptionsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL,
  @FromDate DATE = NULL, @Days INT = 14
AS
BEGIN
  SET NOCOUNT ON;
  SET @FromDate = ISNULL(@FromDate, CAST(GETDATE() AS DATE));
  DECLARE @ToDate DATE = DATEADD(DAY, @Days - 1, @FromDate);
  /* استثناهایی که در بازه می‌افتند و به دست‌کم یکی از خطوط دامنه می‌رسند، با هر وضعیت تأیید. */
  SELECT CAST(x.Id AS INT) AS ExceptionId, x.FromDate, x.ToDate, x.ExceptionTypeCode, x.FromTime, x.ToTime,
         x.ApprovalStatusCode, x.Description, x.RequestedByTitle, x.ApprovedByTitle,
         COALESCE(l.Name, n.Name) AS ScopeTitle,
         CASE WHEN x.ProductionLineId IS NOT NULL THEN 'Line' ELSE n.LevelCode END AS ScopeLevelCode,
         af.AffectedLines
  FROM mes.ProductionCalendarException x
  LEFT JOIN mes.ProductionLine l ON l.Id = x.ProductionLineId
  LEFT JOIN mes.OrgNode n ON n.Id = x.OrgNodeId
  CROSS APPLY (
    SELECT COUNT(*) AS AffectedLines
    FROM mes.fnLinesInScope(@OrgNodeId, @LineId) s
    WHERE x.ProductionLineId = s.LineId
       OR (x.ProductionLineId IS NULL AND x.OrgNodeId IN (SELECT a.OrgNodeId FROM mes.fnLineOrgNodes() a WHERE a.LineId = s.LineId))
  ) af
  WHERE x.IsDeleted = 0 AND x.FromDate <= @ToDate AND x.ToDate >= @FromDate AND af.AffectedLines > 0
  ORDER BY x.FromDate, x.Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetShutdownsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL,
  @FromDate DATE = NULL, @Days INT = 14
AS
BEGIN
  SET NOCOUNT ON;
  SET @FromDate = ISNULL(@FromDate, CAST(GETDATE() AS DATE));
  DECLARE @ToDate DATE = DATEADD(DAY, @Days - 1, @FromDate);
  SELECT CAST(m.Id AS INT) AS ShutdownId, c.GregorianDate AS CalendarDate, m.ShutdownTypeCode,
         l.Name AS LineTitle, w.Number AS StationCode, w.Name AS StationTitle,
         m.PlannedStartTime, m.PlannedEndTime, m.PlannedDuration, m.Description, m.RequestedByTitle
  FROM mes.ProductionShutdownDetail m
  JOIN mes.ProductionCalendar c ON c.Id = m.ProductionCalendarId AND c.IsDeleted = 0
  LEFT JOIN mes.ProductionLine l ON l.Id = m.ProductionLineId
  LEFT JOIN mes.WorkCenter w ON w.Id = m.WorkCenterId
  WHERE m.IsDeleted = 0 AND c.GregorianDate BETWEEN @FromDate AND @ToDate
    AND m.ProductionLineId IN (SELECT LineId FROM mes.fnLinesInScope(@OrgNodeId, @LineId))
    AND (@StationId IS NULL OR m.WorkCenterId IS NULL OR m.WorkCenterId = @StationId)
  ORDER BY c.GregorianDate, m.PlannedStartTime;
END
GO

/* -------------------------------------------------------------------
   بخش ۵ — داده‌ی نمونه (شرکت ۲۲۲). فقط وقتی جدول تعریف تقویم خالی است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductionCalendarRule)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @company BIGINT = (SELECT TOP 1 Id FROM mes.OrgNode WHERE LevelCode = 'Company');
  DECLARE @factory BIGINT = (SELECT TOP 1 Id FROM mes.OrgNode WHERE LevelCode = 'Factory');
  DECLARE @L1 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۱');
  DECLARE @L2 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۲');

  INSERT mes.ProductionCalendarRule (CompanyId, Number, Name, OrgNodeId, ProductionLineId, WorkDaysMask, FromTime, ToTime, Is24x7, CampaignDays, ValidFromDate, Description) VALUES
    (@C, N'CAL-CO',  N'تقویم پایه‌ی شرکت',     @company, NULL, 63, 480, 1020, 0, NULL, '2026-03-21', N'شنبه تا پنجشنبه، ۰۸:۰۰ تا ۱۷:۰۰؛ جمعه تعطیل'),
    (@C, N'CAL-L2',  N'تقویم پیوسته‌ی خط ۲',   NULL,     @L2, 127,   0,    0, 1, 28,   '2026-03-21', N'تولید پیوسته ۲۴/۷ با کمپین ۲۸روزه');

  INSERT mes.ProductionCalendarException (CompanyId, OrgNodeId, ProductionLineId, FromDate, ToDate, ExceptionTypeCode, FromTime, ToTime, Description, ApprovalStatusCode, RequestedByTitle, ApprovedByTitle) VALUES
    (@C, @company, NULL, '2026-10-12', '2026-10-12', 1, NULL, NULL, N'تعطیل رسمی (نمونه)',                    2, N'برنامه‌ریز تولید', N'مدیر تولید'),
    (@C, @factory, NULL, '2026-10-14', '2026-10-14', 2,  480,  720, N'قطعی برنامه‌ای برق کارخانه',            2, N'برنامه‌ریز تولید', N'مدیر تولید'),
    (@C, NULL,     @L1,  '2026-10-16', '2026-10-16', 3,  480,  780, N'جمعه‌کاری برای جبران عقب‌افتادگی خط ۱', 1, N'سرپرست خط ۱',     NULL),
    (@C, @factory, NULL, '2026-10-24', '2026-10-24', 2, NULL, NULL, N'ضدعفونی سالانه‌ی کارخانه',              2, N'برنامه‌ریز تولید', N'مدیر تولید');

  INSERT mes.ProductionShutdownDetail (CompanyId, ProductionCalendarId, ProductionLineId, WorkCenterId, ShutdownTypeCode, Description, PlannedStartTime, PlannedEndTime, PlannedDuration, RequestedByTitle)
  SELECT @C, c.Id, v.LineId, w.Id, v.TypeCode, v.Description, v.StartTime, v.EndTime, v.EndTime - v.StartTime, N'کارشناس نت'
  FROM (VALUES
    (CAST('2026-10-10' AS DATE), @L2, N'40', 1, N'سرویس دوره‌ای دستگاه کوتینگ',   480, 720),
    ('2026-10-13',               @L1, N'30', 1, N'تعویض قالب و تنظیم پرس',        840, 1020),
    ('2026-10-19',               @L2, NULL,  2, N'تعمیر اساسی سیستم هواساز خط ۲', 360, 840)
  ) v(ShutdownDate, LineId, StationNo, TypeCode, Description, StartTime, EndTime)
  JOIN mes.ProductionCalendar c ON c.GregorianDate = v.ShutdownDate AND c.CompanyId = @C AND c.IsDeleted = 0
  LEFT JOIN mes.WorkCenter w ON w.ProductionLineId = v.LineId AND w.Number = v.StationNo;
  COMMIT;
END
GO
