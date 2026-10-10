/* =====================================================================
   اسکیمای mes — گام ۷: FRM-RM-07 «طبقه‌بندی علل»

   پیش‌نیاز: mes_frm_rm01 تا mes_frm_rm06 اجرا شده باشند.
   قاعده‌ی مدل داده همان است که در سرآغاز mes_frm_rm01_setup.sql آمده.
   طبق یادداشت ALM: «یک فرم درختی با تب برای هر دسته — نه چند فرم جدا».

   نگاشت جدول‌های این گام:
     mes.ProductionProblemGroup  = generalmfr.ProductionProblemGroup + IsActive، SortOrder
                                   (درخت چندسطحی گروه ← زیرگروه از قبل با ParentId، Level و Chain هست)
     mes.ProductionProblem       = generalmfr.ProductionProblem + OeeLossCode، IsExcludedFromOee، IsActive،
                                   SortOrder، Description — علت توقف، برگ درخت گروه‌ها
     mes.ProductionWasteReason   = generalmfr.ProductionWasteReason + ParentId (درختی)، WasteTypeCode، OeeLossCode،
                                   IsActive، SortOrder، Description
     mes.ProductionReworkReason  = mfr.ProductionReworkReason + ParentId، IsActive، SortOrder، Description
     mes.ProductionPlanDeviation = generalmfr.ProductionPlanDeviation + ParentId، IsActive، SortOrder، Description
     mes.OeeLoss                 = جدید — شش زیان بزرگ OEE (فهرست استاندارد، نه قابل‌تعریف کاربر)
     mes.ProductionReasonRestriction = جدید — فهرست علل مجاز به‌ازای خط، ایستگاه یا نوع تجهیز

   فرض‌ها و کدهای موقت تا تأیید/رسیدن کدلیست اصلی:
     ProductionProblem.ProblemTypeCode       1 = توقف برنامه‌ریزی‌شده، 2 = برنامه‌ریزی‌نشده
                                             (معنای این فیلد در نسخه‌ی قبل روشن نیست — منتظر تأیید)
     ProductionProblem.IsExcludedFromOee     1 = از زمان برنامه‌ریزی‌شده‌ی تولید کم می‌شود و زیان OEE نیست
                                             (مثل استراحت و نت برنامه‌ریزی‌شده). «برنامه‌ریزی‌شده» لزوماً خارج از OEE
                                             نیست: تعویض قالب برنامه‌ریزی‌شده است ولی زیان «راه‌اندازی و تعویض» است.
     ProductionWasteReason.WasteTypeCode     1 = ضایعات مواد، 2 = ضایعات محصول (همان WasteTypeCode جدول‌های اجرای قدیم)
     ProductionPlanDeviation.DeviationTypeCode 1 = مقداری، 2 = زمانی، 3 = ترتیب (منتظر تأیید)
     OeeComponentCode                        1 = در دسترس‌بودن، 2 = عملکرد، 3 = کیفیت
     ReasonCategoryCode                      1 = توقف، 2 = ضایعات، 3 = دوباره‌کاری، 4 = انحراف از برنامه
     هر علت توقفِ برنامه‌ریزی‌نشده و هر علت ضایعات محصول باید به یکی از شش زیان نگاشت شود؛ وگرنه «نگاشت‌نشده» است.

   محدودسازی (F-RM-053): هر ردیف ProductionReasonRestriction یک گره (و همه‌ی زیرشاخه‌اش) را برای یک خط،
   یک ایستگاه یا یک نوع تجهیز مجاز می‌کند. برای هر «ایستگاه × دسته»، دقیق‌ترین سطحی که قاعده دارد برنده است:
   ایستگاه ← نوع تجهیزِ ایستگاه ← خط. اگر هیچ سطحی قاعده نداشته باشد، همه‌ی علل فعال مجازند.

   فاز اول: F-RM-047، 048، 049، 050، 051، 053 (الزامی). ارتباط علت با اقدام اصلاحی و مسئول (052) اولویت
   «مهم» و فاز ۳ دارد و نیامده (جدول‌های قدیمش ProductionRepair و ProductionProblemRepairMapping‌اند).
   این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */
IF OBJECT_ID('mes.ProductionProblemGroup','U') IS NULL
CREATE TABLE mes.ProductionProblemGroup (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionProblemGroup PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  ParentId BIGINT NULL,
  Level SMALLINT NULL,
  Chain HIERARCHYID NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionProblemGroup_IsActive DEFAULT (1),
  SortOrder INT NOT NULL CONSTRAINT DF_mes_ProductionProblemGroup_SortOrder DEFAULT (0)
);

