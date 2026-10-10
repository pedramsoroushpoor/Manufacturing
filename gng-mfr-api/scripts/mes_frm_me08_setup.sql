/* =====================================================================
   اسکیمای mes — گام ۲۵: FRM-ME-08 «نسخه‌ی تولید»

   پیش‌نیاز: mes_frm_me07، ساختار محصول (گام ۱۰)، روش ساخت (گام ۱۹)، سازمان و خطوط (گام ۱).
   یادداشت ALM: «تصمیم معماری کلیدی: پل ساختار محصول و روش ساخت».

   نسخه‌ی قبل جدولی به نام mfr.ProductionVersion دارد ولی آن «نسخه‌ی برنامه‌ریزی» است (دوره‌های MPS/MRP/CRP، بودجه)،
   نه ترکیب ساختار + روش. برای اینکه بررسی دیتابیس دو مفهوم متفاوت را هم‌نام نشان ندهد، نام جدید گرفته شد:
     mes.ManufacturingVersion   جدید — ترکیب محصول + ساختار + روش + دامنه‌ی مکانی (گره سازمانی یا خط) + محدوده‌ی اندازه‌ی بچ
                                (F-ME-059)، انواع مجاز دستور کار (060)، اعتبار تاریخی/بچ‌محور/سفارش‌محور و اولویت (061)،
                                وضعیت (065)، هزینه و زمان مبنا (066)، مبنای دستور: مقدار یا شیفت (067).
   انتخاب خودکار (F-ME-062) با رویه‌ی mes.SelectManufacturingVersion؛ برای هر نسخه دلیل رد یا رتبه برمی‌گرداند (063).
   انتخاب دستی با ثبت دلیل (064) اقدام نوشتنی روی دستور کار است و با فرم دستور کار می‌آید.
   در دسترس بودن منبع و مواد در انتخاب خودکار هنوز بررسی نمی‌شود (به برنامه‌ریزی و موجودی وابسته است).

   فرض‌ها و کدهای موقت:
     StatusCode           1 = پیش‌نویس، 2 = در تأیید، 3 = فعال، 4 = معلق، 5 = منسوخ
     EffectivityTypeCode  1 = تاریخی، 2 = بچ‌محور، 3 = سفارش‌محور (همان کدهای نسخه‌ی ساختار، گام ۱۰)
     OrderBasisCode       1 = مقدار، 2 = شیفت (پروفایل پیوسته)
     ProductionTypeCode   1 = بچی، 2 = پیوسته
   قاعده‌ی انتخاب: فعال، در اعتبار تاریخ، خط در دامنه‌ی مکانی، مقدار در محدوده‌ی بچ، روش و ساختار تأییدشده؛ از بین
   واجدین، کمترین Priority و سپس باریک‌ترین بازه‌ی بچ.

   فاز اول: F-ME-059 تا 063، 065، 066، 067. انتخاب دستی (064) نیامده. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.ManufacturingVersion','U') IS NULL
CREATE TABLE mes.ManufacturingVersion (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ManufacturingVersion PRIMARY KEY,
  Number NVARCHAR(64) NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  ProductId BIGINT NOT NULL,
  ProductStructureId BIGINT NOT NULL,
  RoutingId BIGINT NOT NULL,
  OrgNodeId BIGINT NULL,
  ProductionLineId BIGINT NULL,
  MinBatchSize DECIMAL(32,6) NULL,
  MaxBatchSize DECIMAL(32,6) NULL,
  EffectivityTypeCode INT NOT NULL CONSTRAINT DF_mes_MV_Effectivity DEFAULT (1),
  ValidFromDate DATE NULL,
  ValidToDate DATE NULL,
  FromBatchNumber NVARCHAR(64) NULL,
  ToBatchNumber NVARCHAR(64) NULL,
  WorkOrderNumber NVARCHAR(64) NULL,
  Priority INT NOT NULL CONSTRAINT DF_mes_MV_Priority DEFAULT (1),
  StatusCode INT NOT NULL CONSTRAINT DF_mes_MV_Status DEFAULT (1)
    CONSTRAINT CK_mes_MV_Status CHECK (StatusCode IN (1, 2, 3, 4, 5)),
  ProductionTypeCode INT NOT NULL CONSTRAINT DF_mes_MV_ProductionType DEFAULT (1),
  OrderBasisCode INT NOT NULL CONSTRAINT DF_mes_MV_OrderBasis DEFAULT (1),
  AllowsStandardOrder BIT NOT NULL CONSTRAINT DF_mes_MV_Std DEFAULT (1),
  AllowsReworkOrder BIT NOT NULL CONSTRAINT DF_mes_MV_Rework DEFAULT (0),
  AllowsSampleOrder BIT NOT NULL CONSTRAINT DF_mes_MV_Sample DEFAULT (0),
  AllowsTollOrder BIT NOT NULL CONSTRAINT DF_mes_MV_Toll DEFAULT (0),
  BaseCost DECIMAL(32,2) NULL,
  BaseLeadTimeHours DECIMAL(18,2) NULL,
  ApproverTitle NVARCHAR(256) NULL,
  Description NVARCHAR(400) NULL
);

IF COL_LENGTH('mes.ProductionMaterialPolicy', 'ManufacturingVersionId') IS NULL
  ALTER TABLE mes.ProductionMaterialPolicy ADD ManufacturingVersionId BIGINT NULL;
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

/* نسخه‌های تولید با کنترل سازگاری اجزا (روش به ساختار اختصاص دارد، محصول یکی است، وضعیت و اعتبار اجزا) */
CREATE OR ALTER PROCEDURE mes.GetManufacturingVersions
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(v.Id AS INT) AS VersionId, v.Number AS Code, v.Name AS Title, CAST(v.ProductId AS INT) AS ProductId, p.Number + N' — ' + p.Name AS ProductTitle,
         p.MeasureUnitTitle AS UnitTitle, CAST(s.Id AS INT) AS StructureId, s.Number + N' — ' + s.Name AS StructureTitle, s.ProductStructureStatusCode AS StructureStatusCode,
         CAST(r.Id AS INT) AS RoutingId, r.Number + N' ' + rv.Number + N' — ' + r.Name AS RoutingTitle, r.RoutingMasterStatusCode AS RoutingStatusCode,
         r.ValidToDate AS RoutingValidTo, r.MinBatchSize AS RoutingMinBatch, r.MaxBatchSize AS RoutingMaxBatch, r.ProductionTypeCode AS RoutingProductionTypeCode,
         CAST(v.OrgNodeId AS INT) AS OrgNodeId, n.Name AS OrgNodeTitle, CAST(v.ProductionLineId AS INT) AS LineId, l.Name AS LineTitle,
         v.MinBatchSize, v.MaxBatchSize, v.EffectivityTypeCode, v.ValidFromDate, v.ValidToDate, v.FromBatchNumber, v.ToBatchNumber, v.WorkOrderNumber,
         v.Priority, v.StatusCode, v.ProductionTypeCode, v.OrderBasisCode, v.AllowsStandardOrder, v.AllowsReworkOrder, v.AllowsSampleOrder, v.AllowsTollOrder,
         v.BaseCost, v.BaseLeadTimeHours, v.ApproverTitle, v.Description,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.RoutingProductStructureAssignment a WHERE a.RoutingId = r.Id AND a.ProductStructureId = s.Id AND a.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT) AS RoutingAssigned,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductStructureMaster m WHERE m.ProductStructureId = s.Id AND m.ProductId = v.ProductId AND m.IsMainProduct = 1 AND m.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT) AS ProductMatches,
         (SELECT STRING_AGG(x.Name, N'، ') FROM mes.fnLinesInScope(v.OrgNodeId, v.ProductionLineId) f JOIN mes.ProductionLine x ON x.Id = f.LineId) AS LinesInScope
  FROM mes.ManufacturingVersion v
  JOIN mes.Product p ON p.Id = v.ProductId
  JOIN mes.ProductStructure s ON s.Id = v.ProductStructureId
  JOIN mes.RoutingMaster r ON r.Id = v.RoutingId
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  LEFT JOIN mes.OrgNode n ON n.Id = v.OrgNodeId
  LEFT JOIN mes.ProductionLine l ON l.Id = v.ProductionLineId
  WHERE v.CompanyId = @CompanyId AND v.IsDeleted = 0
  ORDER BY p.Number, v.Priority, v.Number;
