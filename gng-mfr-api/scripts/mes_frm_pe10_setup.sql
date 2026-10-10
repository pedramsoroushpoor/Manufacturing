/* =====================================================================
   اسکیمای mes — گام ۴۴: FRM-PE-10 «رصدخانه‌ی مهندسی محصول» (BI)

   هدف: تکیه‌گاه جلسه‌ی بازبینی مهندسی. نقطه‌های ضعف داده‌ی مهندسی را پیدا می‌کند، رفتار استانداردهای
   ساختار را در اجرای واقعی می‌سنجد و اثر تغییر (کمبود ماده، جایگزین، ECO) را شبیه‌سازی می‌کند.
   جدول تازه ندارد؛ روی جدول‌های PE-01 تا PE-09 و داده‌ی اجرای PC شش نمای تحلیلی می‌سازد:
     mes.GetBiPeProducts     یک ردیف واقعیت به‌ازای هر کالا (نقش، سیاست تأمین، ساختار پیش‌فرض، موجودی، نیاز باز، مصرف ۱۴ روز)
     mes.GetBiPeStructures   یک ردیف واقعیت به‌ازای هر ساختار (نسخه، پروانه، ترکیب درصدی، بازده، ماتریس، دستورها)
     mes.GetBiPeItems        ردیف‌های مؤثر نسخه‌ی جاری همه‌ی ساختارها (fnStructureItems + fnStructureItemQty) با ساختار پیش‌فرض فرزند
                             — پایه‌ی بسط چندسطحی و کاربرد معکوس سمت فرانت (همان قاعده‌ی mes.ExplodeStructure)
     mes.GetBiPeChecks       چک‌لیست سلامت مهندسی: یک ردیف به‌ازای هر (موجودیت × کنترل)، قبول و رد، با فرم مالک
     mes.GetBiPeExecution    (۱) نمونه‌های مصرف واقعی در برابر استاندارد ردیف ساختار (۲) نمونه‌های بازده خروجی‌ها
     mes.GetBiPeDemand       (۱) نیاز باز مواد دستورهای باز (۲) درخواست‌های تولید باز
     mes.GetBiPeEcoDetail    (۱) دامنه‌ی همه‌ی ECOها (۲) امضاهای همه‌ی ECOها
     mes.GetBiPeSubstitutes  اعضای همه‌ی گزینه‌های همه‌ی گروه‌های جایگزین (تخت)

   کدهای کنترل سلامت (Severity: ۳ بحرانی، ۲ مهم، ۱ توصیه):
     S01 ساختار و نسخه‌ی جاری تأییدشده (PE-02)         S02 پروانه‌ی ساخت معتبر محصول نهایی (PE-02)
     S03 جمع ردیف‌های درصدی ۱۰۰٪ (PE-02)               S04 موازنه‌ی جرم: جمع بازده خروجی‌ها ۱۰۰٪ (PE-04)
     S05 ماده‌ی خریدنی غیرمؤثره گروه جایگزین دارد (PE-03) S06 گروه جایگزین ردیف با کالای ردیف می‌خواند (PE-03)
     S07 ردیف با سقف مصرف بازیافتی، ماده‌ی بازیافتی تعریف‌شده دارد (PE-05)
     S08 ECO باز روی ساختار نیست (PE-09)                S09 ماتریس ابعادی کامل (PE-06)
     S10 همه‌ی کالاهای ساختار نقش تولیدی دارند (PE-01)   S11 نیمه‌ساخته‌های ساختار ساختار پیش‌فرض دارند (PE-02)
     P01 کالای به‌کاررفته نقش تولیدی دارد (PE-01)       P02 ردیابی بچ درست (محصول/نیمه‌ساخته ردیابی، فانتوم بدون ردیابی) (PE-01)
     P03 اندازه‌ی بچ برای تولید داخلی (PE-01)           P04 کالای تولیدی ساختار تولیدی پیش‌فرض دارد (PE-02)
     P05 سیاست تأمین به پیمانکار تعلیق/غیرفعال/قرارداد منقضی نیست (PE-01)
     G01 اولویت یکتا در گروه جایگزین  G02 گروه در ساختاری به کار رفته  G03 اعضا نقش تولیدی دارند (PE-03)
     E01 ECO باز تاریخ اثر و سیاست موجودی دارد  E02 امضای معوق بیش از ۷ روز نیست (PE-09)

   ثبت در ALM: فرم FRM-PE-10 و منوی 43010 زیر «مهندسی محصول» (هر دو فقط اگر نباشند).
   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است. «اکنون» = mes.fnShopNow().
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* واقعیت کالاها */
CREATE OR ALTER PROCEDURE mes.GetBiPeProducts
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();
  DECLARE @from14 DATETIME2 = DATEADD(DAY, -14, @now);

  ;WITH wm AS (
    SELECT m.ProductId, w.Id AS WorkOrderId, w.DueDate, m.StandardQuantity - ISNULL(c.Act, 0) AS Remaining
    FROM mes.WorkOrderOperationMaterial m
    JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId AND o.IsDeleted = 0
    JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId AND w.IsDeleted = 0
    OUTER APPLY (SELECT SUM(CASE WHEN c.IsReversal = 1 THEN -c.ConsumedQuantity ELSE c.ConsumedQuantity END) AS Act
                 FROM mes.WorkOrderOperationMaterialConsumed c WHERE c.WOOperationMaterialId = m.Id AND c.IsDeleted = 0) c
    WHERE m.CompanyId = @CompanyId AND m.IsDeleted = 0 AND w.WorkOrderStatusCode IN (1, 2, 3, 7)
  ), od AS (
    SELECT ProductId, SUM(CASE WHEN Remaining > 0 THEN Remaining ELSE 0 END) AS OpenRequirement,
           COUNT(DISTINCT CASE WHEN Remaining > 0 THEN WorkOrderId END) AS OpenOrders,
           MIN(CASE WHEN Remaining > 0 THEN DueDate END) AS EarliestDue
    FROM wm GROUP BY ProductId
  ), hc AS (
    SELECT m.ProductId, SUM(CASE WHEN c.IsReversal = 1 THEN -c.ConsumedQuantity ELSE c.ConsumedQuantity END) AS Consumed14
    FROM mes.WorkOrderOperationMaterialConsumed c JOIN mes.WorkOrderOperationMaterial m ON m.Id = c.WOOperationMaterialId
    WHERE c.CompanyId = @CompanyId AND c.IsDeleted = 0 AND c.EndTime >= @from14 AND c.EndTime < @now
    GROUP BY m.ProductId
  )
  SELECT CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, p.ProductGroupTitle,
         CAST(pi.Id AS INT) AS ProductionItemId, pi.ProductionRoleCode, pi.TrackingLevelCode, pi.IsPhantom, pi.IsDimensional,
         ISNULL(sp.Policies, 0) AS Policies, ISNULL(sp.MakeCount, 0) AS MakeCount, ISNULL(sp.BuyCount, 0) AS BuyCount, ISNULL(sp.OutsourceCount, 0) AS OutsourceCount,
         sp.BadContractors,
         (SELECT COUNT(*) FROM mes.ProductionItemLotSize l WHERE l.ProductionItemId = pi.Id AND l.IsDeleted = 0) AS LotSizeCount,
         CAST(ds.StructureId AS INT) AS DefaultStructureId,
         (SELECT COUNT(*) FROM mes.ProductStructure s2 JOIN mes.ProductStructureMaster m2 ON m2.ProductStructureId = s2.Id AND m2.IsMainProduct = 1 AND m2.IsDeleted = 0
          WHERE s2.IsDeleted = 0 AND m2.ProductId = p.Id) AS StructureCount,
         ISNULL(st.ReleasedOnHand, 0) AS ReleasedOnHand, ISNULL(st.ReleasedReserved, 0) AS ReleasedReserved, ISNULL(st.QuarantineQty, 0) AS QuarantineQty,
         ISNULL(st.RejectedQty, 0) AS RejectedQty, ISNULL(st.ExpiredQty, 0) AS ExpiredQty, ISNULL(st.InTransitQty, 0) AS InTransitQty,
         ISNULL(st.CustomerOwnedQty, 0) AS CustomerOwnedQty, st.NextArrival, st.NearestExpiry, ISNULL(st.Batches, 0) AS Batches,
         ISNULL(hc.Consumed14, 0) AS Consumed14,
         ISNULL(od.OpenRequirement, 0) AS OpenRequirement, ISNULL(od.OpenOrders, 0) AS OpenOrders, od.EarliestDue,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.RecoveredMaterial r WHERE r.IsDeleted = 0 AND r.IsActive = 1 AND (r.ProductId = p.Id OR r.SourceProductId = p.Id))
                   THEN 1 ELSE 0 END AS BIT) AS HasRecoveredMaterial,
         (SELECT COUNT(DISTINCT o.SubstituteGroupId) FROM mes.SubstituteGroupOption o
          JOIN mes.SubstituteGroupMember mb ON mb.SubstituteGroupOptionId = o.Id AND mb.IsDeleted = 0
          WHERE o.IsDeleted = 0 AND o.OptionNo = 0 AND mb.ProductId = p.Id) AS SubstituteGroups
  FROM mes.Product p
  LEFT JOIN mes.ProductionItem pi ON pi.ProductId = p.Id AND pi.IsDeleted = 0
  OUTER APPLY (SELECT COUNT(*) AS Policies,
                      SUM(CASE WHEN s.ProductSourceCode = 1 THEN 1 ELSE 0 END) AS MakeCount,
                      SUM(CASE WHEN s.ProductSourceCode = 2 THEN 1 ELSE 0 END) AS BuyCount,
                      SUM(CASE WHEN s.ProductSourceCode = 3 THEN 1 ELSE 0 END) AS OutsourceCount,
                      STRING_AGG(CASE WHEN c.IsActive = 0 THEN c.Name + N' (غیرفعال)'
                                      WHEN c.QualificationStatusCode = 3 THEN c.Name + N' (تعلیق)'
                                      WHEN c.ContractToDate < @now THEN c.Name + N' (قرارداد منقضی)' END, N'، ') AS BadContractors
               FROM mes.ProductionItemSupplyPolicy s LEFT JOIN mes.ProductionContractor c ON c.Id = s.ContractorId AND c.IsDeleted = 0
               WHERE s.ProductionItemId = pi.Id AND s.IsDeleted = 0) sp
  OUTER APPLY (SELECT TOP (1) s.Id AS StructureId FROM mes.ProductStructure s
               JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0
               WHERE s.IsDeleted = 0 AND s.IsDefaultProductStructure = 1 AND s.ProductStructureTypeCode = 1 AND m.ProductId = p.Id ORDER BY s.Id) ds
  OUTER APPLY (SELECT SUM(CASE WHEN x.QcStatusCode = 1 AND x.InventoryKindCode NOT IN (4, 6) AND x.IsCustomerOwned = 0 AND (x.ExpireDate IS NULL OR x.ExpireDate > @now)
                               THEN x.OnHandQuantity ELSE 0 END) AS ReleasedOnHand,
                      SUM(CASE WHEN x.QcStatusCode = 1 AND x.InventoryKindCode NOT IN (4, 6) AND x.IsCustomerOwned = 0 AND (x.ExpireDate IS NULL OR x.ExpireDate > @now)
                               THEN ISNULL(x.ReservedQuantity, 0) ELSE 0 END) AS ReleasedReserved,
                      SUM(CASE WHEN x.QcStatusCode = 2 OR x.InventoryKindCode = 3 THEN x.OnHandQuantity ELSE 0 END) AS QuarantineQty,
                      SUM(CASE WHEN x.QcStatusCode = 3 THEN x.OnHandQuantity ELSE 0 END) AS RejectedQty,
                      SUM(CASE WHEN x.ExpireDate <= @now THEN x.OnHandQuantity ELSE 0 END) AS ExpiredQty,
                      SUM(CASE WHEN x.InventoryKindCode = 6 THEN x.OnHandQuantity ELSE 0 END) AS InTransitQty,
                      SUM(CASE WHEN x.IsCustomerOwned = 1 OR x.InventoryKindCode = 4 THEN x.OnHandQuantity ELSE 0 END) AS CustomerOwnedQty,
                      MIN(CASE WHEN x.InventoryKindCode = 6 THEN x.ExpectedArrivalDate END) AS NextArrival,
                      MIN(CASE WHEN x.QcStatusCode = 1 AND x.ExpireDate > @now THEN x.ExpireDate END) AS NearestExpiry,
                      COUNT(*) AS Batches
               FROM mes.MaterialStock x WHERE x.ProductId = p.Id AND x.IsDeleted = 0) st
  LEFT JOIN hc ON hc.ProductId = p.Id
  LEFT JOIN od ON od.ProductId = p.Id
  WHERE p.CompanyId = @CompanyId AND p.IsDeleted = 0
  ORDER BY p.Number;
