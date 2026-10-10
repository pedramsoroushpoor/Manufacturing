/* =====================================================================
   اسکیمای mes — گام ۱: FRM-RM-01 «ساختار کارخانه و خطوط تولید»

   قاعده‌ی مدل داده (تصمیم پروژه):
     ۱) همه‌ی جدول‌های سیستم تولید جدید در اسکیمای mes ساخته می‌شوند؛ تفکیک
        mfr / generalmfr در نسخه‌ی جدید وجود ندارد.
     ۲) اگر جدولی در mfr یا generalmfr معادل دارد، با همان نام و همان ستون‌ها
        ساخته می‌شود و ستون‌های تازه فقط به انتهایش اضافه می‌شوند. جدول کاملاً
        تازه فقط وقتی ساخته می‌شود که معادلی وجود نداشته باشد — با همان
        قراردادهای نام‌گذاری (Id، Number، Name، ParentId، ValidFromDate، …Code).
     ۳) همه‌ی جدول‌ها ستون‌های استاندارد پایان جدول را دارند: CompanyId،
        BranchId، RecGuid، OwnerId، CreatedBy، CreatedOn، ModifiedBy،
        ModifiedOn، StateCode، IsDeleted، RowVersion.

   نگاشت جدول‌های این گام:
     mes.ProductionLine       = generalmfr.ProductionLine      + OrgNodeId
     mes.ProductionLineHead   = generalmfr.ProductionLineHead  + HeadTitle، IsBackup
     mes.WorkCenter           = generalmfr.WorkCenter          + پیوند به خط و مشخصات ایستگاه
     mes.ProductionLineInventory = generalmfr.ProductionLineInventory (بدون تغییر؛
                                هنوز هیچ فرمی از آن نمی‌خواند)
     mes.OrgNode، mes.WorkCenterLink، mes.ResourceGroup، mes.ResourceGroupMember،
     mes.LineSideInventory، mes.MobileResource                 = جدید (بدون معادل)

   تفاوت‌های ناگزیر با نسخه‌ی قبل:
     - چند ستون که در نسخه‌ی قبل NOT NULL بودند و به جدول‌های بیرون از این
       دیتابیس اشاره می‌کنند (SiteId، HeadPartyId، LaborClassCode،
       WorkCenterTypeCode) این‌جا NULL-پذیرند.
     - جدول‌های mfr/generalmfr در این دیتابیس PK و FK ندارند؛ در mes اضافه شده‌اند.

   SP ها شناسه‌ها را به INT برمی‌گردانند، چون BIGINT در JSON به‌صورت رشته
   منتقل می‌شود و رابط کاربری شناسه‌ها را عدد می‌خواهد.

   این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF SCHEMA_ID('mes') IS NULL EXEC('CREATE SCHEMA mes');
GO

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */

-- جدید (معادل در mfr/generalmfr ندارد): سلسله‌مراتب سازمانی و مکانی بالاتر از خط
IF OBJECT_ID('mes.OrgNode','U') IS NULL
  CREATE TABLE mes.OrgNode (
    Id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_OrgNode PRIMARY KEY,
    Number      NVARCHAR(64)  NULL,
    Name        NVARCHAR(256) NOT NULL,
    ParentId    BIGINT NULL CONSTRAINT FK_mes_OrgNode_Parent REFERENCES mes.OrgNode(Id),
    LevelCode   NVARCHAR(20)  NOT NULL,   -- Group / Holding / Company / Branch / Factory / Unit
    SiteId      BIGINT NULL,              -- پیوند به «سایت» سیستم پایه، در صورت وجود
    OwnerTitle  NVARCHAR(256) NULL,
    BackupTitle NVARCHAR(256) NULL,
    IsActive    BIT NULL CONSTRAINT DF_mes_OrgNode_IsActive DEFAULT (1),
    ValidToDate DATE NULL
  );

-- هم‌نام generalmfr.ProductionLine — همان ستون‌ها + OrgNodeId
IF OBJECT_ID('mes.ProductionLine','U') IS NULL
  CREATE TABLE mes.ProductionLine (
    Id                        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionLine PRIMARY KEY,
    Number                    NVARCHAR(50)  NULL,
    Name                      NVARCHAR(256) NOT NULL,
    SiteId                    BIGINT NULL,            -- در نسخه‌ی قبل NOT NULL بود؛ جای آن را OrgNodeId می‌گیرد
    NumberOfWorkers           INT NULL,
    NumberOfEquipments        INT NULL,
    IsAutomaticBatchNumber    BIT NULL CONSTRAINT DF_mes_ProductionLine_IsAutomaticBatchNumber DEFAULT (0),
    Description               NVARCHAR(400) NULL,
    MaxDayOpenWorkOrdersCount INT NULL,
    IsActive                  BIT NULL,
    MaxOpenWorkOrdersCount    INT NULL,
    IsCheckOpenWorkOrders     BIT NOT NULL CONSTRAINT DF_mes_ProductionLine_IsCheckOpenWorkOrders DEFAULT (0),
    ScheduleRealeseCode       BIGINT NULL,
    IsOutsourced              BIT NULL,
    -- افزوده‌ی نسخه‌ی جدید
    OrgNodeId                 BIGINT NULL CONSTRAINT FK_mes_ProductionLine_OrgNode REFERENCES mes.OrgNode(Id)
  );

