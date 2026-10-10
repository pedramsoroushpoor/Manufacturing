/* =====================================================================
   اسکیمای mes — گام ۳۰: FRM-PC-02 «دستور کار»

   پیش‌نیاز: mes_frm_pc01 (درخواست و موجودی)، روش ساخت و نسخه‌ی تولید (گام‌های ۱۹ تا ۲۷).
   یادداشت ALM: «فرم مرکزی کنترل تولید؛ همه‌ی انواع دستور در یک فرم با پیکربندی نوع».

   نسخه‌ی قبل این جدول‌ها را داشت و همه با همان نام و همه‌ی فیلدها آمده‌اند (هیچ فیلد قدیمی حذف نشده؛ چند شناسه‌ی
   NOT NULL که به جدول‌های هنوز‌نیامده‌ی انبار/واحد اشاره می‌کنند این‌جا NULL پذیرند):
     mes.WorkOrder                   همان mfr.WorkOrder + ManufacturingVersionId، VersionSelectionNote، IsVersionOverridden،
                                     VersionOverrideReason (F-PC-009)، BasisCode (مبنای صدور، 008)، BatchNumber (019)،
                                     WorkingShiftId و ShiftDate (دستور شیفتی، 018)، DueDate (محاسبه‌ی معکوس، 013)،
                                     CustomerTitle، ConfigurationText (پیکربندی PE-07). والد-فرزند و مبدأ دوباره‌کاری/بازیافت
                                     همان RefWorkOrderId قدیم است (011).
     mes.WorkOrderProduct            همان + OutputTypeCode (اصلی/همزاد/جانبی/ضایعات/بازیافتی از ساختار)
     mes.WorkOrderOperation          همان + RoutingOperationId، ResourceGroupId؛ WorkCenterId NULL پذیر
     mes.WorkOrderOperationMaterial  همان (همه‌ی ۵۰ فیلد) + ProductStructureItemId، StandardQuantity، BatchNumber، IsRecoveredMaterial
     mes.WorkOrderReasonCancel       همان + CancelDate، CancelReasonTitle، MaterialDispositionCode، WorkDispositionCode (017)
     mes.WorkOrderChangeLog          جدید — تغییر مقدار/نسخه/تاریخ پس از آزادسازی با گردش تأیید (016)

   فرض‌ها و کدهای موقت (معنای کدهای قدیم WOTypeCode و WorkOrderStatusCode در دسترس نیست — منتظر تأیید):
     WOTypeCode                     1 = عادی، 2 = شیفتی/پیوسته، 3 = دوباره‌کاری، 4 = بازیافت، 5 = برون‌سپاری، 6 = کارمزدی دریافتی،
                                    7 = نمونه‌سازی/R&D، 8 = تعمیراتی-تولیدی، 9 = پروژه‌ای (F-PC-007)
     WorkOrderStatusCode            1 = برنامه‌ریزی‌شده، 2 = آزادشده، 3 = در جریان، 4 = تکمیل‌شده، 5 = بسته‌شده، 6 = باطل، 7 = معلق
     WorkOrderPriorityCode          1 = عادی، 2 = بالا، 3 = فوری
     BasisCode                      1 = درخواست تولید، 2 = برنامه‌ی تولید، 3 = سفارش مشتری، 4 = دستور بالادستی، 5 = بدون مبنا
     WorkOrderOperationStatusCode   1 = در انتظار، 2 = آماده، 3 = در جریان، 4 = متوقف، 5 = تکمیل‌شده، 6 = نزد پیمانکار
     WorkOrderOperationMaterialStatusCode 1 = برنامه‌ای، 2 = کیت‌شده، 3 = تحویل پای کار، 4 = در مصرف، 5 = تسویه‌شده
     MaterialDispositionCode / WorkDispositionCode  1 = برگشت به انبار، 2 = انتقال به دستور دیگر، 3 = ضایعات / 1 = رسید نیمه‌کاره، 2 = دوباره‌کاری، 3 = اسقاط

   داده‌ی نمونه: سناریوی روز ۱۷ مهر ۱۴۰۵ ساعت ۱۱:۳۰ — ۱۴ دستور از همه‌ی انواع، با عملیات و مواد ساخته‌شده از روش و
   ساختار واقعی نسخه‌ی تولید. گام‌های PC-03 تا PC-12 روی همین دستورها داده‌ی اجرا (کیت، گزارش، مصرف، رسید…) می‌سازند.
   فاز اول فقط‌خواندنی است؛ تقسیم/ادغام (015، مهم) نیامده. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.WorkOrder','U') IS NULL
CREATE TABLE mes.WorkOrder (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrder PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  ProductionTypeCode INT NULL,
  WOTypeCode INT NOT NULL,
  ProductionLineId BIGINT NULL,
  IsProductionByOrder BIT NULL,
  CustomerPartyId BIGINT NULL,
  RoutingMethodCode INT NULL,
  RoutingId BIGINT NULL,
  ProductStructureTypeCode INT NULL,
  ProductStructureId BIGINT NULL,
  RevisionId BIGINT NULL,
  MainProductId BIGINT NULL,
  ProductExtraInfo NVARCHAR(400) NULL,
  MeasureUnitId BIGINT NULL,
  Quantity DECIMAL(32,6) NULL,
  YieldPercent DECIMAL(9,4) NULL,
  ActualYieldPercent DECIMAL(9,4) NULL,
  ProductSerialPatternId BIGINT NULL,
  FirstCounterDigit INT NULL,
  LastCounterDigit INT NULL,
  QCOrderId BIGINT NULL,
  BatchId BIGINT NULL,
  DeliverToInventoryId BIGINT NULL,
  RefWorkOrderId BIGINT NULL,
  FirmDate DATETIME2 NULL,
  PlannedReleaseDate DATETIME2 NULL,
  ActualReleaseDate DATETIME2 NULL,
  PlannedCompleteDate DATETIME2 NULL,
  ActualCompleteDate DATETIME2 NULL,
  CloseDate DATETIME2 NULL,
  WorkOrderPriorityCode INT NULL,
  WorkOrderStatusCode INT NOT NULL,
  WorkOrderBookmark NVARCHAR(256) NULL,
  WorkflowFactor INT NULL,
  Description NVARCHAR(400) NULL,
  ReferenceObjectNumber NVARCHAR(64) NULL,
  ReferenceDescription NVARCHAR(400) NULL,
  ManufacturingDate DATETIME2 NULL,
  ProductionStartDate DATETIME2 NULL,
  NotCompletedProductionQuantity DECIMAL(32,6) NULL,
  ManufacturingVersionId BIGINT NULL,
  VersionSelectionNote NVARCHAR(400) NULL,
  IsVersionOverridden BIT NOT NULL CONSTRAINT DF_mes_WO_Override DEFAULT (0),
  VersionOverrideReason NVARCHAR(400) NULL,
  BasisCode INT NULL,
  BatchNumber NVARCHAR(64) NULL,
  WorkingShiftId BIGINT NULL,
  ShiftDate DATE NULL,
  DueDate DATETIME2 NULL,
  CustomerTitle NVARCHAR(256) NULL,
  ConfigurationText NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.WorkOrderProduct','U') IS NULL
CREATE TABLE mes.WorkOrderProduct (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderProduct PRIMARY KEY,
  WorkOrderId BIGINT NOT NULL,
  ProductStructureId BIGINT NOT NULL,
  RevisionId BIGINT NULL,
  ProductId BIGINT NOT NULL,
  BatchId BIGINT NULL,
  ProductExtraInfo NVARCHAR(400) NULL,
  QuantityTypeCode INT NOT NULL,
  Quantity DECIMAL(32,6) NULL,
  MeasureUnitId BIGINT NULL,
  YieldPercent DECIMAL(9,4) NULL,
  ActualYieldPercent DECIMAL(9,4) NULL,
  Description NVARCHAR(400) NULL,
  OutputTypeCode INT NULL
);

IF OBJECT_ID('mes.WorkOrderOperation','U') IS NULL
CREATE TABLE mes.WorkOrderOperation (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperation PRIMARY KEY,
  WorkOrderId BIGINT NOT NULL,
  Sequence INT NOT NULL,
  OperationId BIGINT NOT NULL,
  ResultStatusCode INT NULL,
  WorkOrderOperationStatusCode INT NOT NULL,
  IsOutsourced BIT NOT NULL CONSTRAINT DF_mes_WOO_Outsourced DEFAULT (0),
  OutsourceTypeCode INT NULL,
  WorkCenterId BIGINT NULL,
  CountPointId BIGINT NULL,
  MainOutputProductId BIGINT NULL,
  MeasureUnitId BIGINT NULL,
  StartTime DATETIME2 NULL,
  EndTime DATETIME2 NULL,
  Duration INT NULL,
  ToCompleteQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOO_ToComplete DEFAULT (0),
  ReceivedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOO_Received DEFAULT (0),
  InProcessQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOO_InProcess DEFAULT (0),
  CompletedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOO_Completed DEFAULT (0),
  WastedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOO_Wasted DEFAULT (0),
  PendingQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOO_Pending DEFAULT (0),
  ReworkQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOO_Rework DEFAULT (0),
  ReworkCompletedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOO_ReworkCompleted DEFAULT (0),
  ReworkWastedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOO_ReworkWasted DEFAULT (0),
  TransferredQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOO_Transferred DEFAULT (0),
  YieldPercent DECIMAL(9,4) NULL,
  ActualYieldPercent DECIMAL(9,4) NULL,
  MainOutputBatchId BIGINT NULL,
  MainOutputInventoryId BIGINT NULL,
  StartTimeShiftId BIGINT NULL,
  CompleteTimeShiftId BIGINT NULL,
  Description NVARCHAR(400) NULL,
  PlanStartTime DATETIME2 NULL,
  PlanEndTime DATETIME2 NULL,
  RoutingOperationId BIGINT NULL,
  ResourceGroupId BIGINT NULL
);

IF OBJECT_ID('mes.WorkOrderOperationMaterial','U') IS NULL
CREATE TABLE mes.WorkOrderOperationMaterial (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationMaterial PRIMARY KEY,
  WOOperationId BIGINT NOT NULL,
  RefWorkOrderId BIGINT NULL,
  RefWOOperationId BIGINT NULL,
  RefWOOperationMaterialId BIGINT NULL,
  ItemSubReferenceNumber NVARCHAR(64) NULL,
  ParentId BIGINT NULL,
  ProductId BIGINT NOT NULL,
  EquipmentId BIGINT NULL,
  PlannedKitCompleteDate DATETIME2 NULL,
  ActualKitCompleteDate DATETIME2 NULL,
  PlannedActiveKitQuantity DECIMAL(32,6) NULL,
  ActiveMeasureUnitId BIGINT NULL,
  PlannedKitQuantity DECIMAL(32,6) NULL,
  ActualKitQuantity DECIMAL(32,6) NULL,
  MeasureUnitId BIGINT NULL,
  BatchId BIGINT NULL,
  Potency DECIMAL(9,4) NULL,
  UnallocatedQuantity DECIMAL(32,6) NULL,
  RoundedQuantity DECIMAL(32,6) NULL,
  InventoryId BIGINT NULL,
  ConsumedQuantity DECIMAL(32,6) NULL,
  PLCResult DECIMAL(32,6) NULL,
  RemainedQuantity DECIMAL(32,6) NULL,
  ShortageQuantity DECIMAL(32,6) NULL,
  ReturnedQuantity DECIMAL(32,6) NULL,
  WasteReturnedQuantity DECIMAL(32,6) NULL,
  RepairReturnedQuantity DECIMAL(32,6) NULL,
  ReceivedFromInvQuantity DECIMAL(32,6) NULL,
  RemainedFromInvQuantity DECIMAL(32,6) NULL,
  ProductSerialId BIGINT NULL,
  IsQuantumSatis BIT NULL,
  IsCustomerMaterial BIT NULL,
  KanbanId BIGINT NULL,
  StartTime DATETIME2 NULL,
  EndTime DATETIME2 NULL,
  Duration INT NULL,
  WorkOrderOperationMaterialStatusCode INT NOT NULL,
  Description NVARCHAR(400) NULL,
  IsDeletable BIT NOT NULL CONSTRAINT DF_mes_WOOM_Deletable DEFAULT (1),
  ToleranceForReceive DECIMAL(9,4) NULL,
  AllocatedQuantityTolerance DECIMAL(32,6) NULL,
  ProductionMaterialTypeCode INT NULL,
  ToleranceForReturn DECIMAL(9,4) NULL,
  AllocatedToleranceForReturn DECIMAL(32,6) NULL,
  ExcessReasonId BIGINT NULL,
  ExcessQuantity DECIMAL(32,6) NULL,
  SubstitutedProductId BIGINT NULL,
  ReprocessId BIGINT NULL,
  IsReprocess BIT NULL,
  ProductStructureItemId BIGINT NULL,
  StandardQuantity DECIMAL(32,6) NULL,
  BatchNumber NVARCHAR(64) NULL,
  IsRecoveredMaterial BIT NOT NULL CONSTRAINT DF_mes_WOOM_Recovered DEFAULT (0)
);

IF OBJECT_ID('mes.WorkOrderReasonCancel','U') IS NULL
CREATE TABLE mes.WorkOrderReasonCancel (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderReasonCancel PRIMARY KEY,
  ReasonCancelId BIGINT NULL,
  InventoryDocumentHeaderId BIGINT NULL,
  ReferenceObjectId BIGINT NOT NULL,
  ReferenceEntityName NVARCHAR(128) NOT NULL,
  InventoryDocumentHeaderNumber NVARCHAR(64) NULL,
  PermitHeaderNumber NVARCHAR(64) NULL,
  Description NVARCHAR(400) NULL,
  CancelDate DATETIME2 NULL,
  CancelReasonTitle NVARCHAR(256) NULL,
  MaterialDispositionCode INT NULL,
  WorkDispositionCode INT NULL
);

IF OBJECT_ID('mes.WorkOrderChangeLog','U') IS NULL
CREATE TABLE mes.WorkOrderChangeLog (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderChangeLog PRIMARY KEY,
  WorkOrderId BIGINT NOT NULL,
  ChangeDate DATETIME2 NOT NULL,
  FieldTitle NVARCHAR(128) NOT NULL,
  OldValue NVARCHAR(256) NULL,
  NewValue NVARCHAR(256) NULL,
  StatusCode INT NOT NULL CONSTRAINT DF_mes_WOCL_Status DEFAULT (1),
  RequestedByTitle NVARCHAR(256) NULL,
  ApprovedByTitle NVARCHAR(256) NULL,
  Reason NVARCHAR(400) NULL,
  RecalculationNote NVARCHAR(400) NULL
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

/* فهرست دستورها با پیشرفت (خروجی آخرین عملیات مسیر اصلی)، نسخه، والد و درخواست‌ها */
CREATE OR ALTER PROCEDURE mes.GetWorkOrders
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number, w.Name, w.WOTypeCode, w.WorkOrderStatusCode AS StatusCode, w.WorkOrderPriorityCode AS PriorityCode,
         w.BasisCode, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, w.Quantity,
         CAST(w.ProductionLineId AS INT) AS LineId, l.Name AS LineTitle, CAST(w.ManufacturingVersionId AS INT) AS VersionId, v.Number AS VersionCode,
         w.VersionSelectionNote, w.IsVersionOverridden, w.VersionOverrideReason, CAST(w.RoutingId AS INT) AS RoutingId, r.Number + N' ' + rv.Number AS RoutingCode,
         s.Number AS StructureCode, w.BatchNumber, w.PlannedReleaseDate, w.ActualReleaseDate, w.PlannedCompleteDate, w.ActualCompleteDate, w.CloseDate,
         w.DueDate, w.ShiftDate, sh.Number + N' — ' + sh.Name AS ShiftTitle, CAST(w.WorkingShiftId AS INT) AS ShiftId,
         CAST(w.RefWorkOrderId AS INT) AS RefWorkOrderId, ref.Number AS RefWorkOrderNumber, w.CustomerTitle, w.ConfigurationText, w.ReferenceObjectNumber, w.Description,
         (SELECT TOP (1) o.CompletedQuantity FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0 ORDER BY o.Sequence DESC) AS LastOpCompleted,
         (SELECT SUM(o.WastedQuantity) FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) AS WastedTotal,
         (SELECT COUNT(*) FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) AS OperationCount,
         (SELECT COUNT(*) FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode = 5) AS OperationsDone,
         (SELECT TOP (1) op.Name FROM mes.WorkOrderOperation o JOIN mes.ProductionOperation op ON op.Id = o.OperationId
           WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode IN (3, 4, 6) ORDER BY o.Sequence) AS CurrentOperation,
         (SELECT STRING_AGG(pr.Number, N'، ') FROM mes.ProductionRequestWorkOrder k JOIN mes.ProductionRequest pr ON pr.Id = k.ProductionRequestId
           WHERE k.WorkOrderId = w.Id AND k.IsDeleted = 0) AS Requests
  FROM mes.WorkOrder w
  LEFT JOIN mes.Product p ON p.Id = w.MainProductId
  LEFT JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
  LEFT JOIN mes.ManufacturingVersion v ON v.Id = w.ManufacturingVersionId
  LEFT JOIN mes.RoutingMaster r ON r.Id = w.RoutingId
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  LEFT JOIN mes.ProductStructure s ON s.Id = w.ProductStructureId
  LEFT JOIN mes.ProductionWorkingShift sh ON sh.Id = w.WorkingShiftId
  LEFT JOIN mes.WorkOrder ref ON ref.Id = w.RefWorkOrderId
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0
  ORDER BY w.Number DESC;
