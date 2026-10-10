/* =====================================================================
   اسکیمای mes — گام ۳۷: FRM-PC-07 «رسید محصول و هویت‌بخشی»

   پیش‌نیاز: mes_frm_pc06 (مصرف با شماره‌ی بچ)، سیاست رسید (ME-06)، ویژگی‌های بچ مسیر (ME-07).

   جدول‌های قدیم با همان نام و همه‌ی فیلدها:
     mes.WorkOrderOperationOutputProduct  (mfr) همان + ReceiptNumber، ReceiptDate، OutputTypeCode (اصلی/هم‌زاد/جانبی/ضایعات/بازیابی)،
                                          ReceiptPolicyCode (056)، InventoryTitle، BatchNumber، QcStatusCode، QcApprovedQuantity،
                                          QcRejectedQuantity و RejectedRouteCode (058)، CostSharePercent و ValuationRate (057)، IsCustomerOwned، DocumentNumber
     mes.ProductionLineBatchNumber        (generalmfr) الگوی شماره‌ی بچ خط + ProductGroupTitle، LastUsedNumber
     mes.ProductionLineBatchNumberSetting (generalmfr) اجزای الگو
     mes.ProductSerial                    (generalmfr) همان + BatchNumber، LevelCode، WOOperationId، SerialPatternId، AssignedAt (061)
     mes.ProductLabelTemplate / Detail / Parameter (mfr) همان + ابعاد، سطح و جانمایی اجزا (063)
   جدول‌های جدید:
     mes.ProductionBatch                  بچ محصول با وضعیت آزادسازی (060)
     mes.ProductionBatchAttributeValue    مقدار ویژگی بچ در عملیات تعیین‌شده در مسیر — تکمیل تدریجی (060)
     mes.ProductSerialPattern             الگوی سریال (WorkOrder.ProductSerialPatternId قدیم به آن اشاره می‌کند)
     mes.ProductionBatchGenealogy         بچ به بچ (062)، ساخته‌شده از ردیف‌های مصرف PC-06
   مغایرت‌گیری (064) با mes.GetReceiptReconciliation زنده: گزارش نقطه‌ی رسید در برابر رسید و تأیید QC.

   فرض‌ها و کدهای موقت:
     OutputTypeCode       1 اصلی، 2 هم‌زاد، 3 جانبی، 4 ضایعات قابل فروش/اسقاط، 5 ماده‌ی بازیابی‌شده (همان WorkOrderProduct)
     ReceiptPolicyCode    1 مستقیم، 2 مجوز ورود، 3 مشروط به تأیید QC، 4 انبار قرنطینه (همان ME-06)
     QcStatusCode         1 در انتظار، 2 آزاد، 3 رد، 4 آزاد جزئی
     RejectedRouteCode    1 ضایعات، 2 دوباره‌کاری، 3 بازیافت
     WorkOrderOperationOutputProductStatusCode  1 ثبت‌شده، 2 تحویل جزئی به انبار، 3 تحویل کامل
     ProductionBatch.StatusCode  1 باز، 2 در تولید، 3 منتظر QC، 4 آزاد، 5 آزاد جزئی، 6 قرنطینه، 7 باطل
     ProductSerial.ProductSerialStatusCode  1 تولیدشده، 2 تخصیص/چاپ، 3 تجمیع‌شده، 4 ارسال‌شده، 5 باطل
     ProductionLineBatchNumberItemTypeCode  1 متن ثابت، 2 سال شمسی، 3 ماه شمسی، 4 کد خط، 5 شمارنده
     ProductionBatchGenealogy.RelationTypeCode  1 مصرف، 2 دوباره‌کاری، 3 بازیافت، 4 تفکیک، 5 بازیابی

   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.WorkOrderOperationOutputProduct','U') IS NULL
CREATE TABLE mes.WorkOrderOperationOutputProduct (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationOutputProduct PRIMARY KEY,
  OperationOutputId BIGINT NOT NULL,
  FinalProductId BIGINT NOT NULL,
  BatchId BIGINT NULL,
  CompletedQuantity DECIMAL(32,6) NULL,
  IsDeliveredToInventory BIT NOT NULL CONSTRAINT DF_mes_WOOOP_Delivered DEFAULT (0),
  ProductExtraInfo NVARCHAR(400) NULL,
  RemainedToInvQuantity DECIMAL(32,6) NULL,
  ReceivedToInvQuantity DECIMAL(32,6) NULL,
  MeasureUnitId BIGINT NULL,
  WorkOrderOperationOutputProductStatusCode INT NULL,
  Description NVARCHAR(400) NULL,
  ReceiptNumber NVARCHAR(64) NULL,
  ReceiptDate DATETIME2 NULL,
  OutputTypeCode INT NOT NULL CONSTRAINT DF_mes_WOOOP_OutputType DEFAULT (1),
  ReceiptPolicyCode INT NULL,
  InventoryTitle NVARCHAR(256) NULL,
  BatchNumber NVARCHAR(64) NULL,
  QcStatusCode INT NULL,
  QcApprovedQuantity DECIMAL(32,6) NULL,
  QcRejectedQuantity DECIMAL(32,6) NULL,
  RejectedRouteCode INT NULL,
  CostSharePercent DECIMAL(9,4) NULL,
  ValuationRate DECIMAL(32,4) NULL,
  IsCustomerOwned BIT NOT NULL CONSTRAINT DF_mes_WOOOP_Customer DEFAULT (0),
  DocumentNumber NVARCHAR(64) NULL
);

IF OBJECT_ID('mes.ProductionLineBatchNumber','U') IS NULL
CREATE TABLE mes.ProductionLineBatchNumber (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionLineBatchNumber PRIMARY KEY,
  ProductionLineId BIGINT NOT NULL,
  ValidFromDate DATE NULL,
  ValidToDate DATE NULL,
  FirstNumber NVARCHAR(64) NULL,
  LastNumber NVARCHAR(64) NULL,
  TotalLength INT NULL,
  StatusCode INT NULL,
  Description NVARCHAR(400) NULL,
  ProductGroupTitle NVARCHAR(128) NULL,
  LastUsedNumber NVARCHAR(64) NULL
);

IF OBJECT_ID('mes.ProductionLineBatchNumberSetting','U') IS NULL
CREATE TABLE mes.ProductionLineBatchNumberSetting (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionLineBatchNumberSetting PRIMARY KEY,
  ProductionLineBatchNumberId BIGINT NOT NULL,
  OrderNumber INT NOT NULL,
  ProductionLineBatchNumberItemTypeCode INT NOT NULL,
  IsRenewalFactor BIT NOT NULL CONSTRAINT DF_mes_PLBNS_Renewal DEFAULT (0),
  NumberItemLength INT NULL,
  NumberItemValue NVARCHAR(64) NULL
);

IF OBJECT_ID('mes.ProductionBatch','U') IS NULL
CREATE TABLE mes.ProductionBatch (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionBatch PRIMARY KEY,
  BatchNumber NVARCHAR(64) NOT NULL,
  ProductId BIGINT NOT NULL,
  WorkOrderId BIGINT NULL,
  ProductionLineId BIGINT NULL,
  ProductionLineBatchNumberId BIGINT NULL,
  ManufactureDate DATE NULL,
  ExpireDate DATE NULL,
  PlannedQuantity DECIMAL(32,6) NULL,
  ReleasedQuantity DECIMAL(32,6) NULL,
  StatusCode INT NOT NULL CONSTRAINT DF_mes_ProductionBatch_Status DEFAULT (1),
  IsCustomerOwned BIT NOT NULL CONSTRAINT DF_mes_ProductionBatch_Customer DEFAULT (0),
  OwnerTitle NVARCHAR(256) NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionBatchAttributeValue','U') IS NULL
CREATE TABLE mes.ProductionBatchAttributeValue (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionBatchAttributeValue PRIMARY KEY,
  ProductionBatchId BIGINT NOT NULL,
  ProductionAttributeId BIGINT NOT NULL,
  WOOperationId BIGINT NULL,
  ValueNumber DECIMAL(32,6) NULL,
  ValueText NVARCHAR(256) NULL,
  RecordedAt DATETIME2 NULL,
  RecordedByTitle NVARCHAR(128) NULL,
  SourceCode INT NOT NULL CONSTRAINT DF_mes_PBAV_Source DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductSerialPattern','U') IS NULL
CREATE TABLE mes.ProductSerialPattern (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductSerialPattern PRIMARY KEY,
  Number NVARCHAR(32) NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  PatternText NVARCHAR(128) NOT NULL,
  LevelCode INT NOT NULL,
  CounterLength INT NOT NULL,
  ChildrenPerParent INT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductSerial','U') IS NULL
CREATE TABLE mes.ProductSerial (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductSerial PRIMARY KEY,
  Name NVARCHAR(128) NOT NULL,
  ProductId BIGINT NOT NULL,
  WorkOrderId BIGINT NULL,
  ParentSerialId BIGINT NULL,
  ProductSerialStatusCode BIGINT NOT NULL,
  BatchNumber NVARCHAR(64) NULL,
  LevelCode INT NOT NULL CONSTRAINT DF_mes_ProductSerial_Level DEFAULT (2),
  WOOperationId BIGINT NULL,
  SerialPatternId BIGINT NULL,
  AssignedAt DATETIME2 NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionBatchGenealogy','U') IS NULL
CREATE TABLE mes.ProductionBatchGenealogy (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionBatchGenealogy PRIMARY KEY,
  ParentBatchNumber NVARCHAR(64) NOT NULL,
  ParentProductId BIGINT NOT NULL,
  ParentWorkOrderId BIGINT NULL,
  ChildBatchNumber NVARCHAR(64) NOT NULL,
  ChildProductId BIGINT NOT NULL,
  ChildWorkOrderId BIGINT NULL,
  WOOperationId BIGINT NULL,
  Quantity DECIMAL(32,6) NULL,
  IsQuantityEstimated BIT NOT NULL CONSTRAINT DF_mes_PBG_Estimated DEFAULT (0),
  RelationTypeCode INT NOT NULL CONSTRAINT DF_mes_PBG_Relation DEFAULT (1),
  SourceConsumedId BIGINT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductLabelTemplate','U') IS NULL
CREATE TABLE mes.ProductLabelTemplate (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductLabelTemplate PRIMARY KEY,
  Number NVARCHAR(32) NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  ValidFromDate DATE NULL,
  ValidToDate DATE NULL,
  LabelImage IMAGE NULL,
  LevelCode INT NULL,
  WidthMm DECIMAL(9,2) NULL,
  HeightMm DECIMAL(9,2) NULL,
  ProductGroupTitle NVARCHAR(128) NULL,
  ProductId BIGINT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductLabelTemplateParameter','U') IS NULL
CREATE TABLE mes.ProductLabelTemplateParameter (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductLabelTemplateParameter PRIMARY KEY,
  Number NVARCHAR(32) NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  ValidFromDate DATETIME2 NULL,
  ValidToDate DATETIME2 NULL,
  SourceField NVARCHAR(64) NULL
);

IF OBJECT_ID('mes.ProductLabelTemplateDetail','U') IS NULL
CREATE TABLE mes.ProductLabelTemplateDetail (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductLabelTemplateDetail PRIMARY KEY,
  TemplateId BIGINT NOT NULL,
  ParameterId BIGINT NULL,
  ValueDescription NVARCHAR(256) NULL,
  ElementTypeCode INT NOT NULL CONSTRAINT DF_mes_PLTD_Element DEFAULT (1),
  PosXMm DECIMAL(9,2) NOT NULL CONSTRAINT DF_mes_PLTD_X DEFAULT (0),
  PosYMm DECIMAL(9,2) NOT NULL CONSTRAINT DF_mes_PLTD_Y DEFAULT (0),
  WidthMm DECIMAL(9,2) NULL,
  HeightMm DECIMAL(9,2) NULL,
  FontSizePt DECIMAL(5,1) NULL,
  IsBold BIT NOT NULL CONSTRAINT DF_mes_PLTD_Bold DEFAULT (0),
  SortOrder INT NOT NULL CONSTRAINT DF_mes_PLTD_Sort DEFAULT (0)
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

/* رسیدهای محصول با گزارش منشأ، سیاست و QC */
CREATE OR ALTER PROCEDURE mes.GetProductReceipts
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(r.Id AS INT) AS ReceiptId, r.ReceiptNumber, r.ReceiptDate, CAST(o.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber,
         o.Sequence AS OperationSequence, x.ReportNumber, x.CompletedQuantity AS ReportedQuantity, x.EndTime AS ReportedAt,
         CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         r.OutputTypeCode, r.CompletedQuantity, r.ReceivedToInvQuantity, r.RemainedToInvQuantity, r.IsDeliveredToInventory,
         r.WorkOrderOperationOutputProductStatusCode AS StatusCode, r.ReceiptPolicyCode, r.InventoryTitle, r.BatchNumber, CAST(r.BatchId AS INT) AS BatchId,
         r.QcStatusCode, r.QcApprovedQuantity, r.QcRejectedQuantity, r.RejectedRouteCode, r.CostSharePercent, r.ValuationRate,
         r.IsCustomerOwned, r.DocumentNumber, r.Description
  FROM mes.WorkOrderOperationOutputProduct r
  JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.Product p ON p.Id = r.FinalProductId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
  ORDER BY r.ReceiptDate DESC, r.Id DESC;
END
GO

/* مغایرت‌گیری (F-PC-064): هر گزارش نقطه‌ی رسید در برابر رسیدهایش، و هر خروجی برنامه‌ریزی‌شده‌ی دستور در برابر رسید آن */
CREATE OR ALTER PROCEDURE mes.GetReceiptReconciliation
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();

  /* نقطه‌ی رسید هر دستور: عملیاتی که رسید دارد، وگرنه آخرین عملیات */
  ;WITH rp AS (
    SELECT o.Id AS OpId, o.WorkOrderId FROM mes.WorkOrderOperation o
    WHERE o.IsDeleted = 0 AND (EXISTS (SELECT 1 FROM mes.WorkOrderOperationOutputProduct r JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId
                                        WHERE x.WOOperationId = o.Id AND r.IsDeleted = 0 AND r.OutputTypeCode = 1)
       OR (o.Sequence = (SELECT MAX(o2.Sequence) FROM mes.WorkOrderOperation o2 WHERE o2.WorkOrderId = o.WorkOrderId AND o2.IsDeleted = 0)
           AND NOT EXISTS (SELECT 1 FROM mes.WorkOrderOperationOutputProduct r JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId
                           JOIN mes.WorkOrderOperation o3 ON o3.Id = x.WOOperationId WHERE o3.WorkOrderId = o.WorkOrderId AND r.IsDeleted = 0 AND r.OutputTypeCode = 1)))
  )
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, o.Sequence AS OperationSequence, x.ReportNumber, x.EndTime AS ReportedAt,
         p.Number + N' — ' + p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, x.CompletedQuantity AS Reported,
         ISNULL(r.Received, 0) AS Received, ISNULL(r.Approved, 0) AS QcApproved, ISNULL(r.Rejected, 0) AS QcRejected, ISNULL(r.Pending, 0) AS QcPending,
         x.CompletedQuantity - ISNULL(r.Received, 0) - ISNULL(r.Rejected, 0) AS Difference,
         CAST(DATEDIFF(MINUTE, x.EndTime, @now) / 60.0 AS DECIMAL(9,1)) AS AgeHours,
         CASE WHEN ISNULL(r.Received, 0) + ISNULL(r.Rejected, 0) > x.CompletedQuantity * 1.001 THEN 1
              WHEN r.RejectedNoRoute > 0 THEN 4
              WHEN r.NoQcUnderPolicy > 0 THEN 3
              WHEN x.CompletedQuantity - ISNULL(r.Received, 0) - ISNULL(r.Rejected, 0) > 0.001 AND DATEDIFF(MINUTE, x.EndTime, @now) > 240 THEN 2
              WHEN x.CompletedQuantity - ISNULL(r.Received, 0) - ISNULL(r.Rejected, 0) > 0.001 THEN 5
              ELSE 0 END AS ExceptionCode
  FROM rp
  JOIN mes.WorkOrderOperation o ON o.Id = rp.OpId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.WorkOrderOperationOutput x ON x.WOOperationId = o.Id AND x.IsDeleted = 0 AND x.CompletedQuantity > 0
  JOIN mes.Product p ON p.Id = w.MainProductId
  OUTER APPLY (SELECT SUM(r.ReceivedToInvQuantity) AS Received, SUM(r.QcApprovedQuantity) AS Approved, SUM(r.QcRejectedQuantity) AS Rejected,
                      SUM(CASE WHEN r.QcStatusCode = 1 THEN r.ReceivedToInvQuantity ELSE 0 END) AS Pending,
                      SUM(CASE WHEN r.QcRejectedQuantity > 0 AND r.RejectedRouteCode IS NULL THEN 1 ELSE 0 END) AS RejectedNoRoute,
                      SUM(CASE WHEN r.ReceiptPolicyCode = 3 AND r.QcStatusCode = 1 AND r.InventoryTitle NOT LIKE N'%قرنطینه%' THEN 1 ELSE 0 END) AS NoQcUnderPolicy
               FROM mes.WorkOrderOperationOutputProduct r WHERE r.OperationOutputId = x.Id AND r.IsDeleted = 0 AND r.OutputTypeCode = 1) r
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.WorkOrderStatusCode IN (3, 4, 5)
  ORDER BY w.Number, x.EndTime;

  /* خروجی‌های غیراصلی: برنامه × پیشرفت نقطه‌ی رسید در برابر رسید */
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, wp.OutputTypeCode, p.Number + N' — ' + p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         CAST(wp.Quantity * pr.Progress AS DECIMAL(32,4)) AS Expected, ISNULL(r.Received, 0) AS Received, r.LastReceipt,
         CASE WHEN wp.Quantity * pr.Progress > 0 AND ISNULL(r.Received, 0) = 0 AND w.WorkOrderStatusCode IN (4, 5) THEN 6 ELSE 0 END AS ExceptionCode
  FROM mes.WorkOrderProduct wp
  JOIN mes.WorkOrder w ON w.Id = wp.WorkOrderId
  JOIN mes.Product p ON p.Id = wp.ProductId
  CROSS APPLY (SELECT CAST(ISNULL(MAX(CASE WHEN o.Sequence = s.MaxSeq THEN o.CompletedQuantity / NULLIF(o.ToCompleteQuantity, 0) END), 0) AS DECIMAL(9,4)) AS Progress
               FROM mes.WorkOrderOperation o CROSS APPLY (SELECT MAX(Sequence) AS MaxSeq FROM mes.WorkOrderOperation WHERE WorkOrderId = w.Id AND IsDeleted = 0) s
               WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) pr
  OUTER APPLY (SELECT SUM(r.ReceivedToInvQuantity) AS Received, MAX(r.ReceiptDate) AS LastReceipt
               FROM mes.WorkOrderOperationOutputProduct r JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId
               JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
               WHERE o.WorkOrderId = w.Id AND r.FinalProductId = wp.ProductId AND r.IsDeleted = 0) r
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND wp.IsDeleted = 0 AND wp.OutputTypeCode IN (2, 3, 4, 5) AND w.WorkOrderStatusCode IN (3, 4, 5)
  ORDER BY w.Number, wp.OutputTypeCode;
END
GO

/* بچ‌ها با الگوی شماره و پیشرفت ویژگی‌ها؛ recordset دوم: الگوهای شماره‌ی بچ خط و اجزا */
CREATE OR ALTER PROCEDURE mes.GetProductionBatches
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(b.Id AS INT) AS BatchId, b.BatchNumber, CAST(b.ProductId AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         CAST(b.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WorkOrderStatusCode, w.WOTypeCode, ln.Name AS LineTitle,
         b.ManufactureDate, b.ExpireDate, b.PlannedQuantity, b.ReleasedQuantity, b.StatusCode, b.IsCustomerOwned, b.OwnerTitle, b.Description,
         CAST(b.ProductionLineBatchNumberId AS INT) AS PatternId,
         (SELECT COUNT(*) FROM mes.ProductSerial s WHERE s.BatchNumber = b.BatchNumber AND s.WorkOrderId = b.WorkOrderId AND s.IsDeleted = 0) AS SerialCount,
         (SELECT ISNULL(SUM(r.ReceivedToInvQuantity), 0) FROM mes.WorkOrderOperationOutputProduct r WHERE r.BatchId = b.Id AND r.IsDeleted = 0 AND r.OutputTypeCode = 1) AS ReceivedQuantity
  FROM mes.ProductionBatch b
  JOIN mes.Product p ON p.Id = b.ProductId
  LEFT JOIN mes.WorkOrder w ON w.Id = b.WorkOrderId
  LEFT JOIN mes.ProductionLine ln ON ln.Id = b.ProductionLineId
  WHERE b.CompanyId = @CompanyId AND b.IsDeleted = 0
  ORDER BY b.ManufactureDate DESC, b.BatchNumber;

  SELECT CAST(n.Id AS INT) AS PatternId, CAST(n.ProductionLineId AS INT) AS ProductionLineId, ln.Name AS LineTitle, n.ProductGroupTitle, n.ValidFromDate, n.ValidToDate,
         n.FirstNumber, n.LastNumber, n.LastUsedNumber, n.TotalLength, n.StatusCode, n.Description,
         CAST(s.Id AS INT) AS SettingId, s.OrderNumber, s.ProductionLineBatchNumberItemTypeCode AS ItemTypeCode, s.IsRenewalFactor, s.NumberItemLength, s.NumberItemValue
  FROM mes.ProductionLineBatchNumber n
  JOIN mes.ProductionLine ln ON ln.Id = n.ProductionLineId
  JOIN mes.ProductionLineBatchNumberSetting s ON s.ProductionLineBatchNumberId = n.Id AND s.IsDeleted = 0
  WHERE n.CompanyId = @CompanyId AND n.IsDeleted = 0
  ORDER BY n.Id, s.OrderNumber;
END
GO

/* ماتریس تکمیل تدریجی ویژگی‌های بچ: ویژگی‌های تعیین‌شده در عملیات مسیر × مقدار ثبت‌شده */
CREATE OR ALTER PROCEDURE mes.GetBatchAttributeProgress
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(b.Id AS INT) AS BatchId, b.BatchNumber, o.Sequence AS OperationSequence, op.Name AS OperationTitle, o.WorkOrderOperationStatusCode AS OperationStatusCode,
         CAST(a.Id AS INT) AS AttributeId, a.Number AS AttributeCode, a.Name AS AttributeTitle, a.UnitTitle, a.AttributeDataTypeCode, ra.ActionCode, ra.IsQcGate,
         v.ValueNumber, v.ValueText, v.RecordedAt, v.RecordedByTitle, v.SourceCode, ra.Description AS RuleNote
  FROM mes.ProductionBatch b
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = b.WorkOrderId AND o.IsDeleted = 0
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN mes.RoutingOperationBatchAttribute ra ON ra.RoutingOperationId = o.RoutingOperationId AND ra.IsDeleted = 0
  JOIN mes.ProductionAttribute a ON a.Id = ra.ProductionAttributeId
  LEFT JOIN mes.ProductionBatchAttributeValue v ON v.ProductionBatchId = b.Id AND v.ProductionAttributeId = a.Id AND v.WOOperationId = o.Id AND v.IsDeleted = 0
  WHERE b.CompanyId = @CompanyId AND b.IsDeleted = 0
  ORDER BY b.BatchNumber, o.Sequence, a.SortOrder;
END
GO

/* خلاصه‌ی سریال‌ها به تفکیک دستور، سطح و وضعیت؛ recordset دوم: الگوها */
CREATE OR ALTER PROCEDURE mes.GetSerialSummary
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(s.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, s.BatchNumber, s.LevelCode, CAST(s.ProductSerialStatusCode AS INT) AS StatusCode,
         COUNT(*) AS SerialCount, MIN(s.Name) AS FirstSerial, MAX(s.Name) AS LastSerial, MAX(s.AssignedAt) AS LastAssignedAt,
         MAX(CAST(s.SerialPatternId AS INT)) AS PatternId, MAX(o.Sequence) AS OperationSequence
  FROM mes.ProductSerial s
  JOIN mes.WorkOrder w ON w.Id = s.WorkOrderId
  LEFT JOIN mes.WorkOrderOperation o ON o.Id = s.WOOperationId
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0
  GROUP BY s.WorkOrderId, w.Number, s.BatchNumber, s.LevelCode, s.ProductSerialStatusCode
  ORDER BY w.Number, s.LevelCode DESC, s.ProductSerialStatusCode;

  SELECT CAST(Id AS INT) AS PatternId, Number, Name, PatternText, LevelCode, CounterLength, ChildrenPerParent, Description
  FROM mes.ProductSerialPattern WHERE CompanyId = @CompanyId AND IsDeleted = 0 ORDER BY LevelCode, Number;
END
GO

/* جست‌وجوی یک سریال: خود سریال، والد و فرزندان (تا ۲۰۰) */
CREATE OR ALTER PROCEDURE mes.GetSerialLookup
  @CompanyId BIGINT,
  @Serial NVARCHAR(128)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @id BIGINT = (SELECT TOP (1) Id FROM mes.ProductSerial WHERE CompanyId = @CompanyId AND IsDeleted = 0 AND Name = @Serial);
  SELECT CAST(s.Id AS INT) AS SerialId, s.Name AS Serial, s.LevelCode, CAST(s.ProductSerialStatusCode AS INT) AS StatusCode, s.BatchNumber, s.AssignedAt, s.Description,
         p.Number + N' — ' + p.Name AS ProductTitle, w.Number AS WorkOrderNumber, o.Sequence AS OperationSequence,
         par.Name AS ParentSerial, CAST(par.ProductSerialStatusCode AS INT) AS ParentStatusCode,
         (SELECT COUNT(*) FROM mes.ProductSerial c WHERE c.ParentSerialId = s.Id AND c.IsDeleted = 0) AS ChildCount
  FROM mes.ProductSerial s
  JOIN mes.Product p ON p.Id = s.ProductId
  LEFT JOIN mes.WorkOrder w ON w.Id = s.WorkOrderId
  LEFT JOIN mes.WorkOrderOperation o ON o.Id = s.WOOperationId
  LEFT JOIN mes.ProductSerial par ON par.Id = s.ParentSerialId
  WHERE s.Id = @id;

  SELECT TOP (200) CAST(c.Id AS INT) AS SerialId, c.Name AS Serial, c.LevelCode, CAST(c.ProductSerialStatusCode AS INT) AS StatusCode
  FROM mes.ProductSerial c WHERE c.ParentSerialId = @id AND c.IsDeleted = 0 ORDER BY c.Name;
END
GO

/* شجره‌نامه (F-PC-062): ردیابی پس‌رو (اجزای یک بچ) یا پیش‌رو (بچ‌هایی که این بچ در آن‌ها رفته) تا ۶ سطح */
CREATE OR ALTER PROCEDURE mes.GetBatchTrace
  @CompanyId BIGINT,
  @BatchNumber NVARCHAR(64),
  @Direction INT = 1
AS
BEGIN
  SET NOCOUNT ON;
  ;WITH t AS (
    SELECT 1 AS Lvl, g.Id, g.ParentBatchNumber, g.ParentProductId, g.ParentWorkOrderId, g.ChildBatchNumber, g.ChildProductId, g.ChildWorkOrderId,
           g.Quantity, g.IsQuantityEstimated, g.RelationTypeCode, g.WOOperationId, CAST(N'/' + CAST(g.Id AS NVARCHAR(20)) + N'/' AS NVARCHAR(400)) AS PathKey
    FROM mes.ProductionBatchGenealogy g
    WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0
      AND ((@Direction = 1 AND g.ParentBatchNumber = @BatchNumber) OR (@Direction = 2 AND g.ChildBatchNumber = @BatchNumber))
    UNION ALL
    SELECT t.Lvl + 1, g.Id, g.ParentBatchNumber, g.ParentProductId, g.ParentWorkOrderId, g.ChildBatchNumber, g.ChildProductId, g.ChildWorkOrderId,
           g.Quantity, g.IsQuantityEstimated, g.RelationTypeCode, g.WOOperationId, CAST(t.PathKey + CAST(g.Id AS NVARCHAR(20)) + N'/' AS NVARCHAR(400))
    FROM t JOIN mes.ProductionBatchGenealogy g ON g.IsDeleted = 0 AND g.CompanyId = @CompanyId
      AND ((@Direction = 1 AND g.ParentBatchNumber = t.ChildBatchNumber AND g.ParentProductId = t.ChildProductId)
        OR (@Direction = 2 AND g.ChildBatchNumber = t.ParentBatchNumber AND g.ChildProductId = t.ParentProductId))
    WHERE t.Lvl < 6 AND t.PathKey NOT LIKE N'%/' + CAST(g.Id AS NVARCHAR(20)) + N'/%'
  )
  SELECT t.Lvl, CAST(t.Id AS INT) AS LinkId, t.ParentBatchNumber, pp.Number + N' — ' + pp.Name AS ParentProductTitle, pw.Number AS ParentWorkOrderNumber,
         t.ChildBatchNumber, cp.Number + N' — ' + cp.Name AS ChildProductTitle, cw.Number AS ChildWorkOrderNumber, cp.MeasureUnitTitle AS ChildUnitTitle,
         t.Quantity, t.IsQuantityEstimated, t.RelationTypeCode, o.Sequence AS OperationSequence,
         (SELECT TOP (1) s.InventoryTitle FROM mes.MaterialStock s WHERE s.BatchNumber = CASE WHEN @Direction = 1 THEN t.ChildBatchNumber ELSE t.ParentBatchNumber END AND s.IsDeleted = 0) AS CurrentInventory
  FROM t
  JOIN mes.Product pp ON pp.Id = t.ParentProductId
  JOIN mes.Product cp ON cp.Id = t.ChildProductId
  LEFT JOIN mes.WorkOrder pw ON pw.Id = t.ParentWorkOrderId
  LEFT JOIN mes.WorkOrder cw ON cw.Id = t.ChildWorkOrderId
  LEFT JOIN mes.WorkOrderOperation o ON o.Id = t.WOOperationId
  ORDER BY t.PathKey
  OPTION (MAXRECURSION 50);
END
GO

/* همه‌ی پیوندهای شجره (برای گراف) و شکاف‌ها: مصرف بدون شماره‌ی بچ */
CREATE OR ALTER PROCEDURE mes.GetGenealogyLinks
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(g.Id AS INT) AS LinkId, g.ParentBatchNumber, CAST(g.ParentProductId AS INT) AS ParentProductId, pp.Number AS ParentProductCode, pp.Name AS ParentProductTitle,
         CAST(g.ParentWorkOrderId AS INT) AS ParentWorkOrderId, pw.Number AS ParentWorkOrderNumber,
         g.ChildBatchNumber, CAST(g.ChildProductId AS INT) AS ChildProductId, cp.Number AS ChildProductCode, cp.Name AS ChildProductTitle, cp.MeasureUnitTitle AS ChildUnitTitle,
         CAST(g.ChildWorkOrderId AS INT) AS ChildWorkOrderId, cw.Number AS ChildWorkOrderNumber, g.Quantity, g.IsQuantityEstimated, g.RelationTypeCode, g.Description
  FROM mes.ProductionBatchGenealogy g
  JOIN mes.Product pp ON pp.Id = g.ParentProductId
  JOIN mes.Product cp ON cp.Id = g.ChildProductId
  LEFT JOIN mes.WorkOrder pw ON pw.Id = g.ParentWorkOrderId
  LEFT JOIN mes.WorkOrder cw ON cw.Id = g.ChildWorkOrderId
  WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0
  ORDER BY g.ParentBatchNumber, cp.Number;

  SELECT w.Number AS WorkOrderNumber, w.BatchNumber, o.Sequence AS OperationSequence, p.Number + N' — ' + p.Name AS ProductTitle, COUNT(*) AS Rows,
         SUM(c.ConsumedQuantity) AS Quantity, p.MeasureUnitTitle AS UnitTitle
  FROM mes.WorkOrderOperationMaterialConsumed c
  JOIN mes.WorkOrderOperationMaterial m ON m.Id = c.WOOperationMaterialId
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.Product p ON p.Id = m.ProductId
  WHERE c.CompanyId = @CompanyId AND c.IsDeleted = 0 AND c.IsReversal = 0 AND NULLIF(LTRIM(c.BatchNumber), N'') IS NULL
  GROUP BY w.Number, w.BatchNumber, o.Sequence, p.Number, p.Name, p.MeasureUnitTitle
  ORDER BY w.Number, o.Sequence;
END
GO

/* الگوهای برچسب با اجزا (پارامترها به فیلدهای ثابت سمت سرور نگاشت می‌شوند) */
CREATE OR ALTER PROCEDURE mes.GetLabelTemplates
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(t.Id AS INT) AS TemplateId, t.Number, t.Name, t.ValidFromDate, t.ValidToDate, t.LevelCode, t.WidthMm, t.HeightMm, t.ProductGroupTitle,
         CAST(t.ProductId AS INT) AS ProductId, t.Description
  FROM mes.ProductLabelTemplate t WHERE t.CompanyId = @CompanyId AND t.IsDeleted = 0 ORDER BY t.LevelCode, t.Number;

  SELECT CAST(d.Id AS INT) AS DetailId, CAST(d.TemplateId AS INT) AS TemplateId, CAST(d.ParameterId AS INT) AS ParameterId, pr.Number AS ParameterCode,
         pr.Name AS ParameterTitle, pr.SourceField, d.ValueDescription, d.ElementTypeCode, d.PosXMm, d.PosYMm, d.WidthMm, d.HeightMm, d.FontSizePt, d.IsBold, d.SortOrder
  FROM mes.ProductLabelTemplateDetail d
  LEFT JOIN mes.ProductLabelTemplateParameter pr ON pr.Id = d.ParameterId
  WHERE d.CompanyId = @CompanyId AND d.IsDeleted = 0 ORDER BY d.TemplateId, d.SortOrder;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.ProductionBatch خالی است.
   عمداً خراب: رسید دوم WO-0507 ۶ کیلو بیش از گزارش؛ ریزدانه‌ی جانبی WO-0500 رسید نخورده؛ دروازه‌ی QC عملیات ۵۰ دستور WO-0498
   مقدار عیار ندارد؛ مصرف‌های WO-0498 و بخشی از WO-0506 شماره‌ی بچ ندارند (شکاف شجره)؛ مصرف گرانول WO-0501 از دو بچ
   در یک ردیف ثبت شده و سهم هر بچ تخمینی است؛ شماره‌ی بچ B-1405-0949 با ابطال WO-0513 سوخته است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductionBatch)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222, @now DATETIME2 = mes.fnShopNow();

  /* ۱) الگوی شماره‌ی بچ خط */
  INSERT mes.ProductionLineBatchNumber (CompanyId, ProductionLineId, ValidFromDate, ValidToDate, FirstNumber, LastNumber, TotalLength, StatusCode, ProductGroupTitle, LastUsedNumber, Description)
  VALUES (@C, 2, '2026-03-21', '2027-03-20', N'B-1405-0001', N'B-1405-9999', 11, 1, N'محصولات جامد خوراکی', N'B-1405-0958', N'بچ محصول نهایی خط ۲ — سالانه از نو'),
         (@C, 2, '2026-03-21', '2027-03-20', N'GRN-1405-001', N'GRN-1405-999', 12, 1, N'نیمه‌ساخته', N'GRN-1405-124', N'بچ گرانول — سالانه از نو'),
         (@C, 2, '2026-09-23', '2026-10-22', N'GRC-1405-0701M', N'GRC-1405-0730N', 14, 1, N'نیمه‌ساخته (پیوسته)', N'GRC-1405-0717N', N'دستور شیفتی گرانول پیوسته: روز و شیفت');

  INSERT mes.ProductionLineBatchNumberSetting (CompanyId, ProductionLineBatchNumberId, OrderNumber, ProductionLineBatchNumberItemTypeCode, IsRenewalFactor, NumberItemLength, NumberItemValue)
  SELECT @C, n.Id, v.Ord, v.TypeCode, v.Renew, v.Len, v.Val
  FROM mes.ProductionLineBatchNumber n
  JOIN (VALUES (N'B-1405-0001', 1, 1, 0, 2, N'B-'), (N'B-1405-0001', 2, 2, 1, 4, NULL), (N'B-1405-0001', 3, 1, 0, 1, N'-'), (N'B-1405-0001', 4, 5, 0, 4, NULL),
               (N'GRN-1405-001', 1, 1, 0, 4, N'GRN-'), (N'GRN-1405-001', 2, 2, 1, 4, NULL), (N'GRN-1405-001', 3, 1, 0, 1, N'-'), (N'GRN-1405-001', 4, 5, 0, 3, NULL),
               (N'GRC-1405-0701M', 1, 1, 0, 4, N'GRC-'), (N'GRC-1405-0701M', 2, 2, 0, 4, NULL), (N'GRC-1405-0701M', 3, 1, 0, 1, N'-'), (N'GRC-1405-0701M', 4, 3, 1, 2, NULL),
               (N'GRC-1405-0701M', 5, 5, 0, 2, NULL), (N'GRC-1405-0701M', 6, 1, 0, 1, N'M/E/N')) v(First, Ord, TypeCode, Renew, Len, Val)
    ON v.First = n.FirstNumber
  WHERE n.CompanyId = @C;

  /* ۲) بچ هر دستور */
  INSERT mes.ProductionBatch (CompanyId, BatchNumber, ProductId, WorkOrderId, ProductionLineId, ProductionLineBatchNumberId, ManufactureDate, ExpireDate,
                              PlannedQuantity, ReleasedQuantity, StatusCode, IsCustomerOwned, OwnerTitle, Description)
  SELECT @C, w.BatchNumber, w.MainProductId, w.Id, w.ProductionLineId,
         (SELECT TOP (1) n.Id FROM mes.ProductionLineBatchNumber n WHERE n.ProductionLineId = w.ProductionLineId AND LEFT(w.BatchNumber, 3) = LEFT(n.FirstNumber, 3)),
         CAST(ISNULL(fs.FirstStart, w.PlannedReleaseDate) AS DATE),
         CASE WHEN p.ProductGroupTitle = N'نیمه‌ساخته' THEN DATEADD(DAY, 30, CAST(ISNULL(fs.FirstStart, w.PlannedReleaseDate) AS DATE))
              ELSE DATEADD(MONTH, 36, CAST(ISNULL(fs.FirstStart, w.PlannedReleaseDate) AS DATE)) END,
         w.Quantity,
         CASE w.Number WHEN N'WO-1405-0498' THEN 288600 WHEN N'WO-1405-0500' THEN 120 WHEN N'WO-1405-0499' THEN 49.5 END,
         CASE w.Number WHEN N'WO-1405-0498' THEN 5 WHEN N'WO-1405-0500' THEN 4 WHEN N'WO-1405-0499' THEN 4 WHEN N'WO-1405-0513' THEN 7
                       WHEN N'WO-1405-0510' THEN 6
                       ELSE CASE WHEN w.WorkOrderStatusCode IN (3, 4) THEN 2 ELSE 1 END END,
         CASE WHEN w.WOTypeCode = 6 THEN 1 ELSE 0 END, CASE WHEN w.WOTypeCode = 6 THEN w.CustomerTitle END,
         CASE w.Number WHEN N'WO-1405-0498' THEN N'۱۱٬۴۰۰ قرص رد QC و به دوباره‌کاری (WO-0510) رفت'
                       WHEN N'WO-1405-0510' THEN N'همان بچ اصلی؛ ۱۱٬۴۰۰ قرص قرنطینه در دوباره‌کاری'
                       WHEN N'WO-1405-0513' THEN N'شماره‌ی بچ با ابطال دستور سوخت — دوباره تخصیص داده نمی‌شود' END
  FROM mes.WorkOrder w
  JOIN mes.Product p ON p.Id = w.MainProductId
  OUTER APPLY (SELECT MIN(o.StartTime) AS FirstStart FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) fs
  WHERE w.CompanyId = @C AND w.IsDeleted = 0 AND w.BatchNumber IS NOT NULL AND w.Number <> N'WO-1405-0510';

  /* ۳) مقدار ویژگی‌ها: برای عملیات تکمیل‌شده ثبت شده؛ عملیات در جریان هنوز نه. دروازه‌ی QC عیار WO-0498 عمداً خالی */
  INSERT mes.ProductionBatchAttributeValue (CompanyId, ProductionBatchId, ProductionAttributeId, WOOperationId, ValueNumber, ValueText, RecordedAt, RecordedByTitle, SourceCode)
  SELECT @C, b.Id, ra.ProductionAttributeId, o.Id,
         CASE ra.ProductionAttributeId WHEN 1 THEN 99.2 + (o.Id % 7) * 0.1 WHEN 3 THEN 1.8 + (o.Id % 5) * 0.1 WHEN 4 THEN 72 WHEN 5 THEN 41 + (o.Id % 4) * 0.5 END,
         CASE ra.ProductionAttributeId WHEN 6 THEN N'زیر ۲۵ درجه، دور از نور و رطوبت' END,
         DATEADD(MINUTE, -10, o.EndTime), CASE WHEN ra.IsQcGate = 1 THEN N'آزمایشگاه QC' ELSE N'اپراتور عملیات' END, CASE WHEN ra.IsQcGate = 1 THEN 2 ELSE 1 END
  FROM mes.ProductionBatch b
  JOIN mes.WorkOrder w ON w.Id = b.WorkOrderId
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode = 5
  JOIN mes.RoutingOperationBatchAttribute ra ON ra.RoutingOperationId = o.RoutingOperationId AND ra.IsDeleted = 0
  WHERE b.CompanyId = @C AND NOT (ra.ProductionAttributeId = 3 AND ra.IsQcGate = 1)
    AND NOT (w.Number = N'WO-1405-0498' AND o.Sequence = 50 AND ra.ProductionAttributeId = 1);

  /* ۴) رسید محصول */
  DECLARE @r TABLE (WoNo NVARCHAR(32), Seq INT, Part INT, ProductId BIGINT, OutputType INT, Qty DECIMAL(32,6), Approved DECIMAL(32,6), Rejected DECIMAL(32,6), Route INT,
                    Policy INT, Inv NVARCHAR(256), Qc INT, Share DECIMAL(9,4), Rate DECIMAL(32,4), Batch NVARCHAR(64), RcptNo NVARCHAR(64), AtMin INT, Note NVARCHAR(400));
  INSERT @r VALUES
    (N'WO-1405-0498', 70, 1, 1001, 1, 150000, 150000, 0, NULL, 3, N'انبار محصول', 2, NULL, NULL, N'B-1405-0941', N'RC-1405-2210', -8460, N'رسید اول؛ آزاد پس از گواهی آنالیز'),
    (N'WO-1405-0498', 70, 2, 1001, 1, 138600, 138600, 11400, 2, 3, N'انبار محصول', 4, NULL, NULL, N'B-1405-0941', N'RC-1405-2231', -7020, N'۱۱٬۴۰۰ قرص لکه‌دار رد و به دوباره‌کاری'),
    (N'WO-1405-0498', 70, 1, 2007, 4, 1.44, NULL, NULL, NULL, 1, N'انبار ضایعات قابل بازیافت', NULL, NULL, 185000, N'B-1405-0941-BR', N'RC-1405-2232', -7015, N'قرص شکسته برای آسیاب مجدد؛ ارزش مستقل'),
    (N'WO-1405-0499', 10, 1, 2003, 1, 49.5, 49.5, 0, NULL, 2, N'انبار میانی نیمه‌ساخته', 2, NULL, NULL, N'SOL-1405-044', N'RC-1405-2290', -2140, N'با مجوز ورود سرپرست؛ بعد به پیمانکار روکش رفت'),
    (N'WO-1405-0500', 30, 1, 2001, 1, 120, 120, 0, NULL, 2, N'انبار میانی نیمه‌ساخته', 2, 97.0, NULL, N'GRN-1405-121', N'RC-1405-2285', -2810, N'گرانول اصلی — ۹۷٪ هزینه'),
    (N'WO-1405-0500', 30, 1, 2006, 2, 1.8, 1.8, 0, NULL, 2, N'انبار میانی نیمه‌ساخته', 2, 3.0, NULL, N'GRN-1405-121-C', N'RC-1405-2286', -2805, N'گرانول درشت هم‌زاد — ۳٪ هزینه'),
    (N'WO-1405-0501', 60, 1, 1001, 1, 52500, NULL, NULL, NULL, 4, N'انبار قرنطینه‌ی محصول', 1, NULL, NULL, N'B-1405-0952', N'RC-1405-2302', -85, N'رسید جزئی اول — منتظر نتیجه‌ی آزمون'),
    (N'WO-1405-0501', 60, 2, 1001, 1, 60000, NULL, NULL, NULL, 4, N'انبار قرنطینه‌ی محصول', 1, NULL, NULL, N'B-1405-0952', N'RC-1405-2307', -25, N'رسید جزئی دوم'),
    (N'WO-1405-0507', 20, 1, 2001, 1, 213.5, 213.5, 0, NULL, 1, N'انبار پای کار گرانول — خط ۲', 2, NULL, NULL, N'GRC-1405-0717M', N'RC-1405-2298', -210, N'رسید مستقیم پیوسته'),
    (N'WO-1405-0507', 20, 2, 2001, 1, 250, 250, 0, NULL, 1, N'انبار پای کار گرانول — خط ۲', 2, NULL, NULL, N'GRC-1405-0717M', N'RC-1405-2305', -75, N'وزن ترازوی مخزن؛ گزارش ۲۴۴ کیلو');

  INSERT mes.WorkOrderOperationOutputProduct (CompanyId, OperationOutputId, FinalProductId, BatchId, CompletedQuantity, IsDeliveredToInventory, RemainedToInvQuantity,
         ReceivedToInvQuantity, MeasureUnitId, WorkOrderOperationOutputProductStatusCode, Description, ReceiptNumber, ReceiptDate, OutputTypeCode, ReceiptPolicyCode,
         InventoryTitle, BatchNumber, QcStatusCode, QcApprovedQuantity, QcRejectedQuantity, RejectedRouteCode, CostSharePercent, ValuationRate, IsCustomerOwned, DocumentNumber)
  SELECT @C, x.Id, r.ProductId, b.Id, r.Qty + ISNULL(r.Rejected, 0), 1, 0, r.Qty, NULL, 3, r.Note, r.RcptNo, DATEADD(MINUTE, r.AtMin, @now), r.OutputType, r.Policy,
         r.Inv, r.Batch, r.Qc, r.Approved, r.Rejected, r.Route, r.Share, r.Rate, 0, N'IN-' + SUBSTRING(r.RcptNo, 4, 20)
  FROM @r r
  JOIN mes.WorkOrder w ON w.Number = r.WoNo AND w.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = r.Seq
  CROSS APPLY (SELECT x.Id, ROW_NUMBER() OVER (ORDER BY x.EndTime, x.Id) AS Part FROM mes.WorkOrderOperationOutput x WHERE x.WOOperationId = o.Id AND x.IsDeleted = 0) x
  LEFT JOIN mes.ProductionBatch b ON b.WorkOrderId = w.Id AND b.ProductId = r.ProductId
  WHERE x.Part = CASE WHEN o.WorkOrderOperationStatusCode = 5 THEN 1 ELSE r.Part END;

  /* موجودی حاصل از رسیدهای جدید (WO-0501 قرنطینه، WO-0507 پای کار) */
  IF NOT EXISTS (SELECT 1 FROM mes.MaterialStock WHERE BatchNumber = N'B-1405-0952')
    INSERT mes.MaterialStock (CompanyId, ProductId, InventoryKindCode, InventoryTitle, BatchNumber, ManufactureDate, ExpireDate, OnHandQuantity, ReservedQuantity, QcStatusCode, IsCustomerOwned)
    VALUES (@C, 1001, 3, N'قرنطینه‌ی محصول', N'B-1405-0952', '2026-10-08', '2029-10-08', 112500, 0, 2, 0),
           (@C, 2001, 2, N'انبار پای کار گرانول — خط ۲', N'GRC-1405-0717M', '2026-10-09', '2026-11-08', 463.5, 0, 1, 0);

  /* ۵) الگو و سریال: کارتن (سطح ۲) و شیپر (سطح ۳) */
  INSERT mes.ProductSerialPattern (CompanyId, Number, Name, PatternText, LevelCode, CounterLength, ChildrenPerParent, Description)
  VALUES (@C, N'SP-CTN', N'سریال کارتن (کد رهگیری)', N'{BATCH}-C{SEQ}', 2, 5, NULL, N'تخصیص در عملیات بسته‌بندی ثانویه'),
         (@C, N'SP-SHP', N'سریال شیپر (تجمیع)', N'{BATCH}-P{SEQ}', 3, 3, 100, N'هر شیپر ۱۰۰ کارتن؛ تجمیع در عملیات کارتن‌گذاری');

  DECLARE @ctn BIGINT = (SELECT Id FROM mes.ProductSerialPattern WHERE Number = N'SP-CTN' AND CompanyId = @C),
          @shp BIGINT = (SELECT Id FROM mes.ProductSerialPattern WHERE Number = N'SP-SHP' AND CompanyId = @C),
          @w498 BIGINT = (SELECT Id FROM mes.WorkOrder WHERE Number = N'WO-1405-0498' AND CompanyId = @C),
          @w501 BIGINT = (SELECT Id FROM mes.WorkOrder WHERE Number = N'WO-1405-0501' AND CompanyId = @C);
  DECLARE @op498_60 BIGINT = (SELECT Id FROM mes.WorkOrderOperation WHERE WorkOrderId = @w498 AND Sequence = 60),
          @op498_70 BIGINT = (SELECT Id FROM mes.WorkOrderOperation WHERE WorkOrderId = @w498 AND Sequence = 70),
          @op501_60 BIGINT = (SELECT Id FROM mes.WorkOrderOperation WHERE WorkOrderId = @w501 AND Sequence = 60);

  UPDATE mes.WorkOrder SET ProductSerialPatternId = @ctn, FirstCounterDigit = 1, LastCounterDigit = 9620 WHERE Id = @w498 AND ProductSerialPatternId IS NULL;
  UPDATE mes.WorkOrder SET ProductSerialPatternId = @ctn, FirstCounterDigit = 1, LastCounterDigit = 20000 WHERE Id = @w501 AND ProductSerialPatternId IS NULL;

  ;WITH n AS (SELECT TOP (9620) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS k FROM sys.all_objects a CROSS JOIN sys.all_objects b)
  INSERT mes.ProductSerial (CompanyId, Name, ProductId, WorkOrderId, ProductSerialStatusCode, BatchNumber, LevelCode, WOOperationId, SerialPatternId, AssignedAt)
  SELECT @C, N'B-1405-0941-P' + RIGHT(N'000' + CAST(k AS NVARCHAR(10)), 3), 1001, @w498, CASE WHEN k <= 60 THEN 4 ELSE 3 END, N'B-1405-0941', 3, @op498_70, @shp,
         DATEADD(MINUTE, -8460 + k, @now)
  FROM n WHERE k <= 97;

  ;WITH n AS (SELECT TOP (9620) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS k FROM sys.all_objects a CROSS JOIN sys.all_objects b)
  INSERT mes.ProductSerial (CompanyId, Name, ProductId, WorkOrderId, ParentSerialId, ProductSerialStatusCode, BatchNumber, LevelCode, WOOperationId, SerialPatternId, AssignedAt)
  SELECT @C, N'B-1405-0941-C' + RIGHT(N'00000' + CAST(k AS NVARCHAR(10)), 5), 1001, @w498, par.Id, CASE WHEN (k - 1) / 100 + 1 <= 60 THEN 4 ELSE 3 END,
         N'B-1405-0941', 2, @op498_60, @ctn, DATEADD(MILLISECOND, k * 560, DATEADD(MINUTE, -8700, @now))
  FROM n
  JOIN mes.ProductSerial par ON par.WorkOrderId = @w498 AND par.LevelCode = 3 AND par.Name = N'B-1405-0941-P' + RIGHT(N'000' + CAST((k - 1) / 100 + 1 AS NVARCHAR(10)), 3);

  ;WITH n AS (SELECT TOP (5100) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS k FROM sys.all_objects a CROSS JOIN sys.all_objects b)
  INSERT mes.ProductSerial (CompanyId, Name, ProductId, WorkOrderId, ProductSerialStatusCode, BatchNumber, LevelCode, WOOperationId, SerialPatternId, AssignedAt, Description)
  SELECT @C, N'B-1405-0952-C' + RIGHT(N'00000' + CAST(k AS NVARCHAR(10)), 5), 1001, @w501,
         CASE WHEN k <= 5000 THEN 2 WHEN k <= 5006 THEN 5 ELSE 1 END, N'B-1405-0952', 2, CASE WHEN k <= 5006 THEN @op501_60 END, @ctn,
         CASE WHEN k <= 5006 THEN DATEADD(MILLISECOND, k * 1790, CAST('2026-10-09 09:00' AS DATETIME2)) END,
         CASE WHEN k BETWEEN 5001 AND 5006 THEN N'کارتن معیوب در دستگاه — سریال باطل' END
  FROM n;

  /* ۶) شجره: از ردیف‌های مصرف؛ ردیف چندبچه‌ای سهم تخمینی مساوی می‌گیرد */
  INSERT mes.ProductionBatchGenealogy (CompanyId, ParentBatchNumber, ParentProductId, ParentWorkOrderId, ChildBatchNumber, ChildProductId, ChildWorkOrderId,
                                       WOOperationId, Quantity, IsQuantityEstimated, RelationTypeCode, SourceConsumedId, Description)
  SELECT @C, w.BatchNumber, w.MainProductId, w.Id, LTRIM(RTRIM(sp.value)), m.ProductId,
         (SELECT TOP (1) cw.Id FROM mes.WorkOrder cw WHERE cw.BatchNumber = LTRIM(RTRIM(sp.value)) AND cw.MainProductId = m.ProductId AND cw.IsDeleted = 0),
         o.Id, CAST(c.ConsumedQuantity / k.Cnt AS DECIMAL(32,6)), CASE WHEN k.Cnt > 1 THEN 1 ELSE 0 END,
         CASE WHEN c.IsRecoveredMaterial = 1 THEN 5 ELSE 1 END, c.Id,
         CASE WHEN k.Cnt > 1 THEN N'مصرف چند بچه در یک ردیف — سهم تخمینی' END
  FROM mes.WorkOrderOperationMaterialConsumed c
  JOIN mes.WorkOrderOperationMaterial m ON m.Id = c.WOOperationMaterialId
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  CROSS APPLY (SELECT COUNT(*) AS Cnt FROM STRING_SPLIT(c.BatchNumber, N'،')) k
  CROSS APPLY STRING_SPLIT(c.BatchNumber, N'،') sp
  WHERE c.CompanyId = @C AND c.IsDeleted = 0 AND c.IsReversal = 0 AND NULLIF(LTRIM(c.BatchNumber), N'') IS NOT NULL AND w.BatchNumber IS NOT NULL;

  /* تجمیع ردیف‌های تکراری هم‌بچه (چند گزارش) */
  ;WITH d AS (SELECT Id, ROW_NUMBER() OVER (PARTITION BY ParentBatchNumber, ParentProductId, ChildBatchNumber, ChildProductId, WOOperationId ORDER BY Id) AS rn,
                     SUM(Quantity) OVER (PARTITION BY ParentBatchNumber, ParentProductId, ChildBatchNumber, ChildProductId, WOOperationId) AS Tot,
                     MAX(CAST(IsQuantityEstimated AS INT)) OVER (PARTITION BY ParentBatchNumber, ParentProductId, ChildBatchNumber, ChildProductId, WOOperationId) AS Est
              FROM mes.ProductionBatchGenealogy WHERE CompanyId = @C)
  UPDATE g SET g.Quantity = d.Tot, g.IsQuantityEstimated = d.Est, g.SourceConsumedId = NULL
  FROM mes.ProductionBatchGenealogy g JOIN d ON d.Id = g.Id WHERE d.rn = 1;
  ;WITH d AS (SELECT Id, ROW_NUMBER() OVER (PARTITION BY ParentBatchNumber, ParentProductId, ChildBatchNumber, ChildProductId, WOOperationId ORDER BY Id) AS rn
              FROM mes.ProductionBatchGenealogy WHERE CompanyId = @C)
  DELETE g FROM mes.ProductionBatchGenealogy g JOIN d ON d.Id = g.Id WHERE d.rn > 1;
  UPDATE mes.ProductionBatchGenealogy SET Description = N'مصرف چند بچه در یک ردیف — سهم تخمینی' WHERE CompanyId = @C AND IsQuantityEstimated = 1;

  /* محلول روکش در قرص روکش‌دار (نزد پیمانکار) و پیوندهای دوباره‌کاری/بازیافت با دستور مبدا */
  INSERT mes.ProductionBatchGenealogy (CompanyId, ParentBatchNumber, ParentProductId, ParentWorkOrderId, ChildBatchNumber, ChildProductId, ChildWorkOrderId, WOOperationId, Quantity, RelationTypeCode, Description)
  SELECT @C, N'B-1405-0939', 1002, w3.Id, N'SOL-1405-044', 2003, w9.Id, (SELECT Id FROM mes.WorkOrderOperation WHERE WorkOrderId = w3.Id AND Sequence = 10), 32, 1, N'کیت ارسالی به پیمانکار روکش — مصرف هنوز اعلام نشده'
  FROM mes.WorkOrder w3, mes.WorkOrder w9 WHERE w3.Number = N'WO-1405-0503' AND w9.Number = N'WO-1405-0499'
  UNION ALL
  SELECT @C, N'B-1405-0941-R', 1001, w10.Id, N'B-1405-0941', 1001, w1.Id, NULL, 11400, 2, N'دوباره‌کاری قرص‌های لکه‌دار دستور مبدا'
  FROM mes.WorkOrder w10, mes.WorkOrder w1 WHERE w10.Number = N'WO-1405-0510' AND w1.Number = N'WO-1405-0498'
  UNION ALL
  SELECT @C, N'RGR-1405-006', 2001, w11.Id, N'B-1405-0952', 1001, w2.Id, NULL, 2.9, 3, N'قرص شکسته‌ی پرس به گرانول بازیافتی'
  FROM mes.WorkOrder w11, mes.WorkOrder w2 WHERE w11.Number = N'WO-1405-0511' AND w2.Number = N'WO-1405-0501';

  /* ۷) برچسب */
  INSERT mes.ProductLabelTemplateParameter (CompanyId, Number, Name, ValidFromDate, SourceField)
  VALUES (@C, N'LP-PRD', N'نام محصول', '2026-01-01', N'productName'), (@C, N'LP-CODE', N'کد کالا', '2026-01-01', N'productCode'),
         (@C, N'LP-BATCH', N'شماره‌ی بچ', '2026-01-01', N'batch'), (@C, N'LP-MFG', N'تاریخ ساخت', '2026-01-01', N'mfgDate'),
         (@C, N'LP-EXP', N'تاریخ انقضا', '2026-01-01', N'expDate'), (@C, N'LP-QTY', N'مقدار', '2026-01-01', N'quantity'),
         (@C, N'LP-SER', N'سریال', '2026-01-01', N'serial'), (@C, N'LP-STOR', N'شرایط نگهداری', '2026-01-01', N'storage'),
         (@C, N'LP-WO', N'دستور کار', '2026-01-01', N'workOrder'), (@C, N'LP-QC', N'وضعیت QC', '2026-01-01', N'qcStatus'),
         (@C, N'LP-OWN', N'مالک', '2026-01-01', N'owner');

  INSERT mes.ProductLabelTemplate (CompanyId, Number, Name, ValidFromDate, ValidToDate, LevelCode, WidthMm, HeightMm, ProductGroupTitle, Description)
  VALUES (@C, N'LBL-CTN', N'برچسب کارتن محصول', '2026-01-01', NULL, 2, 70, 40, N'محصولات جامد خوراکی', N'بارکد سریال کارتن'),
         (@C, N'LBL-SHP', N'برچسب شیپر', '2026-01-01', NULL, 3, 100, 70, N'محصولات جامد خوراکی', N'بارکد سریال شیپر + بچ'),
         (@C, N'LBL-DRM', N'برچسب ظرف نیمه‌ساخته', '2026-01-01', NULL, 4, 100, 60, N'نیمه‌ساخته', N'وضعیت QC درشت روی برچسب');

  INSERT mes.ProductLabelTemplateDetail (CompanyId, TemplateId, ParameterId, ValueDescription, ElementTypeCode, PosXMm, PosYMm, WidthMm, HeightMm, FontSizePt, IsBold, SortOrder)
  SELECT @C, t.Id, pr.Id, v.Caption, v.El, v.X, v.Y, v.W, v.H, v.F, v.B, v.S
  FROM (VALUES
    (N'LBL-CTN', N'LP-PRD', NULL, 1, 3, 4, 64, 6, 9, 1, 1), (N'LBL-CTN', N'LP-BATCH', N'بچ', 1, 3, 12, 30, 5, 7, 0, 2),
    (N'LBL-CTN', N'LP-EXP', N'انقضا', 1, 36, 12, 31, 5, 7, 0, 3), (N'LBL-CTN', N'LP-SER', NULL, 2, 3, 19, 64, 13, NULL, 0, 4),
    (N'LBL-CTN', N'LP-SER', NULL, 1, 3, 33, 64, 4, 6, 0, 5),
    (N'LBL-SHP', N'LP-PRD', NULL, 1, 4, 5, 92, 7, 12, 1, 1), (N'LBL-SHP', N'LP-CODE', N'کد', 1, 4, 14, 44, 6, 8, 0, 2),
    (N'LBL-SHP', N'LP-QTY', N'تعداد', 1, 52, 14, 44, 6, 8, 0, 3), (N'LBL-SHP', N'LP-BATCH', N'بچ', 1, 4, 22, 44, 6, 9, 1, 4),
    (N'LBL-SHP', N'LP-MFG', N'ساخت', 1, 52, 22, 21, 6, 8, 0, 5), (N'LBL-SHP', N'LP-EXP', N'انقضا', 1, 75, 22, 21, 6, 8, 0, 6),
    (N'LBL-SHP', N'LP-SER', NULL, 2, 4, 32, 92, 22, NULL, 0, 7), (N'LBL-SHP', N'LP-SER', NULL, 1, 4, 56, 92, 5, 8, 0, 8),
    (N'LBL-SHP', N'LP-STOR', NULL, 1, 4, 63, 92, 5, 7, 0, 9),
    (N'LBL-DRM', N'LP-PRD', NULL, 1, 4, 5, 60, 7, 12, 1, 1), (N'LBL-DRM', N'LP-QC', NULL, 3, 68, 4, 28, 14, 14, 1, 2),
    (N'LBL-DRM', N'LP-BATCH', N'بچ', 1, 4, 15, 60, 6, 10, 1, 3), (N'LBL-DRM', N'LP-WO', N'دستور', 1, 4, 23, 46, 5, 8, 0, 4),
    (N'LBL-DRM', N'LP-QTY', N'وزن خالص', 1, 52, 23, 44, 5, 8, 0, 5), (N'LBL-DRM', N'LP-EXP', N'مهلت مصرف', 1, 4, 30, 46, 5, 8, 0, 6),
    (N'LBL-DRM', N'LP-BATCH', NULL, 2, 4, 38, 92, 16, NULL, 0, 7), (N'LBL-DRM', N'LP-OWN', N'مالک', 1, 52, 30, 44, 5, 8, 0, 8)
  ) v(Tpl, Par, Caption, El, X, Y, W, H, F, B, S)
  JOIN mes.ProductLabelTemplate t ON t.Number = v.Tpl AND t.CompanyId = @C
  JOIN mes.ProductLabelTemplateParameter pr ON pr.Number = v.Par AND pr.CompanyId = @C;

  COMMIT;
END
GO
