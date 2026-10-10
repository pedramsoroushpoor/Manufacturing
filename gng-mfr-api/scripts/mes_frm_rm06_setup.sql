/* =====================================================================
   اسکیمای mes — گام ۶: FRM-RM-06 «کارکرد استاندارد و ظرفیت»

   پیش‌نیاز: mes_frm_rm01 تا mes_frm_rm05 اجرا شده باشند (نمای بار/ظرفیت
   روی تقویم مؤثر گام ۵ حساب می‌شود).
   قاعده‌ی مدل داده همان است که در سرآغاز mes_frm_rm01_setup.sql آمده.
   فرض تأییدشده (۱۵ مهر ۱۴۰۵): هر ایستگاه فقط مال یک خط است (WorkCenter.ProductionLineId).

   نگاشت جدول‌های این گام:
     mes.CapacityType                 = جدید — انواع کارکرد پویا (نفرساعت، ماشین‌ساعت، انرژی، بخار، ...).
                                        جانشین ستون‌های ثابت نسخه‌ی قبل: WorkCenter.NumberOfEquipments /
                                        NumberOfLabors و MachineLoad / LaborLoad در CapacityRequirment*.
                                        LegacyFieldCode می‌گوید هر نوع پایه به کدام فیلد قدیم برمی‌گردد.
     mes.WorkCenterCapacity           = جدید — ظرفیت هر نوع کارکرد به‌ازای ایستگاه یا گروه منبع، با
                                        درصد در دسترس‌بودن، تعداد در دسترس و توقف استاندارد. نام ستون‌های
                                        درصد همان نسخه‌ی قبل است (EquipmentAvailPercent، ProductivityPercent).
                                        هر تغییر یک نسخه‌ی تازه با ValidFromDate است؛ سابقه‌ی تغییرات همین نسخه‌هاست.
     mes.WorkCenterProductRate        = جدید — نرخ تولید وابسته به محصول یا گروه محصول، با ضریب کارایی و اعتبار.
                                        ProductTitle جانشین موقت تا اصل کالا (ProductId) وصل شود.
     mes.CapacityRequirmentScheduling = mfr.CapacityRequirmentScheduling — بار زمان‌بندی‌شده روی ایستگاه
                                        + CapacityTypeId (خالی = ماشین‌ساعت، مثل نسخه‌ی قبل)، ProductTitle،
                                        WorkOrderNumber. SiteId، ProductId، MeasureUnitId و UniqueShiftCode
                                        در قدیم NOT NULL‌اند و این‌جا NULL، چون جدول‌های مرجعشان هنوز در mes نیستند.
                                        MachineLoad = مقدار بار به واحدِ همان نوع کارکرد.

   فرض‌ها و کدهای موقت تا تأیید/رسیدن کدلیست اصلی:
     MeasureBasisCode     1 = زمان‌محور (ظرفیت = تعداد واحد هم‌زمان × ساعت در دسترس؛ واحد ساعت)
                          2 = نرخی (ظرفیت = نرخ در ساعت × ساعت در دسترس؛ مثل kWh، kg بخار)
                          3 = ثابت/فیزیکی (مقدار ثابت، بدون بُعد زمان؛ مثل حجم مخزن، مساحت) — در نمای بار نمی‌آید.
     CollectionMethodCode 1 = دستی، 2 = از PLC، 3 = محاسباتی (CalculationFormula)
     StandardDowntime     دقیقه به‌ازای هر شیفت.
     ظرفیت روزانه = (دقیقه‌ی در دسترسِ تقویم مؤثرِ خط − تعداد شیفت × توقف استاندارد) / ۶۰
                    × (تعداد در دسترس | نرخ) × EquipmentAvailPercent × ProductivityPercent
                    — همان فرمول MachineCapacity در CapacityRequirment نسخه‌ی قبل.
     گروه منبع: زمانِ در دسترس = بیشینه‌ی خطوط ایستگاه‌های عضو.
     تخصیص بار: اگر خودِ ایستگاه برای آن نوع ظرفیت دارد به ایستگاه؛ وگرنه اگر گروه منبعش دارد به گروه؛
                وگرنه به ایستگاه «بدون ظرفیت تعریف‌شده».

   فاز اول: F-RM-038، 039، 040، 041، 042، 044، 046 (الزامی). محدودیت متقابل منابع (043) و
   بازخورد واقعی به استاندارد (045) اولویت «مهم» و فاز ۳ دارند و نیامده‌اند. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */
IF OBJECT_ID('mes.CapacityType','U') IS NULL
CREATE TABLE mes.CapacityType (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_CapacityType PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  MeasureUnitId BIGINT NULL,
  MeasureUnitTitle NVARCHAR(64) NOT NULL,
  MeasureBasisCode INT NOT NULL CONSTRAINT CK_mes_CapacityType_Basis CHECK (MeasureBasisCode IN (1, 2, 3)),
  CollectionMethodCode INT NOT NULL CONSTRAINT CK_mes_CapacityType_Collection CHECK (CollectionMethodCode IN (1, 2, 3)),
  CalculationFormula NVARCHAR(400) NULL,
  CollectionNote NVARCHAR(400) NULL,
  IsBuiltIn BIT NOT NULL CONSTRAINT DF_mes_CapacityType_IsBuiltIn DEFAULT (0),
  LegacyFieldCode NVARCHAR(32) NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_CapacityType_IsActive DEFAULT (1),
  SortOrder INT NOT NULL CONSTRAINT DF_mes_CapacityType_SortOrder DEFAULT (0),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.WorkCenterCapacity','U') IS NULL
CREATE TABLE mes.WorkCenterCapacity (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkCenterCapacity PRIMARY KEY,
  WorkCenterId BIGINT NULL,
  ResourceGroupId BIGINT NULL,
  CapacityTypeId BIGINT NOT NULL,
  CapacityQuantity DECIMAL(32,10) NOT NULL,
  AvailableCount DECIMAL(32,10) NULL,
  EquipmentAvailPercent DECIMAL(6,2) NOT NULL CONSTRAINT DF_mes_WorkCenterCapacity_EquipmentAvailPercent DEFAULT (100),
  ProductivityPercent DECIMAL(6,2) NOT NULL CONSTRAINT DF_mes_WorkCenterCapacity_ProductivityPercent DEFAULT (100),
  StandardDowntime INT NULL,
  ValidFromDate DATE NOT NULL,
  ValidToDate DATE NULL,
  ChangeReason NVARCHAR(400) NULL,
  ChangedByTitle NVARCHAR(256) NULL,
  Description NVARCHAR(400) NULL,
  CONSTRAINT CK_mes_WorkCenterCapacity_Resource CHECK ((WorkCenterId IS NULL AND ResourceGroupId IS NOT NULL) OR (WorkCenterId IS NOT NULL AND ResourceGroupId IS NULL))
);

IF OBJECT_ID('mes.WorkCenterProductRate','U') IS NULL
CREATE TABLE mes.WorkCenterProductRate (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkCenterProductRate PRIMARY KEY,
  WorkCenterId BIGINT NULL,
  ResourceGroupId BIGINT NULL,
  CapacityTypeId BIGINT NOT NULL,
  ProductId BIGINT NULL,
  ProductPlanningGroupId BIGINT NULL,
  ProductTitle NVARCHAR(256) NOT NULL,
  IsProductGroup BIT NOT NULL CONSTRAINT DF_mes_WorkCenterProductRate_IsProductGroup DEFAULT (0),
  RatePerHour DECIMAL(32,10) NOT NULL,
  RateUnitTitle NVARCHAR(64) NOT NULL,
  EfficiencyFactor DECIMAL(6,4) NOT NULL CONSTRAINT DF_mes_WorkCenterProductRate_EfficiencyFactor DEFAULT (1),
  ValidFromDate DATE NOT NULL,
  ValidToDate DATE NULL,
  ChangeReason NVARCHAR(400) NULL,
  ChangedByTitle NVARCHAR(256) NULL,
  Description NVARCHAR(400) NULL,
  CONSTRAINT CK_mes_WorkCenterProductRate_Resource CHECK ((WorkCenterId IS NULL AND ResourceGroupId IS NOT NULL) OR (WorkCenterId IS NOT NULL AND ResourceGroupId IS NULL))
);

IF OBJECT_ID('mes.CapacityRequirmentScheduling','U') IS NULL
CREATE TABLE mes.CapacityRequirmentScheduling (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_CapacityRequirmentScheduling PRIMARY KEY,
  SiteId BIGINT NULL,
  VersionId BIGINT NULL,
  ProductionPlanningCalendarId BIGINT NULL,
  WorkCenterId BIGINT NOT NULL,
  WorkingShiftId BIGINT NULL,
  CapacityRequirmentId BIGINT NULL,
  Title NVARCHAR(400) NULL,
  WorkOrderId BIGINT NULL,
  OperationId BIGINT NULL,
  FromDatetime DATETIME NULL,
  ToDatetime DATETIME NULL,
  ProductId BIGINT NULL,
  Quantity DECIMAL(32,10) NOT NULL CONSTRAINT DF_mes_CapacityRequirmentScheduling_Quantity DEFAULT (0),
  MeasureUnitId BIGINT NULL,
  MachineLoad DECIMAL(32,10) NOT NULL CONSTRAINT DF_mes_CapacityRequirmentScheduling_MachineLoad DEFAULT (0),
  MachineQty DECIMAL(32,10) NOT NULL CONSTRAINT DF_mes_CapacityRequirmentScheduling_MachineQty DEFAULT (0),
  Description NVARCHAR(400) NULL,
  Remained DECIMAL(32,10) NULL CONSTRAINT DF_mes_CapacityRequirmentScheduling_Remained DEFAULT (0),
  StatusPlanning NVARCHAR(50) NULL,
  SchedulingCode INT NOT NULL CONSTRAINT DF_mes_CapacityRequirmentScheduling_SchedulingCode DEFAULT (1),
  UniqueShiftCode VARCHAR(32) NULL,
  CapacityTypeId BIGINT NULL,
  ProductTitle NVARCHAR(256) NULL,
  WorkOrderNumber NVARCHAR(64) NULL
);
GO

/* -------------------------------------------------------------------
   بخش ۲ — ستون‌های استاندارد پایان جدول، برای هر جدول mes که هنوز ندارد.
   ------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------
   بخش ۳ — توابع
   ------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION mes.fnCapacityResourcesInScope (@OrgNodeId BIGINT, @LineId BIGINT, @StationId BIGINT)
RETURNS TABLE
AS
RETURN
(
  /* منابع ظرفیتِ دامنه‌ی انتخاب: ایستگاه‌های دامنه (بدون بافر) و گروه‌های منبعی که دست‌کم
     یک عضوشان در دامنه است. ظرفیت گروه بین اعضا مشترک است، پس با انتخاب یک ایستگاه، گروهش هم می‌آید. */
  SELECT CAST('station' AS VARCHAR(10)) AS ResourceKind, w.Id AS ResourceId
  FROM mes.WorkCenter w
  WHERE w.IsDeleted = 0 AND w.TopologyTypeCode <> 'buffer'
    AND w.ProductionLineId IN (SELECT LineId FROM mes.fnLinesInScope(@OrgNodeId, @LineId))
    AND (@StationId IS NULL OR w.Id = @StationId)
  UNION ALL
  SELECT CAST('group' AS VARCHAR(10)), g.Id
  FROM mes.ResourceGroup g
  WHERE g.IsDeleted = 0
    AND EXISTS (SELECT 1 FROM mes.WorkCenter w
                WHERE w.ResourceGroupId = g.Id AND w.IsDeleted = 0
                  AND w.ProductionLineId IN (SELECT LineId FROM mes.fnLinesInScope(@OrgNodeId, @LineId))
                  AND (@StationId IS NULL OR w.Id = @StationId))
);
GO