END
GO

/* عملیات دستورها با زمان استاندارد (ME-03) برای محاسبه‌ی معکوس از تاریخ تحویل */
CREATE OR ALTER PROCEDURE mes.GetWorkOrderOperations
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.WorkOrderId AS INT) AS WorkOrderId, CAST(o.Id AS INT) AS WOOperationId, o.Sequence, op.Number AS OperationCode, op.Name AS OperationTitle,
         op.OperationTypeCode AS NatureCode, o.WorkOrderOperationStatusCode AS StatusCode, o.IsOutsourced,
         COALESCE(rg.Number + N' — ' + rg.Name, wc.Number + N' — ' + wc.Name) AS ResourceTitle,
         o.ToCompleteQuantity, o.ReceivedQuantity, o.InProcessQuantity, o.CompletedQuantity, o.WastedQuantity, o.ReworkQuantity, o.TransferredQuantity,
         o.YieldPercent, o.ActualYieldPercent, o.StartTime, o.EndTime, o.PlanStartTime, o.PlanEndTime, o.Description,
         CAST(ISNULL(t.SetupTimePerBatch, 0) + ISNULL(t.TeardownTimePerBatch, 0) + ISNULL(t.WaitTimePerBatch, 0) + ISNULL(t.MoveTimePerBatch, 0) + ISNULL(t.QueueTimePerBatch, 0)
              + o.ToCompleteQuantity * CASE WHEN o.IsOutsourced = 1 THEN ISNULL(t.OutsourceTimePerPart, 0)
                                            ELSE IIF(ISNULL(t.EquipmentRunTimePerPart, 0) > ISNULL(t.LaborRunTimePerPart, 0), ISNULL(t.EquipmentRunTimePerPart, 0), ISNULL(t.LaborRunTimePerPart, 0)) END
              AS DECIMAL(18,2)) AS StdMinutes
  FROM mes.WorkOrderOperation o
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.WorkCenter wc ON wc.Id = o.WorkCenterId
  LEFT JOIN mes.ResourceGroup rg ON rg.Id = o.ResourceGroupId
  LEFT JOIN mes.RoutingOperationTiming t ON t.RoutingOperationId = o.RoutingOperationId AND t.IsDeleted = 0
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0
  ORDER BY o.WorkOrderId, o.Sequence;