-- هم‌نام generalmfr.ProductionLineHead — همان ستون‌ها + HeadTitle و IsBackup
IF OBJECT_ID('mes.ProductionLineHead','U') IS NULL
  CREATE TABLE mes.ProductionLineHead (
    Id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionLineHead PRIMARY KEY,
    ProductionLineId BIGINT NOT NULL CONSTRAINT FK_mes_ProductionLineHead_Line REFERENCES mes.ProductionLine(Id),
    LaborClassCode   INT NULL,              -- در نسخه‌ی قبل NOT NULL؛ کدلیست آن بیرون از این دیتابیس است
    HeadPartyId      BIGINT NULL,           -- در نسخه‌ی قبل NOT NULL؛ جدول طرف‌حساب بیرون از این دیتابیس است
    ValidFromDate    DATE NOT NULL,
    ValidToDate      DATE NULL,
    IsCurrentHead    BIT NOT NULL,
    -- افزوده‌ی نسخه‌ی جدید
    HeadTitle        NVARCHAR(256) NULL,
    IsBackup         BIT NOT NULL CONSTRAINT DF_mes_ProductionLineHead_IsBackup DEFAULT (0)
  );

-- جدید: گروه منبع (استخر منابع هم‌ارز) و اعضایش
IF OBJECT_ID('mes.ResourceGroup','U') IS NULL
  CREATE TABLE mes.ResourceGroup (
    Id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ResourceGroup PRIMARY KEY,
    Number       NVARCHAR(64)  NULL,
    Name         NVARCHAR(256) NOT NULL,
    DispatchRule NVARCHAR(256) NULL
  );
IF OBJECT_ID('mes.ResourceGroupMember','U') IS NULL
  CREATE TABLE mes.ResourceGroupMember (
    Id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ResourceGroupMember PRIMARY KEY,
    ResourceGroupId BIGINT NOT NULL CONSTRAINT FK_mes_ResourceGroupMember_Group REFERENCES mes.ResourceGroup(Id),
    Name            NVARCHAR(256) NOT NULL,
    EquipmentId     BIGINT NULL,
    SortOrder       INT NOT NULL CONSTRAINT DF_mes_ResourceGroupMember_SortOrder DEFAULT (0)
  );

-- جدید: انبار پای کار (تعریف؛ نگاشت تراکنشی خط↔انبار بعداً با ProductionLineInventory می‌آید)
IF OBJECT_ID('mes.LineSideInventory','U') IS NULL
  CREATE TABLE mes.LineSideInventory (
    Id                       BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_LineSideInventory PRIMARY KEY,
    Number                   NVARCHAR(64)  NULL,
    Name                     NVARCHAR(256) NOT NULL,
    InventoryId              BIGINT NULL,           -- انبار واقعی در سیستم انبار
    ReferenceInventoryNumber NVARCHAR(128) NULL
  );

