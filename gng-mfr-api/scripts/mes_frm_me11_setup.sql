/* =====================================================================
   اسکیمای mes — گام ۴۵: FRM-ME-11 «رصدخانه‌ی مهندسی تولید» (BI مهندسی تولید)

   هدف: تکیه‌گاه جلسه‌ی بازبینی مهندسی تولید. نقطه‌ضعف‌های داده‌ی روش‌ها را پیدا می‌کند، رفتار استانداردها را در اجرای واقعی
   (گزارش‌های تولید PC-04) می‌سنجد و اثر تغییر را شبیه‌سازی می‌کند. جدول تازه ندارد؛ پنج نمای تحلیلی روی جدول‌های ME-01 تا ME-10،
   RM-01/06/08 و اجرای PC می‌سازد:
     mes.GetBiRoutingHealth       سه مجموعه: واقعیت هر روش، هر عملیات روش با منبع حل‌شده (مستقیم یا ارث از کتابخانه) و شمارش
                                  اجزای مهندسی، عملیات جایگزین با منبع حل‌شده
     mes.GetBiMeDefects           کاتالوگ یکپارچه‌ی نقص‌های داده‌ی مهندسی تولید (۴۶ قاعده در ۱۳ دسته، با فرم مالک و شدت)
     mes.GetBiStandardVsActual    دو مجموعه: هر گزارش تولید در برابر زمان استاندارد عملیات روش؛ کارکرد واقعی هر عملیات دستور
                                  به تفکیک نوع کارکرد در برابر مبنای محاسبه‌ی ME-03
     mes.GetBiVersionCoverage     سه مجموعه: صلاحیت هر نسخه‌ی تولید برای هر کالا × خط × نوع دستور (همان قواعد
                                  mes.SelectManufacturingVersion بدون قید مقدار، در تاریخ سناریو) ، فهرست کالاهای تولیدی با تقاضا و خطوط
     mes.GetBiCapacityModel       دو مجموعه: منابع ظرفیت (ایستگاه/گروه منبع) با ظرفیت جاری RM-06 و تقویم مؤثر خط؛ تقاضای باز
                                  (درخواست‌های تأییدشده‌ی بی‌دستور و باقی‌مانده‌ی دستورهای باز)

   فرض‌ها:
     «اکنون» = mes.fnShopNow() (ساعت سناریو)؛ تاریخ اعتبار ظرفیت، قرارداد، صلاحیت و نسخه همان روز است.
     منبع عملیات: WorkCenterId یا ResourceGroupId خود عملیات روش، وگرنه منبع اصلی کتابخانه (ME-01).
     زمان در دسترس گروه منبع = بیشینه‌ی تقویم خطوط اعضا (بخش ۱۰ مستند).
     باقی‌مانده‌ی دستور باز = مقدار × (۱ − جمع تکمیل ÷ جمع مقدار قابل تکمیل عملیات).

   ثبت در ALM: فرم FRM-ME-11 و منوی 44011 زیر «مهندسی تولید» (هر دو فقط اگر نباشند).
   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* واقعیت روش‌ها، عملیات و جایگزین‌ها */
CREATE OR ALTER PROCEDURE mes.GetBiRoutingHealth
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(mes.fnShopNow() AS DATE);

  /* ۱) روش‌ها */
  SELECT CAST(r.Id AS INT) AS RoutingId, r.Number AS Code, rv.Number AS VersionCode, r.Name AS Title, ISNULL(r.RoutingMasterStatusCode, 1) AS StatusCode,
         r.ProductionTypeCode, r.RoutingMethodCode, r.RoutingBatchSize, CAST(r.ProductionLineId AS INT) AS LineId, l.Name AS LineTitle,
         r.IsTemplate, r.IsTollManufacturing, r.CustomerTitle, r.RateQuantity, r.RateTimeBasisCode, r.ProcessWastePercent,
         CAST(mp.ProductId AS INT) AS ProductId, mp.ProductCode, mp.ProductTitle, mp.UnitTitle,
         (SELECT STRING_AGG(s.Number, N'، ') FROM mes.RoutingProductStructureAssignment a JOIN mes.ProductStructure s ON s.Id = a.ProductStructureId
           WHERE a.RoutingId = r.Id AND a.IsDeleted = 0) AS StructureCodes,
         (SELECT COUNT(*) FROM mes.RoutingOperation o WHERE o.RoutingId = r.Id AND o.IsDeleted = 0) AS OperationCount,
         (SELECT COUNT(*) FROM mes.ManufacturingVersion v WHERE v.RoutingId = r.Id AND v.IsDeleted = 0 AND v.StatusCode = 3) AS ActiveVersions,
         (SELECT STRING_AGG(v.Number, N'، ') FROM mes.ManufacturingVersion v WHERE v.RoutingId = r.Id AND v.IsDeleted = 0) AS Versions,
         (SELECT COUNT(*) FROM mes.WorkOrder w WHERE w.RoutingId = r.Id AND w.IsDeleted = 0 AND w.WorkOrderStatusCode IN (1, 2, 3)) AS OpenWorkOrders,
         (SELECT COUNT(*) FROM mes.WorkOrder w WHERE w.RoutingId = r.Id AND w.IsDeleted = 0 AND w.WorkOrderStatusCode <> 6) AS WorkOrders,
         (SELECT COUNT(*) FROM mes.WorkOrderOperationOutput x JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
           WHERE w.RoutingId = r.Id AND x.IsDeleted = 0) AS Reports
  FROM mes.RoutingMaster r
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  LEFT JOIN mes.ProductionLine l ON l.Id = r.ProductionLineId
  OUTER APPLY (SELECT TOP (1) p.Id AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle
               FROM mes.RoutingProductStructureAssignment a
               JOIN mes.ProductStructureMaster m ON m.ProductStructureId = a.ProductStructureId AND m.IsMainProduct = 1 AND m.IsDeleted = 0
               JOIN mes.Product p ON p.Id = m.ProductId
               WHERE a.RoutingId = r.Id AND a.IsDeleted = 0 ORDER BY a.Id) mp
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
  ORDER BY r.IsTemplate DESC, r.Number, rv.Number;

  /* ۲) عملیات روش با منبع حل‌شده و شمارش اجزا */
  SELECT CAST(o.Id AS INT) AS RoutingOperationId, CAST(o.RoutingId AS INT) AS RoutingId, o.Sequence, CAST(o.OperationId AS INT) AS OperationId,
         op.Number AS OperationCode, op.Name AS OperationTitle, op.OperationTypeCode AS NatureCode, CAST(ISNULL(o.IsOutsourcing, 0) AS BIT) AS IsOutsourcing,
         o.AllocationPercent, o.YieldPercent,
         rs.ResKind, CAST(rs.ResId AS INT) AS ResId, rs.ResTitle, rs.ResSource,
         CAST(CASE WHEN rs.ResKind = 'S' THEN ws.ProductionLineId END AS INT) AS ResLineId,
         CAST(CASE WHEN t.Id IS NULL THEN 0 ELSE 1 END AS BIT) AS HasTiming, t.RoutingBatchSize AS TimingBatch, t.SetupTimePerBatch, t.EquipmentRunTimePerPart,
         t.LaborRunTimePerPart, t.OutsourceTimePerPart, t.TeardownTimePerBatch, t.WaitTimePerBatch, t.IsWaitOccupyingResource, t.YieldPercent AS TimingYield,
         t.TransferBatchSize,
         (SELECT COUNT(*) FROM mes.RoutingOperationCapacity c WHERE c.RoutingOperationId = o.Id AND c.IsDeleted = 0) AS CapacityCount,
         (SELECT COUNT(*) FROM mes.RoutingOperationMaterial m WHERE m.RoutingOperationId = o.Id AND m.IsDeleted = 0) AS MaterialCount,
         (SELECT COUNT(*) FROM mes.RoutingOperationOutput x WHERE x.RoutingOperationId = o.Id AND x.IsDeleted = 0) AS OutputCount,
         (SELECT COUNT(*) FROM mes.RoutingOperationBatchAttribute b WHERE b.RoutingOperationId = o.Id AND b.IsDeleted = 0) AS BatchAttributeCount,
         (SELECT COUNT(*) FROM mes.RoutingOperationActivity a WHERE a.RoutingOperationId = o.Id AND a.IsDeleted = 0) AS ActivityCount,
         (SELECT SUM(a.StandardWorkTime) FROM mes.RoutingOperationActivity a WHERE a.RoutingOperationId = o.Id AND a.IsDeleted = 0) AS ActivityMinutes,
         (SELECT SUM(CASE WHEN a.IsValueAdded = 1 THEN a.StandardWorkTime ELSE 0 END) FROM mes.RoutingOperationActivity a WHERE a.RoutingOperationId = o.Id AND a.IsDeleted = 0) AS ValueAddedMinutes,
         (SELECT COUNT(*) FROM mes.RoutingOperationSubcontract s WHERE s.RoutingOperationId = o.Id AND s.IsDeleted = 0 AND s.IsActive = 1) AS SubcontractCount,
         (SELECT COUNT(*) FROM mes.RoutingOperationSubcontract s JOIN mes.ProductionContractor c ON c.Id = s.ProductionContractorId
           WHERE s.RoutingOperationId = o.Id AND s.IsDeleted = 0 AND s.IsActive = 1 AND c.IsActive = 1 AND c.QualificationStatusCode <> 3
             AND (c.ContractToDate IS NULL OR c.ContractToDate >= @today)
             AND EXISTS (SELECT 1 FROM mes.ProductionContractorCapability k WHERE k.ContractorId = c.Id AND k.ProductionOperationId = s.ProductionOperationId AND k.IsDeleted = 0
                           AND (k.QualifiedUntilDate IS NULL OR k.QualifiedUntilDate >= @today))
             AND EXISTS (SELECT 1 FROM mes.ProductionContractorRate rt WHERE rt.ContractorId = c.Id AND rt.ProductionOperationId = s.ProductionOperationId AND rt.IsDeleted = 0
                           AND rt.ValidFromDate <= @today AND (rt.ValidToDate IS NULL OR rt.ValidToDate >= @today))) AS QualifiedContractors,
         (SELECT COUNT(*) FROM mes.RoutingOperationRecovery x WHERE x.RoutingOperationId = o.Id AND x.IsDeleted = 0) AS RecoveryCount,
         (SELECT COUNT(*) FROM mes.RoutingOperationAlternative x WHERE x.RoutingOperationId = o.Id AND x.IsDeleted = 0) AS AlternativeCount
  FROM mes.RoutingOperation o
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.RoutingOperationTiming t ON t.RoutingOperationId = o.Id AND t.IsDeleted = 0
  OUTER APPLY (SELECT TOP (1) pr.ResourceTypeCode, pr.WorkCenterId, pr.ResourceGroupId FROM mes.ProductionOperationResource pr
               WHERE pr.ProductionOperationId = o.OperationId AND pr.IsDeleted = 0 ORDER BY pr.IsPrimary DESC, pr.Priority) lib
  OUTER APPLY (SELECT CASE WHEN o.WorkCenterId IS NOT NULL THEN 'S' WHEN o.ResourceGroupId IS NOT NULL THEN 'G'
                           WHEN lib.WorkCenterId IS NOT NULL THEN 'S' WHEN lib.ResourceGroupId IS NOT NULL THEN 'G' END AS ResKind,
                      COALESCE(o.WorkCenterId, o.ResourceGroupId, lib.WorkCenterId, lib.ResourceGroupId) AS ResId,
                      CASE WHEN o.WorkCenterId IS NOT NULL OR o.ResourceGroupId IS NOT NULL THEN 1 WHEN lib.ResourceTypeCode IS NOT NULL THEN 2 ELSE 0 END AS ResSource) rk
  LEFT JOIN mes.WorkCenter ws ON rk.ResKind = 'S' AND ws.Id = rk.ResId
  LEFT JOIN mes.ResourceGroup gs ON rk.ResKind = 'G' AND gs.Id = rk.ResId
  LEFT JOIN mes.ProductionLine wl ON wl.Id = ws.ProductionLineId
  OUTER APPLY (SELECT rk.ResKind, rk.ResId, rk.ResSource,
                      COALESCE(ws.Number + N' ' + ws.Name + N' (' + wl.Name + N')', gs.Number + N' — ' + gs.Name) AS ResTitle) rs
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0
  ORDER BY o.RoutingId, o.Sequence;

  /* ۳) جایگزین‌ها با منبع حل‌شده */
  SELECT CAST(a.RoutingOperationId AS INT) AS RoutingOperationId, CAST(o.RoutingId AS INT) AS RoutingId, alt.Number + N' — ' + alt.Name AS AlternativeTitle,
         CASE WHEN a.WorkCenterId IS NOT NULL THEN 'S' WHEN a.ResourceGroupId IS NOT NULL THEN 'G' END AS ResKind,
         CAST(COALESCE(a.WorkCenterId, a.ResourceGroupId) AS INT) AS ResId,
         COALESCE(w.Number + N' ' + w.Name + N' (' + l.Name + N')', g.Number + N' — ' + g.Name) AS ResTitle,
         a.SelectionRuleCode, a.FromQuantity, a.ToQuantity, a.Priority
  FROM mes.RoutingOperationAlternative a
  JOIN mes.RoutingOperation o ON o.Id = a.RoutingOperationId
  JOIN mes.ProductionOperation alt ON alt.Id = a.AlternativeOperationId
  LEFT JOIN mes.WorkCenter w ON w.Id = a.WorkCenterId
  LEFT JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
  LEFT JOIN mes.ResourceGroup g ON g.Id = a.ResourceGroupId
  WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0
  ORDER BY o.RoutingId, o.Sequence, a.Priority;