END
GO

/* مواد دستورها با تفکیک موجود / رزروشده / در راه / کسری (F-PC-014) */
CREATE OR ALTER PROCEDURE mes.GetWorkOrderMaterials
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.WorkOrderId AS INT) AS WorkOrderId, CAST(m.Id AS INT) AS MaterialId, CAST(o.Id AS INT) AS WOOperationId, o.Sequence AS OperationSequence,
         CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, p.ProductGroupTitle,
         m.StandardQuantity, m.PlannedKitQuantity, m.ActualKitQuantity, m.ConsumedQuantity, m.ReturnedQuantity, m.ExcessQuantity, m.ShortageQuantity,
         m.WorkOrderOperationMaterialStatusCode AS StatusCode, m.BatchNumber, m.Potency, m.IsCustomerMaterial, m.IsRecoveredMaterial, m.IsQuantumSatis,
         CAST(m.SubstitutedProductId AS INT) AS SubstitutedProductId, sp.Number + N' — ' + sp.Name AS SubstitutedTitle, m.Description,
         ISNULL(st.Available, 0) AS StockAvailable, ISNULL(st.Reserved, 0) AS StockReserved, ISNULL(st.InTransit, 0) AS StockInTransit, st.NextArrival
  FROM mes.WorkOrderOperationMaterial m
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.Product p ON p.Id = m.ProductId
  LEFT JOIN mes.Product sp ON sp.Id = m.SubstitutedProductId
  OUTER APPLY (SELECT SUM(CASE WHEN s.InventoryKindCode IN (1, 2) AND s.QcStatusCode = 1 THEN s.OnHandQuantity - s.ReservedQuantity ELSE 0 END) AS Available,
                      SUM(CASE WHEN s.InventoryKindCode IN (1, 2) THEN s.ReservedQuantity ELSE 0 END) AS Reserved,
                      SUM(CASE WHEN s.InventoryKindCode = 6 THEN s.OnHandQuantity ELSE 0 END) AS InTransit,
                      MIN(CASE WHEN s.InventoryKindCode = 6 THEN s.ExpectedArrivalDate END) AS NextArrival
               FROM mes.MaterialStock s WHERE s.ProductId = m.ProductId AND s.IsDeleted = 0 AND s.IsCustomerOwned = ISNULL(m.IsCustomerMaterial, 0)) st
  WHERE m.CompanyId = @CompanyId AND m.IsDeleted = 0
  ORDER BY o.WorkOrderId, o.Sequence, p.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetWorkOrderProducts
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(x.WorkOrderId AS INT) AS WorkOrderId, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         x.OutputTypeCode, x.Quantity, x.YieldPercent, x.ActualYieldPercent, x.Description
  FROM mes.WorkOrderProduct x JOIN mes.Product p ON p.Id = x.ProductId
  WHERE x.CompanyId = @CompanyId AND x.IsDeleted = 0
  ORDER BY x.WorkOrderId, x.OutputTypeCode;
