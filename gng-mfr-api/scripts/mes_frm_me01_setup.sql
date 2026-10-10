/* =====================================================================
   اسکیمای mes — گام ۱۸: FRM-ME-01 «کتابخانه‌ی عملیات»

   پیش‌نیاز: گام‌های قبل تا mes_frm_pe09 (عملیات و گروه عملیات از گام ۳، ایستگاه و گروه منبع از گام ۱،
   گروه ابزار از گام ۲، مهارت از گام ۳، نوع کارکرد از گام ۶، فعالیت از گام ۱۱).
   یادداشت ALM: «عملیات یک‌بار تعریف و در چند روش ساخت استفاده می‌شود».

   نسخه‌ی قبل عملیات کتابخانه‌ای را فقط با نام و گروه داشت (generalmfr.ProductionOperation و
   ProductionOperationGroup، هر دو از گام ۳ در mes)؛ منابع، دستورالعمل و انرژی در سطح مسیر ساخت بودند
   (mfr.RoutingOperationTools، RoutingOperationEnergy، RoutingOperationInstruction). این‌جا همان فیلدها
   به سطح کتابخانه می‌آیند تا روش ساخت (ME-02) آن‌ها را به ارث ببرد:
     mes.ProductionOperationGroup       + ParentId، SortOrder — درخت گروه عملیات (F-ME-001)
     mes.ProductionOperation            + OperationTypeCode (ماهیت، F-ME-002)، IsActive، SortOrder
     mes.ProductionOperationResource    جدید — ایستگاه یا گروه منبع اصلی و جایگزین (F-ME-003)
     mes.ProductionOperationTools       جدید — فیلدهای mfr.RoutingOperationTools در سطح کتابخانه (F-ME-003)
     mes.ProductionOperationEnergy      جدید — فیلدهای mfr.RoutingOperationEnergy؛ EnergyId ← CapacityTypeId (F-ME-003)
     mes.ProductionOperationInstruction جدید — فیلدهای mfr.RoutingOperationInstruction + رسانه و نسخه (F-ME-004)
     mes.ProductionOperationParameter   جدید — پارامتر فرایندی هدف با محدوده‌ی مجاز (F-ME-006)
   مهارت لازم همان mes.OperationSkillRequirement گام ۳ است.

   فرض‌ها و کدهای موقت:
     OperationTypeCode     1 = تولیدی، 2 = کیفی، 3 = تولیدی-کیفی، 4 = اطلاعاتی، 5 = برون‌سپاری، 6 = انتقال/جابه‌جایی
                           (نام از mfr.RoutingOperation.OperationTypeCode؛ معنای آن در نسخه‌ی قبل منتظر تأیید)
     ResourceTypeCode      1 = ایستگاه کاری، 2 = گروه منبع
     MediaTypeCode         1 = متن، 2 = تصویر، 3 = ویدئو، 4 = PDF
     RevisionStatusCode    1 = پیش‌نویس، 2 = تأییدشده (جاری)، 3 = منسوخ
     SourceCode            1 = دستی، 2 = PLC/حسگر
     OutOfRangeActionCode  1 = هشدار، 2 = توقف خط
   انرژی به CapacityType (مبنای نرخی/مصرفی) وصل است، نه generalmfr.Energy (تصمیم باز ۹).

   فاز اول: F-ME-001، 002، 003، 004، 006 (الزامی). چک‌لیست اجرایی (005، مهم) و HSE (007، مطلوب) نیامده‌اند.
   این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF COL_LENGTH('mes.ProductionOperationGroup', 'ParentId') IS NULL
  ALTER TABLE mes.ProductionOperationGroup ADD ParentId BIGINT NULL, SortOrder INT NULL;

IF COL_LENGTH('mes.ProductionOperation', 'OperationTypeCode') IS NULL
  ALTER TABLE mes.ProductionOperation ADD
    OperationTypeCode INT NOT NULL CONSTRAINT DF_mes_ProductionOperation_OperationTypeCode DEFAULT (1)
      CONSTRAINT CK_mes_ProductionOperation_OperationTypeCode CHECK (OperationTypeCode IN (1, 2, 3, 4, 5, 6)),
    IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionOperation_IsActive DEFAULT (1),
    SortOrder INT NULL;

IF OBJECT_ID('mes.ProductionOperationResource','U') IS NULL
CREATE TABLE mes.ProductionOperationResource (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionOperationResource PRIMARY KEY,
  ProductionOperationId BIGINT NOT NULL,
  ResourceTypeCode INT NOT NULL CONSTRAINT CK_mes_ProductionOperationResource_Type CHECK (ResourceTypeCode IN (1, 2)),
  WorkCenterId BIGINT NULL,
  ResourceGroupId BIGINT NULL,
  IsPrimary BIT NOT NULL CONSTRAINT DF_mes_ProductionOperationResource_IsPrimary DEFAULT (0),
  Priority INT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionOperationTools','U') IS NULL
CREATE TABLE mes.ProductionOperationTools (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionOperationTools PRIMARY KEY,
  ProductionOperationId BIGINT NOT NULL,
  ToolsGroupId BIGINT NOT NULL,
  Quantity INT NOT NULL,
  MeasureUnitId BIGINT NULL,
  IsMandatory BIT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionOperationEnergy','U') IS NULL
CREATE TABLE mes.ProductionOperationEnergy (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionOperationEnergy PRIMARY KEY,
  ProductionOperationId BIGINT NOT NULL,
  CapacityTypeId BIGINT NOT NULL,
  StandardDuration INT NULL,
  Quantity DECIMAL(32,6) NOT NULL,
  MeasureUnitId BIGINT NULL,
  IsMandatory BIT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionOperationInstruction','U') IS NULL
CREATE TABLE mes.ProductionOperationInstruction (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionOperationInstruction PRIMARY KEY,
  ProductionOperationId BIGINT NOT NULL,
  Sequence INT NULL,
  DocumentNumber NVARCHAR(64) NOT NULL,
  Title NVARCHAR(256) NOT NULL,
  RevisionNo INT NOT NULL CONSTRAINT DF_mes_ProductionOperationInstruction_RevisionNo DEFAULT (1),
  RevisionStatusCode INT NOT NULL CONSTRAINT DF_mes_ProductionOperationInstruction_Status DEFAULT (1)
    CONSTRAINT CK_mes_ProductionOperationInstruction_Status CHECK (RevisionStatusCode IN (1, 2, 3)),
  MediaTypeCode INT NOT NULL CONSTRAINT CK_mes_ProductionOperationInstruction_Media CHECK (MediaTypeCode IN (1, 2, 3, 4)),
  FileName NVARCHAR(256) NULL,
  DmsDocumentId BIGINT NULL,
  EffectiveDate DATE NULL,
  ApproverTitle NVARCHAR(256) NULL,
  IsShownOnTerminal BIT NOT NULL CONSTRAINT DF_mes_ProductionOperationInstruction_Terminal DEFAULT (1),
  InstructionDescription NVARCHAR(MAX) NULL,
  NeededTools NVARCHAR(400) NULL,
  NeededUniforms NVARCHAR(400) NULL,
  IsMandatory BIT NOT NULL CONSTRAINT DF_mes_ProductionOperationInstruction_IsMandatory DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionOperationParameter','U') IS NULL
CREATE TABLE mes.ProductionOperationParameter (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionOperationParameter PRIMARY KEY,
  ProductionOperationId BIGINT NOT NULL,
  Sequence INT NULL,
  Name NVARCHAR(256) NOT NULL,
  UnitTitle NVARCHAR(64) NULL,
  TargetValue DECIMAL(32,6) NULL,
  MinValue DECIMAL(32,6) NULL,
  MaxValue DECIMAL(32,6) NULL,
  SourceCode INT NOT NULL CONSTRAINT DF_mes_ProductionOperationParameter_Source DEFAULT (1),
  SamplingIntervalMinutes INT NULL,
  OutOfRangeActionCode INT NOT NULL CONSTRAINT DF_mes_ProductionOperationParameter_Action DEFAULT (1),
  IsCritical BIT NOT NULL CONSTRAINT DF_mes_ProductionOperationParameter_IsCritical DEFAULT (0),
  Description NVARCHAR(400) NULL
);
GO

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

/* درخت گروه عملیات با سطح و مسیر؛ ریشه‌ها ParentId خالی دارند. */
CREATE OR ALTER PROCEDURE mes.GetOperationGroupTree
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  WITH t AS (
    SELECT g.Id, g.ParentId, 1 AS Level, CAST(g.Name AS NVARCHAR(1000)) AS Path
    FROM mes.ProductionOperationGroup g
    WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0 AND g.ParentId IS NULL
    UNION ALL
    SELECT g.Id, g.ParentId, t.Level + 1, CAST(t.Path + N' › ' + g.Name AS NVARCHAR(1000))
    FROM mes.ProductionOperationGroup g JOIN t ON g.ParentId = t.Id
    WHERE g.IsDeleted = 0
  )
  SELECT CAST(g.Id AS INT) AS GroupId, CAST(g.ParentId AS INT) AS ParentId, g.Number AS Code, g.Name AS Title, g.Description,
         t.Level, t.Path, g.SortOrder,
         (SELECT COUNT(*) FROM mes.ProductionOperation o WHERE o.OperationGroupId = g.Id AND o.IsDeleted = 0) AS OperationCount
  FROM t JOIN mes.ProductionOperationGroup g ON g.Id = t.Id
  ORDER BY t.Path;