END
GO

/* واقعیت ساختارها */
CREATE OR ALTER PROCEDURE mes.GetBiPeStructures
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();
  SELECT CAST(s.Id AS INT) AS StructureId, s.Number AS StructureCode, s.Name AS StructureTitle, s.ProductStructureTypeCode AS TypeCode,
         s.ProductStructureStatusCode AS StatusCode, s.IsDefaultProductStructure AS IsDefault, CAST(m.ProductId AS INT) AS ProductId,
         CAST(m.Quantity AS DECIMAL(18,4)) AS BaseQuantity, s.License, CAST(s.TemplateProductStructureId AS INT) AS TemplateId, s.AllowPercentOver100,
         CAST(s.RevisionId AS INT) AS RevisionId, rv.Number AS RevisionCode, sr.RevisionStatusCode, sr.EffectivityTypeCode, sr.EcoNumber,
         sr.ValidFromDate AS RevisionFrom, sr.ApproverTitle,
         (SELECT COUNT(*) FROM mes.ProductStructureRevision r2 WHERE r2.ProductStructureId = s.Id AND r2.IsDeleted = 0) AS RevisionCount,
         lic.LicenseValidTo, ISNULL(lic.LicenseCount, 0) AS LicenseCount,
         ISNULL(it.ItemCount, 0) AS ItemCount, ISNULL(it.PctRows, 0) AS PctRows, CAST(ISNULL(it.PctSum, 0) AS DECIMAL(9,3)) AS PctSum, ISNULL(it.QsRows, 0) AS QsRows,
         ISNULL(y.YieldRows, 0) AS YieldRows, CAST(y.YieldTotal AS DECIMAL(9,3)) AS YieldTotal, ISNULL(y.OutputCount, 0) AS OutputCount,
         CAST(y.CostShareTotal AS DECIMAL(9,3)) AS CostShareTotal,
         ISNULL(mx.Cells, 0) AS MatrixCells, ISNULL(mx.MissingCells, 0) AS MatrixMissing,
         ISNULL(wo.OpenOrders, 0) AS OpenOrders, ISNULL(wo.TotalOrders, 0) AS TotalOrders, wo.LastCompleted
  FROM mes.ProductStructure s
  LEFT JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = s.RevisionId
  LEFT JOIN mes.ProductStructureRevision sr ON sr.ProductStructureId = s.Id AND sr.RevisionId = s.RevisionId AND sr.IsDeleted = 0
  OUTER APPLY (SELECT MAX(a.ValidToDate) AS LicenseValidTo, COUNT(*) AS LicenseCount
               FROM mes.ProductStructureAttachment a
               JOIN mes.ProductStructureMaster m2 ON m2.ProductStructureId = a.ProductStructureId AND m2.IsMainProduct = 1 AND m2.IsDeleted = 0
               WHERE a.IsDeleted = 0 AND a.DocumentTypeCode = 1 AND m2.ProductId = m.ProductId) lic
  OUTER APPLY (SELECT COUNT(*) AS ItemCount, SUM(CASE WHEN x.QuantityTypeCode = 4 THEN 1 ELSE 0 END) AS PctRows,
                      SUM(CASE WHEN x.QuantityTypeCode = 4 AND ISNULL(x.IsQuantumSatis, 0) = 0 THEN x.Quantity ELSE 0 END) AS PctSum,
                      SUM(CASE WHEN x.IsQuantumSatis = 1 THEN 1 ELSE 0 END) AS QsRows
               FROM mes.fnStructureItems(s.Id, NULL) x WHERE x.Source <> 'removed') it
  OUTER APPLY (SELECT COUNT(o.YieldPercent) AS YieldRows, SUM(o.YieldPercent) AS YieldTotal, COUNT(*) AS OutputCount,
                      SUM(CASE WHEN o.MasterProductTypeCode IN (1, 2) THEN o.CostAllocationPercentage END) AS CostShareTotal
               FROM mes.ProductStructureMaster o WHERE o.ProductStructureId = s.Id AND o.IsDeleted = 0) y
  OUTER APPLY (SELECT COUNT(*) AS Cells, SUM(CASE WHEN dv.Id IS NULL THEN 1 ELSE 0 END) AS MissingCells
               FROM mes.ProductStructureItem i
               JOIN mes.ProductionItem pi2 ON pi2.ProductId = m.ProductId AND pi2.IsDeleted = 0
               JOIN mes.ProductionItemVariant vr ON vr.ProductionItemId = pi2.Id AND vr.IsDeleted = 0 AND vr.IsActive = 1
               OUTER APPLY (SELECT TOP (1) vv.ProductionDimensionValueId FROM mes.ProductionItemVariantValue vv
                            JOIN mes.ProductionDimensionValue x ON x.Id = vv.ProductionDimensionValueId
                            WHERE vv.ProductionItemVariantId = vr.Id AND vv.IsDeleted = 0 AND x.ProductionDimensionId = i.ProductionDimensionId) vval
               LEFT JOIN mes.ProductStructureItemDimensionValue dv ON dv.ProductStructureItemId = i.Id
                    AND dv.ProductionDimensionValueId = vval.ProductionDimensionValueId AND dv.IsDeleted = 0
               WHERE i.ProductStructureId = s.Id AND i.RevisionId = s.RevisionId AND i.IsDeleted = 0 AND i.ProductionDimensionId IS NOT NULL) mx
  OUTER APPLY (SELECT SUM(CASE WHEN w.WorkOrderStatusCode IN (1, 2, 3, 7) THEN 1 ELSE 0 END) AS OpenOrders,
                      SUM(CASE WHEN w.WorkOrderStatusCode <> 6 THEN 1 ELSE 0 END) AS TotalOrders, MAX(w.ActualCompleteDate) AS LastCompleted
               FROM mes.WorkOrder w WHERE w.ProductStructureId = s.Id AND w.IsDeleted = 0) wo
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0
  ORDER BY s.Number;
