/* =====================================================================
   اسکیمای mes — گام ۳۱: FRM-PC-03 «آزادسازی، شارژ و تغذیه‌ی پای کار»

   پیش‌نیاز: mes_frm_pc02 (دستور کار)، سیاست مواد (ME-06)، ابزار و تجهیز (RM-02)، مهارت (RM-03).
   یادداشت ALM: «بازطراحی انتقال پای کار بر مبنای اندازه‌ی بچ».

   جدول‌های قدیم با همان نام و همه‌ی فیلدها:
     mes.WorkOrderOperationMaterialKit       همان mfr (KitQuantity، ActiveKitQuantity، EffectiveDate، …) + BatchNumber، MaterialStockId،
                                             PotencyPercent، TransferNo، KitStatusCode، ScanCode — هر ردیف یک انتقال به اندازه‌ی بچ
                                             عملیات یا بسته (F-PC-022)، با بچ تخصیصی FEFO/عیار (024) و مقدار تصحیح‌شده با عیار (025)
     mes.WorkOrderOperationMaterialExcess    همان + ExcessReasonTitle، StatusCode، RequestDate، ToleranceText (درخواست مازاد، 026)
     mes.WorkOrderOperationMaterialReturned  همان + BatchNumber، DocumentNumber (برگشت مازاد با سند، 027)
   تابع mes.fnShopNow() «اکنونِ کارگاه» است: برای داده‌ی نمونه ۱۷ مهر ۱۴۰۵ ساعت ۱۱:۳۰؛ در بهره‌برداری = SYSDATETIME().
   پیش‌شرط‌های آزادسازی (020) با mes.GetReleaseChecks زنده حساب می‌شوند (مواد، ظرفیت، ابزار، مهارت، کیفی، تجهیز).
   موجودی لحظه‌ای پای کار (028) = کیت تحویلی − مصرف − برگشت به تفکیک دستور و قلم. فراخوان کششی (023) از آستانه‌ی سیاست ME-06.

   فرض‌ها و کدهای موقت:
     KitStatusCode   1 = برنامه‌ی انتقال، 2 = تحویل پای کار، 3 = مصرف‌شده
     Excess StatusCode 1 = منتظر تأیید، 2 = تأییدشده، 3 = ردشده
     وضعیت پیش‌شرط  1 = برقرار، 2 = هشدار، 3 = مانع

   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.WorkOrderOperationMaterialKit','U') IS NULL
CREATE TABLE mes.WorkOrderOperationMaterialKit (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationMaterialKit PRIMARY KEY,
  WOOperationMaterialId BIGINT NOT NULL,
  ReferenceEntityName NVARCHAR(128) NULL,
  ReferenceObjectId BIGINT NULL,
  ProductSerialId BIGINT NULL,
  KitQuantity DECIMAL(32,6) NOT NULL,
  MeasureUnitId BIGINT NULL,
  ActiveKitQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOMK_Active DEFAULT (0),
  ActiveMeasureUnitId BIGINT NULL,
  PLCResult DECIMAL(32,6) NULL,
  StartTime DATETIME2 NULL,
  EndTime DATETIME2 NULL,
  Duration INT NULL,
  Description NVARCHAR(400) NULL,
  InventoryDocumentHeaderId BIGINT NULL,
  EffectiveDate DATETIME2 NULL,
  BatchNumber NVARCHAR(64) NULL,
  MaterialStockId BIGINT NULL,
  PotencyPercent DECIMAL(9,4) NULL,
  TransferNo INT NULL,
  KitStatusCode INT NOT NULL CONSTRAINT DF_mes_WOOMK_Status DEFAULT (1),
  ScanCode NVARCHAR(128) NULL
);

IF OBJECT_ID('mes.WorkOrderOperationMaterialExcess','U') IS NULL
CREATE TABLE mes.WorkOrderOperationMaterialExcess (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationMaterialExcess PRIMARY KEY,
  WOOperationMaterialId BIGINT NOT NULL,
  ExcessQuantity DECIMAL(32,6) NOT NULL,
  MeasureUnitId BIGINT NULL,
  Description NVARCHAR(400) NULL,
  ExcessReasonTitle NVARCHAR(256) NULL,
  StatusCode INT NOT NULL CONSTRAINT DF_mes_WOOME_Status DEFAULT (1),
  RequestDate DATETIME2 NULL,
  ApproverTitle NVARCHAR(256) NULL
);

IF OBJECT_ID('mes.WorkOrderOperationMaterialReturned','U') IS NULL
CREATE TABLE mes.WorkOrderOperationMaterialReturned (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationMaterialReturned PRIMARY KEY,
  WOOperationMaterialId BIGINT NOT NULL,
  ReturnedQuantity DECIMAL(32,6) NOT NULL,
  MeasureUnitId BIGINT NULL,
  ReturnReason NVARCHAR(400) NULL,
  IsReplacedKitRequested BIT NULL,
  ReplacedKitQuantity DECIMAL(32,6) NULL,
  StartTime DATETIME2 NULL,
  EndTime DATETIME2 NULL,
  Duration INT NULL,
  Description NVARCHAR(400) NULL,
  IsReturnedTolerance BIT NULL,
  ReferenceEntityName NVARCHAR(128) NULL,
  ReferenceObjectId BIGINT NULL,
  ReferenceObjectNumber NVARCHAR(64) NULL,
  ReferenceDescription NVARCHAR(400) NULL,
  BatchNumber NVARCHAR(64) NULL,
  DocumentNumber NVARCHAR(64) NULL
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

/* «اکنونِ کارگاه» — همه‌ی فرم‌های کنترل تولید از این تابع می‌خوانند تا داده‌ی نمونه پایدار بماند. */
CREATE OR ALTER FUNCTION mes.fnShopNow()
RETURNS DATETIME2
AS
BEGIN
  RETURN CAST('2026-10-09T11:30:00' AS DATETIME2);
