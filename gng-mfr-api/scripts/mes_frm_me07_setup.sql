/* =====================================================================
   اسکیمای mes — گام ۲۴: FRM-ME-07 «برون‌سپاری و کارمزدی»

   پیش‌نیاز: mes_frm_me04 (مواد عملیات)، mes_frm_rm08 (پیمانکار، قابلیت و نرخ).
   یادداشت ALM: «هر دو جهت در یک فرم با تب مجزا».

   نسخه‌ی قبل فقط پرچم داشت: RoutingOperation.IsOutsourcing، ProductStructure.PartyRoleCode/CustomerPartyId،
   IsCustomerMaterial روی مواد دستور کار و انبار امانی. جدول‌ها جدیدند:
     mes.RoutingOperationSubcontract      جدید — برون‌سپاری (Subcontract-Out) یک عملیات روش: پیمانکار با اولویت و شرط انتخاب
                                          (F-ME-050، 054)، نرخ، واحد، زمان تحویل و ضایعات مجاز نزد پیمانکار (052)، تأمین مواد
                                          (053) و قلم خدمت خرید برای درخواست خرید خدمت (058). ProductionOperationId = عملیاتی
                                          که قابلیت و نرخ پیمانکار در FRM-RM-08 به آن ثبت شده.
     mes.RoutingOperationSubcontractItem  جدید — اقلام ارسالی به پیمانکار و دریافتی از او، با منبع تأمین هر قلم (F-ME-051، 053)
     mes.RoutingTollMaterial              جدید — روش کارمزدی دریافتی (Subcontract-In، F-ME-055): مالکیت هر قلم ساختار
                                          (مشتری/ما، 056) و تسویه‌ی مازاد و ضایعات مواد امانی (057)

   فرض‌ها و کدهای موقت:
     SelectionRuleCode       1 = اصلی، 2 = ظرفیت/در دسترس بودن، 3 = کمترین هزینه، 4 = کمترین زمان تحویل
     MaterialSupplyCode      1 = ما تأمین می‌کنیم، 2 = پیمانکار تأمین می‌کند، 3 = ترکیبی (قلم به قلم)
     DirectionCode           1 = ارسالی به پیمانکار، 2 = دریافتی از پیمانکار
     SupplyModeCode          1 = ما، 2 = پیمانکار
     OwnershipCode           1 = مشتری (امانی)، 2 = ما
     SettlementCode          1 = بازگشت به مشتری، 2 = فروش به مشتری، 3 = اسقاط با صورت‌جلسه

   فاز اول: F-ME-050 تا 053، 055 تا 058 (الزامی) و 054 (مهم، همان جدول). اتصال واقعی به سیستم تدارکات (058) فقط
   قلم خدمت را نگه می‌دارد. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.RoutingOperationSubcontract','U') IS NULL
CREATE TABLE mes.RoutingOperationSubcontract (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RoutingOperationSubcontract PRIMARY KEY,
  RoutingOperationId BIGINT NOT NULL,
  ProductionContractorId BIGINT NOT NULL,
  ProductionOperationId BIGINT NULL,
  Priority INT NOT NULL CONSTRAINT DF_mes_ROS_Priority DEFAULT (1),
  SelectionRuleCode INT NOT NULL CONSTRAINT DF_mes_ROS_Rule DEFAULT (1),
  FeePerUnit DECIMAL(32,6) NULL,
  FeeUnitTitle NVARCHAR(128) NULL,
  CurrencyTitle NVARCHAR(64) NULL,
  LeadTimeDays INT NULL,
  AllowedWastePercent DECIMAL(9,4) NULL,
  MaterialSupplyCode INT NOT NULL CONSTRAINT DF_mes_ROS_Supply DEFAULT (1),
  ServiceItemTitle NVARCHAR(256) NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ROS_IsActive DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.RoutingOperationSubcontractItem','U') IS NULL
CREATE TABLE mes.RoutingOperationSubcontractItem (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RoutingOperationSubcontractItem PRIMARY KEY,
  RoutingOperationId BIGINT NOT NULL,
  DirectionCode INT NOT NULL CONSTRAINT CK_mes_ROSI_Direction CHECK (DirectionCode IN (1, 2)),
  ProductId BIGINT NOT NULL,
  Quantity DECIMAL(32,6) NULL,
  SupplyModeCode INT NOT NULL CONSTRAINT DF_mes_ROSI_Supply DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.RoutingTollMaterial','U') IS NULL
CREATE TABLE mes.RoutingTollMaterial (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RoutingTollMaterial PRIMARY KEY,
  RoutingId BIGINT NOT NULL,
  ProductId BIGINT NOT NULL,
  OwnershipCode INT NOT NULL CONSTRAINT CK_mes_RTM_Ownership CHECK (OwnershipCode IN (1, 2)),
  SurplusSettlementCode INT NULL,
  WasteSettlementCode INT NULL,
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

/* عملیات برون‌سپاری روش‌ها (ماهیت ۵ یا IsOutsourcing) با جایگاهشان در روش */
CREATE OR ALTER PROCEDURE mes.GetOutsourcedOperations
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.Id AS INT) AS RoutingOperationId, CAST(r.Id AS INT) AS RoutingId, r.Number + N' ' + rv.Number + N' — ' + r.Name AS RoutingTitle, r.RoutingMasterStatusCode AS RoutingStatusCode,
         o.Sequence, op.Number + N' — ' + op.Name AS OperationTitle,
         (SELECT COUNT(*) FROM mes.RoutingOperation x WHERE x.RoutingId = o.RoutingId AND x.Sequence < o.Sequence AND x.IsDeleted = 0) AS OpsBefore,
         (SELECT COUNT(*) FROM mes.RoutingOperation x WHERE x.RoutingId = o.RoutingId AND x.Sequence > o.Sequence AND x.IsDeleted = 0) AS OpsAfter,
         (SELECT COUNT(*) FROM mes.RoutingOperationSubcontract s WHERE s.RoutingOperationId = o.Id AND s.IsDeleted = 0) AS ContractorCount
  FROM mes.RoutingOperation o
  JOIN mes.RoutingMaster r ON r.Id = o.RoutingId
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0 AND (o.IsOutsourcing = 1 OR op.OperationTypeCode = 5)
  ORDER BY r.Number, o.Sequence;
