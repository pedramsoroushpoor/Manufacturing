/* =====================================================================
   اسکیمای mes — گام ۳۴: FRM-PC-06 «مصرف مواد»

   پیش‌نیاز: mes_frm_pc05، سیاست مواد (ME-06)، مواد بازیابی‌شده (PE-05)، محدوده‌ی مصرف ساختار (PE-02).

   جدول قدیم با همان نام و همه‌ی فیلدها:
     mes.WorkOrderOperationMaterialConsumed  همان (ConsumedQuantity، PLCResult، زمان‌ها) + OperationOutputId (گزارش منشأ)، BatchNumber،
                                             ConsumptionModeCode (دستی/Backflush عملیات/Backflush رسید، F-PC-044 تا 046، 049)، TheoreticalQuantity
                                             و PotencyPercent (تصحیح عیار، 051)، ShortageHandlingCode (کسری، 047)، IsReversal و
                                             ReversedConsumptionId (اصلاح Backflush، 048)، IsRecoveredMaterial (053، 054)، IsCustomerMaterial (055)،
                                             DocumentNumber و DocumentPatternTitle (رویداد انبار با الگوی سند، 052)
   جدول قدیم mfr.WorkOrderBackflushRelatedInventoryDocument (پیوند به سند انبار) تا وصل شدن سیستم انبار نیامده؛ شماره‌ی سند روی همین ردیف است.
   انحراف مصرف (050) با mes.GetConsumptionVariance زنده: مصرف واقعی در برابر استاندارد برای مقدار تولیدشده و محدوده‌ی PE-02.
   تخصیص بچ بازیابی‌شده (054) با mes.GetRecoveredBatchEligibility: خلوص، چرخه، انقضا و سقف درصد ترکیب.

   فرض‌ها و کدهای موقت:
     ConsumptionModeCode   1 = دستی، 2 = Backflush پایان عملیات، 3 = Backflush در رسید محصول
     ShortageHandlingCode  1 = عادی، 2 = ثبت با موجودی منفی، 3 = ثبت جزئی + صف اصلاح

   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.WorkOrderOperationMaterialConsumed','U') IS NULL
CREATE TABLE mes.WorkOrderOperationMaterialConsumed (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationMaterialConsumed PRIMARY KEY,
  WOOperationMaterialId BIGINT NOT NULL,
  ConsumedQuantity DECIMAL(32,6) NULL,
  MeasureUnitId BIGINT NULL,
  PLCResult DECIMAL(32,6) NULL,
  StartTime DATETIME2 NULL,
  EndTime DATETIME2 NULL,
  Duration INT NULL,
  Description NVARCHAR(400) NULL,
  OperationOutputId BIGINT NULL,
  BatchNumber NVARCHAR(64) NULL,
  ConsumptionModeCode INT NOT NULL CONSTRAINT DF_mes_WOOMC_Mode DEFAULT (1),
  TheoreticalQuantity DECIMAL(32,6) NULL,
  PotencyPercent DECIMAL(9,4) NULL,
  ShortageHandlingCode INT NOT NULL CONSTRAINT DF_mes_WOOMC_Shortage DEFAULT (1),
  ShortageQuantity DECIMAL(32,6) NULL,
  IsReversal BIT NOT NULL CONSTRAINT DF_mes_WOOMC_Reversal DEFAULT (0),
  ReversedConsumptionId BIGINT NULL,
  IsRecoveredMaterial BIT NOT NULL CONSTRAINT DF_mes_WOOMC_Recovered DEFAULT (0),
  IsCustomerMaterial BIT NOT NULL CONSTRAINT DF_mes_WOOMC_Customer DEFAULT (0),
  DocumentNumber NVARCHAR(64) NULL,
  DocumentPatternTitle NVARCHAR(256) NULL
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

CREATE OR ALTER PROCEDURE mes.GetMaterialConsumption
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.WorkOrderId AS INT) AS WorkOrderId, CAST(c.Id AS INT) AS ConsumptionId, o.Sequence AS OperationSequence, op.Name AS OperationTitle,
         CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, p.ProductGroupTitle,
         c.ConsumedQuantity, c.TheoreticalQuantity, c.PotencyPercent, c.BatchNumber, c.ConsumptionModeCode, c.ShortageHandlingCode, c.ShortageQuantity,
         c.IsReversal, CAST(c.ReversedConsumptionId AS INT) AS ReversedConsumptionId, c.IsRecoveredMaterial, c.IsCustomerMaterial, c.DocumentNumber,
         c.DocumentPatternTitle, c.StartTime, c.EndTime, c.PLCResult, c.Description, x.ReportNumber, m.SubstitutedProductId, sp.Number + N' — ' + sp.Name AS SubstituteTitle
  FROM mes.WorkOrderOperationMaterialConsumed c
  JOIN mes.WorkOrderOperationMaterial m ON m.Id = c.WOOperationMaterialId
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN mes.Product p ON p.Id = m.ProductId
  LEFT JOIN mes.Product sp ON sp.Id = m.SubstitutedProductId
  LEFT JOIN mes.WorkOrderOperationOutput x ON x.Id = c.OperationOutputId
  WHERE c.CompanyId = @CompanyId AND c.IsDeleted = 0
  ORDER BY o.WorkOrderId, c.EndTime, c.Id;
END
GO

/* انحراف مصرف: استاندارد = نیاز ردیف به‌ازای مقدار تولیدشده‌ی عملیات مصرف‌کننده (تکمیل + ضایعات) */
CREATE OR ALTER PROCEDURE mes.GetConsumptionVariance
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.WorkOrderId AS INT) AS WorkOrderId, CAST(m.Id AS INT) AS MaterialId, o.Sequence AS OperationSequence, p.Number + N' — ' + p.Name AS ProductTitle,
         p.MeasureUnitTitle AS UnitTitle, m.PlannedKitQuantity, m.ActualKitQuantity, o.ToCompleteQuantity,
         o.CompletedQuantity + o.WastedQuantity AS ProducedAtOperation,
         CAST(m.StandardQuantity * (o.CompletedQuantity + o.WastedQuantity) / NULLIF(o.ToCompleteQuantity, 0) AS DECIMAL(32,4)) AS StandardForProduced,
         ISNULL((SELECT SUM(CASE WHEN c.IsReversal = 1 THEN -c.ConsumedQuantity ELSE c.ConsumedQuantity END) FROM mes.WorkOrderOperationMaterialConsumed c
                 WHERE c.WOOperationMaterialId = m.Id AND c.IsDeleted = 0), 0) AS Actual,
         si.MinConsumptionPercent, si.MaxConsumptionPercent, si.IsActiveIngredient, m.IsCustomerMaterial,
         pol.ConsumptionControlCode, pol.ConsumptionPolicyCode
  FROM mes.WorkOrderOperationMaterial m
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.Product p ON p.Id = m.ProductId
  LEFT JOIN mes.ProductStructureItem si ON si.Id = m.ProductStructureItemId
  OUTER APPLY (SELECT TOP (1) x.ConsumptionControlCode, x.ConsumptionPolicyCode FROM mes.ProductionMaterialPolicy x
               WHERE x.IsDeleted = 0 AND ((x.ScopeTypeCode = 3 AND x.ProductId = p.Id) OR (x.ScopeTypeCode = 2 AND x.ProductGroupTitle = p.ProductGroupTitle) OR x.ScopeTypeCode = 1)
                 AND (x.ConsumptionControlCode IS NOT NULL OR x.ConsumptionPolicyCode IS NOT NULL)
               ORDER BY x.ScopeTypeCode DESC) pol
  WHERE m.CompanyId = @CompanyId AND m.IsDeleted = 0 AND w.WorkOrderStatusCode IN (3, 4, 5) AND ISNULL(m.StandardQuantity, 0) > 0
  ORDER BY o.WorkOrderId, o.Sequence, p.Number;
