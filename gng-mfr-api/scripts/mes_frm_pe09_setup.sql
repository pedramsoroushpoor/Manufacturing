/* =====================================================================
   اسکیمای mes — گام ۱۷: FRM-PE-09 «مدیریت تغییر مهندسی (ECO)»

   پیش‌نیاز: گام‌های قبل تا mes_frm_pe08 (تحلیل اثر روی mes.GetWhereUsed).
   یادداشت ALM: «ثبت و تأیید در یک فرم با دو مجوز مجزا».

   نسخه‌ی قبل ECO نداشت (فقط ApproverPartyId روی نسخه‌ی ساختار)؛ همه جدیدند:
     mes.EngineeringChangeOrder              درخواست تغییر با منشأ (F-PE-069)، تاریخ اثر و سیاست موجودی موجود (F-PE-071)
     mes.EngineeringChangeOrderItem          دامنه‌ی چندموجودیتی: ساختار، کالا، گروه جایگزین، الگو (F-PE-069)
     mes.EngineeringChangeOrderApproval      امضای الکترونیک تأییدکنندگان با احراز مجدد (F-PE-074)
     mes.EngineeringChangeOrderNotification  اطلاع‌رسانی به واحدهای متأثر (F-PE-073)
   شماره‌ی ECO همان است که در mes.ProductStructureRevision.EcoNumber (گام ۱۰) ثبت می‌شود.
   تحلیل اثر (F-PE-070) با mes.GetEcoImpact حساب می‌شود: محصولات بالادستیِ هر موجودیتِ دامنه با کاربرد معکوس
   چندسطحی. سفارش‌های باز، موجودی کنارگذاشته و درخواست خرید باز به سیستم‌هایی نیاز دارند که هنوز وصل نیستند.

   فرض‌ها و کدهای موقت:
     OriginCode           1 = کیفیت، 2 = تأمین، 3 = بهبود، 4 = الزام قانونی، 5 = مشتری
     StatusCode           1 = پیش‌نویس، 2 = تحلیل اثر، 3 = در انتظار تأیید، 4 = تأییدشده، 5 = اجراشده، 6 = ردشده
     InventoryPolicyCode  1 = مصرف تا اتمام، 2 = کنارگذاری، 3 = اختلاط با شرط
     EntityTypeCode       1 = ساختار، 2 = کالا، 3 = گروه جایگزین، 4 = الگو
     ChangeTypeCode       1 = افزودن، 2 = حذف، 3 = تغییر مقدار/ویژگی، 4 = جایگزینی
     DecisionCode         خالی = منتظر، 1 = تأیید، 2 = رد

   فاز اول: F-PE-069، 070، 071، 073، 074 نمایش داده می‌شوند (ثبت، امضا و ارسال واقعی اقدام نوشتنی‌اند).
   فعال‌سازی اتمیک در تاریخ اثر (072) «مهم» است. این اسکریپت idempotent است.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('mes.EngineeringChangeOrder','U') IS NULL
CREATE TABLE mes.EngineeringChangeOrder (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_EngineeringChangeOrder PRIMARY KEY,
  Number NVARCHAR(64) NOT NULL,
  Title NVARCHAR(256) NOT NULL,
  OriginCode INT NOT NULL CONSTRAINT CK_mes_EngineeringChangeOrder_Origin CHECK (OriginCode IN (1, 2, 3, 4, 5)),
  PriorityCode INT NOT NULL CONSTRAINT DF_mes_EngineeringChangeOrder_Priority DEFAULT (1),
  StatusCode INT NOT NULL CONSTRAINT DF_mes_EngineeringChangeOrder_Status DEFAULT (1)
    CONSTRAINT CK_mes_EngineeringChangeOrder_Status CHECK (StatusCode IN (1, 2, 3, 4, 5, 6)),
  RequestedByTitle NVARCHAR(256) NULL,
  RequestDate DATE NOT NULL,
  EffectiveDate DATE NULL,
  InventoryPolicyCode INT NULL CONSTRAINT CK_mes_EngineeringChangeOrder_Inventory CHECK (InventoryPolicyCode IN (1, 2, 3)),
  InventoryPolicyCondition NVARCHAR(400) NULL,
  Reason NVARCHAR(400) NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.EngineeringChangeOrderItem','U') IS NULL
CREATE TABLE mes.EngineeringChangeOrderItem (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_EngineeringChangeOrderItem PRIMARY KEY,
  EngineeringChangeOrderId BIGINT NOT NULL,
  EntityTypeCode INT NOT NULL CONSTRAINT CK_mes_EngineeringChangeOrderItem_Entity CHECK (EntityTypeCode IN (1, 2, 3, 4)),
  ProductStructureId BIGINT NULL,
  ProductId BIGINT NULL,
  SubstituteGroupId BIGINT NULL,
  ChangeTypeCode INT NOT NULL,
  BeforeText NVARCHAR(400) NULL,
  AfterText NVARCHAR(400) NULL,
  Description NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.EngineeringChangeOrderApproval','U') IS NULL
CREATE TABLE mes.EngineeringChangeOrderApproval (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_EngineeringChangeOrderApproval PRIMARY KEY,
  EngineeringChangeOrderId BIGINT NOT NULL,
  Sequence INT NOT NULL,
  RoleTitle NVARCHAR(128) NOT NULL,
  ApproverPartyId BIGINT NULL,
  ApproverTitle NVARCHAR(256) NULL,
  DecisionCode INT NULL,
  SignedOn DATETIME NULL,
  SignatureMethod NVARCHAR(128) NULL,
  Comment NVARCHAR(400) NULL
);

IF OBJECT_ID('mes.EngineeringChangeOrderNotification','U') IS NULL
CREATE TABLE mes.EngineeringChangeOrderNotification (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mes_EngineeringChangeOrderNotification PRIMARY KEY,
  EngineeringChangeOrderId BIGINT NOT NULL,
  UnitTitle NVARCHAR(128) NOT NULL,
  StatusCode INT NOT NULL CONSTRAINT DF_mes_EngineeringChangeOrderNotification_Status DEFAULT (1),
  SentOn DATETIME NULL,
  Message NVARCHAR(400) NULL
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

CREATE OR ALTER PROCEDURE mes.GetEcos
  @CompanyId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(e.Id AS INT) AS EcoId, e.Number, e.Title, e.OriginCode, e.PriorityCode, e.StatusCode, e.RequestedByTitle, e.RequestDate, e.EffectiveDate,
         e.InventoryPolicyCode, e.InventoryPolicyCondition, e.Reason, e.Description,
         (SELECT COUNT(*) FROM mes.EngineeringChangeOrderItem i WHERE i.EngineeringChangeOrderId = e.Id AND i.IsDeleted = 0) AS ItemCount,
         (SELECT COUNT(*) FROM mes.EngineeringChangeOrderApproval a WHERE a.EngineeringChangeOrderId = e.Id AND a.IsDeleted = 0) AS ApproverCount,
         (SELECT COUNT(*) FROM mes.EngineeringChangeOrderApproval a WHERE a.EngineeringChangeOrderId = e.Id AND a.IsDeleted = 0 AND a.DecisionCode = 1) AS SignedCount,
         (SELECT STRING_AGG(r.Number + N'/' + s.Number, N'، ') FROM mes.ProductStructureRevision r2
          JOIN mes.ProductionRevision r ON r.Id = r2.RevisionId JOIN mes.ProductStructure s ON s.Id = r2.ProductStructureId
          WHERE r2.EcoNumber = e.Number AND r2.IsDeleted = 0) AS LinkedRevisions
  FROM mes.EngineeringChangeOrder e
  WHERE e.CompanyId = @CompanyId AND e.IsDeleted = 0
  ORDER BY e.RequestDate DESC;
END
GO

CREATE OR ALTER PROCEDURE mes.GetEcoDetail
  @EcoId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* سه مجموعه‌ی نتیجه: دامنه، تأییدها، اطلاع‌رسانی‌ها */
  SELECT i.EntityTypeCode, i.ChangeTypeCode,
         COALESCE(s.Number + N' — ' + s.Name, p.Number + N' — ' + p.Name, g.Number + N' — ' + g.Name) AS EntityTitle,
         i.BeforeText, i.AfterText, i.Description
  FROM mes.EngineeringChangeOrderItem i
  LEFT JOIN mes.ProductStructure s ON s.Id = i.ProductStructureId
  LEFT JOIN mes.Product p ON p.Id = i.ProductId
  LEFT JOIN mes.SubstituteGroup g ON g.Id = i.SubstituteGroupId
  WHERE i.EngineeringChangeOrderId = @EcoId AND i.IsDeleted = 0
  ORDER BY i.Id;

  SELECT a.Sequence, a.RoleTitle, a.ApproverTitle, a.DecisionCode, a.SignedOn, a.SignatureMethod, a.Comment
  FROM mes.EngineeringChangeOrderApproval a
  WHERE a.EngineeringChangeOrderId = @EcoId AND a.IsDeleted = 0
  ORDER BY a.Sequence;

  SELECT n.UnitTitle, n.StatusCode, n.SentOn, n.Message
  FROM mes.EngineeringChangeOrderNotification n
  WHERE n.EngineeringChangeOrderId = @EcoId AND n.IsDeleted = 0
  ORDER BY n.Id;