END
GO

/* پیش‌شرط‌های آزادسازی دستورهای برنامه‌ریزی‌شده و آزادشده (F-PC-020) */
CREATE OR ALTER PROCEDURE mes.GetReleaseChecks
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();
  DECLARE @w TABLE (Id BIGINT, PlanStart DATETIME2);
  INSERT @w SELECT Id, PlannedReleaseDate FROM mes.WorkOrder WHERE CompanyId = @CompanyId AND IsDeleted = 0 AND WorkOrderStatusCode IN (1, 2, 3);

  /* مواد: نیاز باقی‌مانده در برابر کیت تحویلی + موجودی آزاد + در راهِ پیش از شروع */
  SELECT CAST(w.Id AS INT) AS WorkOrderId, N'MAT' AS CheckCode, N'مواد' AS CheckTitle,
         CASE WHEN SUM(CASE WHEN x.Gap > 0 AND x.CoverByTransit = 0 THEN 1 ELSE 0 END) > 0 THEN 3
              WHEN SUM(CASE WHEN x.Gap > 0 THEN 1 ELSE 0 END) > 0 THEN 2 ELSE 1 END AS StatusCode,
         ISNULL(STRING_AGG(CASE WHEN x.Gap > 0 THEN x.Title + N': کسری ' + FORMAT(x.Gap, 'N2') + CASE WHEN x.CoverByTransit = 1 THEN N' (در راه پیش از شروع)' ELSE N'' END END, N'؛ '), N'همه‌ی مواد تأمین است') AS Detail
  FROM @w w
  JOIN mes.WorkOrder wo ON wo.Id = w.Id
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.IsDeleted = 0
  JOIN mes.WorkOrderOperationMaterial m ON m.WOOperationId = o.Id AND m.IsDeleted = 0
  JOIN mes.Product p ON p.Id = m.ProductId
  /* موجودی رزروشده برای دستورهای آزادشده/در جریان مال خودشان است؛ فقط برای دستور برنامه‌ای کم می‌شود */
  CROSS APPLY (SELECT p.Number + N' ' + p.Name AS Title,
                      ISNULL(m.PlannedKitQuantity, 0) - ISNULL(m.ActualKitQuantity, 0)
                        - ISNULL((SELECT SUM(s.OnHandQuantity) - CASE WHEN wo.WorkOrderStatusCode = 1 THEN SUM(s.ReservedQuantity) ELSE 0 END FROM mes.MaterialStock s WHERE s.ProductId = m.ProductId AND s.IsDeleted = 0
                                    AND s.InventoryKindCode IN (1, 2, 4) AND s.QcStatusCode = 1 AND s.IsCustomerOwned = ISNULL(m.IsCustomerMaterial, 0)), 0) AS Gap,
                      CASE WHEN EXISTS (SELECT 1 FROM mes.MaterialStock s WHERE s.ProductId = m.ProductId AND s.InventoryKindCode = 6 AND s.IsDeleted = 0
                                          AND s.ExpectedArrivalDate <= CAST(w.PlanStart AS DATE)) THEN 1 ELSE 0 END AS CoverByTransit) x
  WHERE m.WorkOrderOperationMaterialStatusCode < 5
  GROUP BY w.Id
  UNION ALL
  /* ابزار: عمر باقی‌مانده‌ی بهترین ابزار گروه در برابر مقدار عملیات */
  SELECT CAST(w.Id AS INT), N'TOOL', N'ابزار',
         CASE WHEN MIN(x.BestLeft) IS NULL THEN 1 WHEN MIN(x.BestLeft - x.Need) < 0 THEN 2 ELSE 1 END,
         ISNULL(STRING_AGG(x.GroupTitle + N': بیشترین عمر باقی ' + FORMAT(x.BestLeft, 'N0') + N' برای ' + FORMAT(x.Need, 'N0'), N'؛ '), N'ابزار لازم ندارد')
  FROM @w w
  LEFT JOIN (SELECT o.WorkOrderId, g.Name AS GroupTitle, o.ToCompleteQuantity - o.CompletedQuantity AS Need,
                    /* ابزار سوار بر تجهیزات گروه منبع عملیات؛ عملیات ایستگاهی: هر ابزار سوار بر تجهیز */
                    (SELECT MAX(tp.LifeLimit - tp.LifeUsed) FROM mes.ToolsProduction tp WHERE tp.ToolsGroupId = g.Id AND tp.IsActive = 1 AND tp.IsDeleted = 0
                       AND tp.EquipmentId IS NOT NULL
                       AND (o.ResourceGroupId IS NULL OR tp.EquipmentId IN (SELECT gm.EquipmentId FROM mes.ResourceGroupMember gm WHERE gm.ResourceGroupId = o.ResourceGroupId AND gm.IsDeleted = 0))) AS BestLeft
             FROM mes.WorkOrderOperation o
             JOIN mes.ProductionOperationTools t ON t.ProductionOperationId = o.OperationId AND t.IsDeleted = 0 AND t.IsMandatory = 1
             JOIN mes.ToolsProductionGroup g ON g.Id = t.ToolsGroupId
             WHERE o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode < 5) x ON x.WorkOrderId = w.Id
  GROUP BY w.Id
  UNION ALL
  /* مهارت: برای هر الزام «منع»، دست‌کم یک نفر با سطح کافی و مهارت معتبر */
  SELECT CAST(w.Id AS INT), N'SKILL', N'مهارت',
         CASE WHEN SUM(CASE WHEN x.Qualified = 0 THEN 1 ELSE 0 END) > 0 THEN 3 ELSE 1 END,
         ISNULL(STRING_AGG(CASE WHEN x.Qualified = 0 THEN x.SkillTitle + N' بدون نفر واجد شرایط' END, N'؛ '),
                N'برای همه‌ی الزام‌ها نفر واجد شرایط هست')
  FROM @w w
  LEFT JOIN (SELECT o.WorkOrderId, k.Name AS SkillTitle,
                    (SELECT COUNT(*) FROM mes.PersonnelSkill ps WHERE ps.SkillId = r.SkillId AND ps.SkillLevelCode >= r.MinSkillLevelCode AND ps.IsDeleted = 0
                       AND (ps.ValidToDate IS NULL OR ps.ValidToDate >= CAST(@now AS DATE))) AS Qualified
             FROM mes.WorkOrderOperation o
             JOIN mes.OperationSkillRequirement r ON r.OperationId = o.OperationId AND r.IsDeleted = 0 AND r.EnforcementModeCode = 2
             JOIN mes.Skill k ON k.Id = r.SkillId
             WHERE o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode < 5) x ON x.WorkOrderId = w.Id
  GROUP BY w.Id
  UNION ALL
  /* کیفی: بچ نیمه‌ساخته‌ی ورودی آزاد شده یا هنوز در دستور فرزند/قرنطینه است */
  SELECT CAST(w.Id AS INT), N'QC', N'مجوز کیفی',
         CASE WHEN EXISTS (SELECT 1 FROM mes.WorkOrder c WHERE c.RefWorkOrderId = w.Id AND c.WOTypeCode = 1 AND c.WorkOrderStatusCode < 4 AND c.IsDeleted = 0) THEN 2 ELSE 1 END,
         ISNULL((SELECT TOP (1) N'نیمه‌ساخته از ' + c.Number + N' هنوز رسید و آزادسازی QC نشده' FROM mes.WorkOrder c
                 WHERE c.RefWorkOrderId = w.Id AND c.WOTypeCode = 1 AND c.WorkOrderStatusCode < 4 AND c.IsDeleted = 0), N'ورودی‌ها آزادشده‌اند')
  FROM @w w
  UNION ALL
  /* تجهیز: دسترس‌پذیری تجهیزات گروه منبع عملیات باقی‌مانده در لحظه‌ی کارگاه */
  SELECT CAST(w.Id AS INT), N'EQP', N'وضعیت تجهیز',
         CASE WHEN SUM(CASE WHEN x.Down = 1 THEN 1 ELSE 0 END) > 0 THEN 2 ELSE 1 END,
         ISNULL(STRING_AGG(CASE WHEN x.Down = 1 THEN x.Equipment + N' در دسترس نیست' END, N'؛ '), N'تجهیزات در دسترس‌اند')
  FROM @w w
  LEFT JOIN (SELECT DISTINCT o.WorkOrderId, e.Number + N' ' + e.Name AS Equipment,
                    CASE WHEN EXISTS (SELECT 1 FROM mes.EquipmentAvailability a WHERE a.EquipmentId = e.Id AND a.IsDeleted = 0 AND a.EquipmentAvailabilityStatusCode IN (2, 3)
                                        AND a.FromDateTime <= @now AND (a.ToDateTime IS NULL OR a.ToDateTime >= @now)) THEN 1 ELSE 0 END AS Down
             FROM mes.WorkOrderOperation o
             JOIN mes.ResourceGroupMember gm ON gm.ResourceGroupId = o.ResourceGroupId AND gm.IsDeleted = 0
             JOIN mes.Equipment e ON e.Id = gm.EquipmentId
             WHERE o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode < 5) x ON x.WorkOrderId = w.Id
  GROUP BY w.Id
  UNION ALL
  /* ظرفیت: زمان استاندارد باقی‌مانده تا تاریخ تکمیل برنامه‌ای */
  SELECT CAST(w.Id AS INT), N'CAP', N'ظرفیت',
         CASE WHEN wo.PlannedCompleteDate IS NOT NULL AND DATEADD(MINUTE, x.Mins, CASE WHEN w.PlanStart > @now THEN w.PlanStart ELSE @now END) > wo.PlannedCompleteDate THEN 2 ELSE 1 END,
         N'زمان استاندارد باقی‌مانده ' + FORMAT(x.Mins / 60.0, 'N1') + N' ساعت (جمع ساده‌ی عملیات)'
  FROM @w w
  JOIN mes.WorkOrder wo ON wo.Id = w.Id
  CROSS APPLY (SELECT ISNULL(SUM(ISNULL(t.SetupTimePerBatch, 0) + (o.ToCompleteQuantity - o.CompletedQuantity)
                                 * IIF(ISNULL(t.EquipmentRunTimePerPart, 0) > ISNULL(t.LaborRunTimePerPart, 0), ISNULL(t.EquipmentRunTimePerPart, 0), ISNULL(t.LaborRunTimePerPart, 0))), 0) AS Mins
               FROM mes.WorkOrderOperation o LEFT JOIN mes.RoutingOperationTiming t ON t.RoutingOperationId = o.RoutingOperationId AND t.IsDeleted = 0
               WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode < 5 AND o.IsOutsourced = 0) x
  ORDER BY 1, 2;
