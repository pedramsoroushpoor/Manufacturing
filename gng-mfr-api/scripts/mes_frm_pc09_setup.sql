/* =====================================================================
   اسکیمای mes — گام ۳۹: FRM-PC-09 «ضایعات، دوباره‌کاری و بازیافت»

   پیش‌نیاز: mes_frm_pc08، علل ضایعات و دوباره‌کاری (RM)، ماده‌ی بازیابی‌شده (PE-05)، دستورهای دوباره‌کاری/بازیافت (PC-02).

   جدول‌های قدیم: mes.WorkOrder (RefWorkOrderId = ارتباط صریح دستور دوباره‌کاری/بازیافت با مبدا، F-PC-072، 073)،
                  mes.WorkOrderOperationOutput (IsReprocess، ReworkQuantity، ReworkCompletedQuantity، ReworkWastedQuantity — گزارش
                  دوباره‌کاری با همان فیلدهای گزارش تولید، F-PC-075)، mes.WorkOrderOperationOutputWaste و Repair.
   جدول جدید:
     mes.NonconformingDisposition  تعیین تکلیف هر خروجی نامنطبق (F-PC-069): نوع (اسقاط/بازیافت/دوباره‌کاری/درجه‌دو)، منشأ
                                   (گزارش، QC، پیمانکار، گزارش دوباره‌کاری)، دستور مقصد، درجه‌بندی مجدد (076)، تکلیف ضایعات
                                   پیمانکار و جریمه (077)، شماره‌ی چرخه‌ی دوباره‌کاری (078) و هزینه برای COPQ (079)
   زنجیره‌ی دوباره‌کاری و هشدار سقف زنده در mes.GetReworkChains؛ COPQ زنده در mes.GetCopq.

   فرض‌ها و کدهای موقت:
     NonconformityTypeCode      1 اسقاط، 2 قابل بازیافت، 3 قابل دوباره‌کاری، 4 درجه‌دو
     SourceTypeCode             1 گزارش تولید، 2 رد QC در رسید، 3 اعلام پیمانکار، 4 گزارش دوباره‌کاری
     DecisionStatusCode         1 در انتظار تصمیم، 2 تصمیم گرفته شده، 3 اجراشده
     ContractorDispositionCode  1 بازگشت به ما، 2 جریمه، 3 پذیرش در حد مجاز
     هزینه‌ها ریال؛ بهای واحد موقت روی همین ردیف تا اتصال به بهای تمام‌شده (PF-71).
     سقف دوباره‌کاری یک بچ پارامتر روال است (پیش‌فرض ۱) تا جایش در سیاست‌ها تعیین شود.

   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.NonconformingDisposition','U') IS NULL
CREATE TABLE mes.NonconformingDisposition (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_NonconformingDisposition PRIMARY KEY,
  Number NVARCHAR(32) NOT NULL,
  SourceTypeCode INT NOT NULL,
  WorkOrderId BIGINT NOT NULL,
  WOOperationId BIGINT NULL,
  OperationOutputId BIGINT NULL,
  OutputWasteId BIGINT NULL,
  OutputRepairId BIGINT NULL,
  ReceiptId BIGINT NULL,
  ContractorId BIGINT NULL,
  ProductId BIGINT NOT NULL,
  BatchNumber NVARCHAR(64) NULL,
  Quantity DECIMAL(32,6) NOT NULL,
  NonconformityTypeCode INT NOT NULL,
  WasteReasonId BIGINT NULL,
  ReworkReasonId BIGINT NULL,
  DecisionStatusCode INT NOT NULL CONSTRAINT DF_mes_NCD_Status DEFAULT (1),
  DecidedByTitle NVARCHAR(128) NULL,
  DecidedAt DATETIME2 NULL,
  TargetWorkOrderId BIGINT NULL,
  RegradeProductId BIGINT NULL,
  ContractorDispositionCode INT NULL,
  PenaltyAmount DECIMAL(32,2) NULL,
  UnitCost DECIMAL(32,4) NULL,
  RecoveredValue DECIMAL(32,2) NULL,
  CostAmount DECIMAL(32,2) NULL,
  ReworkCycle INT NULL,
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

CREATE OR ALTER PROCEDURE mes.GetNonconformingDispositions
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(d.Id AS INT) AS DispositionId, d.Number, d.SourceTypeCode, CAST(d.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WOTypeCode,
         ln.Name AS LineTitle, o.Sequence AS OperationSequence, op.Name AS OperationTitle, x.ReportNumber, x.EndTime AS ReportedAt,
         CAST(d.ProductId AS INT) AS ProductId, p.Number + N' — ' + p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, d.BatchNumber, d.Quantity,
         d.NonconformityTypeCode, wr.Number AS WasteReasonCode, wr.Name AS WasteReasonTitle, rr.Number AS ReworkReasonCode, rr.Name AS ReworkReasonTitle,
         d.DecisionStatusCode, d.DecidedByTitle, d.DecidedAt, CAST(d.TargetWorkOrderId AS INT) AS TargetWorkOrderId, tw.Number AS TargetWorkOrderNumber,
         tw.WorkOrderStatusCode AS TargetStatusCode, rg.Number + N' — ' + rg.Name AS RegradeProductTitle,
         CAST(d.ContractorId AS INT) AS ContractorId, ct.Name AS ContractorTitle, d.ContractorDispositionCode, d.PenaltyAmount,
         d.UnitCost, d.RecoveredValue, d.CostAmount, d.ReworkCycle, d.Description, w.CustomerTitle, CAST(CASE WHEN w.WOTypeCode = 6 THEN 1 ELSE 0 END AS BIT) AS IsCustomerOwned
  FROM mes.NonconformingDisposition d
  JOIN mes.WorkOrder w ON w.Id = d.WorkOrderId
  JOIN mes.Product p ON p.Id = d.ProductId
  LEFT JOIN mes.ProductionLine ln ON ln.Id = w.ProductionLineId
  LEFT JOIN mes.WorkOrderOperation o ON o.Id = d.WOOperationId
  LEFT JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.WorkOrderOperationOutput x ON x.Id = d.OperationOutputId
  LEFT JOIN mes.ProductionWasteReason wr ON wr.Id = d.WasteReasonId
  LEFT JOIN mes.ProductionReworkReason rr ON rr.Id = d.ReworkReasonId
  LEFT JOIN mes.WorkOrder tw ON tw.Id = d.TargetWorkOrderId
  LEFT JOIN mes.Product rg ON rg.Id = d.RegradeProductId
  LEFT JOIN mes.ProductionContractor ct ON ct.Id = d.ContractorId
  WHERE d.CompanyId = @CompanyId AND d.IsDeleted = 0
  ORDER BY d.DecisionStatusCode, x.EndTime DESC, d.Number;
END
GO

/* دستورهای دوباره‌کاری/بازیافت با مبدا: عملیات و اقلام حذف‌شده نسبت به مبدا، گزارش‌های اجرا و شرط بازگشت به فرمول */
CREATE OR ALTER PROCEDURE mes.GetReworkOrders
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number, w.WOTypeCode, w.WorkOrderStatusCode, w.Quantity, w.BatchNumber, p.Number + N' — ' + p.Name AS ProductTitle,
         p.MeasureUnitTitle AS UnitTitle, CAST(w.RefWorkOrderId AS INT) AS SourceWorkOrderId, s.Number AS SourceNumber, s.BatchNumber AS SourceBatchNumber,
         s.WorkOrderStatusCode AS SourceStatusCode, w.Description,
         rm.Number AS RecoveredCode, rm.MinPurityPercent, rm.MaxCycles, rm.RequiresQcApproval,
         (SELECT MAX(si.MaxRecoveredUsePercent) FROM mes.ProductStructureItem si WHERE si.ProductId = rm.SourceProductId AND si.IsDeleted = 0) AS MaxMixPercent
  FROM mes.WorkOrder w
  JOIN mes.Product p ON p.Id = w.MainProductId
  LEFT JOIN mes.WorkOrder s ON s.Id = w.RefWorkOrderId
  LEFT JOIN mes.RecoveredMaterial rm ON w.WOTypeCode = 4 AND rm.ProductId = w.MainProductId AND rm.IsDeleted = 0
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.WOTypeCode IN (3, 4)
  ORDER BY w.Number;

  /* عملیات مبدا در برابر عملیات نگه‌داشته‌شده */
  SELECT CAST(w.Id AS INT) AS WorkOrderId, so.Sequence, op.Name AS OperationTitle,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.WorkOrderOperation k WHERE k.WorkOrderId = w.Id AND k.RoutingOperationId = so.RoutingOperationId AND k.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT) AS IsKept,
         (SELECT TOP (1) k.WorkOrderOperationStatusCode FROM mes.WorkOrderOperation k WHERE k.WorkOrderId = w.Id AND k.RoutingOperationId = so.RoutingOperationId AND k.IsDeleted = 0) AS StatusCode,
         (SELECT COUNT(*) FROM mes.WorkOrderOperationMaterial sm WHERE sm.WOOperationId = so.Id AND sm.IsDeleted = 0) AS SourceMaterialCount,
         (SELECT COUNT(*) FROM mes.WorkOrderOperationMaterial km JOIN mes.WorkOrderOperation k ON k.Id = km.WOOperationId
          WHERE k.WorkOrderId = w.Id AND k.RoutingOperationId = so.RoutingOperationId AND km.IsDeleted = 0) AS KeptMaterialCount
  FROM mes.WorkOrder w
  JOIN mes.WorkOrder s ON s.Id = w.RefWorkOrderId
  JOIN mes.WorkOrderOperation so ON so.WorkOrderId = s.Id AND so.IsDeleted = 0
  JOIN mes.ProductionOperation op ON op.Id = so.OperationId
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.WOTypeCode IN (3, 4)
  ORDER BY w.Number, so.Sequence;

  /* گزارش‌های اجرای دوباره‌کاری/بازیافت */
  SELECT CAST(w.Id AS INT) AS WorkOrderId, o.Sequence, x.ReportNumber, x.StartTime, x.EndTime, x.IsReprocess, x.ReworkQuantity, x.ReworkCompletedQuantity,
         x.ReworkWastedQuantity, x.CompletedQuantity, x.WastedQuantity, x.ReportedByTitle, x.Description
  FROM mes.WorkOrderOperationOutput x
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.CompanyId = @CompanyId AND x.IsDeleted = 0 AND w.WOTypeCode IN (3, 4)
  ORDER BY x.EndTime;
