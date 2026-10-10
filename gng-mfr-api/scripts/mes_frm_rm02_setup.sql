/* =====================================================================
   اسکیمای mes — گام ۲: FRM-RM-02 «تجهیزات، ابزار و قالب»

   پیش‌نیاز: mes_frm_rm01_setup.sql اجرا شده باشد.
   قاعده‌ی مدل داده همان است که در سرآغاز mes_frm_rm01_setup.sql آمده.

   نگاشت جدول‌های این گام:
     mes.WorkCenterEquipment  = generalmfr.WorkCenterEquipment   (بدون تغییر)
     mes.ToolsProductionGroup = generalmfr.ToolsProductionGroup  (بدون تغییر)
     mes.ToolsProduction      = generalmfr.ToolsProduction       + عمر مفید شمارشی، محل نصب
     mes.Equipment            = جدید — جانشین موقت «اصلِ تجهیز». در نسخه‌ی قبل
                                EquipmentId به جدولی بیرون از mfr/generalmfr
                                (سیستم نت/دارایی) اشاره می‌کند که در این دیتابیس
                                نیست. وقتی آن سیستم وصل شود این جدول با آن جایگزین
                                یا هم‌گام می‌شود.
     mes.EquipmentAttribute، mes.EquipmentCapability، mes.ChangeoverClass،
     mes.ChangeoverTime، mes.EquipmentSoftware                    = جدید (بدون معادل)

     mes.EquipmentAvailability = generalmfr.EquipmentAvailability (بدون تغییر)
                                — وضعیت نت هر تجهیز؛ ردیف جاری = ToDateTime خالی
     mes.EquipmentProduction   = generalmfr.EquipmentProduction   (بدون تغییر؛
                                هنوز هیچ فرمی از آن نمی‌خواند)

   کد موقت وضعیت نت (EquipmentAvailabilityStatusCode) تا رسیدن کدلیست اصلی:
     1 = در دسترس، 2 = تحت تعمیر، 3 = متوقف.
     ستون AvailabilityStatusCode با همان پیش‌فرض نسخه‌ی قبل (30128) نگه داشته
     شده، ولی معنای مقادیرش این‌جا معلوم نیست و استفاده نمی‌شود.

   پوشش فیچر: F-RM-011 تا F-RM-019. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */

-- جدید (جانشین موقت اصلِ تجهیز که مالکیتش با سیستم نت است)
IF OBJECT_ID('mes.Equipment','U') IS NULL
  CREATE TABLE mes.Equipment (
    Id                    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_Equipment PRIMARY KEY,
    Number                NVARCHAR(64)  NULL,
    Name                  NVARCHAR(256) NOT NULL,
    ParentId              BIGINT NULL CONSTRAINT FK_mes_Equipment_Parent REFERENCES mes.Equipment(Id),
    EquipmentTypeTitle    NVARCHAR(64) NULL,
    OrgNodeId             BIGINT NOT NULL CONSTRAINT FK_mes_Equipment_OrgNode REFERENCES mes.OrgNode(Id),
    CumulativeHours       DECIMAL(12,1) NOT NULL CONSTRAINT DF_mes_Equipment_CumulativeHours DEFAULT (0),
    CumulativeUpdatedOn   DATETIME NULL,
    IsActive              BIT NULL CONSTRAINT DF_mes_Equipment_IsActive DEFAULT (1)
  );

-- هم‌نام generalmfr.EquipmentAvailability — همان ستون‌ها
IF OBJECT_ID('mes.EquipmentAvailability','U') IS NULL
  CREATE TABLE mes.EquipmentAvailability (
    Id                              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_EquipmentAvailability PRIMARY KEY,
    EquipmentId                     BIGINT NOT NULL CONSTRAINT FK_mes_EquipmentAvailability_Equipment REFERENCES mes.Equipment(Id),
    AvailabilityStatusCode          BIGINT NOT NULL CONSTRAINT DF_mes_EquipmentAvailability_AvailabilityStatusCode DEFAULT (30128),
    FromDateTime                    DATETIME2 NOT NULL,
    ToDateTime                      DATETIME2 NULL,
    StandardDailyRunTime            BIGINT NULL,
    EquipmentAvailabilityStatusCode INT NULL,      -- موقت تا رسیدن کدلیست اصلی: 1 = در دسترس، 2 = تحت تعمیر، 3 = متوقف
    Description                     NVARCHAR(400) NULL
  );

-- هم‌نام generalmfr.EquipmentProduction — همان ستون‌ها
IF OBJECT_ID('mes.EquipmentProduction','U') IS NULL
  CREATE TABLE mes.EquipmentProduction (
    Id                   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_EquipmentProduction PRIMARY KEY,
    EquipmentId          BIGINT NOT NULL CONSTRAINT FK_mes_EquipmentProduction_Equipment REFERENCES mes.Equipment(Id),
    ValidFromDate        DATE NOT NULL,
    ValidToDate          DATE NULL,
    NoOfOperators        INT NULL,
    OperatorGroupId      BIGINT NULL,
    TechnicalInformation NVARCHAR(MAX) NULL
  );

