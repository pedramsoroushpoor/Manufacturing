/* =====================================================================
   اسکیمای mes — گام ۱۲: FRM-PE-03 «گروه جایگزین و سیاست جایگزینی»

   پیش‌نیاز: گام‌های قبل تا mes_frm_rm09 (ساختار محصول از گام ۱۰).
   یادداشت ALM: «رفع محدودیت یک‌به‌یک نسخه‌ی جاری».

   نسخه‌ی قبل جایگزین را در mfr.ProductStructureItemSub نگه می‌داشت: یک کالا ← یک جایگزین، در سطح کالا.
   این جدول عمداً بازسازی نمی‌شود، چون همان محدودیتی است که ALM خواسته برداشته شود. به‌جایش:
     mes.SubstituteGroup         جدید — گروه جایگزین، موجودیت مستقل و قابل استفاده در چند ساختار (F-PE-027)؛
                                 IsCombinable = سیاست ترکیبی/غیرترکیبی (F-PE-030)
     mes.SubstituteGroupOption   جدید — گزینه‌های گروه: گزینه‌ی صفر = اقلام اصلی، بقیه جایگزین‌ها با اولویت (F-PE-029)
     mes.SubstituteGroupMember   جدید — اقلام هر گزینه با نسبت تبدیل؛ چند قلم در هر گزینه = جایگزینی چند به چند (F-PE-028)
     mes.ProductStructureItem    + SubstituteGroupId — ردیف ساختار به گروه وصل می‌شود
   فیلدهای قدیم ItemSubPriorityCode و Quantity (نسبت) در Priority و Quantity همین مدل آمده‌اند.

   قواعد کنترلی (فقط هشدار): کالای ردیف ساختار باید در اقلام اصلی گروه باشد؛ دو گزینه‌ی هم‌اولویت در یک گروه؛
   گروه بدون استفاده.
   فاز اول: F-PE-027 تا 030 (الزامی). پیشنهاد خودکار بر مبنای موجودی (031)، درصد مجاز جایگزینی (032) و الزام
   تأیید کیفی (033) اولویت «مهم» دارند و نیامده‌اند. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.SubstituteGroup','U') IS NULL
CREATE TABLE mes.SubstituteGroup (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_SubstituteGroup PRIMARY KEY,
  Number NVARCHAR(64) NULL,
  Name NVARCHAR(256) NOT NULL,
  IsCombinable BIT NOT NULL CONSTRAINT DF_mes_SubstituteGroup_IsCombinable DEFAULT (0),
  IsActive BIT NOT NULL CONSTRAINT DF_mes_SubstituteGroup_IsActive DEFAULT (1),
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.SubstituteGroupOption','U') IS NULL
CREATE TABLE mes.SubstituteGroupOption (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_SubstituteGroupOption PRIMARY KEY,
  SubstituteGroupId BIGINT NOT NULL,
  OptionNo INT NOT NULL,
  Name NVARCHAR(256) NULL,
  Priority INT NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.SubstituteGroupMember','U') IS NULL
CREATE TABLE mes.SubstituteGroupMember (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_SubstituteGroupMember PRIMARY KEY,
  SubstituteGroupOptionId BIGINT NOT NULL,
  ProductId BIGINT NOT NULL,
  Quantity DECIMAL(32,6) NOT NULL,
  Description NVARCHAR(400) NULL
);

IF COL_LENGTH('mes.ProductStructureItem', 'SubstituteGroupId') IS NULL
  ALTER TABLE mes.ProductStructureItem ADD SubstituteGroupId BIGINT NULL;
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

CREATE OR ALTER PROCEDURE mes.GetSubstituteGroups
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(g.Id AS INT) AS GroupId, g.Number AS Code, g.Name AS Title, g.IsCombinable, g.IsActive, g.Description,
         (SELECT COUNT(*) FROM mes.SubstituteGroupOption o WHERE o.SubstituteGroupId = g.Id AND o.IsDeleted = 0 AND o.OptionNo > 0) AS SubstituteOptionCount,
         (SELECT COUNT(DISTINCT i.ProductStructureId) FROM mes.ProductStructureItem i WHERE i.SubstituteGroupId = g.Id AND i.IsDeleted = 0) AS StructureCount,
         (SELECT COUNT(*) FROM (SELECT o.Priority FROM mes.SubstituteGroupOption o
                                WHERE o.SubstituteGroupId = g.Id AND o.IsDeleted = 0 AND o.OptionNo > 0
                                GROUP BY o.Priority HAVING COUNT(*) > 1) d) AS DuplicatePriorities,
         (SELECT STRING_AGG(p.Name, N' + ') FROM mes.SubstituteGroupOption o
          JOIN mes.SubstituteGroupMember m ON m.SubstituteGroupOptionId = o.Id AND m.IsDeleted = 0
          JOIN mes.Product p ON p.Id = m.ProductId
          WHERE o.SubstituteGroupId = g.Id AND o.OptionNo = 0 AND o.IsDeleted = 0) AS OriginalItems
  FROM mes.SubstituteGroup g
  WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0
  ORDER BY g.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetSubstituteGroupOptions
  @CompanyId BIGINT, @GroupId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  /* یک ردیف به‌ازای هر «گزینه × قلم». گزینه‌ی صفر اقلام اصلی است. */
  SELECT CAST(g.Id AS INT) AS GroupId, g.Number AS GroupCode, g.Name AS GroupTitle,
         CAST(o.Id AS INT) AS OptionId, o.OptionNo, o.Name AS OptionTitle, o.Priority,
         CAST(p.Id AS INT) AS ProductId, p.Number AS ProductCode, p.Name AS ProductTitle, p.MeasureUnitTitle AS UnitTitle,
         CAST(m.Quantity AS DECIMAL(18,4)) AS Quantity,
         CAST(CASE WHEN pi.Id IS NULL THEN 0 ELSE 1 END AS BIT) AS HasRole,
         o.Description AS OptionDescription
  FROM mes.SubstituteGroup g
  JOIN mes.SubstituteGroupOption o ON o.SubstituteGroupId = g.Id AND o.IsDeleted = 0
  JOIN mes.SubstituteGroupMember m ON m.SubstituteGroupOptionId = o.Id AND m.IsDeleted = 0
  JOIN mes.Product p ON p.Id = m.ProductId
  LEFT JOIN mes.ProductionItem pi ON pi.ProductId = p.Id AND pi.IsDeleted = 0
  WHERE g.CompanyId = @CompanyId AND g.IsDeleted = 0 AND (@GroupId IS NULL OR g.Id = @GroupId)
  ORDER BY g.Number, o.OptionNo, p.Number;