END
GO

/* کاتالوگ یکپارچه‌ی نقص‌های داده‌ی مهندسی تولید.
   CategoryCode: LIB کتابخانه، RES منبع، GRAPH گراف، TIME زمان، MAT مواد، OUT خروجی، BATCH ویژگی بچ، REC بازیابی، POL سیاست،
   SUB برون‌سپاری، VER نسخه، CONT پیوسته، COST هزینه. Severity: ۱ اطلاع، ۲ هشدار، ۳ بحرانی. */
CREATE OR ALTER PROCEDURE mes.GetBiMeDefects
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(mes.fnShopNow() AS DATE);
  DECLARE @d TABLE (RuleCode VARCHAR(8), CategoryCode VARCHAR(8), Severity INT, FormCode VARCHAR(12), RoutingId BIGINT NULL, RoutingOperationId BIGINT NULL,
                    OperationId BIGINT NULL, EntityRef NVARCHAR(128), Title NVARCHAR(400), Detail NVARCHAR(600) NULL);

  /* روش‌های فعال در تحلیل (الگو جدا؛ کنترل‌های اجرایی روی الگو اعمال نمی‌شود) */
  DECLARE @ops TABLE (Id BIGINT PRIMARY KEY, RoutingId BIGINT, Sequence INT, OperationId BIGINT, Nature INT, IsOut BIT, IsTemplate BIT, RStatus INT, RCode NVARCHAR(140), OpTitle NVARCHAR(256),
                      WorkCenterId BIGINT NULL, ResourceGroupId BIGINT NULL, HasLib BIT, ResStationId BIGINT NULL, ResGroupId BIGINT NULL);
  INSERT @ops
  SELECT o.Id, o.RoutingId, o.Sequence, o.OperationId, op.OperationTypeCode, CAST(CASE WHEN o.IsOutsourcing = 1 OR op.OperationTypeCode = 5 THEN 1 ELSE 0 END AS BIT),
         r.IsTemplate, ISNULL(r.RoutingMasterStatusCode, 1), r.Number + N' ' + ISNULL(rv.Number, N''), op.Name, o.WorkCenterId, o.ResourceGroupId,
         CAST(CASE WHEN lib.ResourceTypeCode IS NOT NULL THEN 1 ELSE 0 END AS BIT),
         CASE WHEN o.WorkCenterId IS NOT NULL THEN o.WorkCenterId WHEN o.ResourceGroupId IS NULL THEN lib.WorkCenterId END,
         CASE WHEN o.ResourceGroupId IS NOT NULL THEN o.ResourceGroupId WHEN o.WorkCenterId IS NULL THEN lib.ResourceGroupId END
  FROM mes.RoutingOperation o
  JOIN mes.RoutingMaster r ON r.Id = o.RoutingId AND r.IsDeleted = 0
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  OUTER APPLY (SELECT TOP (1) pr.ResourceTypeCode, pr.WorkCenterId, pr.ResourceGroupId FROM mes.ProductionOperationResource pr
               WHERE pr.ProductionOperationId = o.OperationId AND pr.IsDeleted = 0 ORDER BY pr.IsPrimary DESC, pr.Priority) lib
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0;

  /* ── ME-01 کتابخانه ── */
  INSERT @d SELECT 'L1', 'LIB', 2, 'FRM-ME-01', NULL, NULL, o.Id, o.Number, N'عملیات تولیدی «' + o.Name + N'» در کتابخانه منبع اصلی ندارد', N'روش‌هایی که منبع را از کتابخانه ارث می‌برند بی‌منبع می‌مانند'
  FROM mes.ProductionOperation o
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0 AND o.IsActive = 1 AND o.OperationTypeCode IN (1, 3)
    AND NOT EXISTS (SELECT 1 FROM mes.ProductionOperationResource pr WHERE pr.ProductionOperationId = o.Id AND pr.IsDeleted = 0);

  INSERT @d SELECT 'L2', 'LIB', 2, 'FRM-ME-01', NULL, NULL, o.Id, o.Number, N'«' + o.Name + N'» فقط دستورالعمل پیش‌نویس دارد', N'هیچ نسخه‌ی تأییدشده‌ای روی ترمینال نمایش داده نمی‌شود'
  FROM mes.ProductionOperation o
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0
    AND EXISTS (SELECT 1 FROM mes.ProductionOperationInstruction i WHERE i.ProductionOperationId = o.Id AND i.IsDeleted = 0)
    AND NOT EXISTS (SELECT 1 FROM mes.ProductionOperationInstruction i WHERE i.ProductionOperationId = o.Id AND i.IsDeleted = 0 AND i.RevisionStatusCode = 2);

  INSERT @d SELECT 'L3', 'LIB', 2, 'FRM-ME-01', NULL, NULL, MIN(i.ProductionOperationId), i.DocumentNumber, N'سند ' + i.DocumentNumber + N' ' + CAST(COUNT(*) AS NVARCHAR(4)) + N' نسخه‌ی تأییدشده‌ی هم‌زمان دارد', N'فقط یک نسخه باید جاری باشد'
  FROM mes.ProductionOperationInstruction i
  WHERE i.CompanyId = @CompanyId AND i.IsDeleted = 0 AND i.RevisionStatusCode = 2
  GROUP BY i.DocumentNumber HAVING COUNT(*) > 1;

  INSERT @d SELECT 'L4', 'LIB', 3, 'FRM-ME-01', NULL, NULL, p.ProductionOperationId, o.Number, N'هدف پارامتر «' + p.Name + N'» در «' + o.Name + N'» بیرون از محدوده‌ی مجاز است',
         N'هدف ' + CAST(CAST(p.TargetValue AS DECIMAL(18,2)) AS NVARCHAR(32)) + N'، محدوده ' + ISNULL(CAST(CAST(p.MinValue AS DECIMAL(18,2)) AS NVARCHAR(32)), N'—') + N' تا ' + ISNULL(CAST(CAST(p.MaxValue AS DECIMAL(18,2)) AS NVARCHAR(32)), N'—')
  FROM mes.ProductionOperationParameter p JOIN mes.ProductionOperation o ON o.Id = p.ProductionOperationId
  WHERE p.CompanyId = @CompanyId AND p.IsDeleted = 0 AND p.TargetValue IS NOT NULL AND (p.TargetValue < p.MinValue OR p.TargetValue > p.MaxValue);

  INSERT @d SELECT 'L5', 'LIB', 2, 'FRM-ME-01', NULL, NULL, e.ProductionOperationId, o.Number, N'«' + o.Name + N'» از کارکرد «' + ct.Name + N'» استفاده می‌کند که ' + CASE WHEN ct.IsActive = 0 THEN N'غیرفعال است' ELSE N'مبنای مصرفی ندارد' END, NULL
  FROM mes.ProductionOperationEnergy e JOIN mes.CapacityType ct ON ct.Id = e.CapacityTypeId JOIN mes.ProductionOperation o ON o.Id = e.ProductionOperationId
  WHERE e.CompanyId = @CompanyId AND e.IsDeleted = 0 AND (ct.IsActive = 0 OR ct.MeasureBasisCode <> 2);

  INSERT @d SELECT 'L6', 'LIB', 1, 'FRM-ME-01', NULL, NULL, t.ProductionOperationId, g.Number, N'گروه ابزار «' + g.Name + N'» برای «' + o.Name + N'» لازم است ولی ابزاری ثبت نشده', N'RM-02 — ابزار و قالب'
  FROM mes.ProductionOperationTools t JOIN mes.ToolsProductionGroup g ON g.Id = t.ToolsGroupId JOIN mes.ProductionOperation o ON o.Id = t.ProductionOperationId
  WHERE t.CompanyId = @CompanyId AND t.IsDeleted = 0 AND NOT EXISTS (SELECT 1 FROM mes.ToolsProduction p WHERE p.ToolsGroupId = g.Id AND p.IsDeleted = 0);

  /* ── ME-02 منبع و گراف ── */
  INSERT @d SELECT 'R1', 'RES', CASE WHEN x.RStatus = 3 THEN 3 ELSE 2 END, 'FRM-ME-02', x.RoutingId, x.Id, x.OperationId, x.RCode + N'/' + CAST(x.Sequence AS NVARCHAR(8)),
         N'عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + N' «' + x.OpTitle + N'» منبع ندارد (نه در روش، نه در کتابخانه)', N'بار این عملیات روی هیچ ظرفیتی نمی‌نشیند'
  FROM @ops x WHERE x.IsTemplate = 0 AND x.IsOut = 0 AND x.WorkCenterId IS NULL AND x.ResourceGroupId IS NULL AND x.HasLib = 0;

  INSERT @d SELECT 'R2', 'RES', CASE WHEN x.RStatus = 3 THEN 2 ELSE 1 END, 'FRM-ME-02', x.RoutingId, x.Id, x.OperationId, w.Number + N' ' + w.Name,
         N'عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + N' «' + x.OpTitle + N'» روی ایستگاه غیرفعال «' + w.Name + N'» (' + l.Name + N') است', N'RM-01 — ایستگاه کاری'
  FROM @ops x JOIN mes.WorkCenter w ON w.Id = x.ResStationId JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
  WHERE x.IsTemplate = 0 AND x.RStatus IN (2, 3) AND w.IsActive = 0;

  INSERT @d SELECT DISTINCT 'R3', 'RES', 1, 'FRM-RM-06', x.RoutingId, x.Id, x.OperationId, COALESCE(w.Number + N' ' + w.Name, g.Number),
         N'منبع «' + COALESCE(w.Name + N' (' + l.Name + N')', g.Name) + N'» عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + N' در RM-06 ظرفیت جاری ندارد', N'بار روی این منبع بی‌سقف دیده می‌شود'
  FROM @ops x
  LEFT JOIN mes.WorkCenter w ON w.Id = x.ResStationId LEFT JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
  LEFT JOIN mes.ResourceGroup g ON g.Id = x.ResGroupId
  WHERE x.IsTemplate = 0 AND x.RStatus IN (2, 3) AND (x.ResStationId IS NOT NULL OR x.ResGroupId IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM mes.WorkCenterCapacity c WHERE c.IsDeleted = 0 AND c.ValidFromDate <= @today AND (c.ValidToDate IS NULL OR c.ValidToDate >= @today)
                    AND (c.WorkCenterId = x.ResStationId OR c.ResourceGroupId = x.ResGroupId
                         OR c.WorkCenterId IN (SELECT w2.Id FROM mes.WorkCenter w2 WHERE w2.ResourceGroupId = x.ResGroupId AND w2.IsDeleted = 0)));

  /* حلقه: پیمایش یال‌ها با مسیر؛ رسیدن دوباره به گره‌ی شروع = حلقه */
  ;WITH walk AS (
    SELECT k.RoutingId, k.FromRoutingOperationId AS StartId, k.ToRoutingOperationId AS NodeId,
           CAST(N'/' + CAST(k.FromRoutingOperationId AS NVARCHAR(20)) + N'/' + CAST(k.ToRoutingOperationId AS NVARCHAR(20)) + N'/' AS NVARCHAR(2000)) AS Path, 1 AS Depth
    FROM mes.RoutingOperationLink k WHERE k.CompanyId = @CompanyId AND k.IsDeleted = 0
    UNION ALL
    SELECT w.RoutingId, w.StartId, k.ToRoutingOperationId, CAST(w.Path + CAST(k.ToRoutingOperationId AS NVARCHAR(20)) + N'/' AS NVARCHAR(2000)), w.Depth + 1
    FROM walk w JOIN mes.RoutingOperationLink k ON k.FromRoutingOperationId = w.NodeId AND k.IsDeleted = 0
    WHERE w.NodeId <> w.StartId AND w.Depth < 60
      AND (k.ToRoutingOperationId = w.StartId OR w.Path NOT LIKE N'%/' + CAST(k.ToRoutingOperationId AS NVARCHAR(20)) + N'/%')
  ), cyc AS (
    SELECT w.RoutingId, MIN(w.StartId) AS AnyId, COUNT(DISTINCT w.StartId) AS Nodes FROM walk w WHERE w.NodeId = w.StartId GROUP BY w.RoutingId
  )
  INSERT @d SELECT 'G1', 'GRAPH', 3, 'FRM-ME-02', c.RoutingId, c.AnyId, NULL, x.RCode, N'گراف ' + x.RCode + N' حلقه دارد (' + CAST(c.Nodes AS NVARCHAR(4)) + N' عملیات درگیر)',
         N'ترتیب اجرا و زمان‌بندی تعریف‌پذیر نیست'
  FROM cyc c JOIN @ops x ON x.Id = c.AnyId
  OPTION (MAXRECURSION 100);

  INSERT @d SELECT 'G2', 'GRAPH', 2, 'FRM-ME-02', x.RoutingId, x.Id, x.OperationId, x.RCode + N'/' + CAST(x.Sequence AS NVARCHAR(8)),
         N'عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + N' «' + x.OpTitle + N'» یتیم است (به هیچ یالی وصل نیست)', NULL
  FROM @ops x
  WHERE EXISTS (SELECT 1 FROM mes.RoutingOperationLink k WHERE k.RoutingId = x.RoutingId AND k.IsDeleted = 0)
    AND NOT EXISTS (SELECT 1 FROM mes.RoutingOperationLink k WHERE k.IsDeleted = 0 AND (k.FromRoutingOperationId = x.Id OR k.ToRoutingOperationId = x.Id));

  /* پایانه‌ی گراف (ورودی دارد، خروجی یال ندارد) بی‌خروجی محصول */
  INSERT @d SELECT 'G3', 'OUT', 2, 'FRM-ME-02', x.RoutingId, x.Id, x.OperationId, x.RCode + N'/' + CAST(x.Sequence AS NVARCHAR(8)),
         N'مسیر به «' + x.OpTitle + N'» (' + CAST(x.Sequence AS NVARCHAR(8)) + N') ختم می‌شود ولی خروجی تعریف نشده', N'محصول این مسیر رسید نمی‌گیرد'
  FROM @ops x
  WHERE x.IsTemplate = 0
    AND EXISTS (SELECT 1 FROM mes.RoutingOperationLink k WHERE k.ToRoutingOperationId = x.Id AND k.IsDeleted = 0)
    AND NOT EXISTS (SELECT 1 FROM mes.RoutingOperationLink k WHERE k.FromRoutingOperationId = x.Id AND k.IsDeleted = 0)
    AND NOT EXISTS (SELECT 1 FROM mes.RoutingOperationOutput z WHERE z.RoutingOperationId = x.Id AND z.IsDeleted = 0);

  INSERT @d SELECT 'G4', 'GRAPH', 2, 'FRM-ME-02', MIN(x.RoutingId), k.FromRoutingOperationId, NULL, MIN(x.RCode),
         N'جمع سهم شاخه‌های موازی پس از عملیات ' + CAST(MIN(x.Sequence) AS NVARCHAR(8)) + N' برابر ' + CAST(CAST(SUM(k.SharePercent) AS DECIMAL(9,2)) AS NVARCHAR(16)) + N'٪ است', NULL
  FROM mes.RoutingOperationLink k JOIN @ops x ON x.Id = k.FromRoutingOperationId
  WHERE k.IsDeleted = 0 GROUP BY k.FromRoutingOperationId
  HAVING COUNT(*) > 1 AND COUNT(k.SharePercent) > 0 AND ABS(ISNULL(SUM(k.SharePercent), 0) - 100) > 0.01;

  INSERT @d SELECT 'G5', 'GRAPH', 1, 'FRM-ME-02', r.Id, NULL, NULL, r.Number, N'روش تک‌مرحله‌ای ' + r.Number + N' بیش از یک عملیات دارد', NULL
  FROM mes.RoutingMaster r
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0 AND r.RoutingMethodCode = 1
    AND (SELECT COUNT(*) FROM mes.RoutingOperation o WHERE o.RoutingId = r.Id AND o.IsDeleted = 0) > 1;

  /* ── ME-03 زمان ── */
  INSERT @d SELECT 'T1', 'TIME', CASE WHEN x.RStatus = 3 THEN 3 ELSE 2 END, 'FRM-ME-03', x.RoutingId, x.Id, x.OperationId, x.RCode + N'/' + CAST(x.Sequence AS NVARCHAR(8)),
         N'عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + N' «' + x.OpTitle + N'» زمان استاندارد ندارد', N'نه برنامه‌ریزی ظرفیت و نه سنجش کارایی ممکن است'
  FROM @ops x
  WHERE x.IsTemplate = 0 AND x.RStatus IN (2, 3)
    AND NOT EXISTS (SELECT 1 FROM mes.RoutingOperationTiming t WHERE t.RoutingOperationId = x.Id AND t.IsDeleted = 0);

  INSERT @d SELECT 'T2', 'TIME', 2, 'FRM-ME-03', x.RoutingId, x.Id, x.OperationId, x.RCode + N'/' + CAST(x.Sequence AS NVARCHAR(8)),
         N'کارکرد «' + ct.Name + N'» در عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + CASE c.CalculationBasisCode WHEN 3 THEN N' پلکانی است ولی پله ندارد' ELSE N' فرمولی است ولی فرمول ندارد' END, NULL
  FROM mes.RoutingOperationCapacity c JOIN @ops x ON x.Id = c.RoutingOperationId JOIN mes.CapacityType ct ON ct.Id = c.CapacityTypeId
  WHERE c.IsDeleted = 0 AND ((c.CalculationBasisCode = 3 AND NULLIF(LTRIM(c.StepsText), N'') IS NULL) OR (c.CalculationBasisCode = 5 AND NULLIF(LTRIM(c.Formula), N'') IS NULL));

  INSERT @d SELECT 'T3', 'TIME', 1, 'FRM-ME-03', x.RoutingId, x.Id, x.OperationId, x.RCode + N'/' + CAST(x.Sequence AS NVARCHAR(8)),
         N'دسته‌ی انتقال عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + N' از اندازه‌ی بچ آن بزرگ‌تر است', NULL
  FROM mes.RoutingOperationTiming t JOIN @ops x ON x.Id = t.RoutingOperationId
  WHERE t.IsDeleted = 0 AND t.TransferBatchSize > t.RoutingBatchSize;

  INSERT @d SELECT DISTINCT 'T4', 'TIME', 1, 'FRM-ME-03', x.RoutingId, x.Id, x.OperationId, e.Number,
         N'تجهیز «' + e.Name + N'» در گروه منبع عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + N' ماتریس زمان تعویض ندارد', N'RM-02 — ماتریس تعویض'
  FROM @ops x JOIN mes.ResourceGroupMember m ON m.ResourceGroupId = x.ResourceGroupId AND m.IsDeleted = 0
  JOIN mes.Equipment e ON e.Id = m.EquipmentId
  WHERE x.IsTemplate = 0 AND x.RStatus = 3 AND NOT EXISTS (SELECT 1 FROM mes.ChangeoverTime ct WHERE ct.EquipmentId = e.Id AND ct.IsDeleted = 0);

  /* ── ME-04 مواد، خروجی، ویژگی بچ ── */
  ;WITH al AS (
    SELECT a.RoutingId, a.Id AS AssignmentId, s.Number AS StructureCode, x.ItemId, x.Sequence, p.Name AS ProductTitle,
           SUM(m.AllocationPercent) AS Allocated, COUNT(m.Id) AS Rows
    FROM mes.RoutingProductStructureAssignment a
    JOIN mes.ProductStructure s ON s.Id = a.ProductStructureId
    CROSS APPLY mes.fnStructureItems(a.ProductStructureId, NULL) x
    JOIN mes.Product p ON p.Id = x.ProductId
    LEFT JOIN mes.RoutingOperationMaterial m ON m.ProductStructureItemId = x.ItemId AND m.RoutingProductStructureAssignmentId = a.Id AND m.IsDeleted = 0
    WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0 AND x.Source <> 'removed'
    GROUP BY a.RoutingId, a.Id, s.Number, x.ItemId, x.Sequence, p.Name
  )
  INSERT @d SELECT CASE WHEN al.Rows = 0 THEN 'M1' ELSE 'M2' END, 'MAT', CASE WHEN r.RoutingMasterStatusCode = 3 THEN 2 ELSE 1 END, 'FRM-ME-04', al.RoutingId, NULL, NULL, al.StructureCode,
         CASE WHEN al.Rows = 0 THEN N'«' + al.ProductTitle + N'» (' + al.StructureCode + N') به هیچ عملیاتی تخصیص نیافته'
              ELSE N'«' + al.ProductTitle + N'» (' + al.StructureCode + N') ' + CAST(CAST(al.Allocated AS DECIMAL(9,1)) AS NVARCHAR(16)) + N'٪ تخصیص یافته، نه ۱۰۰٪' END,
         N'روش ' + r.Number
  FROM al JOIN mes.RoutingMaster r ON r.Id = al.RoutingId
  WHERE r.IsTemplate = 0 AND (al.Rows = 0 OR ABS(al.Allocated - 100) > 0.01);

  INSERT @d SELECT 'O1', 'OUT', CASE WHEN r.RoutingMasterStatusCode = 3 THEN 2 ELSE 1 END, 'FRM-ME-04', a.RoutingId, NULL, NULL, s.Number,
         N'خروجی «' + p.Name + N'» ساختار ' + s.Number + N' به هیچ عملیاتی از ' + r.Number + N' وصل نیست', NULL
  FROM mes.RoutingProductStructureAssignment a
  JOIN mes.RoutingMaster r ON r.Id = a.RoutingId AND r.IsTemplate = 0
  JOIN mes.ProductStructure s ON s.Id = a.ProductStructureId
  JOIN mes.ProductStructureMaster sm ON sm.ProductStructureId = s.Id AND sm.IsDeleted = 0
  JOIN mes.Product p ON p.Id = sm.ProductId
  WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0
    AND NOT EXISTS (SELECT 1 FROM mes.RoutingOperationOutput x JOIN mes.RoutingOperation o ON o.Id = x.RoutingOperationId
                    WHERE o.RoutingId = a.RoutingId AND x.OuputProductId = sm.ProductId AND x.IsDeleted = 0);

  INSERT @d SELECT 'B1', 'BATCH', 2, 'FRM-ME-04', x.RoutingId, x.Id, x.OperationId, pa.Number,
         N'عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + N' ویژگی «' + pa.Name + N'» را تأیید می‌کند ولی در این روش تعیین نمی‌شود', NULL
  FROM mes.RoutingOperationBatchAttribute b JOIN @ops x ON x.Id = b.RoutingOperationId JOIN mes.ProductionAttribute pa ON pa.Id = b.ProductionAttributeId
  WHERE b.IsDeleted = 0 AND b.ActionCode = 3
    AND NOT EXISTS (SELECT 1 FROM mes.RoutingOperationBatchAttribute b2 JOIN mes.RoutingOperation o2 ON o2.Id = b2.RoutingOperationId
                    WHERE o2.RoutingId = x.RoutingId AND b2.ProductionAttributeId = b.ProductionAttributeId AND b2.ActionCode <> 3 AND b2.IsDeleted = 0);

  /* ── ME-05 بازیابی ── */
  INSERT @d SELECT 'C1', 'REC', 1, 'FRM-ME-05', x.RoutingId, x.Id, x.OperationId, rm.Number,
         N'نرخ بازیابی «' + p.Name + N'» در عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + N' ' + CAST(CAST(y.RecoveryPercent AS DECIMAL(9,1)) AS NVARCHAR(16)) + N'٪ است؛ استاندارد PE-05 ' + CAST(CAST(rm.StandardRecoveryPercent AS DECIMAL(9,1)) AS NVARCHAR(16)) + N'٪', NULL
  FROM mes.RoutingOperationRecovery y JOIN @ops x ON x.Id = y.RoutingOperationId JOIN mes.RecoveredMaterial rm ON rm.Id = y.RecoveredMaterialId JOIN mes.Product p ON p.Id = rm.ProductId
  WHERE y.IsDeleted = 0 AND rm.StandardRecoveryPercent IS NOT NULL AND ABS(y.RecoveryPercent - rm.StandardRecoveryPercent) > 0.01;

  INSERT @d SELECT 'C2', 'REC', 2, 'FRM-ME-05', x.RoutingId, x.Id, x.OperationId, rm.Number,
         N'«' + p.Name + N'» مستقیم به همان دستور برمی‌گردد ولی تأیید QC لازم دارد', NULL
  FROM mes.RoutingOperationRecovery y JOIN @ops x ON x.Id = y.RoutingOperationId JOIN mes.RecoveredMaterial rm ON rm.Id = y.RecoveredMaterialId JOIN mes.Product p ON p.Id = rm.ProductId
  WHERE y.IsDeleted = 0 AND y.ReturnModeCode = 1 AND rm.RequiresQcApproval = 1;

  INSERT @d SELECT 'C3', 'REC', 1, 'FRM-ME-05', NULL, NULL, NULL, rm.Number, N'ماده‌ی بازیابی‌شده‌ی «' + p.Name + N'» در هیچ روشی عملیات بازیابی ندارد', NULL
  FROM mes.RecoveredMaterial rm JOIN mes.Product p ON p.Id = rm.ProductId
  WHERE rm.CompanyId = @CompanyId AND rm.IsDeleted = 0 AND rm.IsActive = 1
    AND NOT EXISTS (SELECT 1 FROM mes.RoutingOperationRecovery y WHERE y.RecoveredMaterialId = rm.Id AND y.IsDeleted = 0);

  /* ── ME-06 سیاست مؤثر (خاص‌ترین لایه برنده) ── */
  ;WITH pm AS (
    SELECT x.RoutingId, x.Id AS RoutingOperationId, x.Sequence, x.RCode, p.Id AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, m.IsBackflushed,
           CAST(ISNULL(si.IsActiveIngredient, 0) AS BIT) AS IsActiveIngredient,
           COALESCE(lo.ConsumptionPolicyCode, lp.ConsumptionPolicyCode, lg.ConsumptionPolicyCode, lc.ConsumptionPolicyCode) AS Cons,
           COALESCE(lo.IsBackflushExcluded, lp.IsBackflushExcluded, lg.IsBackflushExcluded, lc.IsBackflushExcluded) AS Excl,
           COALESCE(lo.ShortageBehaviorCode, lp.ShortageBehaviorCode, lg.ShortageBehaviorCode, lc.ShortageBehaviorCode) AS Short
    FROM mes.RoutingOperationMaterial m
    JOIN @ops x ON x.Id = m.RoutingOperationId AND x.RStatus = 3 AND x.IsTemplate = 0
    JOIN mes.Product p ON p.Id = m.ProductId
    LEFT JOIN mes.ProductStructureItem si ON si.Id = m.ProductStructureItemId
    OUTER APPLY (SELECT TOP (1) * FROM mes.ProductionMaterialPolicy q WHERE q.ScopeTypeCode = 4 AND q.RoutingOperationId = m.RoutingOperationId AND q.IsDeleted = 0 AND q.CompanyId = @CompanyId) lo
    OUTER APPLY (SELECT TOP (1) * FROM mes.ProductionMaterialPolicy q WHERE q.ScopeTypeCode = 3 AND q.ProductId = p.Id AND q.IsDeleted = 0 AND q.CompanyId = @CompanyId) lp
    OUTER APPLY (SELECT TOP (1) * FROM mes.ProductionMaterialPolicy q WHERE q.ScopeTypeCode = 2 AND q.ProductGroupTitle = p.ProductGroupTitle AND q.IsDeleted = 0 AND q.CompanyId = @CompanyId) lg
    OUTER APPLY (SELECT TOP (1) * FROM mes.ProductionMaterialPolicy q WHERE q.ScopeTypeCode = 1 AND q.IsDeleted = 0 AND q.CompanyId = @CompanyId) lc
    WHERE m.IsDeleted = 0
  )
  INSERT @d
  SELECT 'P1', 'POL', 3, 'FRM-ME-06', pm.RoutingId, pm.RoutingOperationId, NULL, pm.ProductCode,
         N'ماده‌ی مؤثره‌ی «' + pm.ProductTitle + N'» در ' + pm.RCode + N'/' + CAST(pm.Sequence AS NVARCHAR(8)) + N' با Backflush مصرف می‌شود', N'مصرف عیاردار باید دستی و با تصحیح عیار ثبت شود'
  FROM pm WHERE pm.IsActiveIngredient = 1 AND (pm.IsBackflushed = 1 OR pm.Cons IN (2, 3)) AND ISNULL(pm.Excl, 0) = 0
  UNION ALL
  SELECT 'P2', 'POL', 2, 'FRM-ME-06', pm.RoutingId, pm.RoutingOperationId, NULL, pm.ProductCode,
         N'«' + pm.ProductTitle + N'» در ' + pm.RCode + N'/' + CAST(pm.Sequence AS NVARCHAR(8)) + N' اجازه‌ی موجودی منفی دارد', NULL
  FROM pm WHERE pm.Short = 2;

  INSERT @d SELECT 'P3', 'POL', 2, 'FRM-ME-06', NULL, NULL, NULL, q.Number, N'حداقل موجودی پای کار سیاست «' + q.Name + N'» (' + CAST(CAST(q.MinStock AS DECIMAL(18,0)) AS NVARCHAR(32)) + N') از حداکثر (' + CAST(CAST(q.MaxStock AS DECIMAL(18,0)) AS NVARCHAR(32)) + N') بیشتر است', NULL
  FROM mes.ProductionMaterialPolicy q
  WHERE q.CompanyId = @CompanyId AND q.IsDeleted = 0 AND q.MinStock > q.MaxStock;

  /* ── ME-07 برون‌سپاری ── */
  INSERT @d SELECT 'S1', 'SUB', 3, 'FRM-ME-07', x.RoutingId, x.Id, x.OperationId, x.RCode + N'/' + CAST(x.Sequence AS NVARCHAR(8)),
         N'عملیات برون‌سپاری ' + CAST(x.Sequence AS NVARCHAR(8)) + N' «' + x.OpTitle + N'» هیچ پیمانکار فعالی ندارد', NULL
  FROM @ops x
  WHERE x.IsOut = 1 AND x.IsTemplate = 0 AND NOT EXISTS (SELECT 1 FROM mes.RoutingOperationSubcontract s WHERE s.RoutingOperationId = x.Id AND s.IsDeleted = 0 AND s.IsActive = 1);

  INSERT @d
  SELECT v.RuleCode, 'SUB', v.Sev, 'FRM-ME-07', x.RoutingId, x.Id, x.OperationId, c.Number, N'پیمانکار «' + c.Name + N'» برای عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + N' — ' + v.Txt, v.Det
  FROM mes.RoutingOperationSubcontract s
  JOIN @ops x ON x.Id = s.RoutingOperationId
  JOIN mes.ProductionContractor c ON c.Id = s.ProductionContractorId
  OUTER APPLY (SELECT TOP (1) rt.FeePerUnit FROM mes.ProductionContractorRate rt WHERE rt.ContractorId = c.Id AND rt.ProductionOperationId = s.ProductionOperationId AND rt.IsDeleted = 0
               AND rt.ValidFromDate <= @today AND (rt.ValidToDate IS NULL OR rt.ValidToDate >= @today) ORDER BY rt.ValidFromDate DESC) fee
  CROSS APPLY (
    SELECT 'S2' AS RuleCode, 2 AS Sev, N'غیرفعال است' AS Txt, CAST(NULL AS NVARCHAR(600)) AS Det WHERE c.IsActive = 0
    UNION ALL SELECT 'S3', 3, N'در تعلیق صلاحیت است', NULL WHERE c.QualificationStatusCode = 3
    UNION ALL SELECT 'S4', 2, N'قراردادش تمام شده', N'پایان قرارداد ' + CONVERT(NVARCHAR(10), c.ContractToDate, 23) WHERE c.ContractToDate < @today
    UNION ALL SELECT 'S5', 1, N'کمتر از ۶۰ روز تا پایان قرارداد', N'پایان قرارداد ' + CONVERT(NVARCHAR(10), c.ContractToDate, 23) WHERE c.ContractToDate >= @today AND c.ContractToDate < DATEADD(DAY, 60, @today)
    UNION ALL SELECT 'S6', 2, N'قابلیت معتبر این عملیات را ندارد', N'RM-08 — قابلیت پیمانکار'
      WHERE NOT EXISTS (SELECT 1 FROM mes.ProductionContractorCapability k WHERE k.ContractorId = c.Id AND k.ProductionOperationId = s.ProductionOperationId AND k.IsDeleted = 0
                          AND (k.QualifiedUntilDate IS NULL OR k.QualifiedUntilDate >= @today))
    UNION ALL SELECT 'S7', 1, N'نرخ جاری در RM-08 ندارد', NULL WHERE fee.FeePerUnit IS NULL
    UNION ALL SELECT 'S8', 1, N'کارمزد روش با نرخ جاری RM-08 فرق دارد', N'روش ' + CAST(CAST(s.FeePerUnit AS DECIMAL(18,0)) AS NVARCHAR(32)) + N' / RM-08 ' + CAST(CAST(fee.FeePerUnit AS DECIMAL(18,0)) AS NVARCHAR(32))
      WHERE fee.FeePerUnit IS NOT NULL AND s.FeePerUnit IS NOT NULL AND ABS(fee.FeePerUnit - s.FeePerUnit) > 0.01
  ) v
  WHERE s.IsDeleted = 0 AND s.IsActive = 1;

  INSERT @d SELECT 'S9', 'SUB', 2, 'FRM-ME-07', r.Id, NULL, NULL, p.Number, N'قلم «' + p.Name + N'» روش کارمزدی ' + r.Number + N' مالکیت تعیین‌شده ندارد', NULL
  FROM mes.RoutingMaster r
  JOIN mes.RoutingProductStructureAssignment a ON a.RoutingId = r.Id AND a.IsDeleted = 0
  CROSS APPLY mes.fnStructureItems(a.ProductStructureId, NULL) x
  JOIN mes.Product p ON p.Id = x.ProductId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0 AND r.IsTollManufacturing = 1 AND x.Source <> 'removed'
    AND NOT EXISTS (SELECT 1 FROM mes.RoutingTollMaterial t WHERE t.RoutingId = r.Id AND t.ProductId = x.ProductId AND t.IsDeleted = 0 AND t.OwnershipCode IS NOT NULL);

  /* ── ME-08 نسخه‌ی تولید ── */
  INSERT @d SELECT 'V1', 'VER', 2, 'FRM-ME-08', r.Id, NULL, NULL, r.Number, N'روش تأییدشده‌ی ' + r.Number + N' ' + ISNULL(rv.Number, N'') + N' نسخه‌ی تولید فعال ندارد', N'هیچ دستوری نمی‌تواند خودکار این روش را بگیرد'
  FROM mes.RoutingMaster r LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0 AND r.IsTemplate = 0 AND r.RoutingMasterStatusCode = 3
    AND NOT EXISTS (SELECT 1 FROM mes.ManufacturingVersion v WHERE v.RoutingId = r.Id AND v.IsDeleted = 0 AND v.StatusCode = 3);

  INSERT @d SELECT 'V2', 'VER', 3, 'FRM-ME-08', r.Id, NULL, NULL, v.Number, N'نسخه‌ی فعال ' + v.Number + N' روی روش ' + CASE r.RoutingMasterStatusCode WHEN 4 THEN N'منسوخ' ELSE N'تأییدنشده' END + N' ' + r.Number + N' ' + ISNULL(rv.Number, N'') + N' است', NULL
  FROM mes.ManufacturingVersion v JOIN mes.RoutingMaster r ON r.Id = v.RoutingId LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  WHERE v.CompanyId = @CompanyId AND v.IsDeleted = 0 AND v.StatusCode = 3 AND ISNULL(r.RoutingMasterStatusCode, 1) <> 3;

  INSERT @d SELECT 'V3', 'VER', 3, 'FRM-ME-08', v.RoutingId, NULL, NULL, v.Number, N'نسخه‌ی ' + v.Number + N' روشی را با ساختاری ترکیب کرده که روش به آن اختصاص ندارد', N'ساختار ' + s.Number
  FROM mes.ManufacturingVersion v JOIN mes.ProductStructure s ON s.Id = v.ProductStructureId
  WHERE v.CompanyId = @CompanyId AND v.IsDeleted = 0 AND v.StatusCode <> 5
    AND NOT EXISTS (SELECT 1 FROM mes.RoutingProductStructureAssignment a WHERE a.RoutingId = v.RoutingId AND a.ProductStructureId = v.ProductStructureId AND a.IsDeleted = 0);

  INSERT @d SELECT 'V4', 'VER', 2, 'FRM-ME-08', a.RoutingId, NULL, NULL, a.Number + N'/' + b.Number,
         N'نسخه‌های ' + a.Number + N' و ' + b.Number + N' با اولویت یکسان در بازه‌ی بچ هم‌پوشانی دارند',
         N'هم‌پوشانی از ' + CAST(CAST(IIF(ISNULL(a.MinBatchSize, 0) > ISNULL(b.MinBatchSize, 0), ISNULL(a.MinBatchSize, 0), ISNULL(b.MinBatchSize, 0)) AS DECIMAL(18,0)) AS NVARCHAR(32))
         + N' تا ' + CAST(CAST(IIF(ISNULL(a.MaxBatchSize, 1e15) < ISNULL(b.MaxBatchSize, 1e15), ISNULL(a.MaxBatchSize, 1e15), ISNULL(b.MaxBatchSize, 1e15)) AS DECIMAL(18,0)) AS NVARCHAR(32))
  FROM mes.ManufacturingVersion a
  JOIN mes.ManufacturingVersion b ON b.ProductId = a.ProductId AND b.Id > a.Id AND b.Priority = a.Priority AND b.StatusCode = 3 AND b.IsDeleted = 0
       AND b.EffectivityTypeCode = a.EffectivityTypeCode
  WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0 AND a.StatusCode = 3
    AND ISNULL(a.MinBatchSize, 0) <= ISNULL(b.MaxBatchSize, 1e15) AND ISNULL(b.MinBatchSize, 0) <= ISNULL(a.MaxBatchSize, 1e15)
    AND EXISTS (SELECT 1 FROM mes.fnLinesInScope(a.OrgNodeId, a.ProductionLineId) fa JOIN mes.fnLinesInScope(b.OrgNodeId, b.ProductionLineId) fb ON fb.LineId = fa.LineId);

  /* ── ME-09 پیوسته ── */
  INSERT @d SELECT 'K1', 'CONT', 2, 'FRM-ME-09', v.RoutingId, NULL, NULL, v.Number + N'/' + s.Number,
         N'برنامه‌ی شیفت ' + s.Name + N' نسخه‌ی ' + v.Number + N' (' + CAST(CAST(t.PlannedQuantity AS DECIMAL(18,1)) AS NVARCHAR(32)) + N') از ظرفیت نظری (' + CAST(CAST(cap.Cap AS DECIMAL(18,1)) AS NVARCHAR(32)) + N') بیشتر است', NULL
  FROM mes.ShiftOrderTemplate t
  JOIN mes.ManufacturingVersion v ON v.Id = t.ManufacturingVersionId
  JOIN mes.RoutingMaster r ON r.Id = v.RoutingId
  JOIN mes.ProductionWorkingShift s ON s.Id = t.WorkingShiftId
  CROSS APPLY (SELECT CASE WHEN r.RateTimeBasisCode = 2 THEN r.RateQuantity ELSE r.RateQuantity * ISNULL(t.NetRunMinutes, s.Duration) / 60.0 END AS Cap) cap
  WHERE t.CompanyId = @CompanyId AND t.IsDeleted = 0 AND t.IsActive = 1 AND t.PlannedQuantity > cap.Cap;

  INSERT @d SELECT 'K2', 'CONT', 1, 'FRM-ME-09', x.RoutingId, x.Id, x.OperationId, x.RCode + N'/' + CAST(x.Sequence AS NVARCHAR(8)),
         N'عملیات پیوسته‌ی ' + CAST(x.Sequence AS NVARCHAR(8)) + N' «' + x.OpTitle + N'» قاعده‌ی انتقال شیفت ندارد', NULL
  FROM @ops x JOIN mes.RoutingMaster r ON r.Id = x.RoutingId AND r.ProductionTypeCode = 2
  WHERE NOT EXISTS (SELECT 1 FROM mes.ShiftHandoverRule h WHERE h.RoutingOperationId = x.Id AND h.IsDeleted = 0);

  /* ── ME-10 هزینه ── */
  INSERT @d SELECT CASE WHEN a.CostDriverId IS NULL THEN 'H1' ELSE 'H2' END, 'COST', 2, 'FRM-ME-10', x.RoutingId, x.Id, x.OperationId, pa.Number,
         N'فعالیت «' + pa.Name + N'» در عملیات ' + CAST(x.Sequence AS NVARCHAR(8)) + CASE WHEN a.CostDriverId IS NULL THEN N' محرک هزینه ندارد' ELSE N' محرکی دارد که کارکردش مجاز نیست (' + ct.Name + N')' END,
         N'RM-09 — محرک هزینه'
  FROM mes.RoutingOperationActivity a JOIN @ops x ON x.Id = a.RoutingOperationId JOIN mes.ProductionActivity pa ON pa.Id = a.ActivityId
  LEFT JOIN mes.CostDriver cd ON cd.Id = a.CostDriverId LEFT JOIN mes.CapacityType ct ON ct.Id = cd.CapacityTypeId
  WHERE a.IsDeleted = 0 AND (a.CostDriverId IS NULL OR ISNULL(ct.IsCostDriver, 0) = 0);

  INSERT @d SELECT 'H3', 'COST', 2, 'FRM-ME-10', MIN(x.RoutingId), z.RoutingOperationId, NULL, MIN(x.RCode),
         N'جمع سهم هزینه‌ی خروجی‌های عملیات ' + CAST(MIN(x.Sequence) AS NVARCHAR(8)) + N' برابر ' + CAST(CAST(SUM(ISNULL(z.CostSharePercent, 0)) AS DECIMAL(9,2)) AS NVARCHAR(16)) + N'٪ است', NULL
  FROM mes.RoutingOperationOutput z JOIN @ops x ON x.Id = z.RoutingOperationId
  WHERE z.IsDeleted = 0 GROUP BY z.RoutingOperationId
  HAVING COUNT(z.CostSharePercent) > 0 AND ABS(SUM(ISNULL(z.CostSharePercent, 0)) - 100) > 0.01;

  SELECT d.RuleCode, d.CategoryCode, d.Severity, d.FormCode, CAST(d.RoutingId AS INT) AS RoutingId, CAST(d.RoutingOperationId AS INT) AS RoutingOperationId,
         CAST(d.OperationId AS INT) AS OperationId, d.EntityRef, d.Title, d.Detail
  FROM @d d
  ORDER BY d.Severity DESC, d.CategoryCode, d.RuleCode;
