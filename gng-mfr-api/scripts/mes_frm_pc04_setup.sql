/* =====================================================================
   اسکیمای mes — گام ۳۲: FRM-PC-04 «گزارش تولید»

   پیش‌نیاز: mes_frm_pc03، علل ضایعات و دوباره‌کاری (RM-07)، پرسنل (RM-03)، نوع کارکرد (RM-06)، شیفت (RM-04).
   یادداشت ALM: «نسخه‌ی اداری؛ ثبت کف کارگاه در ترمینال جداست».

   جدول‌های قدیم با همان نام و همه‌ی فیلدها:
     mes.WorkOrderOperationOutput        همان (گزارش عملیات: زمان، مقادیر تکمیل/ضایعات/دوباره‌کاری/انتقال، شیفت) + ReportNumber،
                                         ReportedByTitle، SourceCode — چند گزارش برای یک عملیات (F-PC-031، 032، 033)
     mes.WorkOrderOperationOutputLabor   همان + SharePercent (تسهیم اپراتور بین چند دستور، 042)؛ PersonnelGroupId NULL پذیر
     mes.WorkOrderOperationOutputWaste   همان + IsSetupWaste (تفکیک ضایعات راه‌اندازی از فرایند، 071)
     mes.WorkOrderOperationOutputRepair  همان + ReworkReasonId (← mes.ProductionReworkReason)؛ DefectId و MeasureUnitId NULL پذیر
   جدید:
     mes.WorkOrderOperationCapacityUsage کارکرد واقعی منابع به تفکیک هر نوع کارکرد RM-06 (نه فقط نفر/ماشین/انرژی) با منبع داده (034)
     mes.ShiftReport، mes.ShiftReportWip گزارش و تحویل شیفت: موجودی در جریان، وضعیت تجهیز، مسائل باز (041)
   پیش‌بینی زمان و مقدار تکمیل (043) از نرخ واقعی جاری زنده حساب می‌شود.

   فرض‌ها و کدهای موقت:
     SourceCode (گزارش/کارکرد)  1 = ثبت اداری، 2 = ترمینال کف کارگاه، 3 = PLC/دستگاه، 4 = محاسبه‌ای
     WasteTypeCode               1 = ضایعات مواد، 2 = ضایعات محصول (همان معنای RM-07)
     ShiftReport StatusCode      1 = باز، 2 = تحویل داده‌شده، 3 = تحویل گرفته‌شده

   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.WorkOrderOperationOutput','U') IS NULL
CREATE TABLE mes.WorkOrderOperationOutput (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationOutput PRIMARY KEY,
  WOOperationId BIGINT NOT NULL,
  StartTime DATETIME2 NULL,
  EndTime DATETIME2 NULL,
  Duration INT NULL,
  HeadPartyId BIGINT NULL,
  TotalPersonnelQuantity INT NOT NULL CONSTRAINT DF_mes_WOOO_Personnel DEFAULT (0),
  CompletedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOO_Completed DEFAULT (0),
  RemainedToInvQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOO_RemainedInv DEFAULT (0),
  ReceivedToInvQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOO_ReceivedInv DEFAULT (0),
  WastedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOO_Wasted DEFAULT (0),
  PendingQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOO_Pending DEFAULT (0),
  ActualYieldPercent DECIMAL(9,4) NOT NULL CONSTRAINT DF_mes_WOOO_Yield DEFAULT (100),
  ReworkQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOO_Rework DEFAULT (0),
  ReworkCompletedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOO_ReworkCompleted DEFAULT (0),
  ReworkWastedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOO_ReworkWasted DEFAULT (0),
  TransferredQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOO_Transferred DEFAULT (0),
  FromProductSerialId BIGINT NULL,
  ToProductSerialId BIGINT NULL,
  StartTimeShiftId BIGINT NULL,
  CompleteTimeShiftId BIGINT NULL,
  WorkOrderOperationOutputStatusCode INT NULL,
  Description NVARCHAR(400) NULL,
  IsReprocess BIT NULL,
  ReportNumber NVARCHAR(64) NULL,
  ReportedByTitle NVARCHAR(256) NULL,
  SourceCode INT NOT NULL CONSTRAINT DF_mes_WOOO_Source DEFAULT (1)
);

IF OBJECT_ID('mes.WorkOrderOperationOutputLabor','U') IS NULL
CREATE TABLE mes.WorkOrderOperationOutputLabor (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationOutputLabor PRIMARY KEY,
  OperationOutputId BIGINT NOT NULL,
  PersonnelPartyId BIGINT NOT NULL,
  PersonnelGroupId BIGINT NULL,
  TotalDuration INT NOT NULL CONSTRAINT DF_mes_WOOOL_Duration DEFAULT (0),
  TotalCompleted DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOOL_Completed DEFAULT (0),
  TotalWasted DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOOL_Wasted DEFAULT (0),
  ActivityDescription NVARCHAR(400) NULL,
  ProblemDescription NVARCHAR(400) NULL,
  WorkOrderOperationOutputLaborStatusCode INT NULL,
  Description NVARCHAR(400) NULL,
  IsProductionByOrder BIT NULL,
  NumberOfLabor INT NULL,
  SharePercent DECIMAL(9,4) NULL
);

IF OBJECT_ID('mes.WorkOrderOperationOutputWaste','U') IS NULL
CREATE TABLE mes.WorkOrderOperationOutputWaste (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationOutputWaste PRIMARY KEY,
  OperationOutputId BIGINT NOT NULL,
  WastedProductId BIGINT NULL,
  WastedProductExtraInfo NVARCHAR(400) NULL,
  DefectId BIGINT NULL,
  WastedQuantity DECIMAL(32,6) NOT NULL,
  WasteReasonId BIGINT NULL,
  ApprovedQuantity DECIMAL(32,6) NULL,
  ReceivedToInvQuantity DECIMAL(32,6) NULL,
  RemainedToInvQuantity DECIMAL(32,6) NULL,
  MeasureUnitId BIGINT NULL,
  WorkOrderOperationOutputWasteStatusCode INT NULL,
  Description NVARCHAR(400) NULL,
  BatchId BIGINT NULL,
  WasteTypeCode INT NULL,
  IsRejectedWaste BIT NULL,
  IsSetupWaste BIT NOT NULL CONSTRAINT DF_mes_WOOOW_Setup DEFAULT (0)
);

IF OBJECT_ID('mes.WorkOrderOperationOutputRepair','U') IS NULL
CREATE TABLE mes.WorkOrderOperationOutputRepair (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationOutputRepair PRIMARY KEY,
  OperationOutputId BIGINT NOT NULL,
  ProductId BIGINT NOT NULL,
  BatchId BIGINT NULL,
  ProductExtraInfo NVARCHAR(400) NULL,
  DefectId BIGINT NULL,
  RepairId BIGINT NULL,
  ToRepairQuantity DECIMAL(32,6) NOT NULL,
  RepairedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOOR_Repaired DEFAULT (0),
  RemainedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOOR_Remained DEFAULT (0),
  ReceivedToInvQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOOR_ReceivedInv DEFAULT (0),
  RemainedToInvQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_WOOOR_RemainedInv DEFAULT (0),
  MeasureUnitId BIGINT NULL,
  WorkOrderOperationOutputRepairStatusCode INT NULL,
  Description NVARCHAR(400) NULL,
  ReworkReasonId BIGINT NULL
);

IF OBJECT_ID('mes.WorkOrderOperationCapacityUsage','U') IS NULL
CREATE TABLE mes.WorkOrderOperationCapacityUsage (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkOrderOperationCapacityUsage PRIMARY KEY,
  WOOperationId BIGINT NOT NULL,
  OperationOutputId BIGINT NULL,
  CapacityTypeId BIGINT NOT NULL,
  Quantity DECIMAL(32,6) NOT NULL,
  SourceCode INT NOT NULL CONSTRAINT DF_mes_WOOCU_Source DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ShiftReport','U') IS NULL
CREATE TABLE mes.ShiftReport (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ShiftReport PRIMARY KEY,
  ShiftDate DATE NOT NULL,
  WorkingShiftId BIGINT NOT NULL,
  ProductionLineId BIGINT NOT NULL,
  SupervisorTitle NVARCHAR(256) NULL,
  NextSupervisorTitle NVARCHAR(256) NULL,
  HandoverTime DATETIME2 NULL,
  StatusCode INT NOT NULL CONSTRAINT DF_mes_SR_Status DEFAULT (1),
  Summary NVARCHAR(800) NULL,
  EquipmentNotes NVARCHAR(800) NULL,
  OpenIssues NVARCHAR(800) NULL
);

IF OBJECT_ID('mes.ShiftReportWip','U') IS NULL
CREATE TABLE mes.ShiftReportWip (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ShiftReportWip PRIMARY KEY,
  ShiftReportId BIGINT NOT NULL,
  WorkOrderId BIGINT NOT NULL,
  WOOperationId BIGINT NULL,
  WipQuantity DECIMAL(32,6) NOT NULL,
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

CREATE OR ALTER PROCEDURE mes.GetProductionReports
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, CAST(o.Id AS INT) AS WOOperationId, o.Sequence, op.Name AS OperationTitle,
         CAST(x.Id AS INT) AS OutputId, x.ReportNumber, x.StartTime, x.EndTime, x.Duration, x.TotalPersonnelQuantity, x.CompletedQuantity, x.WastedQuantity,
         x.ReworkQuantity, x.TransferredQuantity, x.ActualYieldPercent, x.SourceCode, x.ReportedByTitle, x.Description, sh.Number AS ShiftCode, p.MeasureUnitTitle AS UnitTitle
  FROM mes.WorkOrderOperationOutput x
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.Product p ON p.Id = w.MainProductId
  LEFT JOIN mes.ProductionWorkingShift sh ON sh.Id = x.StartTimeShiftId
  WHERE x.CompanyId = @CompanyId AND x.IsDeleted = 0
  ORDER BY x.StartTime DESC;
END
GO

CREATE OR ALTER PROCEDURE mes.GetProductionReportDetails
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* ۱: نیروی کار */
  SELECT CAST(l.OperationOutputId AS INT) AS OutputId, CAST(o.WorkOrderId AS INT) AS WorkOrderId, pp.Number AS PersonnelCode, pp.Name AS PersonnelTitle,
         CAST(pp.Id AS INT) AS PersonnelId, l.TotalDuration, l.TotalCompleted, l.TotalWasted, l.SharePercent, l.ActivityDescription
  FROM mes.WorkOrderOperationOutputLabor l
  JOIN mes.WorkOrderOperationOutput x ON x.Id = l.OperationOutputId
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.ProductionPersonnel pp ON pp.Id = l.PersonnelPartyId
  WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0;

  /* ۲: ضایعات با علت درختی */
  SELECT CAST(z.OperationOutputId AS INT) AS OutputId, CAST(o.WorkOrderId AS INT) AS WorkOrderId, o.Sequence, z.WastedQuantity, z.WasteTypeCode, z.IsSetupWaste,
         r.Number AS ReasonCode, r.Name AS ReasonTitle, pr.Name AS ReasonParentTitle, p.Number + N' — ' + p.Name AS WastedProductTitle, z.Description
  FROM mes.WorkOrderOperationOutputWaste z
  JOIN mes.WorkOrderOperationOutput x ON x.Id = z.OperationOutputId
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  LEFT JOIN mes.ProductionWasteReason r ON r.Id = z.WasteReasonId
  LEFT JOIN mes.ProductionWasteReason pr ON pr.Id = r.ParentId
  LEFT JOIN mes.Product p ON p.Id = z.WastedProductId
  WHERE z.CompanyId = @CompanyId AND z.IsDeleted = 0;

  /* ۳: دوباره‌کاری */
  SELECT CAST(z.OperationOutputId AS INT) AS OutputId, CAST(o.WorkOrderId AS INT) AS WorkOrderId, o.Sequence, z.ToRepairQuantity, z.RepairedQuantity, z.RemainedQuantity,
         rr.Name AS ReasonTitle, z.Description
  FROM mes.WorkOrderOperationOutputRepair z
  JOIN mes.WorkOrderOperationOutput x ON x.Id = z.OperationOutputId
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  LEFT JOIN mes.ProductionReworkReason rr ON rr.Id = z.ReworkReasonId
  WHERE z.CompanyId = @CompanyId AND z.IsDeleted = 0;

  /* ۴: کارکرد منابع با استاندارد ME-03 (مبنای متناسب/ترکیبی/ثابت) برای مقدار تکمیل‌شده‌ی همان گزارش */
  SELECT CAST(u.OperationOutputId AS INT) AS OutputId, CAST(o.WorkOrderId AS INT) AS WorkOrderId, o.Sequence, ct.Number + N' — ' + ct.Name AS CapacityTitle,
         ct.MeasureUnitTitle AS UnitTitle, u.Quantity, u.SourceCode, u.Description,
         CAST(CASE rc.CalculationBasisCode WHEN 1 THEN NULL
                WHEN 2 THEN rc.VariableQuantity * x.CompletedQuantity / NULLIF(rc.PerQuantity, 0)
                WHEN 4 THEN rc.VariableQuantity * x.CompletedQuantity / NULLIF(rc.PerQuantity, 0) END AS DECIMAL(32,4)) AS StdQuantity
  FROM mes.WorkOrderOperationCapacityUsage u
  JOIN mes.WorkOrderOperation o ON o.Id = u.WOOperationId
  LEFT JOIN mes.WorkOrderOperationOutput x ON x.Id = u.OperationOutputId
  JOIN mes.CapacityType ct ON ct.Id = u.CapacityTypeId
  LEFT JOIN mes.RoutingOperationCapacity rc ON rc.RoutingOperationId = o.RoutingOperationId AND rc.CapacityTypeId = u.CapacityTypeId AND rc.IsDeleted = 0
  WHERE u.CompanyId = @CompanyId AND u.IsDeleted = 0;