END
GO

CREATE OR ALTER PROCEDURE mes.GetLibraryOperations
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.Id AS INT) AS OperationId, o.Number AS Code, o.Name AS Title, CAST(o.OperationGroupId AS INT) AS GroupId,
         g.Name AS GroupTitle, o.OperationTypeCode, o.IsActive, o.Description,
         (SELECT COUNT(*) FROM mes.ProductionOperationResource r WHERE r.ProductionOperationId = o.Id AND r.IsDeleted = 0) AS ResourceCount,
         (SELECT TOP (1) COALESCE(rg.Number + N' — ' + rg.Name, w.Number + N' — ' + w.Name)
            FROM mes.ProductionOperationResource r
            LEFT JOIN mes.ResourceGroup rg ON rg.Id = r.ResourceGroupId
            LEFT JOIN mes.WorkCenter w ON w.Id = r.WorkCenterId
           WHERE r.ProductionOperationId = o.Id AND r.IsDeleted = 0
           ORDER BY r.IsPrimary DESC, r.Priority) AS PrimaryResource,
         (SELECT COUNT(*) FROM mes.OperationSkillRequirement s WHERE s.OperationId = o.Id AND s.IsDeleted = 0) AS SkillCount,
         (SELECT COUNT(*) FROM mes.ProductionOperationTools x WHERE x.ProductionOperationId = o.Id AND x.IsDeleted = 0) AS ToolCount,
         (SELECT COUNT(*) FROM mes.ProductionOperationEnergy x WHERE x.ProductionOperationId = o.Id AND x.IsDeleted = 0) AS EnergyCount,
         (SELECT COUNT(*) FROM mes.ProductionOperationInstruction x WHERE x.ProductionOperationId = o.Id AND x.IsDeleted = 0 AND x.RevisionStatusCode = 2) AS ActiveInstructionCount,
         (SELECT COUNT(*) FROM mes.ProductionOperationParameter x WHERE x.ProductionOperationId = o.Id AND x.IsDeleted = 0) AS ParameterCount,
         (SELECT COUNT(*) FROM mes.ProductionOperationActivity x WHERE x.ProductionOperationId = o.Id AND x.IsDeleted = 0) AS ActivityCount
  FROM mes.ProductionOperation o
  LEFT JOIN mes.ProductionOperationGroup g ON g.Id = o.OperationGroupId
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0
  ORDER BY ISNULL(o.SortOrder, 999), o.Number;