END
GO

/* استاندارد در برابر واقعیت: هر گزارش تولید و کارکرد واقعی هر عملیات دستور */
CREATE OR ALTER PROCEDURE mes.GetBiStandardVsActual
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(x.Id AS INT) AS ReportId, x.ReportNumber, CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WOTypeCode, w.WorkOrderStatusCode,
         CAST(o.Id AS INT) AS WOOperationId, CAST(o.RoutingOperationId AS INT) AS RoutingOperationId, CAST(w.RoutingId AS INT) AS RoutingId, o.Sequence,
         op.Name AS OperationTitle, CAST(ISNULL(wc.ProductionLineId, w.ProductionLineId) AS INT) AS LineId,
         COALESCE(wc.Number + N' ' + wc.Name, g.Number + N' — ' + g.Name) AS ResourceTitle,
         x.StartTime, x.EndTime, DATEDIFF(MINUTE, x.StartTime, x.EndTime) AS Minutes, x.CompletedQuantity, x.WastedQuantity, CAST(ISNULL(x.IsReprocess, 0) AS BIT) AS IsReprocess,
         x.SourceCode, o.ToCompleteQuantity,
         CAST(CASE WHEN ROW_NUMBER() OVER (PARTITION BY o.Id ORDER BY x.StartTime, x.Id) = 1 THEN 1 ELSE 0 END AS BIT) AS IsFirstReport,
         (SELECT COUNT(*) FROM mes.WorkOrderOperationOutput x2 WHERE x2.WOOperationId = o.Id AND x2.IsDeleted = 0) AS ReportsInOperation
  FROM mes.WorkOrderOperationOutput x
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
  LEFT JOIN mes.ResourceGroup g ON g.Id = o.ResourceGroupId
  WHERE x.CompanyId = @CompanyId AND x.IsDeleted = 0 AND x.StartTime IS NOT NULL AND x.EndTime IS NOT NULL
  ORDER BY o.RoutingOperationId, x.StartTime;

  /* کارکرد واقعی هر عملیات دستور در برابر مبنای محاسبه‌ی روش (اگر یکی از دو طرف نباشد هم می‌آید) */
  ;WITH used AS (
    SELECT u.WOOperationId, u.CapacityTypeId, SUM(u.Quantity) AS Actual
    FROM mes.WorkOrderOperationCapacityUsage u WHERE u.CompanyId = @CompanyId AND u.IsDeleted = 0 GROUP BY u.WOOperationId, u.CapacityTypeId
  ), ops AS (
    SELECT o.Id AS WOOperationId, o.RoutingOperationId, SUM(x.CompletedQuantity + x.WastedQuantity) AS Produced
    FROM mes.WorkOrderOperation o JOIN mes.WorkOrderOperationOutput x ON x.WOOperationId = o.Id AND x.IsDeleted = 0
    WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0 GROUP BY o.Id, o.RoutingOperationId
  ), pairs AS (
    SELECT ops.WOOperationId, ops.RoutingOperationId, ops.Produced, u.CapacityTypeId FROM ops JOIN used u ON u.WOOperationId = ops.WOOperationId
    UNION
    SELECT ops.WOOperationId, ops.RoutingOperationId, ops.Produced, c.CapacityTypeId FROM ops JOIN mes.RoutingOperationCapacity c ON c.RoutingOperationId = ops.RoutingOperationId AND c.IsDeleted = 0
  )
  SELECT CAST(p.WOOperationId AS INT) AS WOOperationId, CAST(p.RoutingOperationId AS INT) AS RoutingOperationId, CAST(p.CapacityTypeId AS INT) AS CapacityTypeId,
         ct.Number AS CapacityCode, ct.Name AS CapacityTitle, ct.MeasureUnitTitle AS UnitTitle, p.Produced, u.Actual,
         c.CalculationBasisCode, c.FixedQuantity, c.VariableQuantity, c.PerQuantity, c.StepsText
  FROM pairs p
  JOIN mes.CapacityType ct ON ct.Id = p.CapacityTypeId
  LEFT JOIN used u ON u.WOOperationId = p.WOOperationId AND u.CapacityTypeId = p.CapacityTypeId
  LEFT JOIN mes.RoutingOperationCapacity c ON c.RoutingOperationId = p.RoutingOperationId AND c.CapacityTypeId = p.CapacityTypeId AND c.IsDeleted = 0
  ORDER BY p.RoutingOperationId, p.WOOperationId, ct.SortOrder;