END
GO

/* زنجیره‌ی دوباره‌کاری هر بچ (F-PC-078): چرخه‌های انجام‌شده و پیشنهادی در برابر سقف */
CREATE OR ALTER PROCEDURE mes.GetReworkChains
  @CompanyId BIGINT,
  @MaxReworkCycles INT = 1
AS
BEGIN
  SET NOCOUNT ON;
  SELECT d.BatchNumber, p.Number + N' — ' + p.Name AS ProductTitle, d.ReworkCycle, d.Number AS DispositionNumber, d.Quantity, d.DecisionStatusCode,
         w.Number AS SourceWorkOrderNumber, tw.Number AS TargetWorkOrderNumber, d.DecidedAt, @MaxReworkCycles AS MaxCycles,
         CASE WHEN d.ReworkCycle > @MaxReworkCycles THEN 2 WHEN d.ReworkCycle = @MaxReworkCycles THEN 1 ELSE 0 END AS LimitStatus, d.Description
  FROM mes.NonconformingDisposition d
  JOIN mes.Product p ON p.Id = d.ProductId
  JOIN mes.WorkOrder w ON w.Id = d.WorkOrderId
  LEFT JOIN mes.WorkOrder tw ON tw.Id = d.TargetWorkOrderId
  WHERE d.CompanyId = @CompanyId AND d.IsDeleted = 0 AND d.NonconformityTypeCode = 3 AND d.ReworkCycle IS NOT NULL
  ORDER BY d.BatchNumber, d.ReworkCycle;
