/* =====================================================================
   اسکیمای mes — گام ۳۳: FRM-PC-05 «ترمینال کف کارگاه»

   پیش‌نیاز: mes_frm_pc04، علل توقف و ضایعات (RM-07)، دستورالعمل و پارامتر کتابخانه (ME-01).
   یادداشت ALM: «پارادایم رابط و دستگاه متفاوت — تنها دلیل موجه جدایی از گزارش تولید».

   جدول‌های قدیم با همان نام و همه‌ی فیلدها:
     mes.WorkOrderOperationProblem      همان (ProblemId ← mes.ProductionProblem، مدت، علت توقف بودن، PLCResult) + ReportedByTitle، SourceCode (F-PC-035)
     mes.WorkOrderOperationInstruction  همان (RoutingOperationInstId ← mes.ProductionOperationInstruction، IsControlCheck) + IsDone، DoneAt، DoneByTitle (037)
     mes.PLC، mes.PLCItem، mes.PLCItemData  همان سه جدول PLC نسخه‌ی قبل؛ PLCItemData + UserValue و DeviationNote برای «داده‌ی دستگاه
                                        پیشنهاد می‌دهد، کاربر تأیید می‌کند» و انحراف دستگاه از ورودی کاربر (038، 039). SiteId این‌جا NULL پذیر.
   جدید:
     mes.WorkOrderOperationParameterReading  خوانش پارامتر فرایندی (ME-01) با خروج از محدوده (036)
     mes.ShopFloorTerminal                   ترمینال لمسی هر ایستگاه: آنلاین/آفلاین، رکوردهای در صف همگام‌سازی، حالت پذیرش خودکار داده‌ی
                                             دستگاه و آستانه‌ی انحراف (040، 038، 039)
   ضایعات سطح عملیات با علت درختی و تفکیک راه‌اندازی/فرایند (070، 071) همان mes.WorkOrderOperationOutputWaste گام PC-04 است.

   فرض‌ها و کدهای موقت:
     PLCItemTypeCode      1 = شمارنده‌ی تولید، 2 = کنتور انرژی، 3 = پارامتر فرایند، 4 = وضعیت توقف
     Reading SourceCode   1 = دستی، 2 = PLC/حسگر

   فاز اول فقط‌خواندنی است؛ دکمه‌های ترمینال پیش‌نمایش‌اند و چیزی ثبت نمی‌کنند. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.WorkOrderOperationProblem','U') IS NULL
CREATE TABLE mes.WorkOrderOperationProblem (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationProblem PRIMARY KEY,
  WOOperationId BIGINT NOT NULL,
  ProblemId BIGINT NOT NULL,
  IsStoppageCause BIT NULL,
  StoppageDuration INT NULL,
  StartTimeShiftId BIGINT NULL,
  CompleteTimeShiftId BIGINT NULL,
  StartTime DATETIME2 NULL,
  EndTime DATETIME2 NULL,
  Duration INT NULL,
  PLCResult BIGINT NULL,
  ProblemDescription NVARCHAR(400) NULL,
  ProductSerialId BIGINT NULL,
  EquipmentId BIGINT NULL,
  ReportedByTitle NVARCHAR(256) NULL,
  SourceCode INT NOT NULL CONSTRAINT DF_mes_WOOP_Source DEFAULT (2)
);

IF OBJECT_ID('mes.WorkOrderOperationInstruction','U') IS NULL
CREATE TABLE mes.WorkOrderOperationInstruction (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationInstruction PRIMARY KEY,
  WOOperationId BIGINT NOT NULL,
  RoutingOperationInstId BIGINT NULL,
  Sequence INT NOT NULL,
  IsControlCheck BIT NOT NULL CONSTRAINT DF_mes_WOOI_Check DEFAULT (0),
  Description NVARCHAR(400) NULL,
  IsDone BIT NOT NULL CONSTRAINT DF_mes_WOOI_Done DEFAULT (0),
  DoneAt DATETIME2 NULL,
  DoneByTitle NVARCHAR(256) NULL
);

IF OBJECT_ID('mes.WorkOrderOperationParameterReading','U') IS NULL
CREATE TABLE mes.WorkOrderOperationParameterReading (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationParameterReading PRIMARY KEY,
  WOOperationId BIGINT NOT NULL,
  ProductionOperationParameterId BIGINT NOT NULL,
  ReadAt DATETIME2 NOT NULL,
  Value DECIMAL(32,6) NOT NULL,
  SourceCode INT NOT NULL CONSTRAINT DF_mes_WOOPR_Source DEFAULT (1),
  IsOutOfRange BIT NOT NULL CONSTRAINT DF_mes_WOOPR_Out DEFAULT (0),
  Comment NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.PLC','U') IS NULL
CREATE TABLE mes.PLC (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_PLC PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  LatinName NVARCHAR(256) NULL,
  Model NVARCHAR(128) NULL,
  SiteId BIGINT NULL,
  ProductionLineId BIGINT NULL,
  PlantId BIGINT NULL,
  TruncateDataDuration INT NULL,
  IsActive BIT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.PLCItem','U') IS NULL
CREATE TABLE mes.PLCItem (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_PLCItem PRIMARY KEY,
  PLCId BIGINT NOT NULL,
  EquipmentId BIGINT NULL,
  ReferenceEntityFullName NVARCHAR(256) NOT NULL,
  ReferenceObjectId BIGINT NOT NULL,
  ReferenceParentObject NVARCHAR(256) NULL,
  ReferenceObjectNumber NVARCHAR(64) NULL,
  ReferenceObjectIdName NVARCHAR(256) NULL,
  TargetEntityFullName NVARCHAR(256) NOT NULL,
  PLCItemTypeCode INT NULL,
  PLCItemTag NVARCHAR(128) NULL,
  TruncateDataDuration INT NOT NULL CONSTRAINT DF_mes_PLCItem_Truncate DEFAULT (30),
  ReadDataInterval INT NOT NULL CONSTRAINT DF_mes_PLCItem_Interval DEFAULT (60),
  ItemFlag BIT NOT NULL CONSTRAINT DF_mes_PLCItem_Flag DEFAULT (0),
  IsActive BIT NOT NULL CONSTRAINT DF_mes_PLCItem_IsActive DEFAULT (1),
  Description NVARCHAR(400) NULL,
  NewPLCItemTag NVARCHAR(128) NULL,
  NodeName NVARCHAR(128) NULL,
  TargetEntityTypeCode INT NULL
);

IF OBJECT_ID('mes.PLCItemData','U') IS NULL
CREATE TABLE mes.PLCItemData (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_PLCItemData PRIMARY KEY,
  PLCItemId BIGINT NOT NULL,
  RefMainNumber NVARCHAR(64) NULL,
  RefMainId BIGINT NULL,
  RefRelatedNumber NVARCHAR(64) NULL,
  Result REAL NULL,
  ReadStartDateTime DATETIME NOT NULL,
  ReadEndDateTime DATETIME NULL,
  IsApplied BIT NULL,
  UpdatedRefObjectId BIGINT NULL,
  Description NVARCHAR(400) NULL,
  WorkOrderId BIGINT NULL,
  UserValue DECIMAL(32,6) NULL,
  DeviationNote NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ShopFloorTerminal','U') IS NULL
CREATE TABLE mes.ShopFloorTerminal (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ShopFloorTerminal PRIMARY KEY,
  Number NVARCHAR(64) NOT NULL,
  Name NVARCHAR(256) NOT NULL,
  ProductionLineId BIGINT NULL,
  WorkCenterId BIGINT NULL,
  ResourceGroupId BIGINT NULL,
  IsOnline BIT NOT NULL CONSTRAINT DF_mes_SFT_Online DEFAULT (1),
  LastSyncAt DATETIME2 NULL,
  PendingRecords INT NOT NULL CONSTRAINT DF_mes_SFT_Pending DEFAULT (0),
  AutoAcceptDeviceData BIT NOT NULL CONSTRAINT DF_mes_SFT_Auto DEFAULT (0),
  DeviationThresholdPercent DECIMAL(9,4) NULL,
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

CREATE OR ALTER PROCEDURE mes.GetTerminals
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(t.Id AS INT) AS TerminalId, t.Number, t.Name, l.Name AS LineTitle, CAST(t.WorkCenterId AS INT) AS WorkCenterId, CAST(t.ResourceGroupId AS INT) AS ResourceGroupId,
         COALESCE(rg.Number + N' — ' + rg.Name, wc.Number + N' — ' + wc.Name) AS StationTitle, t.IsOnline, t.LastSyncAt, t.PendingRecords,
         t.AutoAcceptDeviceData, t.DeviationThresholdPercent, t.Description
  FROM mes.ShopFloorTerminal t
  LEFT JOIN mes.ProductionLine l ON l.Id = t.ProductionLineId
  LEFT JOIN mes.WorkCenter wc ON wc.Id = t.WorkCenterId
  LEFT JOIN mes.ResourceGroup rg ON rg.Id = t.ResourceGroupId
  WHERE t.CompanyId = @CompanyId AND t.IsDeleted = 0
  ORDER BY t.Number;
END
GO

/* کارتابل اپراتور: عملیات دستورهای باز روی ایستگاه/گروه هر ترمینال، به ترتیب اولویت و زمان برنامه */
CREATE OR ALTER PROCEDURE mes.GetTerminalQueue
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(t.Id AS INT) AS TerminalId, CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.WorkOrderPriorityCode AS PriorityCode, w.BatchNumber,
         p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, CAST(o.Id AS INT) AS WOOperationId, o.Sequence, op.Number AS OperationCode,
         op.Name AS OperationTitle, CAST(o.OperationId AS INT) AS OperationId, o.WorkOrderOperationStatusCode AS StatusCode, o.ToCompleteQuantity, o.ReceivedQuantity,
         o.CompletedQuantity, o.WastedQuantity, o.StartTime, o.PlanStartTime, o.PlanEndTime, o.Description,
         (SELECT TOP (1) t2.EquipmentRunTimePerPart FROM mes.RoutingOperationTiming t2 WHERE t2.RoutingOperationId = o.RoutingOperationId AND t2.IsDeleted = 0) AS StdMinutesPerUnit
  FROM mes.ShopFloorTerminal t
  JOIN mes.WorkOrderOperation o ON o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode IN (2, 3, 4)
       AND ((t.ResourceGroupId IS NOT NULL AND o.ResourceGroupId = t.ResourceGroupId) OR (t.WorkCenterId IS NOT NULL AND o.WorkCenterId = t.WorkCenterId))
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId AND w.WorkOrderStatusCode IN (2, 3)
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.Product p ON p.Id = w.MainProductId
  WHERE t.CompanyId = @CompanyId AND t.IsDeleted = 0
  ORDER BY t.Id, CASE o.WorkOrderOperationStatusCode WHEN 3 THEN 0 WHEN 4 THEN 1 ELSE 2 END, w.WorkOrderPriorityCode DESC, o.PlanStartTime;