END
GO

CREATE OR ALTER PROCEDURE mes.GetEcoImpact
  @EcoId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  /* کالاهای مستقیماً متأثر: کالای دامنه، محصول اصلی ساختار دامنه، و اقلام اصلی گروه جایگزین دامنه.
     سپس کاربرد معکوس چندسطحی هر کدام (mes.GetWhereUsed). */
  SELECT DISTINCT x.ProductId
  INTO #direct
  FROM (
    SELECT i.ProductId FROM mes.EngineeringChangeOrderItem i WHERE i.EngineeringChangeOrderId = @EcoId AND i.IsDeleted = 0 AND i.ProductId IS NOT NULL
    UNION ALL
    SELECT m.ProductId FROM mes.EngineeringChangeOrderItem i
    JOIN mes.ProductStructureMaster m ON m.ProductStructureId = i.ProductStructureId AND m.IsMainProduct = 1 AND m.IsDeleted = 0
    WHERE i.EngineeringChangeOrderId = @EcoId AND i.IsDeleted = 0
    UNION ALL
    SELECT mb.ProductId FROM mes.EngineeringChangeOrderItem i
    JOIN mes.SubstituteGroupOption o ON o.SubstituteGroupId = i.SubstituteGroupId AND o.OptionNo = 0 AND o.IsDeleted = 0
    JOIN mes.SubstituteGroupMember mb ON mb.SubstituteGroupOptionId = o.Id AND mb.IsDeleted = 0
    WHERE i.EngineeringChangeOrderId = @EcoId AND i.IsDeleted = 0
  ) x;

  CREATE TABLE #wu (Level INT, SearchedCode NVARCHAR(64), SearchedTitle NVARCHAR(256), StructureCode NVARCHAR(64), StructureTitle NVARCHAR(256),
                    TypeCode INT, IsDefault BIT, MainProductCode NVARCHAR(64), MainProductTitle NVARCHAR(256), Revisions NVARCHAR(400),
                    InCurrent BIT, ViaTemplate BIT);
  DECLARE @p BIGINT;
  DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT ProductId FROM #direct;
  OPEN cur; FETCH NEXT FROM cur INTO @p;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    INSERT #wu EXEC mes.GetWhereUsed @ProductId = @p, @MultiLevel = 1;
    FETCH NEXT FROM cur INTO @p;
  END
  CLOSE cur; DEALLOCATE cur;

  SELECT 'direct' AS ImpactKind, 0 AS Level, p.Number AS ProductCode, p.Name AS ProductTitle, CAST(NULL AS NVARCHAR(64)) AS StructureCode,
         CAST(NULL AS NVARCHAR(256)) AS StructureTitle, CAST(NULL AS BIT) AS InCurrent
  FROM #direct d JOIN mes.Product p ON p.Id = d.ProductId
  UNION ALL
  /* یک ردیف به‌ازای هر ساختار متأثر، با کوتاه‌ترین فاصله از تغییر */
  SELECT 'upstream', MIN(w.Level), w.MainProductCode, w.MainProductTitle, w.StructureCode, w.StructureTitle, CAST(MAX(CAST(w.InCurrent AS INT)) AS BIT)
  FROM #wu w
  GROUP BY w.MainProductCode, w.MainProductTitle, w.StructureCode, w.StructureTitle
  ORDER BY 1, 2, 3;