END
GO

/* بچ‌های ماده‌ی بازیابی‌شده و واجد شرایط بودنشان برای مصرف ترکیبی (F-PC-053، 054) */
CREATE OR ALTER PROCEDURE mes.GetRecoveredBatchEligibility
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(mes.fnShopNow() AS DATE);
  SELECT s.BatchNumber, p.Number + N' — ' + p.Name AS ProductTitle, rm.Number AS RecoveredCode, src.Number + N' — ' + src.Name AS SourceTitle,
         s.OnHandQuantity, s.PurityPercent, rm.MinPurityPercent, s.RecoveryCycle, rm.MaxCycles, s.ExpireDate, rm.RequiresQcApproval, s.QcStatusCode,
         CASE WHEN s.QcStatusCode <> 1 THEN N'منتظر آزادسازی QC'
              WHEN s.PurityPercent < rm.MinPurityPercent THEN N'خلوص کمتر از حداقل'
              WHEN rm.MaxCycles IS NOT NULL AND s.RecoveryCycle >= rm.MaxCycles THEN N'به سقف چرخه‌ی بازیابی رسیده'
              WHEN s.ExpireDate < @today THEN N'منقضی' END AS BlockReason,
         (SELECT MAX(si.MaxRecoveredUsePercent) FROM mes.ProductStructureItem si WHERE si.ProductId = rm.SourceProductId AND si.IsDeleted = 0) AS MaxMixPercent
  FROM mes.MaterialStock s
  JOIN mes.RecoveredMaterial rm ON rm.ProductId = s.ProductId AND rm.IsDeleted = 0
  JOIN mes.Product p ON p.Id = s.ProductId
  LEFT JOIN mes.Product src ON src.Id = rm.SourceProductId
  /* فقط بچ‌هایی که واقعاً از بازیابی آمده‌اند (چرخه دارند)؛ گرانول عادی هم‌کالا نیست */
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0 AND s.OnHandQuantity > 0 AND ISNULL(s.RecoveryCycle, 0) >= 1
  ORDER BY s.BatchNumber;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.WorkOrderOperationMaterialConsumed خالی است.
   عمداً خراب: پاراستامول (عیاردار) در دستور پیوسته Backflush شده؛ گرانول در گزارش دوم پرس WO-0501 ۴٪ بیش از استاندارد مصرف
   شده (بیرون از ۹۹ تا ۱۰۱٪)؛ بروشور در Backflush رسید WO-0501 کسری داشت و جزئی ثبت شد (صف اصلاح)؛ آب خالص WO-0499 مصرفش
   ثبت نشده؛ بچ اتانول بازیافتی RET-1405-014 خلوص کمتر از حداقل دارد و در چرخه‌ی سوم است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.WorkOrderOperationMaterialConsumed)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  /* ۱) دستی به‌ازای هر گزارش عملیات: نیاز استاندارد × (تکمیل + ضایعات گزارش)، برای مواد غیر Backflush */
  INSERT mes.WorkOrderOperationMaterialConsumed (CompanyId, WOOperationMaterialId, ConsumedQuantity, StartTime, EndTime, OperationOutputId, BatchNumber, ConsumptionModeCode,
                                                 TheoreticalQuantity, PotencyPercent, IsCustomerMaterial, DocumentNumber, DocumentPatternTitle, Description)
  SELECT @C, m.Id,
         CAST(m.StandardQuantity * (x.CompletedQuantity + x.WastedQuantity) / NULLIF(o.ToCompleteQuantity, 0)
              * CASE WHEN w.Number = N'WO-1405-0501' AND x.ReportNumber LIKE N'%-40-2' AND m.ProductId = 2001 THEN 1.04 ELSE 1.0 END AS DECIMAL(32,4)),
         x.StartTime, x.EndTime, x.Id, LEFT(m.BatchNumber, 64), 1,
         CAST(m.StandardQuantity * (x.CompletedQuantity + x.WastedQuantity) / NULLIF(o.ToCompleteQuantity, 0) AS DECIMAL(32,4)), m.Potency, ISNULL(m.IsCustomerMaterial, 0),
         N'CNS-' + RIGHT(w.Number, 4) + N'-' + CAST(o.Sequence AS NVARCHAR(4)) + RIGHT(x.ReportNumber, 2),
         CASE WHEN m.IsCustomerMaterial = 1 THEN N'حواله‌ی مصرف امانی' ELSE N'حواله‌ی مصرف تولید' END,
         CASE WHEN w.Number = N'WO-1405-0501' AND x.ReportNumber LIKE N'%-40-2' AND m.ProductId = 2001 THEN N'ریزش هاپر هنگام گیر کردن کانال تغذیه' END
  FROM mes.WorkOrderOperationMaterial m
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.Product p ON p.Id = m.ProductId
  JOIN mes.WorkOrderOperationOutput x ON x.WOOperationId = o.Id
  WHERE m.CompanyId = @C AND ISNULL(m.StandardQuantity, 0) > 0 AND p.ProductGroupTitle <> N'مواد بسته‌بندی'
    AND NOT (w.WOTypeCode = 2 AND p.Id = 3001)          -- مؤثره‌ی پیوسته با Backflush (پایین)
    AND NOT (w.Number = N'WO-1405-0499' AND p.Id = 3007) -- آب خالص WO-0499 ثبت نشده (عمدی)
    AND NOT (w.Number = N'WO-1405-0504' AND p.Id = 3009) -- اتانول ترکیبی (پایین)
    AND p.Id <> 3007;

  /* تصحیح عیار پاراستامول WO-0504: نظری ۱۲۴٫۹۵، واقعی با عیار ۹۸٫۹٪ */
  UPDATE c SET c.TheoreticalQuantity = 124.95, c.ConsumedQuantity = 126.34, c.PotencyPercent = 98.9, c.BatchNumber = N'PCM-2411',
               c.Description = N'۱۲۴٫۹۵ × ۱۰۰ ÷ ۹۸٫۹ = ۱۲۶٫۳۴ کیلو'
  FROM mes.WorkOrderOperationMaterialConsumed c JOIN mes.WorkOrderOperationMaterial m ON m.Id = c.WOOperationMaterialId
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.Number = N'WO-1405-0504' AND m.ProductId = 3001;

  /* K25 جایگزین در WO-0504 */
  UPDATE c SET c.ConsumedQuantity = 4.125, c.TheoreticalQuantity = 4.5, c.BatchNumber = N'PVK25-0108', c.Description = N'جایگزین K25 به نسبت ۱٫۱ برای ۳٫۷۵ کیلو K30'
  FROM mes.WorkOrderOperationMaterialConsumed c JOIN mes.WorkOrderOperationMaterial m ON m.Id = c.WOOperationMaterialId
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.Number = N'WO-1405-0504' AND m.ProductId = 3006;

  /* ۲) اتانول WO-0504: ترکیب نو + بازیافتی تا سقف ۴۰٪ */
  INSERT mes.WorkOrderOperationMaterialConsumed (CompanyId, WOOperationMaterialId, ConsumedQuantity, EndTime, BatchNumber, ConsumptionModeCode, TheoreticalQuantity, IsRecoveredMaterial,
                                                 DocumentNumber, DocumentPatternTitle, Description)
  SELECT @C, m.Id, v.Qty, DATEADD(MINUTE, 20, o.StartTime), v.Batch, 1, 45, v.Rec, v.Doc, N'حواله‌ی مصرف تولید', v.Description
  FROM (VALUES (27.0, N'ETH-1405-09', 0, N'CNS-0504-10-E1', N'اتانول نو ۶۰٪'),
               (18.0, N'RET-1405-021', 1, N'CNS-0504-10-E2', N'اتانول بازیافتی ۴۰٪ (سقف ۴۰٪، خلوص ۹۴٫۸٪، چرخه‌ی ۱)')) v(Qty, Batch, Rec, Doc, Description)
  JOIN mes.WorkOrder w ON w.Number = N'WO-1405-0504' AND w.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = 10
  JOIN mes.WorkOrderOperationMaterial m ON m.WOOperationId = o.Id AND m.ProductId = 3009;
  UPDATE m SET m.IsRecoveredMaterial = 1 FROM mes.WorkOrderOperationMaterial m JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.Number = N'WO-1405-0504' AND m.ProductId = 3009;

  /* ۳) Backflush پایان عملیات: مؤثره‌ی دستور پیوسته (سیاست شرکت — باید استثنا می‌شد) */
  INSERT mes.WorkOrderOperationMaterialConsumed (CompanyId, WOOperationMaterialId, ConsumedQuantity, EndTime, OperationOutputId, BatchNumber, ConsumptionModeCode, TheoreticalQuantity,
                                                 PotencyPercent, DocumentNumber, DocumentPatternTitle, Description)
  SELECT @C, m.Id, CAST(m.StandardQuantity * (x.CompletedQuantity + x.WastedQuantity) / NULLIF(o.ToCompleteQuantity, 0) AS DECIMAL(32,4)), x.EndTime, x.Id, N'PCM-2406', 2,
         CAST(m.StandardQuantity * (x.CompletedQuantity + x.WastedQuantity) / NULLIF(o.ToCompleteQuantity, 0) AS DECIMAL(32,4)), NULL,
         N'BF-' + RIGHT(w.Number, 4) + RIGHT(x.ReportNumber, 2), N'حواله‌ی Backflush', N'Backflush بدون تصحیح عیار'
  FROM mes.WorkOrderOperationMaterial m
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId AND w.WOTypeCode = 2
  JOIN mes.WorkOrderOperationOutput x ON x.WOOperationId = o.Id
  WHERE m.CompanyId = @C AND m.ProductId = 3001;

  /* ۴) Backflush در رسید محصول برای مواد بسته‌بندی (سیاست گروه): بر مبنای کل تولید بسته‌بندی */
  INSERT mes.WorkOrderOperationMaterialConsumed (CompanyId, WOOperationMaterialId, ConsumedQuantity, EndTime, OperationOutputId, BatchNumber, ConsumptionModeCode, TheoreticalQuantity,
                                                 ShortageHandlingCode, ShortageQuantity, DocumentNumber, DocumentPatternTitle, Description)
  SELECT @C, m.Id,
         CAST(m.StandardQuantity * (x.CompletedQuantity + x.WastedQuantity) / NULLIF(o.ToCompleteQuantity, 0) AS DECIMAL(32,4))
           - CASE WHEN w.Number = N'WO-1405-0501' AND m.ProductId = 4005 AND x.ReportNumber LIKE N'%-3' THEN 1250 ELSE 0 END,
         x.EndTime, x.Id, LEFT(m.BatchNumber, 64), 3,
         CAST(m.StandardQuantity * (x.CompletedQuantity + x.WastedQuantity) / NULLIF(o.ToCompleteQuantity, 0) AS DECIMAL(32,4)),
         CASE WHEN w.Number = N'WO-1405-0501' AND m.ProductId = 4005 AND x.ReportNumber LIKE N'%-3' THEN 3 ELSE 1 END,
         CASE WHEN w.Number = N'WO-1405-0501' AND m.ProductId = 4005 AND x.ReportNumber LIKE N'%-3' THEN 1250 END,
         N'BF-' + RIGHT(w.Number, 4) + N'-' + CAST(o.Sequence AS NVARCHAR(4)) + RIGHT(x.ReportNumber, 2), N'حواله‌ی Backflush رسید',
         CASE WHEN w.Number = N'WO-1405-0501' AND m.ProductId = 4005 AND x.ReportNumber LIKE N'%-3' THEN N'کسری ۱٬۲۵۰ بروشور پای کار — ثبت جزئی، در صف اصلاح' END
  FROM mes.WorkOrderOperationMaterial m
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.Product p ON p.Id = m.ProductId AND p.ProductGroupTitle = N'مواد بسته‌بندی'
  JOIN mes.WorkOrderOperationOutput x ON x.WOOperationId = o.Id
  WHERE m.CompanyId = @C AND ISNULL(m.StandardQuantity, 0) > 0;

  /* ۵) اصلاح Backflush در WO-0498: پس از تصحیح مقدار تولید، فویل معکوس و دوباره ثبت شد */
  DECLARE @orig BIGINT = (SELECT TOP (1) c.Id FROM mes.WorkOrderOperationMaterialConsumed c JOIN mes.WorkOrderOperationMaterial m ON m.Id = c.WOOperationMaterialId
                          JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
                          WHERE w.Number = N'WO-1405-0498' AND m.ProductId = 4001 AND o.Sequence = 60 ORDER BY c.Id);
  INSERT mes.WorkOrderOperationMaterialConsumed (CompanyId, WOOperationMaterialId, ConsumedQuantity, EndTime, BatchNumber, ConsumptionModeCode, IsReversal, ReversedConsumptionId,
                                                 DocumentNumber, DocumentPatternTitle, Description)
  SELECT @C, c.WOOperationMaterialId, c.ConsumedQuantity, DATEADD(HOUR, 3, c.EndTime), c.BatchNumber, 3, 1, c.Id, N'BF-0498-REV', N'سند معکوس Backflush',
         N'تصحیح مقدار تولید بسته‌بندی از ۲۹۹٬۴۰۰ به ۲۹۳٬۴۰۰'
  FROM mes.WorkOrderOperationMaterialConsumed c WHERE c.Id = @orig;
  INSERT mes.WorkOrderOperationMaterialConsumed (CompanyId, WOOperationMaterialId, ConsumedQuantity, EndTime, BatchNumber, ConsumptionModeCode, DocumentNumber, DocumentPatternTitle, Description)
  SELECT @C, c.WOOperationMaterialId, CAST(c.ConsumedQuantity * 293400 / 299400 AS DECIMAL(32,4)), DATEADD(HOUR, 3, c.EndTime), c.BatchNumber, 3, N'BF-0498-RE', N'حواله‌ی Backflush رسید',
         N'ثبت دوباره پس از معکوس'
  FROM mes.WorkOrderOperationMaterialConsumed c WHERE c.Id = @orig;

  /* دستورهای تکمیل‌شده و بسته‌شده: کیت کامل تحویل شده بود؛ مازاد برگشت خورده (جز HPMC در WO-0499 — عمدی) */
  UPDATE m SET m.ActualKitQuantity = ISNULL(m.ActualKitQuantity, m.PlannedKitQuantity), m.ActualKitCompleteDate = ISNULL(m.ActualKitCompleteDate, o.StartTime)
  FROM mes.WorkOrderOperationMaterial m JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.CompanyId = @C AND w.WorkOrderStatusCode IN (4, 5);
  /* جمع مصرف روی ردیف ماده */
  UPDATE m SET m.ConsumedQuantity = x.Net, m.WorkOrderOperationMaterialStatusCode = CASE WHEN w.WorkOrderStatusCode IN (4, 5) THEN 5 ELSE 4 END,
               m.ShortageQuantity = x.Shortage
  FROM mes.WorkOrderOperationMaterial m
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN (SELECT WOOperationMaterialId, SUM(CASE WHEN IsReversal = 1 THEN -ConsumedQuantity ELSE ConsumedQuantity END) AS Net, SUM(ShortageQuantity) AS Shortage
        FROM mes.WorkOrderOperationMaterialConsumed GROUP BY WOOperationMaterialId) x ON x.WOOperationMaterialId = m.Id;

  UPDATE m SET m.ReturnedQuantity = ISNULL(m.ReturnedQuantity, 0) + (m.ActualKitQuantity - ISNULL(m.ConsumedQuantity, 0) - ISNULL(m.ReturnedQuantity, 0))
  FROM mes.WorkOrderOperationMaterial m JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.CompanyId = @C AND w.WorkOrderStatusCode IN (4, 5) AND w.Number <> N'WO-1405-0499'
    AND m.ActualKitQuantity - ISNULL(m.ConsumedQuantity, 0) - ISNULL(m.ReturnedQuantity, 0) > 0;
  COMMIT;
END
GO