END
GO

/* انتخاب خودکار نسخه‌ی تولید (F-ME-062) با دلیل رد هر نسخه (F-ME-063).
   @OrderTypeCode: 1 = عادی، 2 = دوباره‌کاری، 3 = نمونه، 4 = کارمزدی */
CREATE OR ALTER PROCEDURE mes.SelectManufacturingVersion
  @CompanyId BIGINT,
  @ProductId BIGINT,
  @LineId BIGINT,
  @Quantity DECIMAL(32,6),
  @OrderDate DATE,
  @OrderTypeCode INT = 1
AS
BEGIN
  SET NOCOUNT ON;
  WITH c AS (
    SELECT v.Id, v.Number, v.Name, v.Priority, v.MinBatchSize, v.MaxBatchSize,
      CASE
        WHEN v.StatusCode <> 3 THEN N'وضعیت نسخه فعال نیست'
        WHEN v.EffectivityTypeCode = 1 AND (v.ValidFromDate > @OrderDate OR (v.ValidToDate IS NOT NULL AND v.ValidToDate < @OrderDate)) THEN N'خارج از بازه‌ی اعتبار تاریخ'
        WHEN NOT EXISTS (SELECT 1 FROM mes.fnLinesInScope(v.OrgNodeId, v.ProductionLineId) f WHERE f.LineId = @LineId) THEN N'خط سفارش در دامنه‌ی مکانی نسخه نیست'
        WHEN (v.MinBatchSize IS NOT NULL AND @Quantity < v.MinBatchSize) OR (v.MaxBatchSize IS NOT NULL AND @Quantity > v.MaxBatchSize) THEN N'مقدار سفارش بیرون از محدوده‌ی بچ نسخه'
        WHEN (@OrderTypeCode = 1 AND v.AllowsStandardOrder = 0) OR (@OrderTypeCode = 2 AND v.AllowsReworkOrder = 0)
          OR (@OrderTypeCode = 3 AND v.AllowsSampleOrder = 0) OR (@OrderTypeCode = 4 AND v.AllowsTollOrder = 0) THEN N'این نوع دستور کار روی نسخه مجاز نیست'
        WHEN r.RoutingMasterStatusCode <> 3 OR (r.ValidToDate IS NOT NULL AND r.ValidToDate < @OrderDate) THEN N'روش ساخت تأییدشده‌ی معتبر نیست'
        WHEN s.ProductStructureStatusCode <> 3 THEN N'ساختار محصول تأییدشده نیست'
        WHEN NOT EXISTS (SELECT 1 FROM mes.RoutingProductStructureAssignment a WHERE a.RoutingId = r.Id AND a.ProductStructureId = s.Id AND a.IsDeleted = 0) THEN N'روش به این ساختار اختصاص ندارد'
      END AS RejectReason
    FROM mes.ManufacturingVersion v
    JOIN mes.RoutingMaster r ON r.Id = v.RoutingId
    JOIN mes.ProductStructure s ON s.Id = v.ProductStructureId
    WHERE v.CompanyId = @CompanyId AND v.IsDeleted = 0 AND v.ProductId = @ProductId
  ), ranked AS (
    SELECT c.*, CASE WHEN c.RejectReason IS NULL
                  THEN ROW_NUMBER() OVER (PARTITION BY CASE WHEN c.RejectReason IS NULL THEN 0 ELSE 1 END
                                          ORDER BY c.Priority, ISNULL(c.MaxBatchSize, 1e18) - ISNULL(c.MinBatchSize, 0)) END AS Rank,
           SUM(CASE WHEN c.RejectReason IS NULL THEN 1 ELSE 0 END) OVER () AS EligibleCount
    FROM c
  )
  SELECT CAST(Id AS INT) AS VersionId, Number AS Code, Name AS Title, Priority, MinBatchSize, MaxBatchSize, RejectReason, Rank,
         CAST(CASE WHEN Rank = 1 THEN 1 ELSE 0 END AS BIT) AS IsSelected, EligibleCount
  FROM ranked
  ORDER BY CASE WHEN Rank IS NULL THEN 1 ELSE 0 END, Rank, Priority, Number;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.ManufacturingVersion خالی است.
   عمداً خراب: MV-1001-03 روی روش منسوخ RT-1001 v1 فعال مانده؛ بازه‌ی بچ MV-1001-01 و MV-1001-02 با اولویت یکسان
   هم‌پوشانی دارد (۵۵۰ تا ۶۰۰ هزار)؛ MV-2003-X روش RT-2001 را با ساختار محلول روکش ترکیب کرده (روش به این ساختار
   اختصاص ندارد).
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ManufacturingVersion)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @hall BIGINT = (SELECT TOP (1) Id FROM mes.OrgNode WHERE Name LIKE N'%جامدات%' AND CompanyId = @C ORDER BY Id);

  INSERT mes.ManufacturingVersion (CompanyId, Number, Name, ProductId, ProductStructureId, RoutingId, OrgNodeId, ProductionLineId, MinBatchSize, MaxBatchSize,
                                   EffectivityTypeCode, ValidFromDate, ValidToDate, WorkOrderNumber, Priority, StatusCode, ProductionTypeCode, OrderBasisCode,
                                   AllowsStandardOrder, AllowsReworkOrder, AllowsSampleOrder, AllowsTollOrder, BaseCost, BaseLeadTimeHours, ApproverTitle, Description)
  SELECT @C, v.Number, v.Name, v.ProductId, s.Id, r.Id, CASE WHEN v.Line IS NULL THEN @hall END, v.Line, v.MinB, v.MaxB,
         v.Eff, v.FromD, v.ToD, v.WoNo, v.Pri, v.Status, 1, 1, v.Std, v.Rew, v.Smp, v.Toll, v.Cost, v.Lead, v.Approver, v.Description
  FROM (VALUES
    (N'MV-1001-01', N'قرص ۵۰۰ — بچ استاندارد خط ۲',   1001, N'BOM-1001-A', N'RT-1001', N'v2', 2,    250000.0,  600000.0, 1, CAST('2026-03-21' AS DATE), NULL, NULL, 1, 3, 1, 1, 0, 0, 1850000000.0, 26.0, N'مدیر فنی', NULL),
    (N'MV-1001-02', N'قرص ۵۰۰ — بچ بزرگ خط ۲',        1001, N'BOM-1001-B', N'RT-1001', N'v2', 2,    550000.0, 1200000.0, 1, '2026-03-21', NULL, NULL, 1, 3, 1, 0, 0, 0, 3420000000.0, 41.0, N'مدیر فنی', N'هم‌پوشانی بازه با MV-1001-01'),
    (N'MV-1001-03', N'قرص ۵۰۰ — خط ۱ (روش قدیم)',     1001, N'BOM-1001-A', N'RT-1001', N'v1', 1,    200000.0,  400000.0, 1, '2025-06-22', NULL, NULL, 2, 3, 1, 1, 0, 0, 1900000000.0, 30.0, N'مدیر فنی', N'روش این نسخه منسوخ شده'),
    (N'MV-1001-S', N'قرص ۵۰۰ — نمونه‌ی پایداری',       1001, N'BOM-1001-A', N'RT-1001', N'v2', 2,      1000.0,   20000.0, 3, NULL, NULL, N'WO-1405-STB', 1, 3, 0, 0, 1, 0, NULL, NULL, N'مدیر فنی', N'سفارش‌محور'),
    (N'MV-1001-T', N'قرص ۵۰۰ — کارمزدی فارمد',         1001, N'BOM-1001-A', N'RT-TOLL-01', N'v1', 1, 200000.0, 300000.0, 1, '2026-01-01', '2026-12-31', NULL, 3, 3, 0, 0, 0, 1, 1200000000.0, 28.0, N'مدیر فنی', N'فقط دستور کارمزدی'),
    (N'MV-1002-01', N'قرص روکش‌دار ۲۵۰',              1002, N'BOM-1002',   N'RT-1002', N'v1', 2,    400000.0,  600000.0, 1, '2025-03-21', NULL, NULL, 1, 3, 1, 1, 0, 0, 2600000000.0, 150.0, N'مدیر فنی', N'زمان مبنا شامل ۵ روز نزد پیمانکار'),
    (N'MV-2001-01', N'گرانول قرص سفید',               2001, N'BOM-2001',   N'RT-2001', N'v1', NULL,     100.0,     150.0, 1, '2025-06-22', NULL, NULL, 1, 3, 1, 1, 0, 0, 980000000.0, 6.0, N'مدیر فنی', N'کل سالن جامدات'),
    (N'MV-2003-01', N'محلول روکش',                    2003, N'BOM-2003',   N'RT-2003', N'v1', 2,        40.0,      60.0, 1, '2025-03-21', NULL, NULL, 1, 3, 1, 0, 0, 0, 45000000.0, 3.0, N'مدیر فنی', NULL),
    (N'MV-2003-X', N'محلول روکش — آزمایش روش گرانول',  2003, N'BOM-2003',   N'RT-2001', N'v1', 2,        40.0,      60.0, 1, '2026-10-01', NULL, NULL, 2, 2, 1, 0, 0, 0, NULL, NULL, NULL, N'در تأیید'),
    (N'MV-1005-01', N'قرص ۱۰۰۰ — آزمایشی',            1005, N'RND-1005',   N'RT-1005', N'v1', 1,      1000.0,    5000.0, 1, '2026-09-01', NULL, NULL, 1, 1, 0, 0, 1, 0, NULL, NULL, NULL, N'پیش‌نویس R&D')
  ) v(Number, Name, ProductId, Bom, Rt, Ver, Line, MinB, MaxB, Eff, FromD, ToD, WoNo, Pri, Status, Std, Rew, Smp, Toll, Cost, Lead, Approver, Description)
  JOIN mes.ProductStructure s ON s.Number = v.Bom AND s.CompanyId = @C
  JOIN mes.ProductionRevision rv ON rv.Number = v.Ver
  JOIN mes.RoutingMaster r ON r.Number = v.Rt AND r.VersionId = rv.Id AND r.CompanyId = @C;

  /* لایه‌ی «نسخه‌ی تولید» سیاست مواد (FRM-ME-06): نسخه‌ی کارمزدی مواد را از انبار امانی مشتری مصرف می‌کند */
  INSERT mes.ProductionMaterialPolicy (CompanyId, Number, Name, ScopeTypeCode, ManufacturingVersionId, ConsumptionInventoryTitle, ReceiptInventoryTitle, DocumentPatternTitle, Description)
  SELECT @C, N'POL-V01', N'نسخه‌ی کارمزدی فارمد', 5, v.Id, N'انبار امانی مشتری — فارمد', N'انبار محصول امانی مشتری', N'حواله‌ی مصرف امانی / رسید امانی', N'انبار و سند در سطح نسخه‌ی تولید'
  FROM mes.ManufacturingVersion v WHERE v.Number = N'MV-1001-T' AND v.CompanyId = @C;

  COMMIT;
END
GO