END
GO

/* پوشش نسخه‌ی تولید: صلاحیت هر نسخه برای کالا × خط × نوع دستور (قواعد mes.SelectManufacturingVersion بدون قید مقدار) */
CREATE OR ALTER PROCEDURE mes.GetBiVersionCoverage
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @asOf DATE = CAST(mes.fnShopNow() AS DATE);
  SELECT CAST(v.ProductId AS INT) AS ProductId, CAST(l.Id AS INT) AS LineId, t.OrderTypeCode, CAST(v.Id AS INT) AS VersionId, v.Number AS VersionCode, v.Name AS VersionTitle,
         v.Priority, v.MinBatchSize, v.MaxBatchSize, v.StatusCode, v.EffectivityTypeCode, CAST(v.RoutingId AS INT) AS RoutingId, r.Number + N' ' + ISNULL(rv.Number, N'') AS RoutingCode,
         CASE
           WHEN v.StatusCode <> 3 THEN N'وضعیت نسخه فعال نیست'
           WHEN v.EffectivityTypeCode = 1 AND (v.ValidFromDate > @asOf OR (v.ValidToDate IS NOT NULL AND v.ValidToDate < @asOf)) THEN N'خارج از بازه‌ی اعتبار تاریخ'
           WHEN v.EffectivityTypeCode <> 1 THEN N'اعتبار بچ‌محور/سفارش‌محور — فقط برای همان بچ یا سفارش'
           WHEN NOT EXISTS (SELECT 1 FROM mes.fnLinesInScope(v.OrgNodeId, v.ProductionLineId) f WHERE f.LineId = l.Id) THEN N'خط در دامنه‌ی مکانی نسخه نیست'
           WHEN (t.OrderTypeCode = 1 AND v.AllowsStandardOrder = 0) OR (t.OrderTypeCode = 2 AND v.AllowsReworkOrder = 0)
             OR (t.OrderTypeCode = 3 AND v.AllowsSampleOrder = 0) OR (t.OrderTypeCode = 4 AND v.AllowsTollOrder = 0) THEN N'این نوع دستور روی نسخه مجاز نیست'
           WHEN r.RoutingMasterStatusCode <> 3 OR (r.ValidToDate IS NOT NULL AND r.ValidToDate < @asOf) THEN N'روش ساخت تأییدشده‌ی معتبر نیست'
           WHEN s.ProductStructureStatusCode <> 3 THEN N'ساختار محصول تأییدشده نیست'
           WHEN NOT EXISTS (SELECT 1 FROM mes.RoutingProductStructureAssignment a WHERE a.RoutingId = r.Id AND a.ProductStructureId = s.Id AND a.IsDeleted = 0) THEN N'روش به این ساختار اختصاص ندارد'
         END AS RejectReason
  FROM mes.ManufacturingVersion v
  JOIN mes.RoutingMaster r ON r.Id = v.RoutingId
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  JOIN mes.ProductStructure s ON s.Id = v.ProductStructureId
  CROSS JOIN mes.ProductionLine l
  CROSS JOIN (VALUES (1), (2), (3), (4)) t(OrderTypeCode)
  WHERE v.CompanyId = @CompanyId AND v.IsDeleted = 0 AND l.CompanyId = @CompanyId AND l.IsDeleted = 0
  ORDER BY v.ProductId, l.Id, t.OrderTypeCode, v.Priority, v.Number;

  /* کالاهای تولیدی: صاحب نسخه، صاحب ساختار تأییدشده‌ی اختصاص‌یافته، یا تقاضای باز */
  ;WITH p AS (
    SELECT v.ProductId FROM mes.ManufacturingVersion v WHERE v.CompanyId = @CompanyId AND v.IsDeleted = 0
    UNION SELECT m.ProductId FROM mes.RoutingProductStructureAssignment a JOIN mes.ProductStructureMaster m ON m.ProductStructureId = a.ProductStructureId AND m.IsMainProduct = 1 AND m.IsDeleted = 0
          JOIN mes.RoutingMaster r ON r.Id = a.RoutingId AND r.IsTemplate = 0 WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0
    UNION SELECT q.ProductId FROM mes.ProductionRequest q WHERE q.CompanyId = @CompanyId AND q.IsDeleted = 0 AND q.StatusCode IN (1, 2, 3, 4)
  )
  SELECT CAST(pr.Id AS INT) AS ProductId, pr.Number AS ProductCode, pr.Name AS ProductTitle, pr.MeasureUnitTitle AS UnitTitle,
         (SELECT COUNT(*) FROM mes.ManufacturingVersion v WHERE v.ProductId = pr.Id AND v.IsDeleted = 0) AS VersionCount,
         (SELECT SUM(q.Quantity) FROM mes.ProductionRequest q WHERE q.ProductId = pr.Id AND q.IsDeleted = 0 AND q.StatusCode IN (1, 2, 3, 4)) AS OpenRequestQuantity,
         (SELECT COUNT(*) FROM mes.WorkOrder w WHERE w.MainProductId = pr.Id AND w.IsDeleted = 0 AND w.WorkOrderStatusCode IN (1, 2, 3)) AS OpenWorkOrders,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductStructureMaster m JOIN mes.ProductStructure s ON s.Id = m.ProductStructureId
                                WHERE m.ProductId = pr.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0 AND s.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT) AS HasStructure
  FROM p JOIN mes.Product pr ON pr.Id = p.ProductId
  ORDER BY pr.Number;

  SELECT CAST(l.Id AS INT) AS LineId, l.Number AS LineCode, l.Name AS LineTitle FROM mes.ProductionLine l
  WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0 ORDER BY l.Number;
