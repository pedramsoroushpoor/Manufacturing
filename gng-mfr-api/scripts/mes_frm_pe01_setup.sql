/* =====================================================================
   اسکیمای mes — گام ۹: FRM-PE-01 «ویژگی‌های تولیدی قلم» (اولین فرم حوزه‌ی مهندسی محصول)

   پیش‌نیاز: mes_frm_rm01 تا mes_frm_rm08 اجرا شده باشند (خطوط از گام ۱، پیمانکاران از گام ۸).
   قاعده‌ی مدل داده همان است که در سرآغاز mes_frm_rm01_setup.sql آمده.
   یادداشت ALM: «افزوده بر کاتالوگ کالای انبار، نه بازتعریف کالا».

   کاتالوگ کالا در این دیتابیس نیست (در نسخه‌ی قبل هم در سیستم انبار بود و جدول‌های mfr فقط ProductId دارند).
   mes.Product جانشین موقت کاتالوگ انبار است — مثل mes.Equipment و mes.ProductionPersonnel — و Id آن همان
   ProductId است. هر چه تولید به کالا اضافه می‌کند در جدول‌های ProductionItem* است و با آمدن کاتالوگ واقعی فقط
   mes.Product کنار می‌رود.

   نگاشت جدول‌های این گام (همه جدیدند؛ نسخه‌ی قبل ویژگی تولیدی در سطح قلم نداشت):
     mes.Product                       جانشین موقت کاتالوگ کالای انبار
     mes.ProductionItem                نقش تولیدی، سطح ردیابی، فانتوم، ابعادی — یک ردیف به‌ازای هر کالای تولیدی
     mes.ProductionItemSupplyPolicy    سیاست تأمین چندگانه با اولویت. ProductSourceCode همان نام فیلد
                                       mfr.ProductEngineeringGroup و generalmfr.ProductPlanningGroup است.
                                       برون‌سپاری به mes.ProductionContractor (FRM-RM-08) وصل می‌شود.
     mes.ProductionAttribute           تعریف ویژگی تولیدی قابل‌گسترش (عیار، چگالی، رطوبت، ...)
     mes.ProductionItemAttribute       مقدار ویژگی برای هر قلم (اسمی و بازه‌ی مجاز)
     mes.ProductionDimension، mes.ProductionDimensionValue
                                       تعریف بُعد (اندازه، رنگ، ...) و مقادیرش
     mes.ProductionItemDimensionValue  مقادیر مجاز هر بُعد برای یک قلم ابعادی
     mes.ProductionItemVariant، mes.ProductionItemVariantValue
                                       ترکیب‌های ساخته‌شده (با mes.GenerateItemVariants) و مقادیر هر ترکیب
     mes.ProductionItemLotSize         اندازه‌ی بچ، حداقل، حداکثر و مضرب سفارش تولید به‌ازای قلم و خط
                                       (ProductionLineId خالی = همه‌ی خطوط). BatchSize همان نام نسخه‌ی قبل است.

   فرض‌ها و کدهای موقت تا تأیید/رسیدن کدلیست اصلی:
     ProductionRoleCode   1 = محصول نهایی، 2 = نیمه‌ساخته، 3 = ماده‌ی اولیه، 4 = مواد بسته‌بندی، 5 = محصول جانبی
     ProductSourceCode    1 = تولید داخلی، 2 = خرید، 3 = برون‌سپاری، 4 = انتقال بین‌سایتی
     TrackingLevelCode    0 = بدون ردیابی، 1 = بچ، 2 = سریال، 3 = بچ + سریال
     AttributeDataTypeCode 1 = عددی، 2 = بازه، 3 = متنی
     قواعد کنترلی (فقط هشدار، چون فرم هنوز ثبت ندارد):
       محصول نهایی و نیمه‌ساخته‌ی غیرفانتوم بدون ردیابی بچ (الزام GMP)؛ فانتوم با ردیابی یا با سیاستی جز تولید داخلی؛
       برون‌سپاری به پیمانکار تعلیق‌شده یا غیرفعال؛ قلمِ «تولید داخلی» بدون اندازه‌ی بچ؛ قلم ابعادی بدون ترکیب.

   فاز اول: F-PE-001، 002، 003، 004، 005، 006، 008 (الزامی). قلم پیکربندی‌پذیر (007، مهم، فاز ۳) نیامده.
   mes.GenerateItemVariants دومین رویه‌ی نویسنده‌ی سیستم است (بعد از GenerateShiftCalendar).
   این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */
IF OBJECT_ID('mes.Product','U') IS NULL
CREATE TABLE mes.Product (
  Id BIGINT NOT NULL CONSTRAINT PK_mes_Product PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  MeasureUnitId BIGINT NULL,
  MeasureUnitTitle NVARCHAR(64) NOT NULL,
  ProductGroupTitle NVARCHAR(256) NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_Product_IsActive DEFAULT (1)
);