CREATE OR ALTER FUNCTION mes.fnCapacityResourceTitle (@ResourceKind VARCHAR(10), @ResourceId BIGINT)
RETURNS TABLE
AS
RETURN
(
  /* کد، عنوان و خطِ یک منبع ظرفیت. برای گروه منبع: خطوط ایستگاه‌های عضو. */
  SELECT COALESCE(w.Number, g.Number) AS ResourceCode,
         COALESCE(w.Number + N' — ' + w.Name, g.Name) AS ResourceTitle,
         COALESCE(l.Name, gl.LineTitles) AS LineTitle,
         COALESCE(w.ProductionLineId, gl.FirstLineId) AS LineId
  FROM (SELECT 1 AS x) one
  LEFT JOIN mes.WorkCenter w ON @ResourceKind = 'station' AND w.Id = @ResourceId
  LEFT JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
  LEFT JOIN mes.ResourceGroup g ON @ResourceKind = 'group' AND g.Id = @ResourceId
  OUTER APPLY (
    SELECT STRING_AGG(x.Name, N'، ') AS LineTitles, MIN(x.Id) AS FirstLineId
    FROM (SELECT DISTINCT ml.Id, ml.Name
          FROM mes.WorkCenter mw JOIN mes.ProductionLine ml ON ml.Id = mw.ProductionLineId
          WHERE mw.ResourceGroupId = g.Id AND mw.IsDeleted = 0) x
  ) gl
);
GO

/* -------------------------------------------------------------------
   بخش ۴ — رویه‌های خواندن (شناسه‌ها INT برمی‌گردند تا در JSON عدد بمانند)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetCapacityTypes
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(GETDATE() AS DATE);
  SELECT CAST(t.Id AS INT) AS CapacityTypeId, t.Number AS Code, t.Name AS Title, t.MeasureUnitTitle AS UnitTitle,
         t.MeasureBasisCode, t.CollectionMethodCode, t.CalculationFormula, t.CollectionNote,
         t.IsBuiltIn, t.LegacyFieldCode, t.IsActive, t.Description,
         (SELECT COUNT(*) FROM mes.WorkCenterCapacity c
          WHERE c.CapacityTypeId = t.Id AND c.IsDeleted = 0 AND c.ValidFromDate <= @today
            AND (c.ValidToDate IS NULL OR c.ValidToDate >= @today)) AS ResourceCount,
         (SELECT COUNT(*) FROM mes.WorkCenterProductRate p
          WHERE p.CapacityTypeId = t.Id AND p.IsDeleted = 0 AND p.ValidFromDate <= @today
            AND (p.ValidToDate IS NULL OR p.ValidToDate >= @today)) AS ProductRateCount
  FROM mes.CapacityType t
  WHERE t.IsDeleted = 0
  ORDER BY t.SortOrder, t.Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetCapacitiesInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL, @AsOfDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @AsOfDate = ISNULL(@AsOfDate, CAST(GETDATE() AS DATE));
  /* نسخه‌ی جاری (در @AsOfDate) و نسخه‌های آینده‌ی ظرفیتِ منابع دامنه. نسخه‌های گذشته در سابقه می‌آیند. */
  SELECT CAST(c.Id AS INT) AS CapacityId, r.ResourceKind, CAST(r.ResourceId AS INT) AS ResourceId,
         rt.ResourceCode, rt.ResourceTitle, rt.LineTitle,
         CAST(t.Id AS INT) AS CapacityTypeId, t.Number AS TypeCode, t.Name AS TypeTitle, t.MeasureUnitTitle AS UnitTitle,
         t.MeasureBasisCode,
         CAST(c.CapacityQuantity AS DECIMAL(18,2)) AS CapacityQuantity,
         CAST(c.AvailableCount AS DECIMAL(18,2)) AS AvailableCount,
         c.EquipmentAvailPercent, c.ProductivityPercent, c.StandardDowntime,
         c.ValidFromDate, c.ValidToDate,
         CASE WHEN c.ValidFromDate > @AsOfDate THEN 'future' ELSE 'current' END AS VersionStatus,
         CAST(CASE WHEN t.MeasureBasisCode = 3 THEN c.CapacityQuantity
                   ELSE CASE WHEN t.MeasureBasisCode = 1 THEN ISNULL(c.AvailableCount, c.CapacityQuantity) ELSE c.CapacityQuantity END
                        * c.EquipmentAvailPercent / 100 * c.ProductivityPercent / 100 END AS DECIMAL(18,2)) AS EffectivePerHour,
         c.ChangeReason, c.ChangedByTitle, c.Description
  FROM mes.fnCapacityResourcesInScope(@OrgNodeId, @LineId, @StationId) r
  JOIN mes.WorkCenterCapacity c
    ON c.IsDeleted = 0
   AND ((r.ResourceKind = 'station' AND c.WorkCenterId = r.ResourceId) OR (r.ResourceKind = 'group' AND c.ResourceGroupId = r.ResourceId))
   AND (c.ValidToDate IS NULL OR c.ValidToDate >= @AsOfDate)
  JOIN mes.CapacityType t ON t.Id = c.CapacityTypeId AND t.IsDeleted = 0
  CROSS APPLY mes.fnCapacityResourceTitle(r.ResourceKind, r.ResourceId) rt
  ORDER BY rt.LineId, CASE r.ResourceKind WHEN 'station' THEN 0 ELSE 1 END, rt.ResourceCode, t.SortOrder, c.ValidFromDate;
END
GO

