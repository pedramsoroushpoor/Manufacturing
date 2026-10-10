/* =====================================================================
   اسکیمای mes — گام ۱۶: FRM-PE-08 «نماها و محاسبات ساختار»

   پیش‌نیاز: گام‌های قبل تا mes_frm_pe06.
   یادداشت ALM: «کنسول تحلیلی مشترک — نه چند گزارش جدا».

   این گام جدول ندارد؛ همه‌چیز روی ساختارهای گام ۱۰ محاسبه می‌شود. نسخه‌ی قبل درخت بسط‌یافته را در
   mfr.ProductStructureTree ذخیره می‌کرد (کش)؛ این‌جا بسط زنده حساب می‌شود و آن جدول لازم نیست.

     mes.fnStructureItemQty       مقدار هر ردیف مؤثر (با الگو) در اندازه‌ی مرجع، با q.s. = باقی‌مانده‌ی ۱۰۰٪
     mes.ExplodeStructure         بسط آبشاری تا آخرین لایه برای مقدار دلخواه (F-PE-063)، با ضایعات ردیف و گرد کردن
                                  واحدهای شمارشی به بالا؛ هر کالایی که ساختار تولیدیِ پیش‌فرض دارد بسط داده می‌شود؛ فانتوم
                                  علامت می‌خورد (نمایش شفاف، F-PE-062)؛ حلقه با مسیر کنترل و قطع می‌شود (F-PE-066).
     mes.GetWhereUsed             کاربرد معکوس تک‌سطحی و چندسطحی، در همه‌ی نسخه‌ها و از راه الگو (F-PE-064)
     mes.FindStructureCycles      همه‌ی حلقه‌های بازگشتی بین ساختارهای پیش‌فرض (F-PE-066)

   فرض: مقدار ردیف فرمولی (QuantityTypeCode = 3) در بسط حساب نمی‌شود و «فرمولی» علامت می‌خورد.
   واحدهای شمارشی (عدد، قرص، بلیستر) به بالا گرد می‌شوند؛ بقیه تا سه رقم اعشار.
   فاز اول: F-PE-062، 063، 064، 066 (الزامی). خواص تجمعی (065) و شبیه‌سازی حذف/جایگزینی (067) «مهم»اند.
   ===================================================================== */

SET NOCOUNT ON;
GO

CREATE OR ALTER FUNCTION mes.fnStructureItemQty (@ProductStructureId BIGINT)
RETURNS TABLE
AS
RETURN
(
  WITH base AS (
    SELECT TOP 1 m.Quantity AS BaseQty FROM mes.ProductStructureMaster m
    WHERE m.ProductStructureId = @ProductStructureId AND m.IsMainProduct = 1 AND m.IsDeleted = 0
  ), it AS (
    SELECT x.*, SUM(CASE WHEN x.QuantityTypeCode = 4 AND x.IsQuantumSatis = 0 THEN x.Quantity ELSE 0 END) OVER () AS PctSum
    FROM mes.fnStructureItems(@ProductStructureId, NULL) x
    WHERE x.Source <> 'removed'
  )
  SELECT it.ProductId, it.Sequence, it.QuantityTypeCode, it.ToleranceForNormalWaste AS WastePercent, it.WasteQuantity,
         base.BaseQty,
         CAST(CASE WHEN it.IsQuantumSatis = 1 THEN base.BaseQty * (100 - it.PctSum) / 100
                   WHEN it.QuantityTypeCode = 4 THEN base.BaseQty * it.Quantity / 100
                   WHEN it.QuantityTypeCode = 3 THEN NULL
                   ELSE it.Quantity END AS DECIMAL(32,6)) AS QtyAtBase
  FROM it CROSS JOIN base
);
GO

CREATE OR ALTER PROCEDURE mes.ExplodeStructure
  @ProductStructureId BIGINT, @Quantity DECIMAL(32,6) = NULL, @ApplyWaste BIT = 1
