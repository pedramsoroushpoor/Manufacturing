/* =====================================================================
   اسکیمای mes — گام ۲۱: FRM-ME-04 «اقلام و خروجی در سطح عملیات»

   پیش‌نیاز: mes_frm_me02 (روش و خروجی عملیات)، ساختار محصول (گام‌های ۱۰ و ۱۳)، ویژگی تولیدی (گام ۹).

   نسخه‌ی قبل مواد عملیات را در mfr.RoutingOperationMaterial نگه می‌داشت؛ با همان نام و فیلدها آمده است:
     mes.RoutingOperationMaterial        همان + ProductStructureItemId (ردیف ساختار، برای کنترل پوشش F-ME-029)،
                                         ConsumptionPointCode (نقطه‌ی مصرف، F-ME-030)، AllocationPercent (سهم ردیف در این عملیات).
                                         MeasureUnitId این‌جا NULL پذیر است (واحد از کالا).
     mes.RoutingOperationOutput          (گام ME-02) — خروجی‌های همزاد، جانبی، ضایعات و نیمه‌ساخته‌ی بین‌مرحله‌ای (F-ME-031، 034)
     mes.RoutingOperation                + IntermediateStorageCode، LineSideInventoryId (ذخیره‌سازی بین‌مرحله‌ای، F-ME-035)
     mes.RoutingMaster                   + ProcessWastePercent، WastePriorityCode (ضایعات فرایند و ارجحیت، F-ME-032)
     mes.RoutingOperationBatchAttribute  جدید — ویژگی‌های بچ که در هر عملیات تعیین یا به‌روز می‌شوند (F-ME-039)
   ضایعات عملیات = ۱۰۰ − YieldPercent عملیات (فیلد قدیم). بازده انباشته (F-ME-033) از گراف روش حساب می‌شود.

   فرض‌ها و کدهای موقت:
     ConsumptionPointCode    1 = ابتدای عملیات، 2 = حین عملیات، 3 = پایان عملیات
     ReceptionRequestTypeCode 1 = درخواست از انبار، 2 = انبار پای کار — معنای این فیلد در نسخه‌ی قبل منتظر تأیید
     IntermediateStorageCode 1 = مستقیم به عملیات بعد، 2 = انبار میانی، 3 = انبار پای کار
     WastePriorityCode       1 = ضایعات ردیف ساختار، 2 = ضایعات عملیات، 3 = ضایعات فرایند
     ActionCode (ویژگی بچ)   1 = تعیین، 2 = به‌روزرسانی، 3 = تأیید (دروازه‌ی QC)

   فاز اول: F-ME-029 تا 035، 039. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.RoutingOperationMaterial','U') IS NULL
CREATE TABLE mes.RoutingOperationMaterial (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RoutingOperationMaterial PRIMARY KEY,
  RoutingProductStructureAssignmentId BIGINT NULL,
  RoutingOperationId BIGINT NOT NULL,
  ReceptionRequestTypeCode INT NOT NULL CONSTRAINT DF_mes_ROM_Reception DEFAULT (1),
  ProductId BIGINT NOT NULL,
  IsBackflushed BIT NOT NULL CONSTRAINT DF_mes_ROM_Backflushed DEFAULT (0),
  StandardDuration INT NULL,
  Quantity DECIMAL(32,6) NOT NULL,
  MeasureUnitId BIGINT NULL,
  IncreaseDiscPercent DECIMAL(9,4) NULL,
  DecreaseDiscPercent DECIMAL(9,4) NULL,
  IsQuantumSatis BIT NULL,
  Shrinkage DECIMAL(9,4) NULL,
  IsDeletable BIT NOT NULL CONSTRAINT DF_mes_ROM_Deletable DEFAULT (1),
  IsMandatory BIT NULL,
  Description NVARCHAR(400) NULL,
  ProductStructureItemId BIGINT NULL,
  ConsumptionPointCode INT NOT NULL CONSTRAINT DF_mes_ROM_Point DEFAULT (1)
    CONSTRAINT CK_mes_ROM_Point CHECK (ConsumptionPointCode IN (1, 2, 3)),
  AllocationPercent DECIMAL(9,4) NOT NULL CONSTRAINT DF_mes_ROM_Alloc DEFAULT (100)
);

IF OBJECT_ID('mes.RoutingOperationBatchAttribute','U') IS NULL
CREATE TABLE mes.RoutingOperationBatchAttribute (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RoutingOperationBatchAttribute PRIMARY KEY,
  RoutingOperationId BIGINT NOT NULL,
  ProductionAttributeId BIGINT NOT NULL,
  ActionCode INT NOT NULL CONSTRAINT CK_mes_ROBA_Action CHECK (ActionCode IN (1, 2, 3)),
  IsQcGate BIT NOT NULL CONSTRAINT DF_mes_ROBA_Gate DEFAULT (0),
  Description NVARCHAR(400) NULL
);

IF COL_LENGTH('mes.RoutingOperation', 'IntermediateStorageCode') IS NULL
  ALTER TABLE mes.RoutingOperation ADD IntermediateStorageCode INT NULL, LineSideInventoryId BIGINT NULL;

IF COL_LENGTH('mes.RoutingMaster', 'ProcessWastePercent') IS NULL
  ALTER TABLE mes.RoutingMaster ADD ProcessWastePercent DECIMAL(9,4) NULL, WastePriorityCode INT NULL;
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

/* هر ردیف مؤثر ساختارهای اختصاص‌یافته (نسخه‌ی جاری، با ارث از الگو) با تخصیص‌هایش؛ ردیف بدون تخصیص هم می‌آید. */
CREATE OR ALTER PROCEDURE mes.GetRoutingMaterials
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(a.RoutingId AS INT) AS RoutingId, CAST(a.ProductStructureId AS INT) AS StructureId, s.Number AS StructureCode,
         CAST(x.ItemId AS INT) AS StructureItemId, x.Sequence AS ItemSequence, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle,
         p.MeasureUnitTitle AS UnitTitle, x.Quantity AS StructureQuantity, x.QuantityTypeCode, x.IsActiveIngredient, x.ToleranceForNormalWaste AS RowWastePercent,
         x.IsWastePriorityOverOperation, CAST(m.RoutingOperationId AS INT) AS RoutingOperationId, o.Sequence AS OperationSequence, op.Name AS OperationTitle,
         m.ConsumptionPointCode, m.AllocationPercent, m.IsBackflushed, m.Quantity AS AllocatedQuantity, m.Description
  FROM mes.RoutingProductStructureAssignment a
  JOIN mes.ProductStructure s ON s.Id = a.ProductStructureId
  CROSS APPLY mes.fnStructureItems(a.ProductStructureId, NULL) x
  JOIN mes.Product p ON p.Id = x.ProductId
  LEFT JOIN mes.RoutingOperationMaterial m ON m.ProductStructureItemId = x.ItemId AND m.RoutingProductStructureAssignmentId = a.Id AND m.IsDeleted = 0
  LEFT JOIN mes.RoutingOperation o ON o.Id = m.RoutingOperationId
  LEFT JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0 AND x.Source <> 'removed'
  ORDER BY a.RoutingId, s.Number, x.Sequence, o.Sequence;