END
GO

CREATE OR ALTER PROCEDURE mes.GetSubstituteGroupUsage
  @CompanyId BIGINT, @GroupId BIGINT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  /* ردیف‌های ساختار که به گروه وصل‌اند. IsConsistent = کالای ردیف در اقلام اصلی گروه هست. */
  SELECT CAST(g.Id AS INT) AS GroupId, g.Number AS GroupCode,
         s.Number AS StructureCode, s.Name AS StructureTitle, r.Number AS RevisionCode,
         CAST(CASE WHEN s.RevisionId = i.RevisionId THEN 1 ELSE 0 END AS BIT) AS IsCurrentRevision,
         i.Sequence, p.Number AS ProductCode, p.Name AS ProductTitle,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM mes.SubstituteGroupOption o
                                JOIN mes.SubstituteGroupMember m ON m.SubstituteGroupOptionId = o.Id AND m.IsDeleted = 0
                                WHERE o.SubstituteGroupId = g.Id AND o.OptionNo = 0 AND o.IsDeleted = 0 AND m.ProductId = i.ProductId)
                   THEN 1 ELSE 0 END AS BIT) AS IsConsistent
  FROM mes.ProductStructureItem i
  JOIN mes.SubstituteGroup g ON g.Id = i.SubstituteGroupId AND g.IsDeleted = 0
  JOIN mes.ProductStructure s ON s.Id = i.ProductStructureId AND s.IsDeleted = 0
  LEFT JOIN mes.ProductionRevision r ON r.Id = i.RevisionId
  JOIN mes.Product p ON p.Id = i.ProductId
  WHERE i.IsDeleted = 0 AND g.CompanyId = @CompanyId AND (@GroupId IS NULL OR g.Id = @GroupId)
  ORDER BY g.Number, s.Number, i.Sequence;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی جدول گروه خالی است.
   عمداً خراب: گروه «متلاشی‌کننده» دو گزینه‌ی هم‌اولویت دارد؛ ردیف منیزیم استئارات در BOM-1001-A به گروه
   «پرکننده» وصل شده که منیزیم استئارات در اقلام اصلی‌اش نیست؛ گروه «روان‌کننده» هیچ‌جا استفاده نشده.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.SubstituteGroup)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  INSERT mes.Product (CompanyId, Id, Number, Name, MeasureUnitTitle, ProductGroupTitle)
  SELECT @C, v.Id, v.Number, v.Name, N'kg', N'مواد جانبی'
  FROM (VALUES (3011, N'P-3011', N'مانیتول'), (3012, N'P-3012', N'سلولز میکروکریستالی'), (3013, N'P-3013', N'پوویدون K25'),
               (3014, N'P-3014', N'سدیم استارچ گلیکولات'), (3020, N'P-3020', N'سدیم استئاریل فومارات')) v(Id, Number, Name)
  WHERE NOT EXISTS (SELECT 1 FROM mes.Product p WHERE p.Id = v.Id);
  INSERT mes.ProductionItem (CompanyId, ProductId, ProductionRoleCode, TrackingLevelCode, IsTrackingMandatory)
  SELECT @C, v.Id, 3, 1, 1 FROM (VALUES (3011), (3012), (3013), (3014)) v(Id)
  WHERE NOT EXISTS (SELECT 1 FROM mes.ProductionItem i WHERE i.ProductId = v.Id);
  /* P-3020 عمداً بدون نقش تولیدی */

  INSERT mes.SubstituteGroup (CompanyId, Number, Name, IsCombinable, Description) VALUES
    (@C, N'SG-FILL', N'پرکننده‌های قرص',  0, N'هر بچ فقط با یک گزینه'),
    (@C, N'SG-BIND', N'چسباننده',         1, N'ترکیب K30 و K25 در یک بچ مجاز است'),
    (@C, N'SG-DIS',  N'متلاشی‌کننده',     0, NULL),
    (@C, N'SG-LUB',  N'روان‌کننده',       0, NULL);

  INSERT mes.SubstituteGroupOption (CompanyId, SubstituteGroupId, OptionNo, Name, Priority, Description)
  SELECT @C, g.Id, v.OptionNo, v.Name, v.Priority, v.Description
  FROM (VALUES
    (N'SG-FILL', 0, N'اصلی', NULL, NULL), (N'SG-FILL', 1, N'مانیتول', 1, N'برای بیماران حساس به لاکتوز'), (N'SG-FILL', 2, N'نشاسته + MCC', 2, N'دو قلم به‌جای یک قلم'),
    (N'SG-BIND', 0, N'اصلی', NULL, NULL), (N'SG-BIND', 1, N'پوویدون K25', 1, N'ویسکوزیته‌ی کمتر — مقدار بیشتر'),
    (N'SG-DIS',  0, N'اصلی', NULL, NULL), (N'SG-DIS', 1, N'سدیم استارچ گلیکولات', 1, NULL), (N'SG-DIS', 2, N'نشاسته', 1, N'هم‌اولویت با گزینه‌ی ۱'),
    (N'SG-LUB',  0, N'اصلی', NULL, NULL), (N'SG-LUB', 1, N'سدیم استئاریل فومارات', 1, NULL)
  ) v(GroupNo, OptionNo, Name, Priority, Description)
  JOIN mes.SubstituteGroup g ON g.Number = v.GroupNo;

  INSERT mes.SubstituteGroupMember (CompanyId, SubstituteGroupOptionId, ProductId, Quantity)
  SELECT @C, o.Id, v.ProductId, v.Qty
  FROM (VALUES
    (N'SG-FILL', 0, 3002, 1.0), (N'SG-FILL', 1, 3011, 1.05), (N'SG-FILL', 2, 3005, 0.5), (N'SG-FILL', 2, 3012, 0.5),
    (N'SG-BIND', 0, 3006, 1.0), (N'SG-BIND', 1, 3013, 1.1),
    (N'SG-DIS',  0, 3008, 1.0), (N'SG-DIS', 1, 3014, 1.3), (N'SG-DIS', 2, 3005, 2.0),
    (N'SG-LUB',  0, 3003, 1.0), (N'SG-LUB', 1, 3020, 1.2)
  ) v(GroupNo, OptionNo, ProductId, Qty)
  JOIN mes.SubstituteGroup g ON g.Number = v.GroupNo
  JOIN mes.SubstituteGroupOption o ON o.SubstituteGroupId = g.Id AND o.OptionNo = v.OptionNo;

  /* اتصال ردیف‌های نسخه‌ی جاری ساختارها به گروه‌ها */
  UPDATE i SET i.SubstituteGroupId = g.Id
  FROM mes.ProductStructureItem i
  JOIN mes.ProductStructure s ON s.Id = i.ProductStructureId AND s.RevisionId = i.RevisionId
  JOIN (VALUES (N'BOM-2001', 3002, N'SG-FILL'), (N'BOM-2001', 3006, N'SG-BIND'), (N'BOM-1001-A', 3008, N'SG-DIS'),
               (N'BOM-1001-B', 3008, N'SG-DIS'), (N'BOM-1001-A', 3003, N'SG-FILL')) v(StructNo, ProductId, GroupNo)
    ON v.StructNo = s.Number AND v.ProductId = i.ProductId
  JOIN mes.SubstituteGroup g ON g.Number = v.GroupNo;

  COMMIT;
END
GO
