/* =====================================================================
   اسکیمای mes — گام ۴۳: FRM-PC-13 «اتاق جلسه‌ی کنترل تولید» (BI سناریومحور)

   هدف: تکیه‌گاه جلسه‌ی هفتگی کنترل تولید (پایان هفته). سفارش‌ها را یکی‌یکی یا در بازه بررسی می‌کند، زمان را
   جلو و عقب می‌برد و مشکلات را با اثرشان رتبه‌بندی می‌کند. جدول تازه ندارد؛ فقط روی جدول‌های اجرای PC-01 تا PC-12
   سه نمای تحلیلی می‌سازد:
     mes.GetBiOrderFacts   یک ردیف واقعیت به‌ازای هر دستور (برنامه، واقعی، پیش‌بینی، تولید، ضایعات، توقف، هزینه‌ی کیفیت…)
     mes.GetBiEvents       «جریان رویداد» یکپارچه‌ی همه‌ی رخدادهای اجرا در یک بازه — پایه‌ی ماشین زمان و مسیر سفارش
     mes.GetBiDailyLine    ماتریس روز × خط: تولید، ضایعات، توقف، گزارش، هشدار

   ثبت در ALM: فرم FRM-PC-13 و منوی 45013 زیر «کنترل تولید» (هر دو فقط اگر نباشند).
   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* واقعیت دستورها */