-- هم‌نام generalmfr.WorkCenterEquipment — همان ستون‌ها
IF OBJECT_ID('mes.WorkCenterEquipment','U') IS NULL
  CREATE TABLE mes.WorkCenterEquipment (
    Id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkCenterEquipment PRIMARY KEY,
    WorkCenterId        BIGINT NOT NULL CONSTRAINT FK_mes_WorkCenterEquipment_WorkCenter REFERENCES mes.WorkCenter(Id),
    EquipmentId         BIGINT NOT NULL CONSTRAINT FK_mes_WorkCenterEquipment_Equipment REFERENCES mes.Equipment(Id),
    ValidFromDate       DATE NOT NULL,
    ValidToDate         DATE NULL,
    NoOfWOSoFar         INT NOT NULL CONSTRAINT DF_mes_WorkCenterEquipment_NoOfWOSoFar DEFAULT (0),
    NoOfProductionSoFar INT NOT NULL CONSTRAINT DF_mes_WorkCenterEquipment_NoOfProductionSoFar DEFAULT (0),
    NoOfHoursSoFar      INT NOT NULL CONSTRAINT DF_mes_WorkCenterEquipment_NoOfHoursSoFar DEFAULT (0),
    ProductivityPercent DECIMAL(6,2) NOT NULL,
    LastOverhaul        DATE NULL,
    IsSubstitute        BIT NULL,
    IsMainEquipment     BIT NULL
  );

-- هم‌نام generalmfr.ToolsProductionGroup — همان ستون‌ها
IF OBJECT_ID('mes.ToolsProductionGroup','U') IS NULL
  CREATE TABLE mes.ToolsProductionGroup (
    Id       BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ToolsProductionGroup PRIMARY KEY,
    Number   NVARCHAR(50)  NULL,
    Name     NVARCHAR(256) NOT NULL,
    ParentId BIGINT NULL,
    [Level]  SMALLINT NULL,
    Chain    HIERARCHYID NULL
  );

-- هم‌نام generalmfr.ToolsProduction — همان ستون‌ها + عمر مفید شمارشی و محل نصب
IF OBJECT_ID('mes.ToolsProduction','U') IS NULL
  CREATE TABLE mes.ToolsProduction (
    Id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ToolsProduction PRIMARY KEY,
    ToolsGroupId        BIGINT NOT NULL CONSTRAINT FK_mes_ToolsProduction_Group REFERENCES mes.ToolsProductionGroup(Id),
    Number              NVARCHAR(50)  NULL,
    Name                NVARCHAR(256) NULL,
    ToolsSerial         NVARCHAR(128) NULL,
    MeasureUnitId       BIGINT NOT NULL CONSTRAINT DF_mes_ToolsProduction_MeasureUnitId DEFAULT (1),
    TechnicalSpec       NVARCHAR(256) NULL,
    ToolsSize           NVARCHAR(256) NULL,
    Model               NVARCHAR(64)  NULL,
    ProductId           BIGINT NULL,
    SiteId              BIGINT NULL,
    ValidFromDate       DATE NULL,
    ValidToDate         DATE NULL,
    UsefulLifeMonth     DECIMAL(8,2) NULL,
    LeftUsefulLifeMonth DECIMAL(8,2) NULL,
    Picture             IMAGE NULL,
    -- افزوده‌ی نسخه‌ی جدید
    OrgNodeId           BIGINT NULL CONSTRAINT FK_mes_ToolsProduction_OrgNode REFERENCES mes.OrgNode(Id),
    EquipmentId         BIGINT NULL CONSTRAINT FK_mes_ToolsProduction_Equipment REFERENCES mes.Equipment(Id), -- NULL = در انبار ابزار
    LifeUnitTitle       NVARCHAR(30) NULL,          -- ضربه / ساعت
    LifeLimit           BIGINT NULL,
    LifeUsed            BIGINT NULL,
    NextServiceAt       BIGINT NULL,
    ServiceTitle        NVARCHAR(50) NULL,
    IsActive            BIT NULL CONSTRAINT DF_mes_ToolsProduction_IsActive DEFAULT (1)
  );

-- جدید: ویژگی فنی، قابلیت، کلاس و زمان تعویض، نسخه‌ی برنامه
IF OBJECT_ID('mes.EquipmentAttribute','U') IS NULL
  CREATE TABLE mes.EquipmentAttribute (
    Id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_EquipmentAttribute PRIMARY KEY,
    EquipmentId      BIGINT NOT NULL CONSTRAINT FK_mes_EquipmentAttribute_Equipment REFERENCES mes.Equipment(Id),
    Name             NVARCHAR(256) NOT NULL,
    Value            NVARCHAR(256) NOT NULL,
    MeasureUnitTitle NVARCHAR(64)  NULL,
    SortOrder        INT NOT NULL CONSTRAINT DF_mes_EquipmentAttribute_SortOrder DEFAULT (0)
  );