END
GO

CREATE OR ALTER PROCEDURE mes.GetOperationStoppages
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(x.WOOperationId AS INT) AS WOOperationId, CAST(o.WorkOrderId AS INT) AS WorkOrderId, pr.Number AS ProblemCode, pr.Name AS ProblemTitle,
         g.Name AS GroupTitle, pr.ProblemTypeCode, pr.OeeLossCode, ol.Name AS OeeLossTitle, ol.OeeComponentCode, pr.IsExcludedFromOee, x.IsStoppageCause,
         x.StartTime, x.EndTime, ISNULL(x.Duration, DATEDIFF(MINUTE, x.StartTime, mes.fnShopNow())) AS Minutes,
         CAST(CASE WHEN x.EndTime IS NULL THEN 1 ELSE 0 END AS BIT) AS IsActive, x.ProblemDescription, x.ReportedByTitle, x.SourceCode, e.Number + N' ' + e.Name AS EquipmentTitle
  FROM mes.WorkOrderOperationProblem x
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.ProductionProblem pr ON pr.Id = x.ProblemId
  LEFT JOIN mes.ProductionProblemGroup g ON g.Id = pr.ProblemGroupId
  LEFT JOIN mes.OeeLoss ol ON ol.Code = pr.OeeLossCode AND ol.CompanyId = pr.CompanyId
  LEFT JOIN mes.Equipment e ON e.Id = x.EquipmentId
  WHERE x.CompanyId = @CompanyId AND x.IsDeleted = 0
  ORDER BY x.StartTime;
