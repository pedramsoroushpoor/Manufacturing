/* =====================================================================
   اسکیمای mes — گام ۱۴: FRM-PE-05 «بازیابی مواد در فرایند»

   پیش‌نیاز: گام‌های قبل تا mes_frm_pe04 (خروجی نوع ۵ = ماده‌ی بازیابی‌شده).
   یادداشت ALM: «جریان استاندارد فرمول، متمایز از بازیافت ضایعات».

   نگاشت:
     mes.ProductStructureItem.IsRecovery، RecoveryPercentage  = همان ستون‌های نسخه‌ی قبل — «این ردیف بازیابی دارد» و
                                     نرخ بازیابی استاندارد در سطح ردیف/محصول (F-PE-042)
     mes.ProductStructureItem + MaxRecoveredUsePercent — درصد مجاز ماده‌ی بازیابی‌شده در این ردیف فرمول (F-PE-043)
     mes.ProductStructureMaster، نوع ۵ — ماده‌ی بازیابی‌شده به‌عنوان خروجی صریح ساختار (F-PE-047)
     mes.RecoveredMaterial         جدید — ماده‌ی بازیابی‌شده: قلم مستقل یا گرید کیفی همان قلم (F-PE-041)، نرخ بازیابی
                                   سطح قلم (042)، تلفات بازیابی (048)، نسبت جایگزینی با ماده‌ی نو (044)، حداقل خلوص و الزام
                                   تأیید کیفی (045)، سقف دفعات بازیابی (046)، اولویت مصرف (050)
     mes.RecoveryPolicy            جدید — سیاست انتخابی شرکت: پیش‌فرض قلم مستقل یا گرید (F-PE-041)

   فرض‌ها و کدهای موقت:
     RecoveryModeCode         1 = قلم مستقل، 2 = گرید کیفی همان قلم
     ConsumptionPriorityCode  1 = اول بازیابی‌شده تا سقف مجاز، سپس نو؛ 2 = اول نو
     مقدار خروجی بازیابی = مصرف × نرخ بازیابی × (۱ − تلفات بازیابی)
     حلال بازیابی‌شده در موازنه‌ی جرم جامدات (جدول بازدهی PE-04) شرکت نمی‌کند.
     شمارش چرخه روی هر بچ (046) با بچ واقعی می‌آید؛ این‌جا فقط سقف تعریف می‌شود.

   فاز اول: F-PE-041 تا 048 و 050 (الزامی). بازیابی متقاطع (049) و ارزش‌گذاری (051) «مهم»اند.
   این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.RecoveredMaterial','U') IS NULL
CREATE TABLE mes.RecoveredMaterial (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RecoveredMaterial PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  ProductId BIGINT NOT NULL,
  SourceProductId BIGINT NOT NULL,
  RecoveryModeCode INT NOT NULL CONSTRAINT CK_mes_RecoveredMaterial_Mode CHECK (RecoveryModeCode IN (1, 2)),
  GradeTitle NVARCHAR(128) NULL,
  StandardRecoveryPercent DECIMAL(6,2) NULL,
  RecoveryLossPercent DECIMAL(6,2) NULL,
  EquivalenceRatio DECIMAL(10,4) NOT NULL CONSTRAINT DF_mes_RecoveredMaterial_Ratio DEFAULT (1),
  MinPurityPercent DECIMAL(6,2) NULL,
  RequiresQcApproval BIT NOT NULL CONSTRAINT DF_mes_RecoveredMaterial_Qc DEFAULT (1),
  MaxCycles INT NULL,
  ConsumptionPriorityCode INT NOT NULL CONSTRAINT DF_mes_RecoveredMaterial_Priority DEFAULT (1)
    CONSTRAINT CK_mes_RecoveredMaterial_Priority CHECK (ConsumptionPriorityCode IN (1, 2)),
  IsActive BIT NOT NULL CONSTRAINT DF_mes_RecoveredMaterial_IsActive DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.RecoveryPolicy','U') IS NULL
CREATE TABLE mes.RecoveryPolicy (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RecoveryPolicy PRIMARY KEY,
  DefaultRecoveryModeCode INT NOT NULL CONSTRAINT CK_mes_RecoveryPolicy_Mode CHECK (DefaultRecoveryModeCode IN (1, 2)),
  Description NVARCHAR(400) NULL
);

IF COL_LENGTH('mes.ProductStructureItem', 'MaxRecoveredUsePercent') IS NULL
  ALTER TABLE mes.ProductStructureItem ADD MaxRecoveredUsePercent DECIMAL(6,2) NULL;
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

CREATE OR ALTER PROCEDURE mes.GetRecoveryPolicy
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1 DefaultRecoveryModeCode, Description FROM mes.RecoveryPolicy WHERE CompanyId = @CompanyId AND IsDeleted = 0 ORDER BY Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetRecoveredMaterials
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(r.Id AS INT) AS RecoveredMaterialId, r.Number AS Code,
         p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         sp.Number AS SourceCode, sp.Name AS SourceTitle,
         r.RecoveryModeCode, r.GradeTitle, r.StandardRecoveryPercent, r.RecoveryLossPercent,
         CAST(r.EquivalenceRatio AS DECIMAL(10,4)) AS EquivalenceRatio, r.MinPurityPercent, r.RequiresQcApproval, r.MaxCycles,
         r.ConsumptionPriorityCode, r.IsActive, r.Description,
         CAST(CASE WHEN r.StandardRecoveryPercent IS NULL THEN NULL
                   ELSE r.StandardRecoveryPercent * (100 - ISNULL(r.RecoveryLossPercent, 0)) / 100 END AS DECIMAL(6,2)) AS NetRecoveryPercent
  FROM mes.RecoveredMaterial r
  JOIN mes.Product p ON p.Id = r.ProductId
  JOIN mes.Product sp ON sp.Id = r.SourceProductId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
  ORDER BY r.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetRecoveryFormulaRows
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* ردیف‌های نسخه‌ی جاری ساختارها که بازیابی دارند یا مصرف ماده‌ی بازیابی‌شده در آن‌ها مجاز است.
     HasRecoveredMaterial = برای کالای این ردیف ماده‌ی بازیابی‌شده‌ی فعال تعریف شده (منبع یا گرید همان کالا). */
  SELECT s.Number AS StructureCode, s.Name AS StructureTitle, i.Sequence,
         p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         i.QuantityTypeCode, CAST(i.Quantity AS DECIMAL(18,4)) AS Quantity,
         i.IsRecovery, i.RecoveryPercentage, i.MaxRecoveredUsePercent,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.RecoveredMaterial r
                                WHERE r.IsDeleted = 0 AND r.IsActive = 1 AND (r.SourceProductId = i.ProductId OR r.ProductId = i.ProductId))
                   THEN 1 ELSE 0 END AS BIT) AS HasRecoveredMaterial
  FROM mes.ProductStructureItem i
  JOIN mes.ProductStructure s ON s.Id = i.ProductStructureId AND s.RevisionId = i.RevisionId AND s.IsDeleted = 0
  JOIN mes.Product p ON p.Id = i.ProductId
  WHERE i.IsDeleted = 0 AND s.CompanyId = @CompanyId
    AND (i.IsRecovery = 1 OR i.MaxRecoveredUsePercent IS NOT NULL)
  ORDER BY s.Number, i.Sequence;
