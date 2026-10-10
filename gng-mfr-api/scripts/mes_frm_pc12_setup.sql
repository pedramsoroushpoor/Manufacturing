/* =====================================================================
   اسکیمای mes — گام ۴۲: FRM-PC-12 «کنسول پایش و بستن دستور»

   پیش‌نیاز: mes_frm_pc01 تا pc11 (همه‌ی داده‌ی اجرایی).

   جدول قدیم:
     mes.ProductionPlanDeviation  (generalmfr، ساخته‌شده در RM-07 با ParentId) درخت انحراف/علت — همان برای ثبت علت انحراف (F-PC-094)
   جدول‌های جدید:
     mes.ExceptionRule       قاعده‌ی هشدار: نوع، آستانه، شدت، کانال اعلان، مسئول پیگیری، زمان و مسئول تشدید (F-PC-092، 093)
     mes.ExceptionAlert      وضعیت هشدارها (دیده‌شده/ارجاع/رفع) با کلید پایدار؛ خود هشدار زنده از داده تشخیص داده می‌شود
     mes.WorkOrderDeviation  انحراف ثبت‌شده با علت و اقدام اصلاحی (094)
     mes.WorkOrderCloseEvent بستن، بستن خودکار، درخواست و تأیید بازگشایی، و رویداد ارسالی به بهای تمام‌شده (096، 097، 099، 100)
   داشبورد و OEE جاری (091)، آندون (095)، کار در جریان (098)، آمادگی بستن (096) و پیش‌نمایش رویداد بهای تمام‌شده (099) زنده.

   فرض‌ها و کدهای موقت:
     ExceptionRule.RuleTypeCode  1 انحراف مصرف، 2 تأخیر دستور، 3 ضایعات بالای آستانه، 4 توقف طولانی، 5 کسری پای کار،
                                 6 هم‌پوشانی ایستگاه، 7 انحراف نرخ بازیابی، 8 رسید بیش از گزارش، 9 تأخیر پیمانکار،
                                 10 شکاف موازنه‌ی جرم، 11 پایانه‌ی برون‌خط با رکورد معوق
     SeverityCode  1 اطلاع، 2 هشدار، 3 بحرانی؛ ChannelCode 1 داخل سامانه، 2 پیامک، 3 ایمیل، 4 آندون
     ExceptionAlert.StatusCode  1 باز، 2 دیده‌شده، 3 ارجاع‌شده، 4 رفع‌شده
     WorkOrderCloseEvent.EventTypeCode  1 بستن، 2 بستن خودکار، 3 درخواست بازگشایی، 4 بازگشایی تأییدشده
     CostingStatusCode  1 آماده‌ی ارسال، 2 ارسال‌شده، 3 تأیید بهای تمام‌شده
     شروع شیفت برای OEE جاری = ۰۶:۰۰ همان روز (تا اتصال به تقویم شیفت).

   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.ExceptionRule','U') IS NULL
CREATE TABLE mes.ExceptionRule (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ExceptionRule PRIMARY KEY,
  Number NVARCHAR(32) NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  RuleTypeCode INT NOT NULL,
  ThresholdValue DECIMAL(18,4) NULL,
  ThresholdUnitTitle NVARCHAR(32) NULL,
  SeverityCode INT NOT NULL CONSTRAINT DF_mes_ExceptionRule_Severity DEFAULT (2),
  ChannelCode INT NOT NULL CONSTRAINT DF_mes_ExceptionRule_Channel DEFAULT (1),
  OwnerTitle NVARCHAR(128) NULL,
  EscalationMinutes INT NULL,
  EscalationOwnerTitle NVARCHAR(128) NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ExceptionRule_Active DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ExceptionAlert','U') IS NULL
CREATE TABLE mes.ExceptionAlert (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ExceptionAlert PRIMARY KEY,
  RuleId BIGINT NOT NULL,
  AlertKey NVARCHAR(128) NOT NULL,
  StatusCode INT NOT NULL,
  AcknowledgedAt DATETIME2 NULL,
  AcknowledgedByTitle NVARCHAR(128) NULL,
  AssignedToTitle NVARCHAR(128) NULL,
  ResolvedAt DATETIME2 NULL,
  Note NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.WorkOrderDeviation','U') IS NULL
CREATE TABLE mes.WorkOrderDeviation (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderDeviation PRIMARY KEY,
  WorkOrderId BIGINT NOT NULL,
  WOOperationId BIGINT NULL,
  ProductionPlanDeviationId BIGINT NOT NULL,
  PlannedValue NVARCHAR(64) NULL,
  ActualValue NVARCHAR(64) NULL,
  RecordedAt DATETIME2 NOT NULL,
  RecordedByTitle NVARCHAR(128) NULL,
  CorrectiveActionTitle NVARCHAR(256) NULL,
  CorrectiveActionOwnerTitle NVARCHAR(128) NULL,
  CorrectiveActionDueDate DATE NULL,
  CorrectiveActionStatusCode INT NULL,
  CorrectiveActionRef NVARCHAR(64) NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.WorkOrderCloseEvent','U') IS NULL
CREATE TABLE mes.WorkOrderCloseEvent (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderCloseEvent PRIMARY KEY,
  WorkOrderId BIGINT NOT NULL,
  EventTypeCode INT NOT NULL,
  EventAt DATETIME2 NOT NULL,
  ByTitle NVARCHAR(128) NULL,
  Reason NVARCHAR(400) NULL,
  ApprovalStatusCode INT NULL,
  ApproverTitle NVARCHAR(128) NULL,
  CostingEventNumber NVARCHAR(64) NULL,
  CostingStatusCode INT NULL,
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

/* داشبورد لحظه‌ای (F-PC-091) و آندون (095):
   ۱) خطوط با OEE جاری از شروع شیفت  ۲) ایستگاه‌ها با وضعیت  ۳) پیشرفت دستورهای فعال  ۴) توقف‌های باز */