-- هم‌نام generalmfr.WorkCenter — همان ستون‌ها + پیوند به خط و مشخصات ایستگاه
IF OBJECT_ID('mes.WorkCenter','U') IS NULL
  CREATE TABLE mes.WorkCenter (
    Id                        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkCenter PRIMARY KEY,
    Number                    NVARCHAR(64)  NULL,
    Name                      NVARCHAR(256) NOT NULL,
    Description               NVARCHAR(400) NULL,
    WorkCenterTypeCode        BIGINT NULL,          -- در نسخه‌ی قبل NOT NULL؛ کدلیست آن بیرون از این دیتابیس است
    WorkCenterPartyId         BIGINT NULL,
    EquipmentGroupId          BIGINT NULL,
    EquipmentCategoryId       BIGINT NULL,
    SiteId                    BIGINT NULL,
    NumberOfEquipments        INT NOT NULL CONSTRAINT DF_mes_WorkCenter_NumberOfEquipments DEFAULT (0),
    NumberOfLabors            INT NOT NULL CONSTRAINT DF_mes_WorkCenter_NumberOfLabors DEFAULT (0),
    EquipmentAvailPercent     DECIMAL(6,2) NOT NULL CONSTRAINT DF_mes_WorkCenter_EquipmentAvailPercent DEFAULT (100),
    ProductivityPercent       DECIMAL(6,2) NOT NULL CONSTRAINT DF_mes_WorkCenter_ProductivityPercent DEFAULT (100),
    CapacityConfirmPercent    DECIMAL(6,2) NOT NULL CONSTRAINT DF_mes_WorkCenter_CapacityConfirmPercent DEFAULT (10),
    StdLaborRate              DECIMAL(16,2) NULL,
    StdLaborBurdenPercent     DECIMAL(6,2) NULL,
    WorkLaborRate             DECIMAL(16,2) NULL,
    WorkLabBurdenPercent      DECIMAL(6,2) NULL,
    LaborClassTypeCode        INT NULL,
    QueueHoursLot             DECIMAL(6,2) NULL,
    DateLastPhysical          DATE NULL,
    EquipSeriesOrParallelCode BIGINT NULL,
    ISDCP                     BIT NOT NULL CONSTRAINT DF_mes_WorkCenter_ISDCP DEFAULT (0),
    IsBottleneck              BIT NOT NULL CONSTRAINT DF_mes_WorkCenter_IsBottleneck DEFAULT (0),
    IsActive                  BIT NULL,
    ProductiveCapacity        DECIMAL(18,8) NULL,
    IsOutsourced              BIT NULL,
    -- افزوده‌ی نسخه‌ی جدید
    ProductionLineId          BIGINT NULL CONSTRAINT FK_mes_WorkCenter_Line REFERENCES mes.ProductionLine(Id),
    SequenceNo                INT NULL,
    StationTypeTitle          NVARCHAR(50) NULL,    -- دستی / ماشینی / بازرسی / بافر
    TopologyTypeCode          NVARCHAR(20) NOT NULL CONSTRAINT DF_mes_WorkCenter_TopologyTypeCode DEFAULT ('sequential'), -- sequential / parallel / buffer
    CostCenterTitle           NVARCHAR(100) NULL,
    SharePercentText          NVARCHAR(50)  NULL,
    ResourceGroupId           BIGINT NULL CONSTRAINT FK_mes_WorkCenter_ResourceGroup REFERENCES mes.ResourceGroup(Id),
    LineSideInventoryId       BIGINT NULL CONSTRAINT FK_mes_WorkCenter_LineSideInventory REFERENCES mes.LineSideInventory(Id),
    ValidToDate               DATE NULL
  );

-- جدید: اتصال ایستگاه‌ها (یال‌های گراف توپولوژی)
IF OBJECT_ID('mes.WorkCenterLink','U') IS NULL
  CREATE TABLE mes.WorkCenterLink (
    Id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_WorkCenterLink PRIMARY KEY,
    ProductionLineId BIGINT NOT NULL CONSTRAINT FK_mes_WorkCenterLink_Line REFERENCES mes.ProductionLine(Id),
    FromWorkCenterId BIGINT NOT NULL CONSTRAINT FK_mes_WorkCenterLink_From REFERENCES mes.WorkCenter(Id),
    ToWorkCenterId   BIGINT NOT NULL CONSTRAINT FK_mes_WorkCenterLink_To REFERENCES mes.WorkCenter(Id),
    LinkTypeCode     NVARCHAR(20) NOT NULL CONSTRAINT DF_mes_WorkCenterLink_LinkTypeCode DEFAULT ('main'), -- main / rework / bypass
    Description      NVARCHAR(400) NULL,
    IsActive         BIT NULL CONSTRAINT DF_mes_WorkCenterLink_IsActive DEFAULT (1),
    CONSTRAINT UQ_mes_WorkCenterLink UNIQUE (FromWorkCenterId, ToWorkCenterId, LinkTypeCode),
    CONSTRAINT CK_mes_WorkCenterLink_NoSelf CHECK (FromWorkCenterId <> ToWorkCenterId),
    CONSTRAINT CK_mes_WorkCenterLink_Type CHECK (LinkTypeCode IN ('main','rework','bypass'))
  );

