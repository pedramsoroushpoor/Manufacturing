/* =====================================================================
   اسکیمای mes — گام ۲۶: FRM-ME-09 «تولید پیوسته و کمپین»

   پیش‌نیاز: mes_frm_me08 (نسخه‌ی تولید)، شیفت (گام ۴).
   یادداشت ALM: «تعمیم رویه‌ی موجود و کاربردی دستور شیفتی».

   نسخه‌ی قبل دستور شیفتی را عملاً با شیفت‌های دستور کار (WorkOrderOperation.StartTimeShiftId/CompleteTimeShiftId) و
   ProductionWorkingShift داشت، بدون الگو. جدول‌ها:
     mes.RoutingMaster          + RateQuantity، RateTimeBasisCode — روش پیوسته با مبنای نرخ (مقدار در واحد زمان، F-ME-068)؛
                                ProductionTypeCode = 2 همان فیلد قدیم.
     mes.ShiftOrderTemplate     جدید — الگوی دستور شیفتی روی نسخه‌ی تولید (OrderBasisCode = 2): مقدار برنامه‌ریزی‌شده‌ی هر شیفت
                                (F-ME-069). شیفت همان mes.ProductionWorkingShift گام ۴ است.
     mes.ShiftHandoverRule      جدید — انتقال شیفت: موجودی در جریان پایان شیفت ورودی شیفت بعد می‌شود یا بسته/برگشت می‌خورد (F-ME-072)

   فرض‌ها و کدهای موقت:
     RateTimeBasisCode   1 = در ساعت، 2 = در شیفت
     HandoverModeCode    1 = انتقال به دستور شیفت بعد، 2 = بستن و رسید در پایان شیفت، 3 = برگشت به انبار پای کار

   فاز اول: F-ME-068، 069، 072. کمپین (070) و موازنه‌ی جرم/انرژی (071) اولویت «مهم» دارند و نیامده‌اند.
   داده‌ی نمونه یک روش پیوسته‌ی گرانولاسیون (RT-2001-C) و نسخه‌ی شیفتی آن را هم می‌سازد، با زمان، تخصیص مواد و خروجی‌ها
   تا فرم‌های ME-02 تا ME-04 برایش کامل باشند. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF COL_LENGTH('mes.RoutingMaster', 'RateQuantity') IS NULL
  ALTER TABLE mes.RoutingMaster ADD RateQuantity DECIMAL(32,6) NULL, RateTimeBasisCode INT NULL;

IF OBJECT_ID('mes.ShiftOrderTemplate','U') IS NULL
CREATE TABLE mes.ShiftOrderTemplate (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ShiftOrderTemplate PRIMARY KEY,
  ManufacturingVersionId BIGINT NOT NULL,
  WorkingShiftId BIGINT NOT NULL,
  PlannedQuantity DECIMAL(32,6) NOT NULL,
  NetRunMinutes INT NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_SOT_IsActive DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ShiftHandoverRule','U') IS NULL
CREATE TABLE mes.ShiftHandoverRule (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ShiftHandoverRule PRIMARY KEY,
  RoutingOperationId BIGINT NOT NULL,
  HandoverModeCode INT NOT NULL CONSTRAINT CK_mes_SHR_Mode CHECK (HandoverModeCode IN (1, 2, 3)),
  MaxCarryHours DECIMAL(9,2) NULL,
  RequiresCount BIT NOT NULL CONSTRAINT DF_mes_SHR_Count DEFAULT (1),
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

/* روش‌های پیوسته با نرخ و نسخه‌های تولیدشان */
CREATE OR ALTER PROCEDURE mes.GetContinuousRoutings
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(r.Id AS INT) AS RoutingId, r.Number + N' ' + rv.Number + N' — ' + r.Name AS RoutingTitle, r.RoutingMasterStatusCode AS StatusCode,
         r.RateQuantity, r.RateTimeBasisCode, r.RoutingBatchSize, l.Name AS LineTitle,
         (SELECT TOP (1) p.MeasureUnitTitle FROM mes.RoutingProductStructureAssignment a JOIN mes.ProductStructureMaster m ON m.ProductStructureId = a.ProductStructureId AND m.IsMainProduct = 1
            JOIN mes.Product p ON p.Id = m.ProductId WHERE a.RoutingId = r.Id AND a.IsDeleted = 0) AS UnitTitle,
         (SELECT STRING_AGG(CAST(o.Sequence AS NVARCHAR(8)) + N' ' + op.Name, N' ← ') WITHIN GROUP (ORDER BY o.Sequence)
            FROM mes.RoutingOperation o JOIN mes.ProductionOperation op ON op.Id = o.OperationId WHERE o.RoutingId = r.Id AND o.IsDeleted = 0) AS Operations,
         (SELECT STRING_AGG(v.Number + N' (' + CASE v.OrderBasisCode WHEN 2 THEN N'شیفتی' ELSE N'مقداری' END + N')', N'، ')
            FROM mes.ManufacturingVersion v WHERE v.RoutingId = r.Id AND v.IsDeleted = 0) AS Versions
  FROM mes.RoutingMaster r
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  LEFT JOIN mes.ProductionLine l ON l.Id = r.ProductionLineId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0 AND r.ProductionTypeCode = 2
  ORDER BY r.Number;