IF OBJECT_ID('mes.EquipmentCapability','U') IS NULL
  CREATE TABLE mes.EquipmentCapability (
    Id                        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_EquipmentCapability PRIMARY KEY,
    EquipmentId               BIGINT NOT NULL CONSTRAINT FK_mes_EquipmentCapability_Equipment REFERENCES mes.Equipment(Id),
    OperationName             NVARCHAR(256) NOT NULL,
    ProductRange              NVARCHAR(256) NULL,
    NominalRate               DECIMAL(18,2) NULL,
    RateUnitTitle             NVARCHAR(64)  NULL,
    RequiredToolsProductionId BIGINT NULL CONSTRAINT FK_mes_EquipmentCapability_Tools REFERENCES mes.ToolsProduction(Id),
    RequiredToolsDescription  NVARCHAR(256) NULL,   -- وقتی الزام به «دسته‌ی ابزار» است، نه یک ابزار مشخص
    SortOrder                 INT NOT NULL CONSTRAINT DF_mes_EquipmentCapability_SortOrder DEFAULT (0)
  );
IF OBJECT_ID('mes.ChangeoverClass','U') IS NULL
  CREATE TABLE mes.ChangeoverClass (
    Id        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ChangeoverClass PRIMARY KEY,
    Number    NVARCHAR(64)  NULL,
    Name      NVARCHAR(256) NOT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_mes_ChangeoverClass_SortOrder DEFAULT (0)
  );
IF OBJECT_ID('mes.ChangeoverTime','U') IS NULL
  CREATE TABLE mes.ChangeoverTime (
    Id                    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ChangeoverTime PRIMARY KEY,
    EquipmentId           BIGINT NOT NULL CONSTRAINT FK_mes_ChangeoverTime_Equipment REFERENCES mes.Equipment(Id),
    FromChangeoverClassId BIGINT NOT NULL CONSTRAINT FK_mes_ChangeoverTime_From REFERENCES mes.ChangeoverClass(Id),
    ToChangeoverClassId   BIGINT NOT NULL CONSTRAINT FK_mes_ChangeoverTime_To REFERENCES mes.ChangeoverClass(Id),
    Minutes               INT NOT NULL,
    CONSTRAINT UQ_mes_ChangeoverTime UNIQUE (EquipmentId, FromChangeoverClassId, ToChangeoverClassId),
    CONSTRAINT CK_mes_ChangeoverTime_NoSelf CHECK (FromChangeoverClassId <> ToChangeoverClassId),
    CONSTRAINT CK_mes_ChangeoverTime_Minutes CHECK (Minutes >= 0)
  );