END
GO

/* ردیف‌های مؤثر نسخه‌ی جاری همه‌ی ساختارها، با ساختار پیش‌فرض فرزند برای بسط چندسطحی */
CREATE OR ALTER PROCEDURE mes.GetBiPeItems
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(s.Id AS INT) AS StructureId, CAST(x.ItemId AS INT) AS ItemId, x.Source, CAST(x.ProductId AS INT) AS ProductId, x.Sequence,
         x.QuantityTypeCode, CAST(x.Quantity AS DECIMAL(32,6)) AS Quantity, CAST(q.QtyAtBase AS DECIMAL(32,6)) AS QtyAtBase,
         x.ToleranceForNormalWaste AS WastePercent, x.WasteQuantity, ISNULL(x.IsQuantumSatis, 0) AS IsQuantumSatis,
         ISNULL(x.IsActiveIngredient, 0) AS IsActiveIngredient, ISNULL(x.IsMainMaterial, 0) AS IsMainMaterial, x.ItemRoleTitle,
         x.MinConsumptionPercent, x.MaxConsumptionPercent, CAST(i.SubstituteGroupId AS INT) AS SubstituteGroupId, ISNULL(i.IsRecovery, 0) AS IsRecovery,
         i.MaxRecoveredUsePercent, CAST(i.ProductionDimensionId AS INT) AS ProductionDimensionId,
         CAST(ch.StructureId AS INT) AS ChildStructureId
  FROM mes.ProductStructure s
  CROSS APPLY mes.fnStructureItems(s.Id, NULL) x
  JOIN mes.ProductStructureItem i ON i.Id = x.ItemId
  OUTER APPLY (SELECT TOP (1) qq.QtyAtBase FROM mes.fnStructureItemQty(s.Id) qq WHERE qq.ProductId = x.ProductId AND qq.Sequence = x.Sequence) q
  OUTER APPLY (SELECT TOP (1) c.Id AS StructureId FROM mes.ProductStructure c
               JOIN mes.ProductStructureMaster cm ON cm.ProductStructureId = c.Id AND cm.IsMainProduct = 1 AND cm.IsDeleted = 0
               WHERE c.IsDeleted = 0 AND c.IsDefaultProductStructure = 1 AND c.ProductStructureTypeCode = 1 AND cm.ProductId = x.ProductId AND c.Id <> s.Id
               ORDER BY c.Id) ch
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0 AND x.Source <> 'removed'
  ORDER BY s.Id, x.Sequence;
END
GO