END
GO

CREATE OR ALTER PROCEDURE mes.GetShiftReports
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(s.Id AS INT) AS ShiftReportId, s.ShiftDate, sh.Number + N' — ' + sh.Name AS ShiftTitle, sh.FromTime, sh.ToTime, l.Name AS LineTitle,
         s.SupervisorTitle, s.NextSupervisorTitle, s.HandoverTime, s.StatusCode, s.Summary, s.EquipmentNotes, s.OpenIssues
  FROM mes.ShiftReport s
  JOIN mes.ProductionWorkingShift sh ON sh.Id = s.WorkingShiftId
  JOIN mes.ProductionLine l ON l.Id = s.ProductionLineId
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0
  ORDER BY s.ShiftDate DESC, sh.FromTime DESC;

  SELECT CAST(x.ShiftReportId AS INT) AS ShiftReportId, w.Number AS WorkOrderNumber, op.Name AS OperationTitle, x.WipQuantity, p.MeasureUnitTitle AS UnitTitle, x.Description
  FROM mes.ShiftReportWip x
  JOIN mes.WorkOrder w ON w.Id = x.WorkOrderId
  LEFT JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  LEFT JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.Product p ON p.Id = w.MainProductId
  WHERE x.CompanyId = @CompanyId AND x.IsDeleted = 0;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.WorkOrderOperationOutput خالی است.
   هر عملیات تکمیل‌شده یک گزارش دارد؛ عملیات در جریان سه گزارش (۳۵٪، ۴۰٪، ۲۵٪). نیرو، ضایعات (راه‌اندازی/فرایند با علت) و
   کارکرد منابع از روی همین گزارش‌ها ساخته می‌شوند. عمداً قابل‌بحث: مهدی رحیمی هم‌زمان روی پرس خط ۲ و پرس خط ۱ (هر دو WO-0501، ساعت ۸:۳۰ تا ۱۰)
   با تسهیم ۶۰/۴۰ کار می‌کند؛ ۱۱٬۴۰۰ قرص WO-0498 نیازمند دوباره‌کاری ثبت شده؛ برق پرس از PLC بیش از استاندارد است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.WorkOrderOperationOutput)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @now DATETIME2 = mes.fnShopNow();

  DECLARE @split TABLE (Part INT, Share DECIMAL(9,4));
  INSERT @split VALUES (1, 0.35), (2, 0.40), (3, 0.25);

  INSERT mes.WorkOrderOperationOutput (CompanyId, WOOperationId, StartTime, EndTime, Duration, TotalPersonnelQuantity, CompletedQuantity, WastedQuantity, ReworkQuantity,
                                       TransferredQuantity, ActualYieldPercent, StartTimeShiftId, CompleteTimeShiftId, WorkOrderOperationOutputStatusCode, ReportNumber,
                                       ReportedByTitle, SourceCode, Description)
  SELECT @C, o.Id, t.S, t.E, DATEDIFF(MINUTE, t.S, t.E), CASE WHEN op.OperationTypeCode = 4 THEN 0 ELSE 2 END,
         ROUND(o.CompletedQuantity * x.Share, 2), ROUND(o.WastedQuantity * x.Share, 2), 0, ROUND(o.CompletedQuantity * x.Share, 2),
         CASE WHEN o.CompletedQuantity + o.WastedQuantity > 0 THEN 100.0 * o.CompletedQuantity / (o.CompletedQuantity + o.WastedQuantity) ELSE 100 END,
         sh.Id, sh.Id, CASE WHEN o.WorkOrderOperationStatusCode = 5 THEN 2 ELSE 1 END,
         N'RP-' + RIGHT(w.Number, 4) + N'-' + CAST(o.Sequence AS NVARCHAR(4)) + N'-' + CAST(sp.Part AS NVARCHAR(2)),
         CASE WHEN sp.Part = 3 OR o.WorkOrderOperationStatusCode = 5 THEN N'سرپرست شیفت' ELSE N'ترمینال ایستگاه' END,
         CASE WHEN sp.Part = 3 OR o.WorkOrderOperationStatusCode = 5 THEN 1 ELSE 2 END, NULL
  FROM mes.WorkOrderOperation o
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN @split sp ON (o.WorkOrderOperationStatusCode = 5 AND sp.Part = 1) OR (o.WorkOrderOperationStatusCode IN (3, 4) AND sp.Part IN (1, 2, 3))
  /* عملیات تکمیل‌شده یک گزارش با کل مقدار دارد؛ در جریان سه گزارش با سهم */
  CROSS APPLY (SELECT CASE WHEN o.WorkOrderOperationStatusCode = 5 THEN 1.0 ELSE sp.Share END AS Share) x
  CROSS APPLY (SELECT ISNULL(o.EndTime, CASE WHEN o.WorkOrderOperationStatusCode = 4 THEN DATEADD(MINUTE, -50, @now) ELSE @now END) AS EndAt) e
  CROSS APPLY (SELECT CASE WHEN o.WorkOrderOperationStatusCode = 5 THEN o.StartTime
                           ELSE DATEADD(MINUTE, CAST(DATEDIFF(MINUTE, o.StartTime, e.EndAt) * (CASE sp.Part WHEN 1 THEN 0 WHEN 2 THEN 0.35 ELSE 0.75 END) AS INT), o.StartTime) END AS S,
                      CASE WHEN o.WorkOrderOperationStatusCode = 5 THEN e.EndAt
                           ELSE DATEADD(MINUTE, CAST(DATEDIFF(MINUTE, o.StartTime, e.EndAt) * (CASE sp.Part WHEN 1 THEN 0.35 WHEN 2 THEN 0.75 ELSE 1 END) AS INT), o.StartTime) END AS E) t
  OUTER APPLY (SELECT TOP (1) s.Id FROM mes.ProductionWorkingShift s
               WHERE s.Number IN (N'SH-M', N'SH-E', N'SH-N') AND s.IsDeleted = 0
                 AND ((s.FromTime < s.ToTime AND DATEPART(HOUR, t.S) * 60 + DATEPART(MINUTE, t.S) >= s.FromTime AND DATEPART(HOUR, t.S) * 60 + DATEPART(MINUTE, t.S) < s.ToTime)
                   OR (s.FromTime > s.ToTime AND (DATEPART(HOUR, t.S) * 60 + DATEPART(MINUTE, t.S) >= s.FromTime OR DATEPART(HOUR, t.S) * 60 + DATEPART(MINUTE, t.S) < s.ToTime)))) sh
  WHERE o.CompanyId = @C AND o.IsDeleted = 0 AND o.StartTime IS NOT NULL AND o.IsOutsourced = 0;

  /* نیروی کار: دو نفر به‌ازای هر گزارش؛ نفر بر مبنای عملیات */
  INSERT mes.WorkOrderOperationOutputLabor (CompanyId, OperationOutputId, PersonnelPartyId, TotalDuration, TotalCompleted, TotalWasted, ActivityDescription, NumberOfLabor, SharePercent)
  SELECT @C, x.Id, pp.Id, x.Duration, x.CompletedQuantity / 2, x.WastedQuantity / 2, CASE n.k WHEN 1 THEN N'اپراتور' ELSE N'کمک‌اپراتور' END, 1, 100
  FROM mes.WorkOrderOperationOutput x
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN (VALUES (1), (2)) n(k) ON x.TotalPersonnelQuantity >= n.k
  JOIN mes.ProductionPersonnel pp ON pp.Id = ((o.OperationId * 3 + n.k) % 10) + 1
  WHERE x.CompanyId = @C;

  /* تسهیم: مهدی رحیمی (۱۰۸۱۵) روی پرس هر دو خط در بازه‌ی جاری */
  UPDATE l SET l.PersonnelPartyId = pp.Id, l.SharePercent = CASE o.Sequence WHEN 40 THEN 60 ELSE 40 END,
               l.TotalDuration = l.TotalDuration * CASE o.Sequence WHEN 40 THEN 0.6 ELSE 0.4 END,
               l.Description = N'هم‌زمان روی پرس خط ۲ و پرس خط ۱'
  FROM mes.WorkOrderOperationOutputLabor l
  JOIN mes.WorkOrderOperationOutput x ON x.Id = l.OperationOutputId
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId AND o.Sequence IN (40, 45)
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId AND w.Number = N'WO-1405-0501'
  JOIN mes.ProductionPersonnel pp ON pp.Number = N'10815'
  WHERE x.ReportNumber LIKE N'%-2' AND l.ActivityDescription = N'اپراتور';

  /* ضایعات: گزارش اول = راه‌اندازی، بقیه فرایند؛ علت بر حسب عملیات */
  INSERT mes.WorkOrderOperationOutputWaste (CompanyId, OperationOutputId, WastedProductId, WastedQuantity, WasteReasonId, ApprovedQuantity, WasteTypeCode, IsRejectedWaste, IsSetupWaste, Description)
  SELECT @C, x.Id, CASE WHEN r.WasteTypeCode = 1 THEN NULL ELSE w.MainProductId END, x.WastedQuantity, r.Id, x.WastedQuantity, r.WasteTypeCode, 1,
         CASE WHEN x.ReportNumber LIKE N'%-1' AND op.Number IN (N'OP-30', N'OP-50') THEN 1 ELSE 0 END, NULL
  FROM mes.WorkOrderOperationOutput x
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN mes.ProductionWasteReason r ON r.Number = CASE
         WHEN op.Number = N'OP-30' AND x.ReportNumber LIKE N'%-1' THEN N'WS-P11'
         WHEN op.Number = N'OP-30' THEN N'WS-P21'
         WHEN op.Number = N'OP-50' AND x.ReportNumber LIKE N'%-1' THEN N'WS-M21'
         WHEN op.Number = N'OP-50' THEN N'WS-P24'
         WHEN op.Number = N'OP-45' THEN N'WS-P21'
         WHEN op.Number IN (N'OP-25', N'OP-20') THEN N'WS-M12'
         ELSE N'WS-M11' END AND r.CompanyId = @C
  WHERE x.CompanyId = @C AND x.WastedQuantity > 0;

  /* دوباره‌کاری: بازرسی WO-0498 — ۱۱٬۴۰۰ قرص با لکه‌ی سطحی */
  UPDATE x SET x.ReworkQuantity = 11400, x.Description = N'۱۱٬۴۰۰ قرص با لکه‌ی سطحی به قرنطینه'
  FROM mes.WorkOrderOperationOutput x JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.Number = N'WO-1405-0498' AND o.Sequence = 50;
  UPDATE o SET o.ReworkQuantity = 11400 FROM mes.WorkOrderOperation o JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId WHERE w.Number = N'WO-1405-0498' AND o.Sequence = 50;

  INSERT mes.WorkOrderOperationOutputRepair (CompanyId, OperationOutputId, ProductId, ToRepairQuantity, RepairedQuantity, RemainedQuantity, ReworkReasonId, Description)
  SELECT @C, x.Id, w.MainProductId, 11400, 0, 11400, (SELECT TOP (1) rr.Id FROM mes.ProductionReworkReason rr WHERE rr.CompanyId = @C AND rr.ParentId IS NOT NULL ORDER BY rr.Id),
         N'بازرسی مجدد و جداسازی — دستور دوباره‌کاری WO-1405-0510'
  FROM mes.WorkOrderOperationOutput x JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  WHERE w.Number = N'WO-1405-0498' AND o.Sequence = 50;

  /* کارکرد منابع: نفرساعت از نیروی کار، ماشین‌ساعت از مدت، ضربه و برق از PLC */
  INSERT mes.WorkOrderOperationCapacityUsage (CompanyId, WOOperationId, OperationOutputId, CapacityTypeId, Quantity, SourceCode, Description)
  SELECT @C, x.WOOperationId, x.Id, ct.Id,
         CASE ct.Number WHEN N'LAB' THEN ROUND(x.Duration * x.TotalPersonnelQuantity / 60.0, 2)
                        WHEN N'MCH' THEN ROUND(x.Duration / 60.0, 2)
                        WHEN N'STR' THEN x.CompletedQuantity + x.WastedQuantity
                        WHEN N'ELC' THEN ROUND(x.Duration / 60.0 * CASE WHEN op.Number = N'OP-30' THEN 16.8 ELSE 9.5 END, 1)
                        /* بخار ۱٫۰۵ کیلو به‌ازای هر کیلو گرانول؛ دستور قرصی: ۰٫۵۸۵ گرم گرانول در هر قرص */
                        WHEN N'STM' THEN ROUND(x.CompletedQuantity * 1.05 * CASE WHEN mp.MeasureUnitTitle = N'kg' THEN 1 ELSE 0.000585 END, 1) END,
         CASE ct.Number WHEN N'LAB' THEN 2 WHEN N'MCH' THEN 4 ELSE 3 END,
         CASE WHEN ct.Number = N'ELC' AND op.Number = N'OP-30' THEN N'کنتور PLC پرس' END
  FROM mes.WorkOrderOperationOutput x
  JOIN mes.WorkOrderOperation o ON o.Id = x.WOOperationId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.Product mp ON mp.Id = o.MainOutputProductId
  JOIN mes.CapacityType ct ON ct.CompanyId = @C AND (
         ct.Number IN (N'LAB', N'MCH')
      OR (ct.Number IN (N'STR', N'ELC') AND op.Number = N'OP-30')
      OR (ct.Number = N'ELC' AND op.Number IN (N'OP-20', N'OP-50'))
      OR (ct.Number = N'STM' AND op.Number = N'OP-25'))
  WHERE x.CompanyId = @C AND x.Duration > 0;

  /* گزارش شیفت خط ۲: شب قبل (تحویل گرفته‌شده)، عصر دیروز (تحویل داده‌شده)، صبح امروز (باز) */
  INSERT mes.ShiftReport (CompanyId, ShiftDate, WorkingShiftId, ProductionLineId, SupervisorTitle, NextSupervisorTitle, HandoverTime, StatusCode, Summary, EquipmentNotes, OpenIssues)
  SELECT @C, v.D, sh.Id, 2, v.Sup, v.NextSup, v.Handover, v.Status, v.Summary, v.Eqp, v.Issues
  FROM (VALUES
    (CAST('2026-10-08' AS DATE), N'SH-E', N'حسین موسوی', N'نادر جعفری', CAST('2026-10-08 22:05' AS DATETIME2), 3,
       N'گرانولاسیون و خشک‌کردن WO-0501 کامل؛ شروع خشک‌کن پیوسته', N'میکسر ۳: صدای غیرعادی گیربکس — اطلاع به نت', N'گیربکس میکسر ۳'),
    ('2026-10-08', N'SH-N', N'نادر جعفری', N'مریم احمدی', '2026-10-09 06:10', 3,
       N'خشک‌کردن WO-0501؛ گرانول پیوسته ۳۸ کیلو در جریان', N'بدون مورد', N'کمبود پوویدون K30 برای شیفت‌های پیوسته'),
    ('2026-10-09', N'SH-M', N'مریم احمدی', N'حسین موسوی', NULL, 1,
       N'پرس WO-0501 و WO-0506؛ بسته‌بندی هم‌پوشان WO-0501', N'پرس خط ۱: شکستگی پانچ ۱۰:۴۰ — منتظر یدک TL-206', N'تأخیر پرس خط ۱؛ درخواست مازاد گرانول فارمد منتظر تأیید')
  ) v(D, ShiftNo, Sup, NextSup, Handover, Status, Summary, Eqp, Issues)
  JOIN mes.ProductionWorkingShift sh ON sh.Number = v.ShiftNo AND sh.CompanyId = @C;

  INSERT mes.ShiftReportWip (CompanyId, ShiftReportId, WorkOrderId, WOOperationId, WipQuantity, Description)
  SELECT @C, s.Id, w.Id, o.Id, v.Qty, v.Description
  FROM (VALUES (CAST('2026-10-08' AS DATE), N'SH-N', N'WO-1405-0501', 30, 594000.0, N'گرانول خشک‌شده آماده‌ی پرس'),
               ('2026-10-08', N'SH-N', N'WO-1405-0507', 10, 38.0, N'مواد داخل گرانولاتور پیوسته'),
               ('2026-10-08', N'SH-E', N'WO-1405-0501', 30, 594000.0, N'در خشک‌کن'),
               ('2026-10-09', N'SH-M', N'WO-1405-0501', 40, 4200.0, N'قرص در هاپر پرس‌ها'),
               ('2026-10-09', N'SH-M', N'WO-1405-0507', 20, 26.0, N'در خشک‌کن پیوسته')) v(D, ShiftNo, Wo, Seq, Qty, Description)
  JOIN mes.ProductionWorkingShift sh ON sh.Number = v.ShiftNo AND sh.CompanyId = @C
  JOIN mes.ShiftReport s ON s.ShiftDate = v.D AND s.WorkingShiftId = sh.Id
  JOIN mes.WorkOrder w ON w.Number = v.Wo AND w.CompanyId = @C
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.Sequence = v.Seq;

  COMMIT;
END
GO