END
GO

/* خروجی‌های ساختار (ProductStructureMaster) در برابر خروجی‌های تخصیص‌یافته به عملیات */
CREATE OR ALTER PROCEDURE mes.GetRoutingOutputCoverage
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(a.RoutingId AS INT) AS RoutingId, s.Number AS StructureCode, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle,
         sm.MasterProductTypeCode, sm.Quantity, p.MeasureUnitTitle AS UnitTitle,
         (SELECT STRING_AGG(CAST(o.Sequence AS NVARCHAR(16)), N'، ') FROM mes.RoutingOperationOutput x JOIN mes.RoutingOperation o ON o.Id = x.RoutingOperationId
           WHERE o.RoutingId = a.RoutingId AND x.OuputProductId = sm.ProductId AND x.IsDeleted = 0) AS OperationSequences
  FROM mes.RoutingProductStructureAssignment a
  JOIN mes.ProductStructure s ON s.Id = a.ProductStructureId
  JOIN mes.ProductStructureMaster sm ON sm.ProductStructureId = s.Id AND sm.IsDeleted = 0
  JOIN mes.Product p ON p.Id = sm.ProductId
  WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0
  ORDER BY a.RoutingId, s.Number, sm.SortOrder;
END
GO

CREATE OR ALTER PROCEDURE mes.GetRoutingStages
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.RoutingId AS INT) AS RoutingId, CAST(o.Id AS INT) AS RoutingOperationId, o.Sequence, op.Number AS OperationCode, op.Name AS OperationTitle,
         o.YieldPercent, o.AllocationPercent, o.IntermediateStorageCode, ls.Number + N' — ' + ls.Name AS LineSideTitle,
         r.ProcessWastePercent, r.WastePriorityCode
  FROM mes.RoutingOperation o
  JOIN mes.RoutingMaster r ON r.Id = o.RoutingId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.LineSideInventory ls ON ls.Id = o.LineSideInventoryId
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0
  ORDER BY o.RoutingId, o.Sequence;