END
GO

/* ردیف‌های شارژ و انتقال پای کار با بچ و عیار */
CREATE OR ALTER PROCEDURE mes.GetMaterialKits
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.WorkOrderId AS INT) AS WorkOrderId, CAST(m.Id AS INT) AS MaterialId, o.Sequence AS OperationSequence, op.Name AS OperationTitle,
         p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, k.TransferNo, k.KitQuantity, k.ActiveKitQuantity, k.BatchNumber,
         k.PotencyPercent, k.KitStatusCode, k.EffectiveDate, k.ScanCode, k.Description, s.InventoryTitle AS SourceInventory, s.ExpireDate
  FROM mes.WorkOrderOperationMaterialKit k
  JOIN mes.WorkOrderOperationMaterial m ON m.Id = k.WOOperationMaterialId
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN mes.Product p ON p.Id = m.ProductId
  LEFT JOIN mes.MaterialStock s ON s.Id = k.MaterialStockId
  WHERE k.CompanyId = @CompanyId AND k.IsDeleted = 0
  ORDER BY o.WorkOrderId, o.Sequence, p.Number, k.TransferNo;
END
GO

CREATE OR ALTER PROCEDURE mes.GetMaterialExcessAndReturns
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.WorkOrderId AS INT) AS WorkOrderId, p.Number + N' — ' + p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, e.ExcessQuantity,
         e.ExcessReasonTitle, e.StatusCode, e.RequestDate, e.ApproverTitle, e.Description, m.PlannedKitQuantity, si.MaxConsumptionPercent
  FROM mes.WorkOrderOperationMaterialExcess e
  JOIN mes.WorkOrderOperationMaterial m ON m.Id = e.WOOperationMaterialId
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.Product p ON p.Id = m.ProductId
  LEFT JOIN mes.ProductStructureItem si ON si.Id = m.ProductStructureItemId
  WHERE e.CompanyId = @CompanyId AND e.IsDeleted = 0;

  SELECT CAST(o.WorkOrderId AS INT) AS WorkOrderId, p.Number + N' — ' + p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, r.ReturnedQuantity,
         r.ReturnReason, r.BatchNumber, r.DocumentNumber, r.EndTime, r.IsReturnedTolerance
  FROM mes.WorkOrderOperationMaterialReturned r
  JOIN mes.WorkOrderOperationMaterial m ON m.Id = r.WOOperationMaterialId
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.Product p ON p.Id = m.ProductId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0;
END
GO