END
GO

/* الگوهای دستور شیفتی با ظرفیت نظری شیفت = نرخ روش × زمان خالص */
CREATE OR ALTER PROCEDURE mes.GetShiftOrderTemplates
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(t.Id AS INT) AS TemplateId, CAST(v.Id AS INT) AS VersionId, v.Number + N' — ' + v.Name AS VersionTitle, v.OrderBasisCode, v.StatusCode AS VersionStatusCode,
         CAST(s.Id AS INT) AS ShiftId, s.Number + N' — ' + s.Name AS ShiftTitle, s.FromTime, s.ToTime, s.Duration AS ShiftMinutes,
         t.PlannedQuantity, t.NetRunMinutes, t.IsActive, t.Description, r.RateQuantity, r.RateTimeBasisCode,
         CAST(CASE WHEN r.RateTimeBasisCode = 2 THEN r.RateQuantity
                   ELSE r.RateQuantity * ISNULL(t.NetRunMinutes, s.Duration) / 60.0 END AS DECIMAL(32,4)) AS ShiftCapacity
  FROM mes.ShiftOrderTemplate t
  JOIN mes.ManufacturingVersion v ON v.Id = t.ManufacturingVersionId
  JOIN mes.RoutingMaster r ON r.Id = v.RoutingId
  JOIN mes.ProductionWorkingShift s ON s.Id = t.WorkingShiftId
  WHERE t.CompanyId = @CompanyId AND t.IsDeleted = 0
  ORDER BY v.Number, s.FromTime;
END
GO