CREATE OR ALTER PROCEDURE mes.GetProductRatesInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL, @AsOfDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @AsOfDate = ISNULL(@AsOfDate, CAST(GETDATE() AS DATE));
  SELECT CAST(p.Id AS INT) AS ProductRateId, r.ResourceKind, CAST(r.ResourceId AS INT) AS ResourceId,
         rt.ResourceCode, rt.ResourceTitle, rt.LineTitle,
         t.Number AS TypeCode, t.Name AS TypeTitle,
         p.ProductTitle, p.IsProductGroup,
         CAST(p.RatePerHour AS DECIMAL(18,2)) AS RatePerHour, p.RateUnitTitle, p.EfficiencyFactor,
         CAST(p.RatePerHour * p.EfficiencyFactor AS DECIMAL(18,2)) AS EffectiveRate,
         p.ValidFromDate, p.ValidToDate,
         CASE WHEN p.ValidFromDate > @AsOfDate THEN 'future' ELSE 'current' END AS VersionStatus,
         p.Description
  FROM mes.fnCapacityResourcesInScope(@OrgNodeId, @LineId, @StationId) r
  JOIN mes.WorkCenterProductRate p
    ON p.IsDeleted = 0
   AND ((r.ResourceKind = 'station' AND p.WorkCenterId = r.ResourceId) OR (r.ResourceKind = 'group' AND p.ResourceGroupId = r.ResourceId))
   AND (p.ValidToDate IS NULL OR p.ValidToDate >= @AsOfDate)
  JOIN mes.CapacityType t ON t.Id = p.CapacityTypeId AND t.IsDeleted = 0
  CROSS APPLY mes.fnCapacityResourceTitle(r.ResourceKind, r.ResourceId) rt
  ORDER BY rt.LineId, CASE r.ResourceKind WHEN 'station' THEN 0 ELSE 1 END, rt.ResourceCode, p.IsProductGroup, p.ProductTitle, p.ValidFromDate;
END
GO

CREATE OR ALTER PROCEDURE mes.GetCapacityHistoryInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  /* همه‌ی نسخه‌های ظرفیت و نرخ محصولِ منابع دامنه، با مقدار نسخه‌ی قبلِ همان «منبع × نوع (× محصول)».
     Value برای ظرفیت = ظرفیت مؤثر در ساعت؛ برای نرخ محصول = نرخ × ضریب کارایی. */
  SELECT x.HistoryKind, x.RowId, x.ResourceTitle, x.LineTitle, x.TypeTitle, x.UnitTitle, x.ProductTitle,
         x.ValidFromDate, x.ValidToDate, x.Value,
         LAG(x.Value) OVER (PARTITION BY x.HistoryKind, x.ResourceKind, x.ResourceId, x.CapacityTypeId, x.ProductTitle ORDER BY x.ValidFromDate) AS PreviousValue,
         x.Detail, x.ChangeReason, x.ChangedByTitle
  FROM (
    SELECT 'capacity' AS HistoryKind, CAST(c.Id AS INT) AS RowId, r.ResourceKind, r.ResourceId, c.CapacityTypeId,
           rt.ResourceTitle, rt.LineTitle, t.Name AS TypeTitle, t.MeasureUnitTitle AS UnitTitle, CAST(NULL AS NVARCHAR(256)) AS ProductTitle,
           c.ValidFromDate, c.ValidToDate,
           CAST(CASE WHEN t.MeasureBasisCode = 3 THEN c.CapacityQuantity
                     ELSE CASE WHEN t.MeasureBasisCode = 1 THEN ISNULL(c.AvailableCount, c.CapacityQuantity) ELSE c.CapacityQuantity END
                          * c.EquipmentAvailPercent / 100 * c.ProductivityPercent / 100 END AS DECIMAL(18,2)) AS Value,
           CONCAT(N'مقدار ', FORMAT(c.CapacityQuantity, '0.##'),
                  CASE WHEN c.AvailableCount IS NOT NULL THEN CONCAT(N' · در دسترس ', FORMAT(c.AvailableCount, '0.##')) END,
                  N' · در دسترس‌بودن ', FORMAT(c.EquipmentAvailPercent, '0.##'), N'٪ · بهره‌وری ', FORMAT(c.ProductivityPercent, '0.##'), N'٪') AS Detail,
           c.ChangeReason, c.ChangedByTitle
    FROM mes.fnCapacityResourcesInScope(@OrgNodeId, @LineId, @StationId) r
    JOIN mes.WorkCenterCapacity c
      ON c.IsDeleted = 0
     AND ((r.ResourceKind = 'station' AND c.WorkCenterId = r.ResourceId) OR (r.ResourceKind = 'group' AND c.ResourceGroupId = r.ResourceId))
    JOIN mes.CapacityType t ON t.Id = c.CapacityTypeId
    CROSS APPLY mes.fnCapacityResourceTitle(r.ResourceKind, r.ResourceId) rt
    UNION ALL
    SELECT 'product-rate', CAST(p.Id AS INT), r.ResourceKind, r.ResourceId, p.CapacityTypeId,
           rt.ResourceTitle, rt.LineTitle, t.Name, p.RateUnitTitle + N'/ساعت', p.ProductTitle,
           p.ValidFromDate, p.ValidToDate,
           CAST(p.RatePerHour * p.EfficiencyFactor AS DECIMAL(18,2)),
           CONCAT(N'نرخ ', FORMAT(p.RatePerHour, '#,0.##'), N' · ضریب کارایی ', FORMAT(p.EfficiencyFactor, '0.00##')),
           p.ChangeReason, p.ChangedByTitle
    FROM mes.fnCapacityResourcesInScope(@OrgNodeId, @LineId, @StationId) r
    JOIN mes.WorkCenterProductRate p
      ON p.IsDeleted = 0
     AND ((r.ResourceKind = 'station' AND p.WorkCenterId = r.ResourceId) OR (r.ResourceKind = 'group' AND p.ResourceGroupId = r.ResourceId))
    JOIN mes.CapacityType t ON t.Id = p.CapacityTypeId
    CROSS APPLY mes.fnCapacityResourceTitle(r.ResourceKind, r.ResourceId) rt
  ) x
  ORDER BY x.ValidFromDate DESC, x.ResourceTitle, x.TypeTitle;
END
GO

CREATE OR ALTER PROCEDURE mes.GetCapacityLoadInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL,
  @FromDate DATE = NULL, @Days INT = 14