CREATE OR ALTER PROCEDURE mes.GetBiOrderFacts
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.Name AS WorkOrderTitle, w.WOTypeCode, w.WorkOrderStatusCode, w.WorkOrderPriorityCode AS PriorityCode,
         CAST(w.ProductionLineId AS INT) AS LineId, ln.Name AS LineTitle, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle,
         p.MeasureUnitTitle AS UnitTitle, w.Quantity, w.BatchNumber, w.CustomerTitle, CAST(w.RefWorkOrderId AS INT) AS RefWorkOrderId, rw.Number AS RefWorkOrderNumber,
         w.PlannedReleaseDate, w.PlannedCompleteDate, w.DueDate, w.ActualReleaseDate, w.ActualCompleteDate, w.CloseDate,
         mv.Number AS VersionCode, w.IsVersionOverridden,
         ops.OpsTotal, ops.OpsDone, ops.OpsRunning, ops.OpsPaused, ops.OpsOutsourced, ops.FirstStart, ops.LastEnd, ops.StdMinutes,
         lo.Sequence AS LastSequence, ISNULL(lo.CompletedQuantity, 0) AS GoodOutput, lo.ToCompleteQuantity AS LastToComplete,
         ops.WastedTotal, ops.ReworkTotal,
         ISNULL(st.StopMinutes, 0) AS StopMinutes, ISNULL(st.OpenStops, 0) AS OpenStops, ISNULL(st.StopCount, 0) AS StopCount,
         ISNULL(rc.Received, 0) AS Received, ISNULL(rc.QcPending, 0) AS QcPending, ISNULL(rc.Rejected, 0) AS Rejected,
         ISNULL(nc.Cost, 0) AS NcCost, ISNULL(nc.Pending, 0) AS NcPending, ISNULL(nc.Cases, 0) AS NcCases,
         ISNULL(rp.Reports, 0) AS Reports, rp.LastReportAt,
         (SELECT STRING_AGG(r.Number, N'، ') FROM mes.ProductionRequestWorkOrder l JOIN mes.ProductionRequest r ON r.Id = l.ProductionRequestId
          WHERE l.WorkOrderId = w.Id AND l.IsDeleted = 0) AS Requests,
         ct.Name AS ContractorTitle, cg.ExpectedReadyDate AS ContractorReadyDate,
         fc.ForecastEnd,
         CASE WHEN fc.ForecastEnd > w.PlannedCompleteDate THEN DATEDIFF(MINUTE, w.PlannedCompleteDate, fc.ForecastEnd) ELSE 0 END AS ForecastDelayMinutes,
         (SELECT COUNT(*) FROM mes.WorkOrderDeviation d WHERE d.WorkOrderId = w.Id AND d.IsDeleted = 0) AS Deviations
  FROM mes.WorkOrder w
  JOIN mes.Product p ON p.Id = w.MainProductId
  LEFT JOIN mes.ProductionLine ln ON ln.Id = w.ProductionLineId
  LEFT JOIN mes.WorkOrder rw ON rw.Id = w.RefWorkOrderId
  LEFT JOIN mes.ManufacturingVersion mv ON mv.Id = w.ManufacturingVersionId
  OUTER APPLY (SELECT COUNT(*) AS OpsTotal, SUM(CASE WHEN o.WorkOrderOperationStatusCode = 5 THEN 1 ELSE 0 END) AS OpsDone,
                      SUM(CASE WHEN o.WorkOrderOperationStatusCode = 3 THEN 1 ELSE 0 END) AS OpsRunning,
                      SUM(CASE WHEN o.WorkOrderOperationStatusCode = 4 THEN 1 ELSE 0 END) AS OpsPaused,
                      SUM(CASE WHEN o.WorkOrderOperationStatusCode = 6 THEN 1 ELSE 0 END) AS OpsOutsourced,
                      MIN(o.StartTime) AS FirstStart, MAX(o.EndTime) AS LastEnd, SUM(o.WastedQuantity) AS WastedTotal, SUM(ISNULL(o.ReworkQuantity, 0)) AS ReworkTotal,
                      CAST(SUM(ISNULL(t.SetupTimePerBatch, 0) + o.ToCompleteQuantity * IIF(ISNULL(t.EquipmentRunTimePerPart, 0) > ISNULL(t.LaborRunTimePerPart, 0),
                           ISNULL(t.EquipmentRunTimePerPart, 0), ISNULL(t.LaborRunTimePerPart, 0))) AS DECIMAL(18,1)) AS StdMinutes
               FROM mes.WorkOrderOperation o LEFT JOIN mes.RoutingOperationTiming t ON t.RoutingOperationId = o.RoutingOperationId AND t.IsDeleted = 0
               WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) ops
  OUTER APPLY (SELECT TOP (1) o.* FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0 AND o.CompletedQuantity > 0 ORDER BY o.Sequence DESC) lo
  OUTER APPLY (SELECT SUM(DATEDIFF(MINUTE, pr.StartTime, ISNULL(pr.EndTime, @now))) AS StopMinutes, SUM(CASE WHEN pr.EndTime IS NULL THEN 1 ELSE 0 END) AS OpenStops, COUNT(*) AS StopCount
               FROM mes.WorkOrderOperationProblem pr JOIN mes.WorkOrderOperation o ON o.Id = pr.WOOperationId
               WHERE o.WorkOrderId = w.Id AND pr.IsDeleted = 0 AND pr.IsStoppageCause = 1) st
  OUTER APPLY (SELECT SUM(CASE WHEN r.OutputTypeCode = 1 THEN r.ReceivedToInvQuantity END) AS Received,
                      SUM(CASE WHEN r.OutputTypeCode = 1 AND r.QcStatusCode = 1 THEN r.ReceivedToInvQuantity END) AS QcPending,
                      SUM(r.QcRejectedQuantity) AS Rejected
               FROM mes.WorkOrderOperationOutputProduct r JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
               WHERE o.WorkOrderId = w.Id AND r.IsDeleted = 0) rc
  OUTER APPLY (SELECT SUM(d.CostAmount) AS Cost, SUM(CASE WHEN d.DecisionStatusCode = 1 THEN 1 ELSE 0 END) AS Pending, COUNT(*) AS Cases
               FROM mes.NonconformingDisposition d WHERE d.WorkOrderId = w.Id AND d.IsDeleted = 0) nc
  OUTER APPLY (SELECT COUNT(*) AS Reports, MAX(x.EndTime) AS LastReportAt FROM mes.WorkOrderOperationOutput x JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
               WHERE o.WorkOrderId = w.Id AND x.IsDeleted = 0) rp
  OUTER APPLY (SELECT TOP (1) s.ContractorId FROM mes.SubcontractShipment s WHERE s.WorkOrderId = w.Id AND s.DirectionCode = 1 AND s.IsDeleted = 0) sh
  LEFT JOIN mes.ProductionContractor ct ON ct.Id = sh.ContractorId
  OUTER APPLY (SELECT TOP (1) g.ExpectedReadyDate FROM mes.SubcontractProgress g WHERE g.WorkOrderId = w.Id AND g.IsDeleted = 0 ORDER BY g.ReportedAt DESC) cg
  OUTER APPLY (SELECT CASE WHEN w.WorkOrderStatusCode IN (4, 5) THEN w.ActualCompleteDate
                           WHEN lo.IsOutsourced = 1 THEN cg.ExpectedReadyDate
                           WHEN lo.CompletedQuantity > 0 AND lo.CompletedQuantity < lo.ToCompleteQuantity AND lo.StartTime IS NOT NULL
                           THEN DATEADD(MINUTE, CAST(DATEDIFF(MINUTE, lo.StartTime, @now) * (lo.ToCompleteQuantity - lo.CompletedQuantity) / lo.CompletedQuantity AS INT), @now) END AS ForecastEnd) fc
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0
  ORDER BY w.Number;
