/* =====================================================================
   اسکیمای mes — گام ۳: FRM-RM-03 «نیروی کار و ماتریس مهارت»

   پیش‌نیاز: mes_frm_rm01_setup.sql و mes_frm_rm02_setup.sql اجرا شده باشند.
   قاعده‌ی مدل داده همان است که در سرآغاز mes_frm_rm01_setup.sql آمده.

   نگاشت جدول‌های این گام:
     mes.ProductionPersonnelGroup        = generalmfr.ProductionPersonnelGroup        (بدون تغییر)
     mes.ProductionPersonnelGroupMapping = generalmfr.ProductionPersonnelGroupMapping (بدون تغییر)
                                           — عضویت نفر در گروه پرسنلی و گروه کاری، با بازه‌ی اعتبار
     mes.ProductionWorkingGroup          = generalmfr.ProductionWorkingGroup
                                           + ProductionLineId، WorkCenterId (تخصیص گروه به خط یا ایستگاه)،
                                             HeadPartyId، Description
     mes.WorkCenterLabor                 = generalmfr.WorkCenterLabor                 (بدون تغییر)
                                           — تخصیص نفر به ایستگاه با درصد اشتغال
     mes.ProductionOperationGroup        = generalmfr.ProductionOperationGroup        (بدون تغییر)
     mes.ProductionOperation             = generalmfr.ProductionOperation             (بدون تغییر)
     mes.ProductionPersonnel             = جدید — جانشین موقت «اصلِ پرسنل». در نسخه‌ی قبل
                                           PersonnelPartyId به جدولی بیرون از mfr/generalmfr
                                           (سیستم منابع انسانی) اشاره می‌کند که در این دیتابیس
                                           نیست. Id این جدول همان PersonnelPartyId است. وقتی HR
                                           وصل شود این جدول با آن جایگزین یا هم‌گام می‌شود.
     mes.Skill، mes.PersonnelSkill، mes.OperationSkillRequirement = جدید (بدون معادل)

   کدهای موقت تا رسیدن کدلیست اصلی:
     SkillLevelCode       1 = کارآموز، 2 = با نظارت، 3 = مستقل، 4 = مربی
     EnforcementModeCode  1 = هشدار، 2 = منع
     ProductionOperation.LaborClassCode با مقدار 1 پر شده و هنوز استفاده نمی‌شود.

   فاز اول فقط فیچرهای الزامی را می‌پوشاند: F-RM-020، 021، 022، 023، 029.
   F-RM-028 (نرخ ساعتی و محرک هزینه — اولویت «مهم»، فاز ۳) جدول ندارد.
   این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */
IF OBJECT_ID('mes.ProductionPersonnel','U') IS NULL
CREATE TABLE mes.ProductionPersonnel (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionPersonnel PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  PostTitle NVARCHAR(256) NULL,
  OrgNodeId BIGINT NOT NULL,
  MaxConcurrentWorkCenters INT NOT NULL CONSTRAINT DF_mes_ProductionPersonnel_MaxConcurrent DEFAULT (1),
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionPersonnel_IsActive DEFAULT (1)
);

IF OBJECT_ID('mes.ProductionPersonnelGroup','U') IS NULL
CREATE TABLE mes.ProductionPersonnelGroup (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionPersonnelGroup PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  PostSerialNumber BIGINT NULL,
  ParentId BIGINT NULL,
  Level SMALLINT NULL,
  Chain HIERARCHYID NULL
);