AS
BEGIN
  SET NOCOUNT ON;
  SET @FromDate = ISNULL(@FromDate, CAST(GETDATE() AS DATE));
  DECLARE @ToDate DATE = DATEADD(DAY, @Days - 1, @FromDate);

  /* ۱) منابع دامنه و خطوطی که زمانشان لازم است (خطوط دامنه + خطوط اعضای گروه‌های منبع) */
  SELECT ResourceKind, ResourceId INTO #res FROM mes.fnCapacityResourcesInScope(@OrgNodeId, @LineId, @StationId);

  SELECT DISTINCT r.ResourceKind, r.ResourceId, w.ProductionLineId AS LineId
  INTO #resLine
  FROM #res r
  JOIN mes.WorkCenter w ON w.IsDeleted = 0
   AND ((r.ResourceKind = 'station' AND w.Id = r.ResourceId) OR (r.ResourceKind = 'group' AND w.ResourceGroupId = r.ResourceId));

  /* ۲) تقویم مؤثر هر خط (همان رویه‌ی FRM-RM-05) و تعداد شیفت هر «خط × روز» */
  CREATE TABLE #eff (CalendarDate DATE, DayOfWeek INT, LineId INT, LineTitle NVARCHAR(256), BaseMinutes INT, BaseOrigin VARCHAR(20),
                     ShiftMinutes INT, ExceptionMinutes INT, MaintenanceMinutes INT, PlannedCount INT, AvailableCount INT,
                     EffectiveMinutes INT, FreeMinutes INT);
  DECLARE @L BIGINT;
  DECLARE lc CURSOR LOCAL FAST_FORWARD FOR SELECT DISTINCT LineId FROM #resLine;
  OPEN lc; FETCH NEXT FROM lc INTO @L;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    INSERT #eff EXEC mes.GetEffectiveCalendarInScope @OrgNodeId = NULL, @LineId = @L, @StationId = NULL, @FromDate = @FromDate, @Days = @Days;
    FETCH NEXT FROM lc INTO @L;
  END
  CLOSE lc; DEALLOCATE lc;

  SELECT ISNULL(g.ProductionLineId, gw.ProductionLineId) AS LineId, c.GregorianDate AS CalendarDate, COUNT(DISTINCT cd.WorkingShiftId) AS ShiftCount
  INTO #shifts
  FROM mes.ProductionCalendarDetail cd
  JOIN mes.ProductionCalendar c ON c.Id = cd.ProductionCalendarId AND c.IsDeleted = 0
  JOIN mes.ProductionWorkingGroup g ON g.Id = cd.WorkingGroupId AND g.IsDeleted = 0
  LEFT JOIN mes.WorkCenter gw ON gw.Id = g.WorkCenterId
  WHERE cd.IsDeleted = 0 AND c.GregorianDate BETWEEN @FromDate AND @ToDate
  GROUP BY ISNULL(g.ProductionLineId, gw.ProductionLineId), c.GregorianDate;

  /* ۳) زمان در دسترس هر منبع در هر روز (گروه: بیشینه‌ی خطوط اعضا) */
  SELECT rl.ResourceKind, rl.ResourceId, e.CalendarDate,
         MAX(e.EffectiveMinutes) AS EffMinutes, MAX(ISNULL(s.ShiftCount, 0)) AS ShiftCount
  INTO #rt
  FROM #resLine rl
  JOIN #eff e ON e.LineId = rl.LineId
  LEFT JOIN #shifts s ON s.LineId = e.LineId AND s.CalendarDate = e.CalendarDate
  GROUP BY rl.ResourceKind, rl.ResourceId, e.CalendarDate;

  /* ۴) ظرفیت روزانه — نسخه‌ی معتبرِ همان روز */
  SELECT t.ResourceKind, t.ResourceId, c.CapacityTypeId, t.CalendarDate,
         CAST(n.NetMinutes / 60.0
              * CASE WHEN ct.MeasureBasisCode = 1 THEN ISNULL(c.AvailableCount, c.CapacityQuantity) ELSE c.CapacityQuantity END
              * c.EquipmentAvailPercent / 100 * c.ProductivityPercent / 100 AS DECIMAL(18,4)) AS CapacityQty
  INTO #cap
  FROM #rt t
  JOIN mes.WorkCenterCapacity c
    ON c.IsDeleted = 0
   AND ((t.ResourceKind = 'station' AND c.WorkCenterId = t.ResourceId) OR (t.ResourceKind = 'group' AND c.ResourceGroupId = t.ResourceId))
   AND c.ValidFromDate <= t.CalendarDate AND (c.ValidToDate IS NULL OR c.ValidToDate >= t.CalendarDate)
  JOIN mes.CapacityType ct ON ct.Id = c.CapacityTypeId AND ct.IsDeleted = 0 AND ct.MeasureBasisCode IN (1, 2)
  CROSS APPLY (SELECT CASE WHEN t.EffMinutes - t.ShiftCount * ISNULL(c.StandardDowntime, 0) > 0
                           THEN t.EffMinutes - t.ShiftCount * ISNULL(c.StandardDowntime, 0) ELSE 0 END AS NetMinutes) n;

  /* ۵) بار زمان‌بندی‌شده، تخصیص‌یافته به ایستگاه یا گروه منبعش */
  DECLARE @machineType BIGINT = (SELECT TOP 1 Id FROM mes.CapacityType WHERE LegacyFieldCode = N'Machine' AND IsDeleted = 0 ORDER BY Id);
  SELECT a.ResourceKind, a.ResourceId, a.CapacityTypeId, a.CalendarDate, SUM(a.LoadQty) AS LoadQty
  INTO #load
  FROM (
    SELECT CASE WHEN own.HasCap = 1 OR grp.HasCap IS NULL THEN 'station' ELSE 'group' END AS ResourceKind,
           CASE WHEN own.HasCap = 1 OR grp.HasCap IS NULL THEN w.Id ELSE w.ResourceGroupId END AS ResourceId,
           ty.TypeId AS CapacityTypeId, CAST(s.FromDatetime AS DATE) AS CalendarDate, s.MachineLoad AS LoadQty
    FROM mes.CapacityRequirmentScheduling s
    JOIN mes.WorkCenter w ON w.Id = s.WorkCenterId AND w.IsDeleted = 0
    CROSS APPLY (SELECT ISNULL(s.CapacityTypeId, @machineType) AS TypeId) ty
    OUTER APPLY (SELECT TOP 1 1 AS HasCap FROM mes.WorkCenterCapacity c
                 WHERE c.WorkCenterId = w.Id AND c.CapacityTypeId = ty.TypeId AND c.IsDeleted = 0) own
    OUTER APPLY (SELECT TOP 1 1 AS HasCap FROM mes.WorkCenterCapacity c
                 WHERE c.ResourceGroupId = w.ResourceGroupId AND c.CapacityTypeId = ty.TypeId AND c.IsDeleted = 0) grp
    WHERE s.IsDeleted = 0 AND CAST(s.FromDatetime AS DATE) BETWEEN @FromDate AND @ToDate
  ) a
  JOIN #res r ON r.ResourceKind = a.ResourceKind AND r.ResourceId = a.ResourceId
  GROUP BY a.ResourceKind, a.ResourceId, a.CapacityTypeId, a.CalendarDate;

  /* ۶) خروجی: یک ردیف به‌ازای «منبع × نوع کارکرد × روز». CapacityQty خالی = برای این بار ظرفیتی تعریف نشده. */
  SELECT k.ResourceKind, CAST(k.ResourceId AS INT) AS ResourceId, rt.ResourceCode, rt.ResourceTitle, rt.LineTitle,
         CAST(k.CapacityTypeId AS INT) AS CapacityTypeId, ct.Number AS TypeCode, ct.Name AS TypeTitle, ct.MeasureUnitTitle AS UnitTitle,
         k.CalendarDate,
         CAST(k.CapacityQty AS DECIMAL(18,2)) AS CapacityQty, CAST(k.LoadQty AS DECIMAL(18,2)) AS LoadQty
  FROM (
    SELECT u.ResourceKind, u.ResourceId, u.CapacityTypeId, u.CalendarDate, SUM(u.CapacityQty) AS CapacityQty, SUM(u.LoadQty) AS LoadQty
    FROM (
      SELECT ResourceKind, ResourceId, CapacityTypeId, CalendarDate, CapacityQty, CAST(0 AS DECIMAL(18,4)) AS LoadQty FROM #cap
      UNION ALL
      SELECT ResourceKind, ResourceId, CapacityTypeId, CalendarDate, NULL, LoadQty FROM #load
    ) u
    GROUP BY u.ResourceKind, u.ResourceId, u.CapacityTypeId, u.CalendarDate
  ) k
  JOIN mes.CapacityType ct ON ct.Id = k.CapacityTypeId
  CROSS APPLY mes.fnCapacityResourceTitle(k.ResourceKind, k.ResourceId) rt
  ORDER BY rt.LineId, CASE k.ResourceKind WHEN 'station' THEN 0 ELSE 1 END, rt.ResourceCode, ct.SortOrder, k.CalendarDate;
