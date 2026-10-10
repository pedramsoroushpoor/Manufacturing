/* =====================================================================
   اسکیمای mes — گام ۲۸: FRM-PE-07 «پیکربندی محصول»

   پیش‌نیاز: ساختار محصول (گام ۱۰).
   یادداشت ALM: «خودرو و ماشین‌سازی سفارشی». این فرم فیچر الزامی ندارد و به درخواست صریح کاربر (۱۷ مهر) ساخته شد؛
   نمونه‌ی داده دارویی است (بسته‌بندی صادراتی) چون شرکت نمونه دارویی است.

   نسخه‌ی قبل پیکربندی نداشت؛ جدول‌ها جدیدند:
     mes.ProductConfigurationModel     مدل پیکربندی روی یک کالا و ساختار (F-PE-057)
     mes.ProductConfigurationFeature   ویژگی‌های مدل (F-PE-057)
     mes.ProductConfigurationValue     مقادیر مجاز هر ویژگی با پیش‌فرض (F-PE-057)
     mes.ProductConfigurationRule      قواعد سازگاری: الزام و منع بین انتخاب‌ها (F-PE-058)
     mes.ProductStructureItemCondition شرط ردیف‌های ساختار بر مبنای انتخاب‌ها: فقط اگر، حذف اگر، افزودن اگر (F-PE-059)
   ساختار مؤثر (Resolved BOM، F-PE-060) با رویه‌ی mes.ResolveConfiguredStructure برای یک ترکیب انتخاب حساب می‌شود.
   نگهداری پیکربندی روی سفارش و بچ (F-PE-061) به دستور کار وابسته است و نیامده.

   فرض‌ها و کدهای موقت:
     RuleTypeCode    1 = الزام (اگر الف آنگاه ب)، 2 = منع (الف با ب نه)
     ActionCode      1 = ردیف فقط اگر مقدار انتخاب شود، 2 = حذف ردیف اگر مقدار انتخاب شود، 3 = افزودن قلم اگر مقدار انتخاب شود

   این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.ProductConfigurationModel','U') IS NULL
CREATE TABLE mes.ProductConfigurationModel (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductConfigurationModel PRIMARY KEY,
  Number NVARCHAR(64) NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  ProductId BIGINT NOT NULL,
  ProductStructureId BIGINT NOT NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_PCM_IsActive DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductConfigurationFeature','U') IS NULL
CREATE TABLE mes.ProductConfigurationFeature (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductConfigurationFeature PRIMARY KEY,
  ModelId BIGINT NOT NULL,
  Sequence INT NOT NULL,
  Code NVARCHAR(64) NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  IsMandatory BIT NOT NULL CONSTRAINT DF_mes_PCF_Mandatory DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductConfigurationValue','U') IS NULL
CREATE TABLE mes.ProductConfigurationValue (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductConfigurationValue PRIMARY KEY,
  FeatureId BIGINT NOT NULL,
  Code NVARCHAR(64) NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  IsDefault BIT NOT NULL CONSTRAINT DF_mes_PCV_Default DEFAULT (0),
  SortOrder INT NULL
);

IF OBJECT_ID('mes.ProductConfigurationRule','U') IS NULL
CREATE TABLE mes.ProductConfigurationRule (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductConfigurationRule PRIMARY KEY,
  ModelId BIGINT NOT NULL,
  RuleTypeCode INT NOT NULL CONSTRAINT CK_mes_PCR_Type CHECK (RuleTypeCode IN (1, 2)),
  IfValueId BIGINT NOT NULL,
  ThenValueId BIGINT NOT NULL,
  Message NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductStructureItemCondition','U') IS NULL
CREATE TABLE mes.ProductStructureItemCondition (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductStructureItemCondition PRIMARY KEY,
  ModelId BIGINT NOT NULL,
  ActionCode INT NOT NULL CONSTRAINT CK_mes_PSIC_Action CHECK (ActionCode IN (1, 2, 3)),
  ValueId BIGINT NOT NULL,
  ProductStructureItemId BIGINT NULL,
  ProductId BIGINT NULL,
  Quantity DECIMAL(32,6) NULL,
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

CREATE OR ALTER PROCEDURE mes.GetConfigurationModels
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(m.Id AS INT) AS ModelId, m.Number AS Code, m.Name AS Title, p.Number + N' — ' + p.Name AS ProductTitle, s.Number + N' — ' + s.Name AS StructureTitle,
         m.IsActive, m.Description,
         (SELECT COUNT(*) FROM mes.ProductConfigurationFeature f WHERE f.ModelId = m.Id AND f.IsDeleted = 0) AS FeatureCount
  FROM mes.ProductConfigurationModel m
  JOIN mes.Product p ON p.Id = m.ProductId
  JOIN mes.ProductStructure s ON s.Id = m.ProductStructureId
  WHERE m.CompanyId = @CompanyId AND m.IsDeleted = 0
  ORDER BY m.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetConfigurationValues
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(f.ModelId AS INT) AS ModelId, CAST(f.Id AS INT) AS FeatureId, f.Sequence, f.Code AS FeatureCode, f.Name AS FeatureTitle, f.IsMandatory,
         CAST(v.Id AS INT) AS ValueId, v.Code AS ValueCode, v.Name AS ValueTitle, v.IsDefault, v.SortOrder,
         (SELECT COUNT(*) FROM mes.ProductStructureItemCondition c WHERE c.ValueId = v.Id AND c.IsDeleted = 0) AS ConditionCount
  FROM mes.ProductConfigurationFeature f
  JOIN mes.ProductConfigurationValue v ON v.FeatureId = f.Id AND v.IsDeleted = 0
  WHERE f.CompanyId = @CompanyId AND f.IsDeleted = 0
  ORDER BY f.ModelId, f.Sequence, v.SortOrder;
END
GO

CREATE OR ALTER PROCEDURE mes.GetConfigurationRules
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(r.ModelId AS INT) AS ModelId, r.RuleTypeCode, CAST(r.IfValueId AS INT) AS IfValueId, fa.Name + N' = ' + a.Name AS IfTitle,
         CAST(r.ThenValueId AS INT) AS ThenValueId, fb.Name + N' = ' + b.Name AS ThenTitle, r.Message
  FROM mes.ProductConfigurationRule r
  JOIN mes.ProductConfigurationValue a ON a.Id = r.IfValueId JOIN mes.ProductConfigurationFeature fa ON fa.Id = a.FeatureId
  JOIN mes.ProductConfigurationValue b ON b.Id = r.ThenValueId JOIN mes.ProductConfigurationFeature fb ON fb.Id = b.FeatureId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
  ORDER BY r.ModelId, r.RuleTypeCode, r.Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetConfigurationConditions
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(c.ModelId AS INT) AS ModelId, c.ActionCode, CAST(c.ValueId AS INT) AS ValueId, f.Name + N' = ' + v.Name AS ValueTitle,
         i.Sequence AS ItemSequence, COALESCE(ip.Number + N' — ' + ip.Name, ap.Number + N' — ' + ap.Name) AS ProductTitle,
         COALESCE(c.Quantity, i.Quantity) AS Quantity, COALESCE(ip.MeasureUnitTitle, ap.MeasureUnitTitle) AS UnitTitle,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductionItem pi WHERE pi.ProductId = COALESCE(i.ProductId, c.ProductId) AND pi.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT) AS HasProductionRole,
         c.Description
  FROM mes.ProductStructureItemCondition c
  JOIN mes.ProductConfigurationValue v ON v.Id = c.ValueId JOIN mes.ProductConfigurationFeature f ON f.Id = v.FeatureId
  LEFT JOIN mes.ProductStructureItem i ON i.Id = c.ProductStructureItemId
  LEFT JOIN mes.Product ip ON ip.Id = i.ProductId
  LEFT JOIN mes.Product ap ON ap.Id = c.ProductId
  WHERE c.CompanyId = @CompanyId AND c.IsDeleted = 0
  ORDER BY c.ModelId, f.Sequence, c.ActionCode;
END
GO

/* ساختار مؤثر برای یک ترکیب انتخاب (F-PE-060).
   @ValueIds = شناسه‌ی مقادیر انتخاب‌شده با ویرگول. دو مجموعه‌ی نتیجه: نقض قواعد، و ردیف‌های ساختار مؤثر. */