-- هم‌نام generalmfr.ProductionLineInventory — همان ستون‌ها (نگاشت تراکنشی خط ↔ انبار)
IF OBJECT_ID('mes.ProductionLineInventory','U') IS NULL
  CREATE TABLE mes.ProductionLineInventory (
    Id                                        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionLineInventory PRIMARY KEY,
    ProductionLineId                          BIGINT NOT NULL CONSTRAINT FK_mes_ProductionLineInventory_Line REFERENCES mes.ProductionLine(Id),
    IsProductionByOrder                       BIT NULL,
    IsCustomerMaterial                        BIT NULL,
    TransactionKindCode                       INT NULL,
    ProductSourceCode                         INT NULL,
    ProductEngineeringGroupId                 BIGINT NULL,
    ProductDeliverTypeCode                    INT NOT NULL CONSTRAINT DF_mes_ProductionLineInventory_ProductDeliverTypeCode DEFAULT (5),
    InventoryTypeCode                         INT NULL,
    FromInventoryId                           BIGINT NULL,
    ToInventoryId                             BIGINT NULL,
    IssueTransactionNumber                    NVARCHAR(64) NULL,
    ReceiveTransactionNumber                  NVARCHAR(64) NULL,
    IsOutsourced                              BIT NULL,
    ValidityDays                              INT NULL,
    WorkOrderInventoryTransactionUsedTypeCode INT NULL,
    MaterialSendToInventoryTypeCode           INT NULL,
    MaterialReceiveFromInventoryTypeCode      INT NULL,
    ProductSendToInventoryTypeCode            INT NULL,
    ProductNatureId                           BIGINT NULL
  );

-- جدید: منبع سیار
IF OBJECT_ID('mes.MobileResource','U') IS NULL
  CREATE TABLE mes.MobileResource (
    Id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_MobileResource PRIMARY KEY,
    Number           NVARCHAR(64)  NULL,
    Name             NVARCHAR(256) NOT NULL,
    CurrentOrgNodeId BIGINT NULL CONSTRAINT FK_mes_MobileResource_OrgNode REFERENCES mes.OrgNode(Id),
    Capability       NVARCHAR(400) NULL
  );
GO

/* -------------------------------------------------------------------
   بخش ۲ — ستون‌های استاندارد پایان جدول، برای هر جدول mes که هنوز ندارد.
   همین بلوک در همه‌ی اسکریپت‌های mes تکرار می‌شود تا هیچ جدولی جا نماند.
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
   بخش ۳ — توابع دامنه‌ی انتخاب
   ------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION mes.fnOrgNodesUnder (@OrgNodeId BIGINT)
RETURNS TABLE
AS
RETURN
(
  /* خودِ گره و همه‌ی زیرگره‌هایش در هر عمقی. */
  WITH Sub AS (
    SELECT n.Id FROM mes.OrgNode n WHERE n.Id = @OrgNodeId AND n.IsDeleted = 0
    UNION ALL
    SELECT c.Id FROM mes.OrgNode c JOIN Sub s ON c.ParentId = s.Id WHERE c.IsDeleted = 0
  )
  SELECT Id AS OrgNodeId FROM Sub
)
GO

CREATE OR ALTER FUNCTION mes.fnLinesInScope (@OrgNodeId BIGINT, @LineId BIGINT)
RETURNS TABLE
AS
RETURN
(
  /* خطوط در «دامنه‌ی انتخاب»: یا دقیقاً یک خط (@LineId)، یا همه‌ی خطوط زیر یک
     گره‌ی سازمانی (@OrgNodeId) در هر عمقی. */
  SELECT l.Id AS LineId
  FROM mes.ProductionLine l
  WHERE l.IsDeleted = 0
    AND ((@LineId IS NOT NULL AND l.Id = @LineId)
      OR (@LineId IS NULL AND l.OrgNodeId IN (SELECT OrgNodeId FROM mes.fnOrgNodesUnder(@OrgNodeId))))
)
GO