AS
BEGIN
  SET NOCOUNT ON;
  /* بسط سطح‌به‌سطح. NodeKey مسیر شناسه‌ی کالاهاست؛ حلقه وقتی است که کالای فرزند در مسیر باشد. */
  DECLARE @Base DECIMAL(32,6) = (SELECT TOP 1 Quantity FROM mes.ProductStructureMaster
                                 WHERE ProductStructureId = @ProductStructureId AND IsMainProduct = 1 AND IsDeleted = 0);
  SET @Quantity = ISNULL(@Quantity, @Base);

  /* ساختار تولیدیِ پیش‌فرض هر کالا (نسخه‌ی جاری) */
  SELECT m.ProductId, s.Id AS StructureId, s.Number AS StructureCode, m.Quantity AS BaseQty
  INTO #def
  FROM mes.ProductStructure s
  JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0
  WHERE s.IsDeleted = 0 AND s.IsDefaultProductStructure = 1 AND s.ProductStructureTypeCode = 1;

  CREATE TABLE #n (Level INT, NodeKey VARCHAR(900), ParentKey VARCHAR(900), ProductId BIGINT, Sequence INT,
                   QuantityTypeCode INT, Required DECIMAL(32,6), ChildStructureId BIGINT, ChildStructureCode NVARCHAR(64),
                   ChildBase DECIMAL(32,6), IsCycle BIT);

  INSERT #n
  SELECT 1, CAST('/' + CAST(q.ProductId AS VARCHAR(20)) + '-' + CAST(q.Sequence AS VARCHAR(10)) AS VARCHAR(900)), CAST('' AS VARCHAR(900)),
         q.ProductId, q.Sequence, q.QuantityTypeCode,
         q.QtyAtBase * (@Quantity / NULLIF(@Base, 0)) * CASE WHEN @ApplyWaste = 1 THEN 1 + ISNULL(q.WastePercent, 0) / 100 ELSE 1 END
           + CASE WHEN @ApplyWaste = 1 THEN ISNULL(q.WasteQuantity, 0) * (@Quantity / NULLIF(@Base, 0)) ELSE 0 END,
         d.StructureId, d.StructureCode, d.BaseQty, 0
  FROM mes.fnStructureItemQty(@ProductStructureId) q
  LEFT JOIN #def d ON d.ProductId = q.ProductId AND d.StructureId <> @ProductStructureId;

  DECLARE @lvl INT = 1, @sid BIGINT, @key VARCHAR(900), @req DECIMAL(32,6), @cbase DECIMAL(32,6);
  WHILE @lvl < 20 AND EXISTS (SELECT 1 FROM #n WHERE Level = @lvl AND ChildStructureId IS NOT NULL AND IsCycle = 0)
  BEGIN
    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
      SELECT ChildStructureId, NodeKey, Required, ChildBase FROM #n WHERE Level = @lvl AND ChildStructureId IS NOT NULL AND IsCycle = 0 AND Required IS NOT NULL;
    OPEN cur; FETCH NEXT FROM cur INTO @sid, @key, @req, @cbase;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      INSERT #n
      SELECT @lvl + 1, CAST(@key + '/' + CAST(q.ProductId AS VARCHAR(20)) + '-' + CAST(q.Sequence AS VARCHAR(10)) AS VARCHAR(900)), @key,
             q.ProductId, q.Sequence, q.QuantityTypeCode,
             q.QtyAtBase * (@req / NULLIF(@cbase, 0)) * CASE WHEN @ApplyWaste = 1 THEN 1 + ISNULL(q.WastePercent, 0) / 100 ELSE 1 END
               + CASE WHEN @ApplyWaste = 1 THEN ISNULL(q.WasteQuantity, 0) * (@req / NULLIF(@cbase, 0)) ELSE 0 END,
             d.StructureId, d.StructureCode, d.BaseQty,
             CAST(CASE WHEN CHARINDEX('/' + CAST(q.ProductId AS VARCHAR(20)) + '-', @key + '/') > 0 THEN 1 ELSE 0 END AS BIT)
      FROM mes.fnStructureItemQty(@sid) q
      LEFT JOIN #def d ON d.ProductId = q.ProductId;
      FETCH NEXT FROM cur INTO @sid, @key, @req, @cbase;
    END
    CLOSE cur; DEALLOCATE cur;
    SET @lvl += 1;
  END

  SELECT n.Level, n.NodeKey, n.ParentKey, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         n.Sequence, n.QuantityTypeCode,
         CAST(CASE WHEN n.Required IS NULL THEN NULL
                   WHEN p.MeasureUnitTitle IN (N'عدد', N'قرص', N'بلیستر') THEN CEILING(n.Required)
                   ELSE ROUND(n.Required, 3) END AS DECIMAL(32,3)) AS Required,
         ISNULL(pi.IsPhantom, 0) AS IsPhantom, n.ChildStructureCode, n.IsCycle,
         CAST(CASE WHEN n.ChildStructureId IS NULL OR n.IsCycle = 1 THEN 1 ELSE 0 END AS BIT) AS IsLeaf
  FROM #n n
  JOIN mes.Product p ON p.Id = n.ProductId
  LEFT JOIN mes.ProductionItem pi ON pi.ProductId = p.Id AND pi.IsDeleted = 0
  ORDER BY n.NodeKey;
END
GO

CREATE OR ALTER PROCEDURE mes.GetWhereUsed
  @ProductId BIGINT, @MultiLevel BIT = 1
AS
BEGIN
  SET NOCOUNT ON;
  /* سطح ۱: ساختارهایی که کالا را در یکی از نسخه‌هایشان دارند (ردیف خودشان) یا در نسخه‌ی جاری از الگو به ارث می‌برند.
     سطح‌های بعد (اگر @MultiLevel): همان جست‌وجو برای محصول اصلیِ ساختارهای سطح قبل. */
  CREATE TABLE #w (Level INT, SearchedProductId BIGINT, StructureId BIGINT, Revisions NVARCHAR(400), InCurrent BIT, ViaTemplate BIT, MainProductId BIGINT);
  CREATE TABLE #seen (ProductId BIGINT PRIMARY KEY);
  INSERT #seen VALUES (@ProductId);

  DECLARE @lvl INT = 1;
  CREATE TABLE #frontier (ProductId BIGINT);
  INSERT #frontier VALUES (@ProductId);

  WHILE @lvl <= 10 AND EXISTS (SELECT 1 FROM #frontier)
  BEGIN
    INSERT #w
    SELECT @lvl, f.ProductId, s.Id,
           (SELECT STRING_AGG(r.Number, N'، ') FROM (SELECT DISTINCT i2.RevisionId FROM mes.ProductStructureItem i2
              WHERE i2.ProductStructureId = s.Id AND i2.ProductId = f.ProductId AND i2.IsDeleted = 0 AND ISNULL(i2.InheritanceActionCode, 0) <> 2) x
            JOIN mes.ProductionRevision r ON r.Id = x.RevisionId),
           CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.fnStructureItems(s.Id, NULL) c WHERE c.ProductId = f.ProductId AND c.Source <> 'removed') THEN 1 ELSE 0 END AS BIT),
           CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.fnStructureItems(s.Id, NULL) c WHERE c.ProductId = f.ProductId AND c.Source = 'inherited') THEN 1 ELSE 0 END AS BIT),
           m.ProductId
    FROM #frontier f
    JOIN mes.ProductStructure s ON s.IsDeleted = 0
    LEFT JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0
    WHERE EXISTS (SELECT 1 FROM mes.ProductStructureItem i WHERE i.ProductStructureId = s.Id AND i.ProductId = f.ProductId AND i.IsDeleted = 0
                    AND ISNULL(i.InheritanceActionCode, 0) <> 2)
       OR EXISTS (SELECT 1 FROM mes.fnStructureItems(s.Id, NULL) c WHERE c.ProductId = f.ProductId AND c.Source = 'inherited');

    IF @MultiLevel = 0 BREAK;
    DELETE #frontier;
    INSERT #frontier SELECT DISTINCT w.MainProductId FROM #w w
    WHERE w.Level = @lvl AND w.MainProductId IS NOT NULL AND w.InCurrent = 1 AND NOT EXISTS (SELECT 1 FROM #seen s WHERE s.ProductId = w.MainProductId);
    INSERT #seen SELECT ProductId FROM #frontier;
    SET @lvl += 1;
  END

  SELECT w.Level, sp.Number AS SearchedCode, sp.Name AS SearchedTitle,
         s.Number AS StructureCode, s.Name AS StructureTitle, s.ProductStructureTypeCode AS TypeCode, s.IsDefaultProductStructure AS IsDefault,
         mp.Number AS MainProductCode, mp.Name AS MainProductTitle, w.Revisions, w.InCurrent, w.ViaTemplate
  FROM #w w
  JOIN mes.ProductStructure s ON s.Id = w.StructureId
  JOIN mes.Product sp ON sp.Id = w.SearchedProductId
  LEFT JOIN mes.Product mp ON mp.Id = w.MainProductId
  ORDER BY w.Level, s.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.FindStructureCycles
AS
BEGIN
  SET NOCOUNT ON;
  /* یال‌ها: محصول اصلی ساختار پیش‌فرض ← کالای ردیف‌های مؤثرش. مسیرها تا عمق ۲۰ گسترش می‌یابند؛
     مسیری که به کالای آغازش برگردد حلقه است. */
  SELECT DISTINCT m.ProductId AS FromId, q.ProductId AS ToId
  INTO #e
  FROM mes.ProductStructure s
  JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0
  CROSS APPLY mes.fnStructureItemQty(s.Id) q
  WHERE s.IsDeleted = 0 AND s.IsDefaultProductStructure = 1 AND s.ProductStructureTypeCode = 1;

  CREATE TABLE #p (StartId BIGINT, LastId BIGINT, Path VARCHAR(900), Depth INT);
  INSERT #p SELECT FromId, ToId, CAST('/' + CAST(FromId AS VARCHAR(20)) + '/' + CAST(ToId AS VARCHAR(20)) + '/' AS VARCHAR(900)), 1 FROM #e;
  CREATE TABLE #cycles (Path VARCHAR(900));

  DECLARE @d INT = 1;
  WHILE @d < 20 AND EXISTS (SELECT 1 FROM #p WHERE Depth = @d)
  BEGIN
    INSERT #cycles SELECT Path FROM #p WHERE Depth = @d AND LastId = StartId;
    INSERT #p
    SELECT p.StartId, e.ToId, CAST(p.Path + CAST(e.ToId AS VARCHAR(20)) + '/' AS VARCHAR(900)), @d + 1
    FROM #p p JOIN #e e ON e.FromId = p.LastId
    WHERE p.Depth = @d AND p.LastId <> p.StartId
      AND (CHARINDEX('/' + CAST(e.ToId AS VARCHAR(20)) + '/', p.Path) = 0 OR e.ToId = p.StartId);
    SET @d += 1;
  END

  SELECT c.Path,
         (SELECT STRING_AGG(pr.Number, N' ← ') WITHIN GROUP (ORDER BY x.ordinal)
          FROM STRING_SPLIT(SUBSTRING(c.Path, 2, LEN(c.Path) - 2), '/', 1) x JOIN mes.Product pr ON pr.Id = TRY_CAST(x.value AS BIGINT)) AS CycleText,
         (SELECT COUNT(*) FROM #e) AS EdgeCount
  FROM #cycles c
  UNION ALL
  SELECT NULL, NULL, (SELECT COUNT(*) FROM #e) WHERE NOT EXISTS (SELECT 1 FROM #cycles);
END
GO
