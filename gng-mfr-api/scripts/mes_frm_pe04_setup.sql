/* =====================================================================
   اسکیمای mes — گام ۱۳: FRM-PE-04 «خروجی‌های ساختار و بازدهی»

   پیش‌نیاز: گام‌های قبل تا mes_frm_pe03.
   یادداشت ALM: «تعمیم قابلیت چندمحصولی موجود به همه‌ی صنایع».

   قابلیت چندمحصولی نسخه‌ی قبل در mfr.ProductStructureMaster بود (MasterProductTypeCode، IsMainProduct،
   Quantity، CostAllocationPercentage). همان جدول (mes.ProductStructureMaster، از گام ۱۰) فقط این ستون‌ها را می‌گیرد:
     OutputProcessCode        فرایند حصول هر خروجی (F-PE-036)
     ByProductValuationCode   ارزش‌گذاری محصول جانبی (F-PE-035)
     YieldPercent، MinYieldPercent، MaxYieldPercent
                              جدول بازدهی: درصد برش هر خروجی از ورودی با محدوده‌ی مجاز (F-PE-037)
     IsRecyclable             دسته‌ی ضایعات مورد انتظار: قابل بازیافت یا نه (F-PE-039)
     SortOrder
   محصول هم‌زاد و جانبی و ضایعات همه ردیف همین جدول‌اند (F-PE-034، 039)؛ CostAllocationPercentage همان سهم‌بری از هزینه.

   فرض‌ها و کدهای موقت تا تأیید/رسیدن کدلیست اصلی:
     MasterProductTypeCode   1 = محصول اصلی، 2 = هم‌زاد، 3 = جانبی، 4 = ضایعات مورد انتظار، 5 = ماده‌ی بازیابی‌شده (FRM-PE-05)
                             — معنای این فیلد در نسخه‌ی قبل منتظر تأیید
     OutputProcessCode       1 = اصلی، 2 = دوباره‌کاری، 3 = بازیافت، 4 = جداسازی
     ByProductValuationCode  1 = بازیافتی، 2 = فروشی، 3 = بی‌ارزش
     موازنه‌ی جرم: اگر ساختار جدول بازدهی دارد، جمع YieldPercent همه‌ی خروجی‌ها (با ضایعات و تلفات) باید ۱۰۰٪ باشد.
     سهم‌بری: جمع CostAllocationPercentage محصول اصلی و هم‌زادها باید ۱۰۰٪ باشد (جانبی و ضایعات سهم ندارند).

   فاز اول: F-PE-034، 035، 036، 037، 039 (الزامی). انبار پیش‌فرض رسید هر خروجی (040) طبق ALM در سطح نسخه‌ی تولید
   (FRM-ME-08) است که هنوز ساخته نشده. بازدهی وابسته به عیار خوراک (038) «مهم» است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF COL_LENGTH('mes.ProductStructureMaster', 'OutputProcessCode') IS NULL
  ALTER TABLE mes.ProductStructureMaster ADD
    OutputProcessCode INT NULL,
    ByProductValuationCode INT NULL,
    YieldPercent DECIMAL(6,2) NULL,
    MinYieldPercent DECIMAL(6,2) NULL,
    MaxYieldPercent DECIMAL(6,2) NULL,
    IsRecyclable BIT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_mes_ProductStructureMaster_SortOrder DEFAULT (0);
GO

CREATE OR ALTER PROCEDURE mes.GetStructureOutputs
  @CompanyId BIGINT, @ProductStructureId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  /* همه‌ی خروجی‌های ساختارها، با جمع بازدهی و جمع سهم‌بری هر ساختار (برای کنترل موازنه و سهم‌بری). */
  SELECT CAST(s.Id AS INT) AS StructureId, s.Number AS StructureCode, s.Name AS StructureTitle,
         CAST(m.Id AS INT) AS OutputId, m.MasterProductTypeCode AS TypeCode, m.IsMainProduct,
         CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         CAST(m.Quantity AS DECIMAL(18,4)) AS Quantity, m.CostAllocationPercentage,
         m.OutputProcessCode, m.ByProductValuationCode, m.YieldPercent, m.MinYieldPercent, m.MaxYieldPercent, m.IsRecyclable,
         m.Description,
         SUM(m.YieldPercent) OVER (PARTITION BY s.Id) AS StructureYieldTotal,
         COUNT(m.YieldPercent) OVER (PARTITION BY s.Id) AS StructureYieldRows,
         SUM(CASE WHEN m.MasterProductTypeCode IN (1, 2) THEN m.CostAllocationPercentage END) OVER (PARTITION BY s.Id) AS StructureCostShareTotal,
         SUM(CASE WHEN m.MasterProductTypeCode = 2 THEN 1 ELSE 0 END) OVER (PARTITION BY s.Id) AS StructureCoProducts
  FROM mes.ProductStructureMaster m
  JOIN mes.ProductStructure s ON s.Id = m.ProductStructureId AND s.IsDeleted = 0
  JOIN mes.Product p ON p.Id = m.ProductId
  WHERE m.IsDeleted = 0 AND s.CompanyId = @CompanyId AND (@ProductStructureId IS NULL OR s.Id = @ProductStructureId)
  ORDER BY s.Number, m.MasterProductTypeCode, m.SortOrder, p.Number;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی هیچ خروجی غیرِ اصلی ثبت نشده.
   عمداً خراب: جمع بازدهی «محلول روکش» ۹۷٪ است (۳٪ تبخیر ثبت نشده).
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductStructureMaster WHERE MasterProductTypeCode <> 1)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  INSERT mes.Product (CompanyId, Id, Number, Name, MeasureUnitTitle, ProductGroupTitle)
  SELECT @C, v.Id, v.Number, v.Name, v.Unit, v.GroupTitle
  FROM (VALUES
    (2005, N'P-2005', N'ریزدانه‌ی گرانول',          N'kg', N'نیمه‌ساخته'),
    (2006, N'P-2006', N'گرانول درشت',              N'kg', N'نیمه‌ساخته'),
    (2007, N'P-2007', N'قرص شکسته (آسیاب مجدد)',   N'kg', N'نیمه‌ساخته'),
    (5002, N'P-5002', N'گردوغبار غبارگیر',         N'kg', N'ضایعات'),
    (5003, N'P-5003', N'تلفات فرایند',             N'kg', N'ضایعات')
  ) v(Id, Number, Name, Unit, GroupTitle)
  WHERE NOT EXISTS (SELECT 1 FROM mes.Product p WHERE p.Id = v.Id);
  INSERT mes.ProductionItem (CompanyId, ProductId, ProductionRoleCode, TrackingLevelCode, IsTrackingMandatory)
  SELECT @C, v.Id, v.Role, v.Tracking, v.Tracking FROM (VALUES (2005, 5, 1), (2006, 2, 1), (2007, 5, 1), (5002, 5, 0), (5003, 5, 0)) v(Id, Role, Tracking)
  WHERE NOT EXISTS (SELECT 1 FROM mes.ProductionItem i WHERE i.ProductId = v.Id);

  /* محصول اصلی: فرایند، بازدهی و سهم‌بری */
  UPDATE m SET m.OutputProcessCode = 1, m.YieldPercent = v.Yield, m.MinYieldPercent = v.MinY, m.MaxYieldPercent = v.MaxY,
               m.CostAllocationPercentage = v.Share, m.SortOrder = 1
  FROM mes.ProductStructureMaster m
  JOIN mes.ProductStructure s ON s.Id = m.ProductStructureId
  JOIN (VALUES (N'BOM-2001', 96.0, 95.0, 97.0, 98.5), (N'BOM-1001-A', 99.2, 98.5, 99.8, 100), (N'BOM-2003', 97.0, 96.0, 98.0, 100))
       v(StructNo, Yield, MinY, MaxY, Share) ON v.StructNo = s.Number
  WHERE m.IsMainProduct = 1;
  UPDATE m SET m.OutputProcessCode = 1, m.CostAllocationPercentage = 100, m.SortOrder = 1
  FROM mes.ProductStructureMaster m WHERE m.IsMainProduct = 1 AND m.OutputProcessCode IS NULL;

  INSERT mes.ProductStructureMaster (CompanyId, ProductStructureId, ProductId, MasterProductTypeCode, IsMainProduct, Quantity,
                                     CostAllocationPercentage, OutputProcessCode, ByProductValuationCode, YieldPercent, MinYieldPercent, MaxYieldPercent,
                                     IsRecyclable, SortOrder, Description)
  SELECT @C, s.Id, v.ProductId, v.TypeCode, 0, v.Qty, v.Share, v.Process, v.Valuation, v.Yield, v.MinY, v.MaxY, v.Recyclable, v.Sort, v.Description
  FROM (VALUES
    (N'BOM-2001',   2006, 2, 1.8,  1.5,  2, NULL, 1.5, 1.0, 2.5, NULL, 2, N'ذرات درشت‌تر از الک — دوباره آسیاب و الک می‌شود'),
    (N'BOM-2001',   2005, 3, 2.4,  NULL, 4, 1,    2.0, 1.0, 3.0, NULL, 3, N'ریزتر از الک ۱۰۰ میکرون — به بچ بعد برمی‌گردد'),
    (N'BOM-2001',   5002, 4, 0.48, NULL, 4, 3,    0.4, NULL, 1.0, 1,   4, N'گردوغبار کیسه‌ی غبارگیر'),
    (N'BOM-2001',   5003, 4, 0.12, NULL, 1, 3,    0.1, NULL, 0.5, 0,   5, N'چسبندگی به دیواره و تبخیر'),
    (N'BOM-1001-A', 2007, 4, 1.44, NULL, 1, 1,    0.8, NULL, 1.5, 1,   2, N'قرص شکسته و لب‌پریده — آسیاب و برگشت به گرانول')
  ) v(StructNo, ProductId, TypeCode, Qty, Share, Process, Valuation, Yield, MinY, MaxY, Recyclable, Sort, Description)
  JOIN mes.ProductStructure s ON s.Number = v.StructNo;

  COMMIT;
END
GO