END
GO

CREATE OR ALTER PROCEDURE mes.GetWorkOrderHistory
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(c.WorkOrderId AS INT) AS WorkOrderId, c.ChangeDate, c.FieldTitle, c.OldValue, c.NewValue, c.StatusCode, c.RequestedByTitle, c.ApprovedByTitle,
         c.Reason, c.RecalculationNote
  FROM mes.WorkOrderChangeLog c WHERE c.CompanyId = @CompanyId AND c.IsDeleted = 0 ORDER BY c.WorkOrderId, c.ChangeDate;

  SELECT CAST(x.ReferenceObjectId AS INT) AS WorkOrderId, x.CancelDate, x.CancelReasonTitle, x.MaterialDispositionCode, x.WorkDispositionCode,
         x.InventoryDocumentHeaderNumber, x.PermitHeaderNumber, x.Description
  FROM mes.WorkOrderReasonCancel x WHERE x.CompanyId = @CompanyId AND x.IsDeleted = 0 AND x.ReferenceEntityName = N'WorkOrder';
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.WorkOrder خالی است.
   عمداً خراب: WO-1405-0512 (R&D) روی نسخه‌ی پیش‌نویس با بازنویسی دستی صادر شده و درخواستش هنوز تأیید نشده؛ تغییر
   مقدار WO-1405-0501 پس از آزادسازی منتظر تأیید است؛ پرس خط ۱ در WO-1405-0501 متوقف است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.WorkOrder)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @D DATETIME2 = '2026-10-09';

  /* ۱) سربرگ دستورها */
  DECLARE @wo TABLE (Number NVARCHAR(64), Name NVARCHAR(256), TypeCode INT, Mv NVARCHAR(64), Rt NVARCHAR(64), Ver NVARCHAR(8), ProductId BIGINT, Qty DECIMAL(32,6),
                     Line BIGINT, Status INT, Pri INT, Basis INT, Batch NVARCHAR(64), RelP DATETIME2, RelA DATETIME2, CmpP DATETIME2, CmpA DATETIME2, CloseD DATETIME2,
                     Due DATETIME2, ShiftNo NVARCHAR(8), RefNo NVARCHAR(64), Customer NVARCHAR(256), Note NVARCHAR(400), Override BIT, OverrideReason NVARCHAR(400), Description NVARCHAR(400));
  INSERT @wo VALUES
    (N'WO-1405-0498', N'قرص ۵۰۰ — بچ ۹۴۱', 1, N'MV-1001-01', N'RT-1001', N'v2', 1001, 300000, 2, 5, 1, 1, N'B-1405-0941', DATEADD(HOUR, -142, @D), DATEADD(HOUR, -142, @D), DATEADD(HOUR, -100, @D), DATEADD(HOUR, -102, @D), DATEADD(HOUR, -70, @D), DATEADD(DAY, -2, @D), NULL, NULL, N'پخش البرز', N'تنها نسخه‌ی واجد شرایط', 0, NULL, NULL),
    (N'WO-1405-0499', N'محلول روکش — بچ ۴۴', 1, N'MV-2003-01', N'RT-2003', N'v1', 2003, 50, 2, 4, 1, 4, N'SOL-1405-044', DATEADD(HOUR, -26, @D), DATEADD(HOUR, -26, @D), DATEADD(HOUR, -21, @D), DATEADD(HOUR, -21, @D), NULL, DATEADD(HOUR, -12, @D), NULL, N'WO-1405-0503', NULL, N'تنها نسخه‌ی واجد شرایط', 0, NULL, N'برای روکش WO-1405-0503'),
    (N'WO-1405-0500', N'گرانول — بچ ۱۲۱', 1, N'MV-2001-01', N'RT-2001', N'v1', 2001, 120, 2, 4, 1, 2, N'GRN-1405-121', DATEADD(HOUR, -40, @D), DATEADD(HOUR, -40, @D), DATEADD(HOUR, -31, @D), DATEADD(HOUR, -31.5, @D), NULL, DATEADD(DAY, -1, @D), NULL, NULL, NULL, N'تنها نسخه‌ی واجد شرایط', 0, NULL, NULL),
    (N'WO-1405-0501', N'قرص ۵۰۰ — بچ ۹۵۲ (فوری)', 1, N'MV-1001-02', N'RT-1001', N'v2', 1001, 600000, 2, 3, 3, 1, N'B-1405-0952', DATEADD(HOUR, -17, @D), DATEADD(HOUR, -17, @D), DATEADD(HOUR, 42, @D), NULL, NULL, DATEADD(DAY, 6, @D), NULL, NULL, N'پخش البرز', N'از ۲ نسخه‌ی واجد، باریک‌ترین بازه‌ی بچ (۵۵۰ تا ۱٬۲۰۰ هزار)', 0, NULL, N'تفکیک‌شده از PR-1405-0310'),
    (N'WO-1405-0502', N'قرص ۵۰۰ — بچ ۹۵۸', 1, N'MV-1001-01', N'RT-1001', N'v2', 1001, 300000, 2, 2, 3, 1, N'B-1405-0958', DATEADD(HOUR, 30, @D), NULL, DATEADD(HOUR, 62, @D), NULL, NULL, DATEADD(DAY, 6, @D), NULL, NULL, N'پخش البرز', N'تنها نسخه‌ی واجد شرایط', 0, NULL, N'تفکیک‌شده از PR-1405-0310؛ گرانول از WO-1405-0504'),
    (N'WO-1405-0503', N'قرص روکش‌دار ۲۵۰ — بچ ۹۳۹', 1, N'MV-1002-01', N'RT-1002', N'v1', 1002, 500000, 2, 3, 1, 1, N'B-1405-0939', DATEADD(HOUR, -96, @D), DATEADD(HOUR, -96, @D), DATEADD(HOUR, 96, @D), NULL, NULL, DATEADD(DAY, 9, @D), NULL, NULL, NULL, N'تنها نسخه‌ی واجد شرایط', 0, NULL, N'روکش نزد پارس‌دارو'),
    (N'WO-1405-0504', N'گرانول — بچ ۱۲۴ (تجمیعی)', 1, N'MV-2001-01', N'RT-2001', N'v1', 2001, 150, 2, 3, 2, 1, N'GRN-1405-124', DATEADD(HOUR, 7, @D), DATEADD(HOUR, 7, @D), DATEADD(HOUR, 16.5, @D), NULL, NULL, DATEADD(HOUR, 30, @D), NULL, N'WO-1405-0502', NULL, N'تنها نسخه‌ی واجد شرایط', 0, NULL, N'تجمیع PR-1405-0312 و PR-1405-0313؛ دستور فرزند WO-1405-0502'),
    (N'WO-1405-0506', N'کارمزدی فارمد — قرص ۵۰۰', 6, N'MV-1001-T', N'RT-TOLL-01', N'v1', 1001, 250000, 1, 3, 2, 3, N'FRM-1405-017', DATEADD(HOUR, -21, @D), DATEADD(HOUR, -21, @D), DATEADD(HOUR, 20, @D), NULL, NULL, DATEADD(DAY, 3, @D), NULL, NULL, N'داروسازی فارمد', N'تنها نسخه‌ی واجد شرایط برای دستور کارمزدی', 0, NULL, N'گرانول و بروشور امانی مشتری'),
    (N'WO-1405-0507', N'گرانول پیوسته — شیفت صبح', 2, N'MV-2001-C', N'RT-2001-C', N'v1', 2001, 900, 2, 3, 1, 2, N'GRC-1405-0717M', DATEADD(HOUR, 6, @D), DATEADD(HOUR, 6, @D), DATEADD(HOUR, 14, @D), NULL, NULL, DATEADD(HOUR, 14, @D), N'SH-M', NULL, NULL, N'نسخه‌ی شیفتی تنها گزینه', 0, NULL, N'۳۸ کیلو موجودی در جریان از شیفت شب قبل'),
    (N'WO-1405-0508', N'گرانول پیوسته — شیفت عصر', 2, N'MV-2001-C', N'RT-2001-C', N'v1', 2001, 940, 2, 2, 1, 2, N'GRC-1405-0717E', DATEADD(HOUR, 14, @D), NULL, DATEADD(HOUR, 22, @D), NULL, NULL, DATEADD(HOUR, 22, @D), N'SH-E', NULL, NULL, N'نسخه‌ی شیفتی تنها گزینه', 0, NULL, NULL),
    (N'WO-1405-0509', N'گرانول پیوسته — شیفت شب', 2, N'MV-2001-C', N'RT-2001-C', N'v1', 2001, 1100, 2, 1, 1, 2, N'GRC-1405-0717N', DATEADD(HOUR, 22, @D), NULL, DATEADD(HOUR, 30, @D), NULL, NULL, DATEADD(HOUR, 30, @D), N'SH-N', NULL, NULL, N'نسخه‌ی شیفتی تنها گزینه', 0, NULL, N'برنامه بالاتر از ظرفیت شیفت'),
    (N'WO-1405-0510', N'دوباره‌کاری بچ ۹۴۱ — بازرسی مجدد', 3, NULL, N'RT-1001', N'v2', 1001, 11400, 2, 2, 2, 4, N'B-1405-0941', DATEADD(HOUR, 13, @D), NULL, DATEADD(HOUR, 18, @D), NULL, NULL, DATEADD(DAY, 1, @D), NULL, N'WO-1405-0498', NULL, NULL, 0, NULL, N'قرص‌های قرنطینه با لکه‌ی سطحی؛ فقط بازرسی و بسته‌بندی'),
    (N'WO-1405-0511', N'بازیافت قرص شکسته به گرانول', 4, NULL, N'RT-2001', N'v1', 2001, 2.9, 2, 1, 1, 4, N'RGR-1405-006', DATEADD(DAY, 1, @D), NULL, DATEADD(HOUR, 30, @D), NULL, NULL, DATEADD(DAY, 3, @D), NULL, N'WO-1405-0501', NULL, NULL, 0, NULL, N'آسیاب مجدد قرص شکسته‌ی پرس (RC-GRN)'),
    (N'WO-1405-0512', N'بچ آزمایشی قرص ۱۰۰۰', 7, N'MV-1005-01', N'RT-1005', N'v1', 1005, 2000, 1, 1, 1, 5, N'RND-1405-003', DATEADD(DAY, 5, @D), NULL, DATEADD(DAY, 6, @D), NULL, NULL, DATEADD(DAY, 20, @D), NULL, NULL, NULL, N'هیچ نسخه‌ی فعالی واجد شرایط نبود', 1, N'نسخه‌ی پیش‌نویس R&D با مجوز مدیر فنی برای بچ پایداری', N'بدون مبنا — درخواست PR-1405-0315 هنوز تأیید نشده'),
    (N'WO-1405-0513', N'قرص ۵۰۰ — خط ۱ (ابطال)', 1, N'MV-1001-01', N'RT-1001', N'v2', 1001, 300000, 2, 6, 1, 1, N'B-1405-0949', DATEADD(HOUR, -50, @D), DATEADD(HOUR, -50, @D), DATEADD(HOUR, -20, @D), NULL, NULL, DATEADD(DAY, 2, @D), NULL, NULL, NULL, N'تنها نسخه‌ی واجد شرایط', 0, NULL, NULL);

  INSERT mes.WorkOrder (CompanyId, Number, Name, ProductionTypeCode, WOTypeCode, ProductionLineId, IsProductionByOrder, RoutingMethodCode, RoutingId, ProductStructureTypeCode,
                        ProductStructureId, RevisionId, MainProductId, Quantity, YieldPercent, RefWorkOrderId, FirmDate, PlannedReleaseDate, ActualReleaseDate,
                        PlannedCompleteDate, ActualCompleteDate, CloseDate, WorkOrderPriorityCode, WorkOrderStatusCode, Description, ReferenceObjectNumber,
                        ManufacturingDate, ProductionStartDate, ManufacturingVersionId, VersionSelectionNote, IsVersionOverridden, VersionOverrideReason, BasisCode,
                        BatchNumber, WorkingShiftId, ShiftDate, DueDate, CustomerTitle)
  SELECT @C, w.Number, w.Name, r.ProductionTypeCode, w.TypeCode, w.Line, CASE WHEN w.TypeCode = 6 THEN 1 ELSE 0 END, r.RoutingMethodCode, r.Id, s.ProductStructureTypeCode,
         s.Id, s.RevisionId, w.ProductId, w.Qty, NULL, NULL, w.RelP, w.RelP, w.RelA, w.CmpP, w.CmpA, w.CloseD, w.Pri, w.Status, w.Description, NULL,
         w.RelA, w.RelA, mv.Id, w.Note, w.Override, w.OverrideReason, w.Basis, w.Batch, sh.Id, CASE WHEN w.ShiftNo IS NOT NULL THEN CAST(@D AS DATE) END, w.Due, w.Customer
  FROM @wo w
  JOIN mes.ProductionRevision rv ON rv.Number = w.Ver
  JOIN mes.RoutingMaster r ON r.Number = w.Rt AND r.VersionId = rv.Id AND r.CompanyId = @C
  LEFT JOIN mes.ManufacturingVersion mv ON mv.Number = w.Mv AND mv.CompanyId = @C
  OUTER APPLY (SELECT TOP (1) ps.Id, ps.RevisionId, ps.ProductStructureTypeCode FROM mes.ProductStructure ps
               WHERE ps.Id = COALESCE(mv.ProductStructureId,
                       (SELECT TOP (1) a.ProductStructureId FROM mes.RoutingProductStructureAssignment a WHERE a.RoutingId = r.Id AND a.IsDeleted = 0 ORDER BY a.Id))) s
  LEFT JOIN mes.ProductionWorkingShift sh ON sh.Number = w.ShiftNo AND sh.CompanyId = @C;

  UPDATE w SET w.RefWorkOrderId = ref.Id
  FROM mes.WorkOrder w JOIN @wo x ON x.Number = w.Number JOIN mes.WorkOrder ref ON ref.Number = x.RefNo AND ref.CompanyId = @C
  WHERE w.CompanyId = @C;

  /* ۲) خروجی‌های دستور از خروجی‌های ساختار نسخه (به نسبت مقدار) */
  INSERT mes.WorkOrderProduct (CompanyId, WorkOrderId, ProductStructureId, RevisionId, ProductId, QuantityTypeCode, Quantity, YieldPercent, OutputTypeCode)
  SELECT @C, w.Id, w.ProductStructureId, w.RevisionId, m.ProductId, 2, CAST(m.Quantity * w.Quantity / NULLIF(base.Quantity, 0) AS DECIMAL(32,6)), m.YieldPercent, m.MasterProductTypeCode
  FROM mes.WorkOrder w
  JOIN mes.ProductStructureMaster m ON m.ProductStructureId = w.ProductStructureId AND m.IsDeleted = 0
  CROSS APPLY (SELECT TOP (1) mm.Quantity FROM mes.ProductStructureMaster mm WHERE mm.ProductStructureId = w.ProductStructureId AND mm.IsMainProduct = 1 AND mm.IsDeleted = 0) base
  WHERE w.CompanyId = @C AND w.WOTypeCode NOT IN (3, 4);

  INSERT mes.WorkOrderProduct (CompanyId, WorkOrderId, ProductStructureId, ProductId, QuantityTypeCode, Quantity, OutputTypeCode, Description)
  SELECT @C, w.Id, w.ProductStructureId, w.MainProductId, 2, w.Quantity, 1, CASE w.WOTypeCode WHEN 3 THEN N'محصول دوباره‌کاری‌شده' ELSE N'گرانول بازیافتی (RC-GRN)' END
  FROM mes.WorkOrder w WHERE w.CompanyId = @C AND w.WOTypeCode IN (3, 4);

  /* ۳) عملیات از روش ساخت؛ دوباره‌کاری و بازیافت فقط زیرمجموعه */
  INSERT mes.WorkOrderOperation (CompanyId, WorkOrderId, Sequence, OperationId, WorkOrderOperationStatusCode, IsOutsourced, WorkCenterId, MainOutputProductId,
                                 ToCompleteQuantity, YieldPercent, RoutingOperationId, ResourceGroupId, PlanStartTime, PlanEndTime)
  SELECT @C, w.Id, ro.Sequence, ro.OperationId, 1, ISNULL(ro.IsOutsourcing, 0), ro.WorkCenterId, w.MainProductId,
         CAST(w.Quantity * ISNULL(ro.AllocationPercent, 100) / 100 AS DECIMAL(32,6)), ro.YieldPercent, ro.Id, ro.ResourceGroupId,
         DATEADD(MINUTE, 90 * (ROW_NUMBER() OVER (PARTITION BY w.Id ORDER BY ro.Sequence) - 1), w.PlannedReleaseDate),
         DATEADD(MINUTE, 90 * ROW_NUMBER() OVER (PARTITION BY w.Id ORDER BY ro.Sequence), w.PlannedReleaseDate)
  FROM mes.WorkOrder w
  JOIN mes.RoutingOperation ro ON ro.RoutingId = w.RoutingId AND ro.IsDeleted = 0
  WHERE w.CompanyId = @C
    AND (w.WOTypeCode NOT IN (3, 4) OR (w.WOTypeCode = 3 AND ro.Sequence IN (50, 60)) OR (w.WOTypeCode = 4 AND ro.Sequence = 10));

  /* ۴) مواد عملیات از تخصیص ME-04، به نسبت مقدار دستور به اندازه‌ی مرجع ساختار */
  INSERT mes.WorkOrderOperationMaterial (CompanyId, WOOperationId, ProductId, PlannedKitQuantity, StandardQuantity, WorkOrderOperationMaterialStatusCode,
                                         IsQuantumSatis, IsCustomerMaterial, ProductStructureItemId, PlannedKitCompleteDate)
  /* ردیف درصدی (QuantityTypeCode = 4): درصدی از مقدار دستور؛ بقیه به نسبت مقدار دستور به اندازه‌ی مرجع */
  SELECT @C, o.Id, rm.ProductId, q.Qty, q.Qty, 1, si.IsQuantumSatis,
         CAST(CASE WHEN w.WOTypeCode = 6 AND EXISTS (SELECT 1 FROM mes.RoutingTollMaterial t WHERE t.RoutingId = w.RoutingId AND t.ProductId = rm.ProductId AND t.OwnershipCode = 1 AND t.IsDeleted = 0) THEN 1 ELSE 0 END AS BIT),
         rm.ProductStructureItemId, DATEADD(HOUR, -2, o.PlanStartTime)
  FROM mes.WorkOrder w
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id
  JOIN mes.RoutingProductStructureAssignment a ON a.RoutingId = w.RoutingId AND a.ProductStructureId = w.ProductStructureId AND a.IsDeleted = 0
  JOIN mes.RoutingOperationMaterial rm ON rm.RoutingOperationId = o.RoutingOperationId AND rm.RoutingProductStructureAssignmentId = a.Id AND rm.IsDeleted = 0
  LEFT JOIN mes.ProductStructureItem si ON si.Id = rm.ProductStructureItemId
  CROSS APPLY (SELECT TOP (1) mm.Quantity FROM mes.ProductStructureMaster mm WHERE mm.ProductStructureId = w.ProductStructureId AND mm.IsMainProduct = 1 AND mm.IsDeleted = 0) base
  CROSS APPLY (SELECT CAST(CASE WHEN si.QuantityTypeCode = 4 THEN w.Quantity * rm.Quantity / 100 * rm.AllocationPercent / 100
                                ELSE rm.Quantity * w.Quantity / NULLIF(base.Quantity, 0) END AS DECIMAL(32,6)) AS Qty) q
  WHERE w.CompanyId = @C AND w.WOTypeCode NOT IN (3, 4);

  /* بازیافت: قرص شکسته‌ی WO-0501 ورودی گرانولاسیون است */
  INSERT mes.WorkOrderOperationMaterial (CompanyId, WOOperationId, ProductId, PlannedKitQuantity, StandardQuantity, WorkOrderOperationMaterialStatusCode, IsReprocess, Description)
  SELECT @C, o.Id, 2007, 2.9, 2.9, 1, 1, N'قرص شکسته‌ی پرس WO-1405-0501'
  FROM mes.WorkOrder w JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id WHERE w.Number = N'WO-1405-0511' AND w.CompanyId = @C;

  /* ۵) وضعیت عملیات در لحظه‌ی سناریو (۱۷ مهر، ۱۱:۳۰) */
  UPDATE o SET o.WorkOrderOperationStatusCode = 5, o.ReceivedQuantity = o.ToCompleteQuantity, o.CompletedQuantity = o.ToCompleteQuantity * ISNULL(o.YieldPercent, 100) / 100,
               o.WastedQuantity = o.ToCompleteQuantity * (100 - ISNULL(o.YieldPercent, 100)) / 100, o.TransferredQuantity = o.ToCompleteQuantity * ISNULL(o.YieldPercent, 100) / 100,
               o.ActualYieldPercent = o.YieldPercent, o.StartTime = o.PlanStartTime, o.EndTime = o.PlanEndTime, o.Duration = 90
  FROM mes.WorkOrderOperation o JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.CompanyId = @C AND w.WorkOrderStatusCode IN (4, 5);

  DECLARE @ops TABLE (Wo NVARCHAR(64), Seq INT, Status INT, Received DECIMAL(32,6), InProc DECIMAL(32,6), Done DECIMAL(32,6), Wasted DECIMAL(32,6), StartAt DATETIME2, EndAt DATETIME2, Note NVARCHAR(400));
  INSERT @ops VALUES
    (N'WO-1405-0501', 10, 5, 600000, 0, 600000, 0, DATEADD(MINUTE, -1020, @D), DATEADD(MINUTE, -930, @D), NULL),
    (N'WO-1405-0501', 15, 5, 600000, 0, 600000, 0, DATEADD(MINUTE, -925, @D), DATEADD(MINUTE, -860, @D), NULL),
    (N'WO-1405-0501', 20, 5, 600000, 0, 600000, 0, DATEADD(MINUTE, -850, @D), DATEADD(MINUTE, -700, @D), NULL),
    (N'WO-1405-0501', 30, 5, 600000, 0, 594000, 6000, DATEADD(MINUTE, -690, @D), DATEADD(MINUTE, 380, @D), N'خشک‌کردن و انتقال به پرس‌ها'),
    (N'WO-1405-0501', 40, 3, 415800, 4200, 268000, 1900, DATEADD(MINUTE, 420, @D), NULL, N'پرس A و B — گروه پرس خط ۲'),
    (N'WO-1405-0501', 45, 4, 178200, 1200, 96500, 640, DATEADD(MINUTE, 430, @D), NULL, N'متوقف از ۱۰:۴۰ — شکستگی پانچ'),
    (N'WO-1405-0501', 50, 3, 300000, 2400, 210000, 520, DATEADD(MINUTE, 480, @D), NULL, N'شروع هم‌پوشان پس از ۵۰٬۰۰۰ قرص'),
    (N'WO-1405-0501', 60, 3, 160000, 10000, 150000, 180, DATEADD(MINUTE, 540, @D), NULL, NULL),
    (N'WO-1405-0503', 10, 6, 500000, 500000, 0, 0, DATEADD(HOUR, -96, @D), NULL, N'نزد پارس‌دارو از ۱۳ مهر'),
    (N'WO-1405-0504', 10, 5, 150, 0, 148.5, 1.5, DATEADD(MINUTE, 420, @D), DATEADD(MINUTE, 490, @D), NULL),
    (N'WO-1405-0504', 20, 3, 148.5, 148.5, 0, 0, DATEADD(MINUTE, 500, @D), NULL, N'خشک‌کن — انتظار ۶۰ دقیقه'),
    (N'WO-1405-0506', 10, 5, 250000, 0, 250000, 0, DATEADD(MINUTE, -1260, @D), DATEADD(MINUTE, -1210, @D), NULL),
    (N'WO-1405-0506', 20, 5, 250000, 0, 250000, 0, DATEADD(MINUTE, -1205, @D), DATEADD(MINUTE, -1110, @D), NULL),
    (N'WO-1405-0506', 30, 5, 250000, 0, 247500, 2500, DATEADD(MINUTE, -1105, @D), DATEADD(MINUTE, -580, @D), NULL),
    (N'WO-1405-0506', 40, 4, 247500, 3000, 140000, 950, DATEADD(MINUTE, -570, @D), DATEADD(MINUTE, -120, @D), N'متوقف از ۲۲:۰۰ دیروز — پرس خط ۱ به دستور فوری WO-1405-0501 داده شد'),
    (N'WO-1405-0507', 10, 3, 668, 22, 646, 4, DATEADD(MINUTE, 360, @D), NULL, N'۳۸ کیلو از شیفت شب'),
    (N'WO-1405-0507', 20, 3, 646, 26, 610, 6.5, DATEADD(MINUTE, 365, @D), NULL, NULL);

  UPDATE o SET o.WorkOrderOperationStatusCode = x.Status, o.ReceivedQuantity = x.Received, o.InProcessQuantity = x.InProc, o.CompletedQuantity = x.Done,
               o.WastedQuantity = x.Wasted, o.TransferredQuantity = x.Done, o.StartTime = x.StartAt, o.EndTime = x.EndAt,
               o.Duration = CASE WHEN x.EndAt IS NOT NULL THEN DATEDIFF(MINUTE, x.StartAt, x.EndAt) END,
               o.ActualYieldPercent = CASE WHEN x.Received > 0 AND x.Status = 5 THEN 100.0 * x.Done / x.Received END, o.Description = x.Note
  FROM mes.WorkOrderOperation o JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId JOIN @ops x ON x.Wo = w.Number AND x.Seq = o.Sequence
  WHERE w.CompanyId = @C;

  /* دستورهای آزادشده: عملیات اول آماده */
  UPDATE o SET o.WorkOrderOperationStatusCode = 2
  FROM mes.WorkOrderOperation o JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.CompanyId = @C AND w.WorkOrderStatusCode = 2
    AND o.Sequence = (SELECT MIN(o2.Sequence) FROM mes.WorkOrderOperation o2 WHERE o2.WorkOrderId = w.Id);

  /* ۶) پیوند درخواست ↔ دستور (تجمیع و تفکیک) */
  INSERT mes.ProductionRequestWorkOrder (CompanyId, ProductionRequestId, WorkOrderId, Quantity, Description)
  SELECT @C, r.Id, w.Id, v.Qty, v.Description
  FROM (VALUES (N'PR-1405-0309', N'WO-1405-0498', 300000.0, NULL),
               (N'PR-1405-0310', N'WO-1405-0501', 600000.0, N'تفکیک ۱ از ۲'),
               (N'PR-1405-0310', N'WO-1405-0502', 300000.0, N'تفکیک ۲ از ۲'),
               (N'PR-1405-0311', N'WO-1405-0503', 500000.0, NULL),
               (N'PR-1405-0312', N'WO-1405-0504', 70.0, N'تجمیع'),
               (N'PR-1405-0313', N'WO-1405-0504', 80.0, N'تجمیع'),
               (N'PR-1405-0314', N'WO-1405-0506', 250000.0, NULL)) v(Rno, Wno, Qty, Description)
  JOIN mes.ProductionRequest r ON r.Number = v.Rno AND r.CompanyId = @C
  JOIN mes.WorkOrder w ON w.Number = v.Wno AND w.CompanyId = @C;

  /* ۷) تغییر پس از آزادسازی و ابطال */
  INSERT mes.WorkOrderChangeLog (CompanyId, WorkOrderId, ChangeDate, FieldTitle, OldValue, NewValue, StatusCode, RequestedByTitle, ApprovedByTitle, Reason, RecalculationNote)
  SELECT @C, w.Id, v.At, v.Field, v.OldV, v.NewV, v.Status, v.ByT, v.Appr, v.Reason, v.Recalc
  FROM (VALUES
    (N'WO-1405-0501', DATEADD(MINUTE, 600, @D), N'مقدار', N'۶۰۰٬۰۰۰', N'۶۵۰٬۰۰۰', 1, N'سرپرست برنامه‌ریزی', NULL, N'افزایش سفارش مناقصه', N'نیاز گرانول +۳۸ کیلو؛ کسری پوویدون ندارد چون گرانول آماده است'),
    (N'WO-1405-0503', DATEADD(HOUR, -100, @D), N'تاریخ تکمیل برنامه‌ای', N'۱۹ مهر', N'۲۱ مهر', 2, N'سرپرست برنامه‌ریزی', N'مدیر تولید', N'زمان تحویل پیمانکار ۷ روز', N'برنامه‌ی بسته‌بندی دو روز جابه‌جا شد'),
    (N'WO-1405-0498', DATEADD(HOUR, -140, @D), N'نسخه‌ی تولید', N'MV-1001-03', N'MV-1001-01', 2, N'سرپرست برنامه‌ریزی', N'مدیر فنی', N'روش خط ۱ منسوخ شد', N'نیاز مواد بدون تغییر؛ زمان‌بندی خط ۲')
  ) v(Wo, At, Field, OldV, NewV, Status, ByT, Appr, Reason, Recalc)
  JOIN mes.WorkOrder w ON w.Number = v.Wo AND w.CompanyId = @C;

  INSERT mes.WorkOrderReasonCancel (CompanyId, ReferenceObjectId, ReferenceEntityName, InventoryDocumentHeaderNumber, PermitHeaderNumber, Description, CancelDate,
                                    CancelReasonTitle, MaterialDispositionCode, WorkDispositionCode)
  SELECT @C, w.Id, N'WorkOrder', N'RTN-1405-0388', NULL, N'مواد کیت‌شده به انبار برگشت؛ عملیاتی انجام نشده بود', DATEADD(HOUR, -46, @D),
         N'تغییر اولویت به سفارش فوری PR-1405-0310', 1, NULL
  FROM mes.WorkOrder w WHERE w.Number = N'WO-1405-0513' AND w.CompanyId = @C;

  COMMIT;
END
GO