/* -------------------------------------------------------------------
   بخش ۴ — Stored Procedure ها (فقط خواندنی)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetOrgTree
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(n.Id AS INT) AS OrgNodeId, CAST(n.ParentId AS INT) AS ParentOrgNodeId, n.LevelCode, n.Name AS Title,
         n.OwnerTitle, n.BackupTitle, CAST(ISNULL(n.IsActive, 1) AS BIT) AS IsActive
  FROM mes.OrgNode n
  WHERE n.CompanyId = @CompanyId AND n.IsDeleted = 0
  ORDER BY n.ParentId, n.Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetProductionLines
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(l.Id AS INT) AS LineId, CAST(l.OrgNodeId AS INT) AS OrgNodeId, l.Number AS Code, l.Name AS Title,
         CAST(ISNULL(l.IsActive, 1) AS BIT) AS IsActive, n.Name AS UnitTitle
  FROM mes.ProductionLine l
  JOIN mes.OrgNode n ON n.Id = l.OrgNodeId
  WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0
  ORDER BY l.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetNodeAncestry
  @OrgNodeId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  WITH Chain AS (
    SELECT n.Id, n.ParentId, n.LevelCode, n.Name, n.OwnerTitle, n.BackupTitle, n.IsActive, 0 AS Depth
    FROM mes.OrgNode n WHERE n.Id = @OrgNodeId
    UNION ALL
    SELECT p.Id, p.ParentId, p.LevelCode, p.Name, p.OwnerTitle, p.BackupTitle, p.IsActive, c.Depth + 1
    FROM mes.OrgNode p JOIN Chain c ON p.Id = c.ParentId
  )
  SELECT LevelCode, Name AS Title, OwnerTitle, BackupTitle, CAST(ISNULL(IsActive, 1) AS BIT) AS IsActive, Depth
  FROM Chain
  ORDER BY Depth DESC;
END
GO

CREATE OR ALTER PROCEDURE mes.GetLineAncestry
  @LineId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  WITH Chain AS (
    SELECT n.Id, n.ParentId, n.LevelCode, n.Name, n.OwnerTitle, n.BackupTitle, n.IsActive, 0 AS Depth
    FROM mes.ProductionLine l
    JOIN mes.OrgNode n ON n.Id = l.OrgNodeId
    WHERE l.Id = @LineId
    UNION ALL
    SELECT p.Id, p.ParentId, p.LevelCode, p.Name, p.OwnerTitle, p.BackupTitle, p.IsActive, c.Depth + 1
    FROM mes.OrgNode p JOIN Chain c ON p.Id = c.ParentId
  )
  SELECT LevelCode, Name AS Title, OwnerTitle, BackupTitle, CAST(ISNULL(IsActive, 1) AS BIT) AS IsActive, Depth
  FROM Chain
  UNION ALL
  /* خودِ خط؛ مسئول و جانشین جاری از ProductionLineHead */
  SELECT 'Line', l.Name,
         (SELECT TOP 1 h.HeadTitle FROM mes.ProductionLineHead h WHERE h.ProductionLineId = l.Id AND h.IsCurrentHead = 1 AND h.IsBackup = 0 AND h.IsDeleted = 0),
         (SELECT TOP 1 h.HeadTitle FROM mes.ProductionLineHead h WHERE h.ProductionLineId = l.Id AND h.IsCurrentHead = 1 AND h.IsBackup = 1 AND h.IsDeleted = 0),
         CAST(ISNULL(l.IsActive, 1) AS BIT), -1
  FROM mes.ProductionLine l WHERE l.Id = @LineId
  ORDER BY Depth DESC;
END
GO