IF OBJECT_ID('mes.ProductionProblem','U') IS NULL
CREATE TABLE mes.ProductionProblem (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionProblem PRIMARY KEY,
  Number NVARCHAR(50) NULL,
  Name NVARCHAR(256) NOT NULL,
  ProblemTypeCode INT NOT NULL,
  ProblemGroupId BIGINT NOT NULL,
  OeeLossCode INT NULL,
  IsExcludedFromOee BIT NOT NULL CONSTRAINT DF_mes_ProductionProblem_IsExcludedFromOee DEFAULT (0),
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionProblem_IsActive DEFAULT (1),
  SortOrder INT NOT NULL CONSTRAINT DF_mes_ProductionProblem_SortOrder DEFAULT (0),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionWasteReason','U') IS NULL
CREATE TABLE mes.ProductionWasteReason (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionWasteReason PRIMARY KEY,
  Name NVARCHAR(256) NULL,
  Number NVARCHAR(64) NULL,
  ParentId BIGINT NULL,
  WasteTypeCode INT NOT NULL CONSTRAINT CK_mes_ProductionWasteReason_Type CHECK (WasteTypeCode IN (1, 2)),
  OeeLossCode INT NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionWasteReason_IsActive DEFAULT (1),
  SortOrder INT NOT NULL CONSTRAINT DF_mes_ProductionWasteReason_SortOrder DEFAULT (0),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionReworkReason','U') IS NULL
CREATE TABLE mes.ProductionReworkReason (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionReworkReason PRIMARY KEY,
  Number NVARCHAR(50) NULL,
  Name NVARCHAR(256) NOT NULL,
  ParentId BIGINT NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionReworkReason_IsActive DEFAULT (1),
  SortOrder INT NOT NULL CONSTRAINT DF_mes_ProductionReworkReason_SortOrder DEFAULT (0),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionPlanDeviation','U') IS NULL
CREATE TABLE mes.ProductionPlanDeviation (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionPlanDeviation PRIMARY KEY,
  Number NVARCHAR(50) NULL,
  Name NVARCHAR(256) NOT NULL,
  DeviationTypeCode INT NOT NULL,
  ParentId BIGINT NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionPlanDeviation_IsActive DEFAULT (1),
  SortOrder INT NOT NULL CONSTRAINT DF_mes_ProductionPlanDeviation_SortOrder DEFAULT (0),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.OeeLoss','U') IS NULL
CREATE TABLE mes.OeeLoss (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_OeeLoss PRIMARY KEY,
  Code INT NOT NULL CONSTRAINT UQ_mes_OeeLoss_Code UNIQUE,
  Name NVARCHAR(256) NOT NULL,
  EnglishName NVARCHAR(128) NULL,
  OeeComponentCode INT NOT NULL CONSTRAINT CK_mes_OeeLoss_Component CHECK (OeeComponentCode IN (1, 2, 3)),
  SortOrder INT NOT NULL CONSTRAINT DF_mes_OeeLoss_SortOrder DEFAULT (0),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionReasonRestriction','U') IS NULL
CREATE TABLE mes.ProductionReasonRestriction (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionReasonRestriction PRIMARY KEY,
  ReasonCategoryCode INT NOT NULL CONSTRAINT CK_mes_ProductionReasonRestriction_Category CHECK (ReasonCategoryCode IN (1, 2, 3, 4)),
  ProblemGroupId BIGINT NULL,
  ProblemId BIGINT NULL,
  ReasonId BIGINT NULL,
  ProductionLineId BIGINT NULL,
  WorkCenterId BIGINT NULL,
  EquipmentTypeTitle NVARCHAR(100) NULL,
  Description NVARCHAR(400) NULL,
  CONSTRAINT CK_mes_ProductionReasonRestriction_Target CHECK (
    CASE WHEN ProductionLineId IS NULL THEN 0 ELSE 1 END
    + CASE WHEN WorkCenterId IS NULL THEN 0 ELSE 1 END
    + CASE WHEN EquipmentTypeTitle IS NULL THEN 0 ELSE 1 END = 1),
  CONSTRAINT CK_mes_ProductionReasonRestriction_Reason CHECK (
    (ReasonCategoryCode = 1 AND ReasonId IS NULL
      AND ((ProblemGroupId IS NOT NULL AND ProblemId IS NULL) OR (ProblemGroupId IS NULL AND ProblemId IS NOT NULL)))
    OR (ReasonCategoryCode IN (2, 3, 4) AND ReasonId IS NOT NULL AND ProblemGroupId IS NULL AND ProblemId IS NULL))
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
   بخش ۳ — توابع: همه‌ی دسته‌ها در یک شکل یکسان «گره‌ی درخت»
   کلید گره: G = گروه علل توقف، P = علت توقف، W = ضایعات، R = دوباره‌کاری، D = انحراف
   ------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION mes.fnReasonNodes ()
RETURNS TABLE
AS
RETURN
(
  SELECT 1 AS CategoryCode, CAST('G' + CAST(g.Id AS VARCHAR(19)) AS VARCHAR(20)) AS NodeKey,
         CAST('G' + CAST(g.ParentId AS VARCHAR(19)) AS VARCHAR(20)) AS ParentKey,
         g.Id AS RowId, g.Number, g.Name, CAST(1 AS BIT) AS IsGroup, g.IsActive, g.SortOrder,
         CAST(NULL AS INT) AS ProblemTypeCode, CAST(NULL AS INT) AS OeeLossCode, CAST(NULL AS BIT) AS IsExcludedFromOee,
         CAST(NULL AS INT) AS WasteTypeCode, CAST(NULL AS INT) AS DeviationTypeCode, CAST(NULL AS NVARCHAR(400)) AS Description
  FROM mes.ProductionProblemGroup g WHERE g.IsDeleted = 0
  UNION ALL
  SELECT 1, CAST('P' + CAST(p.Id AS VARCHAR(19)) AS VARCHAR(20)), CAST('G' + CAST(p.ProblemGroupId AS VARCHAR(19)) AS VARCHAR(20)),
         p.Id, p.Number, p.Name, CAST(0 AS BIT), p.IsActive, p.SortOrder,
         p.ProblemTypeCode, p.OeeLossCode, p.IsExcludedFromOee, NULL, NULL, p.Description
  FROM mes.ProductionProblem p WHERE p.IsDeleted = 0
  UNION ALL
  SELECT 2, CAST('W' + CAST(w.Id AS VARCHAR(19)) AS VARCHAR(20)), CAST('W' + CAST(w.ParentId AS VARCHAR(19)) AS VARCHAR(20)),
         w.Id, w.Number, w.Name,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductionWasteReason x WHERE x.ParentId = w.Id AND x.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT),
         w.IsActive, w.SortOrder, NULL, w.OeeLossCode, NULL, w.WasteTypeCode, NULL, w.Description
  FROM mes.ProductionWasteReason w WHERE w.IsDeleted = 0
  UNION ALL
  SELECT 3, CAST('R' + CAST(r.Id AS VARCHAR(19)) AS VARCHAR(20)), CAST('R' + CAST(r.ParentId AS VARCHAR(19)) AS VARCHAR(20)),
         r.Id, r.Number, r.Name,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductionReworkReason x WHERE x.ParentId = r.Id AND x.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT),
         r.IsActive, r.SortOrder, NULL, NULL, NULL, NULL, NULL, r.Description
  FROM mes.ProductionReworkReason r WHERE r.IsDeleted = 0
  UNION ALL
  SELECT 4, CAST('D' + CAST(d.Id AS VARCHAR(19)) AS VARCHAR(20)), CAST('D' + CAST(d.ParentId AS VARCHAR(19)) AS VARCHAR(20)),
         d.Id, d.Number, d.Name,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductionPlanDeviation x WHERE x.ParentId = d.Id AND x.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT),
         d.IsActive, d.SortOrder, NULL, NULL, NULL, NULL, d.DeviationTypeCode, d.Description
  FROM mes.ProductionPlanDeviation d WHERE d.IsDeleted = 0
);
GO

CREATE OR ALTER FUNCTION mes.fnReasonClosure ()
RETURNS TABLE
AS
RETURN
(
  /* هر گره با خودش و همه‌ی نیاکانش. Distance = ۰ برای خودِ گره. */
  WITH c AS (
    SELECT n.NodeKey, n.NodeKey AS AncestorKey, n.ParentKey, 0 AS Distance
    FROM mes.fnReasonNodes() n
    UNION ALL
    SELECT c.NodeKey, p.NodeKey, p.ParentKey, c.Distance + 1
    FROM c JOIN mes.fnReasonNodes() p ON p.NodeKey = c.ParentKey
  )
  SELECT NodeKey, AncestorKey, Distance FROM c
);
GO

CREATE OR ALTER FUNCTION mes.fnReasonRules ()
RETURNS TABLE
AS
RETURN
(
  /* قواعد محدودسازی با کلید گره و سطح هدف. LevelRank: ۱ ایستگاه، ۲ نوع تجهیز، ۳ خط (کوچک‌تر = دقیق‌تر). */
  SELECT r.Id AS RuleId, r.ReasonCategoryCode,
         CAST(CASE r.ReasonCategoryCode
                WHEN 1 THEN CASE WHEN r.ProblemGroupId IS NOT NULL THEN 'G' + CAST(r.ProblemGroupId AS VARCHAR(19))
                                 ELSE 'P' + CAST(r.ProblemId AS VARCHAR(19)) END
                WHEN 2 THEN 'W' + CAST(r.ReasonId AS VARCHAR(19))
                WHEN 3 THEN 'R' + CAST(r.ReasonId AS VARCHAR(19))
                ELSE 'D' + CAST(r.ReasonId AS VARCHAR(19)) END AS VARCHAR(20)) AS NodeKey,
         r.WorkCenterId, r.EquipmentTypeTitle, r.ProductionLineId,
         CASE WHEN r.WorkCenterId IS NOT NULL THEN 'station' WHEN r.EquipmentTypeTitle IS NOT NULL THEN 'equipment-type' ELSE 'line' END AS LevelCode,
         CASE WHEN r.WorkCenterId IS NOT NULL THEN 1 WHEN r.EquipmentTypeTitle IS NOT NULL THEN 2 ELSE 3 END AS LevelRank,
         COALESCE(w.Number + N' — ' + w.Name + N' (' + wl.Name + N')', N'نوع تجهیز «' + r.EquipmentTypeTitle + N'»', l.Name) AS TargetTitle,
         r.Description
  FROM mes.ProductionReasonRestriction r
  LEFT JOIN mes.WorkCenter w ON w.Id = r.WorkCenterId
  LEFT JOIN mes.ProductionLine wl ON wl.Id = w.ProductionLineId
  LEFT JOIN mes.ProductionLine l ON l.Id = r.ProductionLineId
  WHERE r.IsDeleted = 0
);
GO

/* -------------------------------------------------------------------
   بخش ۴ — رویه‌های خواندن (شناسه‌ها INT برمی‌گردند تا در JSON عدد بمانند)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetReasonTree
AS
BEGIN
  SET NOCOUNT ON;
  /* همه‌ی گره‌های چهار دسته با شکل یکسان؛ فرانت‌اند از ParentKey درخت می‌سازد.
     IsUnmapped: علت توقفِ داخل OEE یا علت ضایعات محصول که به هیچ‌یک از شش زیان نگاشت نشده. */
  SELECT n.CategoryCode, n.NodeKey, n.ParentKey, CAST(n.RowId AS INT) AS RowId, n.Number, n.Name, n.IsGroup, n.IsActive, n.SortOrder,
         n.ProblemTypeCode, n.OeeLossCode, l.Name AS OeeLossTitle, l.OeeComponentCode, n.IsExcludedFromOee,
         n.WasteTypeCode, n.DeviationTypeCode, n.Description,
         (SELECT COUNT(*) FROM mes.fnReasonRules() r WHERE r.NodeKey = n.NodeKey) AS RuleCount,
         CAST(CASE WHEN n.IsGroup = 0 AND n.IsActive = 1 AND n.OeeLossCode IS NULL
                    AND ((n.CategoryCode = 1 AND n.IsExcludedFromOee = 0) OR (n.CategoryCode = 2 AND n.WasteTypeCode = 2))
                   THEN 1 ELSE 0 END AS BIT) AS IsUnmapped
  FROM mes.fnReasonNodes() n
  LEFT JOIN mes.OeeLoss l ON l.Code = n.OeeLossCode AND l.IsDeleted = 0
  ORDER BY n.CategoryCode, n.SortOrder, n.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetOeeLossMapping
AS
BEGIN
  SET NOCOUNT ON;
  /* شش زیان و علت‌های نگاشت‌شده به هر کدام (زیانِ بی‌علت هم یک ردیف دارد)، به‌علاوه‌ی علت‌های
     «خارج از OEE» و «نگاشت‌نشده». فقط برگ‌های فعال. */
  SELECT x.MappingStatus, x.LossCode, x.LossTitle, x.LossEnglishTitle, x.OeeComponentCode,
         x.CategoryCode, x.NodeKey, x.ReasonNumber, x.ReasonTitle, x.ParentTitle, x.ProblemTypeCode
  FROM (
    SELECT 'mapped' AS MappingStatus, l.Code AS LossCode, l.Name AS LossTitle, l.EnglishName AS LossEnglishTitle, l.OeeComponentCode, l.SortOrder AS LossSort,
           n.CategoryCode, n.NodeKey, n.Number AS ReasonNumber, n.Name AS ReasonTitle, p.Name AS ParentTitle, n.ProblemTypeCode, n.SortOrder AS ReasonSort
    FROM mes.OeeLoss l
    LEFT JOIN mes.fnReasonNodes() n ON n.OeeLossCode = l.Code AND n.IsGroup = 0 AND n.IsActive = 1
    LEFT JOIN mes.fnReasonNodes() p ON p.NodeKey = n.ParentKey
    WHERE l.IsDeleted = 0
    UNION ALL
    SELECT CASE WHEN n.CategoryCode = 1 AND n.IsExcludedFromOee = 1 THEN 'excluded' ELSE 'unmapped' END,
           NULL, NULL, NULL, NULL, 99,
           n.CategoryCode, n.NodeKey, n.Number, n.Name, p.Name, n.ProblemTypeCode, n.SortOrder
    FROM mes.fnReasonNodes() n
    LEFT JOIN mes.fnReasonNodes() p ON p.NodeKey = n.ParentKey
    WHERE n.IsGroup = 0 AND n.IsActive = 1 AND n.OeeLossCode IS NULL
      AND ((n.CategoryCode = 1) OR (n.CategoryCode = 2 AND n.WasteTypeCode = 2))
  ) x
  ORDER BY x.LossSort, x.MappingStatus, x.CategoryCode, x.ReasonSort, x.ReasonNumber;
END
GO

CREATE OR ALTER PROCEDURE mes.GetReasonRestrictionsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  /* قواعدی که به دست‌کم یک ایستگاهِ دامنه می‌رسند: روی خودِ ایستگاه، روی خطش یا روی نوع تجهیزِ نصب‌شده در آن. */
  WITH st AS (
    SELECT w.Id, w.ProductionLineId
    FROM mes.WorkCenter w
    WHERE w.IsDeleted = 0 AND w.TopologyTypeCode <> 'buffer'
      AND w.ProductionLineId IN (SELECT LineId FROM mes.fnLinesInScope(@OrgNodeId, @LineId))
      AND (@StationId IS NULL OR w.Id = @StationId)
  ), types AS (
    SELECT DISTINCT e.EquipmentTypeTitle
    FROM st JOIN mes.WorkCenterEquipment we ON we.WorkCenterId = st.Id AND we.IsDeleted = 0
    JOIN mes.Equipment e ON e.Id = we.EquipmentId AND e.IsDeleted = 0
  )
  SELECT CAST(r.RuleId AS INT) AS RuleId, r.ReasonCategoryCode, r.NodeKey, n.Number AS ReasonNumber, n.Name AS ReasonTitle, n.IsGroup,
         r.LevelCode, r.LevelRank, r.TargetTitle, r.Description,
         (SELECT COUNT(*) FROM mes.fnReasonClosure() cl JOIN mes.fnReasonNodes() leaf ON leaf.NodeKey = cl.NodeKey
          WHERE cl.AncestorKey = r.NodeKey AND leaf.IsGroup = 0 AND leaf.IsActive = 1) AS LeafCount
  FROM mes.fnReasonRules() r
  JOIN mes.fnReasonNodes() n ON n.NodeKey = r.NodeKey
  WHERE r.WorkCenterId IN (SELECT Id FROM st)
     OR r.ProductionLineId IN (SELECT ProductionLineId FROM st)
     OR r.EquipmentTypeTitle IN (SELECT EquipmentTypeTitle FROM types)
  ORDER BY r.LevelRank DESC, r.TargetTitle, r.ReasonCategoryCode, n.SortOrder;
END
GO

CREATE OR ALTER PROCEDURE mes.GetAllowedReasonsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  /* برای هر «ایستگاه × دسته»: سطحی که فهرست مجاز از آن می‌آید و یک ردیف به‌ازای هر علتِ (برگ فعال) مجاز.
     دقیق‌ترین سطحِ دارای قاعده برنده است: ایستگاه ← نوع تجهیز ← خط؛ بدون قاعده = همه‌ی علل. */
  SELECT w.Id, w.Number, w.Name, w.ProductionLineId, l.Name AS LineTitle
  INTO #st
  FROM mes.WorkCenter w
  JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
  WHERE w.IsDeleted = 0 AND w.TopologyTypeCode <> 'buffer'
    AND w.ProductionLineId IN (SELECT LineId FROM mes.fnLinesInScope(@OrgNodeId, @LineId))
    AND (@StationId IS NULL OR w.Id = @StationId);

  SELECT DISTINCT st.Id AS StationId, e.EquipmentTypeTitle
  INTO #stType
  FROM #st st
  JOIN mes.WorkCenterEquipment we ON we.WorkCenterId = st.Id AND we.IsDeleted = 0
  JOIN mes.Equipment e ON e.Id = we.EquipmentId AND e.IsDeleted = 0;

  SELECT st.Id AS StationId, r.ReasonCategoryCode, r.NodeKey, r.LevelCode, r.LevelRank, r.TargetTitle
  INTO #cand
  FROM #st st
  JOIN mes.fnReasonRules() r
    ON r.WorkCenterId = st.Id
    OR r.ProductionLineId = st.ProductionLineId
    OR EXISTS (SELECT 1 FROM #stType t WHERE t.StationId = st.Id AND t.EquipmentTypeTitle = r.EquipmentTypeTitle);

  SELECT c.* INTO #eff
  FROM #cand c
  JOIN (SELECT StationId, ReasonCategoryCode, MIN(LevelRank) AS LevelRank FROM #cand GROUP BY StationId, ReasonCategoryCode) m
    ON m.StationId = c.StationId AND m.ReasonCategoryCode = c.ReasonCategoryCode AND m.LevelRank = c.LevelRank;

  SELECT cl.NodeKey, cl.AncestorKey INTO #closure FROM mes.fnReasonClosure() cl;
  SELECT n.CategoryCode, n.NodeKey INTO #leaf FROM mes.fnReasonNodes() n WHERE n.IsGroup = 0 AND n.IsActive = 1;

  SELECT CAST(st.Id AS INT) AS StationId, st.Number AS StationCode, st.Name AS StationTitle, CAST(st.ProductionLineId AS INT) AS LineId, st.LineTitle,
         cat.CategoryCode,
         ISNULL(src.LevelCode, 'none') AS SourceLevel, src.SourceTitle,
         lf.NodeKey
  FROM #st st
  CROSS JOIN (VALUES (1), (2), (3), (4)) cat(CategoryCode)
  OUTER APPLY (
    SELECT MIN(e.LevelCode) AS LevelCode,
           STRING_AGG(e.TargetTitle, N'، ') AS SourceTitle
    FROM (SELECT DISTINCT LevelCode, TargetTitle FROM #eff e WHERE e.StationId = st.Id AND e.ReasonCategoryCode = cat.CategoryCode) e
  ) src
  JOIN #leaf lf ON lf.CategoryCode = cat.CategoryCode
  WHERE src.LevelCode IS NULL
     OR EXISTS (SELECT 1 FROM #eff e JOIN #closure cl ON cl.AncestorKey = e.NodeKey
                WHERE e.StationId = st.Id AND e.ReasonCategoryCode = cat.CategoryCode AND cl.NodeKey = lf.NodeKey)
  ORDER BY st.ProductionLineId, st.Number, cat.CategoryCode, lf.NodeKey;
END
GO

/* -------------------------------------------------------------------
   بخش ۵ — داده‌ی نمونه (شرکت ۲۲۲). فقط وقتی جدول شش زیان خالی است.
   عمداً خراب: «کمبود مواد اولیه» علت توقف برنامه‌ریزی‌نشده است ولی به هیچ زیانی نگاشت نشده؛
   «لکه‌ی روکش غیرقابل اصلاح» ضایعات محصول بدون نگاشت است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.OeeLoss)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @L1 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۱');
  DECLARE @L2 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۲');

  INSERT mes.OeeLoss (CompanyId, Code, Name, EnglishName, OeeComponentCode, SortOrder, Description) VALUES
    (@C, 1, N'خرابی تجهیز',            N'Breakdowns',              1, 1, N'توقف برنامه‌ریزی‌نشده به‌دلیل خرابی'),
    (@C, 2, N'راه‌اندازی و تعویض',      N'Setup and Adjustments',   1, 2, N'تعویض محصول/قالب، نظافت بین بچ، تنظیم پس از راه‌اندازی'),
    (@C, 3, N'توقف‌های کوتاه',          N'Small Stops',             2, 3, N'توقف‌های چنددقیقه‌ای که معمولاً جداگانه ثبت نمی‌شوند'),
    (@C, 4, N'کاهش سرعت',               N'Reduced Speed',           2, 4, N'کار با سرعتی کمتر از سرعت استاندارد'),
    (@C, 5, N'ضایعات راه‌اندازی',       N'Startup Rejects',         3, 5, N'محصول معیوب تا رسیدن فرایند به حالت پایدار'),
    (@C, 6, N'ضایعات فرایند',           N'Production Rejects',      3, 6, N'محصول معیوب در حالت پایدار');

  /* گروه‌های علل توقف: ابتدا همه بدون پدر، بعد اتصال پدر با شماره */
  CREATE TABLE #g (Number NVARCHAR(64), Name NVARCHAR(256), ParentNumber NVARCHAR(64), Sort INT);
  INSERT #g VALUES
    (N'ST-1',   N'فنی و ماشین',               NULL,    10),
    (N'ST-1.1', N'خرابی مکانیکی',             N'ST-1', 11),
    (N'ST-1.2', N'خرابی برقی و کنترلی',       N'ST-1', 12),
    (N'ST-2',   N'راه‌اندازی و تعویض',         NULL,    20),
    (N'ST-2.1', N'تعویض محصول و قالب',        N'ST-2', 21),
    (N'ST-2.2', N'نظافت و تنظیم',             N'ST-2', 22),
    (N'ST-3',   N'سرعت و توقف کوتاه',         NULL,    30),
    (N'ST-4',   N'مواد و پشتیبانی',           NULL,    40),
    (N'ST-5',   N'توقف برنامه‌ریزی‌شده',       NULL,    50);
  INSERT mes.ProductionProblemGroup (CompanyId, Number, Name, SortOrder) SELECT @C, Number, Name, Sort FROM #g;
  UPDATE c SET c.ParentId = p.Id
  FROM mes.ProductionProblemGroup c JOIN #g v ON v.Number = c.Number JOIN mes.ProductionProblemGroup p ON p.Number = v.ParentNumber;

  /* Level و Chain (hierarchyid) همان معنای نسخه‌ی قبل */
  SELECT Id, ParentId, ROW_NUMBER() OVER (PARTITION BY ParentId ORDER BY SortOrder, Id) AS rn INTO #gr FROM mes.ProductionProblemGroup;
  WITH t AS (
    SELECT Id, CAST('/' + CAST(rn AS VARCHAR(10)) + '/' AS VARCHAR(400)) AS Path, CAST(1 AS SMALLINT) AS Lvl FROM #gr WHERE ParentId IS NULL
    UNION ALL
    SELECT g.Id, CAST(t.Path + CAST(g.rn AS VARCHAR(10)) + '/' AS VARCHAR(400)), CAST(t.Lvl + 1 AS SMALLINT) FROM #gr g JOIN t ON g.ParentId = t.Id
  )
  UPDATE pg SET pg.Level = t.Lvl, pg.Chain = HIERARCHYID::Parse(t.Path)
  FROM mes.ProductionProblemGroup pg JOIN t ON t.Id = pg.Id;

  INSERT mes.ProductionProblem (CompanyId, Number, Name, ProblemTypeCode, ProblemGroupId, OeeLossCode, IsExcludedFromOee, IsActive, SortOrder, Description)
  SELECT @C, v.Number, v.Name, v.TypeCode, g.Id, v.Loss, v.Excluded, v.Active, v.Sort, v.Description
  FROM (VALUES
    (N'P-101', N'شکستگی یا سایش پانچ پرس',                  N'ST-1.1', 2, 1,    0, 1, 1, NULL),
    (N'P-102', N'خرابی گیربکس میکسر',                       N'ST-1.1', 2, 1,    0, 1, 2, NULL),
    (N'P-103', N'نشتی سیستم پاشش کوتینگ',                   N'ST-1.1', 2, 1,    0, 1, 3, NULL),
    (N'P-190', N'خرابی بلیستر قدیمی',                       N'ST-1.1', 2, 1,    0, 0, 9, N'از رده خارج — دستگاه جایگزین شده'),
    (N'P-111', N'خطای PLC و توقف اضطراری',                  N'ST-1.2', 2, 1,    0, 1, 1, NULL),
    (N'P-112', N'قطع سنسور تغذیه',                          N'ST-1.2', 2, 3,    0, 1, 2, NULL),
    (N'P-201', N'تعویض قالب پرس',                           N'ST-2.1', 1, 2,    0, 1, 1, N'برنامه‌ریزی‌شده ولی زیان OEE'),
    (N'P-202', N'تعویض فرمت بلیستر',                        N'ST-2.1', 1, 2,    0, 1, 2, NULL),
    (N'P-211', N'شستشو و نظافت بین بچ',                     N'ST-2.2', 1, 2,    0, 1, 1, NULL),
    (N'P-212', N'تنظیم وزن و سختی پس از راه‌اندازی',         N'ST-2.2', 2, 2,    0, 1, 2, NULL),
    (N'P-301', N'گیر کردن قرص در کانال تغذیه',              N'ST-3',   2, 3,    0, 1, 1, NULL),
    (N'P-302', N'کار با سرعت کمتر به‌دلیل گرانول نامرغوب',   N'ST-3',   2, 4,    0, 1, 2, NULL),
    (N'P-303', N'گیر کردن نوار بلیستر',                     N'ST-3',   2, 3,    0, 1, 3, NULL),
    (N'P-401', N'کمبود مواد اولیه',                         N'ST-4',   2, NULL, 0, 1, 1, NULL),
    (N'P-402', N'انتظار برای آزادسازی QC',                  N'ST-4',   2, 1,    0, 1, 2, NULL),
    (N'P-403', N'قطعی برق',                                 N'ST-4',   2, 1,    0, 1, 3, NULL),
    (N'P-501', N'استراحت و نماز',                           N'ST-5',   1, NULL, 1, 1, 1, NULL),
    (N'P-502', N'نت پیشگیرانه‌ی برنامه‌ریزی‌شده',             N'ST-5',   1, NULL, 1, 1, 2, NULL),
    (N'P-503', N'نبود دستور کار',                           N'ST-5',   1, NULL, 1, 1, 3, NULL),
    (N'P-504', N'آموزش و جلسه',                             N'ST-5',   1, NULL, 1, 1, 4, NULL)
  ) v(Number, Name, GroupNumber, TypeCode, Loss, Excluded, Active, Sort, Description)
  JOIN mes.ProductionProblemGroup g ON g.Number = v.GroupNumber;

  CREATE TABLE #w (Number NVARCHAR(64), Name NVARCHAR(256), ParentNumber NVARCHAR(64), WasteType INT, Loss INT, Sort INT);
  INSERT #w VALUES
    (N'WS-M',   N'ضایعات مواد',                     NULL,     1, NULL, 10),
    (N'WS-M1',  N'مواد اولیه',                      N'WS-M',  1, NULL, 11),
    (N'WS-M11', N'ریزش پودر هنگام توزین',           N'WS-M1', 1, NULL, 1),
    (N'WS-M12', N'باقی‌مانده‌ی ته مخزن میکسر',       N'WS-M1', 1, NULL, 2),
    (N'WS-M2',  N'مواد بسته‌بندی',                  N'WS-M',  1, NULL, 12),
    (N'WS-M21', N'پارگی فویل آلومینیوم',            N'WS-M2', 1, NULL, 1),
    (N'WS-M22', N'چاپ معیوب کارتن یا بروشور',       N'WS-M2', 1, NULL, 2),
    (N'WS-P',   N'ضایعات محصول',                    NULL,     2, NULL, 20),
    (N'WS-P1',  N'ضایعات راه‌اندازی',               N'WS-P',  2, NULL, 21),
    (N'WS-P11', N'قرص‌های تنظیم وزن ابتدای بچ',      N'WS-P1', 2, 5,    1),
    (N'WS-P12', N'قرص‌های تنظیم سختی',              N'WS-P1', 2, 5,    2),
    (N'WS-P2',  N'ضایعات فرایند',                   N'WS-P',  2, NULL, 22),
    (N'WS-P21', N'قرص شکسته یا لب‌پریده',            N'WS-P2', 2, 6,    1),
    (N'WS-P22', N'کپینگ و لایه‌لایه‌شدن',            N'WS-P2', 2, 6,    2),
    (N'WS-P23', N'وزن خارج از حد مجاز',             N'WS-P2', 2, 6,    3),
    (N'WS-P24', N'بلیستر خالی یا ناقص',             N'WS-P2', 2, 6,    4),
    (N'WS-P25', N'لکه‌ی روکش غیرقابل اصلاح',         N'WS-P2', 2, NULL, 5);
  INSERT mes.ProductionWasteReason (CompanyId, Number, Name, WasteTypeCode, OeeLossCode, SortOrder) SELECT @C, Number, Name, WasteType, Loss, Sort FROM #w;
  UPDATE c SET c.ParentId = p.Id
  FROM mes.ProductionWasteReason c JOIN #w v ON v.Number = c.Number JOIN mes.ProductionWasteReason p ON p.Number = v.ParentNumber;

  CREATE TABLE #r (Number NVARCHAR(64), Name NVARCHAR(256), ParentNumber NVARCHAR(64), Sort INT);
  INSERT #r VALUES
    (N'RW-1',  N'کیفیت ظاهری',                              NULL,    10),
    (N'RW-11', N'لکه‌ی جزئی روکش — روکش مجدد',               N'RW-1', 1),
    (N'RW-12', N'ناهمگنی رنگ روکش',                         N'RW-1', 2),
    (N'RW-2',  N'بسته‌بندی',                                NULL,    20),
    (N'RW-21', N'سیل ناقص بلیستر — بازبسته‌بندی',             N'RW-2', 1),
    (N'RW-22', N'برچسب یا شماره‌ی بچ اشتباه روی کارتن',      N'RW-2', 2),
    (N'RW-3',  N'فرایند',                                   NULL,    30),
    (N'RW-31', N'رطوبت بالای گرانول — خشک‌کردن مجدد',        N'RW-3', 1),
    (N'RW-32', N'اندازه‌ی ذره خارج از حد — آسیاب مجدد',       N'RW-3', 2);
  INSERT mes.ProductionReworkReason (CompanyId, Number, Name, SortOrder) SELECT @C, Number, Name, Sort FROM #r;
  UPDATE c SET c.ParentId = p.Id
  FROM mes.ProductionReworkReason c JOIN #r v ON v.Number = c.Number JOIN mes.ProductionReworkReason p ON p.Number = v.ParentNumber;

  CREATE TABLE #d (Number NVARCHAR(64), Name NVARCHAR(256), ParentNumber NVARCHAR(64), DevType INT, Sort INT);
  INSERT #d VALUES
    (N'DV-1',  N'انحراف مقداری',                    NULL,    1, 10),
    (N'DV-11', N'کمبود مواد اولیه',                 N'DV-1', 1, 1),
    (N'DV-12', N'بازده کمتر از استاندارد',          N'DV-1', 1, 2),
    (N'DV-2',  N'انحراف زمانی',                     NULL,    2, 20),
    (N'DV-21', N'تأخیر در آزادسازی QC',             N'DV-2', 2, 1),
    (N'DV-22', N'خرابی پیش‌بینی‌نشده‌ی تجهیز',        N'DV-2', 2, 2),
    (N'DV-23', N'کمبود نیرو',                       N'DV-2', 2, 3),
    (N'DV-3',  N'انحراف ترتیب',                     NULL,    3, 30),
    (N'DV-31', N'تغییر اولویت به درخواست فروش',     N'DV-3', 3, 1),
    (N'DV-32', N'درج سفارش فوری',                   N'DV-3', 3, 2);
  INSERT mes.ProductionPlanDeviation (CompanyId, Number, Name, DeviationTypeCode, SortOrder) SELECT @C, Number, Name, DevType, Sort FROM #d;
  UPDATE c SET c.ParentId = p.Id
  FROM mes.ProductionPlanDeviation c JOIN #d v ON v.Number = c.Number JOIN mes.ProductionPlanDeviation p ON p.Number = v.ParentNumber;

  /* محدودسازی: نوع تجهیز «پرس» و «بسته‌بندی»، ایستگاه روکش‌دهی خط ۲، و دوباره‌کاری خط ۱ (روکش ندارد) */
  INSERT mes.ProductionReasonRestriction (CompanyId, ReasonCategoryCode, ProblemGroupId, ProblemId, ReasonId, ProductionLineId, WorkCenterId, EquipmentTypeTitle, Description)
  SELECT @C, v.Cat, pg.Id, pp.Id, COALESCE(wr.Id, rr.Id, dv.Id),
         CASE WHEN v.TargetKind = 'line' THEN CASE v.LineKey WHEN 1 THEN @L1 ELSE @L2 END END,
         ws.Id,
         CASE WHEN v.TargetKind = 'type' THEN v.Target END,
         v.Description
  FROM (VALUES
    ('type',    N'پرس',       NULL, 1, N'P-101',  NULL),
    ('type',    N'پرس',       NULL, 1, N'ST-1.2', NULL),
    ('type',    N'پرس',       NULL, 1, N'P-201',  NULL),
    ('type',    N'پرس',       NULL, 1, N'ST-2.2', NULL),
    ('type',    N'پرس',       NULL, 1, N'P-301',  NULL),
    ('type',    N'پرس',       NULL, 1, N'P-302',  NULL),
    ('type',    N'پرس',       NULL, 1, N'ST-4',   NULL),
    ('type',    N'پرس',       NULL, 1, N'ST-5',   NULL),
    ('type',    N'پرس',       NULL, 2, N'WS-P1',  NULL),
    ('type',    N'پرس',       NULL, 2, N'WS-P21', NULL),
    ('type',    N'پرس',       NULL, 2, N'WS-P22', NULL),
    ('type',    N'پرس',       NULL, 2, N'WS-P23', NULL),
    ('type',    N'بسته‌بندی',  NULL, 1, N'P-202',  NULL),
    ('type',    N'بسته‌بندی',  NULL, 1, N'P-303',  NULL),
    ('type',    N'بسته‌بندی',  NULL, 1, N'ST-1.2', NULL),
    ('type',    N'بسته‌بندی',  NULL, 1, N'ST-4',   NULL),
    ('type',    N'بسته‌بندی',  NULL, 1, N'ST-5',   NULL),
    ('type',    N'بسته‌بندی',  NULL, 2, N'WS-M2',  NULL),
    ('type',    N'بسته‌بندی',  NULL, 2, N'WS-P24', NULL),
    ('station', N'40',        2,    1, N'P-103',  NULL),
    ('station', N'40',        2,    1, N'ST-1.2', NULL),
    ('station', N'40',        2,    1, N'ST-2.2', NULL),
    ('station', N'40',        2,    1, N'ST-4',   NULL),
    ('station', N'40',        2,    1, N'ST-5',   NULL),
    ('station', N'40',        2,    2, N'WS-P25', NULL),
    ('station', N'40',        2,    3, N'RW-1',   NULL),
    ('line',    NULL,         1,    3, N'RW-2',   N'خط ۱ روکش‌دهی ندارد'),
    ('line',    NULL,         1,    3, N'RW-3',   N'خط ۱ روکش‌دهی ندارد')
  ) v(TargetKind, Target, LineKey, Cat, ReasonNumber, Description)
  LEFT JOIN mes.ProductionProblemGroup pg ON v.Cat = 1 AND pg.Number = v.ReasonNumber
  LEFT JOIN mes.ProductionProblem pp ON v.Cat = 1 AND pp.Number = v.ReasonNumber
  LEFT JOIN mes.ProductionWasteReason wr ON v.Cat = 2 AND wr.Number = v.ReasonNumber
  LEFT JOIN mes.ProductionReworkReason rr ON v.Cat = 3 AND rr.Number = v.ReasonNumber
  LEFT JOIN mes.ProductionPlanDeviation dv ON v.Cat = 4 AND dv.Number = v.ReasonNumber
  LEFT JOIN mes.WorkCenter ws ON v.TargetKind = 'station' AND ws.Number = v.Target AND ws.IsDeleted = 0
       AND ws.ProductionLineId = CASE v.LineKey WHEN 1 THEN @L1 ELSE @L2 END;

  COMMIT;
END
GO