END
GO

/* منابع لازم هر عملیات در یک شکل: ۱ ایستگاه/گروه منبع، ۲ مهارت، ۳ ابزار، ۴ انرژی/کارکرد. */
CREATE OR ALTER PROCEDURE mes.GetOperationResources
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(r.ProductionOperationId AS INT) AS OperationId, 1 AS KindCode, r.ResourceTypeCode AS SubTypeCode,
         COALESCE(rg.Number + N' — ' + rg.Name, w.Number + N' — ' + w.Name) AS ResourceTitle,
         CASE WHEN r.WorkCenterId IS NOT NULL THEN l.Name
              ELSE (SELECT STRING_AGG(x.Name, N'، ') FROM (SELECT DISTINCT l2.Name FROM mes.WorkCenter w2
                      JOIN mes.ProductionLine l2 ON l2.Id = w2.ProductionLineId
                      WHERE w2.ResourceGroupId = r.ResourceGroupId AND w2.IsDeleted = 0) x) END AS Scope,
         CAST(NULL AS DECIMAL(32,6)) AS Quantity, CAST(NULL AS NVARCHAR(64)) AS UnitTitle,
         CAST(1 AS BIT) AS IsMandatory, r.IsPrimary, r.Priority, CAST(NULL AS INT) AS LevelCode, CAST(NULL AS BIT) AS IsValid, r.Description
  FROM mes.ProductionOperationResource r
  LEFT JOIN mes.WorkCenter w ON w.Id = r.WorkCenterId
  LEFT JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
  LEFT JOIN mes.ResourceGroup rg ON rg.Id = r.ResourceGroupId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
  UNION ALL
  SELECT CAST(s.OperationId AS INT), 2, NULL, k.Number + N' — ' + k.Name, NULL, NULL, NULL,
         CAST(CASE WHEN s.EnforcementModeCode = 2 THEN 1 ELSE 0 END AS BIT), NULL, NULL, s.MinSkillLevelCode, k.IsActive, s.Description
  FROM mes.OperationSkillRequirement s JOIN mes.Skill k ON k.Id = s.SkillId
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0
  UNION ALL
  SELECT CAST(t.ProductionOperationId AS INT), 3, NULL, g.Number + N' — ' + g.Name,
         (SELECT CAST(COUNT(*) AS NVARCHAR(16)) + N' ابزار ثبت‌شده' FROM mes.ToolsProduction p WHERE p.ToolsGroupId = g.Id AND p.IsDeleted = 0),
         t.Quantity, N'عدد', ISNULL(t.IsMandatory, 0), NULL, NULL, NULL,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ToolsProduction p WHERE p.ToolsGroupId = g.Id AND p.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT), t.Description
  FROM mes.ProductionOperationTools t JOIN mes.ToolsProductionGroup g ON g.Id = t.ToolsGroupId
  WHERE t.CompanyId = @CompanyId AND t.IsDeleted = 0
  UNION ALL
  SELECT CAST(e.ProductionOperationId AS INT), 4, ct.MeasureBasisCode, ct.Number + N' — ' + ct.Name, NULL,
         e.Quantity, ct.MeasureUnitTitle, ISNULL(e.IsMandatory, 0), NULL, NULL, NULL,
         CAST(CASE WHEN ct.IsActive = 1 AND ct.MeasureBasisCode = 2 THEN 1 ELSE 0 END AS BIT), e.Description
  FROM mes.ProductionOperationEnergy e JOIN mes.CapacityType ct ON ct.Id = e.CapacityTypeId
  WHERE e.CompanyId = @CompanyId AND e.IsDeleted = 0
  ORDER BY 1, 2, IsPrimary DESC, Priority;