END
GO

/* پیمانکاران هر عملیات با کنترل قابلیت، وضعیت و نرخ جاری FRM-RM-08 */
CREATE OR ALTER PROCEDURE mes.GetRoutingSubcontracts
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(GETDATE() AS DATE);
  SELECT CAST(s.RoutingOperationId AS INT) AS RoutingOperationId, CAST(s.Id AS INT) AS SubcontractId, CAST(c.Id AS INT) AS ContractorId, c.Number + N' — ' + c.Name AS ContractorTitle,
         c.IsActive AS ContractorIsActive, c.QualificationStatusCode, c.ContractToDate, cop.Number + N' — ' + cop.Name AS CapabilityOperation,
         s.Priority, s.SelectionRuleCode, s.FeePerUnit, s.FeeUnitTitle, s.CurrencyTitle, s.LeadTimeDays, s.AllowedWastePercent, s.MaterialSupplyCode, s.ServiceItemTitle,
         s.IsActive, s.Description,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductionContractorCapability k WHERE k.ContractorId = c.Id AND k.ProductionOperationId = s.ProductionOperationId
                                AND k.IsDeleted = 0 AND (k.QualifiedUntilDate IS NULL OR k.QualifiedUntilDate >= @today)) THEN 1 ELSE 0 END AS BIT) AS HasCapability,
         (SELECT TOP (1) rt.FeePerUnit FROM mes.ProductionContractorRate rt WHERE rt.ContractorId = c.Id AND rt.ProductionOperationId = s.ProductionOperationId AND rt.IsDeleted = 0
            AND rt.ValidFromDate <= @today AND (rt.ValidToDate IS NULL OR rt.ValidToDate >= @today) ORDER BY rt.ValidFromDate DESC) AS RegisteredFee
  FROM mes.RoutingOperationSubcontract s
  JOIN mes.ProductionContractor c ON c.Id = s.ProductionContractorId
  LEFT JOIN mes.ProductionOperation cop ON cop.Id = s.ProductionOperationId
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0
  ORDER BY s.RoutingOperationId, s.Priority;
END
GO

CREATE OR ALTER PROCEDURE mes.GetRoutingSubcontractItems
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(i.RoutingOperationId AS INT) AS RoutingOperationId, i.DirectionCode, CAST(p.Id AS INT) AS ProductId, p.Number + N' — ' + p.Name AS ProductTitle,
         p.MeasureUnitTitle AS UnitTitle, i.Quantity, i.SupplyModeCode, i.Description
  FROM mes.RoutingOperationSubcontractItem i
  JOIN mes.Product p ON p.Id = i.ProductId
  WHERE i.CompanyId = @CompanyId AND i.IsDeleted = 0
  ORDER BY i.RoutingOperationId, i.DirectionCode, p.Number;
END
GO