END
GO

/* جریان رویداد یکپارچه در یک بازه: هر رخداد اجرا با زمان، دستور، خط، دسته، شدت و مقدار */
CREATE OR ALTER PROCEDURE mes.GetBiEvents
  @CompanyId BIGINT,
  @From DATETIME2,
  @To DATETIME2
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();
  ;WITH e AS (
    /* درخواست و تأیید */
    SELECT CAST(r.RequestDate AS DATETIME2) AS At, N'REQ' AS Kind, 1 AS Severity, CAST(NULL AS BIGINT) AS WorkOrderId, CAST(NULL AS BIGINT) AS LineId, CAST(NULL AS INT) AS Seq,
           r.Number + N' — ثبت درخواست' AS Title, p.Name AS Detail, r.Quantity AS Qty, CAST(NULL AS INT) AS Minutes, r.Number AS Ref
    FROM mes.ProductionRequest r JOIN mes.Product p ON p.Id = r.ProductId WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
    UNION ALL
    SELECT a.DecisionDate, N'APPROVE', CASE WHEN a.DecisionCode = 2 THEN 2 ELSE 0 END, NULL, NULL, NULL,
           r.Number + CASE a.DecisionCode WHEN 1 THEN N' — تأیید ' WHEN 2 THEN N' — رد ' ELSE N' — ' END + a.ApproverRoleTitle, a.Comment, NULL, NULL, r.Number
    FROM mes.ProductionRequestApproval a JOIN mes.ProductionRequest r ON r.Id = a.ProductionRequestId WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0 AND a.DecisionDate IS NOT NULL
    UNION ALL
    /* چرخه‌ی دستور */
    SELECT w.ActualReleaseDate, N'RELEASE', 0, w.Id, w.ProductionLineId, NULL, w.Number + N' — آزادسازی', w.Name, w.Quantity, NULL, w.Number
    FROM mes.WorkOrder w WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.ActualReleaseDate IS NOT NULL AND w.WorkOrderStatusCode <> 6
    UNION ALL
    SELECT w.ActualCompleteDate, N'COMPLETE', 0, w.Id, w.ProductionLineId, NULL, w.Number + N' — تکمیل', NULL, w.Quantity, NULL, w.Number
    FROM mes.WorkOrder w WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.WorkOrderStatusCode IN (4, 5) AND w.ActualCompleteDate IS NOT NULL
    UNION ALL
    SELECT ce.EventAt, N'CLOSE', CASE WHEN ce.EventTypeCode = 3 THEN 2 ELSE 0 END, w.Id, w.ProductionLineId, NULL,
           w.Number + CASE ce.EventTypeCode WHEN 1 THEN N' — بستن' WHEN 2 THEN N' — بستن خودکار' WHEN 3 THEN N' — درخواست بازگشایی' ELSE N' — بازگشایی' END, ce.Reason, NULL, NULL, ce.CostingEventNumber
    FROM mes.WorkOrderCloseEvent ce JOIN mes.WorkOrder w ON w.Id = ce.WorkOrderId WHERE ce.CompanyId = @CompanyId AND ce.IsDeleted = 0
    UNION ALL
    SELECT cl.ChangeDate, N'CHANGE', 1, w.Id, w.ProductionLineId, NULL, w.Number + N' — تغییر ' + cl.FieldTitle, ISNULL(cl.OldValue, N'') + N' ← ' + ISNULL(cl.NewValue, N''), NULL, NULL, w.Number
    FROM mes.WorkOrderChangeLog cl JOIN mes.WorkOrder w ON w.Id = cl.WorkOrderId WHERE cl.CompanyId = @CompanyId AND cl.IsDeleted = 0
    UNION ALL
    /* عملیات */
    SELECT o.StartTime, N'OP_START', 0, w.Id, ISNULL(wc.ProductionLineId, w.ProductionLineId), o.Sequence, w.Number + N'/' + CAST(o.Sequence AS NVARCHAR(5)) + N' — شروع ' + op.Name, wc.Name, NULL, NULL, w.Number
    FROM mes.WorkOrderOperation o JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId JOIN mes.ProductionOperation op ON op.Id = o.OperationId LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
    WHERE w.CompanyId = @CompanyId AND o.IsDeleted = 0 AND o.StartTime IS NOT NULL
    UNION ALL
    SELECT o.EndTime, N'OP_END', 0, w.Id, ISNULL(wc.ProductionLineId, w.ProductionLineId), o.Sequence, w.Number + N'/' + CAST(o.Sequence AS NVARCHAR(5)) + N' — پایان ' + op.Name, wc.Name, o.CompletedQuantity, NULL, w.Number
    FROM mes.WorkOrderOperation o JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId JOIN mes.ProductionOperation op ON op.Id = o.OperationId LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
    WHERE w.CompanyId = @CompanyId AND o.IsDeleted = 0 AND o.EndTime IS NOT NULL AND o.WorkOrderOperationStatusCode = 5
    UNION ALL
    /* گزارش تولید */
    SELECT x.EndTime, N'REPORT', CASE WHEN x.WastedQuantity > 0.015 * (x.CompletedQuantity + x.WastedQuantity) THEN 1 ELSE 0 END, w.Id, ISNULL(wc.ProductionLineId, w.ProductionLineId), o.Sequence,
           x.ReportNumber + N' — ' + op.Name, x.ReportedByTitle, x.CompletedQuantity, DATEDIFF(MINUTE, x.StartTime, x.EndTime), w.Number
    FROM mes.WorkOrderOperationOutput x JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
    JOIN mes.ProductionOperation op ON op.Id = o.OperationId LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
    WHERE w.CompanyId = @CompanyId AND x.IsDeleted = 0
    UNION ALL
    /* توقف */
    SELECT pr.StartTime, N'STOP', CASE WHEN pr.EndTime IS NULL THEN 3 WHEN DATEDIFF(MINUTE, pr.StartTime, pr.EndTime) >= 30 THEN 2 ELSE 1 END, w.Id,
           ISNULL(wc.ProductionLineId, w.ProductionLineId), o.Sequence, w.Number + N'/' + CAST(o.Sequence AS NVARCHAR(5)) + N' — توقف', pr.ProblemDescription, NULL,
           DATEDIFF(MINUTE, pr.StartTime, ISNULL(pr.EndTime, @now)), w.Number
    FROM mes.WorkOrderOperationProblem pr JOIN mes.WorkOrderOperation o ON o.Id = pr.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
    LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
    WHERE pr.CompanyId = @CompanyId AND pr.IsDeleted = 0 AND pr.IsStoppageCause = 1
    UNION ALL
    /* پارامتر خارج از محدوده */
    SELECT rd.ReadAt, N'PARAM', 2, w.Id, ISNULL(wc.ProductionLineId, w.ProductionLineId), o.Sequence, w.Number + N'/' + CAST(o.Sequence AS NVARCHAR(5)) + N' — پارامتر خارج از حد',
           ISNULL(rd.Comment, N''), rd.Value, NULL, w.Number
    FROM mes.WorkOrderOperationParameterReading rd JOIN mes.WorkOrderOperation o ON o.Id = rd.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
    LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
    WHERE rd.CompanyId = @CompanyId AND rd.IsDeleted = 0 AND rd.IsOutOfRange = 1
    UNION ALL
    /* کیت و مازاد */
    SELECT k.EndTime, N'KIT', 0, w.Id, w.ProductionLineId, o.Sequence, w.Number + N' — انتقال کیت ' + p.Name, k.BatchNumber, k.KitQuantity, NULL, w.Number
    FROM mes.WorkOrderOperationMaterialKit k JOIN mes.WorkOrderOperationMaterial m ON m.Id = k.WOOperationMaterialId JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
    JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId JOIN mes.Product p ON p.Id = m.ProductId
    WHERE k.CompanyId = @CompanyId AND k.IsDeleted = 0 AND k.EndTime IS NOT NULL
    UNION ALL
    SELECT ex.RequestDate, N'EXCESS', CASE WHEN ex.StatusCode = 1 THEN 2 ELSE 1 END, w.Id, w.ProductionLineId, o.Sequence, w.Number + N' — درخواست مازاد ' + p.Name, ex.ExcessReasonTitle, ex.ExcessQuantity, NULL, w.Number
    FROM mes.WorkOrderOperationMaterialExcess ex JOIN mes.WorkOrderOperationMaterial m ON m.Id = ex.WOOperationMaterialId JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
    JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId JOIN mes.Product p ON p.Id = m.ProductId
    WHERE ex.CompanyId = @CompanyId AND ex.IsDeleted = 0
    UNION ALL
    /* رسید محصول */
    SELECT r.ReceiptDate, N'RECEIPT', CASE WHEN r.QcRejectedQuantity > 0 THEN 2 WHEN r.QcStatusCode = 1 THEN 1 ELSE 0 END, w.Id, w.ProductionLineId, o.Sequence,
           r.ReceiptNumber + N' — رسید ' + p.Name, r.InventoryTitle, r.ReceivedToInvQuantity, NULL, r.BatchNumber
    FROM mes.WorkOrderOperationOutputProduct r JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
    JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId JOIN mes.Product p ON p.Id = r.FinalProductId
    WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
    UNION ALL
    /* نامنطبق */
    SELECT ISNULL(x.EndTime, d.DecidedAt), N'NC', CASE WHEN d.DecisionStatusCode = 1 THEN 2 ELSE 1 END, w.Id, w.ProductionLineId, o.Sequence,
           d.Number + N' — ' + CASE d.NonconformityTypeCode WHEN 1 THEN N'اسقاط' WHEN 2 THEN N'بازیافت' WHEN 3 THEN N'دوباره‌کاری' ELSE N'درجه‌دو' END, d.Description, d.Quantity, NULL, w.Number
    FROM mes.NonconformingDisposition d JOIN mes.WorkOrder w ON w.Id = d.WorkOrderId LEFT JOIN mes.WorkOrderOperation o ON o.Id = d.WOOperationId
    LEFT JOIN mes.WorkOrderOperationOutput x ON x.Id = d.OperationOutputId
    WHERE d.CompanyId = @CompanyId AND d.IsDeleted = 0
    UNION ALL
    /* برون‌سپاری */
    SELECT s.ShipmentDate, N'SHIP', 0, s.WorkOrderId, w.ProductionLineId, o.Sequence,
           s.Number + CASE s.DirectionCode WHEN 1 THEN N' — ارسال به پیمانکار' WHEN 2 THEN N' — دریافت از پیمانکار' WHEN 3 THEN N' — ورود مواد مشتری' ELSE N' — تحویل به مشتری' END,
           ISNULL(ct.Name, tc.CustomerTitle), NULL, NULL, s.WaybillNumber
    FROM mes.SubcontractShipment s LEFT JOIN mes.WorkOrder w ON w.Id = s.WorkOrderId LEFT JOIN mes.WorkOrderOperation o ON o.Id = s.WOOperationId
    LEFT JOIN mes.ProductionContractor ct ON ct.Id = s.ContractorId LEFT JOIN mes.TollingContract tc ON tc.Id = s.TollingContractId
    WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0
    UNION ALL
    SELECT g.ReportedAt, N'CTR', CASE WHEN g.ExpectedReadyDate > sh.ExpectedReturnDate THEN 2 ELSE 0 END, g.WorkOrderId, w.ProductionLineId, o.Sequence,
           w.Number + N' — پیشرفت پیمانکار', g.Note, g.CompletedQuantity, NULL, w.Number
    FROM mes.SubcontractProgress g JOIN mes.WorkOrder w ON w.Id = g.WorkOrderId JOIN mes.WorkOrderOperation o ON o.Id = g.WOOperationId
    OUTER APPLY (SELECT TOP (1) s.ExpectedReturnDate FROM mes.SubcontractShipment s WHERE s.WOOperationId = g.WOOperationId AND s.DirectionCode = 1 AND s.IsDeleted = 0) sh
    WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0
    UNION ALL
    /* انحراف و تحویل شیفت */
    SELECT d.RecordedAt, N'DEVIATION', 2, d.WorkOrderId, w.ProductionLineId, o.Sequence, w.Number + N' — انحراف: ' + pd.Name, d.CorrectiveActionTitle, NULL, NULL, d.CorrectiveActionRef
    FROM mes.WorkOrderDeviation d JOIN mes.WorkOrder w ON w.Id = d.WorkOrderId JOIN mes.ProductionPlanDeviation pd ON pd.Id = d.ProductionPlanDeviationId
    LEFT JOIN mes.WorkOrderOperation o ON o.Id = d.WOOperationId
    WHERE d.CompanyId = @CompanyId AND d.IsDeleted = 0
    UNION ALL
    SELECT sr.HandoverTime, N'SHIFT', CASE WHEN NULLIF(sr.OpenIssues, N'') IS NOT NULL THEN 1 ELSE 0 END, NULL, sr.ProductionLineId, NULL,
           N'تحویل شیفت — ' + ISNULL(sr.SupervisorTitle, N'') + N' ← ' + ISNULL(sr.NextSupervisorTitle, N''), sr.OpenIssues, NULL, NULL, NULL
    FROM mes.ShiftReport sr WHERE sr.CompanyId = @CompanyId AND sr.IsDeleted = 0 AND sr.HandoverTime IS NOT NULL
  )
  SELECT e.At, e.Kind, e.Severity, CAST(e.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, CAST(e.LineId AS INT) AS LineId, ln.Name AS LineTitle,
         e.Seq AS OperationSequence, e.Title, e.Detail, e.Qty AS Quantity, e.Minutes, e.Ref
  FROM e
  LEFT JOIN mes.WorkOrder w ON w.Id = e.WorkOrderId
  LEFT JOIN mes.ProductionLine ln ON ln.Id = e.LineId
  WHERE e.At IS NOT NULL AND e.At >= @From AND e.At < @To
  ORDER BY e.At, e.Kind;
END
GO

/* ماتریس روز × خط */
CREATE OR ALTER PROCEDURE mes.GetBiDailyLine
  @CompanyId BIGINT,
  @From DATE,
  @To DATE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();
  ;WITH d AS (SELECT @From AS Day UNION ALL SELECT DATEADD(DAY, 1, Day) FROM d WHERE Day < @To),
  rep AS (
    SELECT CAST(x.EndTime AS DATE) AS Day, ISNULL(wc.ProductionLineId, w.ProductionLineId) AS LineId, COUNT(*) AS Reports,
           SUM(x.WastedQuantity) AS Wasted, SUM(x.CompletedQuantity) AS Completed, COUNT(DISTINCT w.Id) AS Orders,
           SUM(DATEDIFF(MINUTE, x.StartTime, x.EndTime)) AS RunMinutes
    FROM mes.WorkOrderOperationOutput x JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
    LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
    WHERE w.CompanyId = @CompanyId AND x.IsDeleted = 0 AND x.EndTime IS NOT NULL
    GROUP BY CAST(x.EndTime AS DATE), ISNULL(wc.ProductionLineId, w.ProductionLineId)),
  stp AS (
    SELECT CAST(pr.StartTime AS DATE) AS Day, ISNULL(wc.ProductionLineId, w.ProductionLineId) AS LineId, COUNT(*) AS Stops,
           SUM(DATEDIFF(MINUTE, pr.StartTime, ISNULL(pr.EndTime, @now))) AS StopMinutes
    FROM mes.WorkOrderOperationProblem pr JOIN mes.WorkOrderOperation o ON o.Id = pr.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
    LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
    WHERE pr.CompanyId = @CompanyId AND pr.IsDeleted = 0 AND pr.IsStoppageCause = 1
    GROUP BY CAST(pr.StartTime AS DATE), ISNULL(wc.ProductionLineId, w.ProductionLineId)),
  nc AS (
    SELECT CAST(ISNULL(x.EndTime, dd.DecidedAt) AS DATE) AS Day, w.ProductionLineId AS LineId, SUM(dd.CostAmount) AS NcCost
    FROM mes.NonconformingDisposition dd JOIN mes.WorkOrder w ON w.Id = dd.WorkOrderId LEFT JOIN mes.WorkOrderOperationOutput x ON x.Id = dd.OperationOutputId
    WHERE dd.CompanyId = @CompanyId AND dd.IsDeleted = 0
    GROUP BY CAST(ISNULL(x.EndTime, dd.DecidedAt) AS DATE), w.ProductionLineId)
  SELECT d.Day, CAST(ln.Id AS INT) AS LineId, ln.Name AS LineTitle, ISNULL(rep.Reports, 0) AS Reports, ISNULL(rep.Orders, 0) AS Orders,
         ISNULL(rep.Completed, 0) AS Completed, ISNULL(rep.Wasted, 0) AS Wasted, ISNULL(rep.RunMinutes, 0) AS RunMinutes,
         ISNULL(stp.Stops, 0) AS Stops, ISNULL(stp.StopMinutes, 0) AS StopMinutes, ISNULL(nc.NcCost, 0) AS NcCost
  FROM d CROSS JOIN mes.ProductionLine ln
  LEFT JOIN rep ON rep.Day = d.Day AND rep.LineId = ln.Id
  LEFT JOIN stp ON stp.Day = d.Day AND stp.LineId = ln.Id
  LEFT JOIN nc ON nc.Day = d.Day AND nc.LineId = ln.Id
  WHERE ln.CompanyId = @CompanyId AND ln.IsDeleted = 0
  ORDER BY d.Day, ln.Number
  OPTION (MAXRECURSION 400);
END
GO

/* ثبت فرم و منو در ALM */
IF NOT EXISTS (SELECT 1 FROM alm.Form WHERE Code = 'FRM-PC-13')
  INSERT alm.Form (Code, Title, SubSystemCode, AnalysisDocumentCode, FormTypeCode, PrimaryAccessGroupCode, OtherAccessGroupsText, TabsDescription, TabCount, ActionCount,
                   FeatureCount, EstimateFromFeatures, OverheadEstimate, TotalEstimate, DesignOwner, SortOrder, Note, CreatorCode, CreationDate, Guid, PhaseCode)
  SELECT 'FRM-PC-13', N'اتاق جلسه‌ی کنترل تولید (BI)', SubSystemCode, AnalysisDocumentCode, FormTypeCode, PrimaryAccessGroupCode,
         N'مدیر تولید، برنامه‌ریز تولید، سرپرست خط، کنترل کیفیت، بهای تمام‌شده، تأمین',
         N'تصویر هفته · ماشین زمان · سناریوها · رادار مشکلات · مسیر سفارش · دستور جلسه', 6, 0, 0, 0, 0, 0, DesignOwner, 480,
         N'BI سناریومحور برای جلسه‌ی هفتگی کنترل تولید؛ به درخواست کاربر (۱۸ مهر ۱۴۰۵). فقط‌خواندنی؛ روی داده‌ی PC-01 تا PC-12.', CreatorCode, GETDATE(), NEWID(), PhaseCode
  FROM alm.Form WHERE Code = 'FRM-PC-12';

IF NOT EXISTS (SELECT 1 FROM alm.Menu WHERE Code = '45013')
  INSERT alm.Menu (Code, Title, ParentCode, SubSystemCode, MenuLevel, AnalysisDocumentCode, FormTypeCode, FormCode, SortOrder, Note, CreatorCode, CreationDate, Guid, PhaseCode)
  SELECT '45013', N'اتاق جلسه‌ی کنترل تولید (BI)', ParentCode, SubSystemCode, MenuLevel, AnalysisDocumentCode, FormTypeCode, 'FRM-PC-13', 480,
         N'BI سناریومحور جلسه‌ی هفتگی', CreatorCode, GETDATE(), NEWID(), PhaseCode
  FROM alm.Menu WHERE Code = '45012';
GO