END
GO

CREATE OR ALTER PROCEDURE mes.GetRecoveryOutputs
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT s.Number AS StructureCode, s.Name AS StructureTitle, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         CAST(m.Quantity AS DECIMAL(18,4)) AS Quantity, m.Description
  FROM mes.ProductStructureMaster m
  JOIN mes.ProductStructure s ON s.Id = m.ProductStructureId AND s.IsDeleted = 0
  JOIN mes.Product p ON p.Id = m.ProductId
  WHERE m.IsDeleted = 0 AND m.MasterProductTypeCode = 5 AND s.CompanyId = @CompanyId
  ORDER BY s.Number;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی جدول ماده‌ی بازیابی‌شده خالی است.
   عمداً خراب: ردیف پاراستامول در گرانول مصرف ۱۵٪ ماده‌ی بازیابی‌شده را مجاز کرده، ولی برای پاراستامول ماده‌ی
   بازیابی‌شده‌ای تعریف نشده.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.RecoveredMaterial)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  INSERT mes.Product (CompanyId, Id, Number, Name, MeasureUnitTitle, ProductGroupTitle)
  SELECT @C, v.Id, v.Number, v.Name, N'لیتر', N'حلال‌ها'
  FROM (VALUES (3009, N'P-3009', N'اتانول ۹۶٪'), (3015, N'P-3015', N'اتانول بازیابی‌شده')) v(Id, Number, Name)
  WHERE NOT EXISTS (SELECT 1 FROM mes.Product p WHERE p.Id = v.Id);
  INSERT mes.ProductionItem (CompanyId, ProductId, ProductionRoleCode, TrackingLevelCode, IsTrackingMandatory)
  SELECT @C, v.Id, 3, 1, 1 FROM (VALUES (3009), (3015)) v(Id)
  WHERE NOT EXISTS (SELECT 1 FROM mes.ProductionItem i WHERE i.ProductId = v.Id);

  INSERT mes.RecoveryPolicy (CompanyId, DefaultRecoveryModeCode, Description)
  VALUES (@C, 1, N'پیش‌فرض: قلم مستقل؛ گرید همان قلم فقط وقتی مشخصات ماده‌ی بازیابی‌شده با ماده‌ی نو یکی است');

  /* ردیف اتانول در گرانول (نسخه‌ی جاری) با بازیابی ۸۰٪ و مصرف تا ۴۰٪ بازیابی‌شده */
  INSERT mes.ProductStructureItem (CompanyId, ProductStructureId, RevisionId, Sequence, ProductId, ItemRoleTitle, QuantityTypeCode, Quantity,
                                   IsRecovery, RecoveryPercentage, MaxRecoveredUsePercent, Description)
  SELECT @C, s.Id, s.RevisionId, 60, 3009, N'حلال گرانولاسیون', 1, 36, 1, 80, 40, N'در خشک‌کن تبخیر و در کندانسور بازیابی می‌شود — خارج از جمع درصد'
  FROM mes.ProductStructure s WHERE s.Number = N'BOM-2001'
    AND NOT EXISTS (SELECT 1 FROM mes.ProductStructureItem i WHERE i.ProductStructureId = s.Id AND i.ProductId = 3009);

  UPDATE i SET i.MaxRecoveredUsePercent = v.MaxUse
  FROM mes.ProductStructureItem i
  JOIN mes.ProductStructure s ON s.Id = i.ProductStructureId AND s.RevisionId = i.RevisionId
  JOIN (VALUES (N'BOM-1001-A', 2001, 5.0), (N'BOM-2001', 3001, 15.0)) v(StructNo, ProductId, MaxUse)
    ON v.StructNo = s.Number AND v.ProductId = i.ProductId;

  INSERT mes.RecoveredMaterial (CompanyId, Number, ProductId, SourceProductId, RecoveryModeCode, GradeTitle, StandardRecoveryPercent, RecoveryLossPercent,
                                EquivalenceRatio, MinPurityPercent, RequiresQcApproval, MaxCycles, ConsumptionPriorityCode, Description)
  VALUES
    (@C, N'RC-ETH', 3015, 3009, 1, N'اتانول درجه‌ی دو',     80, 5, 1.02, 94.0, 1, 3, 1, N'هر ۱٫۰۲ لیتر بازیابی‌شده معادل ۱ لیتر نو (خلوص ۹۴٪ در برابر ۹۶٪)'),
    (@C, N'RC-GRN', 2001, 1001, 2, N'گرانول بازیافتی از قرص شکسته', 0.8, 2, 1.00, 98.5, 1, 1, 2, N'قرص شکسته‌ی پرس آسیاب و به گرانول برمی‌گردد؛ فقط یک بار');

  /* خروجی صریح ساختار: اتانول بازیابی‌شده = ۳۶ × ۰٫۸ × ۰٫۹۵ */
  INSERT mes.ProductStructureMaster (CompanyId, ProductStructureId, ProductId, MasterProductTypeCode, IsMainProduct, Quantity, OutputProcessCode, SortOrder, Description)
  SELECT @C, s.Id, 3015, 5, 0, 27.36, 3, 6, N'۳۶ لیتر × بازیابی ۸۰٪ × (۱ − تلفات ۵٪) — خارج از موازنه‌ی جامدات'
  FROM mes.ProductStructure s WHERE s.Number = N'BOM-2001';

  COMMIT;
END
GO
