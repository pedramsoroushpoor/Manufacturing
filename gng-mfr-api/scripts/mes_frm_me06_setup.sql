/* =====================================================================
   اسکیمای mes — گام ۲۳: FRM-ME-06 «سیاست‌های تغذیه، مصرف و رسید» (کنسول پیکربندی)

   پیش‌نیاز: mes_frm_me04 (مواد عملیات)، انبار پای کار (گام ۱).
   یادداشت ALM: «تجمیع تنظیماتی که در نسخه‌ی جاری بین فرمول، فرایند و تنظیمات خط پخش بود».

   نسخه‌ی قبل این تنظیمات را پخش داشت: IsBackFlushed روی ردیف ساختار، پرچم‌های سراسری generalmfr.Setting
   (IsCheckBackflushInventoryControl، IsBatchAllocationMandatory، IsUnderStockMaterialAvailable، IsProductDeliveredToQCInv)
   و انبارهای خط در generalmfr.ProductionLineInventory. هیچ‌کدام سیاست لایه‌ای نبود؛ جدول جدید است:
     mes.ProductionMaterialPolicy  جدید — یک ردیف به‌ازای هر دامنه: شرکت (پیش‌فرض)، گروه کالا، کالا، عملیات روش و
                                   در نهایت نسخه‌ی تولید (ManufacturingVersionId، از گام ME-08). هر فیلد خالی یعنی «از دامنه‌ی
                                   بالاتر به ارث برسد»؛ دامنه‌ی خاص‌تر برنده است (عملیات > کالا > گروه > شرکت).
   فیلدها: تغذیه (F-ME-040)، مصرف و Backflush (041، 042)، استثنا از Backflush (043)، رسید (044)، انبار و الگوی سند (045)،
   تخصیص موجودی (046)، مبنای انتقال پای کار (047)، حداقل/حداکثر/نقطه‌ی فراخوان (048)، کنترل محدوده‌ی مصرف (049).

   فرض‌ها و کدهای موقت:
     ScopeTypeCode           1 = شرکت، 2 = گروه کالا، 3 = کالا، 4 = عملیات روش، 5 = نسخه‌ی تولید
     FeedingPolicyCode       1 = انتقال به انبار پای کار، 2 = تحویل مستقیم به خط، 3 = کششی (کانبان)، 4 = تأمین پیوسته، 5 = تأمین از پیمانکار
     ConsumptionPolicyCode   1 = ثبت دستی، 2 = Backflush پایان عملیات، 3 = Backflush در رسید محصول، 4 = ترکیبی (قلم به قلم)
     BackflushBasisCode      1 = مقدار تولید تأییدشده، 2 = کل تولید (با ضایعات)
     BackflushMomentCode     1 = پایان عملیات، 2 = رسید محصول، 3 = بستن دستور
     ShortageBehaviorCode    1 = توقف، 2 = اجازه‌ی موجودی منفی، 3 = هشدار و ثبت کسری
     ExclusionReasonCode     1 = قلم گران، 2 = عیاردار، 3 = ردیابی سریالی
     ReceiptPolicyCode       1 = رسید مستقیم انبار، 2 = مجوز ورود، 3 = مشروط به تأیید کیفی، 4 = انبار قرنطینه
     AllocationPolicyCode    1 = FEFO، 2 = FIFO، 3 = بچ مشخص، 4 = بر مبنای عیار
     TransferBasisCode       1 = کل مقدار سفارش (رفتار نسخه‌ی قبل)، 2 = اندازه‌ی بچ عملیات، 3 = اندازه‌ی بسته
     ConsumptionControlCode  1 = بدون کنترل، 2 = هشدار، 3 = منع (بر مبنای حداقل/حداکثر مصرف ردیف ساختار، PE-02)

   فاز اول: F-ME-040 تا 049 همه الزامی‌اند و نمایش داده می‌شوند. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.ProductionMaterialPolicy','U') IS NULL
CREATE TABLE mes.ProductionMaterialPolicy (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionMaterialPolicy PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  ScopeTypeCode INT NOT NULL CONSTRAINT CK_mes_PMP_Scope CHECK (ScopeTypeCode IN (1, 2, 3, 4, 5)),
  ProductGroupTitle NVARCHAR(256) NULL,
  ProductId BIGINT NULL,
  RoutingOperationId BIGINT NULL,
  ManufacturingVersionId BIGINT NULL,
  FeedingPolicyCode INT NULL,
  ConsumptionPolicyCode INT NULL,
  BackflushBasisCode INT NULL,
  BackflushMomentCode INT NULL,
  ShortageBehaviorCode INT NULL,
  BackflushSourceInventoryTitle NVARCHAR(256) NULL,
  IsBackflushExcluded BIT NULL,
  ExclusionReasonCode INT NULL,
  ReceiptPolicyCode INT NULL,
  ConsumptionInventoryTitle NVARCHAR(256) NULL,
  ReceiptInventoryTitle NVARCHAR(256) NULL,
  DocumentPatternTitle NVARCHAR(256) NULL,
  AllocationPolicyCode INT NULL,
  TransferBasisCode INT NULL,
  PackageSize DECIMAL(32,6) NULL,
  LineSideInventoryId BIGINT NULL,
  LineSideCapacity DECIMAL(32,6) NULL,
  MinStock DECIMAL(32,6) NULL,
  MaxStock DECIMAL(32,6) NULL,
  ReorderPoint DECIMAL(32,6) NULL,
  ConsumptionControlCode INT NULL,
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

CREATE OR ALTER PROCEDURE mes.GetMaterialPolicies
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(p.Id AS INT) AS PolicyId, p.Number, p.Name, p.ScopeTypeCode, p.ProductGroupTitle,
         CAST(p.ProductId AS INT) AS ProductId, pr.Number + N' — ' + pr.Name AS ProductTitle,
         CAST(p.RoutingOperationId AS INT) AS RoutingOperationId,
         CASE WHEN o.Id IS NOT NULL THEN r.Number + N' ' + rv.Number + N' / ' + CAST(o.Sequence AS NVARCHAR(16)) + N' ' + op.Name END AS OperationTitle,
         CAST(p.ManufacturingVersionId AS INT) AS ManufacturingVersionId, mv.Number + N' — ' + mv.Name AS VersionTitle,
         p.FeedingPolicyCode, p.ConsumptionPolicyCode, p.BackflushBasisCode, p.BackflushMomentCode, p.ShortageBehaviorCode, p.BackflushSourceInventoryTitle,
         p.IsBackflushExcluded, p.ExclusionReasonCode, p.ReceiptPolicyCode, p.ConsumptionInventoryTitle, p.ReceiptInventoryTitle, p.DocumentPatternTitle,
         p.AllocationPolicyCode, p.TransferBasisCode, p.PackageSize, ls.Number + N' — ' + ls.Name AS LineSideTitle, p.LineSideCapacity,
         p.MinStock, p.MaxStock, p.ReorderPoint, p.ConsumptionControlCode, p.Description
  FROM mes.ProductionMaterialPolicy p
  LEFT JOIN mes.Product pr ON pr.Id = p.ProductId
  LEFT JOIN mes.RoutingOperation o ON o.Id = p.RoutingOperationId
  LEFT JOIN mes.RoutingMaster r ON r.Id = o.RoutingId
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  LEFT JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.LineSideInventory ls ON ls.Id = p.LineSideInventoryId
  LEFT JOIN mes.ManufacturingVersion mv ON mv.Id = p.ManufacturingVersionId   -- جدول گام ME-08؛ تا آن گام خالی است
  WHERE p.CompanyId = @CompanyId AND p.IsDeleted = 0
  ORDER BY p.ScopeTypeCode, p.Number;
END
GO

/* اقلام مصرفی روش‌های تأییدشده (هر قلم × عملیات) با ویژگی‌هایی که سیاست به آن‌ها حساس است */
CREATE OR ALTER PROCEDURE mes.GetPolicyItems
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT DISTINCT CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.ProductGroupTitle, p.MeasureUnitTitle AS UnitTitle,
         pi.TrackingLevelCode, CAST(ISNULL(si.IsActiveIngredient, 0) AS BIT) AS IsActiveIngredient, si.AssayBasisPercent,
         si.MinConsumptionPercent, si.MaxConsumptionPercent,
         CAST(m.RoutingOperationId AS INT) AS RoutingOperationId, r.Number + N' ' + rv.Number + N' / ' + CAST(o.Sequence AS NVARCHAR(16)) + N' ' + op.Name AS OperationTitle,
         m.IsBackflushed
  FROM mes.RoutingOperationMaterial m
  JOIN mes.RoutingOperation o ON o.Id = m.RoutingOperationId
  JOIN mes.RoutingMaster r ON r.Id = o.RoutingId AND r.RoutingMasterStatusCode = 3
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN mes.Product p ON p.Id = m.ProductId
  LEFT JOIN mes.ProductionItem pi ON pi.ProductId = p.Id AND pi.IsDeleted = 0
  LEFT JOIN mes.ProductStructureItem si ON si.Id = m.ProductStructureItemId
  WHERE m.CompanyId = @CompanyId AND m.IsDeleted = 0
  ORDER BY p.Number;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.ProductionMaterialPolicy خالی است.
   عمداً خراب: «مواد مؤثره» (پاراستامول، عیاردار) از سیاست گروه Backflush می‌گیرد و استثنا نشده؛ حداقل موجودی پای کار
   مواد بسته‌بندی (۳۰۰) از حداکثر (۲۰۰) بیشتر است؛ اتانول اجازه‌ی موجودی منفی دارد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductionMaterialPolicy)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  INSERT mes.ProductionMaterialPolicy (CompanyId, Number, Name, ScopeTypeCode, ProductGroupTitle, ProductId,
    FeedingPolicyCode, ConsumptionPolicyCode, BackflushBasisCode, BackflushMomentCode, ShortageBehaviorCode, BackflushSourceInventoryTitle,
    IsBackflushExcluded, ExclusionReasonCode, ReceiptPolicyCode, ConsumptionInventoryTitle, ReceiptInventoryTitle, DocumentPatternTitle,
    AllocationPolicyCode, TransferBasisCode, PackageSize, LineSideInventoryId, LineSideCapacity, MinStock, MaxStock, ReorderPoint, ConsumptionControlCode, Description)
  SELECT @C, v.Number, v.Name, v.Scope, v.Grp, v.ProductId,
    v.Feed, v.Cons, v.BfBasis, v.BfMoment, v.Short, v.BfSource, v.Excl, v.ExclReason, v.Receipt, v.ConsInv, v.RecInv, v.DocPat,
    v.Alloc, v.Transfer, v.Pack, ls.Id, v.LsCap, v.MinS, v.MaxS, v.Reorder, v.Ctrl, v.Description
  FROM (VALUES
    (N'POL-000', N'پیش‌فرض شرکت', 1, NULL, NULL,
      1, 2, 1, 1, 1, N'انبار پای کار همان خط', 0, NULL, 3, N'انبار پای کار همان خط', N'انبار محصول — قرنطینه', N'حواله‌ی مصرف تولید / رسید مشروط',
      1, 2, NULL, NULL, NULL, NULL, NULL, NULL, 2, N'رسید مشروط به QC، FEFO، انتقال به اندازه‌ی بچ عملیات'),
    (N'POL-G01', N'مواد مؤثره', 2, N'مواد مؤثره', NULL,
      2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'انبار مواد اولیه — اتاق توزین', NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3, N'تحویل مستقیم از اتاق توزین؛ مصرف خارج از محدوده منع'),
    (N'POL-G02', N'مواد جانبی', 2, N'مواد جانبی', NULL,
      1, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      1, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (N'POL-G03', N'مواد بسته‌بندی', 2, N'مواد بسته‌بندی', NULL,
      3, 3, 2, 2, 3, N'انبار پای کار بسته‌بندی', NULL, NULL, NULL, NULL, NULL, NULL,
      2, 3, 500.0, N'WH-L2-03', 1500.0, 300.0, 200.0, 250.0, 1, N'کانبان؛ Backflush در رسید محصول بر مبنای کل تولید'),
    (N'POL-G04', N'نیمه‌ساخته', 2, N'نیمه‌ساخته', NULL,
      2, 1, NULL, NULL, NULL, NULL, NULL, NULL, 2, N'انبار میانی نیمه‌ساخته', N'انبار میانی نیمه‌ساخته', N'حواله‌ی انتقال بین مرحله‌ای',
      3, 2, NULL, NULL, NULL, NULL, NULL, NULL, 2, N'بچ مشخص؛ رسید با مجوز ورود'),
    (N'POL-I01', N'اتانول ۹۶٪', 3, NULL, 3009,
      4, 2, NULL, NULL, 2, N'مخزن اتانول خط', NULL, NULL, NULL, N'مخزن اتانول خط', NULL, NULL,
      2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'تأمین پیوسته از مخزن؛ اجازه‌ی موجودی منفی'),
    (N'POL-I02', N'کراس‌کارملوز سدیم', 3, NULL, 3008,
      NULL, 1, NULL, NULL, NULL, NULL, 1, 1, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'قلم گران — ثبت دستی')
  ) v(Number, Name, Scope, Grp, ProductId, Feed, Cons, BfBasis, BfMoment, Short, BfSource, Excl, ExclReason, Receipt, ConsInv, RecInv, DocPat,
      Alloc, Transfer, Pack, Ls, LsCap, MinS, MaxS, Reorder, Ctrl, Description)
  LEFT JOIN mes.LineSideInventory ls ON ls.Number = v.Ls AND ls.CompanyId = @C;

  /* سیاست سطح عملیات: بسته‌بندی RT-1001 v2 رسید را به قرنطینه می‌برد */
  INSERT mes.ProductionMaterialPolicy (CompanyId, Number, Name, ScopeTypeCode, RoutingOperationId, ReceiptPolicyCode, ReceiptInventoryTitle, DocumentPatternTitle, Description)
  SELECT @C, N'POL-O01', N'رسید بسته‌بندی قرص ۵۰۰', 4, o.Id, 4, N'انبار قرنطینه‌ی محصول', N'رسید قرنطینه', N'تا آزادسازی QA در قرنطینه'
  FROM mes.RoutingMaster r
  JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId AND rv.Number = N'v2'
  JOIN mes.RoutingOperation o ON o.RoutingId = r.Id AND o.Sequence = 60
  WHERE r.Number = N'RT-1001' AND r.CompanyId = @C;

  COMMIT;
END
GO