CREATE OR ALTER PROCEDURE mes.GetProductionDashboard
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();
  DECLARE @shift DATETIME2 = DATEADD(HOUR, 6, CAST(CAST(@now AS DATE) AS DATETIME2));

  /* عملیات فعال امروز و ایستگاه/گروه منبعشان */
  SELECT o.Id AS OpId, o.WorkOrderId, w.Number AS WoNo, w.WOTypeCode AS WoType, w.ProductionLineId AS WoLineId, o.Sequence, op.Name AS OpName, o.WorkOrderOperationStatusCode AS St,
         o.WorkCenterId, wc.Name AS WcName, wc.Number AS WcNo, ISNULL(wc.ProductionLineId, w.ProductionLineId) AS LineId,
         COALESCE(N'WC' + CAST(o.WorkCenterId AS NVARCHAR(10)), N'RG' + CAST(o.ResourceGroupId AS NVARCHAR(10)), N'OP' + CAST(o.Id AS NVARCHAR(10))) AS StationKey,
         COALESCE(wc.Name, rg.Name, op.Name) AS StationTitle, o.ToCompleteQuantity, o.CompletedQuantity, o.WastedQuantity, o.StartTime, o.EndTime,
         IIF(ISNULL(t.EquipmentRunTimePerPart, 0) > ISNULL(t.LaborRunTimePerPart, 0), ISNULL(t.EquipmentRunTimePerPart, 0), ISNULL(t.LaborRunTimePerPart, 0)) AS RunPerPart
  INTO #ops
  FROM mes.WorkOrderOperation o
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
  LEFT JOIN mes.ResourceGroup rg ON rg.Id = o.ResourceGroupId
  LEFT JOIN mes.RoutingOperationTiming t ON t.RoutingOperationId = o.RoutingOperationId AND t.IsDeleted = 0
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND o.IsDeleted = 0 AND o.IsOutsourced = 0
    AND (o.WorkOrderOperationStatusCode IN (3, 4) OR (o.WorkOrderOperationStatusCode = 5 AND o.EndTime > @shift));

  /* OEE هر ایستگاه از شروع شیفت */
  /* دوباره‌کاری و بازیافت در OEE حساب نمی‌شوند (افت کیفیت دستور مبدا است)؛ در آندون دیده می‌شوند */
  ;WITH out AS (
    SELECT p.StationKey, p.LineId, SUM(x.CompletedQuantity) AS Good, SUM(x.CompletedQuantity + x.WastedQuantity) AS Total,
           SUM((x.CompletedQuantity + x.WastedQuantity) * p.RunPerPart) AS IdealMin
    FROM #ops p JOIN mes.WorkOrderOperationOutput x ON x.WOOperationId = p.OpId AND x.IsDeleted = 0 AND x.EndTime > @shift
    WHERE p.WoType NOT IN (3, 4)
    GROUP BY p.StationKey, p.LineId),
  stp AS (
    SELECT p.StationKey, SUM(DATEDIFF(MINUTE, IIF(pr.StartTime < @shift, @shift, pr.StartTime), ISNULL(pr.EndTime, @now))) AS StopMin
    FROM #ops p JOIN mes.WorkOrderOperationProblem pr ON pr.WOOperationId = p.OpId AND pr.IsDeleted = 0 AND pr.IsStoppageCause = 1
    WHERE ISNULL(pr.EndTime, @now) > @shift AND p.WoType NOT IN (3, 4)
    GROUP BY p.StationKey),
  pln AS (
    SELECT StationKey, LineId, DATEDIFF(MINUTE, IIF(MIN(StartTime) < @shift, @shift, MIN(StartTime)), @now) AS PlanMin
    FROM #ops WHERE StartTime IS NOT NULL AND WoType NOT IN (3, 4) GROUP BY StationKey, LineId),
  st AS (
    SELECT pl.StationKey, pl.LineId, pl.PlanMin, ISNULL(s.StopMin, 0) AS StopMin, ISNULL(o.IdealMin, 0) AS IdealMin, ISNULL(o.Good, 0) AS Good, ISNULL(o.Total, 0) AS Total
    FROM pln pl LEFT JOIN stp s ON s.StationKey = pl.StationKey LEFT JOIN out o ON o.StationKey = pl.StationKey
    WHERE pl.PlanMin > 0)
  SELECT StationKey, LineId, PlanMin, StopMin, IdealMin, Good, Total,
         CAST(1.0 * (PlanMin - StopMin) / PlanMin AS DECIMAL(9,4)) AS A,
         CAST(IIF(PlanMin - StopMin > 0, IIF(IdealMin / (PlanMin - StopMin) > 1, 1, IdealMin / (PlanMin - StopMin)), 0) AS DECIMAL(9,4)) AS P,
         CAST(IIF(Total > 0, Good / Total, 1) AS DECIMAL(9,4)) AS Q
  INTO #oee FROM st;

  SELECT CAST(ln.Id AS INT) AS LineId, ln.Number AS LineCode, ln.Name AS LineTitle,
         (SELECT COUNT(*) FROM #ops p WHERE p.LineId = ln.Id AND p.St = 3) AS RunningOps,
         (SELECT COUNT(*) FROM #ops p WHERE p.LineId = ln.Id AND p.St = 4) AS PausedOps,
         (SELECT COUNT(*) FROM #ops p JOIN mes.WorkOrderOperationProblem pr ON pr.WOOperationId = p.OpId AND pr.EndTime IS NULL AND pr.IsDeleted = 0 WHERE p.LineId = ln.Id) AS OpenStops,
         CAST(SUM(e.A * e.PlanMin) / NULLIF(SUM(e.PlanMin), 0) AS DECIMAL(9,4)) AS Availability,
         CAST(SUM(e.P * e.PlanMin) / NULLIF(SUM(e.PlanMin), 0) AS DECIMAL(9,4)) AS Performance,
         CAST(SUM(e.Q * e.PlanMin) / NULLIF(SUM(e.PlanMin), 0) AS DECIMAL(9,4)) AS Quality,
         CAST(SUM(e.A * e.P * e.Q * e.PlanMin) / NULLIF(SUM(e.PlanMin), 0) AS DECIMAL(9,4)) AS Oee,
         SUM(e.PlanMin) AS PlanMinutes, SUM(e.StopMin) AS StopMinutes, @shift AS ShiftStart, @now AS AsOf
  FROM mes.ProductionLine ln
  LEFT JOIN #oee e ON e.LineId = ln.Id
  WHERE ln.CompanyId = @CompanyId AND ln.IsDeleted = 0
  GROUP BY ln.Id, ln.Number, ln.Name
  ORDER BY ln.Number;

  /* ایستگاه‌ها (آندون): همه‌ی ایستگاه‌های خط + گروه‌های منبعِ در حال کار بی‌ایستگاه */
  ;WITH cur AS (
    SELECT p.*, ROW_NUMBER() OVER (PARTITION BY p.StationKey ORDER BY CASE p.St WHEN 3 THEN 0 WHEN 4 THEN 1 ELSE 2 END, p.StartTime DESC) AS rn,
           COUNT(CASE WHEN p.St = 3 THEN 1 END) OVER (PARTITION BY p.StationKey) AS RunningCount
    FROM #ops p),
  stations AS (
    SELECT N'WC' + CAST(wc.Id AS NVARCHAR(10)) AS StationKey, wc.ProductionLineId AS LineId, wc.Name AS StationTitle, wc.Number AS StationCode, wc.SequenceNo
    FROM mes.WorkCenter wc WHERE wc.CompanyId = @CompanyId AND wc.IsDeleted = 0 AND ISNULL(wc.IsOutsourced, 0) = 0
    UNION
    SELECT c.StationKey, c.LineId, c.StationTitle, NULL, 999 FROM cur c WHERE c.StationKey NOT LIKE N'WC%' AND c.rn = 1)
  SELECT s.StationKey, CAST(s.LineId AS INT) AS LineId, s.StationTitle, s.StationCode, s.SequenceNo,
         CASE WHEN c.OpId IS NULL OR c.St = 5 THEN 1
              WHEN EXISTS (SELECT 1 FROM mes.WorkOrderOperationProblem pr WHERE pr.WOOperationId = c.OpId AND pr.EndTime IS NULL AND pr.IsDeleted = 0) THEN 4
              WHEN c.St = 4 THEN 3
              WHEN c.RunningCount > 1 THEN 5
              ELSE 2 END AS AndonCode,
         CAST(c.WorkOrderId AS INT) AS WorkOrderId, c.WoNo AS WorkOrderNumber, c.Sequence AS OperationSequence, c.OpName AS OperationTitle,
         c.ToCompleteQuantity, c.CompletedQuantity, c.WastedQuantity, c.StartTime,
         (SELECT TOP (1) pr.ProblemDescription FROM mes.WorkOrderOperationProblem pr WHERE pr.WOOperationId = c.OpId AND pr.EndTime IS NULL AND pr.IsDeleted = 0) AS OpenStopTitle,
         (SELECT TOP (1) pr.StartTime FROM mes.WorkOrderOperationProblem pr WHERE pr.WOOperationId = c.OpId AND pr.EndTime IS NULL AND pr.IsDeleted = 0) AS OpenStopSince,
         c.RunningCount, (SELECT STRING_AGG(c2.WoNo, N'، ') FROM cur c2 WHERE c2.StationKey = s.StationKey AND c2.St = 3) AS RunningOrders,
         CAST(e.A * e.P * e.Q AS DECIMAL(9,4)) AS Oee
  FROM stations s
  LEFT JOIN cur c ON c.StationKey = s.StationKey AND c.rn = 1
  LEFT JOIN #oee e ON e.StationKey = s.StationKey
  ORDER BY s.LineId, s.SequenceNo, s.StationTitle;

  /* پیشرفت دستورهای فعال: پیشرفت آخرین عملیات، پیش‌بینی پایان با نرخ جاری */
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WOTypeCode, w.WorkOrderStatusCode, ln.Name AS LineTitle, p.Number + N' — ' + p.Name AS ProductTitle,
         p.MeasureUnitTitle AS UnitTitle, w.Quantity, w.PlannedCompleteDate, w.DueDate, w.CustomerTitle,
         lo.Sequence AS LastSequence, lo.CompletedQuantity AS LastCompleted, lo.ToCompleteQuantity AS LastToComplete,
         CAST(100.0 * ISNULL(lo.CompletedQuantity, 0) / NULLIF(lo.ToCompleteQuantity, 0) AS DECIMAL(9,1)) AS ProgressPercent,
         (SELECT COUNT(*) FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode = 5) AS OpsDone,
         (SELECT COUNT(*) FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) AS OpsTotal,
         fc.ForecastEnd,
         CASE WHEN fc.ForecastEnd > w.PlannedCompleteDate THEN DATEDIFF(MINUTE, w.PlannedCompleteDate, fc.ForecastEnd) ELSE 0 END AS ForecastDelayMinutes
  FROM mes.WorkOrder w
  JOIN mes.Product p ON p.Id = w.MainProductId
  LEFT JOIN mes.ProductionLine ln ON ln.Id = w.ProductionLineId
  OUTER APPLY (SELECT TOP (1) o.* FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0 AND o.CompletedQuantity > 0 ORDER BY o.Sequence DESC) lo
  OUTER APPLY (SELECT MIN(o.StartTime) AS FirstStart FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) fs
  /* نرخ ساده: زمان سپری‌شده / پیشرفت عملیات انتهایی‌ترین گلوگاه فعال */
  OUTER APPLY (SELECT TOP (1) g.ExpectedReadyDate FROM mes.SubcontractProgress g WHERE g.WorkOrderId = w.Id AND g.IsDeleted = 0 ORDER BY g.ReportedAt DESC) cg
  /* عملیات نزد پیمانکار: پیش‌بینی پیمانکار */
  OUTER APPLY (SELECT CASE WHEN lo.IsOutsourced = 1 THEN cg.ExpectedReadyDate
                           WHEN lo.CompletedQuantity > 0 AND fs.FirstStart IS NOT NULL AND lo.CompletedQuantity < lo.ToCompleteQuantity
                           THEN DATEADD(MINUTE, CAST(DATEDIFF(MINUTE, ISNULL(lo.StartTime, fs.FirstStart), @now) * (lo.ToCompleteQuantity - lo.CompletedQuantity) / lo.CompletedQuantity AS INT), @now) END AS ForecastEnd) fc
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.WorkOrderStatusCode IN (2, 3, 7)
  ORDER BY w.PlannedCompleteDate;

  /* توقف‌های باز */
  SELECT CAST(pr.Id AS INT) AS ProblemId, w.Number AS WorkOrderNumber, o.Sequence AS OperationSequence, op.Name AS OperationTitle, pr.ProblemDescription,
         pr.StartTime, DATEDIFF(MINUTE, pr.StartTime, @now) AS OpenMinutes, pr.ReportedByTitle, ln.Name AS LineTitle
  FROM mes.WorkOrderOperationProblem pr
  JOIN mes.WorkOrderOperation o ON o.Id = pr.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
  LEFT JOIN mes.ProductionLine ln ON ln.Id = ISNULL(wc.ProductionLineId, w.ProductionLineId)
  WHERE pr.CompanyId = @CompanyId AND pr.IsDeleted = 0 AND pr.EndTime IS NULL
  ORDER BY pr.StartTime;
END
GO

/* موتور استثنا (F-PC-092، 093): تشخیص زنده با قواعد فعال + وضعیت ذخیره‌شده‌ی هر هشدار + تشدید زمانی */
CREATE OR ALTER PROCEDURE mes.GetLiveExceptions
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();
  CREATE TABLE #x (RuleTypeCode INT, AlertKey NVARCHAR(128), WorkOrderId BIGINT NULL, OperationSequence INT NULL, RaisedAt DATETIME2 NULL,
                   Measured DECIMAL(32,4) NULL, Limit DECIMAL(32,4) NULL, Subject NVARCHAR(400), Detail NVARCHAR(400) NULL);
  DECLARE @thr TABLE (RuleTypeCode INT PRIMARY KEY, Thr DECIMAL(18,4));
  INSERT @thr SELECT RuleTypeCode, MIN(ThresholdValue) FROM mes.ExceptionRule WHERE CompanyId = @CompanyId AND IsDeleted = 0 AND IsActive = 1 GROUP BY RuleTypeCode;

  /* ۱) انحراف مصرف — روال PC-06 (بدون INSERT…EXEC تو در تو) */
  CREATE TABLE #v (WorkOrderId INT, MaterialId INT, OperationSequence INT, ProductTitle NVARCHAR(400), UnitTitle NVARCHAR(64), PlannedKitQuantity DECIMAL(32,6),
                   ActualKitQuantity DECIMAL(32,6), ToCompleteQuantity DECIMAL(32,6), ProducedAtOperation DECIMAL(32,6), StandardForProduced DECIMAL(32,4),
                   Actual DECIMAL(32,6), MinConsumptionPercent DECIMAL(9,4), MaxConsumptionPercent DECIMAL(9,4), IsActiveIngredient BIT, IsCustomerMaterial BIT,
                   ConsumptionControlCode INT, ConsumptionPolicyCode INT);
  INSERT #v EXEC mes.GetConsumptionVariance @CompanyId = @CompanyId;
  /* استاندارد عیاردار با عیار بچ مصرفی تصحیح می‌شود؛ ردیف جایگزین‌شده جدا (PC-03) بررسی می‌شود؛ دستورهای بسته‌شده نه */
  INSERT #x
  SELECT 1, N'CONS:' + CAST(v.MaterialId AS NVARCHAR(20)), v.WorkOrderId, v.OperationSequence, pc.LastAt,
         CAST(100.0 * v.Actual / s.Std AS DECIMAL(32,4)), ISNULL(v.MaxConsumptionPercent, 100 + t.Thr),
         v.ProductTitle, N'مصرف ' + FORMAT(100.0 * v.Actual / s.Std, '0.0') + N'٪ استاندارد' + CASE WHEN pc.Potency IS NOT NULL THEN N' (تصحیح عیار ' + FORMAT(pc.Potency, '0.0') + N'٪)' ELSE N'' END
  FROM #v v
  JOIN mes.WorkOrder w ON w.Id = v.WorkOrderId
  JOIN mes.WorkOrderOperationMaterial m ON m.Id = v.MaterialId
  JOIN @thr t ON t.RuleTypeCode = 1
  OUTER APPLY (SELECT MAX(c.EndTime) AS LastAt, AVG(c.PotencyPercent) AS Potency FROM mes.WorkOrderOperationMaterialConsumed c WHERE c.WOOperationMaterialId = v.MaterialId AND c.IsDeleted = 0) pc
  CROSS APPLY (SELECT v.StandardForProduced * CASE WHEN pc.Potency > 0 THEN 100.0 / pc.Potency ELSE 1 END AS Std) s
  WHERE w.WorkOrderStatusCode IN (3, 4) AND m.SubstitutedProductId IS NULL AND s.Std > 0 AND v.Actual > 0
    AND (100.0 * v.Actual / s.Std > ISNULL(v.MaxConsumptionPercent, 100 + t.Thr)
      OR 100.0 * v.Actual / s.Std < ISNULL(v.MinConsumptionPercent, 100 - t.Thr));

  /* ۲) تأخیر دستور: پیش‌بینی پایان با نرخ جاری عملیات انتهایی (یا پیش‌بینی پیمانکار) بعد از پایان برنامه */
  INSERT #x
  SELECT 2, N'LATE:' + CAST(w.Id AS NVARCHAR(20)), w.Id, lo.Sequence, COALESCE(lr.LastAt, cg.ReportedAt, IIF(w.PlannedCompleteDate < @now, w.PlannedCompleteDate, @now)), DATEDIFF(MINUTE, w.PlannedCompleteDate, fc.ForecastEnd), t.Thr,
         p.Number + N' — ' + p.Name, N'پیش‌بینی پایان ' + FORMAT(fc.ForecastEnd, 'yyyy-MM-dd HH:mm')
  FROM mes.WorkOrder w JOIN mes.Product p ON p.Id = w.MainProductId JOIN @thr t ON t.RuleTypeCode = 2
  OUTER APPLY (SELECT TOP (1) o.* FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0 AND o.CompletedQuantity > 0 ORDER BY o.Sequence DESC) lo
  OUTER APPLY (SELECT MAX(x.EndTime) AS LastAt FROM mes.WorkOrderOperationOutput x JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId WHERE o.WorkOrderId = w.Id AND x.IsDeleted = 0) lr
  OUTER APPLY (SELECT TOP (1) g.ExpectedReadyDate, g.ReportedAt FROM mes.SubcontractProgress g WHERE g.WorkOrderId = w.Id AND g.IsDeleted = 0 ORDER BY g.ReportedAt DESC) cg
  CROSS APPLY (SELECT CASE WHEN lo.IsOutsourced = 1 THEN cg.ExpectedReadyDate
                           WHEN lo.CompletedQuantity > 0 AND lo.CompletedQuantity < lo.ToCompleteQuantity AND lo.StartTime IS NOT NULL
                           THEN DATEADD(MINUTE, CAST(DATEDIFF(MINUTE, lo.StartTime, @now) * (lo.ToCompleteQuantity - lo.CompletedQuantity) / lo.CompletedQuantity AS INT), @now) END AS ForecastEnd) fc
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.WorkOrderStatusCode IN (2, 3) AND fc.ForecastEnd IS NOT NULL
    AND DATEDIFF(MINUTE, w.PlannedCompleteDate, fc.ForecastEnd) > t.Thr;

  /* ۳) ضایعات بالای آستانه در عملیات جاری */
  INSERT #x
  SELECT 3, N'WASTE:' + CAST(o.Id AS NVARCHAR(20)), o.WorkOrderId, o.Sequence,
         (SELECT MAX(x.EndTime) FROM mes.WorkOrderOperationOutput x WHERE x.WOOperationId = o.Id AND x.IsDeleted = 0),
         CAST(100.0 * o.WastedQuantity / (o.CompletedQuantity + o.WastedQuantity) AS DECIMAL(32,4)), t.Thr, op.Name, N'نرخ ضایعات'
  FROM mes.WorkOrderOperation o JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN @thr t ON t.RuleTypeCode = 3
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode IN (3, 4)
    AND o.CompletedQuantity + o.WastedQuantity > 0 AND 100.0 * o.WastedQuantity / (o.CompletedQuantity + o.WastedQuantity) > t.Thr;

  /* ۴) توقف طولانی */
  INSERT #x
  SELECT 4, N'STOP:' + CAST(pr.Id AS NVARCHAR(20)), o.WorkOrderId, o.Sequence, pr.StartTime, DATEDIFF(MINUTE, pr.StartTime, @now), t.Thr, pr.ProblemDescription, N'توقف باز'
  FROM mes.WorkOrderOperationProblem pr JOIN mes.WorkOrderOperation o ON o.Id = pr.WOOperationId JOIN @thr t ON t.RuleTypeCode = 4
  WHERE pr.CompanyId = @CompanyId AND pr.IsDeleted = 0 AND pr.EndTime IS NULL AND DATEDIFF(MINUTE, pr.StartTime, @now) > t.Thr;

  /* ۵) کسری پای کار: کیت باقی‌مانده کمتر از نیاز مقدار باقی‌مانده‌ی عملیات جاری */
  INSERT #x
  SELECT 5, N'SHORT:' + CAST(m.Id AS NVARCHAR(20)), o.WorkOrderId, o.Sequence, @now,
         CAST(ISNULL(m.ActualKitQuantity, 0) - ISNULL(m.ConsumedQuantity, 0) AS DECIMAL(32,4)),
         CAST(m.StandardQuantity * (o.ToCompleteQuantity - o.CompletedQuantity - o.WastedQuantity) / o.ToCompleteQuantity AS DECIMAL(32,4)),
         p.Number + N' — ' + p.Name, N'مانده‌ی کیت در برابر نیاز باقی‌مانده (' + p.MeasureUnitTitle + N')'
  FROM mes.WorkOrderOperationMaterial m JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.Product p ON p.Id = m.ProductId JOIN @thr t ON t.RuleTypeCode = 5
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND m.IsDeleted = 0 AND o.WorkOrderOperationStatusCode IN (3, 4) AND o.ToCompleteQuantity > 0
    AND ISNULL(m.StandardQuantity, 0) > 0 AND ISNULL(m.ActualKitQuantity, 0) > 0   /* فقط مواد کیت‌شده؛ تغذیه‌ی کششی از پای کار کیت ندارد */
    AND ISNULL(m.ActualKitQuantity, 0) - ISNULL(m.ConsumedQuantity, 0)
        < m.StandardQuantity * (o.ToCompleteQuantity - o.CompletedQuantity - o.WastedQuantity) / o.ToCompleteQuantity * (1 - t.Thr / 100.0) * 0.999;

  /* ۶) هم‌پوشانی ایستگاه: بیش از یک عملیات در حال اجرا روی یک ایستگاه */
  INSERT #x
  SELECT 6, N'OVL:' + CAST(o.WorkCenterId AS NVARCHAR(20)), MIN(o.WorkOrderId), NULL, MAX(o.StartTime), COUNT(*), 1, wc.Name + N' (خط ' + CAST(wc.ProductionLineId AS NVARCHAR(5)) + N')',
         STRING_AGG(w.Number + N'/' + CAST(o.Sequence AS NVARCHAR(5)), N' و ')
  FROM mes.WorkOrderOperation o JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode = 3
    AND EXISTS (SELECT 1 FROM @thr WHERE RuleTypeCode = 6)
  GROUP BY o.WorkCenterId, wc.Name, wc.ProductionLineId HAVING COUNT(*) > 1;

  /* ۷) انحراف نرخ بازیابی */
  INSERT #x
  SELECT 7, N'RECOV:' + CAST(r.Id AS NVARCHAR(20)), o.WorkOrderId, o.Sequence, r.ReceiptDate,
         CAST(100.0 * r.ReceivedToInvQuantity / b.InputQuantity AS DECIMAL(32,4)), COALESCE(ror.RecoveryPercent, rm.StandardRecoveryPercent),
         r.BatchNumber, N'نرخ بازیابی در برابر استاندارد'
  FROM mes.WorkOrderOperationOutputProduct r
  JOIN mes.WorkOrderMaterialBalance b ON b.RecoveryReceiptId = r.Id AND b.IsDeleted = 0
  JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  LEFT JOIN mes.RecoveredMaterial rm ON rm.ProductId = r.FinalProductId AND rm.IsDeleted = 0
  LEFT JOIN mes.RoutingOperationRecovery ror ON ror.RoutingOperationId = o.RoutingOperationId AND ror.RecoveredMaterialId = rm.Id AND ror.IsDeleted = 0
  JOIN @thr t ON t.RuleTypeCode = 7
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0 AND r.OutputTypeCode = 5 AND b.InputQuantity > 0
    AND ABS(100.0 * r.ReceivedToInvQuantity / b.InputQuantity - COALESCE(ror.RecoveryPercent, rm.StandardRecoveryPercent)) > t.Thr;

  /* ۸) رسید بیش از گزارش */
  INSERT #x
  SELECT 8, N'RCPT:' + CAST(x.Id AS NVARCHAR(20)), o.WorkOrderId, o.Sequence, MAX(r.ReceiptDate), SUM(r.ReceivedToInvQuantity + ISNULL(r.QcRejectedQuantity, 0)),
         x.CompletedQuantity, x.ReportNumber, N'رسید در برابر گزارش'
  FROM mes.WorkOrderOperationOutputProduct r JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0 AND r.OutputTypeCode = 1 AND EXISTS (SELECT 1 FROM @thr WHERE RuleTypeCode = 8)
  GROUP BY x.Id, o.WorkOrderId, o.Sequence, x.CompletedQuantity, x.ReportNumber
  HAVING SUM(r.ReceivedToInvQuantity + ISNULL(r.QcRejectedQuantity, 0)) > x.CompletedQuantity * 1.001;

  /* ۹) تأخیر پیمانکار: پیش‌بینی آمادگی بعد از موعد برگشت */
  INSERT #x
  SELECT 9, N'CTR:' + CAST(s.WOOperationId AS NVARCHAR(20)), s.WorkOrderId, o.Sequence, pg.ReportedAt, DATEDIFF(DAY, s.ExpectedReturnDate, pg.ExpectedReadyDate), t.Thr,
         ct.Name, N'روز تأخیر پیش‌بینی‌شده'
  FROM mes.SubcontractShipment s JOIN mes.WorkOrderOperation o ON o.Id = s.WOOperationId JOIN mes.ProductionContractor ct ON ct.Id = s.ContractorId
  CROSS APPLY (SELECT TOP (1) g.ReportedAt, g.ExpectedReadyDate FROM mes.SubcontractProgress g WHERE g.WOOperationId = s.WOOperationId AND g.IsDeleted = 0 ORDER BY g.ReportedAt DESC) pg
  JOIN @thr t ON t.RuleTypeCode = 9
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0 AND s.DirectionCode = 1 AND DATEDIFF(DAY, s.ExpectedReturnDate, pg.ExpectedReadyDate) > t.Thr;

  /* ۱۰) شکاف موازنه */
  INSERT #x
  SELECT 10, N'BAL:' + CAST(b.Id AS NVARCHAR(20)), b.WorkOrderId, o.Sequence, b.PeriodTo,
         CAST(100.0 * (b.InputQuantity - ISNULL(b.OutputQuantity, 0) - ISNULL(b.LossQuantity, 0) - ISNULL(b.InProcessQuantity, 0)) / b.InputQuantity AS DECIMAL(32,4)),
         b.TolerancePercent, CASE b.BalanceTypeCode WHEN 1 THEN N'موازنه‌ی ماده‌ی بازیابی' ELSE N'موازنه‌ی جرم پیوسته' END, x.ReportNumber
  FROM mes.WorkOrderMaterialBalance b JOIN mes.WorkOrderOperation o ON o.Id = b.WOOperationId LEFT JOIN mes.WorkOrderOperationOutput x ON x.Id = b.OperationOutputId
  WHERE b.CompanyId = @CompanyId AND b.IsDeleted = 0 AND b.InputQuantity > 0 AND EXISTS (SELECT 1 FROM @thr WHERE RuleTypeCode = 10)
    AND ABS(100.0 * (b.InputQuantity - ISNULL(b.OutputQuantity, 0) - ISNULL(b.LossQuantity, 0) - ISNULL(b.InProcessQuantity, 0)) / b.InputQuantity) > b.TolerancePercent;

  /* ۱۱) پایانه‌ی برون‌خط با رکورد معوق */
  INSERT #x
  SELECT 11, N'TRM:' + CAST(tm.Id AS NVARCHAR(20)), NULL, NULL, tm.LastSyncAt, tm.PendingRecords, 0, tm.Name, N'رکورد همگام‌نشده'
  FROM mes.ShopFloorTerminal tm
  WHERE tm.CompanyId = @CompanyId AND tm.IsDeleted = 0 AND tm.IsOnline = 0 AND tm.PendingRecords > 0 AND EXISTS (SELECT 1 FROM @thr WHERE RuleTypeCode = 11);

  SELECT x.AlertKey, x.RuleTypeCode, CAST(r.Id AS INT) AS RuleId, r.Number AS RuleCode, r.Name AS RuleTitle, r.SeverityCode, r.ChannelCode, r.OwnerTitle,
         r.EscalationMinutes, r.EscalationOwnerTitle, CAST(x.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, x.OperationSequence,
         ln.Name AS LineTitle, x.RaisedAt, x.Measured, x.Limit, r.ThresholdUnitTitle, x.Subject, x.Detail,
         ISNULL(a.StatusCode, 1) AS StatusCode, a.AcknowledgedAt, a.AcknowledgedByTitle, a.AssignedToTitle, a.Note,
         DATEDIFF(MINUTE, x.RaisedAt, @now) AS AgeMinutes,
         CAST(CASE WHEN ISNULL(a.StatusCode, 1) = 1 AND r.EscalationMinutes IS NOT NULL AND DATEDIFF(MINUTE, x.RaisedAt, @now) > r.EscalationMinutes THEN 1 ELSE 0 END AS BIT) AS IsEscalated
  FROM #x x
  CROSS APPLY (SELECT TOP (1) * FROM mes.ExceptionRule r WHERE r.RuleTypeCode = x.RuleTypeCode AND r.CompanyId = @CompanyId AND r.IsDeleted = 0 AND r.IsActive = 1 ORDER BY r.ThresholdValue) r
  LEFT JOIN mes.WorkOrder w ON w.Id = x.WorkOrderId
  /* خط = خط ایستگاه عملیات اگر ایستگاه دارد (منبع قرضی)، وگرنه خط دستور */
  OUTER APPLY (SELECT TOP (1) wc.ProductionLineId FROM mes.WorkOrderOperation o JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
               WHERE o.WorkOrderId = x.WorkOrderId AND o.Sequence = x.OperationSequence AND o.IsDeleted = 0) ol
  LEFT JOIN mes.ProductionLine ln ON ln.Id = ISNULL(ol.ProductionLineId, w.ProductionLineId)
  LEFT JOIN mes.ExceptionAlert a ON a.AlertKey = x.AlertKey AND a.CompanyId = @CompanyId AND a.IsDeleted = 0
  WHERE ISNULL(a.StatusCode, 1) <> 4
  ORDER BY r.SeverityCode DESC, x.RaisedAt;

  SELECT CAST(Id AS INT) AS RuleId, Number, Name, RuleTypeCode, ThresholdValue, ThresholdUnitTitle, SeverityCode, ChannelCode, OwnerTitle, EscalationMinutes,
         EscalationOwnerTitle, IsActive, Description
  FROM mes.ExceptionRule WHERE CompanyId = @CompanyId AND IsDeleted = 0 ORDER BY RuleTypeCode, Number;
END
GO

/* انحراف‌ها با علت (درخت قدیم ProductionPlanDeviation) و اقدام اصلاحی؛ recordset دوم: درخت با شمار استفاده (F-PC-094) */
CREATE OR ALTER PROCEDURE mes.GetWorkOrderDeviations
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(d.Id AS INT) AS DeviationId, CAST(d.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, o.Sequence AS OperationSequence,
         CAST(pd.Id AS INT) AS CauseId, pd.Number AS CauseCode, pd.Name AS CauseTitle, pp.Name AS CauseParentTitle, pd.DeviationTypeCode,
         d.PlannedValue, d.ActualValue, d.RecordedAt, d.RecordedByTitle, d.CorrectiveActionTitle,
         d.CorrectiveActionOwnerTitle, d.CorrectiveActionDueDate, d.CorrectiveActionStatusCode, d.CorrectiveActionRef, d.Description
  FROM mes.WorkOrderDeviation d
  JOIN mes.WorkOrder w ON w.Id = d.WorkOrderId
  JOIN mes.ProductionPlanDeviation pd ON pd.Id = d.ProductionPlanDeviationId
  LEFT JOIN mes.ProductionPlanDeviation pp ON pp.Id = pd.ParentId
  LEFT JOIN mes.WorkOrderOperation o ON o.Id = d.WOOperationId
  WHERE d.CompanyId = @CompanyId AND d.IsDeleted = 0
  ORDER BY d.RecordedAt DESC;

  SELECT CAST(c.Id AS INT) AS CauseId, c.Number, c.Name, CAST(c.ParentId AS INT) AS ParentId, c.DeviationTypeCode, c.SortOrder,
         (SELECT COUNT(*) FROM mes.WorkOrderDeviation d WHERE d.ProductionPlanDeviationId = c.Id AND d.IsDeleted = 0) AS UsageCount
  FROM mes.ProductionPlanDeviation c WHERE c.CompanyId = @CompanyId AND c.IsDeleted = 0 AND c.IsActive = 1 ORDER BY c.DeviationTypeCode, c.Number;
END
GO
/* کار در جریان (F-PC-098) به تفکیک عملیات: دریافتی از مرحله‌ی قبل − تکمیل − ضایعات − دوباره‌کاری */
CREATE OR ALTER PROCEDURE mes.GetWipSummary
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WOTypeCode, ln.Name AS LineTitle, CAST(w.ProductionLineId AS INT) AS LineId,
         o.Sequence, op.Name AS OperationTitle, o.WorkOrderOperationStatusCode AS StatusCode, o.IsOutsourced,
         ISNULL(mo.MeasureUnitTitle, p.MeasureUnitTitle) AS UnitTitle, o.ToCompleteQuantity, rc.Received, o.CompletedQuantity, o.WastedQuantity, o.ReworkQuantity,
         CAST(rc.Received - o.CompletedQuantity - o.WastedQuantity - ISNULL(o.ReworkQuantity, 0) AS DECIMAL(32,4)) AS InProcess,
         CAST(CASE WHEN w.Quantity > 0 THEN (rc.Received - o.CompletedQuantity - o.WastedQuantity - ISNULL(o.ReworkQuantity, 0)) * 100.0 / o.ToCompleteQuantity END AS DECIMAL(9,2)) AS InProcessPercent,
         (SELECT COUNT(*) FROM mes.WorkOrderOperation k WHERE k.WorkOrderId = w.Id AND k.IsDeleted = 0 AND k.Sequence <= o.Sequence) * 1.0
           / NULLIF((SELECT COUNT(*) FROM mes.WorkOrderOperation k WHERE k.WorkOrderId = w.Id AND k.IsDeleted = 0), 0) AS StageFraction
  FROM mes.WorkOrderOperation o
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.Product p ON p.Id = w.MainProductId
  LEFT JOIN mes.Product mo ON mo.Id = o.MainOutputProductId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.ProductionLine ln ON ln.Id = w.ProductionLineId
  OUTER APPLY (SELECT TOP (1) pv.OperationId FROM mes.WorkOrderOperation pv WHERE pv.WorkOrderId = w.Id AND pv.IsDeleted = 0 AND pv.Sequence < o.Sequence AND pv.OperationId <> o.OperationId ORDER BY pv.Sequence DESC) pvo
  CROSS APPLY (SELECT CAST(CASE
                 WHEN pvo.OperationId IS NULL THEN CASE WHEN o.WorkOrderOperationStatusCode IN (3, 4, 5, 6) THEN ISNULL(NULLIF(o.ReceivedQuantity, 0), o.ToCompleteQuantity) ELSE 0 END
                 WHEN ISNULL(o.ReceivedQuantity, 0) > 0 THEN o.ReceivedQuantity
                 ELSE (SELECT SUM(pv.CompletedQuantity) FROM mes.WorkOrderOperation pv WHERE pv.WorkOrderId = w.Id AND pv.IsDeleted = 0 AND pv.OperationId = pvo.OperationId AND pv.Sequence < o.Sequence)
                      * o.ToCompleteQuantity / NULLIF((SELECT SUM(sg.ToCompleteQuantity) FROM mes.WorkOrderOperation sg WHERE sg.WorkOrderId = w.Id AND sg.IsDeleted = 0 AND sg.OperationId = o.OperationId), 0)
               END AS DECIMAL(32,4)) AS Received) rc
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND o.IsDeleted = 0 AND w.WorkOrderStatusCode IN (3, 7)
    AND rc.Received - o.CompletedQuantity - o.WastedQuantity - ISNULL(o.ReworkQuantity, 0) > 0.0001
  ORDER BY ln.Name, w.Number, o.Sequence;
END
GO

/* آمادگی بستن (F-PC-096، 097): کنترل‌ها برای دستورهای تکمیل/معلق/بسته؛ recordset دوم: رویدادهای بستن و بازگشایی */
CREATE OR ALTER PROCEDURE mes.GetCloseReadiness
  @CompanyId BIGINT,
  @AutoCloseDays INT = 30
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WOTypeCode, w.WorkOrderStatusCode, p.Number + N' — ' + p.Name AS ProductTitle,
         w.BatchNumber, w.ActualCompleteDate, w.CloseDate,
         (SELECT COUNT(*) FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode <> 5) AS OpsOpen,
         (SELECT COUNT(*) FROM mes.WorkOrderOperationMaterial m JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
          WHERE o.WorkOrderId = w.Id AND m.IsDeleted = 0 AND ISNULL(m.StandardQuantity, 0) > 0 AND o.CompletedQuantity + o.WastedQuantity > 0
            AND NOT EXISTS (SELECT 1 FROM mes.WorkOrderOperationMaterialConsumed c WHERE c.WOOperationMaterialId = m.Id AND c.IsDeleted = 0)) AS ConsumptionMissing,
         (SELECT COUNT(*) FROM mes.WorkOrderOperationMaterial m JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
          WHERE o.WorkOrderId = w.Id AND m.IsDeleted = 0 AND ISNULL(m.ActualKitQuantity, 0) - ISNULL(m.ConsumedQuantity, 0) - ISNULL(m.ReturnedQuantity, 0) > 0.001) AS ExcessNotReturned,
         (SELECT COUNT(*) FROM mes.NonconformingDisposition d WHERE d.WorkOrderId = w.Id AND d.IsDeleted = 0 AND d.DecisionStatusCode = 1) AS PendingDispositions,
         (SELECT COUNT(*) FROM mes.NonconformingDisposition d WHERE d.WorkOrderId = w.Id AND d.IsDeleted = 0 AND d.DecisionStatusCode = 2) AS UnexecutedDispositions,
         (SELECT COUNT(*) FROM mes.WorkOrderProduct wp WHERE wp.WorkOrderId = w.Id AND wp.IsDeleted = 0 AND wp.OutputTypeCode IN (2, 3, 5)
            AND NOT EXISTS (SELECT 1 FROM mes.WorkOrderOperationOutputProduct r JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId
                            JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId WHERE o.WorkOrderId = w.Id AND r.FinalProductId = wp.ProductId AND r.IsDeleted = 0)) AS OutputsNotReceived,
         (SELECT COUNT(*) FROM mes.WorkOrderOperationOutputProduct r JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId
          JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId WHERE o.WorkOrderId = w.Id AND r.IsDeleted = 0 AND r.QcStatusCode = 1) AS QcPending,
         CASE WHEN w.WorkOrderStatusCode = 7 THEN DATEDIFF(DAY, ISNULL((SELECT MAX(x.EndTime) FROM mes.WorkOrderOperationOutput x JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
                                                                        WHERE o.WorkOrderId = w.Id AND x.IsDeleted = 0), w.ActualReleaseDate), @now) END AS SuspendedDays,
         @AutoCloseDays AS AutoCloseDays
  INTO #r
  FROM mes.WorkOrder w JOIN mes.Product p ON p.Id = w.MainProductId
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.WorkOrderStatusCode IN (4, 5, 7);

  SELECT r.*, CAST(CASE WHEN r.OpsOpen = 0 AND r.ConsumptionMissing = 0 AND r.ExcessNotReturned = 0 AND r.PendingDispositions = 0 AND r.UnexecutedDispositions = 0
                             AND r.OutputsNotReceived = 0 AND r.QcPending = 0 THEN 1 ELSE 0 END AS BIT) AS CanClose,
         CAST(CASE WHEN r.WorkOrderStatusCode = 7 AND r.SuspendedDays > r.AutoCloseDays THEN 1 ELSE 0 END AS BIT) AS IsAutoCloseCandidate
  FROM #r r ORDER BY r.WorkOrderStatusCode, r.WorkOrderNumber;

  SELECT CAST(e.Id AS INT) AS EventId, CAST(e.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, e.EventTypeCode, e.EventAt, e.ByTitle, e.Reason,
         e.ApprovalStatusCode, e.ApproverTitle, e.CostingEventNumber, e.CostingStatusCode, e.Description
  FROM mes.WorkOrderCloseEvent e JOIN mes.WorkOrder w ON w.Id = e.WorkOrderId
  WHERE e.CompanyId = @CompanyId AND e.IsDeleted = 0 ORDER BY e.EventAt DESC;
END
GO

/* پیش‌نمایش رویداد بستن برای بهای تمام‌شده (F-PC-099): سربرگ، مواد، منابع، خروجی‌ها */
CREATE OR ALTER PROCEDURE mes.GetCostingEventPreview
  @CompanyId BIGINT,
  @WorkOrderId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WOTypeCode, w.WorkOrderStatusCode, p.Number AS ProductCode, p.Name AS ProductTitle,
         p.MeasureUnitTitle AS UnitTitle, w.Quantity AS PlannedQuantity, w.BatchNumber, mv.Number AS ManufacturingVersion, ln.Number AS LineCode,
         w.ActualReleaseDate, w.ActualCompleteDate, w.CloseDate, w.CustomerTitle, CAST(w.RefWorkOrderId AS INT) AS RefWorkOrderId,
         (SELECT SUM(o.WastedQuantity) FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) AS WastedTotal,
         (SELECT SUM(d.CostAmount) FROM mes.NonconformingDisposition d WHERE d.WorkOrderId = w.Id AND d.IsDeleted = 0) AS NonconformanceCost
  FROM mes.WorkOrder w
  JOIN mes.Product p ON p.Id = w.MainProductId
  LEFT JOIN mes.ManufacturingVersion mv ON mv.Id = w.ManufacturingVersionId
  LEFT JOIN mes.ProductionLine ln ON ln.Id = w.ProductionLineId
  WHERE w.CompanyId = @CompanyId AND w.Id = @WorkOrderId AND w.IsDeleted = 0;

  SELECT p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, m.IsCustomerMaterial,
         SUM(ISNULL(m.StandardQuantity, 0)) AS StandardQuantity,
         SUM(ISNULL(a.Actual, 0)) AS ActualQuantity, SUM(ISNULL(m.ReturnedQuantity, 0)) AS ReturnedQuantity
  FROM mes.WorkOrderOperationMaterial m JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.Product p ON p.Id = m.ProductId
  OUTER APPLY (SELECT SUM(CASE WHEN c.IsReversal = 1 THEN -c.ConsumedQuantity ELSE c.ConsumedQuantity END) AS Actual
               FROM mes.WorkOrderOperationMaterialConsumed c WHERE c.WOOperationMaterialId = m.Id AND c.IsDeleted = 0) a
  WHERE o.WorkOrderId = @WorkOrderId AND m.IsDeleted = 0 AND m.CompanyId = @CompanyId
  GROUP BY p.Number, p.Name, p.MeasureUnitTitle, m.IsCustomerMaterial ORDER BY p.Number;

  SELECT ct.Number AS CapacityCode, ct.Name AS CapacityTitle, ct.MeasureUnitTitle AS UnitTitle, SUM(u.Quantity) AS Quantity
  FROM mes.WorkOrderOperationCapacityUsage u JOIN mes.WorkOrderOperation o ON o.Id = u.WOOperationId JOIN mes.CapacityType ct ON ct.Id = u.CapacityTypeId
  WHERE o.WorkOrderId = @WorkOrderId AND u.IsDeleted = 0 AND u.CompanyId = @CompanyId
  GROUP BY ct.Number, ct.Name, ct.MeasureUnitTitle, ct.SortOrder ORDER BY ct.SortOrder;

  SELECT r.OutputTypeCode, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, r.BatchNumber,
         SUM(r.ReceivedToInvQuantity) AS Received, SUM(ISNULL(r.QcRejectedQuantity, 0)) AS Rejected, MAX(r.CostSharePercent) AS CostSharePercent, MAX(r.ValuationRate) AS ValuationRate
  FROM mes.WorkOrderOperationOutputProduct r JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.Product p ON p.Id = r.FinalProductId
  WHERE o.WorkOrderId = @WorkOrderId AND r.IsDeleted = 0 AND r.CompanyId = @CompanyId
  GROUP BY r.OutputTypeCode, p.Number, p.Name, p.MeasureUnitTitle, r.BatchNumber ORDER BY r.OutputTypeCode, p.Number;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.ExceptionRule خالی است.
   عمداً: هشدار توقف پانچ دیده شده ولی رفع نشده؛ هشدار هم‌پوشانی خشک‌کن بی‌پاسخ مانده و تشدید می‌شود؛ درخواست بازگشایی
   WO-0498 منتظر تأیید است؛ اقدام اصلاحی پانچ یدک سررسیدش گذشته.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ExceptionRule)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222, @now DATETIME2 = mes.fnShopNow();

  INSERT mes.ExceptionRule (CompanyId, Number, Name, RuleTypeCode, ThresholdValue, ThresholdUnitTitle, SeverityCode, ChannelCode, OwnerTitle, EscalationMinutes, EscalationOwnerTitle, Description)
  VALUES (@C, N'EX-01', N'مصرف خارج از محدوده', 1, 2, N'٪', 2, 1, N'سرپرست تولید', 120, N'مدیر تولید', N'محدوده‌ی ساختار (PE-02) اگر باشد، وگرنه ±آستانه'),
         (@C, N'EX-02', N'تأخیر دستور از برنامه', 2, 60, N'دقیقه', 2, 1, N'برنامه‌ریز تولید', 240, N'مدیر برنامه‌ریزی', NULL),
         (@C, N'EX-03', N'ضایعات بالای آستانه', 3, 1.5, N'٪', 2, 4, N'سرپرست کیفیت خط', 60, N'مدیر کیفیت', NULL),
         (@C, N'EX-04', N'توقف طولانی', 4, 30, N'دقیقه', 3, 2, N'سرپرست نگهداری', 45, N'مدیر فنی', N'پیامک به نگهداری + آندون'),
         (@C, N'EX-05', N'کسری پای کار', 5, 0, N'مقدار', 3, 1, N'انباردار پای کار', 30, N'سرپرست انبار', NULL),
         (@C, N'EX-06', N'هم‌پوشانی ایستگاه', 6, 1, N'عملیات', 3, 1, N'برنامه‌ریز تولید', 30, N'مدیر تولید', N'یک ایستگاه، دو عملیات هم‌زمان'),
         (@C, N'EX-07', N'انحراف نرخ بازیابی', 7, 5, N'واحد درصد', 2, 3, N'مسئول بازیافت حلال', 240, N'مدیر فنی', NULL),
         (@C, N'EX-08', N'رسید بیش از گزارش', 8, 0, N'٪', 2, 1, N'کنترل موجودی', 480, N'مدیر انبار', NULL),
         (@C, N'EX-09', N'تأخیر پیمانکار', 9, 0, N'روز', 2, 3, N'کارشناس برون‌سپاری', 1440, N'مدیر تأمین', NULL),
         (@C, N'EX-10', N'شکاف موازنه', 10, NULL, N'٪', 2, 1, N'مهندس فرایند', 240, N'مدیر فنی', N'تلورانس از خود اندازه‌گیری'),
         (@C, N'EX-11', N'پایانه‌ی برون‌خط', 11, 0, N'رکورد', 1, 1, N'پشتیبانی فناوری', 60, N'مدیر فناوری', NULL);

  /* وضعیت چند هشدار */
  INSERT mes.ExceptionAlert (CompanyId, RuleId, AlertKey, StatusCode, AcknowledgedAt, AcknowledgedByTitle, AssignedToTitle, Note)
  SELECT @C, r.Id, N'STOP:' + CAST(pr.Id AS NVARCHAR(20)), 3, '2026-10-09 10:46', N'سرپرست نگهداری', N'تکنسین ابزار', N'ست یدک TL-206 از انبار ابزار درخواست شد'
  FROM mes.ExceptionRule r CROSS JOIN mes.WorkOrderOperationProblem pr
  WHERE r.Number = N'EX-04' AND r.CompanyId = @C AND pr.EndTime IS NULL AND pr.ProblemDescription LIKE N'%پانچ%';
  INSERT mes.ExceptionAlert (CompanyId, RuleId, AlertKey, StatusCode, AcknowledgedAt, AcknowledgedByTitle, Note)
  SELECT @C, r.Id, N'CTR:' + CAST(s.WOOperationId AS NVARCHAR(20)), 2, '2026-10-09 10:05', N'کارشناس برون‌سپاری', N'با پارس‌دارو تماس گرفته شد'
  FROM mes.ExceptionRule r CROSS JOIN mes.SubcontractShipment s WHERE r.Number = N'EX-09' AND r.CompanyId = @C AND s.Number = N'SH-1405-0141';

  /* انحراف‌ها */
  INSERT mes.WorkOrderDeviation (CompanyId, WorkOrderId, WOOperationId, ProductionPlanDeviationId, PlannedValue, ActualValue, RecordedAt, RecordedByTitle,
         CorrectiveActionTitle, CorrectiveActionOwnerTitle, CorrectiveActionDueDate, CorrectiveActionStatusCode, CorrectiveActionRef, Description)
  SELECT @C, w.Id, o.Id, pd.Id, v.Pl, v.Ac, v.At, v.ByT, v.Ca, v.CaOwner, v.Due, v.CaSt, v.Ref, v.Note
  FROM (VALUES
    (N'WO-1405-0506', 40, N'DV-32', N'۱۷ مهر ۲۰:۰۰', N'پیش‌بینی ۱۹ مهر', CAST('2026-10-08 22:10' AS DATETIME2), N'سرپرست شیفت عصر',
     N'قاعده‌ی جابه‌جایی منبع بین خطوط با تأیید برنامه‌ریزی', N'مدیر برنامه‌ریزی', CAST('2026-10-20' AS DATE), 1, NULL, N'پرس خط ۱ به دستور فوری WO-0501 داده شد'),
    (N'WO-1405-0501', 45, N'DV-22', N'۱۸۰٬۰۰۰ قرص', N'۹۶٬۵۰۰ تا الان', CAST('2026-10-09 10:50' AS DATETIME2), N'سرپرست خط ۲',
     N'افزایش موجودی ست پانچ یدک به دو ست', N'سرپرست نگهداری', CAST('2026-10-05' AS DATE), 2, N'CAPA-1405-031', N'شکستگی پانچ بالایی ایستگاه ۱۴'),
    (N'WO-1405-0503', 10, N'DV-2', N'۲۰ مهر', N'پیش‌بینی ۲۲ مهر', CAST('2026-10-09 10:00' AS DATETIME2), N'کارشناس برون‌سپاری',
     N'ارزیابی بسته‌بندی نوین به‌عنوان پیمانکار روکش جایگزین', N'مدیر تأمین', CAST('2026-10-15' AS DATE), 1, NULL, N'یکی از دو پان روکش پارس‌دارو در تعمیر'),
    (N'WO-1405-0507', 20, N'DV-12', N'بازیابی ۸۰٪', N'۶۲٪', CAST('2026-10-09 10:30' AS DATETIME2), N'مسئول بازیافت حلال',
     N'رسوب‌زدایی مبدل کندانسور و پایش دمای آب برگشتی', N'تأسیسات', CAST('2026-10-10' AS DATE), 2, NULL, NULL),
    (N'WO-1405-0498', 50, N'DV-12', N'۰٪ دوباره‌کاری', N'۳٫۸٪ (۱۱٬۴۰۰ قرص)', CAST('2026-10-03 13:00' AS DATETIME2), N'مدیر تضمین کیفیت',
     N'تغییر تأمین‌کننده‌ی پودر روکش و آزمون ورود', N'تضمین کیفیت', CAST('2026-10-08' AS DATE), 3, N'CAPA-1405-027', NULL)
  ) v(Wo, Seq, Dev, Pl, Ac, At, ByT, Ca, CaOwner, Due, CaSt, Ref, Note)
  JOIN mes.WorkOrder w ON w.Number = v.Wo AND w.CompanyId = @C
  LEFT JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = v.Seq
  JOIN mes.ProductionPlanDeviation pd ON pd.Number = v.Dev AND pd.CompanyId = @C;

  /* بستن و بازگشایی */
  INSERT mes.WorkOrderCloseEvent (CompanyId, WorkOrderId, EventTypeCode, EventAt, ByTitle, Reason, ApprovalStatusCode, ApproverTitle, CostingEventNumber, CostingStatusCode, Description)
  SELECT @C, w.Id, v.Ev, v.At, v.ByT, v.Reason, v.Ap, v.Approver, v.Ce, v.Cs, v.Note
  FROM (VALUES
    (N'WO-1405-0498', 1, CAST('2026-10-06 02:00' AS DATETIME2), N'سرپرست برنامه‌ریزی', NULL, NULL, NULL, N'CE-1405-0612', 3, N'تسویه‌ی بهای تمام‌شده انجام شد'),
    (N'WO-1405-0498', 3, CAST('2026-10-09 08:40' AS DATETIME2), N'حسابدار صنعتی', N'انتقال هزینه‌ی دوباره‌کاری WO-0510 به بچ اصلی', 1, N'مدیر برنامه‌ریزی', NULL, NULL, N'منتظر تأیید'),
    (N'WO-1405-0513', 1, CAST('2026-10-07 11:00' AS DATETIME2), N'سرپرست برنامه‌ریزی', N'ابطال پیش از شروع — بدون هزینه', NULL, NULL, N'CE-1405-0640', 2, NULL)
  ) v(Wo, Ev, At, ByT, Reason, Ap, Approver, Ce, Cs, Note)
  JOIN mes.WorkOrder w ON w.Number = v.Wo AND w.CompanyId = @C;


  COMMIT;
END
GO
