/* =====================================================================
   اسکیمای mes — گام ۸: FRM-RM-08 «پیمانکاران تولید»

   پیش‌نیاز: mes_frm_rm01 تا mes_frm_rm07 اجرا شده باشند (فهرست عملیات از گام ۳ می‌آید).
   قاعده‌ی مدل داده همان است که در سرآغاز mes_frm_rm01_setup.sql آمده.

   تصمیم (۱۵ مهر ۱۴۰۵): پیمانکار فعلاً با جدول‌های مستقل تعریف می‌شود، نه به‌صورت خط/ایستگاه
   برون‌سپاری روی جدول‌های منابع (WorkCenter.IsOutsourced، WorkCenterPartyId، ProductionLine.IsOutsourced،
   ProductionLineInventory.IsOutsourced نسخه‌ی قبل). پس پیمانکار در درخت سازمانی و فرم‌های RM-01 تا RM-07
   نمی‌آید و تقویم و ظرفیتش همین‌جا تعریف می‌شود. ممکن است بعداً به مدل «منبع بیرونی» برگردد.

   نگاشت جدول‌های این گام (همه جدیدند؛ نسخه‌ی قبل جدول مستقل پیمانکار نداشت):
     mes.ProductionContractor           پیمانکار. PartyId = طرف حساب در سیستم اشخاص (فعلاً خالی).
                                        WorkDaysMask/FromTime/ToTime/Is24x7 = تقویم کاری پیمانکار، با همان معنای
                                        mes.ProductionCalendarRule.
     mes.ProductionContractorCapability قابلیت: چه عملیاتی (mes.ProductionOperation)، روی چه محصولی، با چه ظرفیتی؛
                                        با تأیید صلاحیت (ممیزی GMP) تا یک تاریخ.
     mes.ProductionContractorRate       نرخ کارمزد و زمان تحویل به‌ازای پیمانکار × عملیات × محصول، با اعتبار زمانی.
     mes.ProductionContractorInventory  انبار امانی نزد پیمانکار. InventoryId و ReferenceInventoryNumber مثل
                                        mes.LineSideInventory: شناسه‌ی انبار در سیستم انبار وقتی وصل شود.
     ProductTitle جانشین موقت اصل کالاست (مثل FRM-RM-06).

   فرض‌ها و کدهای موقت تا تأیید/رسیدن کدلیست اصلی:
     QualificationStatusCode  1 = تأییدشده، 2 = مشروط، 3 = تعلیق
     CapacityPeriodCode       1 = روز، 2 = هفته، 3 = ماه
     ContractorInventory.InventoryTypeCode  1 = مواد امانی (مواد ما نزد پیمانکار)، 2 = محصول و نیمه‌ساخته
     زمان‌ها = دقیقه از نیمه‌شب؛ WorkDaysMask بیت ۰ = شنبه … بیت ۶ = جمعه.
     هشدار قرارداد: کمتر از ۶۰ روز به پایان.

   فاز اول: F-RM-054، 055، 056، 057 (الزامی). لحاظ ظرفیت پیمانکار در نمای ظرفیت کل (058، مهم، فاز ۳) و
   ارزیابی عملکرد پیمانکار (059، مطلوب، فاز ۴) نیامده‌اند. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------
   بخش ۱ — جدول‌ها
   ------------------------------------------------------------------- */