/* روش‌های کارمزدی دریافتی: هر قلم ساختار با مالکیت و تسویه؛ قلم بدون تعیین مالکیت هم می‌آید */
CREATE OR ALTER PROCEDURE mes.GetRoutingTollMaterials
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(r.Id AS INT) AS RoutingId, r.Number + N' ' + rv.Number + N' — ' + r.Name AS RoutingTitle, r.CustomerTitle,
         CAST(p.Id AS INT) AS ProductId, p.Number + N' — ' + p.Name AS ProductTitle, p.ProductGroupTitle, x.Quantity, p.MeasureUnitTitle AS UnitTitle,
         t.OwnershipCode, t.SurplusSettlementCode, t.WasteSettlementCode, t.Description
  FROM mes.RoutingMaster r
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  JOIN mes.RoutingProductStructureAssignment a ON a.RoutingId = r.Id AND a.IsDeleted = 0
  CROSS APPLY mes.fnStructureItems(a.ProductStructureId, NULL) x
  JOIN mes.Product p ON p.Id = x.ProductId
  LEFT JOIN mes.RoutingTollMaterial t ON t.RoutingId = r.Id AND t.ProductId = x.ProductId AND t.IsDeleted = 0
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0 AND r.IsTollManufacturing = 1 AND x.Source <> 'removed'
  ORDER BY r.Number, x.Sequence;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.RoutingOperationSubcontract خالی است.
   عمداً خراب: «بسته‌بندی نوین البرز» برای روکش‌دهی نرخ دارد ولی قابلیت تأییدشده ندارد (همان خطای RM-08)؛ «صنایع روکش آریا»
   غیرفعال است؛ در روش کارمزدی مالکیت «فیلم PVC» تعیین نشده.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.RoutingOperationSubcontract)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @op BIGINT = (SELECT o.Id FROM mes.RoutingOperation o JOIN mes.RoutingMaster r ON r.Id = o.RoutingId AND r.Number = N'RT-1002' WHERE o.Sequence = 10 AND o.CompanyId = @C);
  DECLARE @coat BIGINT = (SELECT Id FROM mes.ProductionOperation WHERE Number = N'OP-40' AND CompanyId = @C);

  INSERT mes.RoutingOperationSubcontract (CompanyId, RoutingOperationId, ProductionContractorId, ProductionOperationId, Priority, SelectionRuleCode, FeePerUnit, FeeUnitTitle,
                                          CurrencyTitle, LeadTimeDays, AllowedWastePercent, MaterialSupplyCode, ServiceItemTitle, IsActive, Description)
  SELECT @C, @op, c.Id, @coat, v.Pri, v.RuleCode, v.Fee, N'هر ۱۰۰۰ قرص', N'ریال', v.Lead, v.Waste, v.Supply, v.Service, 1, v.Description
  FROM (VALUES
    (N'CT-01', 1, 1, 900000.0, 7, 1.5, 3, N'SRV-COAT-01 — خدمات روکش‌دهی قرص', N'پیمانکار اصلی؛ دی‌اکسید تیتانیوم را خودش تأمین می‌کند'),
    (N'CT-02', 2, 2, 950000.0, 9, 2.0, 1, N'SRV-COAT-01 — خدمات روکش‌دهی قرص', N'وقتی ظرفیت پیمانکار اصلی پر است'),
    (N'CT-04', 3, 3, 820000.0, 6, 2.5, 1, N'SRV-COAT-01 — خدمات روکش‌دهی قرص', N'ارزان‌ترین — قرارداد غیرفعال')
  ) v(Ct, Pri, RuleCode, Fee, Lead, Waste, Supply, Service, Description)
  JOIN mes.ProductionContractor c ON c.Number = v.Ct AND c.CompanyId = @C;

  INSERT mes.RoutingOperationSubcontractItem (CompanyId, RoutingOperationId, DirectionCode, ProductId, Quantity, SupplyModeCode, Description)
  VALUES
    (@C, @op, 1, 2002, 500000.0, 1, N'قرص روکش‌نشده — امانی نزد پیمانکار'),
    (@C, @op, 1, 2003, 32.0,     1, N'محلول روکش ساخت خودمان'),
    (@C, @op, 1, 3017, 0.4,      2, N'تأمین پیمانکار؛ در فاکتور کارمزد'),
    (@C, @op, 2, 1002, 492500.0, 1, N'قرص روکش‌دار فله؛ ۱٫۵٪ ضایعات مجاز');

  INSERT mes.RoutingTollMaterial (CompanyId, RoutingId, ProductId, OwnershipCode, SurplusSettlementCode, WasteSettlementCode, Description)
  SELECT @C, r.Id, v.ProductId, v.Own, v.Surplus, v.Waste, v.Description
  FROM (VALUES
    (2001, 1, 1, 3, N'گرانول از مشتری؛ ضایعات با صورت‌جلسه اسقاط'),
    (3008, 2, NULL, NULL, NULL),
    (3003, 2, NULL, NULL, NULL),
    (4001, 2, NULL, NULL, NULL),
    (4003, 1, 1, 3, N'کارتن چاپ‌شده با برند مشتری'),
    (4005, 1, 2, 3, N'بروشور مشتری؛ مازاد به مشتری فروخته می‌شود')
  ) v(ProductId, Own, Surplus, Waste, Description)
  JOIN mes.RoutingMaster r ON r.Number = N'RT-TOLL-01' AND r.CompanyId = @C;

  COMMIT;
END
GO