END
GO

/* مدل ظرفیت برای شبیه‌ساز گلوگاه: منابع با ظرفیت جاری و تقویم، و تقاضای باز */
CREATE OR ALTER PROCEDURE mes.GetBiCapacityModel
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(mes.fnShopNow() AS DATE);
  ;WITH cal AS (
    SELECT f.LineId,
           CASE WHEN cr.Is24x7 = 1 THEN 1440 WHEN cr.ToTime > cr.FromTime THEN cr.ToTime - cr.FromTime ELSE 1440 - cr.FromTime + cr.ToTime END AS DayMinutes,
           CASE WHEN cr.Is24x7 = 1 THEN 7 ELSE (cr.WorkDaysMask & 1) + (cr.WorkDaysMask & 2) / 2 + (cr.WorkDaysMask & 4) / 4 + (cr.WorkDaysMask & 8) / 8
                + (cr.WorkDaysMask & 16) / 16 + (cr.WorkDaysMask & 32) / 32 + (cr.WorkDaysMask & 64) / 64 END AS WeekDays,
           cr.Name AS CalendarTitle
    FROM mes.fnLineCalendarRule() f JOIN mes.ProductionCalendarRule cr ON cr.Id = f.RuleId
  ), res AS (
    SELECT 'S' AS ResKind, w.Id AS ResId, w.Number + N' ' + w.Name AS Title, w.ProductionLineId AS LineId, l.Name AS LineTitle, w.IsActive, w.IsBottleneck,
           c.DayMinutes, c.WeekDays, c.CalendarTitle
    FROM mes.WorkCenter w JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId LEFT JOIN cal c ON c.LineId = w.ProductionLineId
    WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND ISNULL(w.TopologyTypeCode, '') <> 'buffer'
    UNION ALL
    SELECT 'G', g.Id, g.Number + N' — ' + g.Name, NULL,
           (SELECT STRING_AGG(x.Name, N'، ') FROM (SELECT DISTINCT l2.Name FROM mes.WorkCenter w2 JOIN mes.ProductionLine l2 ON l2.Id = w2.ProductionLineId
              WHERE w2.ResourceGroupId = g.Id AND w2.IsDeleted = 0) x), CAST(1 AS BIT), CAST(0 AS BIT),
           mx.DayMinutes, mx.WeekDays, mx.CalendarTitle
    FROM mes.ResourceGroup g
    OUTER APPLY (SELECT TOP (1) c.DayMinutes, c.WeekDays, c.CalendarTitle FROM mes.WorkCenter w2 JOIN cal c ON c.LineId = w2.ProductionLineId
                 WHERE w2.ResourceGroupId = g.Id AND w2.IsDeleted = 0 ORDER BY c.DayMinutes * c.WeekDays DESC) mx
    WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0
  )
  SELECT res.ResKind, CAST(res.ResId AS INT) AS ResId, res.Title, CAST(res.LineId AS INT) AS LineId, res.LineTitle, res.IsActive, res.IsBottleneck,
         res.DayMinutes, res.WeekDays, res.CalendarTitle,
         CAST(CASE WHEN res.ResKind = 'S' THEN (SELECT w.ResourceGroupId FROM mes.WorkCenter w WHERE w.Id = res.ResId) END AS INT) AS GroupId,
         COALESCE(mch.AvailableCount, mm.AvailableCount) AS MachineCount, COALESCE(mch.EquipmentAvailPercent, mm.EquipmentAvailPercent) AS EquipmentAvailPercent,
         COALESCE(mch.ProductivityPercent, mm.ProductivityPercent) AS ProductivityPercent, COALESCE(mch.StandardDowntime, mm.StandardDowntime) AS StandardDowntime,
         lab.AvailableCount AS LaborCount,
         CASE WHEN mch.AvailableCount IS NOT NULL THEN 1 WHEN mm.AvailableCount IS NOT NULL THEN 2 ELSE 0 END AS CapacitySource
  FROM res
  OUTER APPLY (SELECT TOP (1) c.AvailableCount, c.EquipmentAvailPercent, c.ProductivityPercent, c.StandardDowntime FROM mes.WorkCenterCapacity c JOIN mes.CapacityType ct ON ct.Id = c.CapacityTypeId
               WHERE ct.Number = N'MCH' AND c.IsDeleted = 0 AND c.ValidFromDate <= @today AND (c.ValidToDate IS NULL OR c.ValidToDate >= @today)
                 AND ((res.ResKind = 'S' AND c.WorkCenterId = res.ResId) OR (res.ResKind = 'G' AND c.ResourceGroupId = res.ResId)) ORDER BY c.ValidFromDate DESC) mch
  OUTER APPLY (SELECT TOP (1) c.AvailableCount FROM mes.WorkCenterCapacity c JOIN mes.CapacityType ct ON ct.Id = c.CapacityTypeId
               WHERE ct.Number = N'LAB' AND c.IsDeleted = 0 AND c.ValidFromDate <= @today AND (c.ValidToDate IS NULL OR c.ValidToDate >= @today)
                 AND ((res.ResKind = 'S' AND c.WorkCenterId = res.ResId) OR (res.ResKind = 'G' AND c.ResourceGroupId = res.ResId)) ORDER BY c.ValidFromDate DESC) lab
  /* گروه منبع بی‌ظرفیت خود: جمع ماشین‌های ایستگاه‌های عضو (CapacitySource = 2) */
  OUTER APPLY (SELECT SUM(c.AvailableCount) AS AvailableCount, AVG(c.EquipmentAvailPercent) AS EquipmentAvailPercent, AVG(c.ProductivityPercent) AS ProductivityPercent,
                      AVG(c.StandardDowntime) AS StandardDowntime
               FROM mes.WorkCenter w JOIN mes.WorkCenterCapacity c ON c.WorkCenterId = w.Id AND c.IsDeleted = 0 JOIN mes.CapacityType ct ON ct.Id = c.CapacityTypeId
               WHERE res.ResKind = 'G' AND w.ResourceGroupId = res.ResId AND w.IsDeleted = 0 AND ct.Number = N'MCH'
                 AND c.ValidFromDate <= @today AND (c.ValidToDate IS NULL OR c.ValidToDate >= @today)) mm
  ORDER BY res.ResKind DESC, res.LineId, res.Title;

  /* تقاضای باز: درخواست تأییدشده‌ی بی‌دستور و باقی‌مانده‌ی دستورهای باز */
  SELECT N'REQ' AS SourceCode, q.Number, CAST(q.ProductId AS INT) AS ProductId, q.Quantity AS Remaining, q.NeedDate AS NeedDate, CAST(NULL AS INT) AS LineId,
         CAST(NULL AS INT) AS RoutingId, CAST(NULL AS INT) AS VersionId, q.PriorityCode, 1 AS OrderTypeCode
  FROM mes.ProductionRequest q
  WHERE q.CompanyId = @CompanyId AND q.IsDeleted = 0 AND q.StatusCode IN (2, 3)
    AND NOT EXISTS (SELECT 1 FROM mes.ProductionRequestWorkOrder k WHERE k.ProductionRequestId = q.Id AND k.IsDeleted = 0)
  UNION ALL
  SELECT N'WO', w.Number, CAST(w.MainProductId AS INT), CAST(w.Quantity * (1 - ISNULL(pg.Done, 0)) AS DECIMAL(32,4)), ISNULL(w.DueDate, w.PlannedCompleteDate),
         CAST(w.ProductionLineId AS INT), CAST(w.RoutingId AS INT), CAST(w.ManufacturingVersionId AS INT), w.WorkOrderPriorityCode,
         /* نوع دستور در انتخاب نسخه: دوباره‌کاری ۲، R&D/نمونه ۳، کارمزدی ۴، بقیه عادی */
         CASE w.WOTypeCode WHEN 3 THEN 2 WHEN 7 THEN 3 WHEN 6 THEN 4 ELSE 1 END
  FROM mes.WorkOrder w
  OUTER APPLY (SELECT CASE WHEN SUM(o.ToCompleteQuantity) > 0 THEN SUM(IIF(o.CompletedQuantity > o.ToCompleteQuantity, o.ToCompleteQuantity, ISNULL(o.CompletedQuantity, 0))) / SUM(o.ToCompleteQuantity) END AS Done
               FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) pg
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.WorkOrderStatusCode IN (1, 2, 3)
  ORDER BY 1, 2;