END
GO

CREATE OR ALTER PROCEDURE mes.GetRoutingBatchAttributes
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.RoutingId AS INT) AS RoutingId, CAST(b.RoutingOperationId AS INT) AS RoutingOperationId, o.Sequence, op.Name AS OperationTitle,
         CAST(pa.Id AS INT) AS AttributeId, pa.Number AS AttributeCode, pa.Name AS AttributeTitle, pa.UnitTitle, b.ActionCode, b.IsQcGate, b.Description
  FROM mes.RoutingOperationBatchAttribute b
  JOIN mes.RoutingOperation o ON o.Id = b.RoutingOperationId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN mes.ProductionAttribute pa ON pa.Id = b.ProductionAttributeId
  WHERE b.CompanyId = @CompanyId AND b.IsDeleted = 0
  ORDER BY o.RoutingId, o.Sequence;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.RoutingOperationMaterial خالی است.
   عمداً خراب: در RT-1001 v2 بروشور به هیچ عملیاتی تخصیص نیافته و فویل ۱۲۰٪ تخصیص یافته؛ در RT-2001 خروجی «تلفات
   فرایند» به عملیاتی وصل نیست؛ بازرسی RT-1001 v2 ویژگی LOD را تأیید می‌کند که در این روش تعیین نمی‌شود.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.RoutingOperationMaterial)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  UPDATE r SET r.ProcessWastePercent = v.Pw, r.WastePriorityCode = v.Pri
  FROM mes.RoutingMaster r
  JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  JOIN (VALUES (N'RT-1001', N'v2', 1.5, 2), (N'RT-1001', N'v1', 2.0, 1), (N'RT-1002', N'v1', 1.0, 2), (N'RT-2001', N'v1', 2.0, 1), (N'RT-TOLL-01', N'v1', 1.5, 1)) v(Rt, Ver, Pw, Pri)
    ON v.Rt = r.Number AND v.Ver = rv.Number
  WHERE r.CompanyId = @C;

  /* تخصیص ردیف‌های ساختار: (روش، نسخه، ساختار، ردیف ساختار، ردیف عملیات، نقطه‌ی مصرف، سهم٪، Backflush) */
  INSERT mes.RoutingOperationMaterial (CompanyId, RoutingProductStructureAssignmentId, RoutingOperationId, ProductId, IsBackflushed, Quantity,
                                       ProductStructureItemId, ConsumptionPointCode, AllocationPercent, Description)
  SELECT @C, a.Id, o.Id, x.ProductId, v.Bf, ISNULL(x.Quantity, 0) * v.Pct / 100, x.ItemId, v.Pt, v.Pct, v.Description
  FROM (VALUES
    (N'RT-1001', N'v2', N'BOM-1001-A', 10, 40, 1,  70.0, 0, N'سهم پرس‌های خط ۲'),
    (N'RT-1001', N'v2', N'BOM-1001-A', 10, 45, 1,  30.0, 0, N'سهم پرس خط ۱'),
    (N'RT-1001', N'v2', N'BOM-1001-A', 20, 15, 1, 100.0, 0, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-A', 30, 15, 3, 100.0, 0, N'روان‌کننده در دقیقه‌های پایانی مخلوط'),
    (N'RT-1001', N'v2', N'BOM-1001-A', 50, 60, 2, 100.0, 1, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-A', 50, 70, 2,  20.0, 1, N'خطا: تخصیص اضافه'),
    (N'RT-1001', N'v2', N'BOM-1001-A', 60, 60, 2, 100.0, 1, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-A', 70, 60, 3, 100.0, 1, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-B', 10, 40, 1,  70.0, 0, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-B', 10, 45, 1,  30.0, 0, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-B', 20, 15, 1, 100.0, 0, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-B', 30, 15, 3, 100.0, 0, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-B', 50, 60, 2, 100.0, 1, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-B', 60, 60, 2, 100.0, 1, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-B', 70, 60, 3, 100.0, 1, NULL),
    (N'RT-1001', N'v2', N'BOM-1001-B', 80, 60, 3, 100.0, 1, NULL),
    (N'RT-1002', N'v1', N'BOM-1002',   10, 10, 1, 100.0, 0, N'ارسال به پیمانکار روکش'),
    (N'RT-1002', N'v1', N'BOM-1002',   20, 10, 1, 100.0, 0, N'ارسال به پیمانکار روکش'),
    (N'RT-1002', N'v1', N'BOM-1002',   50, 30, 2, 100.0, 1, N'از الگو'),
    (N'RT-1002', N'v1', N'BOM-1002',   60, 30, 2, 100.0, 1, N'از الگو'),
    (N'RT-1002', N'v1', N'BOM-1002',   70, 30, 3, 100.0, 1, N'از الگو'),
    (N'RT-TOLL-01', N'v1', N'BOM-1001-A', 10, 40, 1, 100.0, 0, NULL),
    (N'RT-TOLL-01', N'v1', N'BOM-1001-A', 20, 40, 1, 100.0, 0, NULL),
    (N'RT-TOLL-01', N'v1', N'BOM-1001-A', 30, 40, 1, 100.0, 0, NULL),
    (N'RT-TOLL-01', N'v1', N'BOM-1001-A', 50, 50, 2, 100.0, 1, NULL),
    (N'RT-TOLL-01', N'v1', N'BOM-1001-A', 60, 50, 2, 100.0, 1, NULL),
    (N'RT-TOLL-01', N'v1', N'BOM-1001-A', 70, 50, 3, 100.0, 1, NULL),
    (N'RT-TOLL-01', N'v1', N'BOM-1001-A', 80, 50, 3, 100.0, 1, N'بروشور مشتری'),
    (N'RT-2001', N'v1', N'BOM-2001',   10, 10, 1, 100.0, 0, NULL),
    (N'RT-2001', N'v1', N'BOM-2001',   20, 10, 1, 100.0, 0, NULL),
    (N'RT-2001', N'v1', N'BOM-2001',   30, 10, 1, 100.0, 0, NULL),
    (N'RT-2001', N'v1', N'BOM-2001',   40, 10, 2, 100.0, 0, N'در محلول چسب'),
    (N'RT-2001', N'v1', N'BOM-2001',   50, 10, 2, 100.0, 0, N'q.s.'),
    (N'RT-2001', N'v1', N'BOM-2001',   60, 10, 2, 100.0, 0, N'حلال محلول چسب'),
    (N'RT-2003', N'v1', N'BOM-2003',   10, 10, 1, 100.0, 0, NULL),
    (N'RT-2003', N'v1', N'BOM-2003',   20, 10, 1, 100.0, 0, NULL)
  ) v(Rt, Ver, Bom, ItemSeq, OpSeq, Pt, Pct, Bf, Description)
  JOIN mes.ProductionRevision rv ON rv.Number = v.Ver
  JOIN mes.RoutingMaster r ON r.Number = v.Rt AND r.VersionId = rv.Id AND r.CompanyId = @C
  JOIN mes.ProductStructure s ON s.Number = v.Bom AND s.CompanyId = @C
  JOIN mes.RoutingProductStructureAssignment a ON a.RoutingId = r.Id AND a.ProductStructureId = s.Id
  JOIN mes.RoutingOperation o ON o.RoutingId = r.Id AND o.Sequence = v.OpSeq
  CROSS APPLY (SELECT TOP (1) f.ItemId, f.ProductId, f.Quantity FROM mes.fnStructureItems(s.Id, NULL) f WHERE f.Sequence = v.ItemSeq AND f.Source <> 'removed') x;

  /* خروجی‌های غیراصلی عملیات */
  INSERT mes.RoutingOperationOutput (CompanyId, RoutingProductStructureAssignmentId, FromOperationSequence, ToOperationSequence, OuputProductId, ReceiveOutputTypeCode,
                                     IsMainOutputProduct, IsDeliverableProduct, Quantity, RoutingOperationId, Description)
  SELECT @C, (SELECT TOP (1) a.Id FROM mes.RoutingProductStructureAssignment a WHERE a.RoutingId = r.Id ORDER BY a.Id), v.Seq, v.Seq, v.ProductId, v.TypeCode, 0, v.Stored, v.Qty, o.Id, v.Description
  FROM (VALUES
    (N'RT-1001', N'v2', 40, 2007, 4, 0, 1.0,   N'قرص شکسته‌ی پرس، به آسیاب مجدد'),
    (N'RT-1001', N'v2', 45, 2007, 4, 0, 0.44,  NULL),
    (N'RT-1002', N'v1', 10, 1002, 6, 1, 500000.0, N'قرص روکش‌دار فله، برگشتی از پیمانکار'),
    (N'RT-2001', N'v1', 20, 2006, 2, 1, 1.8,   N'گرانول درشت پس از الک'),
    (N'RT-2001', N'v1', 20, 2005, 3, 1, 2.4,   N'ریزدانه'),
    (N'RT-2001', N'v1', 20, 5002, 4, 0, 0.48,  N'غبار غبارگیر')
  ) v(Rt, Ver, Seq, ProductId, TypeCode, Stored, Qty, Description)
  JOIN mes.ProductionRevision rv ON rv.Number = v.Ver
  JOIN mes.RoutingMaster r ON r.Number = v.Rt AND r.VersionId = rv.Id AND r.CompanyId = @C
  JOIN mes.RoutingOperation o ON o.RoutingId = r.Id AND o.Sequence = v.Seq;

  /* ذخیره‌سازی بین‌مرحله‌ای */
  UPDATE o SET o.IntermediateStorageCode = v.Code, o.LineSideInventoryId = ls.Id
  FROM mes.RoutingOperation o
  JOIN mes.RoutingMaster r ON r.Id = o.RoutingId
  JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  JOIN (VALUES
    (N'RT-1001', N'v2', 10, 3, N'WH-L2-01'), (N'RT-1001', N'v2', 15, 1, NULL), (N'RT-1001', N'v2', 20, 1, NULL),
    (N'RT-1001', N'v2', 30, 2, NULL), (N'RT-1001', N'v2', 40, 3, N'WH-L2-02'), (N'RT-1001', N'v2', 45, 2, NULL),
    (N'RT-1001', N'v2', 50, 1, NULL), (N'RT-1001', N'v2', 60, 3, N'WH-L2-03'),
    (N'RT-1002', N'v1', 10, 2, NULL), (N'RT-1002', N'v1', 20, 1, NULL), (N'RT-1002', N'v1', 30, 3, N'WH-L2-03'),
    (N'RT-2001', N'v1', 10, 1, NULL), (N'RT-2001', N'v1', 20, 2, NULL)
  ) v(Rt, Ver, Seq, Code, Ls) ON v.Rt = r.Number AND v.Ver = rv.Number AND v.Seq = o.Sequence
  LEFT JOIN mes.LineSideInventory ls ON ls.Number = v.Ls AND ls.CompanyId = @C
  WHERE o.CompanyId = @C;

  INSERT mes.RoutingOperationBatchAttribute (CompanyId, RoutingOperationId, ProductionAttributeId, ActionCode, IsQcGate, Description)
  SELECT @C, o.Id, pa.Id, v.Act, v.Gate, v.Description
  FROM (VALUES
    (N'RT-2001', N'v1', 20, N'LOD',  1, 0, N'رطوبت پایان خشک‌کن'),
    (N'RT-2001', N'v1', 20, N'TEMP', 1, 0, N'دمای خروجی بستر'),
    (N'RT-2001', N'v1', 20, N'HOLD', 1, 0, N'شروع بازه‌ی نگهداری گرانول'),
    (N'RT-1001', N'v2', 40, N'ASSAY', 1, 0, N'عیار نمونه‌ی حین پرس'),
    (N'RT-1001', N'v2', 50, N'ASSAY', 3, 1, N'دروازه‌ی QC پیش از بسته‌بندی'),
    (N'RT-1001', N'v2', 50, N'LOD',   3, 1, N'تأیید رطوبت — در این روش تعیین نمی‌شود'),
    (N'RT-1001', N'v2', 60, N'STOR',  1, 0, N'شرایط نگهداری روی برچسب'),
    (N'RT-1002', N'v1', 20, N'ASSAY', 3, 1, NULL)
  ) v(Rt, Ver, Seq, Attr, Act, Gate, Description)
  JOIN mes.ProductionRevision rv ON rv.Number = v.Ver
  JOIN mes.RoutingMaster r ON r.Number = v.Rt AND r.VersionId = rv.Id AND r.CompanyId = @C
  JOIN mes.RoutingOperation o ON o.RoutingId = r.Id AND o.Sequence = v.Seq
  JOIN mes.ProductionAttribute pa ON pa.Number = v.Attr AND pa.CompanyId = @C;

  COMMIT;
END
GO