END
GO

CREATE OR ALTER PROCEDURE mes.GetParameterReadings
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(r.WOOperationId AS INT) AS WOOperationId, CAST(pp.Id AS INT) AS ParameterId, pp.Name AS ParameterTitle, pp.UnitTitle, pp.TargetValue, pp.MinValue, pp.MaxValue,
         pp.IsCritical, pp.OutOfRangeActionCode, r.ReadAt, r.Value, r.SourceCode, r.IsOutOfRange, r.Comment
  FROM mes.WorkOrderOperationParameterReading r
  JOIN mes.ProductionOperationParameter pp ON pp.Id = r.ProductionOperationParameterId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
  ORDER BY r.WOOperationId, pp.Sequence, r.ReadAt;
END
GO

CREATE OR ALTER PROCEDURE mes.GetOperationChecklist
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(x.WOOperationId AS INT) AS WOOperationId, x.Sequence, x.IsControlCheck, x.Description, x.IsDone, x.DoneAt, x.DoneByTitle,
         i.DocumentNumber, i.Title AS InstructionTitle, i.RevisionNo, i.MediaTypeCode, i.FileName, i.InstructionDescription, i.NeededTools, i.NeededUniforms
  FROM mes.WorkOrderOperationInstruction x
  LEFT JOIN mes.ProductionOperationInstruction i ON i.Id = x.RoutingOperationInstId
  WHERE x.CompanyId = @CompanyId AND x.IsDeleted = 0
  ORDER BY x.WOOperationId, x.Sequence;
