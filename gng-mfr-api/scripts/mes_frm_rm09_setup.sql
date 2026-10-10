/* =====================================================================
   اسکیمای mes — گام ۱۱: FRM-RM-09 «مبانی هزینه‌یابی و ABC»

   پیش‌نیاز: mes_frm_rm01 تا mes_frm_pe02 اجرا شده باشند (انواع کارکرد از گام ۶، عملیات از گام ۳).
   قاعده‌ی مدل داده همان است که در سرآغاز mes_frm_rm01_setup.sql آمده.
   یادداشت ALM: «مدل داده در این فاز؛ منطق محاسبه در سیستم بهای تمام‌شده».

   استثنای فاز اول (تصمیم کاربر، ۱۷ مهر ۱۴۰۵): همه‌ی فیچرهای این فرم «مهم، فاز ۳»اند و طبق قاعده باید
   پروتوتایپ می‌ماند؛ کاربر صریحاً ساختنش را خواست.

   نگاشت جدول‌های این گام:
     mes.ProductionActivity        = generalmfr.ProductionActivity + Description، IsActive، SortOrder
                                     (فعالیت ABC؛ ActivityPropertyTypeCode = سطح فعالیت — معنای قدیم منتظر تأیید)
     mes.ProductionOperationActivity = جدید — فعالیت‌های هر عملیات کتابخانه (mes.ProductionOperation). فیلدها از
                                     mfr.RoutingOperationActivity گرفته شده (Sequence، ActivityId، IsMandatory، StandardWorkTime)
                                     ولی در سطح کتابخانه‌ی عملیات است، نه مسیر ساخت.
     mes.ProductionActivityResource = جدید — فعالیت روی کدام ایستگاه یا گروه منبع انجام می‌شود
     mes.CostDriver                = جدید — محرک هزینه‌ی هر فعالیت، با مبنای گردآوری از انواع کارکرد (mes.CapacityType)
                                     و پیکربندی رویداد ارسال به سیستم بهای تمام‌شده (CO)
     mes.SharedResourceAllocation  = جدید — تسهیم منبع مشترک (تجهیز، گروه منبع یا کارکرد/انرژی) بین مراکز هزینه
     mes.CapacityType              + IsCostDriver (F-RM-062). جدول از گام ۶ است؛ ستون این‌جا افزوده می‌شود.
     مرکز هزینه فعلاً متن است (CostCenterTitle، مثل WorkCenter.CostCenterTitle)؛ CostCenterId برای اتصال بعدی به CO.

   فرض‌ها و کدهای موقت تا تأیید/رسیدن کدلیست اصلی:
     ActivityPropertyTypeCode  1 = سطح واحد، 2 = سطح بچ، 3 = سطح محصول، 4 = سطح کارخانه
     CollectionEventCode       1 = ثبت گزارش تولید، 2 = بستن شیفت، 3 = بستن دستور
     SharedResourceKindCode    1 = تجهیز، 2 = گروه منبع، 3 = کارکرد/انرژی
     AllocationMethodCode      1 = ضریب ثابت (SharePercent)، 2 = مقدار واقعی محرک (CostDriverId)
     جمع ضرایب ثابت هر منبع باید ۱۰۰٪ باشد.

   فیچرها: F-RM-060، 061، 062، 064 نمایش داده می‌شوند. گردآوری خودکار مقدار محرک و ارسال رویدادی به CO
   (063) به گزارش تولید نیاز دارد؛ فقط پیکربندی رویدادش نمایش داده می‌شود. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */
IF OBJECT_ID('mes.ProductionActivity','U') IS NULL
CREATE TABLE mes.ProductionActivity (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionActivity PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  ActivityPropertyTypeCode INT NULL,
  Description NVARCHAR(400) NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionActivity_IsActive DEFAULT (1),
  SortOrder INT NOT NULL CONSTRAINT DF_mes_ProductionActivity_SortOrder DEFAULT (0)
);

