/* =====================================================================
   اسکیمای mes — گام ۲۲: FRM-ME-05 «عملیات بازیابی مواد»

   پیش‌نیاز: mes_frm_me04 (مواد و خروجی عملیات)، mes_frm_pe05 (ماده‌ی بازیابی‌شده)، mes_frm_rm08 (پیمانکار).
   یادداشت ALM: «تقطیر، تغلیظ، جداسازی، فیلتراسیون».

   نسخه‌ی قبل عملیات بازیابی نداشت (فقط IsRecovery/RecoveryPercentage روی ساختار)؛ جدول جدید است:
     mes.RoutingOperationRecovery  جدید — عملیات بازیابی در روش ساخت با ماده‌ی بازیابی‌شده (PE-05)، روش، نرخ و تلفات همین
                                   عملیات (F-ME-036)، انبار و الگوی سند رسید و بازگشت به همان دستور یا انبار عمومی (F-ME-037)،
                                   محل اجرا: همان خط، واحد مرکزی یا برون‌سپاری (F-ME-038)
   خروجی ماده‌ی بازیابی‌شده همان ردیف نوع ۵ در mes.RoutingOperationOutput است.

   فرض‌ها و کدهای موقت:
     RecoveryMethodCode     1 = تقطیر، 2 = تغلیظ، 3 = جداسازی، 4 = فیلتراسیون
     ReturnModeCode         1 = بازگشت به همان دستور، 2 = انبار عمومی بازیابی
     ExecutionLocationCode  1 = همان خط، 2 = واحد بازیابی مرکزی، 3 = برون‌سپاری
   انبار و الگوی سند فعلاً متن‌اند (سیستم انبار هنوز وصل نیست).

   فاز اول: F-ME-036، 037 (الزامی) و 038 (مهم، ولی همان ردیف — کنار بقیه نمایش داده می‌شود). این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.RoutingOperationRecovery','U') IS NULL
CREATE TABLE mes.RoutingOperationRecovery (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RoutingOperationRecovery PRIMARY KEY,
  RoutingOperationId BIGINT NOT NULL,
  RecoveredMaterialId BIGINT NOT NULL,
  RecoveryMethodCode INT NOT NULL CONSTRAINT CK_mes_ROR_Method CHECK (RecoveryMethodCode IN (1, 2, 3, 4)),
  RecoveryPercent DECIMAL(9,4) NOT NULL,
  LossPercent DECIMAL(9,4) NULL,
  ReceiptInventoryTitle NVARCHAR(256) NULL,
  ReceiptDocumentPatternTitle NVARCHAR(256) NULL,
  ReturnModeCode INT NOT NULL CONSTRAINT DF_mes_ROR_Return DEFAULT (2),
  ExecutionLocationCode INT NOT NULL CONSTRAINT DF_mes_ROR_Location DEFAULT (1),
  ProductionContractorId BIGINT NULL,
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

/* عملیات بازیابی با ماده‌ی مبدأ مصرفی همان روش (ورودی) و خروجی نوع ۵ همان عملیات */
CREATE OR ALTER PROCEDURE mes.GetRoutingRecoveries
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(x.Id AS INT) AS RecoveryId, CAST(o.RoutingId AS INT) AS RoutingId, r.Number AS RoutingCode, rv.Number AS VersionCode, r.Name AS RoutingTitle,
         r.RoutingMasterStatusCode AS RoutingStatusCode, CAST(o.Id AS INT) AS RoutingOperationId, o.Sequence, op.Number AS OperationCode, op.Name AS OperationTitle,
         CAST(rm.Id AS INT) AS RecoveredMaterialId, rm.Number AS RecoveredCode, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         sp.Number AS SourceCode, sp.Name AS SourceTitle, rm.StandardRecoveryPercent, rm.RecoveryLossPercent AS StandardLossPercent, rm.RequiresQcApproval, rm.MinPurityPercent,
         x.RecoveryMethodCode, x.RecoveryPercent, x.LossPercent, x.ReceiptInventoryTitle, x.ReceiptDocumentPatternTitle, x.ReturnModeCode, x.ExecutionLocationCode,
         ct.Number + N' — ' + ct.Name AS ContractorTitle, x.Description,
         (SELECT SUM(m.Quantity) FROM mes.RoutingOperationMaterial m JOIN mes.RoutingOperation o2 ON o2.Id = m.RoutingOperationId
           WHERE o2.RoutingId = o.RoutingId AND m.ProductId = rm.SourceProductId AND m.IsDeleted = 0) AS SourceInputQuantity,
         (SELECT SUM(z.Quantity) FROM mes.RoutingOperationOutput z WHERE z.RoutingOperationId = o.Id AND z.OuputProductId = rm.ProductId AND z.IsDeleted = 0) AS OutputQuantity
  FROM mes.RoutingOperationRecovery x
  JOIN mes.RoutingOperation o ON o.Id = x.RoutingOperationId
  JOIN mes.RoutingMaster r ON r.Id = o.RoutingId
  LEFT JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN mes.RecoveredMaterial rm ON rm.Id = x.RecoveredMaterialId
  JOIN mes.Product p ON p.Id = rm.ProductId
  LEFT JOIN mes.Product sp ON sp.Id = rm.SourceProductId
  LEFT JOIN mes.ProductionContractor ct ON ct.Id = x.ProductionContractorId
  WHERE x.CompanyId = @CompanyId AND x.IsDeleted = 0
  ORDER BY r.Number, o.Sequence;