END
GO

/* داده‌ی دستگاه در برابر ورودی کاربر (F-PC-038، 039) */
CREATE OR ALTER PROCEDURE mes.GetDeviceData
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(d.Id AS INT) AS DataId, CAST(i.Id AS INT) AS ItemId, pl.Number AS PlcCode, pl.Name AS PlcTitle, i.PLCItemTag, i.PLCItemTypeCode, i.Description AS ItemTitle,
         e.Number + N' ' + e.Name AS EquipmentTitle, CAST(d.WorkOrderId AS INT) AS WorkOrderId, d.RefMainNumber, d.RefRelatedNumber, d.Result, d.UserValue,
         d.ReadStartDateTime, d.ReadEndDateTime, d.IsApplied, d.DeviationNote,
         CAST(CASE WHEN d.UserValue IS NOT NULL AND d.Result <> 0 THEN 100.0 * ABS(d.Result - d.UserValue) / ABS(d.Result) END AS DECIMAL(9,2)) AS DeviationPercent
  FROM mes.PLCItemData d
  JOIN mes.PLCItem i ON i.Id = d.PLCItemId
  JOIN mes.PLC pl ON pl.Id = i.PLCId
  LEFT JOIN mes.Equipment e ON e.Id = i.EquipmentId
  WHERE d.CompanyId = @CompanyId AND d.IsDeleted = 0
  ORDER BY d.ReadStartDateTime DESC;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.ShopFloorTerminal خالی است.
   عمداً خراب: پرس خط ۱ از ۱۰:۴۰ با شکستگی پانچ متوقف است و ترمینالش آفلاین با ۳ رکورد در صف؛ وزن قرص ساعت ۹:۳۰ بالاتر
   از حد (۶۳۳ در برابر ۶۳۰) و دمای سیل بلیستر ۱۰:۱۰ بیرون از محدوده؛ شمارنده‌ی پرس A ۱٫۶٪ با ورودی اپراتور فرق دارد و
   توضیح ندارد؛ چک‌لیست «تطبیق شماره‌ی پانچ» برای پرس خط ۱ انجام نشده.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ShopFloorTerminal)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @D DATETIME2 = '2026-10-09';
  DECLARE @now DATETIME2 = mes.fnShopNow();

  INSERT mes.ShopFloorTerminal (CompanyId, Number, Name, ProductionLineId, WorkCenterId, ResourceGroupId, IsOnline, LastSyncAt, PendingRecords, AutoAcceptDeviceData, DeviationThresholdPercent, Description)
  SELECT @C, v.Number, v.Name, v.Line, w.Id, rg.Id, v.Online, DATEADD(MINUTE, v.SyncMin, @D), v.Pending, v.Auto, v.Thr, v.Description
  FROM (VALUES
    (N'TRM-L2-PRS', N'ترمینال پرس‌های خط ۲', 2, NULL, N'POOL-PRESS', 1, 689, 0, 0, 1.0, NULL),
    (N'TRM-L1-PRS', N'ترمینال پرس خط ۱', 1, N'30', NULL, 0, 652, 3, 0, 1.0, N'قطع شبکه از ۱۰:۵۲ — کار آفلاین'),
    (N'TRM-L2-INS', N'ترمینال بازرسی خط ۲', 2, N'25', NULL, 1, 690, 0, 0, NULL, NULL),
    (N'TRM-L2-PKG', N'ترمینال بسته‌بندی خط ۲', 2, N'50', NULL, 1, 688, 0, 1, 2.0, N'شمارنده‌ی بلیستر خودکار پذیرفته می‌شود'),
    (N'TRM-L2-GRN', N'ترمینال گرانولاسیون خط ۲', 2, N'20', NULL, 1, 687, 0, 0, NULL, NULL),
    (N'TRM-L2-MIX', N'ترمینال میکسرها', 2, NULL, N'POOL-MIX', 1, 690, 0, 0, NULL, NULL)
  ) v(Number, Name, Line, StationNo, GroupNo, Online, SyncMin, Pending, Auto, Thr, Description)
  LEFT JOIN mes.WorkCenter w ON w.Number = v.StationNo AND w.ProductionLineId = v.Line AND w.CompanyId = @C
  LEFT JOIN mes.ResourceGroup rg ON rg.Number = v.GroupNo AND rg.CompanyId = @C;

  /* توقف‌ها */
  INSERT mes.WorkOrderOperationProblem (CompanyId, WOOperationId, ProblemId, IsStoppageCause, StartTime, EndTime, Duration, StoppageDuration, ProblemDescription, EquipmentId, ReportedByTitle, SourceCode)
  SELECT @C, o.Id, pr.Id, v.Stop, DATEADD(MINUTE, v.S, @D), CASE WHEN v.E IS NOT NULL THEN DATEADD(MINUTE, v.E, @D) END, v.E - v.S, v.E - v.S, v.Description,
         (SELECT TOP (1) e.Id FROM mes.Equipment e WHERE e.Number = v.Eq), v.ByT, v.Src
  FROM (VALUES
    (N'WO-1405-0501', 40, N'P-212', 1, 420, 445, N'تنظیم وزن و سختی پس از راه‌اندازی', N'EQ-1055', N'اپراتور', 2),
    (N'WO-1405-0501', 40, N'P-301', 1, 552, 560, N'گیر کردن قرص در کانال تغذیه‌ی پرس B', N'EQ-1056', N'PLC', 3),
    (N'WO-1405-0501', 40, N'P-501', 1, 600, 615, N'استراحت', NULL, N'اپراتور', 2),
    (N'WO-1405-0501', 45, N'P-212', 1, 430, 452, N'تنظیم پس از راه‌اندازی', NULL, N'اپراتور', 2),
    (N'WO-1405-0501', 45, N'P-101', 1, 640, NULL, N'شکستگی پانچ بالایی ایستگاه ۱۴ — منتظر ست یدک TL-206', NULL, N'اپراتور', 2),
    (N'WO-1405-0501', 60, N'P-202', 1, 540, 575, N'تعویض فرمت بلیستر', N'EQ-1088', N'اپراتور', 2),
    (N'WO-1405-0501', 60, N'P-303', 1, 610, 622, N'گیر کردن نوار بلیستر', N'EQ-1088', N'PLC', 3),
    (N'WO-1405-0504', 10, N'P-102', 1, 455, 470, N'صدای گیربکس میکسر ۳', N'EQ-1042', N'اپراتور', 2),
    (N'WO-1405-0507', 10, N'P-401', 1, 600, 625, N'کمبود پوویدون در مخزن خوراک', NULL, N'اپراتور', 2)
  ) v(Wo, Seq, Problem, Stop, S, E, Description, Eq, ByT, Src)
  JOIN mes.WorkOrder w ON w.Number = v.Wo AND w.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = v.Seq
  JOIN mes.ProductionProblem pr ON pr.Number = v.Problem AND pr.CompanyId = @C;

  /* دستورالعمل و چک‌لیست هر عملیات در جریان از دستورالعمل‌های تأییدشده‌ی کتابخانه */
  INSERT mes.WorkOrderOperationInstruction (CompanyId, WOOperationId, RoutingOperationInstId, Sequence, IsControlCheck, Description, IsDone, DoneAt, DoneByTitle)
  SELECT @C, o.Id, i.Id, ROW_NUMBER() OVER (PARTITION BY o.Id ORDER BY i.Sequence, i.Id), i.IsMandatory, i.Title,
         CAST(CASE WHEN i.IsMandatory = 1 THEN 1 ELSE 0 END AS BIT), DATEADD(MINUTE, 5, o.StartTime), N'اپراتور'
  FROM mes.WorkOrderOperation o
  JOIN mes.ProductionOperationInstruction i ON i.ProductionOperationId = o.OperationId AND i.RevisionStatusCode = 2 AND i.IsDeleted = 0
  WHERE o.CompanyId = @C AND o.IsDeleted = 0 AND o.WorkOrderOperationStatusCode IN (3, 4);

  /* اقلام کنترلی افزوده (چک‌لیست اجرایی) */
  INSERT mes.WorkOrderOperationInstruction (CompanyId, WOOperationId, Sequence, IsControlCheck, Description, IsDone, DoneAt, DoneByTitle)
  SELECT @C, o.Id, 10 + v.Seq, 1, v.Title, v.Done, CASE WHEN v.Done = 1 THEN DATEADD(MINUTE, 3, o.StartTime) END, CASE WHEN v.Done = 1 THEN N'اپراتور' END
  FROM (VALUES (N'WO-1405-0501', 40, 1, N'تأیید تمیزی خط (Line Clearance)', 1), (N'WO-1405-0501', 40, 2, N'تطبیق شماره‌ی پانچ با دستور', 1),
               (N'WO-1405-0501', 40, 3, N'ثبت وزن ۱۰ قرص اول', 1),
               (N'WO-1405-0501', 45, 1, N'تأیید تمیزی خط (Line Clearance)', 1), (N'WO-1405-0501', 45, 2, N'تطبیق شماره‌ی پانچ با دستور', 0),
               (N'WO-1405-0501', 60, 1, N'تطبیق فویل و PVC با دستور', 1), (N'WO-1405-0501', 60, 2, N'آزمون نشتی ۵ بلیستر اول', 1)) v(Wo, OpSeq, Seq, Title, Done)
  JOIN mes.WorkOrder w ON w.Number = v.Wo AND w.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = v.OpSeq;

  /* خوانش پارامترها: پرس و بسته‌بندی WO-0501، خشک‌کن WO-0504 */
  DECLARE @r TABLE (Wo NVARCHAR(64), Seq INT, OpNo NVARCHAR(16), Param NVARCHAR(128), AtMin INT, Val DECIMAL(32,6), Src INT, Comment NVARCHAR(400));
  INSERT @r VALUES
    (N'WO-1405-0501', 40, N'OP-30', N'نیروی پرس اصلی', 450, 14.2, 2, NULL), (N'WO-1405-0501', 40, N'OP-30', N'نیروی پرس اصلی', 510, 14.6, 2, NULL),
    (N'WO-1405-0501', 40, N'OP-30', N'نیروی پرس اصلی', 570, 15.1, 2, NULL), (N'WO-1405-0501', 40, N'OP-30', N'نیروی پرس اصلی', 630, 14.8, 2, NULL),
    (N'WO-1405-0501', 40, N'OP-30', N'نیروی پرس اصلی', 690, 14.4, 2, NULL),
    (N'WO-1405-0501', 40, N'OP-30', N'سرعت روتور', 450, 36, 2, NULL), (N'WO-1405-0501', 40, N'OP-30', N'سرعت روتور', 570, 38, 2, NULL), (N'WO-1405-0501', 40, N'OP-30', N'سرعت روتور', 690, 39, 2, NULL),
    (N'WO-1405-0501', 40, N'OP-30', N'وزن قرص', 450, 604, 1, NULL), (N'WO-1405-0501', 40, N'OP-30', N'وزن قرص', 480, 598, 1, NULL),
    (N'WO-1405-0501', 40, N'OP-30', N'وزن قرص', 510, 611, 1, NULL), (N'WO-1405-0501', 40, N'OP-30', N'وزن قرص', 540, 622, 1, NULL),
    (N'WO-1405-0501', 40, N'OP-30', N'وزن قرص', 570, 633, 1, N'بالاتر از حد — تنظیم عمق پرکردن'), (N'WO-1405-0501', 40, N'OP-30', N'وزن قرص', 600, 612, 1, NULL),
    (N'WO-1405-0501', 40, N'OP-30', N'وزن قرص', 630, 605, 1, NULL), (N'WO-1405-0501', 40, N'OP-30', N'وزن قرص', 660, 601, 1, NULL),
    (N'WO-1405-0501', 40, N'OP-30', N'سختی قرص', 450, 82, 1, NULL), (N'WO-1405-0501', 40, N'OP-30', N'سختی قرص', 510, 78, 1, NULL),
    (N'WO-1405-0501', 40, N'OP-30', N'سختی قرص', 570, 91, 1, NULL), (N'WO-1405-0501', 40, N'OP-30', N'سختی قرص', 630, 84, 1, NULL),
    (N'WO-1405-0501', 60, N'OP-50', N'دمای سیل', 560, 189, 2, NULL), (N'WO-1405-0501', 60, N'OP-50', N'دمای سیل', 590, 192, 2, NULL),
    (N'WO-1405-0501', 60, N'OP-50', N'دمای سیل', 610, 203, 2, N'هیتر بالا — خط متوقف و تنظیم شد'), (N'WO-1405-0501', 60, N'OP-50', N'دمای سیل', 640, 191, 2, NULL),
    (N'WO-1405-0501', 60, N'OP-50', N'سرعت بلیستر', 600, 33, 2, NULL), (N'WO-1405-0501', 60, N'OP-50', N'سرعت بلیستر', 660, 35, 2, NULL),
    (N'WO-1405-0504', 20, N'OP-25', N'دمای هوای ورودی', 510, 58, 2, NULL), (N'WO-1405-0504', 20, N'OP-25', N'دمای هوای ورودی', 570, 61, 2, NULL),
    (N'WO-1405-0504', 20, N'OP-25', N'دمای هوای ورودی', 630, 62, 2, NULL), (N'WO-1405-0504', 20, N'OP-25', N'رطوبت نهایی گرانول (LOD)', 660, 2.6, 1, N'هنوز بالای هدف — ادامه‌ی خشک‌کردن');

  INSERT mes.WorkOrderOperationParameterReading (CompanyId, WOOperationId, ProductionOperationParameterId, ReadAt, Value, SourceCode, IsOutOfRange, Comment)
  SELECT @C, o.Id, pp.Id, DATEADD(MINUTE, r.AtMin, @D), r.Val, r.Src,
         CAST(CASE WHEN (pp.MinValue IS NOT NULL AND r.Val < pp.MinValue) OR (pp.MaxValue IS NOT NULL AND r.Val > pp.MaxValue) THEN 1 ELSE 0 END AS BIT), r.Comment
  FROM @r r
  JOIN mes.WorkOrder w ON w.Number = r.Wo AND w.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = r.Seq
  JOIN mes.ProductionOperation op ON op.Number = r.OpNo AND op.CompanyId = @C
  JOIN mes.ProductionOperationParameter pp ON pp.ProductionOperationId = op.Id AND pp.Name = r.Param;

  /* PLC خط ۲ */
  INSERT mes.PLC (CompanyId, Number, Name, LatinName, Model, ProductionLineId, TruncateDataDuration, IsActive, Description)
  VALUES (@C, N'PLC-L2', N'PLC خط قرص‌سازی ۲', N'Line-2 PLC', N'S7-1500', 2, 90, 1, N'شمارنده و کنتور پرس، بلیستر و خشک‌کن');
  DECLARE @plc BIGINT = SCOPE_IDENTITY();

  INSERT mes.PLCItem (CompanyId, PLCId, EquipmentId, ReferenceEntityFullName, ReferenceObjectId, ReferenceObjectNumber, TargetEntityFullName, PLCItemTypeCode, PLCItemTag, ReadDataInterval, IsActive, Description, TargetEntityTypeCode)
  SELECT @C, @plc, e.Id, N'mes.Equipment', e.Id, e.Number, v.Target, v.TypeCode, v.Tag, v.Interval, 1, v.Description, v.TargetType
  FROM (VALUES (N'EQ-1055', N'mes.WorkOrderOperationOutput', 1, N'DB10.PressA.Count', 60, N'شمارنده‌ی قرص پرس A', 1),
               (N'EQ-1056', N'mes.WorkOrderOperationOutput', 1, N'DB10.PressB.Count', 60, N'شمارنده‌ی قرص پرس B', 1),
               (N'EQ-1055', N'mes.WorkOrderOperationCapacityUsage', 2, N'DB12.PressA.kWh', 300, N'کنتور برق پرس A', 2),
               (N'EQ-1088', N'mes.WorkOrderOperationOutput', 1, N'DB20.Blister.Count', 60, N'شمارنده‌ی بلیستر ماشین ۲', 1),
               (N'EQ-1088', N'mes.WorkOrderOperationParameterReading', 3, N'DB20.Seal.Temp', 30, N'دمای سیل بلیستر', 3)) v(Eq, Target, TypeCode, Tag, Interval, Description, TargetType)
  JOIN mes.Equipment e ON e.Number = v.Eq AND e.CompanyId = @C;

  /* داده‌ی دستگاه هم‌بازه‌ی گزارش‌ها: دستگاه پیشنهاد، کاربر تأیید */
  INSERT mes.PLCItemData (CompanyId, PLCItemId, RefMainNumber, RefMainId, RefRelatedNumber, Result, ReadStartDateTime, ReadEndDateTime, IsApplied, WorkOrderId, UserValue, DeviationNote, Description)
  SELECT @C, i.Id, w.Number, w.Id, x.ReportNumber, v.DeviceVal, x.StartTime, x.EndTime, v.Applied, w.Id, x.CompletedQuantity + x.WastedQuantity, v.Note, v.Description
  FROM (VALUES (N'DB10.PressA.Count', N'RP-0501-40-1', 94400.0, 1, NULL, NULL),
               (N'DB10.PressA.Count', N'RP-0501-40-2', 109750.0, 0, NULL, N'انحراف ۱٫۶٪ — منتظر توضیح اپراتور'),
               (N'DB10.PressA.Count', N'RP-0501-40-3', 67600.0, 1, N'قرص‌های تنظیم دستی از شمارنده کم شد', NULL),
               (N'DB20.Blister.Count', N'RP-0501-60-1', 52650.0, 1, NULL, N'پذیرش خودکار'),
               (N'DB20.Blister.Count', N'RP-0501-60-2', 60140.0, 1, NULL, N'پذیرش خودکار')) v(Tag, Rpt, DeviceVal, Applied, Note, Description)
  JOIN mes.PLCItem i ON i.PLCItemTag = v.Tag AND i.PLCId = @plc
  JOIN mes.WorkOrderOperationOutput x ON x.ReportNumber = v.Rpt AND x.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId;

  COMMIT;
END
GO
