/* =====================================================================
   اسکیمای mes — گام ۴۱: FRM-PC-11 «پورتال پیمانکار و مشتری کارمزدی»

   پیش‌نیاز: mes_frm_pc10 (سندهای جابه‌جایی، پیشرفت پیمانکار، قرارداد کارمزدی).

   جدول جدید:
     mes.PortalAccount  حساب محدود بیرونی (F-PC-090): پیمانکار یا مشتری کارمزدی، با مجوز ثبت پیشرفت، دیدن مانده و دیدن کارمزد.
                        هر حساب فقط داده‌ی طرف خودش را می‌بیند؛ فیلتر در روال‌ها با شناسه‌ی طرف (نه عنوان) انجام می‌شود.
   نمای پورتال از همان روال‌های PC-10 با پارامتر طرف ساخته می‌شود؛ روال تازه فقط پیشرفت دستور کارمزدی برای مشتری است.

   فرض‌ها و کدهای موقت:
     PartyTypeCode  1 پیمانکار، 2 مشتری کارمزدی
     ورود واقعی بیرونی (احراز هویت جدا از ALM) در فاز بعد؛ این فرم پیش‌نمایش «نمای طرف» است.

   فاز اول فقط‌خواندنی است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.PortalAccount','U') IS NULL
CREATE TABLE mes.PortalAccount (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_PortalAccount PRIMARY KEY,
  UserName NVARCHAR(64) NOT NULL,
  DisplayName NVARCHAR(128) NOT NULL,
  PartyTypeCode INT NOT NULL,
  ContractorId BIGINT NULL,
  TollingContractId BIGINT NULL,
  CanReportProgress BIT NOT NULL CONSTRAINT DF_mes_PortalAccount_Progress DEFAULT (0),
  CanViewBalances BIT NOT NULL CONSTRAINT DF_mes_PortalAccount_Balances DEFAULT (1),
  CanViewFees BIT NOT NULL CONSTRAINT DF_mes_PortalAccount_Fees DEFAULT (0),
  LastLoginAt DATETIME2 NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_mes_PortalAccount_Active DEFAULT (1),
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

CREATE OR ALTER PROCEDURE mes.GetPortalAccounts
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(a.Id AS INT) AS AccountId, a.UserName, a.DisplayName, a.PartyTypeCode, CAST(a.ContractorId AS INT) AS ContractorId, ct.Name AS ContractorTitle,
         CAST(a.TollingContractId AS INT) AS TollingContractId, tc.CustomerTitle, tc.ContractNumber, a.CanReportProgress, a.CanViewBalances, a.CanViewFees,
         a.LastLoginAt, a.IsActive, a.Description
  FROM mes.PortalAccount a
  LEFT JOIN mes.ProductionContractor ct ON ct.Id = a.ContractorId
  LEFT JOIN mes.TollingContract tc ON tc.Id = a.TollingContractId
  WHERE a.CompanyId = @CompanyId AND a.IsDeleted = 0
  ORDER BY a.PartyTypeCode, a.DisplayName;
END
GO

/* پیشرفت عملیاتی دستورهای کارمزدی یک قرارداد (برای نمای مشتری) */
CREATE OR ALTER PROCEDURE mes.GetTollOrderProgress
  @CompanyId BIGINT,
  @TollingContractId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(w.Id AS INT) AS WorkOrderId, w.Number AS WorkOrderNumber, w.BatchNumber, w.Quantity, w.WorkOrderStatusCode, w.DueDate,
         o.Sequence, op.Name AS OperationTitle, o.WorkOrderOperationStatusCode AS OperationStatusCode, o.ToCompleteQuantity, o.CompletedQuantity, o.WastedQuantity,
         o.StartTime, o.EndTime, o.Description
  FROM mes.TollingContract tc
  JOIN mes.WorkOrder w ON w.WOTypeCode = 6 AND w.MainProductId = tc.ProductId AND w.CustomerTitle = tc.CustomerTitle AND w.IsDeleted = 0
  JOIN mes.WorkOrderOperation o ON o.WorkOrderId = w.Id AND o.IsDeleted = 0
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  WHERE tc.CompanyId = @CompanyId AND tc.Id = @TollingContractId AND tc.IsDeleted = 0
  ORDER BY w.Number, o.Sequence;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.PortalAccount خالی است.
   عمداً: حساب «بسته‌بندی نوین» فعال است ولی هیچ کار جاری ندارد؛ حساب دوم پارس‌دارو غیرفعال مانده (کارمند جداشده).
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.PortalAccount)
BEGIN
  DECLARE @C BIGINT = 222;
  INSERT mes.PortalAccount (CompanyId, UserName, DisplayName, PartyTypeCode, ContractorId, TollingContractId, CanReportProgress, CanViewBalances, CanViewFees, LastLoginAt, IsActive, Description)
  VALUES (@C, N'parsdaru.coating', N'سرپرست روکش — پارس‌دارو', 1, 1, NULL, 1, 1, 1, '2026-10-09 09:38', 1, N'ثبت پیشرفت روزانه'),
         (@C, N'parsdaru.store', N'انباردار — پارس‌دارو', 1, 1, NULL, 0, 1, 0, '2026-08-30 11:02', 0, N'کارمند جداشده — باید حذف شود'),
         (@C, N'novin.pack', N'برنامه‌ریز — بسته‌بندی نوین', 1, 2, NULL, 1, 1, 0, '2026-09-28 15:20', 1, NULL),
         (@C, N'pharmed.scm', N'زنجیره‌ی تأمین — داروسازی فارمد', 2, NULL, (SELECT TOP (1) Id FROM mes.TollingContract WHERE ContractNumber = N'TC-1405-007'), 0, 1, 1, '2026-10-09 08:15', 1, N'مشاهده‌ی پیشرفت، مانده‌ی مواد و صورت‌حساب');
END
GO