/* موجودی لحظه‌ای پای کار به تفکیک دستور و قلم (F-PC-028) و سیگنال فراخوان کششی (F-PC-023) */
CREATE OR ALTER PROCEDURE mes.GetLineSideStock
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle,
         p.ProductGroupTitle, p.MeasureUnitTitle AS UnitTitle,
         SUM(ISNULL(m.ActualKitQuantity, 0)) AS Delivered, SUM(ISNULL(m.ConsumedQuantity, 0)) AS Consumed, SUM(ISNULL(m.ReturnedQuantity, 0)) AS Returned,
         SUM(ISNULL(m.ActualKitQuantity, 0) - ISNULL(m.ConsumedQuantity, 0) - ISNULL(m.ReturnedQuantity, 0)) AS OnLine,
         SUM(ISNULL(m.PlannedKitQuantity, 0) - ISNULL(m.ConsumedQuantity, 0)) AS RemainingNeed,
         MAX(pol.ReorderPoint) AS ReorderPoint, MAX(pol.MinStock) AS MinStock, MAX(pol.MaxStock) AS MaxStock, MAX(pol.FeedingPolicyCode) AS FeedingPolicyCode
  FROM mes.WorkOrder w
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.IsDeleted = 0
  JOIN mes.WorkOrderOperationMaterial m ON m.WOOperationId = o.Id AND m.IsDeleted = 0
  JOIN mes.Product p ON p.Id = m.ProductId
  OUTER APPLY (SELECT TOP (1) x.ReorderPoint, x.MinStock, x.MaxStock, x.FeedingPolicyCode FROM mes.ProductionMaterialPolicy x
               WHERE x.IsDeleted = 0 AND ((x.ScopeTypeCode = 3 AND x.ProductId = p.Id) OR (x.ScopeTypeCode = 2 AND x.ProductGroupTitle = p.ProductGroupTitle))
               ORDER BY x.ScopeTypeCode DESC) pol
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.WorkOrderStatusCode = 3
  GROUP BY w.Id, w.Number, p.Id, p.Number, p.Name, p.ProductGroupTitle, p.MeasureUnitTitle
  HAVING SUM(ISNULL(m.ActualKitQuantity, 0)) > 0
  ORDER BY w.Number, p.Number;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.WorkOrderOperationMaterialKit خالی است.
   عمداً خراب: پوویدون K30 در WO-1405-0504 کم بود و با K25 گروه SG-BIND جایگزین شد؛ درخواست مازاد گرانول در WO-1405-0506
   از سقف مصرف (۱۰۱٪) بیشتر است؛ محلول روکش WO-1405-0499 مازاد برگشت‌نخورده دارد؛ پنج روز تا تحویل WO-1405-0502
   بروشور کم است و پانچ ۱۲ mm عمر کافی ندارد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.WorkOrderOperationMaterialKit)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @D DATETIME2 = '2026-10-09';

  /* دستورهای در جریان و تکمیل‌شده: هر ماده در یک یا چند انتقال به اندازه‌ی بچ عملیات/بسته، با بچ FEFO */
  DECLARE @k TABLE (Wo NVARCHAR(64), Seq INT, ProductId BIGINT, TransferNo INT, Qty DECIMAL(32,6), Batch NVARCHAR(64), Potency DECIMAL(9,4), Status INT, AtMin INT, Note NVARCHAR(400));
  INSERT @k VALUES
    (N'WO-1405-0501', 40, 2001, 1, 122.85, N'GRN-1405-118', 99.8, 3, -700, N'۷۰٪ گرانول — انتقال ۱ (بچ عملیات)'),
    (N'WO-1405-0501', 45, 2001, 1, 52.65,  N'GRN-1405-118', 99.8, 3, -700, N'۳۰٪ گرانول'),
    (N'WO-1405-0501', 40, 2001, 2, 122.85, N'GRN-1405-121', 99.6, 2, 400,  N'انتقال ۲ — بچ WO-0500'),
    (N'WO-1405-0501', 45, 2001, 2, 52.65,  N'GRN-1405-121', 99.6, 2, 400,  NULL),
    (N'WO-1405-0501', 15, 3008, 1, 6.0,    N'CCS-0455', NULL, 3, -925, NULL),
    (N'WO-1405-0501', 15, 3003, 1, 3.0,    N'MGS-0381', NULL, 3, -925, NULL),
    (N'WO-1405-0501', 60, 4001, 1, 27.0,   N'ALF-3310', NULL, 3, 530, N'کانبان — بسته‌ی ۲۷ کیلویی'),
    (N'WO-1405-0501', 60, 4001, 2, 27.0,   N'ALF-3310', NULL, 2, 640, NULL),
    (N'WO-1405-0501', 60, 4002, 1, 36.0,   N'PVC-2295', NULL, 3, 530, NULL),
    (N'WO-1405-0501', 60, 4002, 2, 36.0,   N'PVC-2295', NULL, 2, 640, NULL),
    (N'WO-1405-0501', 60, 4003, 1, 10000,  N'CTN-1405-08', NULL, 2, 530, NULL),
    (N'WO-1405-0501', 60, 4005, 1, 10000,  N'BRO-1405-07', NULL, 2, 530, NULL),
    (N'WO-1405-0504', 10, 3001, 1, 126.34, N'PCM-2411', 98.9, 2, 400, N'۱۲۴٫۹۵ کیلو با عیار ۹۸٫۹٪ — FEFO: بچ ۲۴۱۱ زودتر منقضی می‌شود'),
    (N'WO-1405-0504', 10, 3002, 1, 13.05,  N'LAC-1187', NULL, 3, 400, NULL),
    (N'WO-1405-0504', 10, 3005, 1, 7.5,    N'STA-0931', NULL, 3, 400, NULL),
    (N'WO-1405-0504', 10, 3006, 1, 4.125,  N'PVK25-0108', NULL, 3, 400, N'جایگزین K25 (SG-BIND، نسبت ۱٫۱) — کمبود K30'),
    (N'WO-1405-0504', 10, 3009, 1, 45.0,   N'ETH-1405-09', NULL, 3, 400, NULL),
    (N'WO-1405-0506', 40, 2001, 1, 146.25, N'FRM-G-0092', 99.5, 3, 380, N'گرانول امانی مشتری'),
    (N'WO-1405-0506', 50, 4005, 1, 8334,   N'FRM-B-0015', NULL, 1, 900, N'بروشور امانی مشتری'),
    (N'WO-1405-0507', 10, 3001, 1, 749.7,  N'PCM-2406', 99.6, 3, 340, N'تأمین پیوسته'),
    (N'WO-1405-0507', 10, 3009, 1, 270.0,  N'ETH-1405-09', NULL, 3, 340, NULL),
    (N'WO-1405-0503', 10, 2002, 1, 500000, N'B-1405-0939', NULL, 3, -5760, N'ارسال به پارس‌دارو — برگه‌ی همراه SC-1405-061'),
    (N'WO-1405-0503', 10, 2003, 1, 32.0,   N'SOL-1405-044', NULL, 3, -5760, N'محلول روکش WO-1405-0499'),
    (N'WO-1405-0500', 10, 3001, 1, 100.0,  N'PCM-2406', 99.6, 3, -2400, NULL),
    (N'WO-1405-0500', 10, 3009, 1, 40.0,   N'ETH-1405-09', NULL, 3, -2400, N'۴ لیتر برگشت شد'),
    (N'WO-1405-0499', 10, 3004, 1, 13.0,   N'HPM-0207', NULL, 3, -1560, N'یک کیلو بیشتر از نیاز — برگشت نشده');

  INSERT mes.WorkOrderOperationMaterialKit (CompanyId, WOOperationMaterialId, ReferenceEntityName, ReferenceObjectId, KitQuantity, ActiveKitQuantity, EffectiveDate,
                                            Description, BatchNumber, MaterialStockId, PotencyPercent, TransferNo, KitStatusCode, ScanCode)
  SELECT @C, m.Id, N'WorkOrder', w.Id, k.Qty, CASE WHEN k.Potency IS NOT NULL THEN k.Qty * k.Potency / 100 ELSE k.Qty END, DATEADD(MINUTE, k.AtMin, @D),
         k.Note, k.Batch, (SELECT TOP (1) s.Id FROM mes.MaterialStock s WHERE s.BatchNumber = k.Batch AND s.IsDeleted = 0), k.Potency, k.TransferNo, k.Status,
         N'KIT|' + w.Number + N'|' + p.Number + N'|' + k.Batch + N'|' + CAST(k.TransferNo AS NVARCHAR(4))
  FROM @k k
  JOIN mes.WorkOrder w ON w.Number = k.Wo AND w.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = k.Seq
  JOIN mes.WorkOrderOperationMaterial m ON m.WOOperationId = o.Id AND m.ProductId = k.ProductId
  JOIN mes.Product p ON p.Id = k.ProductId;

  /* جمع کیت تحویلی روی ردیف ماده؛ وضعیت ماده */
  UPDATE m SET m.ActualKitQuantity = x.Delivered, m.ActualKitCompleteDate = x.LastAt, m.BatchNumber = x.Batches, m.Potency = x.Potency,
               m.WorkOrderOperationMaterialStatusCode = CASE WHEN x.Delivered >= ISNULL(m.PlannedKitQuantity, 0) THEN 3 ELSE 2 END
  FROM mes.WorkOrderOperationMaterial m
  JOIN (SELECT k.WOOperationMaterialId, SUM(CASE WHEN k.KitStatusCode >= 2 THEN k.KitQuantity ELSE 0 END) AS Delivered, MAX(k.EffectiveDate) AS LastAt,
               STRING_AGG(k.BatchNumber, N'، ') AS Batches, MAX(k.PotencyPercent) AS Potency
        FROM mes.WorkOrderOperationMaterialKit k GROUP BY k.WOOperationMaterialId) x ON x.WOOperationMaterialId = m.Id;

  /* جایگزینی K30 ← K25 در WO-0504 */
  UPDATE m SET m.SubstitutedProductId = 3013, m.Description = N'کمبود K30؛ جایگزین K25 از گروه SG-BIND با نسبت ۱٫۱ (۴٫۱۲۵ کیلو)'
  FROM mes.WorkOrderOperationMaterial m JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.Number = N'WO-1405-0504' AND m.ProductId = 3006;
  IF NOT EXISTS (SELECT 1 FROM mes.MaterialStock WHERE BatchNumber = N'PVK25-0108')
    INSERT mes.MaterialStock (CompanyId, ProductId, InventoryKindCode, InventoryTitle, BatchNumber, ManufactureDate, ExpireDate, OnHandQuantity, ReservedQuantity, QcStatusCode, Description)
    VALUES (@C, 3013, 1, N'انبار مواد اولیه', N'PVK25-0108', '2026-08-01', '2028-07-31', 45.875, 0, 1, N'پوویدون K25 — جایگزین ECO-1405-0102');

  /* درخواست مازاد */
  INSERT mes.WorkOrderOperationMaterialExcess (CompanyId, WOOperationMaterialId, ExcessQuantity, ExcessReasonTitle, StatusCode, RequestDate, ApproverTitle, Description)
  SELECT @C, m.Id, v.Qty, v.Reason, v.Status, DATEADD(MINUTE, v.AtMin, @D), v.Appr, v.Description
  FROM (VALUES (N'WO-1405-0501', 60, 4001, 3.5, N'پارگی فویل در راه‌اندازی', 2, 600, N'سرپرست تولید', N'در محدوده‌ی مجاز'),
               (N'WO-1405-0506', 40, 2001, 6.0, N'افت وزن قرص و تنظیم مجدد', 1, 660, NULL, N'بیش از سقف ۱۰۱٪ مصرف — گرانول امانی مشتری'),
               (N'WO-1405-0501', 40, 2001, 4.0, N'ریزش هاپر', 3, 300, N'مدیر تولید', N'رد — از برگشتی خط ۱ تأمین شود')) v(Wo, Seq, ProductId, Qty, Reason, Status, AtMin, Appr, Description)
  JOIN mes.WorkOrder w ON w.Number = v.Wo AND w.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = v.Seq
  JOIN mes.WorkOrderOperationMaterial m ON m.WOOperationId = o.Id AND m.ProductId = v.ProductId;

  UPDATE m SET m.ExcessQuantity = x.Qty
  FROM mes.WorkOrderOperationMaterial m JOIN (SELECT WOOperationMaterialId, SUM(ExcessQuantity) Qty FROM mes.WorkOrderOperationMaterialExcess WHERE StatusCode = 2 GROUP BY WOOperationMaterialId) x
    ON x.WOOperationMaterialId = m.Id;

  /* برگشت مازاد با سند */
  INSERT mes.WorkOrderOperationMaterialReturned (CompanyId, WOOperationMaterialId, ReturnedQuantity, ReturnReason, EndTime, ReferenceEntityName, ReferenceObjectId,
                                                 ReferenceObjectNumber, BatchNumber, DocumentNumber, IsReturnedTolerance)
  SELECT @C, m.Id, v.Qty, v.Reason, DATEADD(MINUTE, v.AtMin, @D), N'WorkOrder', w.Id, w.Number, v.Batch, v.Doc, 1
  FROM (VALUES (N'WO-1405-0500', 10, 3009, 4.0, N'مازاد حلال پایان دستور', -1880, N'ETH-1405-09', N'RTN-1405-0401'),
               (N'WO-1405-0500', 10, 3001, 0.0, N'بدون مازاد', -1880, N'PCM-2406', NULL)) v(Wo, Seq, ProductId, Qty, Reason, AtMin, Batch, Doc)
  JOIN mes.WorkOrder w ON w.Number = v.Wo AND w.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = v.Seq
  JOIN mes.WorkOrderOperationMaterial m ON m.WOOperationId = o.Id AND m.ProductId = v.ProductId
  WHERE v.Qty > 0;

  UPDATE m SET m.ReturnedQuantity = x.Qty
  FROM mes.WorkOrderOperationMaterial m JOIN (SELECT WOOperationMaterialId, SUM(ReturnedQuantity) Qty FROM mes.WorkOrderOperationMaterialReturned GROUP BY WOOperationMaterialId) x
    ON x.WOOperationMaterialId = m.Id;

  /* WO-0502 هنوز کیت نشده ولی ۴۰٬۰۰۰ بروشور رزرو دارد؛ پانچ ۱۲ mm تنها ابزار گروه با عمر کافی نیست */
  UPDATE mes.MaterialStock SET ReservedQuantity = ReservedQuantity WHERE 1 = 0;

  COMMIT;
END
GO
