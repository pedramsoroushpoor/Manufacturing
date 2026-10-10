/* =====================================================================
   اسکیمای mes — گام ۲۰: FRM-ME-03 «کارکرد استاندارد و زمان عملیات»

   پیش‌نیاز: mes_frm_me02 (عملیات روش)، نوع کارکرد (گام ۶)، طبقه و زمان تعویض (گام ۲).

   نسخه‌ی قبل زمان‌ها را در mfr.RoutingOperationTiming داشت؛ با همان نام و فیلدها آمده است:
     mes.RoutingOperationTiming     همان (SetupTimePerBatch، EquipmentRunTimePerPart، LaborRunTimePerPart،
                                    OutsourceTimePerPart، MoveTimePerBatch، QueueTimePerBatch، StartToStartTime، YieldPercent
                                    و ستون‌های Cum*) + TeardownTimePerBatch (پس از اجرا/شست‌وشو، F-ME-022)،
                                    WaitTimePerBatch و IsWaitOccupyingResource/IsWaitRequiringLabor (زمان انتظار، F-ME-024)،
                                    TransferBatchSize (F-ME-025)، BatchSplitRuleCode و MaxRunQuantity (اندازه‌ی بچ، F-ME-026).
                                    RoutingBatchSize قدیم = اندازه‌ی بچ استاندارد عملیات.
     mes.RoutingOperationCapacity   جدید — هر نوع کارکرد RM (نه فقط نفرساعت/ماشین‌ساعت/انرژی) با مبنای محاسبه (F-ME-020، 021).
                                    جای ستون‌های ثابت LaborHours/EnergyConsumption* نسخه‌ی قبل را می‌گیرد.
     mes.ProductionItem             + ChangeoverClassId — طبقه‌ی تعویض محصول، برای ماتریس زمان تعویض (F-ME-023)
   ماتریس تعویض همان mes.ChangeoverTime گام ۲ (به‌ازای تجهیز) است؛ تجهیز هر عملیات از اعضای گروه منبع می‌آید،
   پس EquipmentId اعضای POOL-PRESS و POOL-MIX (که در گام ۱ خالی مانده بود) پر می‌شود.

   فرض‌ها و کدهای موقت:
     واحد زمان            دقیقه؛ زمان اجرا «به‌ازای هر واحد» است (برای قرص به‌ازای هر قرص)
     CalculationBasisCode 1 = ثابت به‌ازای سفارش، 2 = متناسب با مقدار، 3 = پلکانی، 4 = ثابت + متغیر، 5 = فرمول
     StepsText            «از-تا:مقدار» با جداکننده‌ی ;
     BatchSplitRuleCode   1 = تقسیم به چند اجرا، 2 = گرد کردن به بالا تا مضرب بچ، 3 = اجرای یکجا تا سقف

   فاز اول: F-ME-020 تا 026. منحنی یادگیری (027، مطلوب) و پیشنهاد اصلاح از داده‌ی واقعی (028، مهم) نیامده‌اند.
   این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.RoutingOperationTiming','U') IS NULL
CREATE TABLE mes.RoutingOperationTiming (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RoutingOperationTiming PRIMARY KEY,
  IsNewRecord BIT NULL,
  IsNewlyUpdated BIT NULL,
  RoutingOperationId BIGINT NOT NULL,
  RoutingBatchSize DECIMAL(32,6) NULL,
  MeasureUnitId BIGINT NULL,
  SetupTimePerBatch DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_ROT_Setup DEFAULT (0),
  EquipmentRunTimePerPart DECIMAL(32,8) NOT NULL CONSTRAINT DF_mes_ROT_EqRun DEFAULT (0),
  LaborRunTimePerPart DECIMAL(32,8) NOT NULL CONSTRAINT DF_mes_ROT_LabRun DEFAULT (0),
  OutsourceTimePerPart DECIMAL(32,8) NOT NULL CONSTRAINT DF_mes_ROT_OutRun DEFAULT (0),
  MoveTimePerBatch DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_ROT_Move DEFAULT (0),
  QueueTimePerBatch DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_ROT_Queue DEFAULT (0),
  StartToStartTime DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_ROT_S2S DEFAULT (0),
  YieldPercent DECIMAL(9,4) NOT NULL CONSTRAINT DF_mes_ROT_Yield DEFAULT (100),
  CumSetupTimePerBatch DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_ROT_CumSetup DEFAULT (0),
  CumEquipmentRunTimePerPart DECIMAL(32,8) NOT NULL CONSTRAINT DF_mes_ROT_CumEq DEFAULT (0),
  CumLaborRunTimePerPart DECIMAL(32,8) NOT NULL CONSTRAINT DF_mes_ROT_CumLab DEFAULT (0),
  CumOutsourceTimePerPart DECIMAL(32,8) NOT NULL CONSTRAINT DF_mes_ROT_CumOut DEFAULT (0),
  CumMoveTimePerBatch DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_ROT_CumMove DEFAULT (0),
  CumQueueTimePerBatch DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_ROT_CumQueue DEFAULT (0),
  CumStartToStartTime DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_ROT_CumS2S DEFAULT (0),
  CumYieldPercent DECIMAL(9,4) NOT NULL CONSTRAINT DF_mes_ROT_CumYield DEFAULT (100),
  Description NVARCHAR(400) NULL,
  UnusableInTiming BIT NULL,
  TeardownTimePerBatch DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_ROT_Teardown DEFAULT (0),
  WaitTimePerBatch DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_ROT_Wait DEFAULT (0),
  IsWaitOccupyingResource BIT NOT NULL CONSTRAINT DF_mes_ROT_WaitRes DEFAULT (1),
  IsWaitRequiringLabor BIT NOT NULL CONSTRAINT DF_mes_ROT_WaitLab DEFAULT (0),
  TransferBatchSize DECIMAL(32,6) NULL,
  BatchSplitRuleCode INT NOT NULL CONSTRAINT DF_mes_ROT_Split DEFAULT (1),
  MaxRunQuantity DECIMAL(32,6) NULL
);

IF OBJECT_ID('mes.RoutingOperationCapacity','U') IS NULL
CREATE TABLE mes.RoutingOperationCapacity (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RoutingOperationCapacity PRIMARY KEY,
  RoutingOperationId BIGINT NOT NULL,
  CapacityTypeId BIGINT NOT NULL,
  CalculationBasisCode INT NOT NULL CONSTRAINT CK_mes_RoutingOperationCapacity_Basis CHECK (CalculationBasisCode IN (1, 2, 3, 4, 5)),
  FixedQuantity DECIMAL(32,6) NULL,
  VariableQuantity DECIMAL(32,8) NULL,
  PerQuantity DECIMAL(32,6) NULL,
  StepsText NVARCHAR(400) NULL,
  Formula NVARCHAR(400) NULL,
  Description NVARCHAR(400) NULL
);

IF COL_LENGTH('mes.ProductionItem', 'ChangeoverClassId') IS NULL
  ALTER TABLE mes.ProductionItem ADD ChangeoverClassId BIGINT NULL;
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

CREATE OR ALTER PROCEDURE mes.GetRoutingTimings
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.RoutingId AS INT) AS RoutingId, CAST(o.Id AS INT) AS RoutingOperationId, o.Sequence, op.Number AS OperationCode, op.Name AS OperationTitle,
         op.OperationTypeCode AS NatureCode, o.IsOutsourcing, o.AllocationPercent, CAST(CASE WHEN t.Id IS NULL THEN 0 ELSE 1 END AS BIT) AS HasTiming,
         t.RoutingBatchSize, t.SetupTimePerBatch, t.EquipmentRunTimePerPart, t.LaborRunTimePerPart, t.OutsourceTimePerPart, t.TeardownTimePerBatch,
         t.WaitTimePerBatch, t.IsWaitOccupyingResource, t.IsWaitRequiringLabor, t.MoveTimePerBatch, t.QueueTimePerBatch, t.TransferBatchSize,
         t.BatchSplitRuleCode, t.MaxRunQuantity, t.Description
  FROM mes.RoutingOperation o
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.RoutingOperationTiming t ON t.RoutingOperationId = o.Id AND t.IsDeleted = 0
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0
  ORDER BY o.RoutingId, o.Sequence;
END
GO

CREATE OR ALTER PROCEDURE mes.GetRoutingCapacities
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.RoutingId AS INT) AS RoutingId, CAST(c.RoutingOperationId AS INT) AS RoutingOperationId, o.Sequence, op.Name AS OperationTitle,
         CAST(ct.Id AS INT) AS CapacityTypeId, ct.Number + N' — ' + ct.Name AS CapacityTitle, ct.MeasureUnitTitle AS UnitTitle, ct.MeasureBasisCode, ct.IsActive AS CapacityIsActive,
         ct.IsCostDriver, c.CalculationBasisCode, c.FixedQuantity, c.VariableQuantity, c.PerQuantity, c.StepsText, c.Formula, c.Description
  FROM mes.RoutingOperationCapacity c
  JOIN mes.RoutingOperation o ON o.Id = c.RoutingOperationId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN mes.CapacityType ct ON ct.Id = c.CapacityTypeId
  WHERE c.CompanyId = @CompanyId AND c.IsDeleted = 0
  ORDER BY o.RoutingId, o.Sequence, ct.SortOrder;
END
GO

/* ماتریس تعویض تجهیزات هر عملیات روش (از اعضای گروه منبع) + طبقه‌ی تعویض محصول روش */
CREATE OR ALTER PROCEDURE mes.GetRoutingChangeovers
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT DISTINCT CAST(o.RoutingId AS INT) AS RoutingId, CAST(o.Id AS INT) AS RoutingOperationId, o.Sequence,
         CAST(e.Id AS INT) AS EquipmentId, e.Number + N' — ' + e.Name AS EquipmentTitle,
         CAST(ct.FromChangeoverClassId AS INT) AS FromClassId, CAST(ct.ToChangeoverClassId AS INT) AS ToClassId, ct.Minutes
  FROM mes.RoutingOperation o
  JOIN mes.ResourceGroupMember m ON m.ResourceGroupId = o.ResourceGroupId AND m.IsDeleted = 0
  JOIN mes.Equipment e ON e.Id = m.EquipmentId
  LEFT JOIN mes.ChangeoverTime ct ON ct.EquipmentId = e.Id AND ct.IsDeleted = 0
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0;

  SELECT CAST(c.Id AS INT) AS ClassId, c.Number AS Code, c.Name AS Title, c.SortOrder FROM mes.ChangeoverClass c
  WHERE c.CompanyId = @CompanyId AND c.IsDeleted = 0 ORDER BY c.SortOrder;

  SELECT DISTINCT CAST(a.RoutingId AS INT) AS RoutingId, CAST(pi.ChangeoverClassId AS INT) AS ClassId
  FROM mes.RoutingProductStructureAssignment a
  JOIN mes.ProductStructureMaster sm ON sm.ProductStructureId = a.ProductStructureId AND sm.IsMainProduct = 1 AND sm.IsDeleted = 0
  JOIN mes.ProductionItem pi ON pi.ProductId = sm.ProductId AND pi.IsDeleted = 0
  WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.RoutingOperationTiming خالی است.
   عمداً خراب: RT-1001 v2 «الک» زمان ندارد؛ بسته‌بندی آن کارکرد پلکانی بدون پله دارد؛ دسته‌ی انتقال بازرسی
   بزرگ‌تر از بچ عملیات است؛ «پرس B» در ماتریس تعویض ردیفی ندارد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.RoutingOperationTiming)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  UPDATE m SET m.EquipmentId = e.Id
  FROM mes.ResourceGroupMember m
  JOIN (VALUES (N'پرس A', N'EQ-1055'), (N'پرس B', N'EQ-1056'), (N'میکسر ۱', N'EQ-1010'), (N'میکسر ۳', N'EQ-1042')) v(MemberName, EqNo) ON v.MemberName = m.Name
  JOIN mes.Equipment e ON e.Number = v.EqNo AND e.CompanyId = @C
  WHERE m.CompanyId = @C AND m.EquipmentId IS NULL;

  UPDATE pi SET pi.ChangeoverClassId = cc.Id
  FROM mes.ProductionItem pi
  JOIN (VALUES (1001, N'TAB-WHITE'), (1005, N'TAB-WHITE'), (1002, N'TAB-COATED'), (1004, N'TAB-COLOR')) v(ProductId, ClassNo) ON v.ProductId = pi.ProductId
  JOIN mes.ChangeoverClass cc ON cc.Number = v.ClassNo AND cc.CompanyId = @C
  WHERE pi.CompanyId = @C;

  /* زمان‌ها (دقیقه): (روش، نسخه، ردیف، بچ، راه‌اندازی، اجرای ماشین/واحد، اجرای نفر/واحد، برون‌سپاری/واحد، پس از اجرا، انتظار، انتظار منبع را اشغال می‌کند، جابه‌جایی، صف، دسته‌ی انتقال، قاعده‌ی تقسیم، سقف اجرا) */
  INSERT mes.RoutingOperationTiming (CompanyId, RoutingOperationId, RoutingBatchSize, SetupTimePerBatch, EquipmentRunTimePerPart, LaborRunTimePerPart, OutsourceTimePerPart,
                                     TeardownTimePerBatch, WaitTimePerBatch, IsWaitOccupyingResource, IsWaitRequiringLabor, MoveTimePerBatch, QueueTimePerBatch,
                                     TransferBatchSize, BatchSplitRuleCode, MaxRunQuantity, YieldPercent, Description)
  SELECT @C, o.Id, v.Batch, v.Setup, v.EqRun, v.LabRun, v.OutRun, v.Teardown, v.Wait, v.WaitRes, 0, v.Move, v.Queue, v.Transfer, v.Split, v.MaxRun, ISNULL(o.YieldPercent, 100), v.Description
  FROM (VALUES
    (N'RT-1001', N'v1', 10, 300000.0, 20.0, 0.00008,  0.00016,  0.0, 15.0,   0.0, 1, 10.0, 30.0, NULL,     1, NULL,      NULL),
    (N'RT-1001', N'v1', 20, 300000.0, 30.0, 0.00015,  0.00015,  0.0, 45.0,   0.0, 1, 10.0, 20.0, NULL,     1, NULL,      NULL),
    (N'RT-1001', N'v1', 30, 300000.0, 15.0, 0.0002,   0.00002,  0.0, 30.0,  60.0, 1, 10.0, 0.0,  NULL,     1, NULL,      NULL),
    (N'RT-1001', N'v1', 40, 300000.0, 45.0, 0.00055,  0.00055,  0.0, 40.0,   0.0, 1, 15.0, 60.0, NULL,     1, NULL,      NULL),
    (N'RT-1001', N'v1', 50, 300000.0, 10.0, 0.0002,   0.0002,   0.0, 10.0,   0.0, 1, 10.0, 15.0, NULL,     1, NULL,      NULL),
    (N'RT-1001', N'v1', 60, 300000.0, 60.0, 0.0004,   0.0008,   0.0, 45.0,   0.0, 1, 10.0, 30.0, NULL,     1, NULL,      NULL),
    (N'RT-1001', N'v1', 70, 300000.0,  0.0, 0.0,      0.00002,  0.0,  0.0,   0.0, 1, 20.0, 0.0,  NULL,     1, NULL,      NULL),
    (N'RT-1001', N'v2', 10, 300000.0, 20.0, 0.00008,  0.00016,  0.0, 15.0,   0.0, 1, 10.0, 30.0, NULL,     1, NULL,      NULL),
    (N'RT-1001', N'v2', 20, 300000.0, 30.0, 0.00015,  0.00015,  0.0, 45.0,   0.0, 1, 10.0, 20.0, NULL,     2, 600000.0,  N'گرد کردن به مضرب ظرفیت میکسر'),
    (N'RT-1001', N'v2', 30, 300000.0, 15.0, 0.0002,   0.00002,  0.0, 30.0,  60.0, 1, 10.0, 0.0,  NULL,     1, NULL,      N'خشک‌شدن: منبع اشغال، بدون نیرو'),
    (N'RT-1001', N'v2', 40, 300000.0, 45.0, 0.00055,  0.00055,  0.0, 40.0,   0.0, 1, 15.0, 60.0, 100000.0, 1, NULL,      NULL),
    (N'RT-1001', N'v2', 45, 300000.0, 60.0, 0.0008,   0.0008,   0.0, 40.0,   0.0, 1, 30.0, 60.0, 100000.0, 1, NULL,      N'پرس تک‌ایستگاه کندتر'),
    (N'RT-1001', N'v2', 50, 300000.0, 10.0, 0.0002,   0.0002,   0.0, 10.0,   0.0, 1, 10.0, 15.0, 600000.0, 1, NULL,      NULL),
    (N'RT-1001', N'v2', 60, 400000.0, 60.0, 0.0004,   0.0008,   0.0, 45.0,   0.0, 1, 10.0, 30.0, 50000.0,  1, NULL,      N'بلیستر حداکثر ۴۰۰٬۰۰۰ در هر اجرا'),
    (N'RT-1001', N'v2', 70, 300000.0,  0.0, 0.0,      0.00002,  0.0,  0.0,   0.0, 1, 20.0, 0.0,  NULL,     1, NULL,      NULL),
    (N'RT-1002', N'v1', 10, 500000.0,  0.0, 0.0,      0.0,      0.0072, 0.0, 0.0, 1, 0.0, 0.0,  NULL,     3, 600000.0,  N'۵ روز کاری نزد پیمانکار'),
    (N'RT-1002', N'v1', 20, 500000.0, 10.0, 0.0002,   0.0002,   0.0, 10.0,   0.0, 1, 10.0, 15.0, NULL,     1, NULL,      NULL),
    (N'RT-1002', N'v1', 30, 500000.0, 60.0, 0.0004,   0.0008,   0.0, 45.0,   0.0, 1, 10.0, 30.0, NULL,     1, NULL,      NULL),
    (N'RT-1002', N'v1', 40, 500000.0,  0.0, 0.0,      0.00002,  0.0,  0.0,   0.0, 1, 20.0, 0.0,  NULL,     1, NULL,      NULL),
    (N'RT-2001', N'v1', 10,    120.0, 30.0, 0.375,    0.375,    0.0, 45.0,   0.0, 1, 10.0, 20.0, NULL,     1, NULL,      N'۴۵ دقیقه به‌ازای بچ ۱۲۰ کیلو'),
    (N'RT-2001', N'v1', 20,    120.0, 15.0, 0.25,     0.05,     0.0, 30.0,  60.0, 1, 10.0, 0.0,  NULL,     1, NULL,      NULL),
    (N'RT-2001', N'v1', 30,    120.0, 20.0, 1.0,      0.1,      0.0, 20.0,   0.0, 1,  0.0, 0.0,  NULL,     1, NULL,      NULL),
    (N'RT-2003', N'v1', 10,     50.0, 10.0, 1.2,      1.2,      0.0, 20.0, 120.0, 0, 10.0, 0.0,  NULL,     1, NULL,      N'هم‌زدن نهایی؛ ظرف آزاد است'),
    (N'RT-TOLL-01', N'v1', 10, 300000.0, 20.0, 0.00008, 0.00016, 0.0, 15.0,  0.0, 1, 10.0, 30.0, NULL,     1, NULL,      NULL),
    (N'RT-TOLL-01', N'v1', 20, 300000.0, 30.0, 0.00015, 0.00015, 0.0, 45.0,  0.0, 1, 10.0, 20.0, NULL,     1, NULL,      NULL),
    (N'RT-TOLL-01', N'v1', 30, 300000.0, 15.0, 0.0002,  0.00002, 0.0, 30.0, 60.0, 1, 10.0, 0.0,  NULL,     1, NULL,      NULL),
    (N'RT-TOLL-01', N'v1', 40, 300000.0, 60.0, 0.0008,  0.0008,  0.0, 40.0,  0.0, 1, 15.0, 60.0, NULL,     1, NULL,      NULL),
    (N'RT-TOLL-01', N'v1', 50, 300000.0, 60.0, 0.0004,  0.0008,  0.0, 45.0,  0.0, 1, 10.0, 30.0, NULL,     1, NULL,      NULL)
  ) v(Rt, Ver, Seq, Batch, Setup, EqRun, LabRun, OutRun, Teardown, Wait, WaitRes, Move, Queue, Transfer, Split, MaxRun, Description)
  JOIN mes.ProductionRevision rv ON rv.Number = v.Ver
  JOIN mes.RoutingMaster r ON r.Number = v.Rt AND r.VersionId = rv.Id AND r.CompanyId = @C
  JOIN mes.RoutingOperation o ON o.RoutingId = r.Id AND o.Sequence = v.Seq;

  /* کارکردها: (روش، نسخه، ردیف، نوع کارکرد، مبنا، ثابت، متغیر، به‌ازای، پله‌ها، فرمول) */
  INSERT mes.RoutingOperationCapacity (CompanyId, RoutingOperationId, CapacityTypeId, CalculationBasisCode, FixedQuantity, VariableQuantity, PerQuantity, StepsText, Formula, Description)
  SELECT @C, o.Id, ct.Id, v.Basis, v.Fixed, v.Var, v.Per, v.Steps, v.Formula, v.Description
  FROM (VALUES
    (N'RT-1001', N'v2', 10, N'LAB', 4, 0.5,  0.0000027, 1.0,  NULL, NULL, N'نیم ساعت آماده‌سازی + متناسب'),
    (N'RT-1001', N'v2', 20, N'LAB', 2, NULL, 2.5,     300000.0, NULL, NULL, N'۲٫۵ نفرساعت به‌ازای هر بچ مرجع'),
    (N'RT-1001', N'v2', 20, N'MCH', 2, NULL, 1.25,    300000.0, NULL, NULL, NULL),
    (N'RT-1001', N'v2', 20, N'ELC', 2, NULL, 38.0,    300000.0, NULL, NULL, NULL),
    (N'RT-1001', N'v2', 30, N'STM', 1, 120.0, NULL,   NULL, NULL, NULL, N'ثابت به‌ازای هر سفارش'),
    (N'RT-1001', N'v2', 30, N'MCH', 4, 0.5,  1.0,     300000.0, NULL, NULL, NULL),
    (N'RT-1001', N'v2', 40, N'MCH', 2, NULL, 2.75,    300000.0, NULL, NULL, NULL),
    (N'RT-1001', N'v2', 40, N'STR', 2, NULL, 1.0,     1.0,  NULL, NULL, N'هر قرص یک ضربه'),
    (N'RT-1001', N'v2', 40, N'MLD', 2, NULL, 2.75,    300000.0, NULL, NULL, NULL),
    (N'RT-1001', N'v2', 45, N'MCH', 2, NULL, 4.0,     300000.0, NULL, NULL, NULL),
    (N'RT-1001', N'v2', 45, N'STR', 2, NULL, 1.0,     1.0,  NULL, NULL, NULL),
    (N'RT-1001', N'v2', 50, N'LAB', 2, NULL, 2.0,     300000.0, NULL, NULL, NULL),
    (N'RT-1001', N'v2', 60, N'LAB', 3, NULL, NULL,    NULL, NULL, NULL, N'پلکانی — پله‌ها ثبت نشده'),
    (N'RT-1001', N'v2', 60, N'ELC', 3, NULL, NULL,    NULL, N'0-300000:40;300000-600000:70;600000-1200000:130', NULL, NULL),
    (N'RT-1001', N'v2', 60, N'AIR', 5, NULL, NULL,    NULL, NULL, N'Quantity / 10000 * 0.8 + 5', N'فرمول بر مبنای مقدار سفارش'),
    (N'RT-2001', N'v1', 10, N'LAB', 4, 0.5,  0.02,    1.0,  NULL, NULL, NULL),
    (N'RT-2001', N'v1', 20, N'STM', 2, NULL, 1.0,     1.0,  NULL, NULL, N'یک کیلو بخار به‌ازای هر کیلو گرانول'),
    (N'RT-2001', N'v1', 30, N'TNK', 2, NULL, 0.3,     1.0,  NULL, NULL, N'حجم مخزن تقطیر به‌ازای هر لیتر'),
    (N'RT-2003', N'v1', 10, N'LAB', 1, 1.5,  NULL,    NULL, NULL, NULL, NULL),
    (N'RT-1002', N'v1', 20, N'LAB', 2, NULL, 3.3,     500000.0, NULL, NULL, NULL),
    (N'RT-1002', N'v1', 30, N'LAB', 2, NULL, 6.5,     500000.0, NULL, NULL, NULL)
  ) v(Rt, Ver, Seq, Ct, Basis, Fixed, Var, Per, Steps, Formula, Description)
  JOIN mes.ProductionRevision rv ON rv.Number = v.Ver
  JOIN mes.RoutingMaster r ON r.Number = v.Rt AND r.VersionId = rv.Id AND r.CompanyId = @C
  JOIN mes.RoutingOperation o ON o.RoutingId = r.Id AND o.Sequence = v.Seq
  JOIN mes.CapacityType ct ON ct.Number = v.Ct AND ct.CompanyId = @C;

  /* الک RT-1001 v2 عمداً زمان ندارد */
  DELETE t FROM mes.RoutingOperationTiming t
  JOIN mes.RoutingOperation o ON o.Id = t.RoutingOperationId
  JOIN mes.RoutingMaster r ON r.Id = o.RoutingId AND r.Number = N'RT-1001'
  JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId AND rv.Number = N'v2'
  WHERE o.Sequence = 15;

  COMMIT;
END
GO