IF OBJECT_ID('mes.ProductionContractor','U') IS NULL
CREATE TABLE mes.ProductionContractor (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionContractor PRIMARY KEY,
  PartyId BIGINT NULL,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  CityTitle NVARCHAR(100) NULL,
  ContactTitle NVARCHAR(256) NULL,
  ContractNumber NVARCHAR(64) NULL,
  ContractFromDate DATE NULL,
  ContractToDate DATE NULL,
  QualificationStatusCode INT NOT NULL CONSTRAINT DF_mes_ProductionContractor_Qualification DEFAULT (1)
    CONSTRAINT CK_mes_ProductionContractor_Qualification CHECK (QualificationStatusCode IN (1, 2, 3)),
  IsCustomerMaterial BIT NOT NULL CONSTRAINT DF_mes_ProductionContractor_IsCustomerMaterial DEFAULT (1),
  WorkDaysMask INT NOT NULL CONSTRAINT DF_mes_ProductionContractor_WorkDaysMask DEFAULT (63),
  FromTime INT NOT NULL CONSTRAINT DF_mes_ProductionContractor_FromTime DEFAULT (480),
  ToTime INT NOT NULL CONSTRAINT DF_mes_ProductionContractor_ToTime DEFAULT (1020),
  Is24x7 BIT NOT NULL CONSTRAINT DF_mes_ProductionContractor_Is24x7 DEFAULT (0),
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionContractor_IsActive DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionContractorCapability','U') IS NULL
CREATE TABLE mes.ProductionContractorCapability (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionContractorCapability PRIMARY KEY,
  ContractorId BIGINT NOT NULL,
  ProductionOperationId BIGINT NOT NULL,
  ProductId BIGINT NULL,
  ProductTitle NVARCHAR(256) NOT NULL,
  IsProductGroup BIT NOT NULL CONSTRAINT DF_mes_ProductionContractorCapability_IsProductGroup DEFAULT (0),
  CapacityQuantity DECIMAL(32,10) NOT NULL,
  CapacityUnitTitle NVARCHAR(64) NOT NULL,
  CapacityPeriodCode INT NOT NULL CONSTRAINT CK_mes_ProductionContractorCapability_Period CHECK (CapacityPeriodCode IN (1, 2, 3)),
  QualifiedUntilDate DATE NULL,
  ValidFromDate DATE NOT NULL,
  ValidToDate DATE NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionContractorRate','U') IS NULL
CREATE TABLE mes.ProductionContractorRate (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionContractorRate PRIMARY KEY,
  ContractorId BIGINT NOT NULL,
  ProductionOperationId BIGINT NOT NULL,
  ProductId BIGINT NULL,
  ProductTitle NVARCHAR(256) NOT NULL,
  IsProductGroup BIT NOT NULL CONSTRAINT DF_mes_ProductionContractorRate_IsProductGroup DEFAULT (0),
  FeePerUnit DECIMAL(32,10) NOT NULL,
  FeeUnitTitle NVARCHAR(64) NOT NULL,
  CurrencyTitle NVARCHAR(32) NOT NULL CONSTRAINT DF_mes_ProductionContractorRate_Currency DEFAULT (N'ریال'),
  LeadTimeDays INT NOT NULL,
  MinOrderQuantity DECIMAL(32,10) NULL,
  ValidFromDate DATE NOT NULL,
  ValidToDate DATE NULL,
  ChangeReason NVARCHAR(400) NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionContractorInventory','U') IS NULL
CREATE TABLE mes.ProductionContractorInventory (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionContractorInventory PRIMARY KEY,
  ContractorId BIGINT NOT NULL,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  InventoryId BIGINT NULL,
  ReferenceInventoryNumber NVARCHAR(100) NULL,
  InventoryTypeCode INT NOT NULL CONSTRAINT CK_mes_ProductionContractorInventory_Type CHECK (InventoryTypeCode IN (1, 2)),
  IsActive BIT NOT NULL CONSTRAINT DF_mes_ProductionContractorInventory_IsActive DEFAULT (1),
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
   بخش ۳ — رویه‌های خواندن (شناسه‌ها INT برمی‌گردند تا در JSON عدد بمانند)
   @ContractorId خالی = همه‌ی پیمانکاران شرکت.
   ------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE mes.GetContractors
  @CompanyId BIGINT, @AsOfDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @AsOfDate = ISNULL(@AsOfDate, CAST(GETDATE() AS DATE));
  SELECT CAST(c.Id AS INT) AS ContractorId, c.Number AS Code, c.Name AS Title, c.CityTitle, c.ContactTitle,
         c.ContractNumber, c.ContractFromDate, c.ContractToDate,
         CASE WHEN c.ContractToDate IS NULL THEN NULL ELSE DATEDIFF(DAY, @AsOfDate, c.ContractToDate) END AS ContractDaysLeft,
         c.QualificationStatusCode, c.IsCustomerMaterial, c.WorkDaysMask, c.FromTime, c.ToTime, c.Is24x7, c.IsActive, c.Description,
         (SELECT COUNT(*) FROM mes.ProductionContractorCapability x WHERE x.ContractorId = c.Id AND x.IsDeleted = 0
            AND (x.ValidToDate IS NULL OR x.ValidToDate >= @AsOfDate)) AS CapabilityCount,
         (SELECT COUNT(*) FROM mes.ProductionContractorCapability x WHERE x.ContractorId = c.Id AND x.IsDeleted = 0
            AND (x.ValidToDate IS NULL OR x.ValidToDate >= @AsOfDate) AND x.QualifiedUntilDate < @AsOfDate) AS ExpiredQualificationCount,
         (SELECT COUNT(*) FROM mes.ProductionContractorInventory x WHERE x.ContractorId = c.Id AND x.IsDeleted = 0 AND x.IsActive = 1) AS InventoryCount
  FROM mes.ProductionContractor c
  WHERE c.CompanyId = @CompanyId AND c.IsDeleted = 0
  ORDER BY c.IsActive DESC, c.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetContractorCapabilities
  @CompanyId BIGINT, @ContractorId BIGINT = NULL, @AsOfDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @AsOfDate = ISNULL(@AsOfDate, CAST(GETDATE() AS DATE));
  SELECT CAST(x.Id AS INT) AS CapabilityId, CAST(c.Id AS INT) AS ContractorId, c.Name AS ContractorTitle,
         o.Number AS OperationCode, o.Name AS OperationTitle,
         x.ProductTitle, x.IsProductGroup,
         CAST(x.CapacityQuantity AS DECIMAL(18,2)) AS CapacityQuantity, x.CapacityUnitTitle, x.CapacityPeriodCode,
         x.QualifiedUntilDate,
         CASE WHEN x.QualifiedUntilDate IS NULL THEN NULL ELSE DATEDIFF(DAY, @AsOfDate, x.QualifiedUntilDate) END AS QualificationDaysLeft,
         x.ValidFromDate, x.ValidToDate,
         CASE WHEN x.ValidFromDate > @AsOfDate THEN 'future' ELSE 'current' END AS VersionStatus,
         x.Description
  FROM mes.ProductionContractorCapability x
  JOIN mes.ProductionContractor c ON c.Id = x.ContractorId AND c.IsDeleted = 0
  JOIN mes.ProductionOperation o ON o.Id = x.ProductionOperationId
  WHERE c.CompanyId = @CompanyId AND x.IsDeleted = 0 AND (@ContractorId IS NULL OR c.Id = @ContractorId)
    AND (x.ValidToDate IS NULL OR x.ValidToDate >= @AsOfDate)
  ORDER BY c.Number, o.Number, x.ProductTitle;
END
GO

CREATE OR ALTER PROCEDURE mes.GetContractorRates
  @CompanyId BIGINT, @ContractorId BIGINT = NULL, @AsOfDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @AsOfDate = ISNULL(@AsOfDate, CAST(GETDATE() AS DATE));
  /* همه‌ی نسخه‌ها (گذشته، جاری، آینده) با نرخ نسخه‌ی قبلِ همان «پیمانکار × عملیات × محصول»؛
     HasCapability = برای همین عملیات و محصول قابلیتِ معتبر ثبت شده است. */
  SELECT CAST(r.Id AS INT) AS RateId, CAST(c.Id AS INT) AS ContractorId, c.Name AS ContractorTitle,
         o.Number AS OperationCode, o.Name AS OperationTitle, r.ProductTitle, r.IsProductGroup,
         CAST(r.FeePerUnit AS DECIMAL(18,2)) AS FeePerUnit, r.FeeUnitTitle, r.CurrencyTitle, r.LeadTimeDays,
         CAST(r.MinOrderQuantity AS DECIMAL(18,2)) AS MinOrderQuantity,
         r.ValidFromDate, r.ValidToDate,
         CASE WHEN r.ValidFromDate > @AsOfDate THEN 'future'
              WHEN r.ValidToDate < @AsOfDate THEN 'past' ELSE 'current' END AS VersionStatus,
         CAST(LAG(r.FeePerUnit) OVER (PARTITION BY r.ContractorId, r.ProductionOperationId, r.ProductTitle ORDER BY r.ValidFromDate) AS DECIMAL(18,2)) AS PreviousFee,
         r.ChangeReason,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.ProductionContractorCapability x
                                WHERE x.ContractorId = r.ContractorId AND x.ProductionOperationId = r.ProductionOperationId
                                  AND x.ProductTitle = r.ProductTitle AND x.IsDeleted = 0
                                  AND (x.ValidToDate IS NULL OR x.ValidToDate >= @AsOfDate)) THEN 1 ELSE 0 END AS BIT) AS HasCapability
  FROM mes.ProductionContractorRate r
  JOIN mes.ProductionContractor c ON c.Id = r.ContractorId AND c.IsDeleted = 0
  JOIN mes.ProductionOperation o ON o.Id = r.ProductionOperationId
  WHERE c.CompanyId = @CompanyId AND r.IsDeleted = 0 AND (@ContractorId IS NULL OR c.Id = @ContractorId)
  ORDER BY c.Number, o.Number, r.ProductTitle, r.ValidFromDate DESC;
END
GO

CREATE OR ALTER PROCEDURE mes.GetContractorInventories
  @CompanyId BIGINT, @ContractorId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(i.Id AS INT) AS InventoryRowId, CAST(c.Id AS INT) AS ContractorId, c.Name AS ContractorTitle,
         i.Number AS Code, i.Name AS Title, CAST(i.InventoryId AS INT) AS InventoryId, i.ReferenceInventoryNumber,
         i.InventoryTypeCode, i.IsActive, i.Description
  FROM mes.ProductionContractorInventory i
  JOIN mes.ProductionContractor c ON c.Id = i.ContractorId AND c.IsDeleted = 0
  WHERE c.CompanyId = @CompanyId AND i.IsDeleted = 0 AND (@ContractorId IS NULL OR c.Id = @ContractorId)
  ORDER BY c.Number, i.InventoryTypeCode, i.Number;
END
GO

/* -------------------------------------------------------------------
   بخش ۴ — داده‌ی نمونه (شرکت ۲۲۲). فقط وقتی جدول پیمانکار خالی است.
   عمداً خراب: قرارداد «بسته‌بندی نوین البرز» کمتر از ۶۰ روز مانده و تأیید صلاحیت GMP آن گذشته؛
   همین پیمانکار برای «روکش‌دهی» نرخ دارد ولی قابلیت ندارد؛ «گرانول‌سازی تهران» تعلیق است و انبار امانی ندارد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductionContractor)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  INSERT mes.ProductionContractor (CompanyId, Number, Name, CityTitle, ContactTitle, ContractNumber, ContractFromDate, ContractToDate,
                                   QualificationStatusCode, IsCustomerMaterial, WorkDaysMask, FromTime, ToTime, Is24x7, IsActive, Description) VALUES
    (@C, N'CT-01', N'داروسازی پارس‌دارو',     N'قزوین',  N'مهندس رضایی — مدیر تولید',   N'QR-1405-012', '2026-03-21', '2027-03-20', 1, 1, 63,  420, 1380, 0, 1, N'کارمزدی قرص؛ دو شیفت'),
    (@C, N'CT-02', N'بسته‌بندی نوین البرز',  N'کرج',    N'خانم احمدی — برنامه‌ریزی',   N'QR-1404-077', '2025-11-22', '2026-11-15', 2, 1, 31,  480, 1020, 0, 1, N'بسته‌بندی بلیستر و کارتن'),
    (@C, N'CT-03', N'گرانول‌سازی تهران',     N'تهران',  N'مهندس کاظمی',                N'QR-1404-031', '2025-06-22', '2027-06-21', 3, 1, 63,  480, 1020, 0, 1, N'تعلیق تا رفع عدم انطباق ممیزی شهریور'),
    (@C, N'CT-04', N'صنایع روکش آریا',       N'اصفهان', NULL,                           NULL,           NULL,          NULL,        1, 0, 127, 0,    0,    1, 0, N'غیرفعال — همکاری متوقف شده');

  INSERT mes.ProductionContractorCapability (CompanyId, ContractorId, ProductionOperationId, ProductTitle, IsProductGroup,
                                             CapacityQuantity, CapacityUnitTitle, CapacityPeriodCode, QualifiedUntilDate, ValidFromDate, ValidToDate, Description)
  SELECT @C, c.Id, o.Id, v.Product, v.IsGroup, v.Qty, v.Unit, v.Period, v.QualifiedUntil, v.ValidFrom, NULL, v.Description
  FROM (VALUES
    (N'CT-01', N'OP-30', N'قرص سفید ساده',         0, 2000000, N'قرص',    3, CAST('2027-01-20' AS DATE), CAST('2026-03-21' AS DATE), NULL),
    (N'CT-01', N'OP-30', N'قرص‌های جوشان',         1, 800000,  N'قرص',    3, '2027-01-20', '2026-03-21', N'گروه محصول'),
    (N'CT-01', N'OP-40', N'قرص روکش‌دار',          0, 1500000, N'قرص',    3, '2027-01-20', '2026-03-21', NULL),
    (N'CT-02', N'OP-50', N'بلیستر ۱۰تایی',          0, 300000,  N'بلیستر', 2, '2026-09-30', '2025-11-22', N'ممیزی GMP تمدید نشده'),
    (N'CT-02', N'OP-50', N'بلیستر ۲۰تایی',          0, 150000,  N'بلیستر', 2, '2026-09-30', '2025-11-22', NULL),
    (N'CT-03', N'OP-20', N'گرانول قرص سفید',       0, 40,      N'تن',     3, '2026-12-21', '2025-06-22', NULL)
  ) v(ContractorNo, OperationNo, Product, IsGroup, Qty, Unit, Period, QualifiedUntil, ValidFrom, Description)
  JOIN mes.ProductionContractor c ON c.Number = v.ContractorNo
  JOIN mes.ProductionOperation o ON o.Number = v.OperationNo;

  INSERT mes.ProductionContractorRate (CompanyId, ContractorId, ProductionOperationId, ProductTitle, IsProductGroup,
                                       FeePerUnit, FeeUnitTitle, LeadTimeDays, MinOrderQuantity, ValidFromDate, ValidToDate, ChangeReason)
  SELECT @C, c.Id, o.Id, v.Product, v.IsGroup, v.Fee, v.FeeUnit, v.LeadTime, v.MinQty, v.ValidFrom, v.ValidTo, v.Reason
  FROM (VALUES
    (N'CT-01', N'OP-30', N'قرص سفید ساده',   0, 1250000, N'هر ۱۰۰۰ قرص',   10, 200000, CAST('2026-03-21' AS DATE), CAST('2026-06-21' AS DATE), N'قرارداد ۱۴۰۵'),
    (N'CT-01', N'OP-30', N'قرص سفید ساده',   0, 1400000, N'هر ۱۰۰۰ قرص',   10, 200000, '2026-06-22', NULL, N'تعدیل نرخ تابستان (+۱۲٪)'),
    (N'CT-01', N'OP-30', N'قرص‌های جوشان',   1, 1900000, N'هر ۱۰۰۰ قرص',   14, 100000, '2026-03-21', NULL, N'قرارداد ۱۴۰۵'),
    (N'CT-01', N'OP-40', N'قرص روکش‌دار',    0, 900000,  N'هر ۱۰۰۰ قرص',   7,  200000, '2026-03-21', NULL, N'قرارداد ۱۴۰۵'),
    (N'CT-02', N'OP-50', N'بلیستر ۱۰تایی',    0, 3200000, N'هر ۱۰۰۰ بلیستر', 5,  50000,  '2025-11-22', NULL, N'قرارداد ۱۴۰۴'),
    (N'CT-02', N'OP-50', N'بلیستر ۲۰تایی',    0, 4100000, N'هر ۱۰۰۰ بلیستر', 5,  30000,  '2025-11-22', NULL, N'قرارداد ۱۴۰۴'),
    (N'CT-02', N'OP-40', N'قرص روکش‌دار',    0, 950000,  N'هر ۱۰۰۰ قرص',   9,  100000, '2026-07-01', NULL, N'پیشنهاد قیمت — قابلیت هنوز تأیید نشده'),
    (N'CT-03', N'OP-20', N'گرانول قرص سفید', 0, 85000000, N'هر تن',        12, 5,      '2025-06-22', NULL, N'قرارداد ۱۴۰۴')
  ) v(ContractorNo, OperationNo, Product, IsGroup, Fee, FeeUnit, LeadTime, MinQty, ValidFrom, ValidTo, Reason)
  JOIN mes.ProductionContractor c ON c.Number = v.ContractorNo
  JOIN mes.ProductionOperation o ON o.Number = v.OperationNo;

  INSERT mes.ProductionContractorInventory (CompanyId, ContractorId, Number, Name, ReferenceInventoryNumber, InventoryTypeCode, IsActive, Description)
  SELECT @C, c.Id, v.Number, v.Name, v.RefNo, v.TypeCode, 1, v.Description
  FROM (VALUES
    (N'CT-01', N'WH-CS-01', N'انبار امانی مواد اولیه نزد پارس‌دارو',  N'INV-CS-01 (امانی نزد غیر)', 1, NULL),
    (N'CT-01', N'WH-CS-02', N'انبار قرص نیمه‌ساخته نزد پارس‌دارو',    N'INV-CS-02 (امانی نزد غیر)', 2, N'قرص روکش‌نشده تا ارسال برای روکش'),
    (N'CT-02', N'WH-CS-03', N'انبار امانی مواد بسته‌بندی نزد نوین',   N'INV-CS-03 (امانی نزد غیر)', 1, N'فویل، PVC، کارتن و بروشور')
  ) v(ContractorNo, Number, Name, RefNo, TypeCode, Description)
  JOIN mes.ProductionContractor c ON c.Number = v.ContractorNo;

  COMMIT;
END
GO