CREATE OR ALTER PROCEDURE mes.GetShiftHandoverRules
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.RoutingId AS INT) AS RoutingId, r.Number + N' ' + rv.Number AS RoutingCode, CAST(o.Id AS INT) AS RoutingOperationId, o.Sequence,
         op.Number + N' — ' + op.Name AS OperationTitle, h.HandoverModeCode, h.MaxCarryHours, h.RequiresCount, h.Description
  FROM mes.RoutingOperation o
  JOIN mes.RoutingMaster r ON r.Id = o.RoutingId AND r.ProductionTypeCode = 2
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.ShiftHandoverRule h ON h.RoutingOperationId = o.Id AND h.IsDeleted = 0
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0
  ORDER BY r.Number, o.Sequence;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.ShiftOrderTemplate خالی است.
   عمداً خراب: برنامه‌ی شیفت شب (۱٬۱۰۰ کیلو) از ظرفیت نظری شیفت (۱۲۰ کیلو در ساعت × ۴۸۰ دقیقه = ۹۶۰) بیشتر است؛
   «خشک‌کن» قاعده‌ی انتقال شیفت ندارد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ShiftOrderTemplate)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @v1 BIGINT = (SELECT Id FROM mes.ProductionRevision WHERE Number = N'v1');

  IF NOT EXISTS (SELECT 1 FROM mes.RoutingMaster WHERE Number = N'RT-2001-C' AND CompanyId = @C)
  BEGIN
    INSERT mes.RoutingMaster (CompanyId, Number, Name, ProductionTypeCode, RoutingBatchSize, MinBatchSize, MaxBatchSize, ProductionLineId, ValidFromDate,
                              RoutingMethodCode, VersionId, RoutingMasterStatusCode, RateQuantity, RateTimeBasisCode, ProcessWastePercent, WastePriorityCode, Description)
    VALUES (@C, N'RT-2001-C', N'گرانول قرص سفید — گرانولاسیون پیوسته', 2, 960.0, NULL, NULL, 2, '2026-07-01', 2, @v1, 3, 120.0, 1, 1.5, 2, N'گرانولاتور دوپیچی و خشک‌کن پیوسته');
    DECLARE @r BIGINT = SCOPE_IDENTITY();

    INSERT mes.RoutingProductStructureAssignment (CompanyId, RoutingId, ProductStructureId, RoutingMethodCode)
    SELECT @C, @r, s.Id, 2 FROM mes.ProductStructure s WHERE s.Number = N'BOM-2001' AND s.CompanyId = @C;

    INSERT mes.RoutingOperation (CompanyId, Sequence, RoutingId, OperationId, OperationTypeCode, WorkCenterId, ResourceGroupId, YieldPercent, IsOutsourcing, IntermediateStorageCode, Description)
    SELECT @C, v.Seq, @r, op.Id, op.OperationTypeCode, w.Id, rg.Id, v.Yield, 0, v.Storage, v.Description
    FROM (VALUES (10, N'OP-20', NULL, N'POOL-MIX', 99.0, 1, N'خوراک پیوسته'), (20, N'OP-25', N'20', NULL, 98.5, 2, N'خشک‌کن پیوسته')) v(Seq, Op, StationNo, GroupNo, Yield, Storage, Description)
    JOIN mes.ProductionOperation op ON op.Number = v.Op AND op.CompanyId = @C
    LEFT JOIN mes.WorkCenter w ON w.Number = v.StationNo AND w.ProductionLineId = 2 AND w.CompanyId = @C
    LEFT JOIN mes.ResourceGroup rg ON rg.Number = v.GroupNo AND rg.CompanyId = @C;

    DECLARE @o10 BIGINT = (SELECT Id FROM mes.RoutingOperation WHERE RoutingId = @r AND Sequence = 10);
    DECLARE @o20 BIGINT = (SELECT Id FROM mes.RoutingOperation WHERE RoutingId = @r AND Sequence = 20);
    DECLARE @a BIGINT = (SELECT TOP (1) Id FROM mes.RoutingProductStructureAssignment WHERE RoutingId = @r);

    INSERT mes.RoutingOperationLink (CompanyId, RoutingId, FromRoutingOperationId, ToRoutingOperationId, OverlapTypeCode, OverlapMinutes, Description)
    VALUES (@C, @r, @o10, @o20, 3, 5, N'جریان پیوسته؛ ۵ دقیقه تأخیر انتقال');

    INSERT mes.RoutingOperationTiming (CompanyId, RoutingOperationId, RoutingBatchSize, SetupTimePerBatch, EquipmentRunTimePerPart, LaborRunTimePerPart, TeardownTimePerBatch, MoveTimePerBatch, YieldPercent, Description)
    VALUES (@C, @o10, 960.0, 60.0, 0.5, 0.1, 45.0, 0.0, 99.0, N'۰٫۵ دقیقه به‌ازای هر کیلو = ۱۲۰ کیلو در ساعت'),
           (@C, @o20, 960.0, 30.0, 0.5, 0.05, 30.0, 5.0, 98.5, NULL);

    INSERT mes.RoutingOperationMaterial (CompanyId, RoutingProductStructureAssignmentId, RoutingOperationId, ProductId, IsBackflushed, Quantity, ProductStructureItemId, ConsumptionPointCode, AllocationPercent)
    SELECT @C, @a, @o10, f.ProductId, 1, ISNULL(f.Quantity, 0), f.ItemId, 2, 100.0
    FROM mes.ProductStructure s CROSS APPLY mes.fnStructureItems(s.Id, NULL) f
    WHERE s.Number = N'BOM-2001' AND s.CompanyId = @C AND f.Source <> 'removed';

    INSERT mes.RoutingOperationOutput (CompanyId, RoutingProductStructureAssignmentId, FromOperationSequence, ToOperationSequence, OuputProductId, ReceiveOutputTypeCode,
                                       IsMainOutputProduct, IsDeliverableProduct, Quantity, RoutingOperationId, Description)
    VALUES (@C, @a, 20, 20, 2001, 1, 1, 1, 960.0, @o20, N'به‌ازای هر شیفت'),
           (@C, @a, 20, 20, 2006, 2, 0, 1, 14.4, @o20, NULL),
           (@C, @a, 20, 20, 2005, 3, 0, 1, 19.2, @o20, NULL),
           (@C, @a, 20, 20, 5002, 4, 0, 0, 3.84, @o20, NULL),
           (@C, @a, 10, 10, 5003, 4, 0, 0, 0.96, @o10, NULL),
           (@C, @a, 20, 20, 3015, 5, 0, 1, 0.0, @o20, N'در پیوسته بازیافت نمی‌شود');

    INSERT mes.ManufacturingVersion (CompanyId, Number, Name, ProductId, ProductStructureId, RoutingId, ProductionLineId, MinBatchSize, MaxBatchSize, EffectivityTypeCode,
                                     ValidFromDate, Priority, StatusCode, ProductionTypeCode, OrderBasisCode, AllowsStandardOrder, BaseCost, BaseLeadTimeHours, ApproverTitle, Description)
    SELECT @C, N'MV-2001-C', N'گرانول قرص سفید — پیوسته، دستور شیفتی', 2001, s.Id, @r, 2, NULL, NULL, 1, '2026-07-01', 2, 3, 2, 2, 1, 7600000000.0, 8.0, N'مدیر فنی', N'مبنای دستور: شیفت'
    FROM mes.ProductStructure s WHERE s.Number = N'BOM-2001' AND s.CompanyId = @C;
  END

  INSERT mes.ShiftOrderTemplate (CompanyId, ManufacturingVersionId, WorkingShiftId, PlannedQuantity, NetRunMinutes, Description)
  SELECT @C, v.Id, s.Id, x.Qty, x.NetMin, x.Description
  FROM (VALUES (N'SH-M', 900.0, 450, N'۳۰ دقیقه راه‌اندازی صبح'), (N'SH-E', 940.0, 470, NULL), (N'SH-N', 1100.0, 480, N'برنامه‌ی شب بالاتر از ظرفیت')) x(ShiftNo, Qty, NetMin, Description)
  JOIN mes.ProductionWorkingShift s ON s.Number = x.ShiftNo AND s.CompanyId = @C
  JOIN mes.ManufacturingVersion v ON v.Number = N'MV-2001-C' AND v.CompanyId = @C;

  INSERT mes.ShiftHandoverRule (CompanyId, RoutingOperationId, HandoverModeCode, MaxCarryHours, RequiresCount, Description)
  SELECT @C, o.Id, 1, 2.0, 1, N'مواد داخل گرانولاتور و مخزن خوراک به دستور شیفت بعد منتقل می‌شود؛ شمارش و توزین در تحویل'
  FROM mes.RoutingOperation o JOIN mes.RoutingMaster r ON r.Id = o.RoutingId AND r.Number = N'RT-2001-C'
  WHERE o.Sequence = 10;

  COMMIT;
END
GO
