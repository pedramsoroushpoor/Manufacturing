/* =====================================================================
   اسکیمای mes — گام ۱۵: FRM-PE-06 «ساختار ماتریسی و اقلام ابعادی»

   پیش‌نیاز: گام‌های قبل تا mes_frm_pe05 (بُعد و ترکیب از گام ۹، ساختار از گام ۱۰).
   یادداشت ALM: «پوشاک، کفش، فولاد، کاشی، کابل». در داروسازی: کپسول خالی (شماره × رنگ) و کارتن (اندازه × زبان).

   مدل:
     ساختار «مدل پایه» یک ساختار معمولی (mes.ProductStructure) برای کالای ابعادی است (F-PE-052).
     mes.ProductStructureItem + ProductionDimensionId — ردیف به کدام بُعد وابسته است؛ خالی = مستقل از ابعاد (F-PE-055).
     mes.ProductStructureItemDimensionValue  جدید — جدول مصرف ابعادی: مقدار هر ردیف به‌ازای هر مقدار بُعد (F-PE-053).
     ساختار هر ترکیب (mes.ProductionItemVariant از گام ۹) ذخیره نمی‌شود؛ رویه‌ی mes.GetDerivedVariantStructures
     آن را از مدل پایه مشتق می‌کند (اشتقاق خودکار، F-PE-052).
   قاعده‌ی کنترلی: برای هر مقدار مجاز بُعد در کالا (mes.ProductionItemDimensionValue) باید ردیف وابسته مقدار داشته باشد.

   فاز اول: F-PE-052، 053، 055 کامل؛ 056 فقط خروجی ماتریس (ورود از اکسل و ویرایش ماتریسی نوشتنی‌اند).
   مارکر برش (054) «مهم» است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF COL_LENGTH('mes.ProductStructureItem', 'ProductionDimensionId') IS NULL
  ALTER TABLE mes.ProductStructureItem ADD ProductionDimensionId BIGINT NULL;

IF OBJECT_ID('mes.ProductStructureItemDimensionValue','U') IS NULL
CREATE TABLE mes.ProductStructureItemDimensionValue (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductStructureItemDimensionValue PRIMARY KEY,
  ProductStructureItemId BIGINT NOT NULL,
  ProductionDimensionValueId BIGINT NOT NULL,
  Quantity DECIMAL(32,6) NOT NULL
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

CREATE OR ALTER PROCEDURE mes.GetMatrixStructures
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* ساختارهای مدل پایه: ساختاری که محصول اصلی‌اش کالای ابعادی است. */
  SELECT CAST(s.Id AS INT) AS StructureId, s.Number AS Code, s.Name AS Title,
         p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, CAST(m.Quantity AS DECIMAL(18,4)) AS BaseQuantity,
         r.Number AS RevisionCode,
         (SELECT STRING_AGG(x.Name, N' × ') FROM (SELECT DISTINCT d.Name, d.SortOrder FROM mes.ProductionItemDimensionValue iv
            JOIN mes.ProductionDimensionValue v ON v.Id = iv.ProductionDimensionValueId JOIN mes.ProductionDimension d ON d.Id = v.ProductionDimensionId
            WHERE iv.ProductionItemId = pi.Id AND iv.IsDeleted = 0) x) AS Dimensions,
         (SELECT COUNT(*) FROM mes.ProductionItemVariant v WHERE v.ProductionItemId = pi.Id AND v.IsDeleted = 0 AND v.IsActive = 1) AS VariantCount,
         (SELECT COUNT(*) FROM mes.ProductStructureItem i WHERE i.ProductStructureId = s.Id AND i.RevisionId = s.RevisionId AND i.IsDeleted = 0 AND i.ProductionDimensionId IS NOT NULL) AS DependentItems,
         (SELECT COUNT(*) FROM mes.ProductStructureItem i WHERE i.ProductStructureId = s.Id AND i.RevisionId = s.RevisionId AND i.IsDeleted = 0 AND i.ProductionDimensionId IS NULL) AS IndependentItems
  FROM mes.ProductStructure s
  JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0
  JOIN mes.Product p ON p.Id = m.ProductId
  JOIN mes.ProductionItem pi ON pi.ProductId = p.Id AND pi.IsDeleted = 0 AND pi.IsDimensional = 1
  LEFT JOIN mes.ProductionRevision r ON r.Id = s.RevisionId
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0
  ORDER BY s.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetMatrixItems
  @ProductStructureId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* ردیف‌های نسخه‌ی جاری مدل پایه. ردیف وابسته: یک ردیف به‌ازای هر مقدار مجازِ بُعدش در کالا، با مقدار (خالی = جاافتاده).
     ردیف مستقل: یک ردیف با Quantity خودِ ردیف. */
  SELECT CAST(i.Id AS INT) AS ItemId, i.Sequence, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         i.ItemRoleTitle, CAST(i.Quantity AS DECIMAL(18,4)) AS BaseRowQuantity,
         d.Number AS DimensionCode, d.Name AS DimensionTitle,
         v.Code AS ValueCode, v.Name AS ValueTitle, v.SortOrder AS ValueSort,
         CAST(dv.Quantity AS DECIMAL(18,4)) AS MatrixQuantity
  FROM mes.ProductStructure s
  JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0
  JOIN mes.ProductionItem pi ON pi.ProductId = m.ProductId AND pi.IsDeleted = 0
  JOIN mes.ProductStructureItem i ON i.ProductStructureId = s.Id AND i.RevisionId = s.RevisionId AND i.IsDeleted = 0
  JOIN mes.Product p ON p.Id = i.ProductId
  LEFT JOIN mes.ProductionDimension d ON d.Id = i.ProductionDimensionId
  LEFT JOIN mes.ProductionItemDimensionValue iv ON d.Id IS NOT NULL AND iv.ProductionItemId = pi.Id AND iv.IsDeleted = 0
       AND iv.ProductionDimensionValueId IN (SELECT x.Id FROM mes.ProductionDimensionValue x WHERE x.ProductionDimensionId = d.Id)
  LEFT JOIN mes.ProductionDimensionValue v ON v.Id = iv.ProductionDimensionValueId
  LEFT JOIN mes.ProductStructureItemDimensionValue dv ON dv.ProductStructureItemId = i.Id AND dv.ProductionDimensionValueId = v.Id AND dv.IsDeleted = 0
  WHERE s.Id = @ProductStructureId
  ORDER BY i.Sequence, v.SortOrder;