END
GO

/* -------------------------------------------------------------------
   داده‌ی نمونه — فقط وقتی جدول ECO خالی است.
   ECO-1405-0071 و 0088 همان شماره‌های ثبت‌شده روی نسخه‌های ساختار در گام ۱۰اند.
   عمداً باز: ECO-1405-0102 (قطع واردات پوویدون K30) امضای مدیر فنی را ندارد و اطلاع‌رسانی‌اش در صف است.
   ------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM mes.EngineeringChangeOrder)
BEGIN
  BEGIN TRAN;
  DECLARE @C BIGINT = 222;

  INSERT mes.EngineeringChangeOrder (CompanyId, Number, Title, OriginCode, PriorityCode, StatusCode, RequestedByTitle, RequestDate, EffectiveDate,
                                     InventoryPolicyCode, InventoryPolicyCondition, Reason)
  VALUES
    (@C, N'ECO-1405-0071', N'بهینه‌سازی روان‌کننده و متلاشی‌کننده‌ی قرص ۵۰۰',     3, 1, 5, N'مهندسی محصول', '2026-02-20', '2026-03-21', 1, NULL,
         N'زمان متلاشی‌شدن بالای حد هشدار در سه بچ متوالی'),
    (@C, N'ECO-1405-0088', N'روکش ضخیم‌تر قرص روکش‌دار',                       1, 1, 5, N'کنترل کیفیت',  '2026-05-02', '2026-05-22', 2, NULL,
         N'شکایت مشتری از ترک روکش در شرایط رطوبت بالا'),
    (@C, N'ECO-1405-0102', N'جایگزینی پوویدون K30 با K25',                       2, 2, 3, N'تأمین',        '2026-09-28', '2026-11-01', 3,
         N'اختلاط فقط در بچ‌های هم‌زمان تا اتمام موجودی K30؛ نسبت ۱ به ۱٫۱', N'قطع واردات K30 از تأمین‌کننده‌ی اصلی'),
    (@C, N'ECO-1405-0109', N'متن جدید بروشور طبق دستورالعمل سازمان غذا و دارو', 4, 1, 2, N'امور دارویی',   '2026-10-05', NULL, NULL, NULL,
         N'ابلاغیه‌ی تغییر متن عوارض جانبی');

  INSERT mes.EngineeringChangeOrderItem (CompanyId, EngineeringChangeOrderId, EntityTypeCode, ProductStructureId, ProductId, SubstituteGroupId,
                                         ChangeTypeCode, BeforeText, AfterText, Description)
  SELECT @C, e.Id, v.Entity, s.Id, v.ProductId, g.Id, v.ChangeType, v.Before, v.After, v.Description
  FROM (VALUES
    (N'ECO-1405-0071', 1, N'BOM-1001-A', NULL, NULL, 3, N'کراس‌کارملوز ۲٫۷ kg؛ منیزیم استئارات ۱٫۸ kg', N'کراس‌کارملوز ۳ kg؛ منیزیم استئارات ۱٫۵ kg', N'نسخه‌ی v2'),
    (N'ECO-1405-0071', 1, N'BOM-1001-A', NULL, NULL, 1, NULL, N'بروشور ۱۰٬۰۰۰ عدد', NULL),
    (N'ECO-1405-0088', 1, N'BOM-1002',   NULL, NULL, 3, N'محلول روکش ۳۰ kg', N'محلول روکش ۳۲ kg', N'از بچ B-1405-0120'),
    (N'ECO-1405-0102', 1, N'BOM-2001',   NULL, NULL, 4, N'پوویدون K30 ۳٪', N'پوویدون K25 ۳٫۳٪', NULL),
    (N'ECO-1405-0102', 3, NULL,          NULL, N'SG-BIND', 3, N'اصلی: K30', N'اصلی: K25؛ K30 فقط تا اتمام موجودی', NULL),
    (N'ECO-1405-0102', 2, NULL,          3006, NULL, 3, N'فعال', N'غیرفعال پس از اتمام موجودی', NULL),
    (N'ECO-1405-0109', 2, NULL,          4005, NULL, 3, N'متن نسخه‌ی ۱۴۰۳', N'متن ابلاغیه‌ی ۱۴۰۵', NULL)
  ) v(EcoNo, Entity, StructNo, ProductId, GroupNo, ChangeType, Before, After, Description)
  JOIN mes.EngineeringChangeOrder e ON e.Number = v.EcoNo
  LEFT JOIN mes.ProductStructure s ON s.Number = v.StructNo
  LEFT JOIN mes.SubstituteGroup g ON g.Number = v.GroupNo;

  INSERT mes.EngineeringChangeOrderApproval (CompanyId, EngineeringChangeOrderId, Sequence, RoleTitle, ApproverTitle, DecisionCode, SignedOn, SignatureMethod, Comment)
  SELECT @C, e.Id, v.Seq, v.Role, v.Approver, v.Decision, v.SignedOn, v.Method, v.Comment
  FROM (VALUES
    (N'ECO-1405-0071', 1, N'کنترل کیفیت (QCU)', N'سرپرست کنترل کیفیت',      1,    CAST('2026-03-08 10:12' AS DATETIME), N'احراز مجدد با رمز', NULL),
    (N'ECO-1405-0071', 2, N'مدیر فنی (MGR)',    N'دکتر نوروزی — مدیر فنی',  1,    '2026-03-10 09:40', N'احراز مجدد با رمز', NULL),
    (N'ECO-1405-0088', 1, N'کنترل کیفیت (QCU)', N'سرپرست کنترل کیفیت',      1,    '2026-05-18 14:05', N'احراز مجدد با رمز', NULL),
    (N'ECO-1405-0088', 2, N'مدیر فنی (MGR)',    N'دکتر نوروزی — مدیر فنی',  1,    '2026-05-20 11:30', N'احراز مجدد با رمز', NULL),
    (N'ECO-1405-0102', 1, N'کنترل کیفیت (QCU)', N'سرپرست کنترل کیفیت',      1,    '2026-10-04 13:20', N'احراز مجدد با رمز', N'نتایج سه بچ آزمایشی با K25 قابل قبول'),
    (N'ECO-1405-0102', 2, N'مدیر فنی (MGR)',    N'دکتر نوروزی — مدیر فنی',  NULL, NULL,               NULL,                NULL)
  ) v(EcoNo, Seq, Role, Approver, Decision, SignedOn, Method, Comment)
  JOIN mes.EngineeringChangeOrder e ON e.Number = v.EcoNo;

  INSERT mes.EngineeringChangeOrderNotification (CompanyId, EngineeringChangeOrderId, UnitTitle, StatusCode, SentOn, Message)
  SELECT @C, e.Id, u.Unit, CASE WHEN e.StatusCode >= 4 THEN 2 ELSE 1 END, CASE WHEN e.StatusCode >= 4 THEN DATEADD(HOUR, 1, CAST(e.EffectiveDate AS DATETIME)) END,
         N'تغییر ' + e.Number + N' از ' + ISNULL(FORMAT(e.EffectiveDate, 'yyyy-MM-dd'), N'—') + N' اثر دارد'
  FROM mes.EngineeringChangeOrder e
  CROSS JOIN (VALUES (N'تولید'), (N'انبار'), (N'خرید'), (N'کنترل کیفیت')) u(Unit)
  WHERE e.StatusCode >= 3;

  COMMIT;
END
GO