END
GO

/* -------------------------------------------------------------------
   بخش ۵ — داده‌ی نمونه (شرکت ۲۲۲). فقط وقتی جدول انواع کارکرد خالی است.
   عمداً خراب: گروه پرس خط ۲ بالای ۱۰۰٪ بار دارد؛ بازرسی بصری خط ۲ بار دارد ولی ظرفیت تعریف‌نشده؛
   بسته‌بندی خط ۱ نزدیک سقف است تا نسخه‌ی آینده‌ی ظرفیتش (ورود دستگاه دوم، ۱ آذر) برسد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.CapacityType)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @L1 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۱');
  DECLARE @L2 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۲');

  INSERT mes.CapacityType (CompanyId, Number, Name, MeasureUnitTitle, MeasureBasisCode, CollectionMethodCode, CalculationFormula, CollectionNote, IsBuiltIn, LegacyFieldCode, IsActive, SortOrder, Description) VALUES
    (@C, N'LAB', N'نفرساعت',        N'ساعت',  1, 1, NULL, N'دستی + حضور و غیاب', 1, N'Labor',   1, 10, N'جانشین NumberOfLabors / LaborLoad نسخه‌ی قبل'),
    (@C, N'MCH', N'ماشین‌ساعت',     N'ساعت',  1, 2, NULL, N'شمارنده‌ی کارکرد دستگاه از PLC', 1, N'Machine', 1, 20, N'جانشین NumberOfEquipments / MachineLoad نسخه‌ی قبل'),
    (@C, N'MLD', N'قالب‌ساعت',      N'ساعت',  1, 3, N'ماشین‌ساعت پرس × تعداد قالب نصب‌شده', NULL, 0, NULL, 1, 30, NULL),
    (@C, N'STR', N'تعداد ضربه',     N'ضربه',  2, 2, NULL, N'شمارنده‌ی ضربه‌ی پرس', 0, NULL, 1, 40, NULL),
    (@C, N'ELC', N'انرژی الکتریکی', N'kWh',   2, 2, NULL, N'کنتور هوشمند تابلوی برق ایستگاه', 0, NULL, 1, 50, NULL),
    (@C, N'STM', N'بخار',           N'kg',    2, 2, NULL, N'فلومتر خط بخار', 0, NULL, 1, 60, NULL),
    (@C, N'AIR', N'هوای فشرده',     N'Nm³',   2, 2, NULL, N'فلومتر کمپرسور مرکزی', 0, NULL, 1, 70, NULL),
    (@C, N'WTR', N'آب',             N'm³',    2, 1, NULL, N'قرائت دستی کنتور در پایان شیفت', 0, NULL, 1, 80, NULL),
    (@C, N'GAS', N'گاز',            N'm³',    2, 1, NULL, NULL, 0, NULL, 0, 90, N'غیرفعال — کوره در کارخانه‌ی ۱ نیست'),
    (@C, N'TNK', N'حجم مخزن',       N'لیتر',  3, 1, NULL, NULL, 0, NULL, 1, 100, NULL),
    (@C, N'ARE', N'مساحت',          N'm²',    3, 1, NULL, NULL, 0, NULL, 1, 110, NULL);

  INSERT mes.WorkCenterCapacity (CompanyId, WorkCenterId, ResourceGroupId, CapacityTypeId, CapacityQuantity, AvailableCount,
                                 EquipmentAvailPercent, ProductivityPercent, StandardDowntime, ValidFromDate, ValidToDate, ChangeReason, ChangedByTitle)
  SELECT @C, w.Id, g.Id, t.Id, v.Qty, v.AvailCount, v.AvailPct, v.ProdPct, v.Downtime, v.ValidFrom, v.ValidTo, v.Reason, v.ChangedBy
  FROM (VALUES
    (1, N'10', NULL,         N'LAB', 2,    2,    95, 90, 30,   CAST('2026-03-21' AS DATE), CAST(NULL AS DATE), N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (1, N'20', NULL,         N'MCH', 1,    1,    92, 90, 45,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (1, N'20', NULL,         N'LAB', 1,    1,   100, 95, 30,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (1, N'20', NULL,         N'ELC', 75,   NULL,100,100, NULL, '2026-03-21', NULL, N'تعریف اولیه', N'کارشناس انرژی'),
    (1, N'20', NULL,         N'STM', 120,  NULL,100,100, NULL, '2026-03-21', NULL, N'تعریف اولیه', N'کارشناس انرژی'),
    (1, N'30', NULL,         N'MCH', 1,    1,    85, 90, 60,   '2025-12-22', '2026-06-21', N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (1, N'30', NULL,         N'MCH', 1,    1,    88, 90, 60,   '2026-06-22', NULL, N'بهبود در دسترس‌بودن پس از تعمیر اساسی پرس', N'مهندس تولید'),
    (1, N'30', NULL,         N'LAB', 1,    1,   100, 95, 30,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (1, N'30', NULL,         N'STR', 3600, NULL,100,100, NULL, '2026-03-21', NULL, N'تعریف اولیه', N'مهندس تولید'),
    (1, N'40', NULL,         N'LAB', 2,    2,   100, 90, 30,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (1, N'50', NULL,         N'MCH', 1,    1,    90, 85, 40,   '2026-03-21', '2026-11-21', N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (1, N'50', NULL,         N'MCH', 2,    2,    90, 85, 40,   '2026-11-22', NULL, N'ورود بلیستر ماشین دوم', N'مدیر فنی'),
    (1, N'50', NULL,         N'LAB', 2,    2,   100, 90, 30,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (2, N'10', NULL,         N'LAB', 2,    2,    95, 90, 30,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (2, N'20', NULL,         N'MCH', 1,    1,    92, 90, 45,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (2, N'20', NULL,         N'LAB', 1,    1,   100, 95, 30,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (2, N'20', NULL,         N'ELC', 90,   NULL,100,100, NULL, '2026-03-21', NULL, N'تعریف اولیه', N'کارشناس انرژی'),
    (2, N'20', NULL,         N'STM', 150,  NULL,100,100, NULL, '2026-03-21', NULL, N'تعریف اولیه', N'کارشناس انرژی'),
    (2, N'20', NULL,         N'TNK', 600,  NULL,100,100, NULL, '2026-03-21', NULL, N'حجم کاسه‌ی میکسر', N'مهندس تولید'),
    (2, NULL,  N'POOL-PRESS', N'MCH', 2,   2,    82, 85, 60,   '2025-09-23', '2026-03-20', N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (2, NULL,  N'POOL-PRESS', N'MCH', 2,   2,    87, 90, 60,   '2026-03-21', NULL, N'تعمیر اساسی پرس‌ها و تعویض برجک', N'مهندس تولید'),
    (2, NULL,  N'POOL-PRESS', N'LAB', 1,   1,   100, 95, 30,   '2026-03-21', NULL, N'یک اپراتور برای هر دو پرس', N'برنامه‌ریز تولید'),
    (2, NULL,  N'POOL-PRESS', N'MLD', 4,   3,   100,100, NULL, '2026-03-21', NULL, N'یک قالب در تعمیر', N'مهندس تولید'),
    (2, N'40', NULL,         N'MCH', 1,    1,    85, 90, 45,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (2, N'40', NULL,         N'LAB', 1,    1,   100, 95, 30,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (2, N'40', NULL,         N'AIR', 300,  NULL,100,100, NULL, '2026-03-21', NULL, N'تعریف اولیه', N'کارشناس انرژی'),
    (2, N'40', NULL,         N'STM', 200,  NULL,100,100, NULL, '2026-03-21', NULL, N'تعریف اولیه', N'کارشناس انرژی'),
    (2, N'50', NULL,         N'MCH', 1,    1,    90, 85, 40,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (2, N'50', NULL,         N'LAB', 3,    3,   100, 90, 30,   '2026-03-21', NULL, N'تعریف اولیه', N'برنامه‌ریز تولید'),
    (2, N'50', NULL,         N'ARE', 60,   NULL,100,100, NULL, '2026-03-21', NULL, N'محوطه‌ی چیدمان کارتن', N'مهندس تولید')
  ) v(LineKey, StationNo, GroupNo, TypeCode, Qty, AvailCount, AvailPct, ProdPct, Downtime, ValidFrom, ValidTo, Reason, ChangedBy)
  JOIN mes.CapacityType t ON t.Number = v.TypeCode
  LEFT JOIN mes.WorkCenter w ON v.StationNo IS NOT NULL AND w.Number = v.StationNo AND w.IsDeleted = 0
       AND w.ProductionLineId = CASE v.LineKey WHEN 1 THEN @L1 ELSE @L2 END
  LEFT JOIN mes.ResourceGroup g ON v.GroupNo IS NOT NULL AND g.Number = v.GroupNo;

  INSERT mes.WorkCenterProductRate (CompanyId, WorkCenterId, ResourceGroupId, CapacityTypeId, ProductTitle, IsProductGroup,
                                    RatePerHour, RateUnitTitle, EfficiencyFactor, ValidFromDate, ValidToDate, ChangeReason, ChangedByTitle)
  SELECT @C, w.Id, g.Id, t.Id, v.Product, v.IsGroup, v.Rate, v.Unit, v.Eff, v.ValidFrom, v.ValidTo, v.Reason, v.ChangedBy
  FROM (VALUES
    (2, NULL,  N'POOL-PRESS', N'قرص سفید ساده',      0, 180000, N'قرص',    0.92, CAST('2025-12-22' AS DATE), CAST(NULL AS DATE), N'تعریف اولیه', N'مهندس تولید'),
    (2, NULL,  N'POOL-PRESS', N'قرص روکش‌پذیر',      0, 150000, N'قرص',    0.88, '2025-12-22', NULL, N'تعریف اولیه', N'مهندس تولید'),
    (2, NULL,  N'POOL-PRESS', N'قرص رنگی',           0, 125000, N'قرص',    0.80, '2025-12-22', '2026-05-21', N'تعریف اولیه', N'مهندس تولید'),
    (2, NULL,  N'POOL-PRESS', N'قرص رنگی',           0, 135000, N'قرص',    0.84, '2026-05-22', NULL, N'بهینه‌سازی تنظیمات پرس برای قرص رنگی', N'مهندس تولید'),
    (1, N'20', NULL,          N'گرانول قرص سفید',    0, 150,    N'kg',     0.90, '2026-03-21', NULL, N'تعریف اولیه', N'مهندس تولید'),
    (1, N'30', NULL,          N'قرص سفید ساده',      0, 90000,  N'قرص',    0.90, '2026-03-21', NULL, N'تعریف اولیه', N'مهندس تولید'),
    (1, N'30', NULL,          N'قرص‌های جوشان',      1, 60000,  N'قرص',    0.85, '2026-03-21', NULL, N'تعریف اولیه برای گروه محصول', N'مهندس تولید'),
    (2, N'50', NULL,          N'بلیستر ۱۰تایی',      0, 1200,   N'بلیستر', 0.95, '2026-03-21', NULL, N'تعریف اولیه', N'مهندس تولید'),
    (2, N'50', NULL,          N'بلیستر ۲۰تایی',      0, 700,    N'بلیستر', 0.93, '2026-03-21', NULL, N'تعریف اولیه', N'مهندس تولید')
  ) v(LineKey, StationNo, GroupNo, Product, IsGroup, Rate, Unit, Eff, ValidFrom, ValidTo, Reason, ChangedBy)
  JOIN mes.CapacityType t ON t.Number = N'MCH'
  LEFT JOIN mes.WorkCenter w ON v.StationNo IS NOT NULL AND w.Number = v.StationNo AND w.IsDeleted = 0
       AND w.ProductionLineId = CASE v.LineKey WHEN 1 THEN @L1 ELSE @L2 END
  LEFT JOIN mes.ResourceGroup g ON v.GroupNo IS NOT NULL AND g.Number = v.GroupNo;

  /* بار نمونه: کسری از ساعت در دسترسِ تقویم مؤثر هر روز، با کمی نوسان روزانه */
  CREATE TABLE #seedEff (CalendarDate DATE, DayOfWeek INT, LineId INT, LineTitle NVARCHAR(256), BaseMinutes INT, BaseOrigin VARCHAR(20),
                         ShiftMinutes INT, ExceptionMinutes INT, MaintenanceMinutes INT, PlannedCount INT, AvailableCount INT,
                         EffectiveMinutes INT, FreeMinutes INT);
  INSERT #seedEff EXEC mes.GetEffectiveCalendarInScope @OrgNodeId = NULL, @LineId = @L1, @StationId = NULL, @FromDate = '2026-10-03', @Days = 90;
  INSERT #seedEff EXEC mes.GetEffectiveCalendarInScope @OrgNodeId = NULL, @LineId = @L2, @StationId = NULL, @FromDate = '2026-10-03', @Days = 90;

  INSERT mes.CapacityRequirmentScheduling (CompanyId, WorkCenterId, CapacityTypeId, Title, WorkOrderNumber, ProductTitle,
                                           FromDatetime, ToDatetime, Quantity, MachineLoad, MachineQty, StatusPlanning, SchedulingCode, UniqueShiftCode)
  SELECT @C, w.Id, CASE WHEN v.TypeCode = N'MCH' THEN NULL ELSE t.Id END,
         N'بار نمونه — ' + v.Product,
         N'WO-' + CONVERT(VARCHAR(8), e.CalendarDate, 112) + N'-' + w.Number,
         v.Product,
         DATEADD(MINUTE, 480, CAST(e.CalendarDate AS DATETIME)),
         DATEADD(MINUTE, 480 + e.EffectiveMinutes, CAST(e.CalendarDate AS DATETIME)),
         0,
         CAST(v.Factor * e.EffectiveMinutes / 60.0 * (0.9 + 0.1 * (DAY(e.CalendarDate) % 3)) AS DECIMAL(18,2)),
         1, N'Planned', 1,
         CONVERT(VARCHAR(8), e.CalendarDate, 112) + '-' + CAST(w.Id AS VARCHAR(10)) + '-' + CAST(v.TypeCode AS VARCHAR(3))
  FROM (VALUES
    (1, N'10',  N'LAB', 1.026, N'قرص سفید ساده'),
    (1, N'20',  N'MCH', 0.455, N'گرانول قرص سفید'),
    (1, N'30',  N'MCH', 0.554, N'قرص سفید ساده'),
    (1, N'50',  N'MCH', 0.630, N'بلیستر ۱۰تایی'),
    (2, N'20',  N'MCH', 0.530, N'گرانول قرص روکش‌پذیر'),
    (2, N'20',  N'ELC', 63.00, N'گرانول قرص روکش‌پذیر'),
    (2, N'30A', N'MCH', 0.740, N'قرص سفید ساده'),
    (2, N'30B', N'MCH', 0.740, N'قرص روکش‌پذیر'),
    (2, N'30A', N'LAB', 0.760, N'قرص سفید ساده'),
    (2, N'40',  N'MCH', 0.597, N'قرص روکش‌دار'),
    (2, N'25',  N'LAB', 1.600, N'قرص روکش‌دار'),
    (2, N'50',  N'MCH', 0.620, N'بلیستر ۲۰تایی')
  ) v(LineKey, StationNo, TypeCode, Factor, Product)
  JOIN mes.CapacityType t ON t.Number = v.TypeCode
  JOIN mes.WorkCenter w ON w.Number = v.StationNo AND w.IsDeleted = 0 AND w.ProductionLineId = CASE v.LineKey WHEN 1 THEN @L1 ELSE @L2 END
  JOIN #seedEff e ON e.LineId = w.ProductionLineId AND e.EffectiveMinutes > 0;

  COMMIT;
END
GO
