/* =====================================================================
   اسکیمای mes — گام ۲۷: FRM-ME-10 «فعالیت و محرک هزینه‌ی عملیات»

   پیش‌نیاز: mes_frm_me09، فعالیت و محرک هزینه (گام ۱۱ / FRM-RM-09)، خروجی عملیات (گام ME-04).
   این فرم فیچر الزامی ندارد و به درخواست صریح کاربر (۱۷ مهر) مثل RM-09 ساخته شد.

   نسخه‌ی قبل فعالیت‌های عملیات روش را در mfr.RoutingOperationActivity داشت؛ با همان نام و فیلدها آمده است:
     mes.RoutingOperationActivity  همان (Sequence، ActivityId، EquipmentGroupId، EquipmentCategoryId، StandardWorkTime، PersonnelGroupId،
                                   IsMandatory، ActivityPropertyTypeCode، PerPriceCode، MeasureUnitId، StandardCost) + CostDriverId
                                   (محرک هزینه‌ی فعالیت روی عملیات، F-ME-074) و IsValueAdded (ارزش‌افزا/غیرارزش‌افزا، F-ME-076).
                                   ارتباط عملیات با فعالیت‌های RM-COS-001 = F-ME-073؛ در سطح کتابخانه همان mes.ProductionOperationActivity است.
     mes.RoutingOperationOutput    + CostSharePercent — سهم هر خروجی از هزینه‌ی عملیات تولیدکننده (پل به PE-04، F-ME-075)

   فاز: همه‌ی فیچرها «مهم» یا «مطلوب»اند؛ F-ME-073 تا 076 فقط‌خواندنی نمایش داده می‌شوند. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.RoutingOperationActivity','U') IS NULL
CREATE TABLE mes.RoutingOperationActivity (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_RoutingOperationActivity PRIMARY KEY,
  RoutingOperationId BIGINT NOT NULL,
  Sequence INT NOT NULL,
  ActivityId BIGINT NOT NULL,
  EquipmentGroupId BIGINT NULL,
  EquipmentCategoryId BIGINT NULL,
  StandardWorkTime INT NOT NULL CONSTRAINT DF_mes_ROA_Time DEFAULT (0),
  PersonnelGroupId BIGINT NULL,
  IsMandatory BIT NULL,
  Description NVARCHAR(400) NULL,
  ActivityPropertyTypeCode INT NULL,
  PerPriceCode INT NULL,
  MeasureUnitId BIGINT NULL,
  StandardCost DECIMAL(32,2) NULL,
  CostDriverId BIGINT NULL,
  IsValueAdded BIT NULL
);

IF COL_LENGTH('mes.RoutingOperationOutput', 'CostSharePercent') IS NULL
  ALTER TABLE mes.RoutingOperationOutput ADD CostSharePercent DECIMAL(9,4) NULL;
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

CREATE OR ALTER PROCEDURE mes.GetRoutingOperationActivities
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* همه‌ی عملیات روش‌ها (عملیات بدون فعالیت هم یک ردیف خالی دارد) */
  SELECT CAST(o.RoutingId AS INT) AS RoutingId, CAST(o.Id AS INT) AS RoutingOperationId, o.Sequence AS OperationSequence, op.Number + N' — ' + op.Name AS OperationTitle,
         op.OperationTypeCode AS NatureCode, a.Sequence, CAST(pa.Id AS INT) AS ActivityId, pa.Number + N' — ' + pa.Name AS ActivityTitle, pa.ActivityPropertyTypeCode,
         a.StandardWorkTime, a.IsMandatory, a.IsValueAdded, a.StandardCost, a.Description,
         CAST(cd.Id AS INT) AS CostDriverId, cd.Number + N' — ' + cd.Name AS CostDriverTitle, ct.Number + N' — ' + ct.Name AS DriverCapacity, ct.IsCostDriver AS CapacityAllowedAsDriver,
         (SELECT COUNT(*) FROM mes.ProductionOperationActivity la WHERE la.ProductionOperationId = o.OperationId AND la.IsDeleted = 0) AS LibraryActivityCount
  FROM mes.RoutingOperation o
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  LEFT JOIN mes.RoutingOperationActivity a ON a.RoutingOperationId = o.Id AND a.IsDeleted = 0
  LEFT JOIN mes.ProductionActivity pa ON pa.Id = a.ActivityId
  LEFT JOIN mes.CostDriver cd ON cd.Id = a.CostDriverId
  LEFT JOIN mes.CapacityType ct ON ct.Id = cd.CapacityTypeId
  WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0
  ORDER BY o.RoutingId, o.Sequence, a.Sequence;