END
GO

CREATE OR ALTER PROCEDURE mes.GetOperationInstructions
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(i.ProductionOperationId AS INT) AS OperationId, i.Sequence, i.DocumentNumber, i.Title, i.RevisionNo, i.RevisionStatusCode,
         i.MediaTypeCode, i.FileName, i.EffectiveDate, i.ApproverTitle, i.IsShownOnTerminal, i.InstructionDescription,
         i.NeededTools, i.NeededUniforms, i.IsMandatory, i.Description
  FROM mes.ProductionOperationInstruction i
  WHERE i.CompanyId = @CompanyId AND i.IsDeleted = 0
  ORDER BY i.ProductionOperationId, i.Sequence, i.DocumentNumber, i.RevisionNo DESC;
END
GO

CREATE OR ALTER PROCEDURE mes.GetOperationParameters
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(p.ProductionOperationId AS INT) AS OperationId, p.Sequence, p.Name, p.UnitTitle, p.TargetValue, p.MinValue, p.MaxValue,
         p.SourceCode, p.SamplingIntervalMinutes, p.OutOfRangeActionCode, p.IsCritical, p.Description
  FROM mes.ProductionOperationParameter p
  WHERE p.CompanyId = @CompanyId AND p.IsDeleted = 0
  ORDER BY p.ProductionOperationId, p.Sequence;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.ProductionOperationParameter خالی است.
   گروه قدیم OG-SOLID ریشه می‌شود و عملیات گام ۳ به زیرگروه‌ها می‌روند؛ ۷ عملیات تازه.
   عمداً خراب: «خشک‌کن بستر سیال» و «تقطیر حلال» (تولیدی) منبع اصلی ندارند؛ گروه ابزار «توری و الک» ابزار ثبت‌شده ندارد؛ «گرانولاسیون» دستورالعمل تأییدشده ندارد (فقط پیش‌نویس)؛
   «روکش‌دهی» دمای هوای ورودی هدف ۶۲ با حد بالای ۶۰ دارد؛ «تقطیر حلال» از گاز غیرفعال استفاده می‌کند؛
   SOP-PRS-014 دو نسخه‌ی تأییدشده‌ی هم‌زمان دارد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductionOperationParameter)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @root BIGINT = (SELECT Id FROM mes.ProductionOperationGroup WHERE Number = N'OG-SOLID' AND CompanyId = @C);
  UPDATE mes.ProductionOperationGroup SET SortOrder = 1 WHERE Id = @root;

  INSERT mes.ProductionOperationGroup (CompanyId, Number, Name, ParentId, SortOrder, Description)
  SELECT @C, v.Number, v.Name, ISNULL(p.Id, @root), v.Sort, v.Description
  FROM (VALUES
    (N'OG-PREP',  N'آماده‌سازی',        NULL,        1, N'توزین، الک و پیش‌مخلوط'),
    (N'OG-MAIN',  N'فرایند اصلی',        NULL,        2, NULL),
    (N'OG-GRAN',  N'گرانولاسیون و خشک', N'OG-MAIN',  1, NULL),
    (N'OG-FORM',  N'شکل‌دهی و روکش',     N'OG-MAIN',  2, NULL),
    (N'OG-QC',    N'کیفی',               NULL,        3, N'بازرسی و نمونه‌برداری حین فرایند'),
    (N'OG-PACK',  N'بسته‌بندی و انتقال',  NULL,        4, NULL),
    (N'OG-RECOV', N'بازیافت',            NULL,        5, NULL),
    (N'OG-INFO',  N'ثبت و سوابق',        NULL,        6, N'عملیات اطلاعاتی بدون مصرف ظرفیت')
  ) v(Number, Name, ParentNo, Sort, Description)
  LEFT JOIN mes.ProductionOperationGroup p ON p.Number = v.ParentNo AND p.CompanyId = @C;
  /* زیرگروه‌ها بعد از والدشان درج شده‌اند ولی JOIN بالا هنوز آن‌ها را نمی‌دید؛ والد را دوباره تنظیم کن. */
  UPDATE g SET g.ParentId = p.Id
  FROM mes.ProductionOperationGroup g
  JOIN (VALUES (N'OG-GRAN', N'OG-MAIN'), (N'OG-FORM', N'OG-MAIN')) v(Child, Parent) ON v.Child = g.Number
  JOIN mes.ProductionOperationGroup p ON p.Number = v.Parent AND p.CompanyId = @C
  WHERE g.CompanyId = @C;

  /* عملیات گام ۳: گروه، ماهیت و ترتیب */
  UPDATE o SET o.OperationGroupId = g.Id, o.OperationTypeCode = v.TypeCode, o.SortOrder = v.Sort
  FROM mes.ProductionOperation o
  JOIN (VALUES (N'OP-10', N'OG-PREP', 1, 10), (N'OP-20', N'OG-GRAN', 1, 20), (N'OP-30', N'OG-FORM', 1, 30),
               (N'OP-40', N'OG-FORM', 1, 40), (N'OP-45', N'OG-QC', 2, 45), (N'OP-50', N'OG-PACK', 3, 50)) v(Op, Grp, TypeCode, Sort)
    ON v.Op = o.Number
  JOIN mes.ProductionOperationGroup g ON g.Number = v.Grp AND g.CompanyId = @C
  WHERE o.CompanyId = @C;

  INSERT mes.ProductionOperation (CompanyId, Number, Name, OperationGroupId, LaborClassCode, OperationTypeCode, IsActive, SortOrder, Description)
  SELECT @C, v.Number, v.Name, g.Id, 1, v.TypeCode, v.Active, v.Sort, v.Description
  FROM (VALUES
    (N'OP-15', N'الک و پیش‌مخلوط',        N'OG-PREP',  1, 1, 15, NULL),
    (N'OP-25', N'خشک‌کن بستر سیال',        N'OG-GRAN',  1, 1, 25, NULL),
    (N'OP-60', N'نمونه‌برداری بچ',          N'OG-QC',    2, 1, 60, N'نمونه برای آزمایشگاه کنترل کیفیت'),
    (N'OP-70', N'انتقال به انبار محصول',    N'OG-PACK',  6, 1, 70, NULL),
    (N'OP-80', N'روکش‌دهی برون‌سپاری',       N'OG-FORM',  5, 1, 80, N'نزد پیمانکار روکش‌دهی'),
    (N'OP-90', N'تقطیر و بازیافت حلال',     N'OG-RECOV', 1, 1, 90, N'بازیافت اتانول گرانولاسیون'),
    (N'OP-95', N'ثبت سوابق بچ (BMR)',      N'OG-INFO',  4, 1, 95, NULL),
    (N'OP-35', N'پرس تک‌ایستگاهی (قدیمی)',  N'OG-FORM',  1, 0, 35, N'جایگزین‌شده با پرس روتاری')
  ) v(Number, Name, Grp, TypeCode, Active, Sort, Description)
  JOIN mes.ProductionOperationGroup g ON g.Number = v.Grp AND g.CompanyId = @C;

  /* منابع اصلی و جایگزین: گروه منبع یا ایستگاه هر دو خط */
  INSERT mes.ProductionOperationResource (CompanyId, ProductionOperationId, ResourceTypeCode, WorkCenterId, ResourceGroupId, IsPrimary, Priority, Description)
  SELECT @C, o.Id, v.TypeCode, w.Id, rg.Id, v.IsPrimary, v.Priority, v.Description
  FROM (VALUES
    (N'OP-10', 1, 2, N'10', NULL,         1, 1, NULL),
    (N'OP-10', 1, 1, N'10', NULL,         0, 2, NULL),
    (N'OP-15', 1, 2, N'10', NULL,         1, 1, N'هم‌ایستگاه با توزین'),
    (N'OP-20', 2, NULL, NULL, N'POOL-MIX', 1, 1, N'هر میکسر آزادِ گروه'),
    (N'OP-30', 2, NULL, NULL, N'POOL-PRESS', 1, 1, NULL),
    (N'OP-30', 1, 1, N'30', NULL,         0, 2, N'پرس خط ۱ وقتی گروه پرس پر است'),
    (N'OP-40', 1, 2, N'40', NULL,         1, 1, NULL),
    (N'OP-45', 1, 2, N'25', NULL,         1, 1, NULL),
    (N'OP-45', 1, 1, N'40', NULL,         0, 2, NULL),
    (N'OP-50', 1, 2, N'50', NULL,         1, 1, NULL),
    (N'OP-50', 1, 1, N'50', NULL,         0, 2, NULL),
    (N'OP-60', 1, 2, N'25', NULL,         1, 1, NULL),
    (N'OP-70', 1, 2, N'50', NULL,         1, 1, NULL)
  ) v(Op, TypeCode, LineId, StationNo, GroupNo, IsPrimary, Priority, Description)
  JOIN mes.ProductionOperation o ON o.Number = v.Op AND o.CompanyId = @C
  LEFT JOIN mes.WorkCenter w ON w.Number = v.StationNo AND w.ProductionLineId = v.LineId AND v.TypeCode = 1 AND w.CompanyId = @C
  LEFT JOIN mes.ResourceGroup rg ON rg.Number = v.GroupNo AND rg.CompanyId = @C;

  /* گروه ابزار تازه برای الک (گام ۲ فقط «قالب» داشت) */
  IF NOT EXISTS (SELECT 1 FROM mes.ToolsProductionGroup WHERE Number = N'SCREEN' AND CompanyId = @C)
    INSERT mes.ToolsProductionGroup (CompanyId, Number, Name, ParentId, Level, Chain) VALUES (@C, N'SCREEN', N'توری و الک', NULL, 1, NULL);

  INSERT mes.ProductionOperationTools (CompanyId, ProductionOperationId, ToolsGroupId, Quantity, IsMandatory, Description)
  SELECT @C, o.Id, g.Id, v.Qty, v.Mand, v.Description
  FROM (VALUES
    (N'OP-30', N'MOLD',   1, 1, N'ست پانچ و ماتریس متناظر محصول'),
    (N'OP-50', N'MOLD',   1, 1, N'قالب فرم‌دهی بلیستر'),
    (N'OP-15', N'SCREEN', 1, 1, N'توری مش ۲۰'),
    (N'OP-20', N'SCREEN', 1, 0, N'توری الک تر — اختیاری')
  ) v(Op, Grp, Qty, Mand, Description)
  JOIN mes.ProductionOperation o ON o.Number = v.Op AND o.CompanyId = @C
  JOIN mes.ToolsProductionGroup g ON g.Number = v.Grp AND g.CompanyId = @C;

  INSERT mes.ProductionOperationEnergy (CompanyId, ProductionOperationId, CapacityTypeId, StandardDuration, Quantity, IsMandatory, Description)
  SELECT @C, o.Id, ct.Id, v.Duration, v.Qty, 1, v.Description
  FROM (VALUES
    (N'OP-20', N'ELC', 45,  38.0, N'به‌ازای هر بچ'),
    (N'OP-25', N'STM', 60, 120.0, N'به‌ازای هر بچ'),
    (N'OP-25', N'ELC', 60,  22.0, NULL),
    (N'OP-30', N'ELC', NULL, 15.0, N'به‌ازای هر ساعت'),
    (N'OP-30', N'AIR', NULL,  8.0, NULL),
    (N'OP-40', N'AIR', 90,  30.0, NULL),
    (N'OP-90', N'GAS', 120, 55.0, N'گرمایش ستون تقطیر')
  ) v(Op, Ct, Duration, Qty, Description)
  JOIN mes.ProductionOperation o ON o.Number = v.Op AND o.CompanyId = @C
  JOIN mes.CapacityType ct ON ct.Number = v.Ct AND ct.CompanyId = @C;

  INSERT mes.OperationSkillRequirement (CompanyId, OperationId, SkillId, MinSkillLevelCode, EnforcementModeCode, Description)
  SELECT @C, o.Id, k.Id, v.Lvl, v.Mode, NULL
  FROM (VALUES (N'OP-15', N'SK-WGH', 2, 1), (N'OP-25', N'SK-GRN', 2, 1), (N'OP-60', N'SK-GMP', 2, 2), (N'OP-90', N'SK-GMP', 3, 2)) v(Op, Sk, Lvl, Mode)
  JOIN mes.ProductionOperation o ON o.Number = v.Op AND o.CompanyId = @C
  JOIN mes.Skill k ON k.Number = v.Sk AND k.CompanyId = @C;

  INSERT mes.ProductionOperationInstruction (CompanyId, ProductionOperationId, Sequence, DocumentNumber, Title, RevisionNo, RevisionStatusCode,
                                             MediaTypeCode, FileName, EffectiveDate, ApproverTitle, IsShownOnTerminal, InstructionDescription,
                                             NeededTools, NeededUniforms, IsMandatory)
  SELECT @C, o.Id, v.Seq, v.Doc, v.Title, v.Rev, v.Status, v.Media, v.FileName, v.Eff, v.Approver, v.Terminal, v.Body, v.Tools, v.Uniforms, v.Mand
  FROM (VALUES
    (N'OP-10', 1, N'SOP-WGH-003', N'توزین مواد اولیه در اتاق توزین',       4, 2, 4, N'SOP-WGH-003-r4.pdf', CAST('2026-04-01' AS DATE), N'مدیر تضمین کیفیت', 1,
         N'کنترل کالیبراسیون روزانه‌ی ترازو، توزین دوطرفه و برچسب‌گذاری ظرف', N'ترازوی کالیبره، اسکوپ استیل', N'لباس کلین‌روم، ماسک، دستکش', 1),
    (N'OP-10', 1, N'SOP-WGH-003', N'توزین مواد اولیه در اتاق توزین',       3, 3, 4, N'SOP-WGH-003-r3.pdf', '2025-06-10', N'مدیر تضمین کیفیت', 0, NULL, NULL, NULL, 1),
    (N'OP-10', 2, N'VID-WGH-001', N'فیلم آموزشی توزین دوطرفه',             1, 2, 3, N'weighing-double-check.mp4', '2026-04-01', N'مدیر تضمین کیفیت', 1, NULL, NULL, NULL, 0),
    (N'OP-20', 1, N'SOP-GRN-007', N'گرانولاسیون تر با میکسر برشی بالا',   2, 1, 4, N'SOP-GRN-007-r2-draft.pdf', NULL, NULL, 0,
         N'افزودن محلول چسب در سه مرحله؛ زمان هم‌زدن طبق پارامتر', NULL, N'ماسک P2', 1),
    (N'OP-30', 1, N'SOP-PRS-014', N'راه‌اندازی و کار با پرس روتاری',       3, 2, 4, N'SOP-PRS-014-r3.pdf', '2026-02-15', N'مدیر فنی', 1,
         N'تطبیق شماره‌ی پانچ با دستور، تنظیم وزن و سختی ۱۰ قرص اول', N'آچار پانچ، سختی‌سنج', N'ایرپلاگ، ماسک P2', 1),
    (N'OP-30', 1, N'SOP-PRS-014', N'راه‌اندازی و کار با پرس روتاری',       2, 2, 4, N'SOP-PRS-014-r2.pdf', '2025-03-01', N'مدیر فنی', 0, NULL, NULL, NULL, 1),
    (N'OP-30', 2, N'IMG-PRS-002', N'نقشه‌ی مونتاژ پانچ و ماتریس',          1, 2, 2, N'punch-assembly.png', '2025-03-01', N'مدیر فنی', 1, NULL, NULL, NULL, 0),
    (N'OP-30', 3, N'VID-PRS-005', N'تعویض قالب در ۴ دقیقه',                2, 2, 3, N'die-change-v2.mp4', '2026-02-15', N'مدیر فنی', 1, NULL, NULL, NULL, 0),
    (N'OP-40', 1, N'SOP-COT-002', N'روکش‌دهی فیلمی در پن سوراخ‌دار',        5, 2, 4, N'SOP-COT-002-r5.pdf', '2026-05-22', N'مدیر فنی', 1,
         N'پیش‌گرم بستر، پاشش با فشار و دبی پارامتر، خشک‌کردن نهایی', NULL, N'ماسک تنفسی، عینک', 1),
    (N'OP-45', 1, N'SOP-VIS-001', N'بازرسی بصری قرص روی نوار',             1, 2, 1, NULL, '2025-09-01', N'سرپرست کنترل کیفیت', 1,
         N'حذف قرص شکسته، لب‌پریده و لکه‌دار؛ ثبت تعداد در گزارش', NULL, N'دستکش', 1),
    (N'OP-50', 1, N'SOP-BLS-004', N'بسته‌بندی بلیستر و کارتن',              2, 2, 4, N'SOP-BLS-004-r2.pdf', '2025-11-05', N'مدیر تولید', 1,
         N'تطبیق فویل و PVC با دستور، چاپ بچ و انقضا، آزمون نشتی', NULL, NULL, 1),
    (N'OP-90', 1, N'SOP-REC-001', N'تقطیر و بازیافت اتانول',                1, 2, 4, N'SOP-REC-001.pdf', '2026-03-01', N'مدیر فنی', 1,
         N'کنترل خلوص هر بچ بازیافتی پیش از انتقال به مخزن', NULL, N'لباس ضدجرقه', 1)
  ) v(Op, Seq, Doc, Title, Rev, Status, Media, FileName, Eff, Approver, Terminal, Body, Tools, Uniforms, Mand)
  JOIN mes.ProductionOperation o ON o.Number = v.Op AND o.CompanyId = @C;

  INSERT mes.ProductionOperationParameter (CompanyId, ProductionOperationId, Sequence, Name, UnitTitle, TargetValue, MinValue, MaxValue,
                                           SourceCode, SamplingIntervalMinutes, OutOfRangeActionCode, IsCritical, Description)
  SELECT @C, o.Id, v.Seq, v.Name, v.Unit, v.Target, v.MinV, v.MaxV, v.Src, v.Sampling, v.Action, v.Critical, NULL
  FROM (VALUES
    (N'OP-20', 1, N'سرعت پروانه',               N'rpm',  250.0, 200.0, 300.0, 2, NULL, 1, 0),
    (N'OP-20', 2, N'زمان هم‌زدن تر',             N'دقیقه',   6.0,   5.0,   8.0, 2, NULL, 2, 1),
    (N'OP-20', 3, N'جریان چاپر',                N'A',      12.0,  10.0,  15.0, 2, NULL, 1, 0),
    (N'OP-25', 1, N'دمای هوای ورودی',           N'°C',     60.0,  55.0,  65.0, 2, NULL, 2, 1),
    (N'OP-25', 2, N'رطوبت نهایی گرانول (LOD)',  N'%',       2.0,   1.0,   3.0, 1,   15, 2, 1),
    (N'OP-30', 1, N'نیروی پرس اصلی',            N'kN',     14.5,  12.0,  17.0, 2, NULL, 2, 1),
    (N'OP-30', 2, N'سرعت روتور',                N'rpm',    38.0,  30.0,  45.0, 2, NULL, 1, 0),
    (N'OP-30', 3, N'وزن قرص',                   N'mg',    600.0, 570.0, 630.0, 1,   30, 2, 1),
    (N'OP-30', 4, N'سختی قرص',                  N'N',      80.0,  60.0, 100.0, 1,   30, 1, 0),
    (N'OP-40', 1, N'دمای هوای ورودی',           N'°C',     62.0,  50.0,  60.0, 2, NULL, 1, 1),
    (N'OP-40', 2, N'دمای بستر',                 N'°C',     42.0,  38.0,  45.0, 2, NULL, 2, 1),
    (N'OP-40', 3, N'دبی پاشش',                  N'g/min', 120.0, 100.0, 140.0, 2, NULL, 1, 0),
    (N'OP-40', 4, N'سرعت پن',                   N'rpm',     8.0,   6.0,  10.0, 2, NULL, 1, 0),
    (N'OP-50', 1, N'دمای سیل',                  N'°C',    190.0, 180.0, 200.0, 2, NULL, 2, 1),
    (N'OP-50', 2, N'سرعت بلیستر',               N'سیکل/دقیقه', 35.0, 25.0, 40.0, 2, NULL, 1, 0),
    (N'OP-90', 1, N'دمای ستون',                 N'°C',     78.5,  77.0,  80.0, 2, NULL, 2, 1),
    (N'OP-90', 2, N'خلوص اتانول بازیافتی',       N'%',      95.0,  94.0, NULL,  1,   60, 2, 1)
  ) v(Op, Seq, Name, Unit, Target, MinV, MaxV, Src, Sampling, Action, Critical)
  JOIN mes.ProductionOperation o ON o.Number = v.Op AND o.CompanyId = @C;

  COMMIT;
END
GO
