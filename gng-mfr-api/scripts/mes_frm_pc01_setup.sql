/* =====================================================================
   اسکیمای mes — گام ۲۹: FRM-PC-01 «درخواست تولید»

   پیش‌نیاز: گام‌های قبل تا mes_frm_pe07 (نسخه‌ی تولید ME-08 برای امکان‌سنجی).
   یادداشت ALM: «ثبت و تأیید در یک فرم با دو مجوز».

   نسخه‌ی قبل درخواست تولید جدا نداشت (دستور کار مستقیم صادر می‌شد؛ ReferenceObjectNumber روی WorkOrder) و موجودی در
   سیستم انبار بود. جدول‌ها جدیدند:
     mes.ProductionRequest              درخواست با منشأ (F-PC-001)، شماره‌ی اعلام نیاز عمومی (002)، اولویت و تاریخ نیاز
     mes.ProductionRequestApprovalRule  قاعده‌ی گردش تأیید بر مبنای منشأ، مقدار، گروه کالا و واحد درخواست‌کننده (003)
     mes.ProductionRequestApproval      مراحل تأیید هر درخواست (003)
     mes.ProductionRequestWorkOrder     تجمیع چند درخواست در یک دستور و تفکیک یک درخواست به چند دستور (004)؛ دستورها در گام PC-02
     mes.MaterialStock                  جانشین موقت موجودی انبار (مثل mes.Product برای کاتالوگ): مانده به تفکیک انبار و بچ، با عیار،
                                        خلوص، چرخه‌ی بازیافت، مالکیت مشتری و موجودی در راه. با وصل شدن سیستم انبار حذف می‌شود.
   امکان‌سنجی اولیه (ATP/CTP، 006) با mes.CheckRequestFeasibility: نیاز مواد از ساختار نسخه‌ی تولید فعال، در برابر موجودی آزاد
   و در راه، و تاریخ تحقق پیشنهادی.

   فرض‌ها و کدهای موقت:
     OriginCode         1 = فروش، 2 = انبار (نقطه‌ی سفارش)، 3 = برنامه‌ریزی مواد، 4 = داخلی، 5 = مشتری کارمزدی
     PriorityCode       1 = عادی، 2 = بالا، 3 = فوری
     StatusCode         1 = پیش‌نویس، 2 = در انتظار تأیید، 3 = تأییدشده، 4 = در تولید، 5 = تکمیل‌شده، 6 = ردشده
     DecisionCode       خالی = منتظر، 1 = تأیید، 2 = رد
     InventoryKindCode  1 = انبار مرکزی، 2 = انبار پای کار، 3 = قرنطینه، 4 = امانی مشتری، 5 = نزد پیمانکار، 6 = در راه
     QcStatusCode       1 = آزاد، 2 = قرنطینه، 3 = مردود

   فاز اول: فقط‌خواندنی؛ امکان‌سنجی اقدام فقط‌خواندنی است و زنده اجرا می‌شود. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.ProductionRequest','U') IS NULL
CREATE TABLE mes.ProductionRequest (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionRequest PRIMARY KEY,
  Number NVARCHAR(64) NOT NULL,
  RequestDate DATE NOT NULL,
  OriginCode INT NOT NULL CONSTRAINT CK_mes_PR_Origin CHECK (OriginCode IN (1, 2, 3, 4, 5)),
  PriorityCode INT NOT NULL CONSTRAINT DF_mes_PR_Priority DEFAULT (1),
  ProductId BIGINT NOT NULL,
  Quantity DECIMAL(32,6) NOT NULL,
  NeedDate DATE NULL,
  RequesterUnitTitle NVARCHAR(256) NULL,
  RequesterTitle NVARCHAR(256) NULL,
  GeneralRequisitionNumber NVARCHAR(64) NULL,
  SalesOrderNumber NVARCHAR(64) NULL,
  CustomerTitle NVARCHAR(256) NULL,
  StatusCode INT NOT NULL CONSTRAINT DF_mes_PR_Status DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionRequestApprovalRule','U') IS NULL
CREATE TABLE mes.ProductionRequestApprovalRule (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionRequestApprovalRule PRIMARY KEY,
  Sequence INT NOT NULL,
  OriginCode INT NULL,
  MinQuantity DECIMAL(32,6) NULL,
  ProductGroupTitle NVARCHAR(256) NULL,
  RequesterUnitTitle NVARCHAR(256) NULL,
  ApproverRoleTitle NVARCHAR(256) NOT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionRequestApproval','U') IS NULL
CREATE TABLE mes.ProductionRequestApproval (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionRequestApproval PRIMARY KEY,
  ProductionRequestId BIGINT NOT NULL,
  Sequence INT NOT NULL,
  ApproverRoleTitle NVARCHAR(256) NOT NULL,
  ApproverTitle NVARCHAR(256) NULL,
  DecisionCode INT NULL,
  DecisionDate DATETIME NULL,
  Comment NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.ProductionRequestWorkOrder','U') IS NULL
CREATE TABLE mes.ProductionRequestWorkOrder (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_ProductionRequestWorkOrder PRIMARY KEY,
  ProductionRequestId BIGINT NOT NULL,
  WorkOrderId BIGINT NOT NULL,
  Quantity DECIMAL(32,6) NOT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.MaterialStock','U') IS NULL
CREATE TABLE mes.MaterialStock (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_MaterialStock PRIMARY KEY,
  ProductId BIGINT NOT NULL,
  InventoryKindCode INT NOT NULL,
  InventoryTitle NVARCHAR(256) NOT NULL,
  LineSideInventoryId BIGINT NULL,
  BatchNumber NVARCHAR(64) NULL,
  ManufactureDate DATE NULL,
  ExpireDate DATE NULL,
  PotencyPercent DECIMAL(9,4) NULL,
  PurityPercent DECIMAL(9,4) NULL,
  RecoveryCycle INT NULL,
  OnHandQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_MS_OnHand DEFAULT (0),
  ReservedQuantity DECIMAL(32,6) NOT NULL CONSTRAINT DF_mes_MS_Reserved DEFAULT (0),
  ExpectedArrivalDate DATE NULL,
  QcStatusCode INT NOT NULL CONSTRAINT DF_mes_MS_Qc DEFAULT (1),
  IsCustomerOwned BIT NOT NULL CONSTRAINT DF_mes_MS_Customer DEFAULT (0),
  OwnerTitle NVARCHAR(256) NULL,
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

CREATE OR ALTER PROCEDURE mes.GetProductionRequests
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(r.Id AS INT) AS RequestId, r.Number, r.RequestDate, r.OriginCode, r.PriorityCode, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode,
         p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, p.ProductGroupTitle, r.Quantity, r.NeedDate, r.RequesterUnitTitle, r.RequesterTitle,
         r.GeneralRequisitionNumber, r.SalesOrderNumber, r.CustomerTitle, r.StatusCode, r.Description,
         /* پیشرفت از دستورهای متصل (جدول دستور کار در گام PC-02؛ تا آن گام صفر) */
         ISNULL((SELECT SUM(l.Quantity) FROM mes.ProductionRequestWorkOrder l WHERE l.ProductionRequestId = r.Id AND l.IsDeleted = 0), 0) AS OrderedQuantity
  FROM mes.ProductionRequest r
  JOIN mes.Product p ON p.Id = r.ProductId
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
  ORDER BY r.RequestDate DESC, r.Number DESC;