END
GO

CREATE OR ALTER PROCEDURE mes.GetDerivedVariantStructures
  @ProductStructureId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* اشتقاق ساختار هر ترکیب از مدل پایه: ردیف مستقل همان مقدار ردیف؛ ردیف وابسته مقدارِ جدول ابعادی برای مقدارِ
     همان بُعد در ترکیب. Quantity خالی = برای این ترکیب مقدار تعریف نشده. */
  SELECT CAST(vr.Id AS INT) AS VariantId, vr.VariantCode, vr.VariantTitle,
         CAST(i.Id AS INT) AS ItemId, i.Sequence, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         CAST(CASE WHEN i.ProductionDimensionId IS NULL THEN i.Quantity ELSE dv.Quantity END AS DECIMAL(18,4)) AS Quantity,
         CAST(CASE WHEN i.ProductionDimensionId IS NULL THEN 0 ELSE 1 END AS BIT) AS IsDependent
  FROM mes.ProductStructure s
  JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0
  JOIN mes.ProductionItem pi ON pi.ProductId = m.ProductId AND pi.IsDeleted = 0
  JOIN mes.ProductionItemVariant vr ON vr.ProductionItemId = pi.Id AND vr.IsDeleted = 0 AND vr.IsActive = 1
  JOIN mes.ProductStructureItem i ON i.ProductStructureId = s.Id AND i.RevisionId = s.RevisionId AND i.IsDeleted = 0
  JOIN mes.Product p ON p.Id = i.ProductId
  OUTER APPLY (
    SELECT TOP 1 vv.ProductionDimensionValueId
    FROM mes.ProductionItemVariantValue vv JOIN mes.ProductionDimensionValue x ON x.Id = vv.ProductionDimensionValueId
    WHERE vv.ProductionItemVariantId = vr.Id AND vv.IsDeleted = 0 AND x.ProductionDimensionId = i.ProductionDimensionId
  ) vval
  LEFT JOIN mes.ProductStructureItemDimensionValue dv ON dv.ProductStructureItemId = i.Id AND dv.ProductionDimensionValueId = vval.ProductionDimensionValueId AND dv.IsDeleted = 0
  WHERE s.Id = @ProductStructureId
  ORDER BY vr.VariantCode, i.Sequence;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی جدول مصرف ابعادی خالی است.
   عمداً خراب: دی‌اکسید تیتانیوم برای رنگ «آبی / سفید» کپسول مقدار ندارد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductStructureItemDimensionValue)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @V1 BIGINT = (SELECT Id FROM mes.ProductionRevision WHERE Number = N'v1');
  DECLARE @Company BIGINT = (SELECT TOP 1 Id FROM mes.OrgNode WHERE LevelCode = 'Company');

  INSERT mes.Product (CompanyId, Id, Number, Name, MeasureUnitTitle, ProductGroupTitle)
  SELECT @C, v.Id, v.Number, v.Name, v.Unit, v.GroupTitle
  FROM (VALUES (3016, N'P-3016', N'ژلاتین دارویی', N'kg', N'مواد جانبی'), (3017, N'P-3017', N'دی‌اکسید تیتانیوم', N'kg', N'رنگ‌ها'),
               (3018, N'P-3018', N'مقوای کارتن', N'm²', N'مواد بسته‌بندی'), (3019, N'P-3019', N'جوهر چاپ', N'kg', N'مواد بسته‌بندی')) v(Id, Number, Name, Unit, GroupTitle)
  WHERE NOT EXISTS (SELECT 1 FROM mes.Product p WHERE p.Id = v.Id);
  INSERT mes.ProductionItem (CompanyId, ProductId, ProductionRoleCode, TrackingLevelCode, IsTrackingMandatory)
  SELECT @C, v.Id, v.Role, 1, 1 FROM (VALUES (3016, 3), (3017, 3), (3018, 4), (3019, 4)) v(Id, Role)
  WHERE NOT EXISTS (SELECT 1 FROM mes.ProductionItem i WHERE i.ProductId = v.Id);

  INSERT mes.ProductStructure (CompanyId, Number, Name, RevisionId, ProductStructureTypeCode, ProductStructureStatusCode, IsDefaultProductStructure,
                               MinimumQuantity, MaximumQuantity, BatchMultiple, ValidFromDate, ProfileCode, Description)
  SELECT @C, v.Number, v.Name, @V1, 1, 3, 1, v.MinQ, v.MaxQ, v.Multiple, '2026-03-21', N'PHARMA', v.Description
  FROM (VALUES
    (N'BOM-4004', N'کپسول خالی ژلاتینی — مدل پایه', 500000, 3000000, 500000, N'ساختار هر شماره × رنگ از این مدل پایه مشتق می‌شود'),
    (N'BOM-4003', N'کارتن بسته‌بندی — مدل پایه',     5000,   50000,   5000,   N'ساختار هر اندازه × زبان از این مدل پایه مشتق می‌شود')
  ) v(Number, Name, MinQ, MaxQ, Multiple, Description)
  WHERE NOT EXISTS (SELECT 1 FROM mes.ProductStructure s WHERE s.Number = v.Number);

  INSERT mes.ProductStructureMaster (CompanyId, ProductStructureId, ProductId, Quantity, OutputProcessCode, CostAllocationPercentage, SortOrder)
  SELECT @C, s.Id, v.ProductId, v.Qty, 1, 100, 1
  FROM (VALUES (N'BOM-4004', 4004, 1000000), (N'BOM-4003', 4003, 10000)) v(Number, ProductId, Qty)
  JOIN mes.ProductStructure s ON s.Number = v.Number;

  INSERT mes.ProductStructureRevision (CompanyId, RevisionId, ProductId, ProductStructureId, ValidFromDate, EffectivityTypeCode, RevisionStatusCode, ApproverTitle, ApproveDate)
  SELECT @C, @V1, v.ProductId, s.Id, '2026-03-21', 1, 3, N'دکتر نوروزی — مدیر فنی', '2026-03-15'
  FROM (VALUES (N'BOM-4004', 4004), (N'BOM-4003', 4003)) v(Number, ProductId) JOIN mes.ProductStructure s ON s.Number = v.Number;

  INSERT mes.ProductStructureSite (CompanyId, ProductStructureId, OrgNodeId, ValidFromDate)
  SELECT @C, s.Id, @Company, '2026-03-21' FROM mes.ProductStructure s WHERE s.Number IN (N'BOM-4004', N'BOM-4003');

  /* ردیف‌ها: Quantity ردیف وابسته مقدار مرجع است؛ مقدار واقعی هر ترکیب از جدول ابعادی می‌آید */
  INSERT mes.ProductStructureItem (CompanyId, ProductStructureId, RevisionId, Sequence, ProductId, ItemRoleTitle, QuantityTypeCode, Quantity, ProductionDimensionId, Description)
  SELECT @C, s.Id, @V1, v.Seq, v.ProductId, v.RoleTitle, 2, v.Qty, d.Id, v.Description
  FROM (VALUES
    (N'BOM-4004', 10, 3016, N'پوسته',      76,   N'CAPSIZE', N'وابسته به شماره‌ی کپسول'),
    (N'BOM-4004', 20, 3017, N'کدرکننده',   1.5,  N'COLOR',   N'وابسته به رنگ'),
    (N'BOM-4004', 30, 3010, N'رنگدانه',    0.3,  N'COLOR',   N'وابسته به رنگ'),
    (N'BOM-4004', 40, 3007, N'حلال',       30,   NULL,       N'مستقل از ابعاد'),
    (N'BOM-4003', 10, 3018, N'مقوا',       300,  N'CTNSIZE', N'وابسته به اندازه‌ی کارتن'),
    (N'BOM-4003', 20, 3019, N'چاپ',        2,    NULL,       N'مستقل از ابعاد')
  ) v(Number, Seq, ProductId, RoleTitle, Qty, DimNo, Description)
  JOIN mes.ProductStructure s ON s.Number = v.Number
  LEFT JOIN mes.ProductionDimension d ON d.Number = v.DimNo;

  INSERT mes.ProductStructureItemDimensionValue (CompanyId, ProductStructureItemId, ProductionDimensionValueId, Quantity)
  SELECT @C, i.Id, dv.Id, v.Qty
  FROM (VALUES
    (N'BOM-4004', 3016, N'CAPSIZE', N'0', 96), (N'BOM-4004', 3016, N'CAPSIZE', N'1', 76), (N'BOM-4004', 3016, N'CAPSIZE', N'2', 61),
    (N'BOM-4004', 3017, N'COLOR', N'WH', 1.9), (N'BOM-4004', 3017, N'COLOR', N'RY', 0.9),
    (N'BOM-4004', 3010, N'COLOR', N'WH', 0), (N'BOM-4004', 3010, N'COLOR', N'RY', 0.6), (N'BOM-4004', 3010, N'COLOR', N'BW', 0),
    (N'BOM-4003', 3018, N'CTNSIZE', N'10', 210), (N'BOM-4003', 3018, N'CTNSIZE', N'30', 480)
  ) v(Number, ProductId, DimNo, ValueCode, Qty)
  JOIN mes.ProductStructure s ON s.Number = v.Number
  JOIN mes.ProductStructureItem i ON i.ProductStructureId = s.Id AND i.ProductId = v.ProductId AND i.RevisionId = s.RevisionId
  JOIN mes.ProductionDimension d ON d.Number = v.DimNo
  JOIN mes.ProductionDimensionValue dv ON dv.ProductionDimensionId = d.Id AND dv.Code = v.ValueCode;

  COMMIT;
END
GO