END
GO

/* COPQ (F-PC-079): هزینه به تفکیک علت، خط، نوع و دستور */
CREATE OR ALTER PROCEDURE mes.GetCopq
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT ISNULL(ln.Name, N'—') AS LineTitle, d.NonconformityTypeCode, ISNULL(wr.Name, ISNULL(rr.Name, CASE d.SourceTypeCode WHEN 3 THEN N'اعلام پیمانکار' WHEN 2 THEN N'تصمیم QC' ELSE N'—' END)) AS ReasonTitle,
         ISNULL(wr.Number, rr.Number) AS ReasonCode, w.Number AS WorkOrderNumber, CAST(MIN(d.DecidedAt) AS DATE) AS DecidedDate, d.SourceTypeCode,
         COUNT(*) AS Cases, SUM(ISNULL(d.CostAmount, 0)) AS Cost, SUM(ISNULL(d.RecoveredValue, 0)) AS Recovered, SUM(ISNULL(d.PenaltyAmount, 0)) AS Penalty
  FROM mes.NonconformingDisposition d
  JOIN mes.WorkOrder w ON w.Id = d.WorkOrderId
  LEFT JOIN mes.ProductionLine ln ON ln.Id = w.ProductionLineId
  LEFT JOIN mes.ProductionWasteReason wr ON wr.Id = d.WasteReasonId
  LEFT JOIN mes.ProductionReworkReason rr ON rr.Id = d.ReworkReasonId
  WHERE d.CompanyId = @CompanyId AND d.IsDeleted = 0
  GROUP BY ln.Name, d.NonconformityTypeCode, wr.Name, rr.Name, wr.Number, rr.Number, w.Number, d.SourceTypeCode
  ORDER BY Cost DESC;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.NonconformingDisposition خالی است.
   عمداً خراب: ۱۵۰ قرص هنوز لکه‌دار پس از دوباره‌کاری WO-0510 برای دوباره‌کاری دوم پیشنهاد شده (بیش از سقف یک‌بار)؛
   بلیسترهای ناقص WO-0501 بی‌تصمیم مانده‌اند؛ ضایعات قابل بازیافت دستور کارمزدی WO-0506 مال مشتری است و بدون نظر او
   نمی‌شود بازیافتش کرد؛ ضایعات اعلامی پیمانکار روکش ۱٬۷۰۰ قرص بیش از حد مجاز ۰٫۵٪ است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.NonconformingDisposition)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222, @now DATETIME2 = mes.fnShopNow();

  DECLARE @cost TABLE (ProductId BIGINT PRIMARY KEY, UnitCost DECIMAL(32,4));
  INSERT @cost VALUES (1001, 3600), (1002, 4800), (1005, 6200), (2001, 4200000), (2002, 3900), (2003, 1500000), (2007, 185000);

  /* ۱) گزارش دوباره‌کاری WO-0510 (IsReprocess) */
  DECLARE @w510 BIGINT = (SELECT Id FROM mes.WorkOrder WHERE Number = N'WO-1405-0510' AND CompanyId = @C);
  DECLARE @op510 BIGINT = (SELECT Id FROM mes.WorkOrderOperation WHERE WorkOrderId = @w510 AND Sequence = 50);
  UPDATE mes.WorkOrder SET WorkOrderStatusCode = 3, ActualReleaseDate = ISNULL(ActualReleaseDate, DATEADD(MINUTE, -250, @now)) WHERE Id = @w510 AND WorkOrderStatusCode = 2;
  UPDATE mes.WorkOrderOperation SET WorkOrderOperationStatusCode = 3, StartTime = DATEADD(MINUTE, -210, @now), ReceivedQuantity = 11400, WorkCenterId = 12,
         CompletedQuantity = 6050, WastedQuantity = 150, ReworkQuantity = 6200, ReworkCompletedQuantity = 6050, ReworkWastedQuantity = 150, InProcessQuantity = 5200
  WHERE Id = @op510 AND WorkOrderOperationStatusCode IN (1, 2);
  IF NOT EXISTS (SELECT 1 FROM mes.WorkOrderOperationOutput WHERE ReportNumber = N'RP-0510-50-1')
    INSERT mes.WorkOrderOperationOutput (CompanyId, WOOperationId, StartTime, EndTime, Duration, TotalPersonnelQuantity, CompletedQuantity, RemainedToInvQuantity,
           ReceivedToInvQuantity, WastedQuantity, PendingQuantity, ReworkQuantity, ReworkCompletedQuantity, ReworkWastedQuantity, TransferredQuantity,
           WorkOrderOperationOutputStatusCode, Description, IsReprocess, ReportNumber, ReportedByTitle, SourceCode)
    VALUES (@C, @op510, DATEADD(MINUTE, -210, @now), DATEADD(MINUTE, -30, @now), 180, 2, 6050, 6050, 0, 150, 0, 6200, 6050, 150, 6050, 1,
            N'بازرسی چشمی ۱۰۰٪ و جداسازی؛ ۱۵۰ قرص لکه‌ی غیرقابل قبول دارند', 1, N'RP-0510-50-1', N'نرگس صالحی', 1);
  DECLARE @x510 BIGINT = (SELECT Id FROM mes.WorkOrderOperationOutput WHERE ReportNumber = N'RP-0510-50-1');
  IF NOT EXISTS (SELECT 1 FROM mes.WorkOrderOperationOutputWaste WHERE OperationOutputId = @x510)
    INSERT mes.WorkOrderOperationOutputWaste (CompanyId, OperationOutputId, WastedProductId, WastedQuantity, WasteReasonId, ApprovedQuantity, MeasureUnitId,
           WorkOrderOperationOutputWasteStatusCode, Description, WasteTypeCode, IsRejectedWaste, IsSetupWaste)
    VALUES (@C, @x510, 1001, 150, 17, NULL, NULL, 1, N'لکه پس از روکش مجدد باقی ماند', 2, 1, 0);

  /* ۲) هر ردیف ضایعات گزارش ← یک تعیین تکلیف */
  INSERT mes.NonconformingDisposition (CompanyId, Number, SourceTypeCode, WorkOrderId, WOOperationId, OperationOutputId, OutputWasteId, ProductId, BatchNumber, Quantity,
         NonconformityTypeCode, WasteReasonId, DecisionStatusCode, DecidedByTitle, DecidedAt, TargetWorkOrderId, UnitCost, RecoveredValue, CostAmount, ReworkCycle, Description)
  SELECT @C, N'NC-1405-' + RIGHT(N'000' + CAST(400 + ROW_NUMBER() OVER (ORDER BY x.EndTime, ws.Id) AS NVARCHAR(10)), 3),
         CASE WHEN x.IsReprocess = 1 THEN 4 ELSE 1 END, w.Id, o.Id, x.Id, ws.Id, ISNULL(ws.WastedProductId, w.MainProductId), w.BatchNumber, ws.WastedQuantity, k.TypeCode, ws.WasteReasonId,
         k.Status, CASE WHEN k.Status > 1 THEN CASE WHEN ws.IsSetupWaste = 1 THEN N'سیاست: اسقاط خودکار ضایعات راه‌اندازی' ELSE N'سرپرست کنترل کیفیت' END END,
         CASE WHEN k.Status > 1 THEN DATEADD(MINUTE, 40, x.EndTime) END,
         CASE WHEN k.TypeCode = 2 AND w.Number = N'WO-1405-0501' THEN (SELECT Id FROM mes.WorkOrder WHERE Number = N'WO-1405-0511') END,
         c.UnitCost,
         CASE WHEN k.TypeCode = 2 THEN ROUND(ws.WastedQuantity * c.UnitCost * 0.25, 0) END,
         ROUND(ws.WastedQuantity * c.UnitCost * CASE k.TypeCode WHEN 2 THEN 0.75 WHEN 3 THEN 0.25 ELSE 1 END, 0),
         CASE WHEN k.TypeCode = 3 AND x.IsReprocess = 1 THEN 2 WHEN k.TypeCode = 3 THEN 1 END,
         CASE WHEN w.WOTypeCode = 6 AND k.TypeCode = 2 THEN N'قرص شکسته از گرانول امانی فارمد — بازیافت فقط با موافقت مشتری'
              WHEN k.TypeCode = 3 AND x.IsReprocess = 1 THEN N'پیشنهاد دوباره‌کاری دوم همین بچ'
              WHEN k.TypeCode = 3 THEN N'بلیستر ناقص — بازبسته‌بندی یا اسقاط؟' END
  FROM mes.WorkOrderOperationOutputWaste ws
  JOIN mes.WorkOrderOperationOutput x ON x.Id = ws.OperationOutputId
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  LEFT JOIN @cost c ON c.ProductId = ISNULL(ws.WastedProductId, w.MainProductId)
  CROSS APPLY (SELECT CASE WHEN x.IsReprocess = 1 THEN 3 WHEN ws.WasteReasonId = 13 THEN 2 WHEN ws.WasteReasonId = 16 THEN 3 ELSE 1 END AS TypeCode) t
  CROSS APPLY (SELECT t.TypeCode,
                      CASE WHEN w.WorkOrderStatusCode IN (4, 5) THEN 3
                           WHEN x.IsReprocess = 1 THEN 1
                           WHEN t.TypeCode = 1 THEN 2
                           WHEN t.TypeCode = 2 AND w.WOTypeCode = 6 THEN 1
                           WHEN t.TypeCode = 2 THEN 2
                           ELSE 1 END AS Status) k
  WHERE w.CompanyId = @C AND ws.IsDeleted = 0;

  /* ۳) رد QC در رسید WO-0498 ← دوباره‌کاری اول (WO-0510) */
  INSERT mes.NonconformingDisposition (CompanyId, Number, SourceTypeCode, WorkOrderId, WOOperationId, OperationOutputId, OutputRepairId, ReceiptId, ProductId, BatchNumber,
         Quantity, NonconformityTypeCode, ReworkReasonId, DecisionStatusCode, DecidedByTitle, DecidedAt, TargetWorkOrderId, UnitCost, CostAmount, ReworkCycle, Description)
  SELECT @C, N'NC-1405-390', 2, w.Id, o.Id, rp.OperationOutputId, rp.Id, (SELECT TOP (1) Id FROM mes.WorkOrderOperationOutputProduct WHERE ReceiptNumber = N'RC-1405-2231'),
         1001, w.BatchNumber, 11400, 3, 2, 3, N'مدیر تضمین کیفیت', DATEADD(MINUTE, -6900, @now), @w510, 3600, ROUND(11400 * 3600 * 0.25, 0), 1,
         N'لکه‌ی جزئی روکش — روکش مجدد با تأیید QA'
  FROM mes.WorkOrderOperationOutputRepair rp
  JOIN mes.WorkOrderOperationOutput x ON x.Id = rp.OperationOutputId
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.Number = N'WO-1405-0498';
  UPDATE mes.NonconformingDisposition SET ReworkReasonId = 2 WHERE CompanyId = @C AND SourceTypeCode = 4 AND NonconformityTypeCode = 3;

  /* ۴) درجه‌بندی مجدد: ریزدانه‌ی جداشده‌ی الک WO-0500 ← ریزدانه‌ی گرانول */
  INSERT mes.NonconformingDisposition (CompanyId, Number, SourceTypeCode, WorkOrderId, WOOperationId, ProductId, BatchNumber, Quantity, NonconformityTypeCode,
         DecisionStatusCode, DecidedByTitle, DecidedAt, RegradeProductId, UnitCost, RecoveredValue, CostAmount, Description)
  SELECT @C, N'NC-1405-395', 2, w.Id, o.Id, 2001, w.BatchNumber, 2.4, 4, 2, N'سرپرست کنترل کیفیت', DATEADD(MINUTE, 60, o.EndTime), 2005, 4200000,
         ROUND(2.4 * 1300000, 0), ROUND(2.4 * (4200000 - 1300000), 0), N'اندازه‌ی ذره زیر حد — به‌عنوان ریزدانه با ارزش ۱٬۳۰۰٬۰۰۰ ریال/کیلو؛ سند انبار هنوز صادر نشده'
  FROM mes.WorkOrder w JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = 20 WHERE w.Number = N'WO-1405-0500';

  /* ۵) ضایعات اعلامی پیمانکار روکش (WO-0503): مجاز ۰٫۵٪ = ۲٬۵۰۰؛ اعلام ۴٬۲۰۰ + ۱٬۸۰۰ برگشتی برای روکش مجدد */
  INSERT mes.NonconformingDisposition (CompanyId, Number, SourceTypeCode, WorkOrderId, WOOperationId, ContractorId, ProductId, BatchNumber, Quantity, NonconformityTypeCode,
         ReworkReasonId, DecisionStatusCode, DecidedByTitle, DecidedAt, ContractorDispositionCode, PenaltyAmount, UnitCost, CostAmount, ReworkCycle, Description)
  SELECT @C, v.Num, 3, w.Id, o.Id, 1, 1002, w.BatchNumber, v.Qty, v.TypeCode, v.Rw, v.St, v.DecBy, CASE WHEN v.St > 1 THEN DATEADD(MINUTE, -300, @now) END, v.Cd, v.Pen, 4800, v.Cost, v.Cyc, v.Note
  FROM mes.WorkOrder w JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = 10
  CROSS JOIN (VALUES
    (N'NC-1405-396', 2500, 1, NULL, 2, N'کارشناس برون‌سپاری', 3, NULL, 2500 * 4800, NULL, N'در حد مجاز قرارداد (۰٫۵٪) — پذیرفته'),
    (N'NC-1405-397', 1700, 1, NULL, 1, NULL, 2, 1700 * 4800 * 1.2, 0, NULL, N'بیش از حد مجاز — جریمه به نرخ ۱۲۰٪ بهای واحد (پیشنهادی)'),
    (N'NC-1405-398', 1800, 3, 2, 2, N'کارشناس برون‌سپاری', 1, NULL, ROUND(1800 * 4800 * 0.25, 0), 1, N'برگشت به ما برای روکش مجدد در خط ۲')
  ) v(Num, Qty, TypeCode, Rw, St, DecBy, Cd, Pen, Cost, Cyc, Note)
  WHERE w.Number = N'WO-1405-0503';

  /* تصمیم‌هایی که زمانشان هنوز نرسیده: گزارش‌های دقایق اخیر هنوز منتظر تصمیم‌اند */
  UPDATE mes.NonconformingDisposition SET DecisionStatusCode = 1, DecidedByTitle = NULL, DecidedAt = NULL, TargetWorkOrderId = NULL
  WHERE CompanyId = @C AND DecidedAt > @now;

  COMMIT;
END
GO