CREATE OR ALTER PROCEDURE mes.ResolveConfiguredStructure
  @ModelId BIGINT,
  @ValueIds NVARCHAR(4000)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @sel TABLE (ValueId BIGINT PRIMARY KEY);
  INSERT @sel SELECT DISTINCT TRY_CAST(value AS BIGINT) FROM STRING_SPLIT(@ValueIds, ',') WHERE TRY_CAST(value AS BIGINT) IS NOT NULL;
  DECLARE @structure BIGINT = (SELECT ProductStructureId FROM mes.ProductConfigurationModel WHERE Id = @ModelId);

  /* نقض قواعد و ویژگی الزامی بی‌انتخاب */
  SELECT N'rule' AS Kind, r.RuleTypeCode,
         CASE r.RuleTypeCode WHEN 1 THEN fa.Name + N' = ' + a.Name + N' الزام می‌کند ' + fb.Name + N' = ' + b.Name
                             ELSE fa.Name + N' = ' + a.Name + N' با ' + fb.Name + N' = ' + b.Name + N' مجاز نیست' END AS Text, r.Message
  FROM mes.ProductConfigurationRule r
  JOIN mes.ProductConfigurationValue a ON a.Id = r.IfValueId JOIN mes.ProductConfigurationFeature fa ON fa.Id = a.FeatureId
  JOIN mes.ProductConfigurationValue b ON b.Id = r.ThenValueId JOIN mes.ProductConfigurationFeature fb ON fb.Id = b.FeatureId
  WHERE r.ModelId = @ModelId AND r.IsDeleted = 0 AND EXISTS (SELECT 1 FROM @sel s WHERE s.ValueId = r.IfValueId)
    AND ((r.RuleTypeCode = 1 AND NOT EXISTS (SELECT 1 FROM @sel s WHERE s.ValueId = r.ThenValueId))
      OR (r.RuleTypeCode = 2 AND EXISTS (SELECT 1 FROM @sel s WHERE s.ValueId = r.ThenValueId)))
  UNION ALL
  SELECT N'missing', NULL, N'برای «' + f.Name + N'» مقداری انتخاب نشده', NULL
  FROM mes.ProductConfigurationFeature f
  WHERE f.ModelId = @ModelId AND f.IsDeleted = 0 AND f.IsMandatory = 1
    AND NOT EXISTS (SELECT 1 FROM mes.ProductConfigurationValue v JOIN @sel s ON s.ValueId = v.Id WHERE v.FeatureId = f.Id);

  /* ردیف‌های ساختار: پایه، شرطی انتخاب‌شده/حذف‌شده، و اقلام افزوده */
  SELECT x.Sequence, p.Number + N' — ' + p.Name AS ProductTitle, x.Quantity, p.MeasureUnitTitle AS UnitTitle,
         CASE
           WHEN EXISTS (SELECT 1 FROM mes.ProductStructureItemCondition c WHERE c.ModelId = @ModelId AND c.ProductStructureItemId = x.ItemId AND c.ActionCode = 2 AND c.IsDeleted = 0
                          AND EXISTS (SELECT 1 FROM @sel s WHERE s.ValueId = c.ValueId)) THEN N'excluded'
           WHEN EXISTS (SELECT 1 FROM mes.ProductStructureItemCondition c WHERE c.ModelId = @ModelId AND c.ProductStructureItemId = x.ItemId AND c.ActionCode = 1 AND c.IsDeleted = 0)
             THEN CASE WHEN EXISTS (SELECT 1 FROM mes.ProductStructureItemCondition c JOIN @sel s ON s.ValueId = c.ValueId
                                    WHERE c.ModelId = @ModelId AND c.ProductStructureItemId = x.ItemId AND c.ActionCode = 1 AND c.IsDeleted = 0)
                       THEN N'conditional' ELSE N'excluded' END
           ELSE N'base'
         END AS Status,
         (SELECT STRING_AGG(f.Name + N' = ' + v.Name, N'، ') FROM mes.ProductStructureItemCondition c
            JOIN mes.ProductConfigurationValue v ON v.Id = c.ValueId JOIN mes.ProductConfigurationFeature f ON f.Id = v.FeatureId
           WHERE c.ModelId = @ModelId AND c.ProductStructureItemId = x.ItemId AND c.IsDeleted = 0) AS ConditionText
  FROM mes.fnStructureItems(@structure, NULL) x
  JOIN mes.Product p ON p.Id = x.ProductId
  WHERE x.Source <> 'removed'
  UNION ALL
  SELECT NULL, p.Number + N' — ' + p.Name, c.Quantity, p.MeasureUnitTitle, N'added', f.Name + N' = ' + v.Name
  FROM mes.ProductStructureItemCondition c
  JOIN @sel s ON s.ValueId = c.ValueId
  JOIN mes.ProductConfigurationValue v ON v.Id = c.ValueId JOIN mes.ProductConfigurationFeature f ON f.Id = v.FeatureId
  JOIN mes.Product p ON p.Id = c.ProductId
  WHERE c.ModelId = @ModelId AND c.ActionCode = 3 AND c.IsDeleted = 0
  ORDER BY 1, 2;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.ProductConfigurationModel خالی است.
   مدل «بسته‌بندی قرص ۵۰۰ برای بازارهای مختلف» روی BOM-1001-A. چهار کالای بسته‌بندی تازه به کاتالوگ افزوده می‌شود.
   عمداً خراب: ویژگی «تعداد در بلیستر» روی هیچ ردیفی اثر ندارد؛ بروشورهای انگلیسی و عربی و هولوگرام نقش تولیدی ندارند (FRM-PE-01).
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductConfigurationModel)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  IF NOT EXISTS (SELECT 1 FROM mes.Product WHERE Id = 4006)
  BEGIN
    INSERT mes.Product (Id, CompanyId, Number, Name, MeasureUnitTitle, ProductGroupTitle, IsActive)
    VALUES (4006, @C, N'P-4006', N'بروشور انگلیسی', N'عدد', N'مواد بسته‌بندی', 1),
           (4007, @C, N'P-4007', N'بروشور عربی', N'عدد', N'مواد بسته‌بندی', 1),
           (4008, @C, N'P-4008', N'برچسب امنیتی هولوگرام', N'عدد', N'مواد بسته‌بندی', 1),
           (4009, @C, N'P-4009', N'کارتن صادراتی', N'عدد', N'مواد بسته‌بندی', 1);
    INSERT mes.ProductionItem (CompanyId, ProductId, ProductionRoleCode, TrackingLevelCode, IsTrackingMandatory, IsPhantom, IsDimensional, IsActive)
    VALUES (@C, 4009, 4, 0, 0, 0, 0, 1);
  END

  INSERT mes.ProductConfigurationModel (CompanyId, Number, Name, ProductId, ProductStructureId, Description)
  SELECT @C, N'CFG-1001', N'بسته‌بندی قرص ۵۰۰ برای بازارهای مختلف', 1001, s.Id, N'زبان بروشور، بازار، مهر امنیتی و تعداد در بلیستر'
  FROM mes.ProductStructure s WHERE s.Number = N'BOM-1001-A' AND s.CompanyId = @C;
  DECLARE @m BIGINT = SCOPE_IDENTITY();

  INSERT mes.ProductConfigurationFeature (CompanyId, ModelId, Sequence, Code, Name, IsMandatory, Description)
  VALUES (@C, @m, 10, N'MKT', N'بازار', 1, NULL), (@C, @m, 20, N'LANG', N'زبان بروشور', 1, NULL),
         (@C, @m, 30, N'SEC', N'مهر امنیتی', 1, NULL), (@C, @m, 40, N'BLS', N'تعداد در بلیستر', 1, N'هنوز روی ساختار اثری تعریف نشده');

  INSERT mes.ProductConfigurationValue (CompanyId, FeatureId, Code, Name, IsDefault, SortOrder)
  SELECT @C, f.Id, v.Code, v.Name, v.Def, v.Sort
  FROM (VALUES (N'MKT', N'DOM', N'داخلی', 1, 1), (N'MKT', N'EXP', N'صادراتی', 0, 2),
               (N'LANG', N'FA', N'فارسی', 1, 1), (N'LANG', N'EN', N'انگلیسی', 0, 2), (N'LANG', N'AR', N'عربی', 0, 3),
               (N'SEC', N'NO', N'ندارد', 1, 1), (N'SEC', N'YES', N'هولوگرام', 0, 2),
               (N'BLS', N'10', N'۱۰ عددی', 1, 1), (N'BLS', N'20', N'۲۰ عددی', 0, 2)) v(Feature, Code, Name, Def, Sort)
  JOIN mes.ProductConfigurationFeature f ON f.ModelId = @m AND f.Code = v.Feature;

  DECLARE @val TABLE (Code NVARCHAR(32), Id BIGINT);
  INSERT @val SELECT f.Code + N'.' + v.Code, v.Id FROM mes.ProductConfigurationValue v JOIN mes.ProductConfigurationFeature f ON f.Id = v.FeatureId WHERE f.ModelId = @m;

  INSERT mes.ProductConfigurationRule (CompanyId, ModelId, RuleTypeCode, IfValueId, ThenValueId, Message)
  SELECT @C, @m, v.T, a.Id, b.Id, v.Msg
  FROM (VALUES (1, N'MKT.EXP', N'SEC.YES', N'محموله‌ی صادراتی مهر امنیتی می‌خواهد'),
               (2, N'MKT.DOM', N'LANG.AR', N'بازار داخلی بروشور عربی ندارد'),
               (2, N'BLS.20',  N'MKT.EXP', N'پروانه‌ی صادرات فقط برای بلیستر ۱۰ عددی است')) v(T, IfCode, ThenCode, Msg)
  JOIN @val a ON a.Code = v.IfCode JOIN @val b ON b.Code = v.ThenCode;

  INSERT mes.ProductStructureItemCondition (CompanyId, ModelId, ActionCode, ValueId, ProductStructureItemId, ProductId, Quantity, Description)
  SELECT @C, @m, v.Act, val.Id, i.Id, v.ProductId, v.Qty, v.Description
  FROM (VALUES (1, N'LANG.FA', 80, NULL, NULL, N'بروشور فارسی فقط برای زبان فارسی'),
               (3, N'LANG.EN', NULL, 4006, 10000.0, NULL),
               (3, N'LANG.AR', NULL, 4007, 10000.0, NULL),
               (3, N'SEC.YES', NULL, 4008, 10000.0, N'یک برچسب روی هر کارتن'),
               (2, N'MKT.EXP', 70, NULL, NULL, N'کارتن داخلی در صادرات حذف می‌شود'),
               (3, N'MKT.EXP', NULL, 4009, 10000.0, NULL)) v(Act, ValCode, ItemSeq, ProductId, Qty, Description)
  JOIN @val val ON val.Code = v.ValCode
  LEFT JOIN mes.ProductStructure s ON s.Number = N'BOM-1001-A' AND s.CompanyId = @C AND v.ItemSeq IS NOT NULL
  LEFT JOIN mes.ProductStructureItem i ON i.ProductStructureId = s.Id AND i.RevisionId = s.RevisionId AND i.Sequence = v.ItemSeq AND i.IsDeleted = 0;

  COMMIT;
END
GO
