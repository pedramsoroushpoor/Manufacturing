/* =====================================================================
   اسکیمای mes — گام ۱۰: FRM-PE-02 «ساختار محصول»

   پیش‌نیاز: mes_frm_rm01 تا mes_frm_pe01 اجرا شده باشند (کالا و قلم تولیدی از گام ۹).
   قاعده‌ی مدل داده همان است که در سرآغاز mes_frm_rm01_setup.sql آمده.
   یادداشت ALM: «فرم مرکزی؛ کپی، مقایسه، تبدیل نوع و اکسل همگی اقدام درون همین فرم‌اند».

   نگاشت جدول‌های این گام (نسخه‌ی قبل مدل کامل ساختار داشت؛ نام و فیلدها همان است):
     mes.ProductStructure          = mfr.ProductStructure
                                     + TemplateProductStructureId (ارث‌بری از الگو، F-PE-014)
                                     + BatchMultiple (مضرب بچ، F-PE-012؛ حداقل و حداکثر همان MinimumQuantity/MaximumQuantity)
                                     + AllowPercentOver100 (F-PE-020)، ProfileCode (قالب پروفایل، F-PE-009)
     mes.ProductStructureMaster    = mfr.ProductStructureMaster، بدون تغییر — محصول اصلی و اندازه‌ی مرجع (Quantity).
                                     محصولات همزاد و جانبی در FRM-PE-04 به همین جدول می‌آیند.
     mes.ProductStructureItem      = mfr.ProductStructureItem
                                     + Sequence، ItemRoleTitle، QuantityFormula (F-PE-019)
                                     + WasteTypeCode، WasteQuantity، IsWastePriorityOverOperation (F-PE-021؛ ضایعات درصدی همان
                                       ToleranceForNormalWaste نسخه‌ی قبل است)
                                     + MinConsumptionPercent، MaxConsumptionPercent (F-PE-022)
                                     + AssayBasisPercent، PotencyCompensationProductId (F-PE-023؛ «ماده‌ی مؤثره» همان IsActiveIngredient)
                                     + ConsumptionUnitTitle، UnitConversionFactor، IsBatchDependentConversion (F-PE-024)
                                     + InheritanceActionCode (ردیف فرزندِ الگو: خالی = ردیف خودش، ۱ = بازنویسی، ۲ = حذف)
                                     ردیف‌ها به نسخه وابسته‌اند (RevisionId، مثل نسخه‌ی قبل).
     mes.ProductionRevision        = mfr.ProductionRevision، بدون تغییر — کد نسخه (v1، v2، ...)
     mes.ProductStructureRevision  = mfr.ProductStructureRevision
                                     + EffectivityTypeCode، FromBatchNumber، ToBatchNumber، WorkOrderNumber (اعتبار بچ‌محور و
                                       سفارش‌محور، F-PE-015)، RevisionStatusCode، ApproverTitle، EcoNumber.
                                     ProductId در قدیم NOT NULL است و این‌جا NULL، چون ساختارِ الگو محصول ندارد.
     mes.ProductStructureSite      = mfr.ProductStructureSite + OrgNodeId، ProductionLineId (دامنه‌ی سازمانی، F-PE-011).
                                     SiteId در قدیم NOT NULL است و این‌جا NULL، چون جدول سایت هنوز نیست.
     mes.ProductStructureGroup     = mfr.ProductStructureGroup، بدون تغییر
     mes.ProductStructureTypeChange = جدید — درخواست و سابقه‌ی تبدیل نوع با تأیید QC و مدیر (F-PE-013)
     mes.ProductStructureAttachment = جدید — مدارک و پیوست (F-PE-018)؛ DmsDocumentId برای اتصال بعدی به مدیریت مستندات (PF-64)

   فرض‌ها و کدهای موقت تا تأیید/رسیدن کدلیست اصلی:
     ProductStructureTypeCode   1 = تولیدی، 2 = آزمایشی/R&D، 3 = الگو، 4 = نمونه‌سازی، 5 = مهندسی
     ProductStructureStatusCode 1 = پیش‌نویس، 2 = در گردش تأیید، 3 = تأییدشده، 4 = منسوخ
     ProductStructureItem.QuantityTypeCode
                                1 = ثابت در هر بچ، 2 = متناسب با اندازه‌ی مرجع، 3 = فرمولی، 4 = درصدی از اندازه‌ی مرجع
                                — معنای این فیلد در نسخه‌ی قبل روشن نیست؛ منتظر تأیید.
                                IsQuantumSatis (q.s. نسخه‌ی قبل) = «به مقدار کافی»: باقی‌مانده‌ی جمع درصد را پر می‌کند.
     WasteTypeCode              1 = درصدی (ToleranceForNormalWaste)، 2 = مقداری (WasteQuantity)
     EffectivityTypeCode        1 = تاریخ‌محور، 2 = بچ‌محور، 3 = سفارش‌محور
     RevisionStatusCode         1 = پیش‌نویس، 2 = در گردش تأیید، 3 = فعال، 4 = منسوخ
     DocumentTypeCode           1 = پروانه‌ی ساخت، 2 = مشخصات، 3 = تصویر، 4 = نقشه، 5 = سایر
     ApprovalStatusCode         1 = در انتظار، 2 = تأییدشده، 3 = ردشده
     تبدیل‌های مجاز نوع (تبدیل مستقیم ممنوع؛ همیشه با درخواست و تأیید):
       آزمایشی ← نمونه‌سازی، نمونه‌سازی ← تولیدی، آزمایشی ← تولیدی، مهندسی ← آزمایشی. ساختار تولیدی تبدیل نمی‌شود
       (تغییرش نسخه‌ی تازه است) و الگو فقط پایه‌ی ساختار تازه می‌شود.

   فاز اول (فقط‌خواندنی): F-PE-009 تا 015، 017 تا 024 و نیمه‌ی خروجیِ 068 نمایش/محاسبه می‌شوند.
   کپی ساختار (016)، ورود از اکسل (068) و انجام تبدیل نوع اقدام نوشتنی‌اند و با ثبت و ویرایش می‌آیند.
   قلم اختیاری/مشروط (025) و مصرف منفی (026) اولویت «مهم» و فاز ۳ دارند. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */
IF OBJECT_ID('mes.ProductStructureGroup','U') IS NULL
CREATE TABLE mes.ProductStructureGroup (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductStructureGroup PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionRevision','U') IS NULL
CREATE TABLE mes.ProductionRevision (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionRevision PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  IsChangeable BIT NOT NULL CONSTRAINT DF_mes_ProductionRevision_IsChangeable DEFAULT (1)
);

IF OBJECT_ID('mes.ProductStructure','U') IS NULL
CREATE TABLE mes.ProductStructure (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductStructure PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  AliasName NVARCHAR(256) NULL,
  ProductStructureGroupId BIGINT NULL,
  RevisionId BIGINT NOT NULL,
  ProductStructureTypeCode INT NOT NULL,
  IsProductionByOrder BIT NULL,
  PartyRoleCode INT NULL,
  CustomerPartyId BIGINT NULL,
  License NVARCHAR(64) NULL,
  QuantityTypeCode INT NOT NULL CONSTRAINT DF_mes_ProductStructure_QuantityTypeCode DEFAULT (1),
  MinimumQuantity DECIMAL(32,6) NULL,
  MaximumQuantity DECIMAL(32,6) NULL,
  Excess DECIMAL(32,6) NULL,
  IsExcessMandatory BIT NULL,
  LastMadeDate DATETIME2 NULL,
  ValidFromDate DATETIME2 NOT NULL,
  ValidToDate DATETIME2 NULL,
  IsAvailableInAllSites BIT NULL,
  IsDefaultProductStructure BIT NOT NULL CONSTRAINT DF_mes_ProductStructure_IsDefault DEFAULT (0),
  LabelTemplateID BIGINT NULL,
  HMISChronicIndicator BIT NULL,
  HMISHealthRating BIGINT NULL,
  HMISFlammabilityRating BIGINT NULL,
  HMISReactivityRating BIGINT NULL,
  HMISPersonalProtectionRating BIGINT NULL,
  WHIMISInfo NVARCHAR(256) NULL,
  UserPermissionTypeCode INT NULL,
  ProductStructureStatusCode INT NULL,
  ProductStructureBookmark NVARCHAR(128) NULL,
  Description NVARCHAR(400) NULL,
  CostAllocationTypeCode INT NULL,
  IsRecovery BIT NULL,
  RecoveryPercentage DECIMAL(10,2) NULL,
  TemplateProductStructureId BIGINT NULL,
  BatchMultiple DECIMAL(32,6) NULL,
  AllowPercentOver100 BIT NOT NULL CONSTRAINT DF_mes_ProductStructure_AllowPercentOver100 DEFAULT (0),
  ProfileCode NVARCHAR(32) NULL
);

IF OBJECT_ID('mes.ProductStructureMaster','U') IS NULL
CREATE TABLE mes.ProductStructureMaster (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductStructureMaster PRIMARY KEY,
  ProductStructureId BIGINT NOT NULL,
  ProductId BIGINT NOT NULL,
  MasterProductTypeCode INT NOT NULL CONSTRAINT DF_mes_ProductStructureMaster_TypeCode DEFAULT (1),
  IsMainProduct BIT NOT NULL CONSTRAINT DF_mes_ProductStructureMaster_IsMain DEFAULT (1),
  Quantity DECIMAL(32,6) NOT NULL,
  MeasureUnitId BIGINT NULL,
  DefaultOperationId BIGINT NULL,
  CostAllocationPercentage DECIMAL(6,2) NULL,
  Description NVARCHAR(400) NULL,
  CostAllocationFactor DECIMAL(18,0) NULL
);

IF OBJECT_ID('mes.ProductStructureItem','U') IS NULL
CREATE TABLE mes.ProductStructureItem (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductStructureItem PRIMARY KEY,
  ProductStructureId BIGINT NOT NULL,
  ProductId BIGINT NOT NULL,
  RevisionId BIGINT NULL,
  QuantityTypeCode INT NOT NULL,
  Quantity DECIMAL(32,6) NOT NULL,
  MeasureUnitId BIGINT NULL,
  HouseSharePercent DECIMAL(10,2) NULL,
  DefaultOperationId BIGINT NULL,
  IsQuantumSatis BIT NOT NULL CONSTRAINT DF_mes_ProductStructureItem_IsQuantumSatis DEFAULT (0),
  IsMainMaterial BIT NOT NULL CONSTRAINT DF_mes_ProductStructureItem_IsMainMaterial DEFAULT (0),
  AvailablePercentage DECIMAL(10,2) NULL,
  KitLeadTimeOffset INT NOT NULL CONSTRAINT DF_mes_ProductStructureItem_KitLeadTimeOffset DEFAULT (0),
  Description NVARCHAR(400) NULL,
  IsBackFlushed BIT NULL,
  ToleranceForReceive DECIMAL(10,2) NULL,
  ToleranceForReturn DECIMAL(10,2) NULL,
  IsActiveIngredient BIT NULL,
  OptionalConsumption BIT NULL,
  IsRecovery BIT NULL,
  RecoveryPercentage DECIMAL(10,2) NULL,
  ToleranceForNormalWaste DECIMAL(10,2) NULL,
  Sequence INT NOT NULL CONSTRAINT DF_mes_ProductStructureItem_Sequence DEFAULT (0),
  ItemRoleTitle NVARCHAR(64) NULL,
  QuantityFormula NVARCHAR(400) NULL,
  WasteTypeCode INT NULL,
  WasteQuantity DECIMAL(32,6) NULL,
  IsWastePriorityOverOperation BIT NOT NULL CONSTRAINT DF_mes_ProductStructureItem_WastePriority DEFAULT (1),
  MinConsumptionPercent DECIMAL(10,2) NULL,
  MaxConsumptionPercent DECIMAL(10,2) NULL,
  AssayBasisPercent DECIMAL(10,4) NULL,
  PotencyCompensationProductId BIGINT NULL,
  ConsumptionUnitTitle NVARCHAR(64) NULL,
  UnitConversionFactor DECIMAL(32,10) NULL,
  IsBatchDependentConversion BIT NOT NULL CONSTRAINT DF_mes_ProductStructureItem_BatchDepConv DEFAULT (0),
  InheritanceActionCode INT NULL
);

IF OBJECT_ID('mes.ProductStructureRevision','U') IS NULL
CREATE TABLE mes.ProductStructureRevision (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductStructureRevision PRIMARY KEY,
  RevisionId BIGINT NOT NULL,
  ProductId BIGINT NULL,
  ProductStructureId BIGINT NULL,
  Description NVARCHAR(400) NULL,
  RevisionInformation NVARCHAR(MAX) NULL,
  ApproverPartyId BIGINT NULL,
  ApproveDate DATETIME2 NULL,
  ValidFromDate DATETIME2 NULL,
  ValidToDate DATETIME2 NULL,
  LastRemark NVARCHAR(MAX) NULL,
  LastRemarkDate DATETIME2 NULL,
  FirstManufactureDate DATETIME2 NULL,
  FirstBatchId BIGINT NULL,
  FirstBatchSerialId BIGINT NULL,
  LastManufactureDate DATETIME2 NULL,
  LastBatchId BIGINT NULL,
  LastBatchSerialId BIGINT NULL,
  Remarks NVARCHAR(MAX) NULL,
  EffectivityTypeCode INT NOT NULL CONSTRAINT DF_mes_ProductStructureRevision_Effectivity DEFAULT (1),
  FromBatchNumber NVARCHAR(64) NULL,
  ToBatchNumber NVARCHAR(64) NULL,
  WorkOrderNumber NVARCHAR(64) NULL,
  RevisionStatusCode INT NOT NULL CONSTRAINT DF_mes_ProductStructureRevision_Status DEFAULT (1),
  ApproverTitle NVARCHAR(256) NULL,
  EcoNumber NVARCHAR(64) NULL
);

IF OBJECT_ID('mes.ProductStructureSite','U') IS NULL
CREATE TABLE mes.ProductStructureSite (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductStructureSite PRIMARY KEY,
  ProductStructureId BIGINT NOT NULL,
  SiteId BIGINT NULL,
  ValidFromDate DATE NOT NULL,
  ValidToDate DATE NULL,
  Description NVARCHAR(400) NULL,
  OrgNodeId BIGINT NULL,
  ProductionLineId BIGINT NULL
);

IF OBJECT_ID('mes.ProductStructureTypeChange','U') IS NULL
CREATE TABLE mes.ProductStructureTypeChange (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductStructureTypeChange PRIMARY KEY,
  ProductStructureId BIGINT NOT NULL,
  FromTypeCode INT NOT NULL,
  ToTypeCode INT NOT NULL,
  RequestDate DATE NOT NULL,
  RequestedByTitle NVARCHAR(256) NULL,
  ApprovalStatusCode INT NOT NULL CONSTRAINT DF_mes_ProductStructureTypeChange_Approval DEFAULT (1)
    CONSTRAINT CK_mes_ProductStructureTypeChange_Approval CHECK (ApprovalStatusCode IN (1, 2, 3)),
  QcApproverTitle NVARCHAR(256) NULL,
  ManagerApproverTitle NVARCHAR(256) NULL,
  ApproveDate DATE NULL,
  NewProductStructureId BIGINT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductStructureAttachment','U') IS NULL
CREATE TABLE mes.ProductStructureAttachment (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductStructureAttachment PRIMARY KEY,
  ProductStructureId BIGINT NOT NULL,
  DocumentTypeCode INT NOT NULL CONSTRAINT CK_mes_ProductStructureAttachment_Type CHECK (DocumentTypeCode IN (1, 2, 3, 4, 5)),
  Title NVARCHAR(256) NOT NULL,
  DocumentNumber NVARCHAR(64) NULL,
  FileName NVARCHAR(256) NULL,
  ValidFromDate DATE NULL,
  ValidToDate DATE NULL,
  DmsDocumentId BIGINT NULL,
  Description NVARCHAR(400) NULL
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
   بخش ۳ — ردیف‌های مؤثر یک ساختار در یک نسخه، با ارث‌بری از الگو
   ------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION mes.fnStructureItems (@ProductStructureId BIGINT, @RevisionId BIGINT)
RETURNS TABLE
AS
RETURN
(
  /* @RevisionId خالی = نسخه‌ی جاری ساختار. ردیف‌های الگو از نسخه‌ی جاری الگو می‌آیند.
     Source: own = ردیف خودِ ساختار، override = بازنویسی ردیف الگو، inherited = از الگو، removed = ردیف الگو که حذف شده. */
  WITH s AS (
    SELECT st.Id, ISNULL(@RevisionId, st.RevisionId) AS RevisionId, st.TemplateProductStructureId
    FROM mes.ProductStructure st WHERE st.Id = @ProductStructureId AND st.IsDeleted = 0
  ), own AS (
    SELECT i.*
    FROM mes.ProductStructureItem i JOIN s ON s.Id = i.ProductStructureId AND s.RevisionId = i.RevisionId
    WHERE i.IsDeleted = 0
  ), tpl AS (
    SELECT i.*
    FROM s
    JOIN mes.ProductStructure t ON t.Id = s.TemplateProductStructureId AND t.IsDeleted = 0
    JOIN mes.ProductStructureItem i ON i.ProductStructureId = t.Id AND i.RevisionId = t.RevisionId AND i.IsDeleted = 0
  )
  SELECT o.Id AS ItemId, o.ProductStructureId AS SourceStructureId,
         CASE o.InheritanceActionCode WHEN 1 THEN 'override' WHEN 2 THEN 'removed' ELSE 'own' END AS Source,
         o.ProductId, o.Sequence, o.ItemRoleTitle, o.QuantityTypeCode, o.Quantity, o.QuantityFormula, o.IsQuantumSatis,
         o.IsActiveIngredient, o.IsMainMaterial, o.AssayBasisPercent, o.PotencyCompensationProductId,
         o.ToleranceForNormalWaste, o.WasteTypeCode, o.WasteQuantity, o.IsWastePriorityOverOperation,
         o.MinConsumptionPercent, o.MaxConsumptionPercent, o.ConsumptionUnitTitle, o.UnitConversionFactor, o.IsBatchDependentConversion,
         o.IsBackFlushed, o.Description
  FROM own o
  UNION ALL
  SELECT t.Id, t.ProductStructureId, 'inherited',
         t.ProductId, t.Sequence, t.ItemRoleTitle, t.QuantityTypeCode, t.Quantity, t.QuantityFormula, t.IsQuantumSatis,
         t.IsActiveIngredient, t.IsMainMaterial, t.AssayBasisPercent, t.PotencyCompensationProductId,
         t.ToleranceForNormalWaste, t.WasteTypeCode, t.WasteQuantity, t.IsWastePriorityOverOperation,
         t.MinConsumptionPercent, t.MaxConsumptionPercent, t.ConsumptionUnitTitle, t.UnitConversionFactor, t.IsBatchDependentConversion,
         t.IsBackFlushed, t.Description
  FROM tpl t
  WHERE NOT EXISTS (SELECT 1 FROM own o WHERE o.ProductId = t.ProductId)
);
GO

/* -------------------------------------------------------------------
   بخش ۴ — رویه‌های خواندن (شناسه‌ها INT برمی‌گردند تا در JSON عدد بمانند)
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetProductStructures
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* فهرست ساختارها برای پنل کناری و برگه‌ی «اطلاعات کلی»، با محصول اصلی، نسخه‌ی جاری و خلاصه‌ی دامنه. */
  SELECT CAST(s.Id AS INT) AS StructureId, s.Number AS Code, s.Name AS Title, s.AliasName,
         CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS ProductUnit,
         CAST(CASE WHEN pi.Id IS NULL THEN 0 ELSE 1 END AS BIT) AS ProductHasRole,
         s.ProductStructureTypeCode AS TypeCode, s.ProductStructureStatusCode AS StatusCode, s.IsDefaultProductStructure AS IsDefault,
         g.Name AS GroupTitle, s.ProfileCode, s.License,
         CAST(m.Quantity AS DECIMAL(18,4)) AS BaseQuantity,
         CAST(s.MinimumQuantity AS DECIMAL(18,4)) AS MinimumQuantity, CAST(s.MaximumQuantity AS DECIMAL(18,4)) AS MaximumQuantity,
         CAST(s.BatchMultiple AS DECIMAL(18,4)) AS BatchMultiple, s.AllowPercentOver100,
         s.ValidFromDate, s.ValidToDate, s.IsProductionByOrder,
         CAST(s.RevisionId AS INT) AS RevisionId, r.Number AS RevisionCode,
         CAST(s.TemplateProductStructureId AS INT) AS TemplateId, t.Number AS TemplateCode, t.Name AS TemplateTitle,
         (SELECT COUNT(*) FROM mes.fnStructureItems(s.Id, NULL) x WHERE x.Source <> 'removed') AS ItemCount,
         (SELECT COUNT(*) FROM mes.ProductStructure c WHERE c.TemplateProductStructureId = s.Id AND c.IsDeleted = 0) AS ChildCount,
         (SELECT STRING_AGG(COALESCE(sl.Name, sn.Name, N'همه'), N'، ')
          FROM mes.ProductStructureSite ss
          LEFT JOIN mes.ProductionLine sl ON sl.Id = ss.ProductionLineId
          LEFT JOIN mes.OrgNode sn ON sn.Id = ss.OrgNodeId
          WHERE ss.ProductStructureId = s.Id AND ss.IsDeleted = 0) AS ScopeSummary,
         (SELECT COUNT(*) FROM mes.ProductStructureTypeChange tc WHERE tc.ProductStructureId = s.Id AND tc.IsDeleted = 0 AND tc.ApprovalStatusCode = 1) AS PendingTypeChanges,
         (SELECT COUNT(*) FROM mes.ProductStructureAttachment a WHERE a.ProductStructureId = s.Id AND a.IsDeleted = 0
            AND a.DocumentTypeCode = 1 AND a.ValidToDate < CAST(GETDATE() AS DATE)) AS ExpiredLicenses,
         s.Description
  FROM mes.ProductStructure s
  LEFT JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1 AND m.IsDeleted = 0
  LEFT JOIN mes.Product p ON p.Id = m.ProductId
  LEFT JOIN mes.ProductionItem pi ON pi.ProductId = p.Id AND pi.IsDeleted = 0
  LEFT JOIN mes.ProductStructureGroup g ON g.Id = s.ProductStructureGroupId
  LEFT JOIN mes.ProductionRevision r ON r.Id = s.RevisionId
  LEFT JOIN mes.ProductStructure t ON t.Id = s.TemplateProductStructureId
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0
  ORDER BY CASE WHEN s.ProductStructureTypeCode = 3 THEN 1 ELSE 0 END, p.Number, s.IsDefaultProductStructure DESC, s.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetStructureItems
  @ProductStructureId BIGINT, @RevisionId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  /* ردیف‌های مؤثر با مقدار در اندازه‌ی مرجع. برای ردیف عیارمحور، نمونه‌ی مقدار واقعی در کمترین عیار مجاز
     ماده (ویژگی ASSAY از FRM-PE-01) هم برمی‌گردد. */
  DECLARE @Base DECIMAL(32,6) = (SELECT TOP 1 m.Quantity FROM mes.ProductStructureMaster m
                                 WHERE m.ProductStructureId = @ProductStructureId AND m.IsMainProduct = 1 AND m.IsDeleted = 0);
  SELECT CAST(x.ItemId AS INT) AS ItemId, x.Source, CAST(x.SourceStructureId AS INT) AS SourceStructureId, src.Number AS SourceStructureCode,
         x.Sequence, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS StockUnit,
         pi.IsPhantom, pi.ProductionRoleCode, x.ItemRoleTitle,
         x.QuantityTypeCode, CAST(x.Quantity AS DECIMAL(18,6)) AS Quantity, x.QuantityFormula, x.IsQuantumSatis,
         CAST(CASE x.QuantityTypeCode WHEN 4 THEN @Base * x.Quantity / 100 WHEN 3 THEN NULL ELSE x.Quantity END AS DECIMAL(18,6)) AS QuantityAtBase,
         x.IsActiveIngredient, x.AssayBasisPercent,
         cp.Number AS CompensationCode, cp.Name AS CompensationTitle,
         CAST(asy.MinValue AS DECIMAL(10,4)) AS AssayMin, CAST(asy.NominalValue AS DECIMAL(10,4)) AS AssayNominal,
         x.ToleranceForNormalWaste AS WastePercent, x.WasteTypeCode, CAST(x.WasteQuantity AS DECIMAL(18,6)) AS WasteQuantity, x.IsWastePriorityOverOperation,
         x.MinConsumptionPercent, x.MaxConsumptionPercent,
         x.ConsumptionUnitTitle, CAST(x.UnitConversionFactor AS DECIMAL(18,6)) AS UnitConversionFactor, x.IsBatchDependentConversion,
         x.Description
  FROM mes.fnStructureItems(@ProductStructureId, @RevisionId) x
  JOIN mes.Product p ON p.Id = x.ProductId
  LEFT JOIN mes.ProductionItem pi ON pi.ProductId = p.Id AND pi.IsDeleted = 0
  LEFT JOIN mes.ProductStructure src ON src.Id = x.SourceStructureId
  LEFT JOIN mes.Product cp ON cp.Id = x.PotencyCompensationProductId
  OUTER APPLY (
    SELECT TOP 1 a.MinValue, a.NominalValue
    FROM mes.ProductionItemAttribute a JOIN mes.ProductionAttribute d ON d.Id = a.ProductionAttributeId AND d.Number = N'ASSAY'
    WHERE a.ProductionItemId = pi.Id AND a.IsDeleted = 0
  ) asy
  ORDER BY CASE x.Source WHEN 'removed' THEN 1 ELSE 0 END, x.Sequence, p.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetStructureRevisions
  @ProductStructureId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(sr.Id AS INT) AS StructureRevisionId, CAST(r.Id AS INT) AS RevisionId, r.Number AS RevisionCode, r.Name AS RevisionTitle,
         sr.RevisionStatusCode, sr.EffectivityTypeCode, sr.ValidFromDate, sr.ValidToDate, sr.FromBatchNumber, sr.ToBatchNumber, sr.WorkOrderNumber,
         sr.ApproverTitle, sr.ApproveDate, sr.EcoNumber, sr.Description,
         CAST(CASE WHEN s.RevisionId = r.Id THEN 1 ELSE 0 END AS BIT) AS IsCurrent,
         (SELECT COUNT(*) FROM mes.ProductStructureItem i WHERE i.ProductStructureId = s.Id AND i.RevisionId = r.Id AND i.IsDeleted = 0) AS OwnItemCount
  FROM mes.ProductStructureRevision sr
  JOIN mes.ProductStructure s ON s.Id = sr.ProductStructureId
  JOIN mes.ProductionRevision r ON r.Id = sr.RevisionId
  WHERE sr.ProductStructureId = @ProductStructureId AND sr.IsDeleted = 0
  ORDER BY sr.ValidFromDate DESC, r.Number DESC;
END
GO

CREATE OR ALTER PROCEDURE mes.GetStructureScopes
  @ProductStructureId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(ss.Id AS INT) AS ScopeId,
         CASE WHEN ss.ProductionLineId IS NOT NULL THEN 'Line' ELSE n.LevelCode END AS LevelCode,
         COALESCE(l.Name, n.Name, N'همه‌ی واحدها') AS ScopeTitle,
         ss.ValidFromDate, ss.ValidToDate, ss.Description
  FROM mes.ProductStructureSite ss
  LEFT JOIN mes.ProductionLine l ON l.Id = ss.ProductionLineId
  LEFT JOIN mes.OrgNode n ON n.Id = ss.OrgNodeId
  WHERE ss.ProductStructureId = @ProductStructureId AND ss.IsDeleted = 0
  ORDER BY ss.ValidFromDate;
END
GO

CREATE OR ALTER PROCEDURE mes.GetStructureTypeChanges
  @ProductStructureId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(tc.Id AS INT) AS TypeChangeId, tc.FromTypeCode, tc.ToTypeCode, tc.RequestDate, tc.RequestedByTitle,
         tc.ApprovalStatusCode, tc.QcApproverTitle, tc.ManagerApproverTitle, tc.ApproveDate,
         ns.Number AS NewStructureCode, tc.Description
  FROM mes.ProductStructureTypeChange tc
  LEFT JOIN mes.ProductStructure ns ON ns.Id = tc.NewProductStructureId
  WHERE tc.ProductStructureId = @ProductStructureId AND tc.IsDeleted = 0
  ORDER BY tc.RequestDate DESC;
END
GO

CREATE OR ALTER PROCEDURE mes.GetStructureTypeTransitions
AS
BEGIN
  SET NOCOUNT ON;
  /* کدلیست موقت تبدیل‌های مجاز نوع ساختار (به سرآغاز اسکریپت نگاه کنید). */
  SELECT v.FromTypeCode, v.ToTypeCode, v.RequiredApproval
  FROM (VALUES
    (2, 4, N'مهندسی محصول'),
    (4, 1, N'کنترل کیفیت + مدیر فنی'),
    (2, 1, N'کنترل کیفیت + مدیر فنی'),
    (5, 2, N'مهندسی محصول')
  ) v(FromTypeCode, ToTypeCode, RequiredApproval);
END
GO

CREATE OR ALTER PROCEDURE mes.GetStructureAttachments
  @ProductStructureId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(GETDATE() AS DATE);
  SELECT CAST(a.Id AS INT) AS AttachmentId, a.DocumentTypeCode, a.Title, a.DocumentNumber, a.FileName,
         a.ValidFromDate, a.ValidToDate,
         CASE WHEN a.ValidToDate IS NULL THEN NULL ELSE DATEDIFF(DAY, @today, a.ValidToDate) END AS DaysLeft,
         CAST(CASE WHEN a.DmsDocumentId IS NULL THEN 0 ELSE 1 END AS BIT) AS IsLinked, a.Description
  FROM mes.ProductStructureAttachment a
  WHERE a.ProductStructureId = @ProductStructureId AND a.IsDeleted = 0
  ORDER BY a.DocumentTypeCode, a.Title;
END
GO

CREATE OR ALTER PROCEDURE mes.GetStructureDiff
  @LeftStructureId BIGINT, @LeftRevisionId BIGINT = NULL, @RightStructureId BIGINT, @RightRevisionId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  /* مقایسه‌ی ردیف‌های مؤثر دو ساختار یا دو نسخه (F-PE-017)، به‌ازای قلم مصرفی.
     DiffStatus: added (فقط در راست)، removed (فقط در چپ)، changed، same. ChangedFields نام فیلدهای تغییریافته. */
  SELECT x.* INTO #l FROM mes.fnStructureItems(@LeftStructureId, @LeftRevisionId) x WHERE x.Source <> 'removed';
  SELECT x.* INTO #r FROM mes.fnStructureItems(@RightStructureId, @RightRevisionId) x WHERE x.Source <> 'removed';

  SELECT CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS StockUnit,
         CASE WHEN l.ProductId IS NULL THEN 'added' WHEN r.ProductId IS NULL THEN 'removed'
              WHEN ch.Fields IS NULL THEN 'same' ELSE 'changed' END AS DiffStatus,
         ch.Fields AS ChangedFields,
         l.QuantityTypeCode AS LeftQuantityTypeCode, CAST(l.Quantity AS DECIMAL(18,6)) AS LeftQuantity, l.ToleranceForNormalWaste AS LeftWastePercent,
         r.QuantityTypeCode AS RightQuantityTypeCode, CAST(r.Quantity AS DECIMAL(18,6)) AS RightQuantity, r.ToleranceForNormalWaste AS RightWastePercent,
         COALESCE(r.Sequence, l.Sequence) AS Sequence
  FROM (SELECT ProductId FROM #l UNION SELECT ProductId FROM #r) k
  JOIN mes.Product p ON p.Id = k.ProductId
  LEFT JOIN #l l ON l.ProductId = k.ProductId
  LEFT JOIN #r r ON r.ProductId = k.ProductId
  OUTER APPLY (
    SELECT NULLIF(CONCAT(
      CASE WHEN l.Quantity <> r.Quantity THEN N'مقدار، ' END,
      CASE WHEN l.QuantityTypeCode <> r.QuantityTypeCode THEN N'نوع مقدار، ' END,
      CASE WHEN ISNULL(l.QuantityFormula, N'') <> ISNULL(r.QuantityFormula, N'') THEN N'فرمول، ' END,
      CASE WHEN ISNULL(l.ToleranceForNormalWaste, -1) <> ISNULL(r.ToleranceForNormalWaste, -1)
             OR ISNULL(l.WasteQuantity, -1) <> ISNULL(r.WasteQuantity, -1) THEN N'ضایعات، ' END,
      CASE WHEN ISNULL(l.MinConsumptionPercent, -1) <> ISNULL(r.MinConsumptionPercent, -1)
             OR ISNULL(l.MaxConsumptionPercent, -1) <> ISNULL(r.MaxConsumptionPercent, -1) THEN N'محدوده‌ی مصرف، ' END,
      CASE WHEN ISNULL(l.AssayBasisPercent, -1) <> ISNULL(r.AssayBasisPercent, -1) THEN N'عیار مبنا، ' END,
      CASE WHEN ISNULL(l.ConsumptionUnitTitle, N'') <> ISNULL(r.ConsumptionUnitTitle, N'')
             OR ISNULL(l.UnitConversionFactor, -1) <> ISNULL(r.UnitConversionFactor, -1) THEN N'واحد مصرف، ' END,
      CASE WHEN l.IsQuantumSatis <> r.IsQuantumSatis THEN N'q.s.، ' END
    ), N'') AS Fields
    WHERE l.ProductId IS NOT NULL AND r.ProductId IS NOT NULL
  ) ch
  ORDER BY CASE WHEN l.ProductId IS NULL THEN 1 WHEN r.ProductId IS NULL THEN 2 WHEN ch.Fields IS NULL THEN 4 ELSE 0 END,
           COALESCE(r.Sequence, l.Sequence);
END
GO

/* -------------------------------------------------------------------
   بخش ۵ — داده‌ی نمونه (شرکت ۲۲۲). فقط وقتی جدول ساختار خالی است.
   عمداً خراب: جمع درصد «پیش‌مخلوط رنگ» ۹۸٫۵٪ است؛ پروانه‌ی ساخت قرص روکش‌دار منقضی شده؛
   ساختار آزمایشی قرص ۱۰۰۰ برای کالایی است که هنوز نقش تولیدی ندارد و درخواست تبدیلش منتظر تأیید است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductStructure)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @L2 BIGINT = (SELECT TOP 1 Id FROM mes.ProductionLine WHERE Name = N'خط قرص‌سازی ۲');
  DECLARE @Company BIGINT = (SELECT TOP 1 Id FROM mes.OrgNode WHERE LevelCode = 'Company');
  DECLARE @Factory BIGINT = (SELECT TOP 1 Id FROM mes.OrgNode WHERE LevelCode = 'Factory');
  DECLARE @Hall BIGINT = (SELECT TOP 1 Id FROM mes.OrgNode WHERE Name = N'سالن جامدات');

  /* کالاهای تازه‌ی مورد نیاز ساختارها (اگر نباشند) + نقش تولیدی و سیاست خرید */
  INSERT mes.Product (CompanyId, Id, Number, Name, MeasureUnitTitle, ProductGroupTitle)
  SELECT @C, v.Id, v.Number, v.Name, v.Unit, v.GroupTitle
  FROM (VALUES
    (3005, N'P-3005', N'نشاسته‌ی ذرت',          N'kg',  N'مواد جانبی'),
    (3006, N'P-3006', N'پوویدون K30',           N'kg',  N'مواد جانبی'),
    (3007, N'P-3007', N'آب خالص',               N'لیتر', N'مواد جانبی'),
    (3008, N'P-3008', N'کراس‌کارملوز سدیم',      N'kg',  N'مواد جانبی'),
    (3010, N'P-3010', N'اکسید آهن قرمز',        N'kg',  N'رنگ‌ها'),
    (4005, N'P-4005', N'بروشور',                N'عدد', N'مواد بسته‌بندی')
  ) v(Id, Number, Name, Unit, GroupTitle)
  WHERE NOT EXISTS (SELECT 1 FROM mes.Product p WHERE p.Id = v.Id);

  INSERT mes.ProductionItem (CompanyId, ProductId, ProductionRoleCode, TrackingLevelCode, IsTrackingMandatory)
  SELECT @C, v.Id, v.Role, 1, 1
  FROM (VALUES (3005, 3), (3006, 3), (3007, 3), (3008, 3), (3010, 3), (4005, 4)) v(Id, Role)
  WHERE NOT EXISTS (SELECT 1 FROM mes.ProductionItem i WHERE i.ProductId = v.Id);

  INSERT mes.ProductionItemSupplyPolicy (CompanyId, ProductionItemId, ProductSourceCode, Priority)
  SELECT @C, i.Id, 2, 1
  FROM mes.ProductionItem i
  WHERE i.ProductId IN (3005, 3006, 3007, 3008, 3010, 4005)
    AND NOT EXISTS (SELECT 1 FROM mes.ProductionItemSupplyPolicy s WHERE s.ProductionItemId = i.Id);

  INSERT mes.ProductionRevision (CompanyId, Number, Name) VALUES
    (@C, N'v1', N'نسخه‌ی ۱'), (@C, N'v2', N'نسخه‌ی ۲'), (@C, N'v3', N'نسخه‌ی ۳');
  DECLARE @V1 BIGINT = (SELECT Id FROM mes.ProductionRevision WHERE Number = N'v1');
  DECLARE @V2 BIGINT = (SELECT Id FROM mes.ProductionRevision WHERE Number = N'v2');

  INSERT mes.ProductStructureGroup (CompanyId, Number, Name) VALUES
    (@C, N'SG-TAB', N'قرص‌های ساده'), (@C, N'SG-COAT', N'قرص‌های روکش‌دار'), (@C, N'SG-INT', N'نیمه‌ساخته‌ها');

  /* سربرگ ساختارها. TypeCode: 1 تولیدی، 2 آزمایشی، 3 الگو. StatusCode: 3 تأییدشده، 1 پیش‌نویس */
  INSERT mes.ProductStructure (CompanyId, Number, Name, ProductStructureGroupId, RevisionId, ProductStructureTypeCode, ProductStructureStatusCode,
                               IsDefaultProductStructure, License, MinimumQuantity, MaximumQuantity, BatchMultiple, AllowPercentOver100,
                               ValidFromDate, ProfileCode, IsProductionByOrder, Description)
  SELECT @C, v.Number, v.Name, g.Id, CASE v.Rev WHEN 2 THEN @V2 ELSE @V1 END, v.TypeCode, v.StatusCode,
         v.IsDefault, v.License, v.MinQ, v.MaxQ, v.Multiple, 0, v.ValidFrom, N'PHARMA', v.ByOrder, v.Description
  FROM (VALUES
    (N'TPL-COAT',    N'الگوی قرص روکش‌دار',               N'SG-COAT', 1, 3, 3, 0, NULL,           NULL,   NULL,    NULL,   CAST('2025-03-21' AS DATETIME2), 0, N'الگوی بسته‌بندی و روکش قرص‌های روکش‌دار'),
    (N'BOM-1001-A',  N'قرص سفید ساده ۵۰۰ — ساختار اصلی',  N'SG-TAB',  2, 1, 3, 1, N'IR-1404-5521', 150000, 600000,  50000,  '2025-06-22', 0, NULL),
    (N'BOM-1001-B',  N'قرص سفید ساده ۵۰۰ — بچ بزرگ خط ۲', N'SG-TAB',  1, 1, 3, 0, N'IR-1404-5521', 300000, 1200000, 100000, '2026-03-21', 0, N'فقط برای خط ۲'),
    (N'BOM-1002',    N'قرص روکش‌دار ۲۵۰',                 N'SG-COAT', 2, 1, 3, 1, N'IR-1403-1180', 250000, 1000000, 250000, '2025-03-21', 0, N'ایجادشده از الگوی TPL-COAT'),
    (N'BOM-2001',    N'گرانول قرص سفید',                  N'SG-INT',  1, 1, 3, 1, NULL,           60,     240,     30,     '2025-06-22', 0, NULL),
    (N'BOM-2003',    N'محلول روکش',                       N'SG-INT',  1, 1, 3, 1, NULL,           25,     100,     25,     '2025-03-21', 0, N'فانتوم — در همان بچ ساخته و مصرف می‌شود'),
    (N'BOM-2004',    N'پیش‌مخلوط رنگ',                    N'SG-INT',  1, 1, 1, 1, NULL,           5,      20,      5,      '2026-09-23', 0, N'پیش‌نویس'),
    (N'RND-1005',    N'قرص سفید ساده ۱۰۰۰ — آزمایشی',     N'SG-TAB',  1, 2, 1, 1, NULL,           1000,   5000,    1000,   '2026-09-01', 1, N'بچ آزمایشی برای پرونده‌ی ثبت')
  ) v(Number, Name, GroupNo, Rev, TypeCode, StatusCode, IsDefault, License, MinQ, MaxQ, Multiple, ValidFrom, ByOrder, Description)
  JOIN mes.ProductStructureGroup g ON g.Number = v.GroupNo;

  UPDATE s SET s.TemplateProductStructureId = t.Id
  FROM mes.ProductStructure s JOIN mes.ProductStructure t ON t.Number = N'TPL-COAT'
  WHERE s.Number = N'BOM-1002';

  /* محصول اصلی و اندازه‌ی مرجع؛ الگو محصول ندارد و اندازه‌ی مرجعش ۱۰۰٬۰۰۰ قرص فرضی است */
  INSERT mes.ProductStructureMaster (CompanyId, ProductStructureId, ProductId, Quantity)
  SELECT @C, s.Id, v.ProductId, v.Qty
  FROM (VALUES
    (N'BOM-1001-A', 1001, 300000), (N'BOM-1001-B', 1001, 600000), (N'BOM-1002', 1002, 500000),
    (N'BOM-2001', 2001, 120), (N'BOM-2003', 2003, 50), (N'BOM-2004', 2004, 10), (N'RND-1005', 1005, 2000)
  ) v(Number, ProductId, Qty)
  JOIN mes.ProductStructure s ON s.Number = v.Number;

  /* ردیف‌ها. QType: 1 ثابت، 2 متناسب، 4 درصدی. Inherit: 1 بازنویسی، 2 حذف. */
  INSERT mes.ProductStructureItem (CompanyId, ProductStructureId, RevisionId, Sequence, ProductId, ItemRoleTitle, QuantityTypeCode, Quantity,
                                   QuantityFormula, IsQuantumSatis, IsActiveIngredient, IsMainMaterial, AssayBasisPercent, PotencyCompensationProductId,
                                   ToleranceForNormalWaste, WasteTypeCode, WasteQuantity, MinConsumptionPercent, MaxConsumptionPercent,
                                   ConsumptionUnitTitle, UnitConversionFactor, IsBatchDependentConversion, InheritanceActionCode, IsBackFlushed, Description)
  SELECT @C, s.Id, CASE v.Rev WHEN 2 THEN @V2 ELSE @V1 END, v.Seq, v.ProductId, v.RoleTitle, v.QType, v.Qty,
         v.Formula, v.QS, v.Active, v.MainMat, v.AssayBasis, v.Compensation,
         v.WastePct, CASE WHEN v.WastePct IS NOT NULL THEN 1 WHEN v.WasteQty IS NOT NULL THEN 2 END, v.WasteQty, v.MinPct, v.MaxPct,
         v.ConsUnit, v.ConvFactor, v.BatchConv, v.Inherit, v.Backflush, v.Description
  FROM (VALUES
    /* الگوی قرص روکش‌دار (v1) — بر اساس ۱۰۰٬۰۰۰ قرص */
    (N'TPL-COAT',   1, 20, 2003, N'روکش',          2, 6,       NULL, 0, 0, 0, NULL,  NULL, 5.0,  NULL, 95,  105, NULL,  NULL,   0, NULL, 0, NULL),
    (N'TPL-COAT',   1, 50, 4001, N'بسته‌بندی',      2, 9,       NULL, 0, 0, 0, NULL,  NULL, 3.0,  NULL, NULL, NULL, N'متر', 0.032, 1, NULL, 1, N'ضخامت فویل بچ‌به‌بچ فرق دارد'),
    (N'TPL-COAT',   1, 60, 4002, N'بسته‌بندی',      2, 12,      NULL, 0, 0, 0, NULL,  NULL, 4.0,  NULL, NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    (N'TPL-COAT',   1, 70, 4003, N'بسته‌بندی',      2, 3334,    NULL, 0, 0, 0, NULL,  NULL, NULL, 20,   NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    (N'TPL-COAT',   1, 80, 4005, N'بسته‌بندی',      2, 3334,    NULL, 0, 0, 0, NULL,  NULL, NULL, 20,   NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    /* قرص روکش‌دار (v2، از الگو): ردیف خودش + بازنویسی محلول روکش + حذف بروشور */
    (N'BOM-1002',   2, 10, 2002, N'هسته‌ی قرص',     2, 500000,  NULL, 0, 0, 1, NULL,  NULL, 0.5,  NULL, 99,  101, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-1002',   2, 20, 2003, N'روکش',          2, 32,      NULL, 0, 0, 0, NULL,  NULL, 6.0,  NULL, 95,  105, NULL,  NULL,   0, 1,    0, N'بازنویسی الگو: روکش ضخیم‌تر'),
    (N'BOM-1002',   2, 80, 4005, N'بسته‌بندی',      2, 0,       NULL, 0, 0, 0, NULL,  NULL, NULL, NULL, NULL, NULL, NULL,  NULL,   0, 2,    0, N'بروشور روی کارتن چاپ می‌شود'),
    /* قرص روکش‌دار v1 (برای مقایسه) */
    (N'BOM-1002',   1, 10, 2002, N'هسته‌ی قرص',     2, 500000,  NULL, 0, 0, 1, NULL,  NULL, 1.0,  NULL, 99,  101, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-1002',   1, 20, 2003, N'روکش',          2, 30,      NULL, 0, 0, 0, NULL,  NULL, 5.0,  NULL, 95,  105, NULL,  NULL,   0, 1,    0, NULL),
    /* قرص سفید ساده ۵۰۰ — ساختار اصلی v2 (جاری) */
    (N'BOM-1001-A', 2, 10, 2001, N'گرانول',         2, 175.5,   NULL, 0, 0, 1, NULL,  NULL, 0.5,  NULL, 99,  101, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-1001-A', 2, 20, 3008, N'متلاشی‌کننده',   2, 3.0,     NULL, 0, 0, 0, NULL,  NULL, NULL, NULL, 98,  102, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-1001-A', 2, 30, 3003, N'روان‌کننده',     2, 1.5,     NULL, 0, 0, 0, NULL,  NULL, NULL, NULL, 95,  105, N'گرم', 0.001,  0, NULL, 0, N'توزین به گرم، انبار به کیلوگرم'),
    (N'BOM-1001-A', 2, 50, 4001, N'بسته‌بندی',      2, 27,      NULL, 0, 0, 0, NULL,  NULL, 3.0,  NULL, NULL, NULL, N'متر', 0.032, 1, NULL, 1, NULL),
    (N'BOM-1001-A', 2, 60, 4002, N'بسته‌بندی',      2, 36,      NULL, 0, 0, 0, NULL,  NULL, 4.0,  NULL, NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    (N'BOM-1001-A', 2, 70, 4003, N'بسته‌بندی',      2, 10000,   NULL, 0, 0, 0, NULL,  NULL, NULL, 50,   NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    (N'BOM-1001-A', 2, 80, 4005, N'بسته‌بندی',      2, 10000,   NULL, 0, 0, 0, NULL,  NULL, NULL, 50,   NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    /* قرص سفید ساده ۵۰۰ — ساختار اصلی v1 (منسوخ؛ برای مقایسه) */
    (N'BOM-1001-A', 1, 10, 2001, N'گرانول',         2, 175.5,   NULL, 0, 0, 1, NULL,  NULL, 1.0,  NULL, 99,  101, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-1001-A', 1, 20, 3008, N'متلاشی‌کننده',   2, 2.7,     NULL, 0, 0, 0, NULL,  NULL, NULL, NULL, 98,  102, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-1001-A', 1, 30, 3003, N'روان‌کننده',     2, 1.8,     NULL, 0, 0, 0, NULL,  NULL, NULL, NULL, 95,  105, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-1001-A', 1, 50, 4001, N'بسته‌بندی',      2, 27,      NULL, 0, 0, 0, NULL,  NULL, 3.0,  NULL, NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    (N'BOM-1001-A', 1, 60, 4002, N'بسته‌بندی',      2, 36,      NULL, 0, 0, 0, NULL,  NULL, 4.0,  NULL, NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    (N'BOM-1001-A', 1, 70, 4003, N'بسته‌بندی',      2, 10000,   NULL, 0, 0, 0, NULL,  NULL, NULL, 50,   NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    /* قرص سفید ساده ۵۰۰ — بچ بزرگ خط ۲ (v1) */
    (N'BOM-1001-B', 1, 10, 2001, N'گرانول',         2, 351,     NULL, 0, 0, 1, NULL,  NULL, 0.5,  NULL, 99,  101, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-1001-B', 1, 20, 3008, N'متلاشی‌کننده',   2, 6.0,     NULL, 0, 0, 0, NULL,  NULL, NULL, NULL, 98,  102, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-1001-B', 1, 30, 3003, N'روان‌کننده',     2, 3.0,     NULL, 0, 0, 0, NULL,  NULL, NULL, NULL, 95,  105, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-1001-B', 1, 50, 4001, N'بسته‌بندی',      2, 54,      NULL, 0, 0, 0, NULL,  NULL, 2.5,  NULL, NULL, NULL, N'متر', 0.032, 1, NULL, 1, NULL),
    (N'BOM-1001-B', 1, 60, 4002, N'بسته‌بندی',      2, 72,      NULL, 0, 0, 0, NULL,  NULL, 3.5,  NULL, NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    (N'BOM-1001-B', 1, 70, 4003, N'بسته‌بندی',      2, 20000,   NULL, 0, 0, 0, NULL,  NULL, NULL, 80,   NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    (N'BOM-1001-B', 1, 80, 4005, N'بسته‌بندی',      2, 20000,   NULL, 0, 0, 0, NULL,  NULL, NULL, 80,   NULL, NULL, NULL,  NULL,   0, NULL, 1, NULL),
    /* گرانول قرص سفید — فرمول درصدی، ماده‌ی مؤثره عیارمحور با جبران روی لاکتوز */
    (N'BOM-2001',   1, 10, 3001, N'ماده‌ی مؤثره',   4, 83.30,   NULL, 0, 1, 1, 100.0, 3002, 0.3,  NULL, 99.5, 100.5, NULL, NULL,   0, NULL, 0, N'مقدار نظری بر مبنای عیار ۱۰۰٪'),
    (N'BOM-2001',   1, 20, 3002, N'پرکننده',        4, 8.70,    NULL, 0, 0, 0, NULL,  NULL, 0.3,  NULL, 95,  105, NULL,  NULL,   0, NULL, 0, N'جبران عیار ماده‌ی مؤثره'),
    (N'BOM-2001',   1, 30, 3005, N'رقیق‌کننده',      4, 5.00,    NULL, 0, 0, 0, NULL,  NULL, 0.3,  NULL, 98,  102, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-2001',   1, 40, 3006, N'چسباننده',       4, 3.00,    NULL, 0, 0, 0, NULL,  NULL, NULL, NULL, 98,  102, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-2001',   1, 50, 3007, N'مایع گرانولاسیون', 3, 0,     N'۰٫۲۵ × وزن بچ (kg)', 0, 0, 0, NULL, NULL, NULL, NULL, 80, 120, NULL, NULL, 0, NULL, 0, N'در خشک‌کردن تبخیر می‌شود — خارج از جمع درصد'),
    /* محلول روکش — HPMC درصدی و آب q.s. */
    (N'BOM-2003',   1, 10, 3004, N'پلیمر روکش',     4, 12.00,   NULL, 0, 0, 1, NULL,  NULL, 2.0,  NULL, 98,  102, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-2003',   1, 20, 3007, N'حلال',           4, 0,       NULL, 1, 0, 0, NULL,  NULL, NULL, NULL, NULL, NULL, NULL,  NULL,   0, NULL, 0, N'q.s. تا ۱۰۰٪'),
    /* پیش‌مخلوط رنگ — جمع ۹۸٫۵٪ (عمداً خراب) */
    (N'BOM-2004',   1, 10, 3002, N'حامل',           4, 88.50,   NULL, 0, 0, 1, NULL,  NULL, NULL, NULL, 98,  102, NULL,  NULL,   0, NULL, 0, NULL),
    (N'BOM-2004',   1, 20, 3010, N'رنگ',            4, 10.00,   NULL, 0, 0, 0, NULL,  NULL, NULL, NULL, 98,  102, NULL,  NULL,   0, NULL, 0, NULL),
    /* قرص ۱۰۰۰ آزمایشی — مقدار فرمولی وابسته به وزن قرص */
    (N'RND-1005',   1, 10, 3001, N'ماده‌ی مؤثره',   2, 2.0,     NULL, 0, 1, 1, 100.0, 3002, NULL, NULL, 99.5, 100.5, NULL, NULL,   0, NULL, 0, NULL),
    (N'RND-1005',   1, 20, 3002, N'پرکننده',        3, 0,       N'وزن قرص (۱۱۵۰mg) × تعداد − مجموع سایر اجزا', 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, NULL),
    (N'RND-1005',   1, 30, 3006, N'چسباننده',       2, 0.1,     NULL, 0, 0, 0, NULL,  NULL, NULL, NULL, NULL, NULL, NULL,  NULL,   0, NULL, 0, NULL)
  ) v(Number, Rev, Seq, ProductId, RoleTitle, QType, Qty, Formula, QS, Active, MainMat, AssayBasis, Compensation, WastePct, WasteQty, MinPct, MaxPct,
      ConsUnit, ConvFactor, BatchConv, Inherit, Backflush, Description)
  JOIN mes.ProductStructure s ON s.Number = v.Number;

  /* نسخه‌ها و اعتبار. Status: 3 فعال، 4 منسوخ، 1 پیش‌نویس. Effectivity: 1 تاریخ، 2 بچ، 3 سفارش. */
  INSERT mes.ProductStructureRevision (CompanyId, RevisionId, ProductId, ProductStructureId, ValidFromDate, ValidToDate, EffectivityTypeCode,
                                       FromBatchNumber, ToBatchNumber, WorkOrderNumber, RevisionStatusCode, ApproverTitle, ApproveDate, EcoNumber, Description)
  SELECT @C, CASE v.Rev WHEN 2 THEN @V2 ELSE @V1 END, m.ProductId, s.Id, v.ValidFrom, v.ValidTo, v.Eff, v.FromBatch, v.ToBatch, v.WorkOrder,
         v.Status, v.Approver, v.ApproveDate, v.Eco, v.Description
  FROM (VALUES
    (N'BOM-1001-A', 1, CAST('2025-06-22' AS DATETIME2), CAST('2026-03-20' AS DATETIME2), 1, NULL, NULL, NULL, 4, N'دکتر نوروزی — مدیر فنی', CAST('2025-06-15' AS DATETIME2), NULL, N'نسخه‌ی اولیه'),
    (N'BOM-1001-A', 2, '2026-03-21', NULL,         1, NULL, NULL, NULL, 3, N'دکتر نوروزی — مدیر فنی', '2026-03-10', N'ECO-1405-0071', N'کاهش روان‌کننده، افزایش متلاشی‌کننده، افزودن بروشور'),
    (N'BOM-1001-B', 1, '2026-03-21', NULL,         1, NULL, NULL, NULL, 3, N'دکتر نوروزی — مدیر فنی', '2026-03-10', NULL, NULL),
    (N'BOM-1002',   1, '2025-03-21', NULL,         2, NULL, N'B-1405-0119', NULL, 4, N'دکتر نوروزی — مدیر فنی', '2025-03-15', NULL, N'تا بچ B-1405-0119'),
    (N'BOM-1002',   2, '2026-05-22', NULL,         2, N'B-1405-0120', NULL, NULL, 3, N'دکتر نوروزی — مدیر فنی', '2026-05-20', N'ECO-1405-0088', N'روکش ضخیم‌تر از بچ B-1405-0120'),
    (N'BOM-2001',   1, '2025-06-22', NULL,         1, NULL, NULL, NULL, 3, N'دکتر نوروزی — مدیر فنی', '2025-06-15', NULL, NULL),
    (N'BOM-2003',   1, '2025-03-21', NULL,         1, NULL, NULL, NULL, 3, N'دکتر نوروزی — مدیر فنی', '2025-03-15', NULL, NULL),
    (N'BOM-2004',   1, '2026-09-23', NULL,         1, NULL, NULL, NULL, 1, NULL, NULL, NULL, N'پیش‌نویس'),
    (N'RND-1005',   1, '2026-09-01', NULL,         3, NULL, NULL, N'WO-RND-0007', 1, NULL, NULL, NULL, N'فقط برای دستور آزمایشی WO-RND-0007')
  ) v(Number, Rev, ValidFrom, ValidTo, Eff, FromBatch, ToBatch, WorkOrder, Status, Approver, ApproveDate, Eco, Description)
  JOIN mes.ProductStructure s ON s.Number = v.Number
  JOIN mes.ProductStructureMaster m ON m.ProductStructureId = s.Id AND m.IsMainProduct = 1;

  INSERT mes.ProductStructureRevision (CompanyId, RevisionId, ProductId, ProductStructureId, ValidFromDate, EffectivityTypeCode, RevisionStatusCode, ApproverTitle, ApproveDate)
  SELECT @C, @V1, NULL, s.Id, '2025-03-21', 1, 3, N'مهندسی محصول', '2025-03-15' FROM mes.ProductStructure s WHERE s.Number = N'TPL-COAT';

  /* دامنه‌ی سازمانی */
  INSERT mes.ProductStructureSite (CompanyId, ProductStructureId, OrgNodeId, ProductionLineId, ValidFromDate, Description)
  SELECT @C, s.Id, v.OrgNode, v.Line, v.ValidFrom, v.Description
  FROM (VALUES
    (N'BOM-1001-A', @Factory, NULL, CAST('2025-06-22' AS DATE), NULL),
    (N'BOM-1001-B', NULL,     @L2,  '2026-03-21', N'بچ بزرگ فقط با میکسر خط ۲'),
    (N'BOM-1002',   @Factory, NULL, '2025-03-21', NULL),
    (N'BOM-2001',   @Company, NULL, '2025-06-22', NULL),
    (N'BOM-2003',   @Company, NULL, '2025-03-21', NULL),
    (N'BOM-2004',   @Hall,    NULL, '2026-09-23', NULL),
    (N'RND-1005',   @Hall,    NULL, '2026-09-01', N'آزمایشگاه پایلوت سالن جامدات')
  ) v(Number, OrgNode, Line, ValidFrom, Description)
  JOIN mes.ProductStructure s ON s.Number = v.Number;

  /* تبدیل نوع */
  INSERT mes.ProductStructureTypeChange (CompanyId, ProductStructureId, FromTypeCode, ToTypeCode, RequestDate, RequestedByTitle, ApprovalStatusCode,
                                         QcApproverTitle, ManagerApproverTitle, ApproveDate, Description)
  SELECT @C, s.Id, v.FromT, v.ToT, v.ReqDate, v.ReqBy, v.Status, v.Qc, v.Mgr, v.ApproveDate, v.Description
  FROM (VALUES
    (N'BOM-2001', 2, 1, CAST('2025-06-01' AS DATE), N'مهندسی محصول', 2, N'سرپرست کنترل کیفیت', N'دکتر نوروزی — مدیر فنی', CAST('2025-06-15' AS DATE), N'پس از سه بچ اعتبارسنجی'),
    (N'RND-1005', 2, 1, '2026-10-01',               N'مهندسی محصول', 1, NULL, NULL, NULL, N'منتظر نتیجه‌ی پایداری ۳ ماهه')
  ) v(Number, FromT, ToT, ReqDate, ReqBy, Status, Qc, Mgr, ApproveDate, Description)
  JOIN mes.ProductStructure s ON s.Number = v.Number;

  /* مدارک */
  INSERT mes.ProductStructureAttachment (CompanyId, ProductStructureId, DocumentTypeCode, Title, DocumentNumber, FileName, ValidFromDate, ValidToDate, Description)
  SELECT @C, s.Id, v.TypeCode, v.Title, v.DocNo, v.FileName, v.ValidFrom, v.ValidTo, v.Description
  FROM (VALUES
    (N'BOM-1001-A', 1, N'پروانه‌ی ساخت — قرص سفید ساده ۵۰۰',   N'IR-1404-5521', N'license-1001.pdf', CAST('2025-02-19' AS DATE), CAST('2027-02-19' AS DATE), NULL),
    (N'BOM-1001-A', 2, N'مشخصات فنی محصول نهایی',            N'SPEC-1001-03', N'spec-1001.pdf',    '2026-03-10', NULL, NULL),
    (N'BOM-1001-A', 4, N'نقشه‌ی بسته‌بندی بلیستر',             N'DRW-PK-0412',  N'blister-0412.pdf', '2025-11-05', NULL, NULL),
    (N'BOM-1002',   1, N'پروانه‌ی ساخت — قرص روکش‌دار ۲۵۰',     N'IR-1403-1180', N'license-1002.pdf', '2024-09-01', '2026-09-01', N'تمدید در جریان'),
    (N'BOM-1002',   3, N'تصویر قرص روکش‌دار',                 NULL,            N'tablet-1002.jpg',  NULL, NULL, NULL),
    (N'RND-1005',   2, N'گزارش توسعه‌ی فرمولاسیون',            N'RND-REP-0031', N'rnd-1005.pdf',     '2026-09-01', NULL, NULL)
  ) v(Number, TypeCode, Title, DocNo, FileName, ValidFrom, ValidTo, Description)
  JOIN mes.ProductStructure s ON s.Number = v.Number;

  COMMIT;
END
GO