CREATE OR ALTER PROCEDURE mes.GetLinesUnderNode
  @OrgNodeId BIGINT = NULL,
  @LineId    BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(l.Id AS INT) AS LineId, CAST(l.OrgNodeId AS INT) AS OrgNodeId, l.Number AS Code, l.Name AS Title,
         (SELECT TOP 1 h.HeadTitle FROM mes.ProductionLineHead h WHERE h.ProductionLineId = l.Id AND h.IsCurrentHead = 1 AND h.IsBackup = 0 AND h.IsDeleted = 0) AS ManagerTitle,
         CAST(ISNULL(l.IsActive, 1) AS BIT) AS IsActive, n.Name AS UnitTitle,
         (SELECT COUNT(*) FROM mes.WorkCenter s WHERE s.ProductionLineId = l.Id AND s.IsDeleted = 0) AS StationCount
  FROM mes.ProductionLine l
  JOIN mes.OrgNode n ON n.Id = l.OrgNodeId
  WHERE l.Id IN (SELECT LineId FROM mes.fnLinesInScope(@OrgNodeId, @LineId))
  ORDER BY n.Id, l.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetStationsUnderNode
  @OrgNodeId BIGINT = NULL,
  @LineId    BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    CAST(s.Id AS INT) AS StationId, CAST(s.ProductionLineId AS INT) AS LineId, s.Number AS Code, s.Name AS Title,
    s.Description AS Sublabel, s.StationTypeTitle AS StationType, s.TopologyTypeCode AS TopologyType,
    s.CostCenterTitle AS CostCenterCode, rg.Number AS ResourceGroupCode, rg.Name AS ResourceGroupTitle,
    s.SharePercentText, w.Number AS LineSideWarehouseCode, w.Name AS LineSideWarehouseTitle,
    s.SequenceNo, CAST(ISNULL(s.IsActive, 1) AS BIT) AS IsActive
  FROM mes.WorkCenter s
  LEFT JOIN mes.ResourceGroup rg ON rg.Id = s.ResourceGroupId
  LEFT JOIN mes.LineSideInventory w ON w.Id = s.LineSideInventoryId
  WHERE s.IsDeleted = 0
    AND s.ProductionLineId IN (SELECT LineId FROM mes.fnLinesInScope(@OrgNodeId, @LineId))
  ORDER BY s.ProductionLineId, s.SequenceNo, s.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetStationLinksUnderNode
  @OrgNodeId BIGINT = NULL,
  @LineId    BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(k.Id AS INT) AS LinkId, CAST(k.ProductionLineId AS INT) AS LineId,
         CAST(k.FromWorkCenterId AS INT) AS FromStationId, CAST(k.ToWorkCenterId AS INT) AS ToStationId,
         k.LinkTypeCode AS LinkType, k.Description AS Note, CAST(ISNULL(k.IsActive, 1) AS BIT) AS IsActive
  FROM mes.WorkCenterLink k
  WHERE k.IsDeleted = 0
    AND k.ProductionLineId IN (SELECT LineId FROM mes.fnLinesInScope(@OrgNodeId, @LineId))
  ORDER BY k.ProductionLineId, k.Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetResourceGroups
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(rg.Id AS INT) AS ResourceGroupId, rg.Number AS Code, rg.Name AS Title, rg.DispatchRule,
    (SELECT STRING_AGG(m.Name, N'، ') WITHIN GROUP (ORDER BY m.SortOrder)
     FROM mes.ResourceGroupMember m WHERE m.ResourceGroupId = rg.Id AND m.IsDeleted = 0) AS Members
  FROM mes.ResourceGroup rg
  WHERE rg.CompanyId = @CompanyId AND rg.IsDeleted = 0
  ORDER BY rg.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetMobileResources
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(mr.Id AS INT) AS MobileResourceId, mr.Number AS Code, mr.Name AS Title, n.Name AS CurrentSiteTitle, mr.Capability
  FROM mes.MobileResource mr
  LEFT JOIN mes.OrgNode n ON n.Id = mr.CurrentOrgNodeId
  WHERE mr.CompanyId = @CompanyId AND mr.IsDeleted = 0
  ORDER BY mr.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetLineSideWarehouses
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(w.Id AS INT) AS WarehouseId, w.Number AS Code, w.Name AS Title, w.ReferenceInventoryNumber AS ReferenceWarehouseCode,
    (SELECT STRING_AGG(s.Number, N'، ') WITHIN GROUP (ORDER BY s.SequenceNo)
     FROM mes.WorkCenter s WHERE s.LineSideInventoryId = w.Id AND s.IsDeleted = 0) AS LinkedStationCodes
  FROM mes.LineSideInventory w
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0
  ORDER BY w.Number;
END
GO