END
GO

CREATE OR ALTER PROCEDURE mes.GetProductionRequestApprovals
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(a.ProductionRequestId AS INT) AS RequestId, a.Sequence, a.ApproverRoleTitle, a.ApproverTitle, a.DecisionCode, a.DecisionDate, a.Comment
  FROM mes.ProductionRequestApproval a
  WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0
  ORDER BY a.ProductionRequestId, a.Sequence;

  SELECT r.Sequence, r.OriginCode, r.MinQuantity, r.ProductGroupTitle, r.RequesterUnitTitle, r.ApproverRoleTitle, r.Description
  FROM mes.ProductionRequestApprovalRule r
  WHERE r.CompanyId = @CompanyId AND r.IsDeleted = 0
  ORDER BY r.Sequence;
END
GO

/* امکان‌سنجی اولیه (ATP/CTP) یک درخواست: نسخه‌ی تولید فعالِ مناسب، نیاز هر ماده‌ی ساختار در برابر موجودی آزاد و در راه،
   و تاریخ تحقق پیشنهادی = بیشینه‌ی (امروز + زمان مبنای نسخه، رسیدن آخرین کسری در راه + زمان مبنا). */
CREATE OR ALTER PROCEDURE mes.CheckRequestFeasibility
  @RequestId BIGINT,
  @AsOf DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @AsOf = ISNULL(@AsOf, CAST(mes.fnShopNow() AS DATE));
  DECLARE @product BIGINT, @qty DECIMAL(32,6), @need DATE, @company BIGINT;
  SELECT @product = ProductId, @qty = Quantity, @need = NeedDate, @company = CompanyId FROM mes.ProductionRequest WHERE Id = @RequestId;

  DECLARE @version BIGINT, @structure BIGINT, @lead DECIMAL(18,2), @base DECIMAL(32,6);
  SELECT TOP (1) @version = v.Id, @structure = v.ProductStructureId, @lead = ISNULL(v.BaseLeadTimeHours, 24)
  FROM mes.ManufacturingVersion v
  WHERE v.CompanyId = @company AND v.ProductId = @product AND v.StatusCode = 3 AND v.IsDeleted = 0 AND v.AllowsStandardOrder = 1
  ORDER BY CASE WHEN @qty BETWEEN ISNULL(v.MinBatchSize, 0) AND ISNULL(v.MaxBatchSize, 1e18) THEN 0 ELSE 1 END, v.Priority;
  SELECT @base = m.Quantity FROM mes.ProductStructureMaster m WHERE m.ProductStructureId = @structure AND m.IsMainProduct = 1 AND m.IsDeleted = 0;

  /* مجموعه‌ی ۱: خلاصه */
  SELECT CAST(@version AS INT) AS VersionId, v.Number AS VersionCode, v.Name AS VersionTitle, s.Number AS StructureCode, @lead AS LeadTimeHours,
         CAST(CASE WHEN @base > 0 THEN CEILING(@qty / ISNULL(v.MaxBatchSize, @qty)) ELSE NULL END AS INT) AS BatchCount, @need AS NeedDate, @AsOf AS AsOf
  FROM (SELECT 1 x) d
  LEFT JOIN mes.ManufacturingVersion v ON v.Id = @version
  LEFT JOIN mes.ProductStructure s ON s.Id = @structure;

  /* مجموعه‌ی ۲: مواد */
  SELECT x.Sequence, CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         CAST(CASE WHEN x.QuantityTypeCode = 4 THEN @qty * x.Quantity / 100 ELSE x.Quantity * @qty / NULLIF(@base, 0) END AS DECIMAL(32,4)) AS Required,
         ISNULL(st.Available, 0) AS Available, ISNULL(st.InTransit, 0) AS InTransit, st.LastArrival,
         /* در راهی که تا تاریخ امکان‌سنجی می‌رسد */
         ISNULL(st.ArrivedByAsOf, 0) AS ArrivedByAsOf, ISNULL(st.Available, 0) + ISNULL(st.ArrivedByAsOf, 0) AS AvailableAsOf
  FROM mes.fnStructureItems(@structure, NULL) x
  JOIN mes.Product p ON p.Id = x.ProductId
  OUTER APPLY (SELECT SUM(CASE WHEN s2.InventoryKindCode IN (1, 2) AND s2.QcStatusCode = 1 AND s2.IsCustomerOwned = 0 THEN s2.OnHandQuantity - s2.ReservedQuantity ELSE 0 END) AS Available,
                      SUM(CASE WHEN s2.InventoryKindCode = 6 THEN s2.OnHandQuantity ELSE 0 END) AS InTransit,
                      MAX(CASE WHEN s2.InventoryKindCode = 6 THEN s2.ExpectedArrivalDate END) AS LastArrival,
                      SUM(CASE WHEN s2.InventoryKindCode = 6 AND s2.ExpectedArrivalDate <= @AsOf THEN s2.OnHandQuantity ELSE 0 END) AS ArrivedByAsOf
               FROM mes.MaterialStock s2 WHERE s2.ProductId = x.ProductId AND s2.IsDeleted = 0) st
  WHERE @structure IS NOT NULL AND x.Source <> 'removed' AND ISNULL(x.Quantity, 0) > 0
  ORDER BY x.Sequence;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.ProductionRequest خالی است. روز مرجع سناریو: ۱۷ مهر ۱۴۰۵ (2026-10-09).
   عمداً خراب: PR-1405-0316 برای «قرص رنگی اطفال» است که نسخه‌ی تولید و ساختار ندارد؛ PR-1405-0315 بیش از دو روز
   منتظر تأیید مانده؛ موجودی پوویدون K30 برای درخواست گرانول کافی نیست و محموله‌ی در راه پس از تاریخ نیاز می‌رسد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.ProductionRequest)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;
  DECLARE @D DATE = '2026-10-09';

  INSERT mes.ProductionRequestApprovalRule (CompanyId, Sequence, OriginCode, MinQuantity, ProductGroupTitle, RequesterUnitTitle, ApproverRoleTitle, Description)
  VALUES (@C, 1, NULL, NULL, NULL, NULL, N'سرپرست برنامه‌ریزی تولید', N'همه‌ی درخواست‌ها'),
         (@C, 2, 1, 500000, N'محصولات جامد خوراکی', NULL, N'مدیر فروش', N'درخواست فروش بالای ۵۰۰ هزار عدد'),
         (@C, 3, 5, NULL, NULL, NULL, N'مدیر بازرگانی', N'هر درخواست کارمزدی'),
         (@C, 4, 4, NULL, NULL, N'تحقیق و توسعه', N'مدیر فنی', N'درخواست داخلی R&D');

  INSERT mes.ProductionRequest (CompanyId, Number, RequestDate, OriginCode, PriorityCode, ProductId, Quantity, NeedDate, RequesterUnitTitle, RequesterTitle,
                                GeneralRequisitionNumber, SalesOrderNumber, CustomerTitle, StatusCode, Description)
  VALUES
    (@C, N'PR-1405-0309', DATEADD(DAY, -12, @D), 1, 1, 1001, 300000, DATEADD(DAY, -2, @D), N'فروش', N'کیوان مرادی', NULL, N'SO-1405-1120', N'پخش البرز', 5, N'تحویل شد'),
    (@C, N'PR-1405-0310', DATEADD(DAY, -4, @D), 1, 3, 1001, 900000, DATEADD(DAY, 6, @D), N'فروش', N'کیوان مرادی', N'IR-1405-2231', N'SO-1405-1188', N'پخش البرز', 4, N'سفارش فوری مناقصه‌ی بیمارستانی'),
    (@C, N'PR-1405-0311', DATEADD(DAY, -6, @D), 2, 1, 1002, 500000, DATEADD(DAY, 9, @D), N'انبار محصول', N'سیستم نقطه‌ی سفارش', NULL, NULL, NULL, 4, N'موجودی به نقطه‌ی سفارش رسید'),
    (@C, N'PR-1405-0312', DATEADD(DAY, -3, @D), 3, 2, 2001, 70, DATEADD(DAY, 1, @D), N'برنامه‌ریزی مواد', N'اجرای MRP شماره‌ی ۴۱', NULL, NULL, NULL, 4, NULL),
    (@C, N'PR-1405-0313', DATEADD(DAY, -2, @D), 4, 1, 2001, 80, DATEADD(DAY, 2, @D), N'تولید', N'سرپرست سالن جامدات', N'IR-1405-2240', NULL, NULL, 4, N'ذخیره‌ی گرانول برای بچ بعدی'),
    (@C, N'PR-1405-0314', DATEADD(DAY, -5, @D), 5, 2, 1001, 250000, DATEADD(DAY, 3, @D), N'بازرگانی', N'نسرین فلاحی', NULL, N'TC-1405-017', N'داروسازی فارمد', 4, N'کارمزدی با گرانول امانی مشتری'),
    (@C, N'PR-1405-0315', DATEADD(DAY, -3, @D), 4, 1, 1005, 2000, DATEADD(DAY, 20, @D), N'تحقیق و توسعه', N'دکتر صالحی', N'IR-1405-2236', NULL, NULL, 2, N'بچ آزمایشی پایداری'),
    (@C, N'PR-1405-0316', DATEADD(DAY, -1, @D), 1, 1, 1004, 200000, DATEADD(DAY, 25, @D), N'فروش', N'کیوان مرادی', NULL, N'SO-1405-1201', N'داروخانه‌های زنجیره‌ای', 1, N'محصول هنوز ساختار ندارد'),
    (@C, N'PR-1405-0317', @D, 2, 1, 2001, 150, DATEADD(DAY, 4, @D), N'انبار مواد', N'سیستم نقطه‌ی سفارش', NULL, NULL, NULL, 3, N'تأییدشده؛ هنوز دستور ندارد');

  /* گردش تأیید هر درخواست طبق قاعده‌ها */
  INSERT mes.ProductionRequestApproval (CompanyId, ProductionRequestId, Sequence, ApproverRoleTitle, ApproverTitle, DecisionCode, DecisionDate, Comment)
  SELECT @C, r.Id, v.Seq, v.Role, v.Approver, v.Decision, v.DecisionAt, v.Comment
  FROM (VALUES
    (N'PR-1405-0309', 1, N'سرپرست برنامه‌ریزی تولید', N'امید رستمی', 1, CAST('2026-09-27 10:05' AS DATETIME), NULL),
    (N'PR-1405-0310', 1, N'سرپرست برنامه‌ریزی تولید', N'امید رستمی', 1, '2026-10-05 09:12', N'به دو دستور تفکیک شود'),
    (N'PR-1405-0310', 2, N'مدیر فروش', N'شهرام کیانی', 1, '2026-10-05 11:40', N'اولویت فوری'),
    (N'PR-1405-0311', 1, N'سرپرست برنامه‌ریزی تولید', N'امید رستمی', 1, '2026-10-03 08:30', NULL),
    (N'PR-1405-0312', 1, N'سرپرست برنامه‌ریزی تولید', N'امید رستمی', 1, '2026-10-06 08:45', N'با PR-0313 در یک دستور تجمیع شود'),
    (N'PR-1405-0313', 1, N'سرپرست برنامه‌ریزی تولید', N'امید رستمی', 1, '2026-10-07 09:00', NULL),
    (N'PR-1405-0314', 1, N'سرپرست برنامه‌ریزی تولید', N'امید رستمی', 1, '2026-10-04 13:10', NULL),
    (N'PR-1405-0314', 2, N'مدیر بازرگانی', N'نسرین فلاحی', 1, '2026-10-04 15:30', N'قرارداد TC-1405-017'),
    (N'PR-1405-0315', 1, N'سرپرست برنامه‌ریزی تولید', N'امید رستمی', 1, '2026-10-06 10:00', NULL),
    (N'PR-1405-0315', 2, N'مدیر فنی', N'دکتر نوروزی', NULL, NULL, NULL),
    (N'PR-1405-0317', 1, N'سرپرست برنامه‌ریزی تولید', N'امید رستمی', 1, '2026-10-09 08:20', NULL)
  ) v(Rno, Seq, Role, Approver, Decision, DecisionAt, Comment)
  JOIN mes.ProductionRequest r ON r.Number = v.Rno AND r.CompanyId = @C;

  /* موجودی (جانشین موقت انبار): مواد اولیه با بچ، عیار و انقضا؛ در راه؛ امانی مشتری؛ قرنطینه */
  INSERT mes.MaterialStock (CompanyId, ProductId, InventoryKindCode, InventoryTitle, LineSideInventoryId, BatchNumber, ManufactureDate, ExpireDate, PotencyPercent,
                            PurityPercent, RecoveryCycle, OnHandQuantity, ReservedQuantity, ExpectedArrivalDate, QcStatusCode, IsCustomerOwned, OwnerTitle, Description)
  SELECT @C, v.ProductId, v.Kind, v.Inv, ls.Id, v.Batch, v.Mfg, v.Exp, v.Potency, v.Purity, v.Cycle, v.OnHand, v.Reserved, v.Arrival, v.Qc, v.Cust, v.Owner, v.Description
  FROM (VALUES
    (3001, 1, N'انبار مواد اولیه', NULL, N'PCM-2406', CAST('2026-03-10' AS DATE), CAST('2028-03-09' AS DATE), 99.6, NULL, NULL, 180.0, 83.3, NULL, 1, 0, NULL, NULL),
    (3001, 1, N'انبار مواد اولیه', NULL, N'PCM-2411', '2026-06-02', '2027-01-15', 98.9, NULL, NULL, 260.0, 0.0, NULL, 1, 0, NULL, N'زودتر منقضی می‌شود — FEFO'),
    (3001, 3, N'قرنطینه‌ی مواد', NULL, N'PCM-2419', '2026-09-20', '2028-09-19', NULL, NULL, NULL, 300.0, 0.0, NULL, 2, 0, NULL, N'منتظر آزمون QC'),
    (3002, 1, N'انبار مواد اولیه', NULL, N'LAC-1187', '2026-05-11', '2028-05-10', NULL, NULL, NULL, 95.0, 8.7, NULL, 1, 0, NULL, NULL),
    (3005, 1, N'انبار مواد اولیه', NULL, N'STA-0931', '2026-04-04', '2028-04-03', NULL, NULL, NULL, 60.0, 5.0, NULL, 1, 0, NULL, NULL),
    (3006, 1, N'انبار مواد اولیه', NULL, N'PVK-0712', '2026-02-18', '2027-02-17', NULL, NULL, NULL, 4.2, 3.0, NULL, 1, 0, NULL, N'آخرین بچ K30 — قطع واردات'),
    (3006, 6, N'در راه — محموله‌ی وارداتی', NULL, N'PVK-0740', NULL, NULL, NULL, NULL, NULL, 50.0, 0.0, '2026-10-16', 1, 0, NULL, N'ترخیص گمرک'),
    (3008, 1, N'انبار مواد اولیه', NULL, N'CCS-0455', '2026-01-20', '2028-01-19', NULL, NULL, NULL, 40.0, 6.0, NULL, 1, 0, NULL, NULL),
    (3003, 1, N'انبار مواد اولیه', NULL, N'MGS-0381', '2025-12-01', '2027-11-30', NULL, NULL, NULL, 25.0, 3.0, NULL, 1, 0, NULL, NULL),
    (3004, 1, N'انبار مواد اولیه', NULL, N'HPM-0207', '2026-03-03', '2028-03-02', NULL, NULL, NULL, 80.0, 0.0, NULL, 1, 0, NULL, NULL),
    (3009, 1, N'مخزن اتانول', NULL, N'ETH-1405-09', '2026-09-01', '2028-08-31', NULL, 96.1, 0, 1200.0, 36.0, NULL, 1, 0, NULL, NULL),
    (3015, 1, N'مخزن حلال بازیابی‌شده', NULL, N'RET-1405-021', '2026-10-02', '2027-04-01', NULL, 94.8, 1, 210.0, 0.0, NULL, 1, 0, NULL, N'یک بار بازیافت'),
    (3015, 1, N'مخزن حلال بازیابی‌شده', NULL, N'RET-1405-014', '2026-09-12', '2027-03-11', NULL, 93.2, 3, 60.0, 0.0, NULL, 1, 0, NULL, N'خلوص زیر حد ۹۴٪؛ چرخه‌ی سوم'),
    (2001, 1, N'انبار نیمه‌ساخته', NULL, N'GRN-1405-118', '2026-10-06', '2026-11-05', 99.8, NULL, NULL, 240.0, 0.0, NULL, 1, 0, NULL, N'گرانول پیوسته‌ی هفته‌ی قبل'),
    (2001, 4, N'امانی مشتری — فارمد', NULL, N'FRM-G-0092', '2026-10-01', '2026-12-30', 99.5, NULL, NULL, 150.0, 146.25, NULL, 1, 1, N'داروسازی فارمد', N'گرانول امانی مشتری'),
    (4001, 2, N'انبار پای کار — روکش/بسته‌بندی', N'WH-L2-03', N'ALF-3310', '2026-07-01', '2029-06-30', NULL, NULL, NULL, 120.0, 54.0, NULL, 1, 0, NULL, NULL),
    (4002, 2, N'انبار پای کار — روکش/بسته‌بندی', N'WH-L2-03', N'PVC-2295', '2026-07-12', '2029-07-11', NULL, NULL, NULL, 140.0, 72.0, NULL, 1, 0, NULL, NULL),
    (4003, 1, N'انبار مواد بسته‌بندی', NULL, N'CTN-1405-08', '2026-08-20', NULL, NULL, NULL, NULL, 45000.0, 20000.0, NULL, 1, 0, NULL, NULL),
    (4005, 1, N'انبار مواد بسته‌بندی', NULL, N'BRO-1405-07', '2026-07-15', NULL, NULL, NULL, NULL, 15000.0, 20000.0, NULL, 1, 0, NULL, N'رزرو بیش از موجودی'),
    (4005, 6, N'در راه — چاپخانه', NULL, N'BRO-1405-09', NULL, NULL, NULL, NULL, NULL, 50000.0, 0.0, '2026-10-11', 1, 0, NULL, NULL),
    (4005, 4, N'امانی مشتری — فارمد', NULL, N'FRM-B-0015', '2026-09-28', NULL, NULL, NULL, NULL, 12000.0, 10000.0, NULL, 1, 1, N'داروسازی فارمد', NULL),
    (4003, 4, N'امانی مشتری — فارمد', NULL, N'FRM-C-0015', '2026-09-28', NULL, NULL, NULL, NULL, 9000.0, 8334.0, NULL, 1, 1, N'داروسازی فارمد', NULL),
    (2002, 5, N'نزد پیمانکار — پارس‌دارو', NULL, N'B-1405-0939', '2026-10-05', '2028-10-04', NULL, NULL, NULL, 500000.0, 500000.0, NULL, 1, 0, N'داروسازی پارس‌دارو', N'ارسال‌شده برای روکش'),
    (1001, 1, N'انبار محصول', NULL, N'B-1405-0941', '2026-10-05', '2028-10-04', 100.2, NULL, NULL, 288000.0, 0.0, NULL, 1, 0, NULL, NULL),
    (1001, 3, N'قرنطینه‌ی محصول', NULL, N'B-1405-0941-R', '2026-10-05', '2028-10-04', NULL, NULL, NULL, 11400.0, 0.0, NULL, 2, 0, NULL, N'نامنطبق — منتظر تعیین تکلیف')
  ) v(ProductId, Kind, Inv, Ls, Batch, Mfg, Exp, Potency, Purity, Cycle, OnHand, Reserved, Arrival, Qc, Cust, Owner, Description)
  LEFT JOIN mes.LineSideInventory ls ON ls.Number = v.Ls AND ls.CompanyId = @C;

  COMMIT;
END
GO