END
GO

CREATE OR ALTER PROCEDURE mes.GetRoutingOutputCostShares
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(o.RoutingId AS INT) AS RoutingId, CAST(o.Id AS INT) AS RoutingOperationId, o.Sequence, op.Name AS OperationTitle,
         p.Number + N' — ' + p.Name AS ProductTitle, x.ReceiveOutputTypeCode, x.Quantity, p.MeasureUnitTitle AS UnitTitle, x.CostSharePercent
  FROM mes.RoutingOperationOutput x
  JOIN mes.RoutingOperation o ON o.Id = x.RoutingOperationId
  JOIN mes.ProductionOperation op ON op.Id = o.OperationId
  JOIN mes.Product p ON p.Id = x.OuputProductId
  WHERE x.CompanyId = @CompanyId AND x.IsDeleted = 0
  ORDER BY o.RoutingId, o.Sequence, x.ReceiveOutputTypeCode;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی mes.RoutingOperationActivity خالی است.
   فعالیت‌ها از کتابخانه‌ی عملیات (mes.ProductionOperationActivity، RM-09) به روش‌های تأییدشده کپی می‌شوند و محرک هر فعالیت
   از mes.CostDriver همان فعالیت می‌آید. عمداً خراب: «نظافت بین بچ» محرک ندارد (همان خطای RM-09)؛ سهم هزینه‌ی خروجی‌های
   خشک‌کن پیوسته ۹۹٪ است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.RoutingOperationActivity)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  INSERT mes.RoutingOperationActivity (CompanyId, RoutingOperationId, Sequence, ActivityId, StandardWorkTime, IsMandatory, ActivityPropertyTypeCode, CostDriverId, IsValueAdded, Description)
  SELECT @C, o.Id, la.Sequence, la.ActivityId, ISNULL(la.StandardWorkTime, 0), la.IsMandatory, pa.ActivityPropertyTypeCode,
         (SELECT TOP (1) cd.Id FROM mes.CostDriver cd WHERE cd.ActivityId = la.ActivityId AND cd.IsDeleted = 0 AND cd.IsActive = 1 ORDER BY cd.Id),
         CASE WHEN pa.Name LIKE N'%نظافت%' OR pa.Name LIKE N'%بازرسی%' OR pa.Name LIKE N'%جابه‌جایی%' OR pa.Name LIKE N'%انتقال%' OR pa.Name LIKE N'%راه‌اندازی%' OR pa.Name LIKE N'%تعویض%' THEN 0 ELSE 1 END,
         N'از کتابخانه‌ی عملیات'
  FROM mes.RoutingOperation o
  JOIN mes.RoutingMaster r ON r.Id = o.RoutingId AND r.RoutingMasterStatusCode = 3 AND r.IsTemplate = 0
  JOIN mes.ProductionOperationActivity la ON la.ProductionOperationId = o.OperationId AND la.IsDeleted = 0
  JOIN mes.ProductionActivity pa ON pa.Id = la.ActivityId
  WHERE o.CompanyId = @C AND o.IsDeleted = 0;

  UPDATE x SET x.CostSharePercent = v.Share
  FROM mes.RoutingOperationOutput x
  JOIN mes.RoutingOperation o ON o.Id = x.RoutingOperationId
  JOIN mes.RoutingMaster r ON r.Id = o.RoutingId
  JOIN (VALUES (N'RT-2001', 20, 2001, 95.0), (N'RT-2001', 20, 2006, 3.0), (N'RT-2001', 20, 2005, 2.0), (N'RT-2001', 20, 5002, 0.0),
               (N'RT-2001-C', 20, 2001, 96.0), (N'RT-2001-C', 20, 2006, 3.0), (N'RT-2001-C', 20, 2005, 0.0), (N'RT-2001-C', 20, 5002, 0.0), (N'RT-2001-C', 20, 3015, 0.0)
       ) v(Rt, Seq, ProductId, Share) ON v.Rt = r.Number AND v.Seq = o.Sequence AND v.ProductId = x.OuputProductId
  WHERE x.CompanyId = @C;

  COMMIT;
END
GO