IF OBJECT_ID('mes.EquipmentSoftware','U') IS NULL
  CREATE TABLE mes.EquipmentSoftware (
    Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_EquipmentSoftware PRIMARY KEY,
    EquipmentId    BIGINT NOT NULL CONSTRAINT FK_mes_EquipmentSoftware_Equipment REFERENCES mes.Equipment(Id),
    Name           NVARCHAR(256) NOT NULL,
    CurrentVersion NVARCHAR(64)  NOT NULL,
    LatestVersion  NVARCHAR(64)  NULL,              -- اگر با CurrentVersion فرق کند «نیازمند به‌روزرسانی» است
    UpdatedOn      DATE NULL
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
   بخش ۲-ب — مهاجرت از نسخه‌ی اولیه‌ی همین اسکریپت: اگر ستون موقت
   mes.Equipment.MaintenanceStatusCode هنوز هست، مقدارش به EquipmentAvailability
   منتقل و ستون حذف می‌شود. روی دیتابیس تازه هیچ کاری نمی‌کند.
   ------------------------------------------------------------------- */
IF COL_LENGTH('mes.Equipment','MaintenanceStatusCode') IS NOT NULL
BEGIN
  EXEC(N'
    BEGIN TRAN;
    INSERT mes.EquipmentAvailability (CompanyId, EquipmentId, FromDateTime, EquipmentAvailabilityStatusCode, Description)
    SELECT e.CompanyId, e.Id, ''2026-10-01T06:00:00'',
           CASE e.MaintenanceStatusCode WHEN ''repair'' THEN 2 WHEN ''stopped'' THEN 3 ELSE 1 END,
           CASE e.MaintenanceStatusCode WHEN ''repair'' THEN N''تحت تعمیر — طبق رویداد سیستم نت'' WHEN ''stopped'' THEN N''متوقف — طبق رویداد سیستم نت'' ELSE NULL END
    FROM mes.Equipment e
    WHERE NOT EXISTS (SELECT 1 FROM mes.EquipmentAvailability a WHERE a.EquipmentId = e.Id);
    ALTER TABLE mes.Equipment DROP CONSTRAINT CK_mes_Equipment_MaintenanceStatusCode;
    ALTER TABLE mes.Equipment DROP CONSTRAINT DF_mes_Equipment_MaintenanceStatusCode;
    ALTER TABLE mes.Equipment DROP COLUMN MaintenanceStatusCode;
    COMMIT;');
END
GO

/* -------------------------------------------------------------------
   بخش ۳ — تابع دامنه‌ی انتخاب تجهیز
   ------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION mes.fnEquipmentInScope (@OrgNodeId BIGINT, @LineId BIGINT, @StationId BIGINT)
RETURNS TABLE
AS
RETURN
(
  /* تجهیزات در «دامنه‌ی انتخاب» — دقیق‌ترین سطحی که داده شده برنده است:
     ایستگاه، بعد خط، بعد گره‌ی سازمانی (با همه‌ی زیرگره‌هایش). محل نصب تجهیز
     از تخصیص جاری‌اش در WorkCenterEquipment خوانده می‌شود. */
  SELECT e.Id AS EquipmentId
  FROM mes.Equipment e
  WHERE e.IsDeleted = 0
    AND (
      (@StationId IS NOT NULL AND EXISTS (
          SELECT 1 FROM mes.WorkCenterEquipment x
          WHERE x.EquipmentId = e.Id AND x.WorkCenterId = @StationId AND x.IsDeleted = 0 AND x.ValidToDate IS NULL))
      OR (@StationId IS NULL AND @LineId IS NOT NULL AND EXISTS (
          SELECT 1 FROM mes.WorkCenterEquipment x
          JOIN mes.WorkCenter w ON w.Id = x.WorkCenterId
          WHERE x.EquipmentId = e.Id AND w.ProductionLineId = @LineId AND x.IsDeleted = 0 AND x.ValidToDate IS NULL))
      OR (@StationId IS NULL AND @LineId IS NULL
          AND e.OrgNodeId IN (SELECT OrgNodeId FROM mes.fnOrgNodesUnder(@OrgNodeId)))
    )
)
GO

/* -------------------------------------------------------------------
   بخش ۴ — Stored Procedure ها (فقط خواندنی)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetEquipmentInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(e.Id AS INT) AS EquipmentId, CAST(e.ParentId AS INT) AS ParentEquipmentId, e.Number AS Code, e.Name AS Title,
         e.EquipmentTypeTitle AS EquipmentType, p.Number AS ParentCode, p.Name AS ParentTitle,
         n.Name AS OrgNodeTitle, CAST(loc.LineId AS INT) AS LineId, loc.LineTitle,
         CAST(loc.StationId AS INT) AS StationId, loc.StationCode, loc.StationTitle,
         /* وضعیت نت: ردیف جاری EquipmentAvailability. کدها موقت‌اند تا کدلیست اصلی برسد:
            1 = در دسترس، 2 = تحت تعمیر، 3 = متوقف. تجهیز بدون ردیف، «در دسترس» فرض می‌شود. */
         CASE av.EquipmentAvailabilityStatusCode WHEN 2 THEN 'repair' WHEN 3 THEN 'stopped' ELSE 'available' END AS MaintenanceStatus,
         e.CumulativeHours, e.CumulativeUpdatedOn AS CumulativeUpdatedAt,
         CAST(ISNULL(e.IsActive, 1) AS BIT) AS IsActive
  FROM mes.Equipment e
  JOIN mes.OrgNode n ON n.Id = e.OrgNodeId
  LEFT JOIN mes.Equipment p ON p.Id = e.ParentId
  OUTER APPLY (
    /* محل نصب جاری: تخصیص باز در WorkCenterEquipment */
    SELECT TOP 1 w.Id AS StationId, w.Number AS StationCode, w.Name AS StationTitle, l.Id AS LineId, l.Name AS LineTitle
    FROM mes.WorkCenterEquipment x
    JOIN mes.WorkCenter w ON w.Id = x.WorkCenterId
    LEFT JOIN mes.ProductionLine l ON l.Id = w.ProductionLineId
    WHERE x.EquipmentId = e.Id AND x.IsDeleted = 0 AND x.ValidToDate IS NULL
    ORDER BY x.ValidFromDate DESC, x.Id DESC
  ) loc
  OUTER APPLY (
    SELECT TOP 1 a.EquipmentAvailabilityStatusCode
    FROM mes.EquipmentAvailability a
    WHERE a.EquipmentId = e.Id AND a.IsDeleted = 0 AND a.ToDateTime IS NULL
    ORDER BY a.FromDateTime DESC, a.Id DESC
  ) av
  WHERE e.Id IN (SELECT EquipmentId FROM mes.fnEquipmentInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY e.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetEquipmentAttributesInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(a.Id AS INT) AS EquipmentAttributeId, CAST(a.EquipmentId AS INT) AS EquipmentId,
         e.Number AS EquipmentCode, e.Name AS EquipmentTitle,
         a.Name AS AttributeTitle, a.Value AS ValueText, a.MeasureUnitTitle AS UnitTitle
  FROM mes.EquipmentAttribute a
  JOIN mes.Equipment e ON e.Id = a.EquipmentId
  WHERE a.IsDeleted = 0
    AND a.EquipmentId IN (SELECT EquipmentId FROM mes.fnEquipmentInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY e.Number, a.SortOrder, a.Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetEquipmentCapabilitiesInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(c.Id AS INT) AS EquipmentCapabilityId, CAST(c.EquipmentId AS INT) AS EquipmentId,
         e.Number AS EquipmentCode, e.Name AS EquipmentTitle,
         c.OperationName AS OperationTitle, c.ProductRange AS ProductRangeText, c.NominalRate, c.RateUnitTitle AS RateUnit,
         t.Number AS RequiredToolCode, t.Name AS RequiredToolTitle, c.RequiredToolsDescription AS RequiredToolText
  FROM mes.EquipmentCapability c
  JOIN mes.Equipment e ON e.Id = c.EquipmentId
  LEFT JOIN mes.ToolsProduction t ON t.Id = c.RequiredToolsProductionId
  WHERE c.IsDeleted = 0
    AND c.EquipmentId IN (SELECT EquipmentId FROM mes.fnEquipmentInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY e.Number, c.SortOrder, c.Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetToolsInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  /* ابزار نصب‌شده روی تجهیزاتِ دامنه؛ و اگر دامنه یک گره‌ی سازمانی است، ابزارهای
     نصب‌نشده‌ی (انبار ابزار) همان گره و زیرگره‌هایش هم می‌آیند.
     شمارنده‌ها BIGINT اند؛ به DECIMAL تبدیل می‌شوند تا در JSON عدد بمانند، نه رشته. */
  SELECT CAST(t.Id AS INT) AS ToolId, t.Number AS Code, t.Name AS Title, g.Name AS ToolType,
         CAST(t.EquipmentId AS INT) AS EquipmentId, e.Number AS EquipmentCode, e.Name AS EquipmentTitle,
         n.Name AS OrgNodeTitle, t.LifeUnitTitle AS LifeUnit,
         CAST(t.LifeLimit AS DECIMAL(18,0)) AS LifeLimit, CAST(t.LifeUsed AS DECIMAL(18,0)) AS LifeUsed,
         CAST(t.NextServiceAt AS DECIMAL(18,0)) AS NextServiceAt, t.ServiceTitle,
         CAST(ROUND(100.0 * t.LifeUsed / NULLIF(t.LifeLimit, 0), 0) AS INT) AS LifePercent,
         CAST(ISNULL(t.IsActive, 1) AS BIT) AS IsActive
  FROM mes.ToolsProduction t
  JOIN mes.ToolsProductionGroup g ON g.Id = t.ToolsGroupId
  LEFT JOIN mes.OrgNode n ON n.Id = t.OrgNodeId
  LEFT JOIN mes.Equipment e ON e.Id = t.EquipmentId
  WHERE t.IsDeleted = 0
    AND (t.EquipmentId IN (SELECT EquipmentId FROM mes.fnEquipmentInScope(@OrgNodeId, @LineId, @StationId))
      OR (t.EquipmentId IS NULL AND @LineId IS NULL AND @StationId IS NULL
          AND t.OrgNodeId IN (SELECT OrgNodeId FROM mes.fnOrgNodesUnder(@OrgNodeId))))
  ORDER BY t.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetChangeoverInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(x.EquipmentId AS INT) AS EquipmentId, e.Number AS EquipmentCode, e.Name AS EquipmentTitle,
         CAST(x.FromChangeoverClassId AS INT) AS FromClassId, f.Name AS FromTitle, f.SortOrder AS FromSort,
         CAST(x.ToChangeoverClassId AS INT) AS ToClassId, t.Name AS ToTitle, t.SortOrder AS ToSort, x.Minutes
  FROM mes.ChangeoverTime x
  JOIN mes.Equipment e ON e.Id = x.EquipmentId
  JOIN mes.ChangeoverClass f ON f.Id = x.FromChangeoverClassId
  JOIN mes.ChangeoverClass t ON t.Id = x.ToChangeoverClassId
  WHERE x.IsDeleted = 0
    AND x.EquipmentId IN (SELECT EquipmentId FROM mes.fnEquipmentInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY e.Number, f.SortOrder, t.SortOrder;
END
GO

CREATE OR ALTER PROCEDURE mes.GetEquipmentSoftwareInScope
  @OrgNodeId BIGINT = NULL, @LineId BIGINT = NULL, @StationId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(w.Id AS INT) AS EquipmentSoftwareId, CAST(w.EquipmentId AS INT) AS EquipmentId,
         e.Number AS EquipmentCode, e.Name AS EquipmentTitle,
         w.Name AS SoftwareTitle, w.CurrentVersion, w.LatestVersion, w.UpdatedOn,
         CAST(CASE WHEN w.LatestVersion IS NULL OR w.LatestVersion = w.CurrentVersion THEN 1 ELSE 0 END AS BIT) AS IsUpToDate
  FROM mes.EquipmentSoftware w
  JOIN mes.Equipment e ON e.Id = w.EquipmentId
  WHERE w.IsDeleted = 0
    AND w.EquipmentId IN (SELECT EquipmentId FROM mes.fnEquipmentInScope(@OrgNodeId, @LineId, @StationId))
  ORDER BY e.Number, w.Name;
END
GO

/* -------------------------------------------------------------------
   بخش ۵ — داده‌ی نمونه (CompanyId = 222، سالن جامدات)
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.Equipment WHERE CompanyId = 222)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @Hall BIGINT = (SELECT Id FROM mes.OrgNode WHERE CompanyId = @C AND Name = N'سالن جامدات');
  DECLARE @L1 BIGINT = (SELECT Id FROM mes.ProductionLine WHERE CompanyId = @C AND Number = N'L1-TABLET');
  DECLARE @L2 BIGINT = (SELECT Id FROM mes.ProductionLine WHERE CompanyId = @C AND Number = N'L2-TABLET');
  DECLARE @ToolGroup BIGINT;

  -- (کد، عنوان، نوع، کد والد، خط، شماره‌ی ایستگاه، وضعیت نت، کارکرد تجمعی)
  DECLARE @Eq TABLE (Number NVARCHAR(64), Name NVARCHAR(256), TypeTitle NVARCHAR(64), ParentNumber NVARCHAR(64), LineId BIGINT, StationNumber NVARCHAR(64), StatusCode NVARCHAR(20), Hours DECIMAL(12,1));
  INSERT @Eq VALUES
    (N'EQ-1010',    N'میکسر گرانولاتور شماره ۱', N'میکسر',     NULL,       @L1, N'20',  'available', 21450.0),
    (N'EQ-1020',    N'پرس تک‌ایستگاه',           N'پرس',       NULL,       @L1, N'30',  'repair',    30212.5),
    (N'EQ-1030',    N'بلیستر ماشین ۱',           N'بسته‌بندی', NULL,       @L1, N'50',  'available', 15980.0),
    (N'EQ-1040',    N'ترازوی توزین دقیق',        N'توزین',     NULL,       @L2, N'10',  'available',  9120.0),
    (N'EQ-1042',    N'میکسر گرانولاتور شماره ۳', N'میکسر',     NULL,       @L2, N'20',  'available', 18320.0),
    (N'EQ-1055',    N'پرس روتاری A',             N'پرس',       NULL,       @L2, N'30A', 'available', 12760.5),
    (N'EQ-1056',    N'پرس روتاری B',             N'پرس',       NULL,       @L2, N'30B', 'available', 11890.0),
    (N'EQ-1071',    N'دستگاه کوتینگ',            N'روکش‌دهی',  NULL,       @L2, N'40',  'stopped',   14305.0),
    (N'EQ-1088',    N'بلیستر ماشین ۲',           N'بسته‌بندی', NULL,       @L2, N'50',  'available',  8440.0),
    (N'EQ-1900',    N'هواساز سالن جامدات',       N'تأسیسات',   NULL,       NULL, NULL,  'available', 41200.0),
    (N'EQ-1042-01', N'موتور گیربکس',             N'زیرمجموعه', N'EQ-1042', @L2, N'20',  'available', 18320.0),
    (N'EQ-1042-02', N'سیستم پاشش',               N'زیرمجموعه', N'EQ-1042', @L2, N'20',  'available',  6540.0),
    (N'EQ-1055-01', N'برجک (Turret)',            N'زیرمجموعه', N'EQ-1055', @L2, N'30A', 'available', 12760.5);

  INSERT mes.Equipment (CompanyId, Number, Name, EquipmentTypeTitle, OrgNodeId, CumulativeHours, CumulativeUpdatedOn)
  SELECT @C, Number, Name, TypeTitle, @Hall, Hours, '2026-10-01T06:00:00' FROM @Eq;

  -- وضعیت نت جاری هر تجهیز (ردیف باز در EquipmentAvailability)
  INSERT mes.EquipmentAvailability (CompanyId, EquipmentId, FromDateTime, EquipmentAvailabilityStatusCode, Description)
  SELECT @C, e.Id, '2026-10-01T06:00:00',
         CASE v.StatusCode WHEN 'repair' THEN 2 WHEN 'stopped' THEN 3 ELSE 1 END,
         CASE v.StatusCode WHEN 'repair' THEN N'تحت تعمیر — طبق رویداد سیستم نت' WHEN 'stopped' THEN N'متوقف — طبق رویداد سیستم نت' ELSE NULL END
  FROM @Eq v
  JOIN mes.Equipment e ON e.CompanyId = @C AND e.Number = v.Number;

  UPDATE c SET ParentId = p.Id
  FROM mes.Equipment c
  JOIN @Eq v ON v.Number = c.Number AND v.ParentNumber IS NOT NULL
  JOIN mes.Equipment p ON p.CompanyId = @C AND p.Number = v.ParentNumber
  WHERE c.CompanyId = @C;

  -- تخصیص تجهیز به ایستگاه (محل نصب)
  INSERT mes.WorkCenterEquipment (CompanyId, WorkCenterId, EquipmentId, ValidFromDate, NoOfHoursSoFar, ProductivityPercent, IsMainEquipment)
  SELECT @C, w.Id, e.Id, '2024-01-01', CAST(ROUND(v.Hours, 0) AS INT), 100, CASE WHEN v.ParentNumber IS NULL THEN 1 ELSE 0 END
  FROM @Eq v
  JOIN mes.Equipment e ON e.CompanyId = @C AND e.Number = v.Number
  JOIN mes.WorkCenter w ON w.ProductionLineId = v.LineId AND w.Number = v.StationNumber;

  INSERT mes.EquipmentAttribute (CompanyId, EquipmentId, Name, Value, MeasureUnitTitle, SortOrder)
  SELECT @C, e.Id, v.Name, v.Value, v.UnitTitle, v.SortOrder
  FROM (VALUES
    (N'EQ-1055', N'تعداد پانچ',       N'۳۶',      N'عدد',      1),
    (N'EQ-1055', N'حداکثر سرعت',      N'۱۸۰٬۰۰۰', N'قرص/ساعت', 2),
    (N'EQ-1055', N'حداکثر نیروی پرس', N'۸۰',      N'kN',       3),
    (N'EQ-1056', N'تعداد پانچ',       N'۳۶',      N'عدد',      1),
    (N'EQ-1056', N'حداکثر سرعت',      N'۱۸۰٬۰۰۰', N'قرص/ساعت', 2),
    (N'EQ-1042', N'ظرفیت مخزن',       N'۵۰۰',     N'kg',       1),
    (N'EQ-1010', N'ظرفیت مخزن',       N'۳۰۰',     N'kg',       1),
    (N'EQ-1020', N'حداکثر سرعت',      N'۴۰٬۰۰۰',  N'قرص/ساعت', 1),
    (N'EQ-1071', N'حجم پن',           N'۲۵۰',     N'لیتر',     1),
    (N'EQ-1040', N'دقت توزین',        N'۰٫۱',     N'g',        1),
    (N'EQ-1900', N'کلاس تمیزی',       N'D',       N'GMP',      1)
  ) v(Number, Name, Value, UnitTitle, SortOrder)
  JOIN mes.Equipment e ON e.CompanyId = @C AND e.Number = v.Number;

  INSERT mes.ToolsProductionGroup (CompanyId, Number, Name, [Level]) VALUES (@C, N'MOLD', N'قالب', 1);
  SET @ToolGroup = SCOPE_IDENTITY();

  INSERT mes.ToolsProduction (CompanyId, ToolsGroupId, Number, Name, OrgNodeId, EquipmentId, LifeUnitTitle, LifeLimit, LifeUsed, NextServiceAt, ServiceTitle, IsActive)
  SELECT @C, @ToolGroup, v.Number, v.Name, @Hall, e.Id, N'ضربه', v.LifeLimit, v.LifeUsed, v.NextServiceAt, v.ServiceTitle, 1
  FROM (VALUES
    (N'TL-101', N'قالب پانچ ۸ mm',         N'EQ-1020', CAST(1500000 AS BIGINT), CAST(1215000 AS BIGINT), CAST(1300000 AS BIGINT), N'تیزکاری'),
    (N'TL-204', N'قالب پانچ ۱۲ mm',        N'EQ-1055', 360000,  260000,  300000,  N'تیزکاری'),
    (N'TL-205', N'قالب پانچ ۱۰ mm',        N'EQ-1055', 2800000, 2550000, NULL,    NULL),
    (N'TL-206', N'قالب پانچ ۱۰ mm — یدک',  N'EQ-1056', 2800000, 420000,  1000000, N'تیزکاری'),
    (N'TL-311', N'قالب کپسول',             NULL,       5000000, 1700000, NULL,    NULL)
  ) v(Number, Name, EquipmentNumber, LifeLimit, LifeUsed, NextServiceAt, ServiceTitle)
  LEFT JOIN mes.Equipment e ON e.CompanyId = @C AND e.Number = v.EquipmentNumber;

  INSERT mes.EquipmentCapability (CompanyId, EquipmentId, OperationName, ProductRange, NominalRate, RateUnitTitle, RequiredToolsProductionId, RequiredToolsDescription, SortOrder)
  SELECT @C, e.Id, v.OperationName, v.ProductRange, v.NominalRate, v.RateUnitTitle, t.Id, v.ToolsDescription, v.SortOrder
  FROM (VALUES
    (N'EQ-1055', N'پرس — قرص جامد بدون روکش', N'۸ – ۱۴ mm',       180000, N'قرص/ساعت',     NULL,      N'قالب پانچ متناظر با قطر', 1),
    (N'EQ-1055', N'پرس — قرص روکش‌پذیر',      N'۱۰ – ۱۴ mm',      150000, N'قرص/ساعت',     N'TL-204', NULL, 2),
    (N'EQ-1056', N'پرس — قرص جامد بدون روکش', N'۸ – ۱۴ mm',       180000, N'قرص/ساعت',     NULL,      N'قالب پانچ متناظر با قطر', 1),
    (N'EQ-1020', N'پرس — سری آزمایشی',        N'۶ – ۱۰ mm',        40000, N'قرص/ساعت',     N'TL-101', NULL, 1),
    (N'EQ-1042', N'گرانولاسیون مرطوب',        N'بچ ۲۰۰ – ۵۰۰ kg',      2, N'بچ/ساعت',      NULL,      NULL, 1),
    (N'EQ-1010', N'گرانولاسیون مرطوب',        N'بچ ۱۰۰ – ۳۰۰ kg',      2, N'بچ/ساعت',      NULL,      NULL, 1),
    (N'EQ-1071', N'روکش‌دهی فیلم',            N'بچ تا ۲۵۰ لیتر',       1, N'بچ/ساعت',      NULL,      NULL, 1),
    (N'EQ-1088', N'بلیسترینگ ۱۰تایی',         N'قرص ۸ – ۱۴ mm',      240, N'بلیستر/دقیقه', NULL,      NULL, 1)
  ) v(Number, OperationName, ProductRange, NominalRate, RateUnitTitle, ToolNumber, ToolsDescription, SortOrder)
  JOIN mes.Equipment e ON e.CompanyId = @C AND e.Number = v.Number
  LEFT JOIN mes.ToolsProduction t ON t.CompanyId = @C AND t.Number = v.ToolNumber;

  INSERT mes.ChangeoverClass (CompanyId, Number, Name, SortOrder) VALUES
    (@C, N'TAB-WHITE',  N'قرص سفید',     1),
    (@C, N'TAB-COATED', N'قرص روکش‌دار', 2),
    (@C, N'TAB-COLOR',  N'قرص رنگی',     3),
    (@C, N'CAPSULE',    N'کپسول',        4);

  INSERT mes.ChangeoverTime (CompanyId, EquipmentId, FromChangeoverClassId, ToChangeoverClassId, Minutes)
  SELECT @C, e.Id, f.Id, t.Id, v.Minutes
  FROM (VALUES
    (N'EQ-1055', N'TAB-WHITE',  N'TAB-COATED', 25), (N'EQ-1055', N'TAB-WHITE',  N'TAB-COLOR',  45), (N'EQ-1055', N'TAB-WHITE',  N'CAPSULE',   90),
    (N'EQ-1055', N'TAB-COATED', N'TAB-WHITE',  90), (N'EQ-1055', N'TAB-COATED', N'TAB-COLOR',  35), (N'EQ-1055', N'TAB-COATED', N'CAPSULE',   20),
    (N'EQ-1055', N'TAB-COLOR',  N'TAB-WHITE',  95), (N'EQ-1055', N'TAB-COLOR',  N'TAB-COATED', 30), (N'EQ-1055', N'TAB-COLOR',  N'CAPSULE',   40),
    (N'EQ-1055', N'CAPSULE',    N'TAB-WHITE',  90), (N'EQ-1055', N'CAPSULE',    N'TAB-COATED', 85), (N'EQ-1055', N'CAPSULE',    N'TAB-COLOR', 85),
    (N'EQ-1071', N'TAB-COATED', N'TAB-COLOR',  60), (N'EQ-1071', N'TAB-COLOR',  N'TAB-COATED', 120)
  ) v(Number, FromNumber, ToNumber, Minutes)
  JOIN mes.Equipment e ON e.CompanyId = @C AND e.Number = v.Number
  JOIN mes.ChangeoverClass f ON f.CompanyId = @C AND f.Number = v.FromNumber
  JOIN mes.ChangeoverClass t ON t.CompanyId = @C AND t.Number = v.ToNumber;

  INSERT mes.EquipmentSoftware (CompanyId, EquipmentId, Name, CurrentVersion, LatestVersion, UpdatedOn)
  SELECT @C, e.Id, v.Name, v.CurrentVersion, v.LatestVersion, v.UpdatedOn
  FROM (VALUES
    (N'EQ-1055', N'PLC-FW', N'4.2.1', N'4.2.1', CAST('2026-05-31' AS DATE)),
    (N'EQ-1056', N'PLC-FW', N'4.2.1', N'4.2.1', '2026-05-31'),
    (N'EQ-1071', N'HMI',    N'2.8.0', N'3.0.0', '2026-01-22'),
    (N'EQ-1088', N'PLC-FW', N'1.9.4', N'1.9.4', '2025-11-12')
  ) v(Number, Name, CurrentVersion, LatestVersion, UpdatedOn)
  JOIN mes.Equipment e ON e.CompanyId = @C AND e.Number = v.Number;
  COMMIT;
  PRINT N'داده‌ی نمونه‌ی تجهیزات، ابزار و قالب (CompanyId=222) درج شد';
END
GO
