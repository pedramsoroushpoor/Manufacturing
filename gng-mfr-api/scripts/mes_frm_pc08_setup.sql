/* =====================================================================
   اسکیمای mes — گام ۳۸: FRM-PC-08 «بازیابی مواد در اجرا»

   پیش‌نیاز: mes_frm_pc07 (رسید محصول)، ماده‌ی بازیابی‌شده (PE-05)، بازیابی عملیات مسیر (ME-04).

   جدول قدیم: mes.WorkOrderOperationOutputProduct — رسید ماده‌ی بازیابی‌شده خروجی رسمی دستور است (OutputTypeCode = 5، F-PC-065)
              و بچ جدید آن با شمارنده‌ی چرخه در mes.MaterialStock (جایگزین موقت انبار) ثبت می‌شود.
   جدول جدید:
     mes.WorkOrderMaterialBalance  اندازه‌گیری موازنه: نوع ۱ ماده‌ی بازیابی (ورودی حلال = بازیابی + تلفات + مانده در فرایند، F-PC-067)
                                   و نوع ۲ موازنه‌ی جرم پیوسته به‌ازای هر گزارش (ورودی توزین‌گر − خروجی − ضایعات − تغییر مانده، F-PC-068)
   نرخ واقعی و مقایسه با استاندارد (F-PC-066) زنده در mes.GetRecoveryExecution: استاندارد از بازیابی عملیات مسیر، وگرنه از
   ماده‌ی بازیابی‌شده (PE-05)، وگرنه از نسبت خروجی برنامه‌ریزی‌شده‌ی دستور.

   فرض‌ها و کدهای موقت:
     BalanceTypeCode  1 موازنه‌ی ماده‌ی بازیابی، 2 موازنه‌ی جرم پیوسته
     SourceCode       1 دستی، 2 توتالایزر توزین‌گر، 3 ترازوی مخزن

   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.WorkOrderMaterialBalance','U') IS NULL
CREATE TABLE mes.WorkOrderMaterialBalance (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderMaterialBalance PRIMARY KEY,
  WorkOrderId BIGINT NOT NULL,
  WOOperationId BIGINT NOT NULL,
  OperationOutputId BIGINT NULL,
  BalanceTypeCode INT NOT NULL,
  ProductId BIGINT NULL,
  RecoveryReceiptId BIGINT NULL,
  PeriodFrom DATETIME2 NULL,
  PeriodTo DATETIME2 NULL,
  InputQuantity DECIMAL(32,6) NOT NULL,
  OutputQuantity DECIMAL(32,6) NULL,
  LossQuantity DECIMAL(32,6) NULL,
  InProcessQuantity DECIMAL(32,6) NULL,
  TolerancePercent DECIMAL(9,4) NOT NULL,
  SourceCode INT NOT NULL CONSTRAINT DF_mes_WOMB_Source DEFAULT (1),
  MeasuredByTitle NVARCHAR(128) NULL,
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

/* رسیدهای ماده‌ی بازیابی‌شده با نرخ واقعی، استاندارد، بچ جدید و چرخه؛ recordset دوم: موازنه‌ها؛ سوم: تعریف‌های استاندارد */
CREATE OR ALTER PROCEDURE mes.GetRecoveryExecution
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(r.Id AS INT) AS ReceiptId, r.ReceiptNumber, r.ReceiptDate, CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WOTypeCode,
         o.Sequence AS OperationSequence, op.Name AS OperationTitle, x.ReportNumber,
         p.Number + N' — ' + p.Name AS RecoveredTitle, p.MeasureUnitTitle AS UnitTitle, src.Number + N' — ' + src.Name AS SourceTitle,
         b.InputQuantity AS SourceInput, r.ReceivedToInvQuantity AS Recovered,
         CAST(100.0 * r.ReceivedToInvQuantity / NULLIF(b.InputQuantity, 0) AS DECIMAL(9,2)) AS ActualPercent,
         COALESCE(ror.RecoveryPercent, rm.StandardRecoveryPercent) AS StandardPercent,
         CASE WHEN ror.Id IS NOT NULL THEN N'بازیابی عملیات مسیر' ELSE N'ماده‌ی بازیابی‌شده' END AS StandardSource,
         CAST(ISNULL(b.TolerancePercent, 5) AS DECIMAL(9,2)) AS ThresholdPoints,
         r.BatchNumber AS NewBatchNumber, s.RecoveryCycle, s.PurityPercent, rm.MinPurityPercent, rm.MaxCycles, s.QcStatusCode, r.InventoryTitle,
         ror.ReceiptDocumentPatternTitle, r.DocumentNumber, r.Description
  FROM mes.WorkOrderOperationOutputProduct r
  JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.Product p ON p.Id = r.FinalProductId
  LEFT JOIN mes.RecoveredMaterial rm ON rm.ProductId = r.FinalProductId AND rm.IsDeleted = 0
  LEFT JOIN mes.Product src ON src.Id = rm.SourceProductId
  LEFT JOIN mes.RoutingOperationRecovery ror ON ror.RoutingOperationId = o.RoutingOperationId AND ror.RecoveredMaterialId = rm.Id AND ror.IsDeleted = 0
  LEFT JOIN mes.WorkOrderMaterialBalance b ON b.RecoveryReceiptId = r.Id AND b.IsDeleted = 0
  LEFT JOIN mes.MaterialStock s ON s.BatchNumber = r.BatchNumber AND s.ProductId = r.FinalProductId AND s.IsDeleted = 0
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0 AND r.OutputTypeCode = 5
  ORDER BY r.ReceiptDate;

  SELECT CAST(b.Id AS INT) AS BalanceId, b.BalanceTypeCode, CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, o.Sequence AS OperationSequence,
         op.Name AS OperationTitle, x.ReportNumber, p.Number + N' — ' + p.Name AS ProductTitle, ISNULL(p.MeasureUnitTitle, N'kg') AS UnitTitle,
         b.PeriodFrom, b.PeriodTo, b.InputQuantity, b.OutputQuantity, b.LossQuantity, b.InProcessQuantity,
         b.InputQuantity - ISNULL(b.OutputQuantity, 0) - ISNULL(b.LossQuantity, 0) - ISNULL(b.InProcessQuantity, 0) AS Gap,
         CAST(100.0 * (b.InputQuantity - ISNULL(b.OutputQuantity, 0) - ISNULL(b.LossQuantity, 0) - ISNULL(b.InProcessQuantity, 0)) / NULLIF(b.InputQuantity, 0) AS DECIMAL(9,2)) AS GapPercent,
         b.TolerancePercent, b.SourceCode, b.MeasuredByTitle, b.Description,
         /* مقدار ثبت‌شده در سیستم برای همان بازه: مصرف مواد جامد (موازنه‌ی پیوسته) */
         CASE WHEN b.BalanceTypeCode = 2 THEN (SELECT SUM(c.ConsumedQuantity) FROM mes.WorkOrderOperationMaterialConsumed c
                                                 JOIN mes.WorkOrderOperationMaterial m ON m.Id = c.WOOperationMaterialId JOIN mes.Product mp ON mp.Id = m.ProductId
                                                 WHERE c.OperationOutputId = b.OperationOutputId AND c.IsDeleted = 0 AND mp.MeasureUnitTitle = N'kg') END AS PostedInput
  FROM mes.WorkOrderMaterialBalance b
  JOIN mes.WorkOrder w ON w.Id = b.WorkOrderId
  JOIN mes.WorkOrderOperation o ON o.Id = b.WOOperationId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.WorkOrderOperationOutput x ON x.Id = b.OperationOutputId
  LEFT JOIN mes.Product p ON p.Id = b.ProductId
  WHERE b.CompanyId = @CompanyId AND b.IsDeleted = 0
  ORDER BY b.BalanceTypeCode, w.Number, b.PeriodFrom;

  SELECT rm.Number AS RecoveredCode, p.Number + N' — ' + p.Name AS RecoveredTitle, src.Number + N' — ' + src.Name AS SourceTitle, rm.GradeTitle,
         rm.StandardRecoveryPercent, rm.RecoveryLossPercent, rm.MinPurityPercent, rm.MaxCycles, rm.EquivalenceRatio, rm.RequiresQcApproval,
         ror.RecoveryPercent AS RoutingRecoveryPercent, ror.LossPercent AS RoutingLossPercent, rop.Name AS RoutingOperationTitle, ror.ReceiptInventoryTitle
  FROM mes.RecoveredMaterial rm
  JOIN mes.Product p ON p.Id = rm.ProductId
  LEFT JOIN mes.Product src ON src.Id = rm.SourceProductId
  LEFT JOIN mes.RoutingOperationRecovery ror ON ror.RecoveredMaterialId = rm.Id AND ror.IsDeleted = 0
  LEFT JOIN mes.RoutingOperation ro ON ro.Id = ror.RoutingOperationId
  LEFT JOIN mes.ProductionOperation rop ON rop.Id = ro.OperationId
  WHERE rm.CompanyId = @CompanyId AND rm.IsDeleted = 0
  ORDER BY rm.Number;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.WorkOrderMaterialBalance خالی است.
   عمداً خراب: بازیابی گزارش دوم WO-0507 ۶۲٪ (استاندارد ۷۶–۸۰٪) با شکاف موازنه‌ی ۲۱٪ — آب خنک‌کن کندانسور؛ بچ حاصل خلوص
   کمتر از حداقل دارد؛ موازنه‌ی جرم گزارش دوم گرانولاتور پیوسته ۲٫۴٪ شکاف (بیش از ۱٫۵٪) — توتالایزر توزین‌گر بیش از مصرف ثبت‌شده.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.WorkOrderMaterialBalance)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  DECLARE @rc TABLE (WoNo NVARCHAR(32), Seq INT, Part INT, Batch NVARCHAR(64), RcptNo NVARCHAR(64), Input DECIMAL(32,6), Recovered DECIMAL(32,6), Loss DECIMAL(32,6),
                     InProc DECIMAL(32,6), Purity DECIMAL(9,4), Qc INT, Note NVARCHAR(400));
  INSERT @rc VALUES
    (N'WO-1405-0500', 30, 1, N'RET-1405-024', N'RC-1405-2287', 36, 27.0, 8.7, 0.2, 95.3, 1, N'تخلیه‌ی کامل گیرنده‌ی کندانسور'),
    (N'WO-1405-0507', 20, 1, N'RET-1405-027', N'RC-1405-2299', 68.25, 52.0, 15.2, 1.0, 95.0, 2, N'تخلیه‌ی ساعتی گیرنده'),
    (N'WO-1405-0507', 20, 2, N'RET-1405-028', N'RC-1405-2306', 78, 48.4, 8.9, 4.0, 93.1, 2, N'دمای آب برگشتی کندانسور بالا — بخشی از بخار هدر رفت');

  INSERT mes.WorkOrderOperationOutputProduct (CompanyId, OperationOutputId, FinalProductId, CompletedQuantity, IsDeliveredToInventory, ProductExtraInfo, RemainedToInvQuantity,
         ReceivedToInvQuantity, WorkOrderOperationOutputProductStatusCode, Description, ReceiptNumber, ReceiptDate, OutputTypeCode, ReceiptPolicyCode, InventoryTitle,
         BatchNumber, QcStatusCode, IsCustomerOwned, DocumentNumber)
  SELECT @C, x.Id, 3015, r.Recovered, 1, N'چرخه‌ی ۱ — خلوص ' + FORMAT(r.Purity, '0.0') + N'٪', 0, r.Recovered, 3, r.Note, r.RcptNo, DATEADD(MINUTE, 12, x.EndTime), 5, 3,
         N'مخزن حلال بازیابی‌شده — سالن جامدات', r.Batch, CASE WHEN r.Qc = 1 THEN 2 ELSE 1 END, 0, N'IN-' + SUBSTRING(r.RcptNo, 4, 20)
  FROM @rc r
  JOIN mes.WorkOrder w ON w.Number = r.WoNo AND w.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = r.Seq
  CROSS APPLY (SELECT x.Id, x.EndTime, ROW_NUMBER() OVER (ORDER BY x.EndTime, x.Id) AS Part FROM mes.WorkOrderOperationOutput x WHERE x.WOOperationId = o.Id AND x.IsDeleted = 0) x
  WHERE x.Part = r.Part;

  /* بچ جدید با شمارنده‌ی چرخه = چرخه‌ی منبع (اتانول نو = ۰) + ۱ */
  INSERT mes.MaterialStock (CompanyId, ProductId, InventoryKindCode, InventoryTitle, BatchNumber, ManufactureDate, ExpireDate, PurityPercent, RecoveryCycle,
                            OnHandQuantity, ReservedQuantity, QcStatusCode, IsCustomerOwned, Description)
  SELECT @C, 3015, 1, N'مخزن حلال بازیابی‌شده', r.Batch, CAST(rp.ReceiptDate AS DATE), DATEADD(MONTH, 6, CAST(rp.ReceiptDate AS DATE)), r.Purity, 1,
         r.Recovered, 0, r.Qc, 0, N'بازیابی از ' + r.WoNo
  FROM @rc r JOIN mes.WorkOrderOperationOutputProduct rp ON rp.ReceiptNumber = r.RcptNo
  WHERE NOT EXISTS (SELECT 1 FROM mes.MaterialStock s WHERE s.BatchNumber = r.Batch);

  INSERT mes.WorkOrderMaterialBalance (CompanyId, WorkOrderId, WOOperationId, OperationOutputId, BalanceTypeCode, ProductId, RecoveryReceiptId, PeriodFrom, PeriodTo,
                                       InputQuantity, OutputQuantity, LossQuantity, InProcessQuantity, TolerancePercent, SourceCode, MeasuredByTitle, Description)
  SELECT @C, o.WorkOrderId, o.Id, x.Id, 1, 3009, rp.Id, x.StartTime, x.EndTime, r.Input, r.Recovered, r.Loss, r.InProc, 5, 3, N'اپراتور بازیافت حلال',
         N'ورودی = اتانول مصرف‌شده‌ی گرانولاسیون همان بازه؛ تلفات = هواکش + ماند در گرانول'
  FROM @rc r
  JOIN mes.WorkOrderOperationOutputProduct rp ON rp.ReceiptNumber = r.RcptNo
  JOIN mes.WorkOrderOperationOutput x ON x.Id = rp.OperationOutputId
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId;

  /* موازنه‌ی جرم پیوسته: هر گزارش گرانولاسیون WO-0507 */
  INSERT mes.WorkOrderMaterialBalance (CompanyId, WorkOrderId, WOOperationId, OperationOutputId, BalanceTypeCode, ProductId, PeriodFrom, PeriodTo,
                                       InputQuantity, OutputQuantity, LossQuantity, InProcessQuantity, TolerancePercent, SourceCode, MeasuredByTitle, Description)
  SELECT @C, o.WorkOrderId, o.Id, x.Id, 2, 2001, x.StartTime, x.EndTime, v.Feeder, x.CompletedQuantity, x.WastedQuantity, v.Hold, 1.5, 2, N'توتالایزر توزین‌گرها', v.Note
  FROM mes.WorkOrder w
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = 10
  CROSS APPLY (SELECT x.Id, x.StartTime, x.EndTime, x.CompletedQuantity, x.WastedQuantity, ROW_NUMBER() OVER (ORDER BY x.EndTime, x.Id) AS Part
               FROM mes.WorkOrderOperationOutput x WHERE x.WOOperationId = o.Id AND x.IsDeleted = 0) x
  JOIN (VALUES (1, 227.9, 0.3, NULL), (2, 266.8, 0.4, N'توتالایزر ۶٫۴ کیلو بیش از خروجی — ریزش در نوار نقاله یا خطای کالیبراسیون'),
               (3, 162.4, -0.2, NULL)) v(Part, Feeder, Hold, Note) ON v.Part = x.Part
  WHERE w.Number = N'WO-1405-0507' AND w.CompanyId = @C;

  COMMIT;
END
GO