END
GO

/* همه‌ی مواد بازیابی‌شده‌ی PE-05 و اینکه در کدام روش‌ها عملیات بازیابی دارند */
CREATE OR ALTER PROCEDURE mes.GetRecoveredMaterialCoverage
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(rm.Id AS INT) AS RecoveredMaterialId, rm.Number AS RecoveredCode, p.Number + N' — ' + p.Name AS Product, sp.Number + N' — ' + sp.Name AS Source,
         rm.RecoveryModeCode, rm.StandardRecoveryPercent, rm.IsActive,
         (SELECT COUNT(*) FROM mes.RoutingOperationRecovery x WHERE x.RecoveredMaterialId = rm.Id AND x.IsDeleted = 0) AS OperationCount
  FROM mes.RecoveredMaterial rm
  JOIN mes.Product p ON p.Id = rm.ProductId
  LEFT JOIN mes.Product sp ON sp.Id = rm.SourceProductId
  WHERE rm.CompanyId = @CompanyId AND rm.IsDeleted = 0
  ORDER BY rm.Number;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.RoutingOperationRecovery خالی است.
   عمداً قابل‌بحث: نرخ تقطیر در RT-2001 ۷۶٪ است (استاندارد PE-05: ۸۰٪) و اتانول بازیافتی «به همان دستور برمی‌گردد»
   در حالی که ماده‌ی بازیابی‌شده تأیید QC لازم دارد؛ RC-GRN در هیچ روشی عملیات بازیابی ندارد.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.RoutingOperationRecovery)
BEGIN
  DECLARE @C BIGINT = 222;
  INSERT mes.RoutingOperationRecovery (CompanyId, RoutingOperationId, RecoveredMaterialId, RecoveryMethodCode, RecoveryPercent, LossPercent,
                                       ReceiptInventoryTitle, ReceiptDocumentPatternTitle, ReturnModeCode, ExecutionLocationCode, ProductionContractorId, Description)
  SELECT @C, o.Id, rm.Id, 1, 76.0, 4.0, N'مخزن حلال بازیابی‌شده — سالن جامدات', N'رسید تولید — ماده‌ی بازیابی‌شده', 1, 1, NULL,
         N'تقطیر بخار اتانول خشک‌کن؛ بازگشت به محلول چسب بچ بعدی'
  FROM mes.RoutingMaster r
  JOIN mes.ProductionRevision rv ON rv.Id = r.VersionId AND rv.Number = N'v1'
  JOIN mes.RoutingOperation o ON o.RoutingId = r.Id AND o.Sequence = 30
  JOIN mes.RecoveredMaterial rm ON rm.Number = N'RC-ETH' AND rm.CompanyId = @C
  WHERE r.Number = N'RT-2001' AND r.CompanyId = @C;
END
GO