END
GO

/* ثبت فرم و منو در ALM */
IF NOT EXISTS (SELECT 1 FROM alm.Form WHERE Code = 'FRM-ME-11')
  INSERT alm.Form (Code, Title, SubSystemCode, AnalysisDocumentCode, FormTypeCode, PrimaryAccessGroupCode, OtherAccessGroupsText, TabsDescription, TabCount, ActionCount,
                   FeatureCount, EstimateFromFeatures, OverheadEstimate, TotalEstimate, DesignOwner, SortOrder, Note, CreatorCode, CreationDate, Guid, PhaseCode)
  SELECT 'FRM-ME-11', N'رصدخانه‌ی مهندسی تولید (BI)', SubSystemCode, AnalysisDocumentCode, FormTypeCode, PrimaryAccessGroupCode,
         N'مدیر مهندسی تولید، مهندس فرایند، برنامه‌ریز تولید، مدیر تولید، بهای تمام‌شده، تأمین',
         N'نقشه‌ی سلامت روش‌ها · استاندارد در برابر واقعیت · شبیه‌ساز گلوگاه · پوشش نسخه‌ی تولید · وابستگی بیرونی و هزینه · بدهی فنی', 6, 0, 0, 0, 0, 0, DesignOwner, 355,
         N'BI مهندسی تولید برای جلسه‌ی بازبینی مهندسی؛ به درخواست کاربر (۱۸ مهر ۱۴۰۵). فقط‌خواندنی؛ روی داده‌ی ME-01 تا ME-10، RM و اجرای PC.', CreatorCode, GETDATE(), NEWID(), PhaseCode
  FROM alm.Form WHERE Code = 'FRM-ME-10';

IF NOT EXISTS (SELECT 1 FROM alm.Menu WHERE Code = '44011')
  INSERT alm.Menu (Code, Title, ParentCode, SubSystemCode, MenuLevel, AnalysisDocumentCode, FormTypeCode, FormCode, SortOrder, Note, CreatorCode, CreationDate, Guid, PhaseCode)
  SELECT '44011', N'رصدخانه‌ی مهندسی تولید (BI)', '440', SubSystemCode, MenuLevel, AnalysisDocumentCode, FormTypeCode, 'FRM-ME-11', 355,
         N'BI مهندسی تولید — جلسه‌ی بازبینی', CreatorCode, GETDATE(), NEWID(), PhaseCode
  FROM alm.Menu WHERE Code = '44010';
GO