IF OBJECT_ID('mes.ProductionOperationActivity','U') IS NULL
CREATE TABLE mes.ProductionOperationActivity (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionOperationActivity PRIMARY KEY,
  ProductionOperationId BIGINT NOT NULL,
  ActivityId BIGINT NOT NULL,
  Sequence INT NOT NULL CONSTRAINT DF_mes_ProductionOperationActivity_Sequence DEFAULT (0),
  IsMandatory BIT NULL,
  StandardWorkTime INT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionActivityResource','U') IS NULL
CREATE TABLE mes.ProductionActivityResource (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionActivityResource PRIMARY KEY,
  ActivityId BIGINT NOT NULL,
  WorkCenterId BIGINT NULL,
  ResourceGroupId BIGINT NULL,
  CONSTRAINT CK_mes_ProductionActivityResource_Target CHECK ((WorkCenterId IS NULL AND ResourceGroupId IS NOT NULL) OR (WorkCenterId IS NOT NULL AND ResourceGroupId IS NULL))
);

IF OBJECT_ID('mes.CostDriver','U') IS NULL
CREATE TABLE mes.CostDriver (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_CostDriver PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  ActivityId BIGINT NOT NULL,
  CapacityTypeId BIGINT NOT NULL,
  CollectionEventCode INT NOT NULL CONSTRAINT DF_mes_CostDriver_Event DEFAULT (1)
    CONSTRAINT CK_mes_CostDriver_Event CHECK (CollectionEventCode IN (1, 2, 3)),
  CostSystemEventName NVARCHAR(128) NULL,
  IsEventActive BIT NOT NULL CONSTRAINT DF_mes_CostDriver_IsEventActive DEFAULT (0),
  IsActive BIT NOT NULL CONSTRAINT DF_mes_CostDriver_IsActive DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.SharedResourceAllocation','U') IS NULL
CREATE TABLE mes.SharedResourceAllocation (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_SharedResourceAllocation PRIMARY KEY,
  SharedResourceKindCode INT NOT NULL CONSTRAINT CK_mes_SharedResourceAllocation_Kind CHECK (SharedResourceKindCode IN (1, 2, 3)),
  EquipmentId BIGINT NULL,
  ResourceGroupId BIGINT NULL,
  CapacityTypeId BIGINT NULL,
  CostCenterId BIGINT NULL,
  CostCenterTitle NVARCHAR(100) NOT NULL,
  AllocationMethodCode INT NOT NULL CONSTRAINT CK_mes_SharedResourceAllocation_Method CHECK (AllocationMethodCode IN (1, 2)),
  SharePercent DECIMAL(6,2) NULL,
  CostDriverId BIGINT NULL,
  ValidFromDate DATE NOT NULL,
  ValidToDate DATE NULL,
  Description NVARCHAR(400) NULL,
  CONSTRAINT CK_mes_SharedResourceAllocation_Resource CHECK (
    (SharedResourceKindCode = 1 AND EquipmentId IS NOT NULL) OR (SharedResourceKindCode = 2 AND ResourceGroupId IS NOT NULL)
    OR (SharedResourceKindCode = 3 AND CapacityTypeId IS NOT NULL)),
  CONSTRAINT CK_mes_SharedResourceAllocation_Basis CHECK (
    (AllocationMethodCode = 1 AND SharePercent IS NOT NULL) OR (AllocationMethodCode = 2 AND CostDriverId IS NOT NULL))
);

IF COL_LENGTH('mes.CapacityType', 'IsCostDriver') IS NULL
  ALTER TABLE mes.CapacityType ADD IsCostDriver BIT NOT NULL CONSTRAINT DF_mes_CapacityType_IsCostDriver DEFAULT (0);
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
   بخش ۳ — رویه‌های خواندن (شناسه‌ها INT برمی‌گردند تا در JSON عدد بمانند)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetProductionActivities
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(a.Id AS INT) AS ActivityId, a.Number AS Code, a.Name AS Title, a.ActivityPropertyTypeCode, a.IsActive, a.Description,
         (SELECT STRING_AGG(o.Number + N' ' + o.Name, N'، ') WITHIN GROUP (ORDER BY o.Number)
          FROM mes.ProductionOperationActivity oa JOIN mes.ProductionOperation o ON o.Id = oa.ProductionOperationId
          WHERE oa.ActivityId = a.Id AND oa.IsDeleted = 0) AS Operations,
         (SELECT STRING_AGG(COALESCE(w.Number + N' ' + w.Name + N' (' + l.Name + N')', g.Name + N' (گروه منبع)'), N'، ')
          FROM mes.ProductionActivityResource ar
          LEFT JOIN mes.WorkCenter w ON w.Id = ar.WorkCenterId
          LEFT JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
          LEFT JOIN mes.ResourceGroup g ON g.Id = ar.ResourceGroupId
          WHERE ar.ActivityId = a.Id AND ar.IsDeleted = 0) AS Resources,
         (SELECT STRING_AGG(cc.CostCenterTitle, N'، ')
          FROM (SELECT DISTINCT w.CostCenterTitle
                FROM mes.ProductionActivityResource ar
                JOIN mes.WorkCenter w ON w.IsDeleted = 0 AND (w.Id = ar.WorkCenterId OR w.ResourceGroupId = ar.ResourceGroupId)
                WHERE ar.ActivityId = a.Id AND ar.IsDeleted = 0 AND w.CostCenterTitle IS NOT NULL) cc) AS CostCenters,
         (SELECT COUNT(*) FROM mes.CostDriver d WHERE d.ActivityId = a.Id AND d.IsDeleted = 0 AND d.IsActive = 1) AS DriverCount
  FROM mes.ProductionActivity a
  WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0
  ORDER BY a.SortOrder, a.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetCostDrivers
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(d.Id AS INT) AS DriverId, d.Number AS Code, d.Name AS Title,
         a.Number AS ActivityCode, a.Name AS ActivityTitle,
         t.Number AS TypeCode, t.Name AS TypeTitle, t.MeasureUnitTitle AS UnitTitle, t.CollectionMethodCode, t.IsCostDriver AS TypeAllowed,
         d.CollectionEventCode, d.CostSystemEventName, d.IsEventActive, d.IsActive, d.Description
  FROM mes.CostDriver d
  JOIN mes.ProductionActivity a ON a.Id = d.ActivityId
  JOIN mes.CapacityType t ON t.Id = d.CapacityTypeId
  WHERE d.CompanyId = @CompanyId AND d.IsDeleted = 0
  ORDER BY a.SortOrder, d.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetCostDriverCapacityTypes
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(t.Id AS INT) AS CapacityTypeId, t.Number AS Code, t.Name AS Title, t.MeasureUnitTitle AS UnitTitle,
         t.MeasureBasisCode, t.CollectionMethodCode, t.IsCostDriver, t.IsActive,
         (SELECT STRING_AGG(d.Number, N'، ') FROM mes.CostDriver d WHERE d.CapacityTypeId = t.Id AND d.IsDeleted = 0 AND d.IsActive = 1) AS Drivers
  FROM mes.CapacityType t
  WHERE t.CompanyId = @CompanyId AND t.IsDeleted = 0
  ORDER BY t.SortOrder;
END
GO

CREATE OR ALTER PROCEDURE mes.GetSharedResourceAllocations
  @CompanyId BIGINT, @AsOfDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @AsOfDate = ISNULL(@AsOfDate, CAST(GETDATE() AS DATE));
  /* ردیف‌های تسهیم معتبر در @AsOfDate، با کلید منبع (برای گروه‌بندی) و جمع ضرایب ثابت همان منبع. */
  SELECT CAST(s.Id AS INT) AS AllocationId, s.SharedResourceKindCode,
         CONCAT(s.SharedResourceKindCode, '-', COALESCE(s.EquipmentId, s.ResourceGroupId, s.CapacityTypeId)) AS ResourceKey,
         COALESCE(e.Number + N' — ' + e.Name, g.Number + N' — ' + g.Name, t.Number + N' — ' + t.Name) AS ResourceTitle,
         s.CostCenterTitle, s.AllocationMethodCode, s.SharePercent,
         d.Number AS DriverCode, d.Name AS DriverTitle,
         SUM(CASE WHEN s.AllocationMethodCode = 1 THEN s.SharePercent END)
           OVER (PARTITION BY s.SharedResourceKindCode, COALESCE(s.EquipmentId, s.ResourceGroupId, s.CapacityTypeId)) AS ResourceShareTotal,
         s.ValidFromDate, s.ValidToDate, s.Description
  FROM mes.SharedResourceAllocation s
  LEFT JOIN mes.Equipment e ON e.Id = s.EquipmentId
  LEFT JOIN mes.ResourceGroup g ON g.Id = s.ResourceGroupId
  LEFT JOIN mes.CapacityType t ON t.Id = s.CapacityTypeId
  LEFT JOIN mes.CostDriver d ON d.Id = s.CostDriverId
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0
    AND s.ValidFromDate <= @AsOfDate AND (s.ValidToDate IS NULL OR s.ValidToDate >= @AsOfDate)
  ORDER BY s.SharedResourceKindCode, ResourceTitle, s.CostCenterTitle;
END
GO

/* -------------------------------------------------------------------
   بخش ۴ — داده‌ی نمونه (شرکت ۲۲۲). فقط وقتی جدول فعالیت خالی است.
   عمداً خراب: ضرایب تسهیم هواساز سالن جامدات جمعاً ۹۵٪ است؛ محرک بسته‌بندی بر پایه‌ی «هوای فشرده» است که
   محرک هزینه‌ی مجاز نیست؛ فعالیت «نظافت بین بچ» محرک ندارد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductionActivity)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @L1 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۱');
  DECLARE @L2 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۲');

  /* کارکردهای قابل استفاده به‌عنوان محرک هزینه (F-RM-062) */
  UPDATE mes.CapacityType SET IsCostDriver = 1 WHERE Number IN (N'LAB', N'MCH', N'MLD', N'ELC', N'STM');

  INSERT mes.ProductionActivity (CompanyId, Number, Name, ActivityPropertyTypeCode, SortOrder, Description) VALUES
    (@C, N'ACT-WGH', N'توزین و آماده‌سازی مواد',   1, 10, NULL),
    (@C, N'ACT-GRN', N'گرانولاسیون و خشک‌کردن',    1, 20, NULL),
    (@C, N'ACT-CMP', N'پرس قرص',                  1, 30, NULL),
    (@C, N'ACT-COT', N'روکش‌دهی',                 1, 40, NULL),
    (@C, N'ACT-PKG', N'بسته‌بندی',                1, 50, NULL),
    (@C, N'ACT-SET', N'راه‌اندازی و تعویض',        2, 60, N'به‌ازای هر بچ، مستقل از مقدار تولید'),
    (@C, N'ACT-QC',  N'بازرسی و نمونه‌برداری',     2, 70, NULL),
    (@C, N'ACT-CLN', N'نظافت بین بچ',             2, 80, NULL),
    (@C, N'ACT-HVA', N'تهویه و کنترل محیط GMP',    4, 90, N'هزینه‌ی سطح کارخانه');

  INSERT mes.ProductionOperationActivity (CompanyId, ProductionOperationId, ActivityId, Sequence, IsMandatory)
  SELECT @C, o.Id, a.Id, v.Seq, 1
  FROM (VALUES
    (N'OP-10', N'ACT-WGH', 10), (N'OP-20', N'ACT-GRN', 10), (N'OP-30', N'ACT-CMP', 20), (N'OP-30', N'ACT-SET', 10),
    (N'OP-40', N'ACT-COT', 10), (N'OP-45', N'ACT-QC', 10), (N'OP-50', N'ACT-PKG', 20), (N'OP-50', N'ACT-SET', 10),
    (N'OP-20', N'ACT-CLN', 90), (N'OP-30', N'ACT-CLN', 90)
  ) v(OpNo, ActNo, Seq)
  JOIN mes.ProductionOperation o ON o.Number = v.OpNo
  JOIN mes.ProductionActivity a ON a.Number = v.ActNo;

  INSERT mes.ProductionActivityResource (CompanyId, ActivityId, WorkCenterId, ResourceGroupId)
  SELECT @C, a.Id, w.Id, g.Id
  FROM (VALUES
    (N'ACT-WGH', 1, N'10', NULL), (N'ACT-WGH', 2, N'10', NULL),
    (N'ACT-GRN', 1, N'20', NULL), (N'ACT-GRN', 2, N'20', NULL),
    (N'ACT-CMP', 1, N'30', NULL), (N'ACT-CMP', NULL, NULL, N'POOL-PRESS'),
    (N'ACT-COT', 2, N'40', NULL),
    (N'ACT-PKG', 1, N'50', NULL), (N'ACT-PKG', 2, N'50', NULL),
    (N'ACT-QC',  1, N'40', NULL), (N'ACT-QC', 2, N'25', NULL),
    (N'ACT-SET', NULL, NULL, N'POOL-PRESS'), (N'ACT-SET', 1, N'30', NULL)
  ) v(ActNo, LineKey, StationNo, GroupNo)
  JOIN mes.ProductionActivity a ON a.Number = v.ActNo
  LEFT JOIN mes.WorkCenter w ON v.StationNo IS NOT NULL AND w.Number = v.StationNo AND w.IsDeleted = 0
       AND w.ProductionLineId = CASE v.LineKey WHEN 1 THEN @L1 ELSE @L2 END
  LEFT JOIN mes.ResourceGroup g ON v.GroupNo IS NOT NULL AND g.Number = v.GroupNo;

  INSERT mes.CostDriver (CompanyId, Number, Name, ActivityId, CapacityTypeId, CollectionEventCode, CostSystemEventName, IsEventActive, Description)
  SELECT @C, v.Number, v.Name, a.Id, t.Id, v.EventCode, v.EventName, 0, v.Description
  FROM (VALUES
    (N'DRV-WGH-LAB', N'نفرساعت توزین',              N'ACT-WGH', N'LAB', 1, N'mes.production-report.posted', NULL),
    (N'DRV-GRN-MCH', N'ماشین‌ساعت گرانولاسیون',      N'ACT-GRN', N'MCH', 1, N'mes.production-report.posted', NULL),
    (N'DRV-GRN-ELC', N'برق گرانولاسیون',            N'ACT-GRN', N'ELC', 2, N'mes.shift.closed', N'از کنتور تابلوی برق، در پایان شیفت'),
    (N'DRV-CMP-MCH', N'ماشین‌ساعت پرس',              N'ACT-CMP', N'MCH', 1, N'mes.production-report.posted', NULL),
    (N'DRV-CMP-MLD', N'قالب‌ساعت پرس',               N'ACT-CMP', N'MLD', 1, N'mes.production-report.posted', N'مبنای تسهیم استهلاک قالب'),
    (N'DRV-COT-STM', N'بخار روکش‌دهی',              N'ACT-COT', N'STM', 2, N'mes.shift.closed', NULL),
    (N'DRV-PKG-MCH', N'ماشین‌ساعت بسته‌بندی',         N'ACT-PKG', N'MCH', 1, N'mes.production-report.posted', NULL),
    (N'DRV-PKG-AIR', N'هوای فشرده‌ی بسته‌بندی',       N'ACT-PKG', N'AIR', 2, N'mes.shift.closed', NULL),
    (N'DRV-SET-LAB', N'نفرساعت راه‌اندازی',           N'ACT-SET', N'LAB', 3, N'mes.work-order.closed', N'زمان راه‌اندازی هر بچ'),
    (N'DRV-QC-LAB',  N'نفرساعت بازرسی',              N'ACT-QC',  N'LAB', 1, N'mes.production-report.posted', NULL),
    (N'DRV-HVA-ELC', N'برق تهویه',                   N'ACT-HVA', N'ELC', 2, N'mes.shift.closed', NULL)
  ) v(Number, Name, ActNo, TypeNo, EventCode, EventName, Description)
  JOIN mes.ProductionActivity a ON a.Number = v.ActNo
  JOIN mes.CapacityType t ON t.Number = v.TypeNo;

  INSERT mes.SharedResourceAllocation (CompanyId, SharedResourceKindCode, EquipmentId, ResourceGroupId, CapacityTypeId, CostCenterTitle,
                                       AllocationMethodCode, SharePercent, CostDriverId, ValidFromDate, Description)
  SELECT @C, v.Kind, e.Id, g.Id, t.Id, v.CostCenter, v.Method, v.Share, d.Id, '2026-03-21', v.Description
  FROM (VALUES
    (2, NULL,      N'POOL-PRESS', NULL,  N'CC-2101 جامدات',   1, 70,   NULL,          N'پرس‌ها بیشتر برای قرص ساده'),
    (2, NULL,      N'POOL-PRESS', NULL,  N'CC-2102 بسته‌بندی', 1, 30,   NULL,          N'پرس هسته‌ی قرص روکش‌دار'),
    (1, N'EQ-1900', NULL,         NULL,  N'CC-2101 جامدات',   1, 40,   NULL,          NULL),
    (1, N'EQ-1900', NULL,         NULL,  N'CC-2103 روکش',     1, 35,   NULL,          NULL),
    (1, N'EQ-1900', NULL,         NULL,  N'CC-2104 کیفیت',    1, 20,   NULL,          N'جمع ۹۵٪ — ۵٪ بی‌صاحب'),
    (3, NULL,      NULL,          N'STM', N'CC-2101 جامدات',   2, NULL, N'DRV-GRN-MCH', N'بخار دیگ مرکزی به نسبت ماشین‌ساعت گرانولاسیون'),
    (3, NULL,      NULL,          N'STM', N'CC-2103 روکش',     2, NULL, N'DRV-COT-STM', N'بخار مصرفی واقعی روکش‌دهی')
  ) v(Kind, EqNo, GroupNo, TypeNo, CostCenter, Method, Share, DriverNo, Description)
  LEFT JOIN mes.Equipment e ON v.EqNo IS NOT NULL AND e.Number = v.EqNo
  LEFT JOIN mes.ResourceGroup g ON v.GroupNo IS NOT NULL AND g.Number = v.GroupNo
  LEFT JOIN mes.CapacityType t ON v.TypeNo IS NOT NULL AND t.Number = v.TypeNo
  LEFT JOIN mes.CostDriver d ON v.DriverNo IS NOT NULL AND d.Number = v.DriverNo;

  COMMIT;
END
GO
