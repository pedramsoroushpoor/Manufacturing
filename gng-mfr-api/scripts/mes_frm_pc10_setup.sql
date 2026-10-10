/* =====================================================================
   اسکیمای mes — گام ۴۰: FRM-PC-10 «اجرای برون‌سپاری و کارمزدی»

   پیش‌نیاز: mes_frm_pc09، پیمانکاران و نرخ قرارداد (RM-08)، دستور دارای عملیات برون‌سپاری و کارمزدی (PC-02)، کیت (PC-03).

   جدول‌های قدیم: mes.WorkOrderOperation (IsOutsourced؛ ادامه‌ی مسیر داخلی پس از دریافت با ReceivedQuantity عملیات بعد، F-PC-084)،
                  mes.ProductionContractorRate (نرخ قرارداد، 085)، mes.ProductionContractorInventory (انبار امانی نزد پیمانکار، 081).
   جدول‌های جدید:
     mes.SubcontractShipment      سند جابه‌جایی با پیمانکار یا مشتری کارمزدی: ارسال مواد امانی با سند انتقال و برگه‌ی همراه (081)،
                                  دریافت از پیمانکار (082)، ورود مواد مشتری و تحویل محصول کارمزدی (087)؛ شماره‌ی نیاز خدمت تدارکات (080)
                                  و نرخ قرارداد انتخاب‌شده روی سند ارسال
     mes.SubcontractShipmentItem  اقلام با نقش (ارسال، خروجی سالم/معیوب، مواد برگشتی، مصرف و ضایعات اعلامی، مواد مشتری، تحویل)
     mes.SubcontractProgress      پیشرفت اعلامی پیمانکار — پایش وضعیت و پیش‌بینی تأخیر (086)؛ ورودی پورتال PC-11
     mes.TollingContract          قرارداد کارمزدی دریافتی با مشتری: نرخ کارمزد و ضایعات مجاز (087، 088)
   مغایرت‌گیری (083)، کارمزد (085)، صورت‌حساب مواد مشتری (088) و تفکیک مالکیت (089) زنده.

   فرض‌ها و کدهای موقت:
     DirectionCode  1 ارسال به پیمانکار، 2 دریافت از پیمانکار، 3 ورود مواد مشتری، 4 تحویل محصول به مشتری
     ItemRoleCode   1 ماده‌ی ارسالی، 2 خروجی سالم، 3 خروجی معیوب برگشتی، 4 ماده‌ی مصرف‌نشده‌ی برگشتی، 5 مصرف اعلامی،
                    6 ضایعات اعلامی، 7 ماده‌ی مشتری، 8 محصول تحویلی
     StageCode      1 دریافت مواد، 2 در جریان، 3 آماده‌ی ارسال، 4 ارسال‌شده
     StatusCode     1 پیش‌نویس، 2 ارسال/دریافت‌شده، 3 تأییدشده

   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.SubcontractShipment','U') IS NULL
CREATE TABLE mes.SubcontractShipment (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_SubcontractShipment PRIMARY KEY,
  Number NVARCHAR(32) NOT NULL,
  DirectionCode INT NOT NULL,
  ContractorId BIGINT NULL,
  TollingContractId BIGINT NULL,
  WorkOrderId BIGINT NULL,
  WOOperationId BIGINT NULL,
  ContractorRateId BIGINT NULL,
  ContractorInventoryId BIGINT NULL,
  ShipmentDate DATETIME2 NOT NULL,
  ExpectedReturnDate DATETIME2 NULL,
  TransferDocumentNumber NVARCHAR(64) NULL,
  WaybillNumber NVARCHAR(64) NULL,
  VehicleTitle NVARCHAR(128) NULL,
  DriverTitle NVARCHAR(128) NULL,
  ServiceRequestNumber NVARCHAR(64) NULL,
  StatusCode INT NOT NULL CONSTRAINT DF_mes_SubcontractShipment_Status DEFAULT (2),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.SubcontractShipmentItem','U') IS NULL
CREATE TABLE mes.SubcontractShipmentItem (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_SubcontractShipmentItem PRIMARY KEY,
  ShipmentId BIGINT NOT NULL,
  ProductId BIGINT NOT NULL,
  BatchNumber NVARCHAR(64) NULL,
  Quantity DECIMAL(32,6) NOT NULL,
  ItemRoleCode INT NOT NULL,
  AcceptedQuantity DECIMAL(32,6) NULL,
  RejectedQuantity DECIMAL(32,6) NULL,
  IsCustomerOwned BIT NOT NULL CONSTRAINT DF_mes_SSI_Customer DEFAULT (0),
  OwnerTitle NVARCHAR(256) NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.SubcontractProgress','U') IS NULL
CREATE TABLE mes.SubcontractProgress (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_SubcontractProgress PRIMARY KEY,
  ContractorId BIGINT NOT NULL,
  WorkOrderId BIGINT NOT NULL,
  WOOperationId BIGINT NOT NULL,
  ReportedAt DATETIME2 NOT NULL,
  StageCode INT NOT NULL,
  CompletedQuantity DECIMAL(32,6) NULL,
  WastedQuantity DECIMAL(32,6) NULL,
  ExpectedReadyDate DATETIME2 NULL,
  ReportedByTitle NVARCHAR(128) NULL,
  SourceCode INT NOT NULL CONSTRAINT DF_mes_SubcontractProgress_Source DEFAULT (1),
  Note NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.TollingContract','U') IS NULL
CREATE TABLE mes.TollingContract (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_TollingContract PRIMARY KEY,
  ContractNumber NVARCHAR(64) NOT NULL,
  CustomerTitle NVARCHAR(256) NOT NULL,
  CustomerPartyId BIGINT NULL,
  ProductId BIGINT NOT NULL,
  FeePerUnit DECIMAL(32,2) NOT NULL,
  FeeUnitTitle NVARCHAR(64) NOT NULL,
  FeeUnitSize INT NOT NULL CONSTRAINT DF_mes_TollingContract_UnitSize DEFAULT (1000),
  AllowedWastePercent DECIMAL(9,4) NULL,
  SettlementPeriodCode INT NULL,
  ValidFromDate DATE NULL,
  ValidToDate DATE NULL,
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

/* کار نزد پیمانکار: هر عملیات برون‌سپاری با سند ارسال، آخرین پیشرفت، دریافت‌ها، تأخیر، کارمزد و عملیات بعدی */
CREATE OR ALTER PROCEDURE mes.GetSubcontractOrders
  @CompanyId BIGINT,
  @ContractorId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2 = mes.fnShopNow();
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.BatchNumber, p.Number + N' — ' + p.Name AS ProductTitle,
         CAST(o.Id AS INT) AS OperationId, o.Sequence AS OperationSequence, op.Name AS OperationTitle, o.WorkOrderOperationStatusCode AS OperationStatusCode,
         o.ToCompleteQuantity, CAST(ct.Id AS INT) AS ContractorId, ct.Number AS ContractorCode, ct.Name AS ContractorTitle,
         s.Number AS SendNumber, s.ShipmentDate AS SentAt, s.ExpectedReturnDate, s.ServiceRequestNumber, s.TransferDocumentNumber, s.WaybillNumber,
         r.FeePerUnit, r.FeeUnitTitle, r.LeadTimeDays, r.ProductTitle AS RateTitle,
         pg.StageCode, pg.ReportedAt AS ProgressAt, pg.CompletedQuantity AS ProgressCompleted, pg.WastedQuantity AS ProgressWasted, pg.ExpectedReadyDate,
         ISNULL(rc.Good, 0) AS ReceivedGood, ISNULL(rc.Accepted, 0) AS Accepted, ISNULL(rc.Defective, 0) AS ReceivedDefective, ISNULL(rc.Waste, 0) AS DeclaredWaste,
         rc.LastReceipt,
         CAST(ISNULL(rc.Accepted, 0) * r.FeePerUnit / 1000.0 AS DECIMAL(32,0)) AS FeePayable,
         CASE WHEN COALESCE(pg.ExpectedReadyDate, @now) > s.ExpectedReturnDate THEN DATEDIFF(DAY, s.ExpectedReturnDate, COALESCE(pg.ExpectedReadyDate, @now)) ELSE 0 END AS DelayDays,
         CAST(CASE WHEN @now > s.ExpectedReturnDate AND ISNULL(rc.Good, 0) + ISNULL(rc.Defective, 0) + ISNULL(rc.Waste, 0) < o.ToCompleteQuantity THEN 1 ELSE 0 END AS BIT) AS IsOverdue,
         nx.Sequence AS NextSequence, nx.Name AS NextOperationTitle, nx.WorkOrderOperationStatusCode AS NextStatusCode, nx.ReceivedQuantity AS NextReceived
  FROM mes.WorkOrderOperation o
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.Product p ON p.Id = w.MainProductId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  OUTER APPLY (SELECT TOP (1) * FROM mes.SubcontractShipment s WHERE s.WOOperationId = o.Id AND s.DirectionCode = 1 AND s.IsDeleted = 0 ORDER BY s.ShipmentDate) s
  LEFT JOIN mes.ProductionContractor ct ON ct.Id = s.ContractorId
  LEFT JOIN mes.ProductionContractorRate r ON r.Id = s.ContractorRateId
  OUTER APPLY (SELECT TOP (1) * FROM mes.SubcontractProgress g WHERE g.WOOperationId = o.Id AND g.IsDeleted = 0 ORDER BY g.ReportedAt DESC) pg
  OUTER APPLY (SELECT SUM(CASE WHEN i.ItemRoleCode = 2 THEN i.Quantity END) AS Good, SUM(CASE WHEN i.ItemRoleCode = 2 THEN i.AcceptedQuantity END) AS Accepted,
                      SUM(CASE WHEN i.ItemRoleCode = 3 THEN i.Quantity END) AS Defective, SUM(CASE WHEN i.ItemRoleCode = 6 THEN i.Quantity END) AS Waste,
                      MAX(x.ShipmentDate) AS LastReceipt
               FROM mes.SubcontractShipment x JOIN mes.SubcontractShipmentItem i ON i.ShipmentId = x.Id AND i.IsDeleted = 0
               WHERE x.WOOperationId = o.Id AND x.DirectionCode = 2 AND x.IsDeleted = 0) rc
  OUTER APPLY (SELECT TOP (1) n.Sequence, nop.Name, n.WorkOrderOperationStatusCode, n.ReceivedQuantity FROM mes.WorkOrderOperation n
               JOIN mes.ProductionOperation nop ON nop.Id = n.OperationId WHERE n.WorkOrderId = w.Id AND n.Sequence > o.Sequence AND n.IsDeleted = 0 ORDER BY n.Sequence) nx
  WHERE w.CompanyId = @CompanyId AND w.IsDeleted = 0 AND o.IsDeleted = 0 AND o.IsOutsourced = 1 AND (@ContractorId IS NULL OR s.ContractorId = @ContractorId)
  ORDER BY s.ShipmentDate DESC;

  SELECT CAST(g.Id AS INT) AS ProgressId, CAST(g.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, o.Sequence AS OperationSequence,
         CAST(g.ContractorId AS INT) AS ContractorId, ct.Name AS ContractorTitle, g.ReportedAt, g.StageCode, g.CompletedQuantity, g.WastedQuantity,
         g.ExpectedReadyDate, g.ReportedByTitle, g.SourceCode, g.Note
  FROM mes.SubcontractProgress g
  JOIN mes.WorkOrder w ON w.Id = g.WorkOrderId
  JOIN mes.WorkOrderOperation o ON o.Id = g.WOOperationId
  JOIN mes.ProductionContractor ct ON ct.Id = g.ContractorId
  WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0 AND (@ContractorId IS NULL OR g.ContractorId = @ContractorId)
  ORDER BY g.ReportedAt;
END
GO

/* سندهای جابه‌جایی و اقلام */
CREATE OR ALTER PROCEDURE mes.GetSubcontractShipments
  @CompanyId BIGINT,
  @ContractorId BIGINT = NULL,
  @TollingContractId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(s.Id AS INT) AS ShipmentId, s.Number, s.DirectionCode, CAST(s.ContractorId AS INT) AS ContractorId, ct.Name AS ContractorTitle,
         CAST(s.TollingContractId AS INT) AS TollingContractId, tc.CustomerTitle, CAST(s.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber,
         o.Sequence AS OperationSequence, s.ShipmentDate, s.ExpectedReturnDate, s.TransferDocumentNumber, s.WaybillNumber, s.VehicleTitle, s.DriverTitle,
         s.ServiceRequestNumber, s.StatusCode, ci.Name AS ContractorInventoryTitle, ci.ReferenceInventoryNumber, s.Description
  FROM mes.SubcontractShipment s
  LEFT JOIN mes.ProductionContractor ct ON ct.Id = s.ContractorId
  LEFT JOIN mes.TollingContract tc ON tc.Id = s.TollingContractId
  LEFT JOIN mes.WorkOrder w ON w.Id = s.WorkOrderId
  LEFT JOIN mes.WorkOrderOperation o ON o.Id = s.WOOperationId
  LEFT JOIN mes.ProductionContractorInventory ci ON ci.Id = s.ContractorInventoryId
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0
    AND (@ContractorId IS NULL OR s.ContractorId = @ContractorId) AND (@TollingContractId IS NULL OR s.TollingContractId = @TollingContractId)
  ORDER BY s.ShipmentDate DESC;

  SELECT CAST(i.Id AS INT) AS ItemId, CAST(i.ShipmentId AS INT) AS ShipmentId, CAST(i.ProductId AS INT) AS ProductId, p.Number + N' — ' + p.Name AS ProductTitle,
         p.MeasureUnitTitle AS UnitTitle, i.BatchNumber, i.Quantity, i.ItemRoleCode, i.AcceptedQuantity, i.RejectedQuantity, i.IsCustomerOwned, i.OwnerTitle, i.Description
  FROM mes.SubcontractShipmentItem i
  JOIN mes.SubcontractShipment s ON s.Id = i.ShipmentId
  JOIN mes.Product p ON p.Id = i.ProductId
  WHERE i.CompanyId = @CompanyId AND i.IsDeleted = 0 AND s.IsDeleted = 0
    AND (@ContractorId IS NULL OR s.ContractorId = @ContractorId) AND (@TollingContractId IS NULL OR s.TollingContractId = @TollingContractId)
  ORDER BY i.ShipmentId, i.ItemRoleCode, i.Id;
END
GO

/* مغایرت‌گیری مواد ارسالی (F-PC-083): ارسال = مصرف اعلامی + مصرف‌نشده‌ی برگشتی + مانده نزد پیمانکار */
CREATE OR ALTER PROCEDURE mes.GetSubcontractReconciliation
  @CompanyId BIGINT,
  @ContractorId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(s.WorkOrderId AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, CAST(s.ContractorId AS INT) AS ContractorId, ct.Name AS ContractorTitle,
         CAST(i.ProductId AS INT) AS ProductId, p.Number + N' — ' + p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle, i.BatchNumber,
         SUM(i.Quantity) AS Sent, ISNULL(MAX(d.Consumed), 0) AS DeclaredConsumption, ISNULL(MAX(d.Returned), 0) AS ReturnedUnused,
         ISNULL(MAX(st.Remaining), 0) AS RemainingAtContractor,
         SUM(i.Quantity) - ISNULL(MAX(d.Consumed), 0) - ISNULL(MAX(d.Returned), 0) - ISNULL(MAX(st.Remaining), 0) AS Difference
  FROM mes.SubcontractShipment s
  JOIN mes.SubcontractShipmentItem i ON i.ShipmentId = s.Id AND i.IsDeleted = 0 AND i.ItemRoleCode = 1
  JOIN mes.WorkOrder w ON w.Id = s.WorkOrderId
  JOIN mes.ProductionContractor ct ON ct.Id = s.ContractorId
  JOIN mes.Product p ON p.Id = i.ProductId
  OUTER APPLY (SELECT SUM(CASE WHEN di.ItemRoleCode = 5 THEN di.Quantity END) AS Consumed, SUM(CASE WHEN di.ItemRoleCode = 4 THEN di.Quantity END) AS Returned
               FROM mes.SubcontractShipment ds JOIN mes.SubcontractShipmentItem di ON di.ShipmentId = ds.Id AND di.IsDeleted = 0
               WHERE ds.WOOperationId = s.WOOperationId AND ds.DirectionCode = 2 AND ds.IsDeleted = 0 AND di.ProductId = i.ProductId) d
  OUTER APPLY (SELECT SUM(m.OnHandQuantity) AS Remaining FROM mes.MaterialStock m
               WHERE m.IsDeleted = 0 AND m.InventoryKindCode = 5 AND m.ProductId = i.ProductId AND m.BatchNumber = i.BatchNumber) st
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0 AND s.DirectionCode = 1 AND (@ContractorId IS NULL OR s.ContractorId = @ContractorId)
  GROUP BY s.WorkOrderId, w.Number, s.ContractorId, ct.Name, i.ProductId, p.Number, p.Name, p.MeasureUnitTitle, i.BatchNumber
  ORDER BY w.Number, p.Number;
END
GO

/* کارمزدی دریافتی (F-PC-087، 088): قراردادها با دستور، تحویل و کارمزد؛ صورت‌حساب مواد مشتری */
CREATE OR ALTER PROCEDURE mes.GetTollStatement
  @CompanyId BIGINT,
  @TollingContractId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(tc.Id AS INT) AS TollingContractId, tc.ContractNumber, tc.CustomerTitle, p.Number + N' — ' + p.Name AS ProductTitle, tc.FeePerUnit, tc.FeeUnitTitle,
         tc.FeeUnitSize, tc.AllowedWastePercent, tc.ValidFromDate, tc.ValidToDate, CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber,
         w.WorkOrderStatusCode, w.Quantity AS OrderQuantity, w.BatchNumber,
         ISNULL(dl.Delivered, 0) AS Delivered,
         CAST(ISNULL(dl.Delivered, 0) * tc.FeePerUnit / tc.FeeUnitSize AS DECIMAL(32,0)) AS FeeEarned,
         CAST(w.Quantity * tc.FeePerUnit / tc.FeeUnitSize AS DECIMAL(32,0)) AS FeeProjected,
         (SELECT MAX(o.CompletedQuantity) FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) AS FurthestCompleted,
         (SELECT SUM(o.WastedQuantity) FROM mes.WorkOrderOperation o WHERE o.WorkOrderId = w.Id AND o.IsDeleted = 0) AS WastedSoFar, tc.Description
  FROM mes.TollingContract tc
  JOIN mes.Product p ON p.Id = tc.ProductId
  LEFT JOIN mes.WorkOrder w ON w.WOTypeCode = 6 AND w.MainProductId = tc.ProductId AND w.CustomerTitle = tc.CustomerTitle AND w.IsDeleted = 0
  OUTER APPLY (SELECT SUM(i.Quantity) AS Delivered FROM mes.SubcontractShipment s JOIN mes.SubcontractShipmentItem i ON i.ShipmentId = s.Id AND i.IsDeleted = 0
               WHERE s.TollingContractId = tc.Id AND s.DirectionCode = 4 AND s.IsDeleted = 0 AND i.ItemRoleCode = 8) dl
  WHERE tc.CompanyId = @CompanyId AND tc.IsDeleted = 0 AND (@TollingContractId IS NULL OR tc.Id = @TollingContractId)
  ORDER BY tc.ContractNumber;

  /* صورت‌حساب: دریافتی = مصرف ثبت‌شده + مانده‌ی امانی + مغایرت */
  SELECT CAST(tc.Id AS INT) AS TollingContractId, tc.CustomerTitle, CAST(i.ProductId AS INT) AS ProductId, p.Number + N' — ' + p.Name AS ProductTitle,
         p.MeasureUnitTitle AS UnitTitle, i.BatchNumber, SUM(i.Quantity) AS Received, MIN(s.ShipmentDate) AS FirstReceipt,
         ISNULL(MAX(cn.Consumed), 0) AS Consumed, ISNULL(MAX(st.Remaining), 0) AS Remaining,
         SUM(i.Quantity) - ISNULL(MAX(cn.Consumed), 0) - ISNULL(MAX(st.Remaining), 0) AS Difference
  FROM mes.TollingContract tc
  JOIN mes.SubcontractShipment s ON s.TollingContractId = tc.Id AND s.DirectionCode = 3 AND s.IsDeleted = 0
  JOIN mes.SubcontractShipmentItem i ON i.ShipmentId = s.Id AND i.IsDeleted = 0 AND i.ItemRoleCode = 7
  JOIN mes.Product p ON p.Id = i.ProductId
  OUTER APPLY (SELECT SUM(CASE WHEN c.IsReversal = 1 THEN -c.ConsumedQuantity ELSE c.ConsumedQuantity END) AS Consumed
               FROM mes.WorkOrderOperationMaterialConsumed c JOIN mes.WorkOrderOperationMaterial m ON m.Id = c.WOOperationMaterialId
               JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
               WHERE c.IsDeleted = 0 AND m.ProductId = i.ProductId AND w.WOTypeCode = 6 AND w.CustomerTitle = tc.CustomerTitle
                 AND (c.BatchNumber = i.BatchNumber OR (c.BatchNumber IS NULL AND c.IsCustomerMaterial = 1))) cn
  OUTER APPLY (SELECT SUM(m.OnHandQuantity) AS Remaining FROM mes.MaterialStock m
               WHERE m.IsDeleted = 0 AND m.IsCustomerOwned = 1 AND m.ProductId = i.ProductId AND m.BatchNumber = i.BatchNumber) st
  WHERE tc.CompanyId = @CompanyId AND tc.IsDeleted = 0 AND (@TollingContractId IS NULL OR tc.Id = @TollingContractId)
  GROUP BY tc.Id, tc.CustomerTitle, i.ProductId, p.Number, p.Name, p.MeasureUnitTitle, i.BatchNumber
  ORDER BY tc.Id, p.Number;
END
GO

/* تفکیک مالکیت (F-PC-089): موجودی به تفکیک مالک و محل؛ دستورهای در جریان با مالکیت مواد */
CREATE OR ALTER PROCEDURE mes.GetOwnershipSeparation
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CASE WHEN s.IsCustomerOwned = 1 THEN s.OwnerTitle ELSE N'گلرنگ' END AS OwnerTitle, s.IsCustomerOwned, s.InventoryKindCode, s.InventoryTitle,
         CAST(s.ProductId AS INT) AS ProductId, p.Number + N' — ' + p.Name AS ProductTitle, p.ProductGroupTitle, p.MeasureUnitTitle AS UnitTitle, s.BatchNumber,
         s.OnHandQuantity, s.QcStatusCode, CASE WHEN s.InventoryKindCode = 5 THEN s.OwnerTitle END AS HolderTitle
  FROM mes.MaterialStock s
  JOIN mes.Product p ON p.Id = s.ProductId
  WHERE s.CompanyId = @CompanyId AND s.IsDeleted = 0 AND s.OnHandQuantity > 0
  ORDER BY s.IsCustomerOwned DESC, s.InventoryKindCode, p.Number;

  SELECT w.Number AS WorkOrderNumber, w.WOTypeCode, w.CustomerTitle, CAST(m.IsCustomerMaterial AS BIT) AS IsCustomerMaterial,
         p.Number + N' — ' + p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         SUM(CASE WHEN c.IsReversal = 1 THEN -c.ConsumedQuantity ELSE c.ConsumedQuantity END) AS Consumed
  FROM mes.WorkOrderOperationMaterialConsumed c
  JOIN mes.WorkOrderOperationMaterial m ON m.Id = c.WOOperationMaterialId
  JOIN mes.WorkOrderOperation o ON o.Id = m.WOOperationId
  JOIN mes.WorkOrder w ON w.Id = o.WorkOrderId
  JOIN mes.Product p ON p.Id = m.ProductId
  WHERE c.CompanyId = @CompanyId AND c.IsDeleted = 0 AND w.WorkOrderStatusCode IN (2, 3, 4)
  GROUP BY w.Number, w.WOTypeCode, w.CustomerTitle, m.IsCustomerMaterial, p.Number, p.Name, p.MeasureUnitTitle
  ORDER BY w.Number, m.IsCustomerMaterial DESC, p.Number;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.SubcontractShipment خالی است.
   عمداً خراب: پیش‌بینی آمادگی پیمانکار روکش (۲۲ مهر) ۲ روز بعد از موعد قرارداد (۷ روز) است؛ ۱٫۲ کیلو محلول روکش ارسالی
   در مغایرت‌گیری توضیح ندارد؛ ۲٫۵۴ کیلو گرانول امانی فارمد نه مصرف ثبت شده و نه در موجودی است؛ نرخ روکش روی سند ارسال
   انتخاب شده چون عملیات «روکش‌دهی برون‌سپاری» دستور با عملیات «روکش‌دهی» قرارداد یکی نیست.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.SubcontractShipment)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222, @now DATETIME2 = mes.fnShopNow();
  DECLARE @w503 BIGINT = (SELECT Id FROM mes.WorkOrder WHERE Number = N'WO-1405-0503' AND CompanyId = @C),
          @w506 BIGINT = (SELECT Id FROM mes.WorkOrder WHERE Number = N'WO-1405-0506' AND CompanyId = @C);
  DECLARE @op503 BIGINT = (SELECT Id FROM mes.WorkOrderOperation WHERE WorkOrderId = @w503 AND Sequence = 10),
          @op503n BIGINT = (SELECT Id FROM mes.WorkOrderOperation WHERE WorkOrderId = @w503 AND Sequence = 20);

  INSERT mes.TollingContract (CompanyId, ContractNumber, CustomerTitle, ProductId, FeePerUnit, FeeUnitTitle, FeeUnitSize, AllowedWastePercent, SettlementPeriodCode,
                              ValidFromDate, ValidToDate, Description)
  VALUES (@C, N'TC-1405-007', N'داروسازی فارمد', 1001, 2100000, N'هر ۱۰۰۰ قرص', 1000, 1.0, 2, '2026-09-23', '2027-03-20',
          N'گرانول، کارتن و بروشور از مشتری؛ پرس و بسته‌بندی در خط ۱؛ صورت‌حساب مواد ماهانه');
  DECLARE @tc BIGINT = SCOPE_IDENTITY();

  INSERT mes.SubcontractShipment (CompanyId, Number, DirectionCode, ContractorId, TollingContractId, WorkOrderId, WOOperationId, ContractorRateId, ContractorInventoryId,
         ShipmentDate, ExpectedReturnDate, TransferDocumentNumber, WaybillNumber, VehicleTitle, DriverTitle, ServiceRequestNumber, StatusCode, Description)
  VALUES (@C, N'SH-1405-0141', 1, 1, NULL, @w503, @op503, 4, 2, '2026-10-05 00:00', '2026-10-12 00:00', N'TR-1405-3307', N'WB-1405-0611', N'کامیونت ۲۴ ع ۵۵۱ ایران ۱۰',
          N'حسین کرمی', N'SR-1405-0217', 3, N'قرص روکش‌نشده و محلول روکش برای روکش‌دهی'),
         (@C, N'SH-1405-0152', 2, 1, NULL, @w503, @op503, NULL, 2, '2026-10-08 16:00', NULL, N'TR-1405-3352', N'WB-PD-0918', N'کامیون پارس‌دارو', N'رضا نامی',
          NULL, 3, N'دریافت جزئی اول: سالم، معیوب برگشتی، مصرف و ضایعات اعلامی'),
         (@C, N'SH-1405-0138', 3, NULL, @tc, @w506, NULL, NULL, NULL, '2026-10-06 10:30', NULL, N'RCV-1405-0812', N'WB-FRM-0402', N'خودروی فارمد', N'مسعود یگانه',
          NULL, 3, N'ورود مواد امانی مشتری برای WO-1405-0506');

  INSERT mes.SubcontractShipmentItem (CompanyId, ShipmentId, ProductId, BatchNumber, Quantity, ItemRoleCode, AcceptedQuantity, RejectedQuantity, IsCustomerOwned, OwnerTitle, Description)
  SELECT @C, s.Id, v.ProductId, v.Batch, v.Qty, v.Role, v.Acc, v.Rej, v.Cust, CASE WHEN v.Cust = 1 THEN N'داروسازی فارمد' END, v.Note
  FROM (VALUES
    (N'SH-1405-0141', 2002, N'B-1405-0939', 500000, 1, NULL, NULL, 0, NULL),
    (N'SH-1405-0141', 2003, N'SOL-1405-044', 32, 1, NULL, NULL, 0, N'۲ بشکه'),
    (N'SH-1405-0152', 1002, N'B-1405-0939', 150000, 2, 150000, 0, 0, N'بازرسی ورود نمونه‌ای سالم'),
    (N'SH-1405-0152', 1002, N'B-1405-0939', 1800, 3, NULL, 1800, 0, N'لکه‌ی روکش — برای روکش مجدد'),
    (N'SH-1405-0152', 2002, N'B-1405-0939', 156000, 5, NULL, NULL, 0, N'۱۵۰٬۰۰۰ سالم + ۱٬۸۰۰ معیوب + ۴٬۲۰۰ ضایعات'),
    (N'SH-1405-0152', 2003, N'SOL-1405-044', 10.2, 5, NULL, NULL, 0, NULL),
    (N'SH-1405-0152', 1002, N'B-1405-0939', 4200, 6, NULL, NULL, 0, N'ضایعات اعلامی پیمانکار'),
    (N'SH-1405-0138', 2001, N'FRM-G-0092', 235, 7, 235, 0, 1, N'۵ بشکه'),
    (N'SH-1405-0138', 4003, N'FRM-C-0015', 9000, 7, 9000, 0, 1, NULL),
    (N'SH-1405-0138', 4005, N'FRM-B-0015', 12000, 7, 12000, 0, 1, NULL)
  ) v(Num, ProductId, Batch, Qty, Role, Acc, Rej, Cust, Note)
  JOIN mes.SubcontractShipment s ON s.Number = v.Num AND s.CompanyId = @C;

  INSERT mes.SubcontractProgress (CompanyId, ContractorId, WorkOrderId, WOOperationId, ReportedAt, StageCode, CompletedQuantity, WastedQuantity, ExpectedReadyDate, ReportedByTitle, SourceCode, Note)
  VALUES (@C, 1, @w503, @op503, '2026-10-05 14:00', 1, 0, 0, '2026-10-12 00:00', N'پارس‌دارو — برنامه‌ریزی', 2, N'مواد رسید و شمارش شد'),
         (@C, 1, @w503, @op503, '2026-10-07 18:00', 2, 160000, 1500, '2026-10-12 00:00', N'پارس‌دارو — سرپرست روکش', 2, NULL),
         (@C, 1, @w503, @op503, '2026-10-08 12:00', 3, 156000, 4200, '2026-10-13 00:00', N'پارس‌دارو — سرپرست روکش', 2, N'بخش اول آماده‌ی ارسال'),
         (@C, 1, @w503, @op503, '2026-10-09 09:40', 2, 238000, 5100, '2026-10-14 00:00', N'پارس‌دارو — سرپرست روکش', 2, N'یکی از دو پان روکش در تعمیر است');

  /* دریافت جزئی: پیشرفت عملیات برون‌سپاری و ادامه‌ی مسیر داخلی */
  UPDATE mes.WorkOrderOperation SET CompletedQuantity = 150000, WastedQuantity = 4200, ReworkQuantity = 1800, TransferredQuantity = 150000
  WHERE Id = @op503 AND CompletedQuantity = 0;
  UPDATE mes.WorkOrderOperation SET WorkOrderOperationStatusCode = 2, ReceivedQuantity = 150000 WHERE Id = @op503n AND WorkOrderOperationStatusCode = 1;

  /* موجودی نزد پیمانکار و دریافتی */
  UPDATE mes.MaterialStock SET OnHandQuantity = 344000 WHERE BatchNumber = N'B-1405-0939' AND ProductId = 2002 AND InventoryKindCode = 5;
  IF NOT EXISTS (SELECT 1 FROM mes.MaterialStock WHERE BatchNumber = N'SOL-1405-044')
    INSERT mes.MaterialStock (CompanyId, ProductId, InventoryKindCode, InventoryTitle, BatchNumber, ManufactureDate, ExpireDate, OnHandQuantity, ReservedQuantity, QcStatusCode, IsCustomerOwned, OwnerTitle)
    VALUES (@C, 2003, 5, N'نزد پیمانکار — پارس‌دارو', N'SOL-1405-044', '2026-10-07', '2026-10-21', 20.6, 0, 1, 0, N'داروسازی پارس‌دارو'),
           (@C, 1002, 2, N'انبار پای کار — روکش/بسته‌بندی', N'B-1405-0939', '2026-10-08', '2029-10-08', 150000, 0, 1, 0, NULL),
           (@C, 1002, 3, N'قرنطینه‌ی محصول', N'B-1405-0939-R', '2026-10-08', '2029-10-08', 1800, 0, 2, 0, NULL);

  COMMIT;
END
GO