IF OBJECT_ID('mes.ProductionWorkingGroup','U') IS NULL
CREATE TABLE mes.ProductionWorkingGroup (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionWorkingGroup PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  ProductionLineId BIGINT NULL,
  WorkCenterId BIGINT NULL,
  HeadPartyId BIGINT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionPersonnelGroupMapping','U') IS NULL
CREATE TABLE mes.ProductionPersonnelGroupMapping (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionPersonnelGroupMapping PRIMARY KEY,
  PersonnelGroupId BIGINT NOT NULL,
  PersonnelPartyId BIGINT NOT NULL,
  WorkingGroupId BIGINT NULL,
  ValidFromDate DATE NOT NULL,
  ValidToDate DATE NULL
);

IF OBJECT_ID('mes.WorkCenterLabor','U') IS NULL
CREATE TABLE mes.WorkCenterLabor (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkCenterLabor PRIMARY KEY,
  WorkCenterId BIGINT NOT NULL,
  PersonnelPartyId BIGINT NOT NULL,
  IsHeadMember BIT NOT NULL CONSTRAINT DF_mes_WorkCenterLabor_IsHeadMember DEFAULT (0),
  MemberFromDate DATE NOT NULL,
  MemberToDate DATE NULL,
  EngagementPercent DECIMAL(6,2) NOT NULL CONSTRAINT DF_mes_WorkCenterLabor_Engagement DEFAULT (100)
);

IF OBJECT_ID('mes.ProductionOperationGroup','U') IS NULL
CREATE TABLE mes.ProductionOperationGroup (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionOperationGroup PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionOperation','U') IS NULL
CREATE TABLE mes.ProductionOperation (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionOperation PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  OperationGroupId BIGINT NOT NULL,
  LaborClassCode INT NOT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.Skill','U') IS NULL
CREATE TABLE mes.Skill (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_Skill PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  SkillCategoryTitle NVARCHAR(128) NULL,
  IsOperational BIT NOT NULL CONSTRAINT DF_mes_Skill_IsOperational DEFAULT (1),
  RetrainingIntervalMonths INT NULL,
  Description NVARCHAR(400) NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_Skill_IsActive DEFAULT (1)
);

IF OBJECT_ID('mes.PersonnelSkill','U') IS NULL
CREATE TABLE mes.PersonnelSkill (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_PersonnelSkill PRIMARY KEY,
  PersonnelPartyId BIGINT NOT NULL,
  SkillId BIGINT NOT NULL,
  SkillLevelCode INT NOT NULL CONSTRAINT CK_mes_PersonnelSkill_Level CHECK (SkillLevelCode BETWEEN 1 AND 4),
  ValidFromDate DATE NOT NULL,
  ValidToDate DATE NULL,
  RetrainingDueDate DATE NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.OperationSkillRequirement','U') IS NULL
CREATE TABLE mes.OperationSkillRequirement (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_OperationSkillRequirement PRIMARY KEY,
  OperationId BIGINT NOT NULL,
  SkillId BIGINT NOT NULL,
  MinSkillLevelCode INT NOT NULL CONSTRAINT CK_mes_OperationSkillRequirement_Level CHECK (MinSkillLevelCode BETWEEN 1 AND 4),
  EnforcementModeCode INT NOT NULL CONSTRAINT CK_mes_OperationSkillRequirement_Mode CHECK (EnforcementModeCode IN (1, 2)),
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
   بخش ۳ — تابع دامنه‌ی انتخاب
   ------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION mes.fnPersonnelInScope (@OrgNodeId BIGINT, @LineId BIGINT, @StationId BIGINT)
RETURNS TABLE
AS
RETURN
(
  /* پرسنل در «دامنه‌ی انتخاب» — دقیق‌ترین سطحی که داده شده برنده است:
     ایستگاه، بعد خط، بعد گره‌ی سازمانی (با همه‌ی زیرگره‌هایش).
     در سطح خط/ایستگاه، نفر از دو راه در دامنه است: تخصیص جاری‌اش به ایستگاه
     (WorkCenterLabor) یا عضویت جاری در گروه کاری‌ای که به آن خط/ایستگاه تخصیص
     دارد. در سطح ایستگاه فقط گروهی شمرده می‌شود که به خودِ همان ایستگاه تخصیص
     دارد؛ گروهِ کل خط در سطح خط دیده می‌شود. */
  SELECT p.Id AS PersonnelId
  FROM mes.ProductionPersonnel p
  WHERE p.IsDeleted = 0
    AND (
      (@StationId IS NULL AND @LineId IS NULL
        AND p.OrgNodeId IN (SELECT OrgNodeId FROM mes.fnOrgNodesUnder(@OrgNodeId)))
      OR ((@StationId IS NOT NULL OR @LineId IS NOT NULL) AND (
        EXISTS (
          SELECT 1 FROM mes.WorkCenterLabor x
          JOIN mes.WorkCenter w ON w.Id = x.WorkCenterId
          WHERE x.PersonnelPartyId = p.Id AND x.IsDeleted = 0
            AND (x.MemberToDate IS NULL OR x.MemberToDate >= CAST(GETDATE() AS DATE))
            AND ((@StationId IS NOT NULL AND w.Id = @StationId)
              OR (@StationId IS NULL AND w.ProductionLineId = @LineId)))
        OR EXISTS (
          SELECT 1 FROM mes.ProductionPersonnelGroupMapping m
          JOIN mes.ProductionWorkingGroup g ON g.Id = m.WorkingGroupId AND g.IsDeleted = 0
          LEFT JOIN mes.WorkCenter gw ON gw.Id = g.WorkCenterId
          WHERE m.PersonnelPartyId = p.Id AND m.IsDeleted = 0
            AND (m.ValidToDate IS NULL OR m.ValidToDate >= CAST(GETDATE() AS DATE))
            AND ((@StationId IS NOT NULL AND g.WorkCenterId = @StationId)
              OR (@StationId IS NULL AND (g.ProductionLineId = @LineId OR gw.ProductionLineId = @LineId))))
      ))
    )
);
GO

/* -------------------------------------------------------------------
   بخش ۴ — رویه‌ها (شناسه‌ها INT برمی‌گردند تا در JSON عدد بمانند)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetPersonnelInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(GETDATE() AS DATE);
  SELECT CAST(p.Id AS INT) AS PersonnelId, p.Number AS Code, p.Name AS Title, p.PostTitle,
         n.Name AS OrgNodeTitle, grp.PersonnelGroupTitle, CAST(grp.WorkingGroupId AS INT) AS WorkingGroupId, grp.WorkingGroupTitle,
         ISNULL(st.StationCount, 0) AS StationCount, st.StationsText,
         CAST(ISNULL(st.EngagementTotal, 0) AS DECIMAL(9,2)) AS EngagementTotal,
         ISNULL(sk.ValidSkillCount, 0) AS ValidSkillCount,
         ISNULL(sk.IndependentSkillCount, 0) AS IndependentSkillCount,
         sk.NextRetrainingDate,
         p.MaxConcurrentWorkCenters AS MaxConcurrentStations,
         CAST(ISNULL(p.IsActive, 1) AS BIT) AS IsActive
  FROM mes.ProductionPersonnel p
  JOIN mes.OrgNode n ON n.Id = p.OrgNodeId
  OUTER APPLY (
    /* عضویت جاری در گروه پرسنلی و گروه کاری */
    SELECT TOP 1 pg.Name AS PersonnelGroupTitle, wg.Id AS WorkingGroupId, wg.Name AS WorkingGroupTitle
    FROM mes.ProductionPersonnelGroupMapping m
    JOIN mes.ProductionPersonnelGroup pg ON pg.Id = m.PersonnelGroupId
    LEFT JOIN mes.ProductionWorkingGroup wg ON wg.Id = m.WorkingGroupId AND wg.IsDeleted = 0
    WHERE m.PersonnelPartyId = p.Id AND m.IsDeleted = 0 AND (m.ValidToDate IS NULL OR m.ValidToDate >= @today)
    ORDER BY m.ValidFromDate DESC, m.Id DESC
  ) grp
  OUTER APPLY (
    SELECT COUNT(*) AS StationCount, SUM(x.EngagementPercent) AS EngagementTotal,
           STRING_AGG(CAST(l.Name + N' · ' + w.Number AS NVARCHAR(MAX)), N'، ') WITHIN GROUP (ORDER BY l.Id, w.SequenceNo) AS StationsText
    FROM mes.WorkCenterLabor x
    JOIN mes.WorkCenter w ON w.Id = x.WorkCenterId
    JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
    WHERE x.PersonnelPartyId = p.Id AND x.IsDeleted = 0 AND (x.MemberToDate IS NULL OR x.MemberToDate >= @today)
  ) st
  OUTER APPLY (
    /* مهارت معتبر = منقضی‌نشده. «مستقل» = سطح ۳ به بالا در مهارت عملیاتی. */
    SELECT COUNT(*) AS ValidSkillCount,
           SUM(CASE WHEN s.IsOperational = 1 AND ps.SkillLevelCode >= 3 THEN 1 ELSE 0 END) AS IndependentSkillCount,
           MIN(ps.RetrainingDueDate) AS NextRetrainingDate
    FROM mes.PersonnelSkill ps
    JOIN mes.Skill s ON s.Id = ps.SkillId AND s.IsDeleted = 0
    WHERE ps.PersonnelPartyId = p.Id AND ps.IsDeleted = 0 AND (ps.ValidToDate IS NULL OR ps.ValidToDate >= @today)
  ) sk
  WHERE p.Id IN (SELECT PersonnelId FROM mes.fnPersonnelInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY p.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetSkillsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(GETDATE() AS DATE);
  /* کاتالوگ مهارت مشترک است؛ فقط شمارش دارندگان به دامنه‌ی انتخاب محدود می‌شود. */
  SELECT CAST(s.Id AS INT) AS SkillId, s.Number AS Code, s.Name AS Title, s.SkillCategoryTitle AS Category,
         s.IsOperational, s.RetrainingIntervalMonths, s.Description,
         ISNULL(h.HolderCount, 0) AS HolderCount, ISNULL(h.IndependentCount, 0) AS IndependentCount,
         CAST(ISNULL(s.IsActive, 1) AS BIT) AS IsActive
  FROM mes.Skill s
  OUTER APPLY (
    SELECT COUNT(*) AS HolderCount, SUM(CASE WHEN ps.SkillLevelCode >= 3 THEN 1 ELSE 0 END) AS IndependentCount
    FROM mes.PersonnelSkill ps
    WHERE ps.SkillId = s.Id AND ps.IsDeleted = 0 AND (ps.ValidToDate IS NULL OR ps.ValidToDate >= @today)
      AND ps.PersonnelPartyId IN (SELECT PersonnelId FROM mes.fnPersonnelInScope(@OrgNodeId, @LineId, @StationId))
  ) h
  WHERE s.IsDeleted = 0
  ORDER BY s.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetPersonnelSkillsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(GETDATE() AS DATE);
  DECLARE @soon DATE = DATEADD(DAY, 30, @today);
  /* وضعیت اعتبار: expired = تاریخ اعتبار گذشته؛ retraining = موعد بازآموزی گذشته؛
     expiring = یکی از این دو تا ۳۰ روز دیگر می‌رسد؛ valid = بقیه. */
  SELECT CAST(ps.PersonnelPartyId AS INT) AS PersonnelId, CAST(ps.SkillId AS INT) AS SkillId,
         ps.SkillLevelCode AS LevelCode, ps.ValidFromDate, ps.ValidToDate, ps.RetrainingDueDate,
         CASE WHEN ps.ValidToDate < @today THEN 'expired'
              WHEN ps.RetrainingDueDate <= @today THEN 'retraining'
              WHEN ps.ValidToDate <= @soon OR ps.RetrainingDueDate <= @soon THEN 'expiring'
              ELSE 'valid' END AS ValidityStatus
  FROM mes.PersonnelSkill ps
  JOIN mes.Skill s ON s.Id = ps.SkillId AND s.IsDeleted = 0
  WHERE ps.IsDeleted = 0
    AND ps.PersonnelPartyId IN (SELECT PersonnelId FROM mes.fnPersonnelInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY ps.PersonnelPartyId, ps.SkillId;
END
GO

CREATE OR ALTER PROCEDURE mes.GetOperationSkillRequirementsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(GETDATE() AS DATE);
  /* الزام‌ها مشترک‌اند؛ «تعداد واجد شرایط» در دامنه‌ی انتخاب شمرده می‌شود:
     نفری که همان مهارت را با سطح کافی و اعتبار نگذشته دارد. */
  SELECT CAST(r.Id AS INT) AS RequirementId, o.Number AS OperationCode, o.Name AS OperationTitle,
         CAST(s.Id AS INT) AS SkillId, s.Number AS SkillCode, s.Name AS SkillTitle,
         r.MinSkillLevelCode AS MinLevel,
         CASE r.EnforcementModeCode WHEN 2 THEN 'block' ELSE 'warn' END AS EnforcementMode,
         ISNULL(q.QualifiedCount, 0) AS QualifiedCount, r.Description
  FROM mes.OperationSkillRequirement r
  JOIN mes.ProductionOperation o ON o.Id = r.OperationId AND o.IsDeleted = 0
  JOIN mes.Skill s ON s.Id = r.SkillId AND s.IsDeleted = 0
  OUTER APPLY (
    SELECT COUNT(DISTINCT ps.PersonnelPartyId) AS QualifiedCount
    FROM mes.PersonnelSkill ps
    WHERE ps.SkillId = r.SkillId AND ps.IsDeleted = 0 AND ps.SkillLevelCode >= r.MinSkillLevelCode
      AND (ps.ValidToDate IS NULL OR ps.ValidToDate >= @today)
      AND ps.PersonnelPartyId IN (SELECT PersonnelId FROM mes.fnPersonnelInScope(@OrgNodeId, @LineId, @StationId))
  ) q
  WHERE r.IsDeleted = 0
  ORDER BY o.Number, s.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetWorkingGroupsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(GETDATE() AS DATE);
  /* گروه در دامنه است اگر محل تخصیصش در دامنه باشد. در سطح ایستگاه فقط گروهِ
     همان ایستگاه؛ گروهِ بدون تخصیص فقط در سطح گره‌ی سازمانی دیده می‌شود. */
  SELECT CAST(g.Id AS INT) AS WorkingGroupId, g.Number AS Code, g.Name AS Title,
         CAST(al.Id AS INT) AS LineId, al.Name AS LineTitle,
         CAST(w.Id AS INT) AS StationId, w.Number AS StationCode, w.Name AS StationTitle,
         h.Name AS HeadTitle, ISNULL(mm.MemberCount, 0) AS MemberCount, mm.MembersText, g.Description
  FROM mes.ProductionWorkingGroup g
  LEFT JOIN mes.WorkCenter w ON w.Id = g.WorkCenterId
  LEFT JOIN mes.ProductionLine al ON al.Id = ISNULL(g.ProductionLineId, w.ProductionLineId)
  LEFT JOIN mes.ProductionPersonnel h ON h.Id = g.HeadPartyId
  OUTER APPLY (
    SELECT COUNT(*) AS MemberCount,
           STRING_AGG(CAST(p.Name AS NVARCHAR(MAX)), N'، ') WITHIN GROUP (ORDER BY p.Number) AS MembersText
    FROM mes.ProductionPersonnelGroupMapping m
    JOIN mes.ProductionPersonnel p ON p.Id = m.PersonnelPartyId AND p.IsDeleted = 0
    WHERE m.WorkingGroupId = g.Id AND m.IsDeleted = 0 AND (m.ValidToDate IS NULL OR m.ValidToDate >= @today)
  ) mm
  WHERE g.IsDeleted = 0
    AND (
      (@StationId IS NOT NULL AND g.WorkCenterId = @StationId)
      OR (@StationId IS NULL AND @LineId IS NOT NULL AND al.Id = @LineId)
      OR (@StationId IS NULL AND @LineId IS NULL AND (al.Id IS NULL
          OR al.OrgNodeId IN (SELECT OrgNodeId FROM mes.fnOrgNodesUnder(@OrgNodeId))))
    )
  ORDER BY g.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetPersonnelStationsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(GETDATE() AS DATE);
  /* همه‌ی تخصیص‌های جاری نفراتِ دامنه به ایستگاه‌ها — حتی ایستگاه‌های بیرون از
     دامنه، چون محدودیت هم‌زمانی روی کل تخصیص‌های یک نفر سنجیده می‌شود. */
  SELECT CAST(p.Id AS INT) AS PersonnelId, p.Number AS Code, p.Name AS Title,
         p.MaxConcurrentWorkCenters AS MaxConcurrentStations,
         CAST(w.Id AS INT) AS StationId, w.Number AS StationCode, w.Name AS StationTitle, l.Name AS LineTitle,
         x.IsHeadMember, CAST(x.EngagementPercent AS DECIMAL(9,2)) AS EngagementPercent, x.MemberFromDate
  FROM mes.WorkCenterLabor x
  JOIN mes.ProductionPersonnel p ON p.Id = x.PersonnelPartyId AND p.IsDeleted = 0
  JOIN mes.WorkCenter w ON w.Id = x.WorkCenterId
  JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
  WHERE x.IsDeleted = 0 AND (x.MemberToDate IS NULL OR x.MemberToDate >= @today)
    AND p.Id IN (SELECT PersonnelId FROM mes.fnPersonnelInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY p.Number, l.Id, w.SequenceNo;
END
GO

/* -------------------------------------------------------------------
   بخش ۵ — داده‌ی نمونه (شرکت ۲۲۲). فقط وقتی جدول پرسنل خالی است.
   شناسه‌ی ایستگاه‌ها از روی خط و شماره‌ی ایستگاه پیدا می‌شود، نه عدد ثابت.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductionPersonnel)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @solid BIGINT = (SELECT TOP 1 Id FROM mes.OrgNode WHERE Name = N'سالن جامدات');
  DECLARE @semi  BIGINT = (SELECT TOP 1 Id FROM mes.OrgNode WHERE Name LIKE N'سالن نیمه‌جامد%');
  DECLARE @L1 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۱');
  DECLARE @L2 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۲');
  DECLARE @press BIGINT = (SELECT TOP 1 Id FROM mes.WorkCenter WHERE ProductionLineId = @L2 AND Number = N'30A');

  INSERT mes.ProductionPersonnel (CompanyId, Number, Name, PostTitle, OrgNodeId, MaxConcurrentWorkCenters) VALUES
    (@C, N'10482', N'مریم احمدی',  N'اپراتور گرانولاسیون', @solid, 1),
    (@C, N'10511', N'رضا صادقی',   N'اپراتور ارشد پرس',    @solid, 2),
    (@C, N'10604', N'حسین موسوی',  N'اپراتور پرس',         @solid, 1),
    (@C, N'10712', N'فاطمه کاظمی', N'توزین‌کار',            @solid, 2),
    (@C, N'10733', N'علی نجفی',    N'اپراتور بسته‌بندی',    @solid, 1),
    (@C, N'10790', N'سارا طاهری',  N'سرپرست خط',           @solid, 1),
    (@C, N'10815', N'مهدی رحیمی',  N'اپراتور روکش‌دهی',     @solid, 1),
    (@C, N'10841', N'زهرا کریمی',  N'بازرس کیفی',          @solid, 1),
    (@C, N'10902', N'نادر جعفری',  N'اپراتور بسته‌بندی',    @solid, 1),
    (@C, N'10950', N'لیلا شریفی',  N'اپراتور شربت‌سازی',    @semi,  1);

  INSERT mes.ProductionPersonnelGroup (CompanyId, Number, Name, Level) VALUES
    (@C, N'PG-OPR', N'اپراتور تولید', 1), (@C, N'PG-SUP', N'سرپرست', 1), (@C, N'PG-QC', N'بازرس کیفی', 1);

  INSERT mes.ProductionWorkingGroup (CompanyId, Number, Name, ProductionLineId, WorkCenterId, HeadPartyId, Description)
  SELECT @C, v.Number, v.Name, v.LineId, v.StationId, (SELECT Id FROM mes.ProductionPersonnel WHERE Number = v.HeadNo), v.Description
  FROM (VALUES
    (N'TEAM-L1',  N'تیم خط ۱',          @L1, CAST(NULL AS BIGINT), N'10841', N'کل خط قرص‌سازی ۱'),
    (N'TEAM-L2',  N'تیم خط ۲',          @L2, CAST(NULL AS BIGINT), N'10790', N'کل خط قرص‌سازی ۲'),
    (N'TEAM-PRS', N'تیم پرس خط ۲',      CAST(NULL AS BIGINT), @press, N'10511', N'فقط ایستگاه پرس A')
  ) v(Number, Name, LineId, StationId, HeadNo, Description);

  INSERT mes.ProductionPersonnelGroupMapping (CompanyId, PersonnelGroupId, PersonnelPartyId, WorkingGroupId, ValidFromDate)
  SELECT @C, pg.Id, p.Id, wg.Id, '2026-03-21'
  FROM (VALUES
    (N'10482', N'PG-OPR', N'TEAM-L2'), (N'10511', N'PG-OPR', N'TEAM-PRS'), (N'10604', N'PG-OPR', N'TEAM-PRS'),
    (N'10712', N'PG-OPR', N'TEAM-L2'), (N'10733', N'PG-OPR', N'TEAM-L2'),  (N'10790', N'PG-SUP', N'TEAM-L2'),
    (N'10815', N'PG-OPR', N'TEAM-L2'), (N'10841', N'PG-QC',  N'TEAM-L1'),  (N'10902', N'PG-OPR', N'TEAM-L1'),
    (N'10950', N'PG-OPR', NULL)
  ) v(PersonNo, GroupNo, TeamNo)
  JOIN mes.ProductionPersonnel p ON p.Number = v.PersonNo
  JOIN mes.ProductionPersonnelGroup pg ON pg.Number = v.GroupNo
  LEFT JOIN mes.ProductionWorkingGroup wg ON wg.Number = v.TeamNo;

  INSERT mes.WorkCenterLabor (CompanyId, WorkCenterId, PersonnelPartyId, IsHeadMember, MemberFromDate, EngagementPercent)
  SELECT @C, w.Id, p.Id, v.IsHead, '2026-03-21', v.Pct
  FROM (VALUES
    (N'10482', 2, N'20',  0, 100), (N'10511', 2, N'30A', 1, 60), (N'10511', 2, N'30B', 0, 40),
    (N'10604', 2, N'30B', 1, 100), (N'10604', 1, N'30',  0, 50),
    (N'10712', 2, N'10',  0, 50),  (N'10712', 1, N'10',  0, 50),
    (N'10733', 2, N'50',  0, 100), (N'10815', 2, N'40',  1, 100),
    (N'10841', 1, N'40',  1, 100), (N'10902', 1, N'50',  0, 100)
  ) v(PersonNo, LineNum, StationNo, IsHead, Pct)
  JOIN mes.ProductionPersonnel p ON p.Number = v.PersonNo
  JOIN mes.WorkCenter w ON w.Number = v.StationNo AND w.ProductionLineId = CASE v.LineNum WHEN 1 THEN @L1 ELSE @L2 END;

  INSERT mes.Skill (CompanyId, Number, Name, SkillCategoryTitle, IsOperational, RetrainingIntervalMonths) VALUES
    (@C, N'SK-GMP', N'GMP و بهداشت تولید', N'عمومی', 0, 12),
    (@C, N'SK-WGH', N'توزین دقیق',         N'فنی',   1, 24),
    (@C, N'SK-GRN', N'گرانولاسیون',        N'فنی',   1, 24),
    (@C, N'SK-PRS', N'پرس روتاری',         N'فنی',   1, 12),
    (@C, N'SK-COT', N'روکش‌دهی',           N'فنی',   1, 24),
    (@C, N'SK-BLS', N'بلیستر و بسته‌بندی', N'فنی',   1, 24),
    (@C, N'SK-VIS', N'بازرسی بصری',        N'کیفی',  1, 12);

  INSERT mes.PersonnelSkill (CompanyId, PersonnelPartyId, SkillId, SkillLevelCode, ValidFromDate, ValidToDate, RetrainingDueDate)
  SELECT @C, p.Id, s.Id, v.Lvl, '2025-03-21', v.ValidTo, v.Retrain
  FROM (VALUES
    (N'10482', N'SK-GMP', 3, CAST(NULL AS DATE), CAST('2027-03-20' AS DATE)), (N'10482', N'SK-GRN', 4, NULL, '2027-03-20'),
    (N'10482', N'SK-WGH', 2, NULL, '2027-03-20'), (N'10482', N'SK-COT', 2, NULL, '2027-03-20'),
    (N'10511', N'SK-GMP', 3, NULL, '2027-03-20'), (N'10511', N'SK-PRS', 4, NULL, '2026-10-20'),
    (N'10511', N'SK-GRN', 3, NULL, '2027-03-20'), (N'10511', N'SK-BLS', 2, NULL, '2027-03-20'),
    (N'10604', N'SK-GMP', 2, NULL, '2027-03-20'), (N'10604', N'SK-PRS', 3, '2026-09-15', NULL),
    (N'10712', N'SK-GMP', 3, NULL, '2027-03-20'), (N'10712', N'SK-WGH', 4, NULL, '2027-03-20'), (N'10712', N'SK-VIS', 2, NULL, '2027-03-20'),
    (N'10733', N'SK-GMP', 1, NULL, '2027-03-20'), (N'10733', N'SK-BLS', 1, NULL, '2027-03-20'),
    (N'10790', N'SK-GMP', 4, NULL, '2027-03-20'), (N'10790', N'SK-WGH', 3, NULL, '2027-03-20'), (N'10790', N'SK-GRN', 3, NULL, '2027-03-20'),
    (N'10790', N'SK-PRS', 3, NULL, '2027-03-20'), (N'10790', N'SK-COT', 3, NULL, '2027-03-20'), (N'10790', N'SK-BLS', 3, NULL, '2027-03-20'),
    (N'10815', N'SK-GMP', 3, NULL, '2027-03-20'), (N'10815', N'SK-COT', 3, NULL, '2026-09-28'),
    (N'10841', N'SK-GMP', 3, NULL, '2027-03-20'), (N'10841', N'SK-VIS', 4, NULL, '2027-03-20'),
    (N'10902', N'SK-GMP', 2, NULL, '2027-03-20'), (N'10902', N'SK-BLS', 3, NULL, '2027-03-20'),
    (N'10950', N'SK-GMP', 2, NULL, '2027-03-20')
  ) v(PersonNo, SkillNo, Lvl, ValidTo, Retrain)
  JOIN mes.ProductionPersonnel p ON p.Number = v.PersonNo
  JOIN mes.Skill s ON s.Number = v.SkillNo;

  INSERT mes.ProductionOperationGroup (CompanyId, Number, Name) VALUES (@C, N'OG-SOLID', N'عملیات جامدات');
  DECLARE @og BIGINT = SCOPE_IDENTITY();
  INSERT mes.ProductionOperation (CompanyId, Number, Name, OperationGroupId, LaborClassCode) VALUES
    (@C, N'OP-10', N'توزین', @og, 1), (@C, N'OP-20', N'گرانولاسیون', @og, 1), (@C, N'OP-30', N'پرس قرص', @og, 1),
    (@C, N'OP-40', N'روکش‌دهی', @og, 1), (@C, N'OP-45', N'بازرسی بصری', @og, 1), (@C, N'OP-50', N'بسته‌بندی بلیستر', @og, 1);

  INSERT mes.OperationSkillRequirement (CompanyId, OperationId, SkillId, MinSkillLevelCode, EnforcementModeCode)
  SELECT @C, o.Id, s.Id, v.Lvl, v.Mode
  FROM (VALUES
    (N'OP-10', N'SK-WGH', 2, 2), (N'OP-20', N'SK-GRN', 2, 1), (N'OP-30', N'SK-PRS', 3, 2), (N'OP-30', N'SK-GMP', 2, 1),
    (N'OP-40', N'SK-COT', 3, 1), (N'OP-45', N'SK-VIS', 3, 2), (N'OP-50', N'SK-BLS', 2, 1)
  ) v(OpNo, SkillNo, Lvl, Mode)
  JOIN mes.ProductionOperation o ON o.Number = v.OpNo
  JOIN mes.Skill s ON s.Number = v.SkillNo;
  COMMIT;
END
GO