/* چک‌لیست سلامت مهندسی: هر (موجودیت × کنترل) یک ردیف، چه قبول چه رد */
CREATE OR ALTER PROCEDURE mes.GetBiPeChecks
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();

  CREATE TABLE #c (EntityType VARCHAR(10), EntityId BIGINT, StructureId BIGINT, ProductId BIGINT, CheckCode VARCHAR(5), Passed BIT,
                   Severity INT, FormCode VARCHAR(12), Detail NVARCHAR(2000));

  SELECT s.Id, s.Number, s.ProductStructureTypeCode AS TypeCode, s.ProductStructureStatusCode AS StatusCode, s.AllowPercentOver100,
         m.ProductId, pi.ProductionRoleCode AS MainRole, sr.RevisionStatusCode, rv.Number AS RevisionCode
  INTO #s
  FROM mes.ProductStructure s
  LEFT JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0
  LEFT JOIN mes.ProductionItem pi ON pi.ProductId = m.ProductId AND pi.IsDeleted = 0
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = s.RevisionId
  LEFT JOIN mes.ProductStructureRevision sr ON sr.ProductStructureId = s.Id AND sr.RevisionId = s.RevisionId AND sr.IsDeleted = 0
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0;

  SELECT s.Id AS StructureId, x.ItemId, x.ProductId, x.Sequence, x.QuantityTypeCode, x.Quantity, ISNULL(x.IsQuantumSatis, 0) AS IsQs,
         ISNULL(x.IsActiveIngredient, 0) AS IsAi, i.SubstituteGroupId, i.MaxRecoveredUsePercent, p.Number AS Code, p.Name AS Title,
         pi.ProductionRoleCode AS Role, pi.IsPhantom
  INTO #i
  FROM #s s
  CROSS APPLY mes.fnStructureItems(s.Id, NULL) x
  JOIN mes.ProductStructureItem i ON i.Id = x.ItemId
  JOIN mes.Product p ON p.Id = x.ProductId
  LEFT JOIN mes.ProductionItem pi ON pi.ProductId = x.ProductId AND pi.IsDeleted = 0
  WHERE x.Source <> 'removed';

  /* S01 تأیید ساختار و نسخه‌ی جاری */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S01', CASE WHEN s.StatusCode = 3 AND s.RevisionStatusCode = 3 THEN 1 ELSE 0 END, 3, 'FRM-PE-02',
         CASE WHEN s.StatusCode = 3 AND s.RevisionStatusCode = 3 THEN NULL
              ELSE N'وضعیت ساختار ' + CASE s.StatusCode WHEN 1 THEN N'پیش‌نویس' WHEN 2 THEN N'در گردش تأیید' WHEN 4 THEN N'منسوخ' ELSE N'تأییدشده' END
                   + N'؛ نسخه‌ی ' + ISNULL(s.RevisionCode, N'—') + N' ' + CASE ISNULL(s.RevisionStatusCode, 0) WHEN 1 THEN N'پیش‌نویس' WHEN 2 THEN N'در گردش تأیید'
                                                                     WHEN 3 THEN N'فعال' WHEN 4 THEN N'منسوخ' ELSE N'بدون سابقه' END END
  FROM #s s;

  /* S02 پروانه‌ی ساخت معتبر (ساختار تولیدی محصول نهایی) */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S02', CASE WHEN l.ValidTo >= @now THEN 1 ELSE 0 END, 3, 'FRM-PE-02',
         CASE WHEN l.ValidTo IS NULL THEN N'مدرک پروانه‌ی ساخت برای این محصول ثبت نشده'
              WHEN l.ValidTo < @now THEN N'پروانه‌ی ساخت از ' + FORMAT(l.ValidTo, 'yyyy-MM-dd') + N' منقضی شده' END
  FROM #s s
  OUTER APPLY (SELECT MAX(a.ValidToDate) AS ValidTo FROM mes.ProductStructureAttachment a
               JOIN mes.ProductStructureMaster m2 ON m2.ProductStructureId = a.ProductStructureId AND m2.IsMainProduct = 1 AND m2.IsDeleted = 0
               WHERE a.IsDeleted = 0 AND a.DocumentTypeCode = 1 AND m2.ProductId = s.ProductId) l
  WHERE s.TypeCode = 1 AND s.MainRole = 1;

  /* S03 جمع درصدی */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S03',
         CASE WHEN ABS(p.PctSum - 100) < 0.001 OR (p.QsRows > 0 AND p.PctSum <= 100) OR (s.AllowPercentOver100 = 1 AND p.PctSum >= 100) THEN 1 ELSE 0 END, 3, 'FRM-PE-02',
         N'جمع ردیف‌های درصدی ' + FORMAT(p.PctSum, '0.###') + N'٪' + CASE WHEN p.QsRows > 0 THEN N' (با q.s.)' ELSE N'' END
  FROM #s s
  CROSS APPLY (SELECT SUM(CASE WHEN i.IsQs = 0 THEN i.Quantity ELSE 0 END) AS PctSum, SUM(CASE WHEN i.IsQs = 1 THEN 1 ELSE 0 END) AS QsRows, COUNT(*) AS N
               FROM #i i WHERE i.StructureId = s.Id AND i.QuantityTypeCode = 4) p
  WHERE p.N > 0;

  /* S04 موازنه‌ی جرم خروجی‌ها */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S04', CASE WHEN ABS(y.Total - 100) < 0.01 THEN 1 ELSE 0 END, 3, 'FRM-PE-04',
         N'جمع بازده ' + FORMAT(y.Total, '0.###') + N'٪ در ' + CAST(y.N AS NVARCHAR(5)) + N' خروجی'
  FROM #s s
  CROSS APPLY (SELECT SUM(o.YieldPercent) AS Total, COUNT(o.YieldPercent) AS N FROM mes.ProductStructureMaster o WHERE o.ProductStructureId = s.Id AND o.IsDeleted = 0) y
  WHERE y.N > 0;

  /* S05 ماده‌ی خریدنی (غیر مؤثره، غیر q.s.) بدون گروه جایگزین */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S05', CASE WHEN f.N = 0 THEN 1 ELSE 0 END, 1, 'FRM-PE-03',
         CASE WHEN f.N > 0 THEN N'بدون جایگزین: ' + f.List END
  FROM #s s
  CROSS APPLY (SELECT COUNT(*) AS N, STRING_AGG(i.Code + N' ' + i.Title, N'، ') AS List
               FROM #i i WHERE i.StructureId = s.Id AND i.Role = 3 AND i.IsAi = 0 AND i.IsQs = 0 AND ISNULL(i.Quantity, 0) > 0 AND i.SubstituteGroupId IS NULL) f
  WHERE s.TypeCode IN (1, 2) AND EXISTS (SELECT 1 FROM #i i WHERE i.StructureId = s.Id AND i.Role = 3);

  /* S06 گروه جایگزین ردیف با کالای ردیف سازگار است */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S06', CASE WHEN f.N = 0 THEN 1 ELSE 0 END, 2, 'FRM-PE-03',
         CASE WHEN f.N > 0 THEN f.List END
  FROM #s s
  CROSS APPLY (SELECT COUNT(*) AS N, STRING_AGG(i.Code + N' ' + i.Title + N' ← گروه ' + g.Number + N' که این کالا را در اقلام اصلی ندارد', N'؛ ') AS List
               FROM #i i JOIN mes.SubstituteGroup g ON g.Id = i.SubstituteGroupId
               WHERE i.StructureId = s.Id AND NOT EXISTS (SELECT 1 FROM mes.SubstituteGroupOption o
                    JOIN mes.SubstituteGroupMember mb ON mb.SubstituteGroupOptionId = o.Id AND mb.IsDeleted = 0
                    WHERE o.SubstituteGroupId = g.Id AND o.OptionNo = 0 AND o.IsDeleted = 0 AND mb.ProductId = i.ProductId)) f
  WHERE EXISTS (SELECT 1 FROM #i i WHERE i.StructureId = s.Id AND i.SubstituteGroupId IS NOT NULL);

  /* S07 سقف مصرف بازیافتی بدون ماده‌ی بازیافتی */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S07', CASE WHEN f.N = 0 THEN 1 ELSE 0 END, 2, 'FRM-PE-05',
         CASE WHEN f.N > 0 THEN N'مصرف بازیافتی مجاز ولی ماده‌ی بازیافتی تعریف نشده: ' + f.List END
  FROM #s s
  CROSS APPLY (SELECT COUNT(*) AS N, STRING_AGG(i.Code + N' ' + i.Title + N' (' + FORMAT(i.MaxRecoveredUsePercent, '0.#') + N'٪)', N'، ') AS List
               FROM #i i WHERE i.StructureId = s.Id AND i.MaxRecoveredUsePercent > 0
                 AND NOT EXISTS (SELECT 1 FROM mes.RecoveredMaterial r WHERE r.IsDeleted = 0 AND r.IsActive = 1 AND (r.ProductId = i.ProductId OR r.SourceProductId = i.ProductId))) f
  WHERE EXISTS (SELECT 1 FROM #i i WHERE i.StructureId = s.Id AND i.MaxRecoveredUsePercent > 0);

  /* S08 ECO باز روی ساختار، کالاهای آن یا گروه جایگزین آن */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S08', CASE WHEN f.N = 0 THEN 1 ELSE 0 END, 1, 'FRM-PE-09',
         CASE WHEN f.N > 0 THEN N'ECO باز: ' + f.List END
  FROM #s s
  CROSS APPLY (SELECT COUNT(*) AS N, STRING_AGG(e.Number, N'، ') AS List FROM mes.EngineeringChangeOrder e
               WHERE e.IsDeleted = 0 AND e.CompanyId = @CompanyId AND e.StatusCode BETWEEN 1 AND 4
                 AND EXISTS (SELECT 1 FROM mes.EngineeringChangeOrderItem ei WHERE ei.EngineeringChangeOrderId = e.Id AND ei.IsDeleted = 0
                              AND (ei.ProductStructureId = s.Id
                                   OR ei.ProductId IN (SELECT i.ProductId FROM #i i WHERE i.StructureId = s.Id)
                                   OR ei.SubstituteGroupId IN (SELECT i.SubstituteGroupId FROM #i i WHERE i.StructureId = s.Id)))) f
  WHERE s.TypeCode <> 3;

  /* S09 ماتریس ابعادی کامل */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S09', CASE WHEN f.Missing = 0 THEN 1 ELSE 0 END, 3, 'FRM-PE-06',
         CASE WHEN f.Missing > 0 THEN CAST(f.Missing AS NVARCHAR(5)) + N' خانه‌ی خالی از ' + CAST(f.Cells AS NVARCHAR(5)) + N': ' + f.List END
  FROM #s s
  CROSS APPLY (SELECT COUNT(*) AS Cells, SUM(CASE WHEN dv.Id IS NULL THEN 1 ELSE 0 END) AS Missing,
                      STRING_AGG(CASE WHEN dv.Id IS NULL THEN p.Name + N' × ' + vr.VariantCode END, N'، ') AS List
               FROM mes.ProductStructure st
               JOIN mes.ProductStructureItem i ON i.ProductStructureId = st.Id AND i.RevisionId = st.RevisionId AND i.IsDeleted = 0 AND i.ProductionDimensionId IS NOT NULL
               JOIN mes.Product p ON p.Id = i.ProductId
               JOIN mes.ProductionItem pi2 ON pi2.ProductId = s.ProductId AND pi2.IsDeleted = 0
               JOIN mes.ProductionItemVariant vr ON vr.ProductionItemId = pi2.Id AND vr.IsDeleted = 0 AND vr.IsActive = 1
               OUTER APPLY (SELECT TOP (1) vv.ProductionDimensionValueId FROM mes.ProductionItemVariantValue vv
                            JOIN mes.ProductionDimensionValue x ON x.Id = vv.ProductionDimensionValueId
                            WHERE vv.ProductionItemVariantId = vr.Id AND vv.IsDeleted = 0 AND x.ProductionDimensionId = i.ProductionDimensionId) vval
               LEFT JOIN mes.ProductStructureItemDimensionValue dv ON dv.ProductStructureItemId = i.Id
                    AND dv.ProductionDimensionValueId = vval.ProductionDimensionValueId AND dv.IsDeleted = 0
               WHERE st.Id = s.Id) f
  WHERE f.Cells > 0;

  /* S10 نقش تولیدی همه‌ی کالاهای ساختار (محصول اصلی + ردیف‌ها) */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S10', CASE WHEN f.N = 0 THEN 1 ELSE 0 END, 2, 'FRM-PE-01',
         CASE WHEN f.N > 0 THEN N'بدون نقش تولیدی: ' + f.List END
  FROM #s s
  CROSS APPLY (SELECT COUNT(*) AS N, STRING_AGG(z.Code + N' ' + z.Title, N'، ') AS List FROM (
                 SELECT p.Number AS Code, p.Name AS Title FROM mes.Product p WHERE p.Id = s.ProductId AND s.MainRole IS NULL
                 UNION SELECT i.Code, i.Title FROM #i i WHERE i.StructureId = s.Id AND i.Role IS NULL) z) f
  WHERE s.ProductId IS NOT NULL;

  /* S11 نیمه‌ساخته‌ی ردیف ساختار، ساختار تولیدی پیش‌فرض دارد */
  INSERT #c SELECT 'STRUCT', s.Id, s.Id, s.ProductId, 'S11', CASE WHEN f.N = 0 THEN 1 ELSE 0 END, 2, 'FRM-PE-02',
         CASE WHEN f.N > 0 THEN N'نیمه‌ساخته بدون ساختار: ' + f.List END
  FROM #s s
  CROSS APPLY (SELECT COUNT(*) AS N, STRING_AGG(i.Code + N' ' + i.Title, N'، ') AS List FROM #i i
               WHERE i.StructureId = s.Id AND i.Role = 2
                 AND NOT EXISTS (SELECT 1 FROM #s c WHERE c.ProductId = i.ProductId AND c.TypeCode = 1 AND c.Id <> s.Id)) f
  WHERE EXISTS (SELECT 1 FROM #i i WHERE i.StructureId = s.Id AND i.Role = 2);

  /* ---------------- کنترل‌های کالا ---------------- */
  SELECT p.Id, p.Number, p.Name, pi.Id AS ItemId, pi.ProductionRoleCode AS Role, pi.TrackingLevelCode AS Tracking, ISNULL(pi.IsPhantom, 0) AS IsPhantom,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM #i i WHERE i.ProductId = p.Id) OR EXISTS (SELECT 1 FROM #s s WHERE s.ProductId = p.Id)
                     OR EXISTS (SELECT 1 FROM mes.SubstituteGroupMember mb WHERE mb.ProductId = p.Id AND mb.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT) AS IsUsed,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductionItemSupplyPolicy sp WHERE sp.ProductionItemId = pi.Id AND sp.IsDeleted = 0 AND sp.ProductSourceCode = 1)
                   THEN 1 ELSE 0 END AS BIT) AS IsMade
  INTO #p
  FROM mes.Product p LEFT JOIN mes.ProductionItem pi ON pi.ProductId = p.Id AND pi.IsDeleted = 0
  WHERE p.CompanyId = @CompanyId AND p.IsDeleted = 0;

  INSERT #c SELECT 'PRODUCT', p.Id, NULL, p.Id, 'P01', CASE WHEN p.ItemId IS NULL THEN 0 ELSE 1 END, 2, 'FRM-PE-01',
         CASE WHEN p.ItemId IS NULL THEN N'در ساختار یا گروه جایگزین به کار رفته ولی نقش تولیدی ندارد' END
  FROM #p p WHERE p.IsUsed = 1 OR p.ItemId IS NOT NULL;

  INSERT #c SELECT 'PRODUCT', p.Id, NULL, p.Id, 'P02',
         CASE WHEN p.IsPhantom = 1 THEN CASE WHEN ISNULL(p.Tracking, 0) = 0 THEN 1 ELSE 0 END ELSE CASE WHEN ISNULL(p.Tracking, 0) > 0 THEN 1 ELSE 0 END END,
         CASE WHEN p.IsPhantom = 1 THEN 2 ELSE 3 END, 'FRM-PE-01',
         CASE WHEN p.IsPhantom = 1 AND ISNULL(p.Tracking, 0) > 0 THEN N'فانتوم است ولی ردیابی بچ دارد (فانتوم موجودی نمی‌شود)'
              WHEN p.IsPhantom = 0 AND ISNULL(p.Tracking, 0) = 0 THEN N'محصول/نیمه‌ساخته بدون ردیابی بچ (الزام GMP)' END
  FROM #p p WHERE p.Role IN (1, 2);

  INSERT #c SELECT 'PRODUCT', p.Id, NULL, p.Id, 'P03', CASE WHEN EXISTS (SELECT 1 FROM mes.ProductionItemLotSize l WHERE l.ProductionItemId = p.ItemId AND l.IsDeleted = 0) THEN 1 ELSE 0 END,
         2, 'FRM-PE-01', CASE WHEN NOT EXISTS (SELECT 1 FROM mes.ProductionItemLotSize l WHERE l.ProductionItemId = p.ItemId AND l.IsDeleted = 0) THEN N'تولید داخلی بدون اندازه‌ی بچ' END
  FROM #p p WHERE p.Role IN (1, 2) AND p.IsPhantom = 0 AND p.IsMade = 1;

  INSERT #c SELECT 'PRODUCT', p.Id, NULL, p.Id, 'P04', CASE WHEN EXISTS (SELECT 1 FROM #s s WHERE s.ProductId = p.Id AND s.TypeCode = 1) THEN 1 ELSE 0 END,
         3, 'FRM-PE-02', CASE WHEN NOT EXISTS (SELECT 1 FROM #s s WHERE s.ProductId = p.Id AND s.TypeCode = 1) THEN N'کالای تولید داخلی بدون ساختار تولیدی' END
  FROM #p p WHERE p.Role IN (1, 2) AND p.IsMade = 1;

  INSERT #c SELECT 'PRODUCT', p.Id, NULL, p.Id, 'P05', CASE WHEN b.List IS NULL THEN 1 ELSE 0 END, 2, 'FRM-PE-01',
         CASE WHEN b.List IS NOT NULL THEN N'سیاست تأمین به ' + b.List END
  FROM #p p
  CROSS APPLY (SELECT STRING_AGG(CASE WHEN c.IsActive = 0 THEN c.Name + N' (غیرفعال)' WHEN c.QualificationStatusCode = 3 THEN c.Name + N' (تعلیق)'
                                      WHEN c.ContractToDate < @now THEN c.Name + N' (قرارداد منقضی)' END, N'، ') AS List
               FROM mes.ProductionItemSupplyPolicy sp JOIN mes.ProductionContractor c ON c.Id = sp.ContractorId
               WHERE sp.ProductionItemId = p.ItemId AND sp.IsDeleted = 0) b
  WHERE EXISTS (SELECT 1 FROM mes.ProductionItemSupplyPolicy sp WHERE sp.ProductionItemId = p.ItemId AND sp.IsDeleted = 0 AND sp.ContractorId IS NOT NULL);

  /* ---------------- کنترل‌های گروه جایگزین ---------------- */
  INSERT #c SELECT 'SUBGRP', g.Id, NULL, NULL, 'G01', CASE WHEN d.N = 0 THEN 1 ELSE 0 END, 2, 'FRM-PE-03',
         CASE WHEN d.N > 0 THEN N'چند گزینه با اولویت یکسان — ترتیب جایگزینی مبهم است' END
  FROM mes.SubstituteGroup g
  CROSS APPLY (SELECT COUNT(*) AS N FROM (SELECT o.Priority FROM mes.SubstituteGroupOption o WHERE o.SubstituteGroupId = g.Id AND o.IsDeleted = 0 AND o.OptionNo > 0
                                          GROUP BY o.Priority HAVING COUNT(*) > 1) x) d
  WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0;

  INSERT #c SELECT 'SUBGRP', g.Id, NULL, NULL, 'G02', CASE WHEN EXISTS (SELECT 1 FROM #i i WHERE i.SubstituteGroupId = g.Id) THEN 1 ELSE 0 END, 1, 'FRM-PE-03',
         CASE WHEN NOT EXISTS (SELECT 1 FROM #i i WHERE i.SubstituteGroupId = g.Id) THEN N'در هیچ ساختار جاری به کار نرفته' END
  FROM mes.SubstituteGroup g WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0;

  INSERT #c SELECT 'SUBGRP', g.Id, NULL, NULL, 'G03', CASE WHEN f.List IS NULL THEN 1 ELSE 0 END, 2, 'FRM-PE-03',
         CASE WHEN f.List IS NOT NULL THEN N'عضو بدون نقش تولیدی: ' + f.List END
  FROM mes.SubstituteGroup g
  CROSS APPLY (SELECT STRING_AGG(p.Number + N' ' + p.Name, N'، ') AS List FROM mes.SubstituteGroupOption o
               JOIN mes.SubstituteGroupMember mb ON mb.SubstituteGroupOptionId = o.Id AND mb.IsDeleted = 0
               JOIN mes.Product p ON p.Id = mb.ProductId
               WHERE o.SubstituteGroupId = g.Id AND o.IsDeleted = 0
                 AND NOT EXISTS (SELECT 1 FROM mes.ProductionItem pi WHERE pi.ProductId = mb.ProductId AND pi.IsDeleted = 0)) f
  WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0;

  /* ---------------- کنترل‌های ECO باز ---------------- */
  INSERT #c SELECT 'ECO', e.Id, NULL, NULL, 'E01', CASE WHEN e.EffectiveDate IS NOT NULL AND e.InventoryPolicyCode IS NOT NULL THEN 1 ELSE 0 END, 2, 'FRM-PE-09',
         CASE WHEN e.EffectiveDate IS NULL AND e.InventoryPolicyCode IS NULL THEN N'تاریخ اثر و سیاست موجودی تعیین نشده'
              WHEN e.EffectiveDate IS NULL THEN N'تاریخ اثر تعیین نشده' WHEN e.InventoryPolicyCode IS NULL THEN N'سیاست موجودی موجود تعیین نشده' END
  FROM mes.EngineeringChangeOrder e WHERE e.CompanyId = @CompanyId AND e.IsDeleted = 0 AND e.StatusCode BETWEEN 1 AND 4;

  INSERT #c SELECT 'ECO', e.Id, NULL, NULL, 'E02', CASE WHEN a.Waiting IS NULL OR DATEDIFF(DAY, a.Since, @now) <= 7 THEN 1 ELSE 0 END, 1, 'FRM-PE-09',
         CASE WHEN a.Waiting IS NOT NULL THEN N'منتظر امضای ' + a.Waiting + N' از ' + CAST(DATEDIFF(DAY, a.Since, @now) AS NVARCHAR(5)) + N' روز پیش' END
  FROM mes.EngineeringChangeOrder e
  OUTER APPLY (SELECT TOP (1) x.RoleTitle AS Waiting,
                      ISNULL((SELECT MAX(y.SignedOn) FROM mes.EngineeringChangeOrderApproval y WHERE y.EngineeringChangeOrderId = e.Id AND y.IsDeleted = 0 AND y.Sequence < x.Sequence),
                             e.RequestDate) AS Since
               FROM mes.EngineeringChangeOrderApproval x WHERE x.EngineeringChangeOrderId = e.Id AND x.IsDeleted = 0 AND x.DecisionCode IS NULL ORDER BY x.Sequence) a
  WHERE e.CompanyId = @CompanyId AND e.IsDeleted = 0 AND e.StatusCode = 3;

  SELECT c.EntityType, CAST(c.EntityId AS INT) AS EntityId,
         COALESCE(s.Number, p.Number, g.Number, e.Number) AS EntityCode, COALESCE(s.Name, p.Name, g.Name, e.Title) AS EntityTitle,
         CAST(c.StructureId AS INT) AS StructureId, CAST(c.ProductId AS INT) AS ProductId, c.CheckCode, c.Passed, c.Severity, c.FormCode, c.Detail
  FROM #c c
  LEFT JOIN mes.ProductStructure s ON c.EntityType = 'STRUCT' AND s.Id = c.EntityId
  LEFT JOIN mes.Product p ON c.EntityType = 'PRODUCT' AND p.Id = c.EntityId
  LEFT JOIN mes.SubstituteGroup g ON c.EntityType = 'SUBGRP' AND g.Id = c.EntityId
  LEFT JOIN mes.EngineeringChangeOrder e ON c.EntityType = 'ECO' AND e.Id = c.EntityId
  ORDER BY c.Passed, c.Severity DESC, c.CheckCode, 3;
END
GO

/* اجرا در برابر استاندارد: (۱) مصرف به‌ازای ردیف ساختار (۲) بازده خروجی‌ها */
CREATE OR ALTER PROCEDURE mes.GetBiPeExecution
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* استاندارد برای مقدار تولیدشده = مقدار استاندارد ردیف دستور × (تکمیل + ضایعات) ÷ مقدار عملیات — همان قاعده‌ی mes.GetConsumptionVariance */
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WorkOrderStatusCode, w.WOTypeCode, CAST(w.ProductStructureId AS INT) AS StructureId,
         CAST(m.ProductStructureItemId AS INT) AS ItemId, CAST(m.ProductId AS INT) AS ProductId, o.Sequence AS OperationSequence,
         CAST(m.StandardQuantity AS DECIMAL(32,6)) AS StandardQuantity, o.ToCompleteQuantity, o.CompletedQuantity + o.WastedQuantity AS ProducedAtOperation,
         CAST(m.StandardQuantity * (o.CompletedQuantity + o.WastedQuantity) / NULLIF(o.ToCompleteQuantity, 0) AS DECIMAL(32,6)) AS StandardForProduced,
         c.Actual, c.Entries, c.AvgPotency, c.LastAt, CAST(m.SubstitutedProductId AS INT) AS SubstitutedProductId, m.IsRecoveredMaterial,
         ISNULL(si.IsActiveIngredient, 0) AS IsActiveIngredient
  FROM mes.WorkOrderOperationMaterial m
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId AND o.IsDeleted = 0
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId AND w.IsDeleted = 0
  LEFT JOIN mes.ProductStructureItem si ON si.Id = m.ProductStructureItemId
  OUTER APPLY (SELECT SUM(CASE WHEN x.IsReversal = 1 THEN -x.ConsumedQuantity ELSE x.ConsumedQuantity END) AS Actual, COUNT(*) AS Entries,
                      AVG(x.PotencyPercent) AS AvgPotency, MAX(x.EndTime) AS LastAt
               FROM mes.WorkOrderOperationMaterialConsumed x WHERE x.WOOperationMaterialId = m.Id AND x.IsDeleted = 0) c
  WHERE m.CompanyId = @CompanyId AND m.IsDeleted = 0 AND w.WorkOrderStatusCode IN (3, 4, 5) AND ISNULL(m.StandardQuantity, 0) > 0
    AND o.CompletedQuantity + o.WastedQuantity > 0 AND m.ProductStructureItemId IS NOT NULL
  ORDER BY w.Number, o.Sequence;

  /* بازده واقعی = بازده استاندارد × تولید واقعی آن خروجی ÷ (مقدار برنامه‌ی همان خروجی در دستور × نسبت مصرف واقعی ماده‌ی اصلی به استاندارد).
     برنامه‌ی دستور خودش با بازده استاندارد ساخته شده، پس این نسبت مستقل از واحد خروجی (قرص/kg) است. */
  ;WITH mainRatio AS (
    SELECT o.WorkOrderId, SUM(c.Act) / NULLIF(SUM(m.StandardQuantity), 0) AS Ratio
    FROM mes.WorkOrderOperationMaterial m
    JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId AND o.IsDeleted = 0
    JOIN mes.ProductStructureItem si ON si.Id = m.ProductStructureItemId AND si.IsMainMaterial = 1
    CROSS APPLY (SELECT ISNULL(SUM(CASE WHEN x.IsReversal = 1 THEN -x.ConsumedQuantity ELSE x.ConsumedQuantity END), 0) AS Act
                 FROM mes.WorkOrderOperationMaterialConsumed x WHERE x.WOOperationMaterialId = m.Id AND x.IsDeleted = 0) c
    WHERE m.CompanyId = @CompanyId AND m.IsDeleted = 0
    GROUP BY o.WorkOrderId
  ), outq AS (
    SELECT o.WorkOrderId, r.FinalProductId, SUM(r.CompletedQuantity) AS Produced, SUM(r.ReceivedToInvQuantity) AS Received
    FROM mes.WorkOrderOperationOutputProduct r
    JOIN mes.WorkOrderOperationOutput x ON x.Id = r.OperationOutputId
    JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
    WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
    GROUP BY o.WorkOrderId, r.FinalProductId
  )
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WorkOrderStatusCode, CAST(w.ProductStructureId AS INT) AS StructureId,
         CAST(om.ProductId AS INT) AS ProductId, om.MasterProductTypeCode AS TypeCode, om.YieldPercent AS StandardYield, om.MinYieldPercent, om.MaxYieldPercent,
         w.Quantity AS OrderQuantity, pl.Planned AS PlannedQuantity, CAST(mr.Ratio AS DECIMAL(18,6)) AS MainMaterialRatio,
         ISNULL(q.Produced, 0) AS Produced, ISNULL(q.Received, 0) AS Received,
         CAST(om.YieldPercent * ISNULL(q.Produced, 0) / NULLIF(pl.Planned * ISNULL(mr.Ratio, 1), 0) AS DECIMAL(9,3)) AS ActualYield
  FROM mes.WorkOrder w
  JOIN mes.ProductStructureMaster om ON om.ProductStructureId = w.ProductStructureId AND om.IsDeleted = 0 AND om.YieldPercent IS NOT NULL
  OUTER APPLY (SELECT SUM(wp.Quantity) AS Planned FROM mes.WorkOrderProduct wp WHERE wp.WorkOrderId = w.Id AND wp.ProductId = om.ProductId AND wp.IsDeleted = 0) pl
  LEFT JOIN mainRatio mr ON mr.WorkOrderId = w.Id
  LEFT JOIN outq q ON q.WorkOrderId = w.Id AND q.FinalProductId = om.ProductId
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND w.WorkOrderStatusCode IN (4, 5)
  ORDER BY w.Number, om.MasterProductTypeCode;
END
GO

/* نیاز باز: (۱) مواد باقی‌مانده‌ی دستورهای باز (۲) درخواست‌های تولید باز */
CREATE OR ALTER PROCEDURE mes.GetBiPeDemand
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WorkOrderStatusCode, w.WOTypeCode, w.DueDate, w.PlannedReleaseDate,
         CAST(w.MainProductId AS INT) AS MainProductId, CAST(w.ProductStructureId AS INT) AS StructureId, o.Sequence AS OperationSequence,
         CAST(m.ProductId AS INT) AS ProductId, CAST(m.ProductStructureItemId AS INT) AS ItemId, CAST(si.SubstituteGroupId AS INT) AS SubstituteGroupId,
         CAST(m.SubstitutedProductId AS INT) AS SubstitutedProductId, m.IsCustomerMaterial,
         CAST(m.StandardQuantity AS DECIMAL(32,6)) AS StandardQuantity, ISNULL(c.Act, 0) AS Consumed,
         CAST(CASE WHEN m.StandardQuantity - ISNULL(c.Act, 0) > 0 THEN m.StandardQuantity - ISNULL(c.Act, 0) ELSE 0 END AS DECIMAL(32,6)) AS Remaining
  FROM mes.WorkOrderOperationMaterial m
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId AND o.IsDeleted = 0
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId AND w.IsDeleted = 0
  LEFT JOIN mes.ProductStructureItem si ON si.Id = m.ProductStructureItemId
  OUTER APPLY (SELECT SUM(CASE WHEN x.IsReversal = 1 THEN -x.ConsumedQuantity ELSE x.ConsumedQuantity END) AS Act
               FROM mes.WorkOrderOperationMaterialConsumed x WHERE x.WOOperationMaterialId = m.Id AND x.IsDeleted = 0) c
  WHERE m.CompanyId = @CompanyId AND m.IsDeleted = 0 AND w.WorkOrderStatusCode IN (1, 2, 3, 7) AND m.StandardQuantity - ISNULL(c.Act, 0) > 0
  ORDER BY w.DueDate, w.Number, o.Sequence;

  SELECT CAST(r.Id AS INT) AS RequestId, r.Number, r.StatusCode, r.PriorityCode, CAST(r.ProductId AS INT) AS ProductId, r.Quantity, r.NeedDate, r.CustomerTitle,
         (SELECT COUNT(*) FROM mes.ProductionRequestWorkOrder l WHERE l.ProductionRequestId = r.Id AND l.IsDeleted = 0) AS LinkedOrders
  FROM mes.ProductionRequest r
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0 AND r.StatusCode IN (1, 2, 3, 4)
  ORDER BY r.NeedDate;
END
GO

/* ECO: (۱) دامنه‌ی همه‌ی ECOها (۲) امضاهای همه‌ی ECOها */
CREATE OR ALTER PROCEDURE mes.GetBiPeEcoDetail
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(i.EngineeringChangeOrderId AS INT) AS EcoId, CAST(i.Id AS INT) AS EcoItemId, i.EntityTypeCode, i.ChangeTypeCode,
         CAST(i.ProductStructureId AS INT) AS StructureId, CAST(i.ProductId AS INT) AS ProductId, CAST(i.SubstituteGroupId AS INT) AS SubstituteGroupId,
         i.BeforeText, i.AfterText, i.Description
  FROM mes.EngineeringChangeOrderItem i JOIN mes.EngineeringChangeOrder e ON e.Id = i.EngineeringChangeOrderId AND e.IsDeleted = 0
  WHERE e.CompanyId = @CompanyId AND i.IsDeleted = 0
  ORDER BY i.EngineeringChangeOrderId, i.Id;

  SELECT CAST(a.EngineeringChangeOrderId AS INT) AS EcoId, a.Sequence, a.RoleTitle, a.ApproverTitle, a.DecisionCode, a.SignedOn
  FROM mes.EngineeringChangeOrderApproval a JOIN mes.EngineeringChangeOrder e ON e.Id = a.EngineeringChangeOrderId AND e.IsDeleted = 0
  WHERE e.CompanyId = @CompanyId AND a.IsDeleted = 0
  ORDER BY a.EngineeringChangeOrderId, a.Sequence;
END
GO

/* گروه‌های جایگزین به شکل تخت: گروه × گزینه × عضو */
CREATE OR ALTER PROCEDURE mes.GetBiPeSubstitutes
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(g.Id AS INT) AS GroupId, g.Number AS GroupCode, g.Name AS GroupTitle, g.IsCombinable, g.IsActive,
         o.OptionNo, o.Name AS OptionTitle, o.Priority, CAST(mb.ProductId AS INT) AS ProductId, CAST(mb.Quantity AS DECIMAL(18,6)) AS Ratio
  FROM mes.SubstituteGroup g
  JOIN mes.SubstituteGroupOption o ON o.SubstituteGroupId = g.Id AND o.IsDeleted = 0
  JOIN mes.SubstituteGroupMember mb ON mb.SubstituteGroupOptionId = o.Id AND mb.IsDeleted = 0
  WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0
  ORDER BY g.Number, o.OptionNo, mb.Id;
END
GO

/* ثبت فرم و منو در ALM */
IF NOT EXISTS (SELECT 1 FROM alm.Form WHERE Code = 'FRM-PE-10')
  INSERT alm.Form (Code, Title, SubSystemCode, AnalysisDocumentCode, FormTypeCode, PrimaryAccessGroupCode, OtherAccessGroupsText, TabsDescription, TabCount, ActionCount,
                   FeatureCount, EstimateFromFeatures, OverheadEstimate, TotalEstimate, DesignOwner, SortOrder, Note, CreatorCode, CreationDate, Guid, PhaseCode)
  SELECT 'FRM-PE-10', N'رصدخانه‌ی مهندسی محصول (BI)', SubSystemCode, AnalysisDocumentCode, FormTypeCode, PrimaryAccessGroupCode,
         N'مدیر مهندسی محصول، مهندس فرمولاسیون، تضمین کیفیت، برنامه‌ریزی تولید، تأمین',
         N'صورت‌فلکی محصولات · پرتونگاری ساختار · اگر این ماده نرسد · دقت ساختار در اجرا · رادار تغییر · بدهی فنی داده', 6, 0, 0, 0, 0, 0, DesignOwner, 255,
         N'BI رصدخانه‌ی مهندسی محصول برای جلسه‌ی بازبینی مهندسی؛ به درخواست کاربر (۱۸ مهر ۱۴۰۵). فقط‌خواندنی؛ روی داده‌ی PE-01 تا PE-09 و اجرای PC.',
         CreatorCode, GETDATE(), NEWID(), PhaseCode
  FROM alm.Form WHERE Code = 'FRM-PE-09';

IF NOT EXISTS (SELECT 1 FROM alm.Menu WHERE Code = '43010')
  INSERT alm.Menu (Code, Title, ParentCode, SubSystemCode, MenuLevel, AnalysisDocumentCode, FormTypeCode, FormCode, SortOrder, Note, CreatorCode, CreationDate, Guid, PhaseCode)
  SELECT '43010', N'رصدخانه‌ی مهندسی محصول (BI)', ParentCode, SubSystemCode, MenuLevel, AnalysisDocumentCode, FormTypeCode, 'FRM-PE-10', 255,
         N'BI رصدخانه‌ی مهندسی محصول', CreatorCode, GETDATE(), NEWID(), PhaseCode
  FROM alm.Menu WHERE Code = '43009';
GO