/* -------------------------------------------------------------------
   بخش ۵ — داده‌ی نمونه: شرکت نمایشی CompanyId = 222
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.OrgNode WHERE CompanyId = 222)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @Group BIGINT, @Holding BIGINT, @Company BIGINT, @Factory BIGINT, @HallSolid BIGINT, @HallSemi BIGINT;
  DECLARE @L1 BIGINT, @L2 BIGINT, @RgMix BIGINT, @RgPress BIGINT, @Wh1 BIGINT, @Wh2 BIGINT, @Wh3 BIGINT;

  INSERT mes.OrgNode (CompanyId, ParentId, LevelCode, Name, OwnerTitle, BackupTitle) VALUES (@C, NULL, 'Group', N'مجموعه صنعتی گلرنگ', N'رئیس هیئت‌مدیره', NULL);
  SET @Group = SCOPE_IDENTITY();
  INSERT mes.OrgNode (CompanyId, ParentId, LevelCode, Name, OwnerTitle, BackupTitle) VALUES (@C, @Group, 'Holding', N'هلدینگ دارویی', N'مدیرعامل هلدینگ', NULL);
  SET @Holding = SCOPE_IDENTITY();
  INSERT mes.OrgNode (CompanyId, ParentId, LevelCode, Name, OwnerTitle, BackupTitle) VALUES (@C, @Holding, 'Company', N'داروسازی آریا شفا', N'مدیرعامل', NULL);
  SET @Company = SCOPE_IDENTITY();
  INSERT mes.OrgNode (CompanyId, ParentId, LevelCode, Name, OwnerTitle, BackupTitle) VALUES (@C, @Company, 'Factory', N'کارخانه شماره ۱ — جامدات و نیمه‌جامد', N'مدیر کارخانه', N'سرپرست تولید');
  SET @Factory = SCOPE_IDENTITY();
  INSERT mes.OrgNode (CompanyId, ParentId, LevelCode, Name, OwnerTitle, BackupTitle) VALUES (@C, @Factory, 'Unit', N'سالن جامدات', N'سرپرست سالن', N'کارشناس ارشد شیفت');
  SET @HallSolid = SCOPE_IDENTITY();
  INSERT mes.OrgNode (CompanyId, ParentId, LevelCode, Name, OwnerTitle, BackupTitle) VALUES (@C, @Factory, 'Unit', N'سالن نیمه‌جامد و شربت', N'سرپرست سالن', NULL);
  SET @HallSemi = SCOPE_IDENTITY();

  INSERT mes.ProductionLine (CompanyId, Number, Name, OrgNodeId, IsActive) VALUES (@C, N'L1-TABLET', N'خط قرص‌سازی ۱', @HallSolid, 1);
  SET @L1 = SCOPE_IDENTITY();
  INSERT mes.ProductionLine (CompanyId, Number, Name, OrgNodeId, IsActive) VALUES (@C, N'L2-TABLET', N'خط قرص‌سازی ۲', @HallSolid, 1);
  SET @L2 = SCOPE_IDENTITY();

  INSERT mes.ProductionLineHead (CompanyId, ProductionLineId, ValidFromDate, IsCurrentHead, HeadTitle, IsBackup) VALUES
    (@C, @L1, '2026-01-01', 1, N'مدیر تولید خط', 0), (@C, @L1, '2026-01-01', 1, N'جانشین مدیر تولید', 1),
    (@C, @L2, '2026-01-01', 1, N'مدیر تولید خط', 0), (@C, @L2, '2026-01-01', 1, N'جانشین مدیر تولید', 1);

  INSERT mes.ResourceGroup (CompanyId, Number, Name, DispatchRule) VALUES (@C, N'POOL-MIX', N'گروه میکسرهای گرانولاسیون', N'اولین منبع آزاد');
  SET @RgMix = SCOPE_IDENTITY();
  INSERT mes.ResourceGroup (CompanyId, Number, Name, DispatchRule) VALUES (@C, N'POOL-PRESS', N'گروه پرس‌های قرص', N'موازی — بار برابر');
  SET @RgPress = SCOPE_IDENTITY();
  INSERT mes.ResourceGroupMember (CompanyId, ResourceGroupId, Name, SortOrder) VALUES
    (@C, @RgMix, N'میکسر ۱', 1), (@C, @RgMix, N'میکسر ۲', 2), (@C, @RgMix, N'میکسر ۳', 3),
    (@C, @RgPress, N'پرس A', 1), (@C, @RgPress, N'پرس B', 2);

  INSERT mes.LineSideInventory (CompanyId, Number, Name, ReferenceInventoryNumber) VALUES (@C, N'WH-L2-01', N'انبار پای کار — توزین/گرانولاسیون', N'INV-RM-01 (انبار مواد اولیه)');
  SET @Wh1 = SCOPE_IDENTITY();
  INSERT mes.LineSideInventory (CompanyId, Number, Name, ReferenceInventoryNumber) VALUES (@C, N'WH-L2-02', N'انبار پای کار — پرس', N'INV-WIP-02 (انبار نیمه‌ساخته)');
  SET @Wh2 = SCOPE_IDENTITY();
  INSERT mes.LineSideInventory (CompanyId, Number, Name, ReferenceInventoryNumber) VALUES (@C, N'WH-L2-03', N'انبار پای کار — روکش/بسته‌بندی', N'INV-WIP-02 (انبار نیمه‌ساخته)');
  SET @Wh3 = SCOPE_IDENTITY();

  INSERT mes.WorkCenter (CompanyId, ProductionLineId, Number, Name, Description, StationTypeTitle, TopologyTypeCode, CostCenterTitle, ResourceGroupId, SharePercentText, LineSideInventoryId, SequenceNo, IsActive, ValidToDate)
  VALUES
    (@C, @L2, N'10',  N'توزین',        N'ایستگاه ۲',               N'دستی',   'sequential', N'CC-2101 جامدات',    NULL,     N'۱۰۰٪',      @Wh1, 10, 1, NULL),
    (@C, @L2, N'20',  N'گرانولاسیون',  N'میکسر ۳',                 N'ماشینی', 'sequential', N'CC-2101 جامدات',    @RgMix,   N'۱۰۰٪',      @Wh1, 20, 1, NULL),
    (@C, @L2, N'30A', N'پرس A',        N'موازی — پرس A',           N'ماشینی', 'parallel',   N'CC-2101 / CC-2102', @RgPress, N'۷۰٪ / ۳۰٪', @Wh2, 30, 1, NULL),
    (@C, @L2, N'30B', N'پرس B',        N'موازی — پرس B',           N'ماشینی', 'parallel',   N'CC-2101 / CC-2102', @RgPress, N'۷۰٪ / ۳۰٪', @Wh2, 30, 1, NULL),
    (@C, @L2, N'BUF', N'بافر میانی',   N'ظرفیت ۵۰۰ کیلوگرم',       N'بافر',   'buffer',     NULL,                  NULL,     NULL,         NULL, 35, 1, NULL),
    (@C, @L2, N'40',  N'روکش‌دهی',     N'دستگاه کوتینگ',           N'ماشینی', 'sequential', N'CC-2103 روکش',      NULL,     N'۱۰۰٪',      @Wh3, 40, 1, NULL),
    (@C, @L2, N'25',  N'بازرسی بصری',  N'بازرسی قبل از بسته‌بندی', N'بازرسی', 'sequential', N'CC-2104 کیفیت',     NULL,     N'۱۰۰٪',      NULL, 45, 0, '2026-01-01'),
    (@C, @L2, N'50',  N'بسته‌بندی',    N'بلیستر + کارتن',          N'ماشینی', 'sequential', N'CC-2103 روکش',      NULL,     N'۱۰۰٪',      @Wh3, 50, 1, NULL),
    (@C, @L1, N'10',  N'توزین',        N'ایستگاه ۱',               N'دستی',   'sequential', N'CC-2101 جامدات',    NULL,     N'۱۰۰٪',      NULL, 10, 1, NULL),
    (@C, @L1, N'20',  N'گرانولاسیون',  N'میکسر ۱',                 N'ماشینی', 'sequential', N'CC-2101 جامدات',    @RgMix,   N'۱۰۰٪',      NULL, 20, 1, NULL),
    (@C, @L1, N'30',  N'پرس',          N'پرس تک‌ایستگاه',          N'ماشینی', 'sequential', N'CC-2101 جامدات',    NULL,     N'۱۰۰٪',      NULL, 30, 1, NULL),
    (@C, @L1, N'40',  N'بازرسی بصری',  N'کنترل حین فرایند',        N'بازرسی', 'sequential', N'CC-2104 کیفیت',     NULL,     N'۱۰۰٪',      NULL, 40, 1, NULL),
    (@C, @L1, N'50',  N'بسته‌بندی',    N'بلیستر',                  N'ماشینی', 'sequential', N'CC-2103 روکش',      NULL,     N'۱۰۰٪',      NULL, 50, 1, NULL);

  INSERT mes.WorkCenterLink (CompanyId, ProductionLineId, FromWorkCenterId, ToWorkCenterId, LinkTypeCode, Description, IsActive)
  SELECT @C, v.LineId, f.Id, t.Id, v.LinkTypeCode, v.Description, v.IsActive
  FROM (VALUES
    (@L2, N'10',  N'20',  'main',   NULL, 1),
    (@L2, N'20',  N'30A', 'main',   NULL, 1),
    (@L2, N'20',  N'30B', 'main',   NULL, 1),
    (@L2, N'30A', N'BUF', 'main',   NULL, 1),
    (@L2, N'30B', N'BUF', 'main',   NULL, 1),
    (@L2, N'BUF', N'40',  'main',   NULL, 1),
    (@L2, N'40',  N'50',  'main',   NULL, 1),
    (@L2, N'40',  N'25',  'main',   N'مسیر قبلی از طریق بازرسی بصری — غیرفعال از تاریخ اثر', 0),
    (@L2, N'25',  N'50',  'main',   N'مسیر قبلی از طریق بازرسی بصری — غیرفعال از تاریخ اثر', 0),
    (@L1, N'10',  N'20',  'main',   NULL, 1),
    (@L1, N'20',  N'30',  'main',   NULL, 1),
    (@L1, N'30',  N'40',  'main',   NULL, 1),
    (@L1, N'40',  N'50',  'main',   NULL, 1),
    (@L1, N'40',  N'30',  'rework', N'برگشت قرص نامنطبق به پرس', 1)
  ) v(LineId, FromNumber, ToNumber, LinkTypeCode, Description, IsActive)
  JOIN mes.WorkCenter f ON f.ProductionLineId = v.LineId AND f.Number = v.FromNumber
  JOIN mes.WorkCenter t ON t.ProductionLineId = v.LineId AND t.Number = v.ToNumber;

  INSERT mes.MobileResource (CompanyId, Number, Name, CurrentOrgNodeId, Capability) VALUES
    (@C, N'MOB-01', N'داینامومتر قابل‌حمل', @Factory, N'سنجش گشتاور پرس'),
    (@C, N'MOB-02', N'دستگاه توزین سیار',   @Factory, N'توزین دقیق دسته');
  COMMIT;
  PRINT N'داده‌ی نمونه‌ی ساختار کارخانه (CompanyId=222) درج شد';
END
GO