IF OBJECT_ID('mes.ProductionItem','U') IS NULL
CREATE TABLE mes.ProductionItem (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionItem PRIMARY KEY,
  ProductId BIGINT NOT NULL CONSTRAINT UQ_mes_ProductionItem_ProductId UNIQUE,
  ProductionRoleCode INT NOT NULL CONSTRAINT CK_mes_ProductionItem_Role CHECK (ProductionRoleCode IN (1, 2, 3, 4, 5)),
  TrackingLevelCode INT NOT NULL CONSTRAINT DF_mes_ProductionItem_Tracking DEFAULT (1)
    CONSTRAINT CK_mes_ProductionItem_Tracking CHECK (TrackingLevelCode IN (0, 1, 2, 3)),
  IsTrackingMandatory BIT NOT NULL CONSTRAINT DF_mes_ProductionItem_IsTrackingMandatory DEFAULT (1),
  IsPhantom BIT NOT NULL CONSTRAINT DF_mes_ProductionItem_IsPhantom DEFAULT (0),
  IsDimensional BIT NOT NULL CONSTRAINT DF_mes_ProductionItem_IsDimensional DEFAULT (0),
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionItem_IsActive DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionItemSupplyPolicy','U') IS NULL
CREATE TABLE mes.ProductionItemSupplyPolicy (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionItemSupplyPolicy PRIMARY KEY,
  ProductionItemId BIGINT NOT NULL,
  ProductSourceCode BIGINT NOT NULL CONSTRAINT CK_mes_ProductionItemSupplyPolicy_Source CHECK (ProductSourceCode IN (1, 2, 3, 4)),
  Priority INT NOT NULL CONSTRAINT DF_mes_ProductionItemSupplyPolicy_Priority DEFAULT (1),
  ContractorId BIGINT NULL,
  SourceSiteId BIGINT NULL,
  SourceSiteTitle NVARCHAR(256) NULL,
  SharePercent DECIMAL(6,2) NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionAttribute','U') IS NULL
CREATE TABLE mes.ProductionAttribute (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionAttribute PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  UnitTitle NVARCHAR(64) NULL,
  AttributeDataTypeCode INT NOT NULL CONSTRAINT CK_mes_ProductionAttribute_Type CHECK (AttributeDataTypeCode IN (1, 2, 3)),
  SortOrder INT NOT NULL CONSTRAINT DF_mes_ProductionAttribute_SortOrder DEFAULT (0),
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionAttribute_IsActive DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionItemAttribute','U') IS NULL
CREATE TABLE mes.ProductionItemAttribute (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionItemAttribute PRIMARY KEY,
  ProductionItemId BIGINT NOT NULL,
  ProductionAttributeId BIGINT NOT NULL,
  NominalValue DECIMAL(32,10) NULL,
  MinValue DECIMAL(32,10) NULL,
  MaxValue DECIMAL(32,10) NULL,
  TextValue NVARCHAR(400) NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionDimension','U') IS NULL
CREATE TABLE mes.ProductionDimension (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionDimension PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  SortOrder INT NOT NULL CONSTRAINT DF_mes_ProductionDimension_SortOrder DEFAULT (0),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionDimensionValue','U') IS NULL
CREATE TABLE mes.ProductionDimensionValue (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionDimensionValue PRIMARY KEY,
  ProductionDimensionId BIGINT NOT NULL,
  Code NVARCHAR(32) NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  SortOrder INT NOT NULL CONSTRAINT DF_mes_ProductionDimensionValue_SortOrder DEFAULT (0)
);

IF OBJECT_ID('mes.ProductionItemDimensionValue','U') IS NULL
CREATE TABLE mes.ProductionItemDimensionValue (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionItemDimensionValue PRIMARY KEY,
  ProductionItemId BIGINT NOT NULL,
  ProductionDimensionValueId BIGINT NOT NULL
);

IF OBJECT_ID('mes.ProductionItemVariant','U') IS NULL
CREATE TABLE mes.ProductionItemVariant (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionItemVariant PRIMARY KEY,
  ProductionItemId BIGINT NOT NULL,
  VariantCode NVARCHAR(128) NOT NULL,
  VariantTitle NVARCHAR(800) NOT NULL,
  ComboKey VARCHAR(400) NOT NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionItemVariant_IsActive DEFAULT (1),
  GeneratedOn DATETIME NOT NULL CONSTRAINT DF_mes_ProductionItemVariant_GeneratedOn DEFAULT (GETDATE())
);

IF OBJECT_ID('mes.ProductionItemVariantValue','U') IS NULL
CREATE TABLE mes.ProductionItemVariantValue (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionItemVariantValue PRIMARY KEY,
  ProductionItemVariantId BIGINT NOT NULL,
  ProductionDimensionValueId BIGINT NOT NULL
);

IF OBJECT_ID('mes.ProductionItemLotSize','U') IS NULL
CREATE TABLE mes.ProductionItemLotSize (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionItemLotSize PRIMARY KEY,
  ProductionItemId BIGINT NOT NULL,
  ProductionLineId BIGINT NULL,
  BatchSize DECIMAL(32,10) NOT NULL,
  MinOrderQuantity DECIMAL(32,10) NULL,
  MaxOrderQuantity DECIMAL(32,10) NULL,
  OrderMultiple DECIMAL(32,10) NULL,
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
   بخش ۳ — تولید ترکیب‌های قلم ابعادی (نویسنده)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GenerateItemVariants
  @ProductionItemId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  /* حاصل‌ضرب دکارتی مقادیر مجاز همه‌ی بُعدهای هر قلم ابعادی (@ProductionItemId خالی = همه).
     ترکیب تازه افزوده می‌شود؛ ترکیبی که دیگر ساخته نمی‌شود غیرفعال می‌شود، نه حذف (ممکن است سابقه داشته باشد).
     ComboKey = شناسه‌ی مقادیر به ترتیب بُعدها؛ کلید یکتای ترکیب در هر قلم. */
  ;WITH dims AS (
    SELECT x.ProductionItemId, x.ProductionDimensionId,
           DENSE_RANK() OVER (PARTITION BY x.ProductionItemId ORDER BY d.SortOrder, d.Id) AS rk
    FROM (SELECT DISTINCT iv.ProductionItemId, v.ProductionDimensionId
          FROM mes.ProductionItemDimensionValue iv
          JOIN mes.ProductionDimensionValue v ON v.Id = iv.ProductionDimensionValueId AND v.IsDeleted = 0
          JOIN mes.ProductionItem i ON i.Id = iv.ProductionItemId AND i.IsDeleted = 0 AND i.IsDimensional = 1
          WHERE iv.IsDeleted = 0 AND (@ProductionItemId IS NULL OR iv.ProductionItemId = @ProductionItemId)) x
    JOIN mes.ProductionDimension d ON d.Id = x.ProductionDimensionId
  ), vals AS (
    SELECT iv.ProductionItemId, dims.rk, v.Id AS ValueId, v.Code, v.Name
    FROM mes.ProductionItemDimensionValue iv
    JOIN mes.ProductionDimensionValue v ON v.Id = iv.ProductionDimensionValueId AND v.IsDeleted = 0
    JOIN dims ON dims.ProductionItemId = iv.ProductionItemId AND dims.ProductionDimensionId = v.ProductionDimensionId
    WHERE iv.IsDeleted = 0
  ), combo AS (
    SELECT ProductionItemId, rk, CAST(Code AS NVARCHAR(400)) AS Code, CAST(Name AS NVARCHAR(800)) AS Title,
           CAST(CAST(ValueId AS VARCHAR(20)) AS VARCHAR(400)) AS ComboKey
    FROM vals WHERE rk = 1
    UNION ALL
    SELECT c.ProductionItemId, v.rk, CAST(c.Code + N'-' + v.Code AS NVARCHAR(400)), CAST(c.Title + N' / ' + v.Name AS NVARCHAR(800)),
           CAST(c.ComboKey + ',' + CAST(v.ValueId AS VARCHAR(20)) AS VARCHAR(400))
    FROM combo c JOIN vals v ON v.ProductionItemId = c.ProductionItemId AND v.rk = c.rk + 1
  )
  SELECT c.ProductionItemId, c.Code, c.Title, c.ComboKey
  INTO #combo
  FROM combo c
  WHERE c.rk = (SELECT MAX(d.rk) FROM dims d WHERE d.ProductionItemId = c.ProductionItemId);

  BEGIN TRAN;
  INSERT mes.ProductionItemVariant (CompanyId, ProductionItemId, VariantCode, VariantTitle, ComboKey)
  SELECT i.CompanyId, c.ProductionItemId, p.Number + N'-' + c.Code, c.Title, c.ComboKey
  FROM #combo c
  JOIN mes.ProductionItem i ON i.Id = c.ProductionItemId
  JOIN mes.Product p ON p.Id = i.ProductId
  WHERE NOT EXISTS (SELECT 1 FROM mes.ProductionItemVariant v WHERE v.ProductionItemId = c.ProductionItemId AND v.ComboKey = c.ComboKey AND v.IsDeleted = 0);

  INSERT mes.ProductionItemVariantValue (CompanyId, ProductionItemVariantId, ProductionDimensionValueId)
  SELECT v.CompanyId, v.Id, CAST(s.value AS BIGINT)
  FROM mes.ProductionItemVariant v
  CROSS APPLY STRING_SPLIT(v.ComboKey, ',') s
  WHERE v.IsDeleted = 0 AND (@ProductionItemId IS NULL OR v.ProductionItemId = @ProductionItemId)
    AND NOT EXISTS (SELECT 1 FROM mes.ProductionItemVariantValue x WHERE x.ProductionItemVariantId = v.Id AND x.IsDeleted = 0);

  UPDATE v SET v.IsActive = CASE WHEN EXISTS (SELECT 1 FROM #combo c WHERE c.ProductionItemId = v.ProductionItemId AND c.ComboKey = v.ComboKey) THEN 1 ELSE 0 END,
               v.ModifiedOn = GETDATE()
  FROM mes.ProductionItemVariant v
  WHERE v.IsDeleted = 0 AND (@ProductionItemId IS NULL OR v.ProductionItemId = @ProductionItemId);
  COMMIT;

  SELECT COUNT(*) AS GeneratedCombos FROM #combo;
END
GO

/* -------------------------------------------------------------------
   بخش ۴ — رویه‌های خواندن (شناسه‌ها INT برمی‌گردند تا در JSON عدد بمانند)
   @ProductId خالی = همه‌ی کالاها.
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetProductionItems
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* همه‌ی کالاهای کاتالوگ، با نقش تولیدی اگر داشته باشند (کالای بدون نقش تولیدی هم می‌آید — F-PE-001). */
  SELECT CAST(p.Id AS INT) AS ProductId, p.Number AS Code, p.Name AS Title, p.MeasureUnitTitle AS UnitTitle, p.ProductGroupTitle,
         CAST(i.Id AS INT) AS ProductionItemId, i.ProductionRoleCode, i.TrackingLevelCode, i.IsTrackingMandatory,
         i.IsPhantom, i.IsDimensional, i.IsActive, i.Description,
         (SELECT COUNT(*) FROM mes.ProductionItemSupplyPolicy s WHERE s.ProductionItemId = i.Id AND s.IsDeleted = 0) AS PolicyCount,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductionItemSupplyPolicy s WHERE s.ProductionItemId = i.Id AND s.IsDeleted = 0 AND s.ProductSourceCode = 1) THEN 1 ELSE 0 END AS BIT) AS IsMade,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductionItemSupplyPolicy s WHERE s.ProductionItemId = i.Id AND s.IsDeleted = 0 AND s.ProductSourceCode <> 1) THEN 1 ELSE 0 END AS BIT) AS HasNonMakePolicy,
         (SELECT COUNT(*) FROM mes.ProductionItemAttribute a WHERE a.ProductionItemId = i.Id AND a.IsDeleted = 0) AS AttributeCount,
         (SELECT COUNT(*) FROM mes.ProductionItemLotSize l WHERE l.ProductionItemId = i.Id AND l.IsDeleted = 0) AS LotSizeCount,
         (SELECT COUNT(*) FROM mes.ProductionItemVariant v WHERE v.ProductionItemId = i.Id AND v.IsDeleted = 0 AND v.IsActive = 1) AS VariantCount
  FROM mes.Product p
  LEFT JOIN mes.ProductionItem i ON i.ProductId = p.Id AND i.IsDeleted = 0
  WHERE p.CompanyId = @CompanyId AND p.IsDeleted = 0
  ORDER BY CASE WHEN i.Id IS NULL THEN 9 ELSE i.ProductionRoleCode END, p.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetItemSupplyPolicies
  @CompanyId BIGINT, @ProductId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(s.Id AS INT) AS PolicyId, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle,
         i.IsPhantom, CAST(s.ProductSourceCode AS INT) AS ProductSourceCode, s.Priority, s.SharePercent,
         CAST(s.ContractorId AS INT) AS ContractorId, c.Number AS ContractorCode, c.Name AS ContractorTitle,
         c.QualificationStatusCode AS ContractorQualificationCode, c.IsActive AS ContractorIsActive,
         s.SourceSiteTitle, s.Description
  FROM mes.ProductionItemSupplyPolicy s
  JOIN mes.ProductionItem i ON i.Id = s.ProductionItemId AND i.IsDeleted = 0
  JOIN mes.Product p ON p.Id = i.ProductId
  LEFT JOIN mes.ProductionContractor c ON c.Id = s.ContractorId
  WHERE s.IsDeleted = 0 AND p.CompanyId = @CompanyId AND (@ProductId IS NULL OR p.Id = @ProductId)
  ORDER BY p.Number, s.Priority;
END
GO

CREATE OR ALTER PROCEDURE mes.GetProductionAttributes
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(a.Id AS INT) AS AttributeId, a.Number AS Code, a.Name AS Title, a.UnitTitle, a.AttributeDataTypeCode, a.IsActive, a.Description,
         (SELECT COUNT(*) FROM mes.ProductionItemAttribute v WHERE v.ProductionAttributeId = a.Id AND v.IsDeleted = 0) AS ItemCount
  FROM mes.ProductionAttribute a
  WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0
  ORDER BY a.SortOrder, a.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetItemAttributes
  @CompanyId BIGINT, @ProductId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(v.Id AS INT) AS ItemAttributeId, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle,
         a.Number AS AttributeCode, a.Name AS AttributeTitle, a.UnitTitle, a.AttributeDataTypeCode,
         CAST(v.NominalValue AS DECIMAL(18,4)) AS NominalValue, CAST(v.MinValue AS DECIMAL(18,4)) AS MinValue,
         CAST(v.MaxValue AS DECIMAL(18,4)) AS MaxValue, v.TextValue, v.Description
  FROM mes.ProductionItemAttribute v
  JOIN mes.ProductionItem i ON i.Id = v.ProductionItemId AND i.IsDeleted = 0
  JOIN mes.Product p ON p.Id = i.ProductId
  JOIN mes.ProductionAttribute a ON a.Id = v.ProductionAttributeId
  WHERE v.IsDeleted = 0 AND p.CompanyId = @CompanyId AND (@ProductId IS NULL OR p.Id = @ProductId)
  ORDER BY p.Number, a.SortOrder;
END
GO

CREATE OR ALTER PROCEDURE mes.GetProductionDimensions
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(d.Id AS INT) AS DimensionId, d.Number AS DimensionCode, d.Name AS DimensionTitle,
         CAST(v.Id AS INT) AS ValueId, v.Code AS ValueCode, v.Name AS ValueTitle,
         (SELECT COUNT(*) FROM mes.ProductionItemDimensionValue x WHERE x.ProductionDimensionValueId = v.Id AND x.IsDeleted = 0) AS ItemCount
  FROM mes.ProductionDimension d
  LEFT JOIN mes.ProductionDimensionValue v ON v.ProductionDimensionId = d.Id AND v.IsDeleted = 0
  WHERE d.CompanyId = @CompanyId AND d.IsDeleted = 0
  ORDER BY d.SortOrder, d.Id, v.SortOrder;
END
GO

CREATE OR ALTER PROCEDURE mes.GetItemDimensionValues
  @CompanyId BIGINT, @ProductId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle,
         d.Number AS DimensionCode, d.Name AS DimensionTitle, v.Code AS ValueCode, v.Name AS ValueTitle
  FROM mes.ProductionItemDimensionValue x
  JOIN mes.ProductionItem i ON i.Id = x.ProductionItemId AND i.IsDeleted = 0
  JOIN mes.Product p ON p.Id = i.ProductId
  JOIN mes.ProductionDimensionValue v ON v.Id = x.ProductionDimensionValueId AND v.IsDeleted = 0
  JOIN mes.ProductionDimension d ON d.Id = v.ProductionDimensionId
  WHERE x.IsDeleted = 0 AND p.CompanyId = @CompanyId AND (@ProductId IS NULL OR p.Id = @ProductId)
  ORDER BY p.Number, d.SortOrder, v.SortOrder;
END
GO

CREATE OR ALTER PROCEDURE mes.GetItemVariants
  @CompanyId BIGINT, @ProductId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(v.Id AS INT) AS VariantId, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle,
         v.VariantCode, v.VariantTitle, v.IsActive, v.GeneratedOn
  FROM mes.ProductionItemVariant v
  JOIN mes.ProductionItem i ON i.Id = v.ProductionItemId AND i.IsDeleted = 0
  JOIN mes.Product p ON p.Id = i.ProductId
  WHERE v.IsDeleted = 0 AND p.CompanyId = @CompanyId AND (@ProductId IS NULL OR p.Id = @ProductId)
  ORDER BY p.Number, v.IsActive DESC, v.VariantCode;
END
GO

CREATE OR ALTER PROCEDURE mes.GetItemLotSizes
  @CompanyId BIGINT, @ProductId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(l.Id AS INT) AS LotSizeId, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         CAST(l.ProductionLineId AS INT) AS LineId, ln.Name AS LineTitle,
         CAST(l.BatchSize AS DECIMAL(18,2)) AS BatchSize, CAST(l.MinOrderQuantity AS DECIMAL(18,2)) AS MinOrderQuantity,
         CAST(l.MaxOrderQuantity AS DECIMAL(18,2)) AS MaxOrderQuantity, CAST(l.OrderMultiple AS DECIMAL(18,2)) AS OrderMultiple,
         l.Description
  FROM mes.ProductionItemLotSize l
  JOIN mes.ProductionItem i ON i.Id = l.ProductionItemId AND i.IsDeleted = 0
  JOIN mes.Product p ON p.Id = i.ProductId
  LEFT JOIN mes.ProductionLine ln ON ln.Id = l.ProductionLineId
  WHERE l.IsDeleted = 0 AND p.CompanyId = @CompanyId AND (@ProductId IS NULL OR p.Id = @ProductId)
  ORDER BY p.Number, CASE WHEN l.ProductionLineId IS NULL THEN 0 ELSE 1 END, ln.Name;
END
GO

/* -------------------------------------------------------------------
   بخش ۵ — داده‌ی نمونه (شرکت ۲۲۲). فقط وقتی جدول کالا خالی است.
   عمداً خراب: «قرص رنگی اطفال» محصول نهایی بدون ردیابی بچ است و اندازه‌ی بچ ندارد؛ «پیش‌مخلوط رنگ» فانتوم است
   ولی ردیابی بچ دارد؛ گرانول قرص سفید سیاست دوم برون‌سپاری به پیمانکار تعلیق‌شده دارد؛ دو کالا نقش تولیدی ندارند.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.Product)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @L1 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۱');
  DECLARE @L2 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۲');

  INSERT mes.Product (CompanyId, Id, Number, Name, MeasureUnitTitle, ProductGroupTitle) VALUES
    (@C, 1001, N'P-1001', N'قرص سفید ساده ۵۰۰ میلی‌گرم',        N'قرص',   N'محصولات جامد خوراکی'),
    (@C, 1002, N'P-1002', N'قرص روکش‌دار ۲۵۰ میلی‌گرم',         N'قرص',   N'محصولات جامد خوراکی'),
    (@C, 1003, N'P-1003', N'قرص جوشان ویتامین C',              N'قرص',   N'قرص‌های جوشان'),
    (@C, 1004, N'P-1004', N'قرص رنگی اطفال',                   N'قرص',   N'محصولات جامد خوراکی'),
    (@C, 1005, N'P-1005', N'قرص سفید ساده ۱۰۰۰ میلی‌گرم (جدید)', N'قرص',   N'محصولات جامد خوراکی'),
    (@C, 2001, N'P-2001', N'گرانول قرص سفید',                  N'kg',    N'نیمه‌ساخته'),
    (@C, 2002, N'P-2002', N'قرص روکش‌نشده ۲۵۰',                 N'قرص',   N'نیمه‌ساخته'),
    (@C, 2003, N'P-2003', N'محلول روکش',                       N'kg',    N'نیمه‌ساخته'),
    (@C, 2004, N'P-2004', N'پیش‌مخلوط رنگ',                     N'kg',    N'نیمه‌ساخته'),
    (@C, 3001, N'P-3001', N'پاراستامول (پودر)',                 N'kg',    N'مواد مؤثره'),
    (@C, 3002, N'P-3002', N'لاکتوز مونوهیدرات',                 N'kg',    N'مواد جانبی'),
    (@C, 3003, N'P-3003', N'منیزیم استئارات',                   N'kg',    N'مواد جانبی'),
    (@C, 3004, N'P-3004', N'هیدروکسی‌پروپیل متیل‌سلولز',         N'kg',    N'مواد جانبی'),
    (@C, 4001, N'P-4001', N'فویل آلومینیوم بلیستر',            N'kg',    N'مواد بسته‌بندی'),
    (@C, 4002, N'P-4002', N'فیلم PVC',                         N'kg',    N'مواد بسته‌بندی'),
    (@C, 4003, N'P-4003', N'کارتن بسته‌بندی',                  N'عدد',   N'مواد بسته‌بندی'),
    (@C, 4004, N'P-4004', N'کپسول خالی ژلاتینی',               N'عدد',   N'مواد بسته‌بندی'),
    (@C, 5001, N'P-5001', N'فیلتر سرنگی آزمایشگاه',            N'عدد',   N'لوازم آزمایشگاه');

  INSERT mes.ProductionItem (CompanyId, ProductId, ProductionRoleCode, TrackingLevelCode, IsTrackingMandatory, IsPhantom, IsDimensional, Description)
  SELECT @C, v.ProductId, v.Role, v.Tracking, v.Mandatory, v.Phantom, v.Dimensional, v.Description
  FROM (VALUES
    (1001, 1, 3, 1, 0, 0, N'بچ + سریال برای کد رهگیری دارو'),
    (1002, 1, 1, 1, 0, 0, NULL),
    (1003, 1, 1, 1, 0, 0, N'فقط برون‌سپاری'),
    (1004, 1, 0, 0, 0, 0, NULL),
    (2001, 2, 1, 1, 0, 0, NULL),
    (2002, 2, 1, 1, 0, 0, NULL),
    (2003, 2, 0, 0, 1, 0, N'در همان بچ ساخته و مصرف می‌شود'),
    (2004, 2, 1, 1, 1, 0, NULL),
    (3001, 3, 1, 1, 0, 0, NULL),
    (3002, 3, 1, 1, 0, 0, NULL),
    (3003, 3, 1, 1, 0, 0, NULL),
    (3004, 3, 1, 1, 0, 0, NULL),
    (4001, 4, 1, 1, 0, 0, NULL),
    (4002, 4, 1, 1, 0, 0, NULL),
    (4003, 4, 0, 0, 0, 1, N'اندازه × زبان چاپ'),
    (4004, 4, 1, 1, 0, 1, N'شماره‌ی کپسول × رنگ')
  ) v(ProductId, Role, Tracking, Mandatory, Phantom, Dimensional, Description);

  INSERT mes.ProductionItemSupplyPolicy (CompanyId, ProductionItemId, ProductSourceCode, Priority, ContractorId, SourceSiteTitle, SharePercent, Description)
  SELECT @C, i.Id, v.Source, v.Priority, c.Id, v.SiteTitle, v.Share, v.Description
  FROM (VALUES
    (1001, 1, 1, NULL,    NULL,                   80,   NULL),
    (1001, 3, 2, N'CT-01', NULL,                  20,   N'برای اوج فصل'),
    (1002, 1, 1, NULL,    NULL,                   NULL, NULL),
    (1002, 4, 2, NULL,    N'کارخانه شماره ۲ (رشت)', NULL, N'در صورت کمبود ظرفیت روکش'),
    (1003, 3, 1, N'CT-01', NULL,                  NULL, NULL),
    (1004, 1, 1, NULL,    NULL,                   NULL, NULL),
    (2001, 1, 1, NULL,    NULL,                   NULL, NULL),
    (2001, 3, 2, N'CT-03', NULL,                  NULL, N'پشتیبان'),
    (2002, 1, 1, NULL,    NULL,                   NULL, NULL),
    (2003, 1, 1, NULL,    NULL,                   NULL, NULL),
    (2004, 1, 1, NULL,    NULL,                   NULL, NULL),
    (3001, 2, 1, NULL,    NULL,                   NULL, NULL),
    (3002, 2, 1, NULL,    NULL,                   NULL, NULL),
    (3003, 2, 1, NULL,    NULL,                   NULL, NULL),
    (3004, 2, 1, NULL,    NULL,                   NULL, NULL),
    (4001, 2, 1, NULL,    NULL,                   NULL, NULL),
    (4002, 2, 1, NULL,    NULL,                   NULL, NULL),
    (4003, 2, 1, NULL,    NULL,                   NULL, NULL),
    (4004, 2, 1, NULL,    NULL,                   NULL, NULL)
  ) v(ProductId, Source, Priority, ContractorNo, SiteTitle, Share, Description)
  JOIN mes.ProductionItem i ON i.ProductId = v.ProductId
  LEFT JOIN mes.ProductionContractor c ON c.Number = v.ContractorNo;

  INSERT mes.ProductionAttribute (CompanyId, Number, Name, UnitTitle, AttributeDataTypeCode, SortOrder, Description) VALUES
    (@C, N'ASSAY', N'عیار / خلوص مبنا',     N'٪',      2, 1, N'مبنای محاسبه‌ی مقدار مصرف ماده‌ی مؤثره'),
    (@C, N'DENS',  N'چگالی',                N'g/ml',   1, 2, NULL),
    (@C, N'LOD',   N'رطوبت مبنا (LOD)',      N'٪',      2, 3, NULL),
    (@C, N'HOLD',  N'بازه‌ی نگهداری مجاز',   N'ساعت',   1, 4, N'Hold time بین دو مرحله'),
    (@C, N'TEMP',  N'دمای فرایند',           N'°C',     2, 5, NULL),
    (@C, N'STOR',  N'شرایط نگهداری',         NULL,      3, 6, NULL);

  INSERT mes.ProductionItemAttribute (CompanyId, ProductionItemId, ProductionAttributeId, NominalValue, MinValue, MaxValue, TextValue)
  SELECT @C, i.Id, a.Id, v.Nominal, v.MinV, v.MaxV, v.TextV
  FROM (VALUES
    (3001, N'ASSAY', 100.0, 99.0, 101.0, NULL),
    (3001, N'LOD',   NULL,  NULL, 0.5,   NULL),
    (3001, N'STOR',  NULL,  NULL, NULL,  N'دمای زیر ۲۵ درجه، دور از نور'),
    (3002, N'LOD',   NULL,  4.5,  5.5,   NULL),
    (2001, N'LOD',   2.0,   1.5,  2.5,   NULL),
    (2001, N'HOLD',  72,    NULL, NULL,  NULL),
    (2002, N'HOLD',  168,   NULL, NULL,  NULL),
    (2003, N'DENS',  1.05,  NULL, NULL,  NULL),
    (2003, N'HOLD',  24,    NULL, NULL,  NULL),
    (2003, N'TEMP',  40,    35,   45,    NULL)
  ) v(ProductId, AttrNo, Nominal, MinV, MaxV, TextV)
  JOIN mes.ProductionItem i ON i.ProductId = v.ProductId
  JOIN mes.ProductionAttribute a ON a.Number = v.AttrNo;

  INSERT mes.ProductionDimension (CompanyId, Number, Name, SortOrder) VALUES
    (@C, N'CAPSIZE', N'شماره‌ی کپسول', 1),
    (@C, N'COLOR',   N'رنگ',          2),
    (@C, N'CTNSIZE', N'اندازه‌ی کارتن', 3),
    (@C, N'LANG',    N'زبان چاپ',     4);

  INSERT mes.ProductionDimensionValue (CompanyId, ProductionDimensionId, Code, Name, SortOrder)
  SELECT @C, d.Id, v.Code, v.Name, v.Sort
  FROM (VALUES
    (N'CAPSIZE', N'0',   N'شماره‌ی ۰', 1), (N'CAPSIZE', N'1', N'شماره‌ی ۱', 2), (N'CAPSIZE', N'2', N'شماره‌ی ۲', 3), (N'CAPSIZE', N'3', N'شماره‌ی ۳', 4),
    (N'COLOR',   N'WH',  N'سفید', 1), (N'COLOR', N'RY', N'قرمز / زرد', 2), (N'COLOR', N'BW', N'آبی / سفید', 3), (N'COLOR', N'GR', N'سبز', 4),
    (N'CTNSIZE', N'10',  N'۱۰ بلیستری', 1), (N'CTNSIZE', N'30', N'۳۰ بلیستری', 2),
    (N'LANG',    N'FA',  N'فارسی', 1), (N'LANG', N'EN', N'انگلیسی (صادراتی)', 2)
  ) v(DimNo, Code, Name, Sort)
  JOIN mes.ProductionDimension d ON d.Number = v.DimNo;

  INSERT mes.ProductionItemDimensionValue (CompanyId, ProductionItemId, ProductionDimensionValueId)
  SELECT @C, i.Id, dv.Id
  FROM (VALUES
    (4004, N'CAPSIZE', N'0'), (4004, N'CAPSIZE', N'1'), (4004, N'CAPSIZE', N'2'),
    (4004, N'COLOR', N'WH'), (4004, N'COLOR', N'RY'), (4004, N'COLOR', N'BW'),
    (4003, N'CTNSIZE', N'10'), (4003, N'CTNSIZE', N'30'),
    (4003, N'LANG', N'FA'), (4003, N'LANG', N'EN')
  ) v(ProductId, DimNo, ValueCode)
  JOIN mes.ProductionItem i ON i.ProductId = v.ProductId
  JOIN mes.ProductionDimension d ON d.Number = v.DimNo
  JOIN mes.ProductionDimensionValue dv ON dv.ProductionDimensionId = d.Id AND dv.Code = v.ValueCode;

  INSERT mes.ProductionItemLotSize (CompanyId, ProductionItemId, ProductionLineId, BatchSize, MinOrderQuantity, MaxOrderQuantity, OrderMultiple, Description)
  SELECT @C, i.Id, CASE v.LineKey WHEN 1 THEN @L1 WHEN 2 THEN @L2 END, v.Batch, v.MinQ, v.MaxQ, v.Multiple, v.Description
  FROM (VALUES
    (1001, 1,    300000, 150000, 600000,  50000,  N'ظرفیت مخزن میکسر خط ۱'),
    (1001, 2,    600000, 300000, 1200000, 100000, NULL),
    (1002, NULL, 500000, 250000, 1000000, 250000, N'همه‌ی خطوط'),
    (2001, 1,    120,    60,     240,     30,     NULL),
    (2001, 2,    240,    120,    480,     60,     NULL),
    (2002, 2,    500000, 250000, 1000000, 250000, NULL),
    (2003, NULL, 50,     25,     100,     25,     NULL),
    (2004, NULL, 10,     5,      20,      5,      NULL)
  ) v(ProductId, LineKey, Batch, MinQ, MaxQ, Multiple, Description)
  JOIN mes.ProductionItem i ON i.ProductId = v.ProductId;

  COMMIT;

  EXEC mes.GenerateItemVariants;
END
GO
