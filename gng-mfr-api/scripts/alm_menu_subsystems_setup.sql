/* =====================================================================
   ALM — منوی زیرسیستم‌های هم‌خانواده‌ی تولید در پیکر «سیستم‌ها»

   پیکر بالای منوی کناری ردیف‌های سطح صفر alm.Menu را نشان می‌دهد؛ تا امروز فقط «مدیریت تولید» (mes) بود.
   این اسکریپت از روی فرم‌های ثبت‌شده در alm.Form برای پنج زیرسیستم منو می‌سازد:
     pps  برنامه‌ریزی تولید          (ALM-DOC-PP، ۱۴ فرم)
     qm   کنترل کیفیت و آزمایشگاه    (ALM-DOC-QC، ۳۰ فرم)
     mc   بهای تمام‌شده‌ی تولید       (ALM-DOC-CO، ۱۳ فرم)
     wm   کنترل موجودی و انبار       (ALM-DOC-WM، ۷۷ فرم)
     nt   نگهداری و تعمیرات ناوگان   (ALM-DOC-NT، ۳۴ فرم — در ALM «مدیریت ناوگان گلرنگ»)
   سطح ۰ = سیستم، سطح ۱ = گروه (بر اساس بازه‌ی شماره و موضوع فرم‌ها)، سطح ۲ = فرم (عنوان، نوع و ترتیب از alm.Form).
   فرم‌های جای‌خالی با عنوان «رزرو» در منو نمی‌آیند. کد ردیف‌ها: سیستم = کد زیرسیستم، گروه = «کد-شماره»، فرم = «M-کد فرم».
   فقط ردیف‌هایی را می‌سازد که نیستند (idempotent).
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @sys TABLE (Sub NVARCHAR(16), Title NVARCHAR(256), Doc NVARCHAR(64), Sort INT);
INSERT @sys VALUES
  (N'pps', N'برنامه‌ریزی تولید', N'ALM-DOC-PP', 20),
  (N'qm',  N'کنترل کیفیت و آزمایشگاه', N'ALM-DOC-QC', 30),
  (N'mc',  N'بهای تمام‌شده‌ی تولید', N'ALM-DOC-CO', 40),
  (N'wm',  N'کنترل موجودی و انبار', N'ALM-DOC-WM', 50),
  (N'nt',  N'نگهداری و تعمیرات ناوگان', N'ALM-DOC-NT', 60);

DECLARE @grp TABLE (Sub NVARCHAR(16), No INT, Title NVARCHAR(256));
INSERT @grp VALUES
  (N'pps', 10, N'پیکربندی و اطلاعات پایه'), (N'pps', 20, N'پیش‌بینی و تقاضا'), (N'pps', 30, N'برنامه‌ریزی تولید و ظرفیت'), (N'pps', 40, N'برنامه‌ریزی مواد'),
  (N'qm', 10, N'پیکربندی و راهبری'), (N'qm', 20, N'اطلاعات پایه‌ی کیفیت'), (N'qm', 30, N'طرح‌های کنترل کیفیت'), (N'qm', 40, N'درخواست بازرسی و آزمایش'),
  (N'qm', 50, N'اجرای بازرسی و آزمایش'), (N'qm', 60, N'کنترل نتایج'),
  (N'mc', 10, N'پیکربندی و روش محاسبه'), (N'mc', 20, N'قیمت استاندارد'), (N'mc', 30, N'هزینه‌یابی سفارش تولید'), (N'mc', 40, N'تسهیم و معادل آحاد'),
  (N'wm', 10, N'پیکربندی و راهبری'), (N'wm', 20, N'کالا و اطلاعات پایه'), (N'wm', 30, N'موجودی و گردش'), (N'wm', 40, N'درخواست و اعلام نیاز'),
  (N'wm', 50, N'خرید'), (N'wm', 60, N'تولید'), (N'wm', 70, N'فروش'), (N'wm', 80, N'قطعات یدکی'), (N'wm', 90, N'عملیات انبار'),
  (N'wm', 95, N'انبارگردانی و کنترل'),
  (N'nt', 10, N'داشبوردها و کارتابل'), (N'nt', 20, N'ناوگان و اطلاعات پایه'), (N'nt', 30, N'بازرسی و سرویس'), (N'nt', 40, N'دستور کار، تعمیرگاه و قطعه'),
  (N'nt', 50, N'هزینه، سوخت، انطباق و حادثه'), (N'nt', 60, N'پیمانکار و پرتال'), (N'nt', 70, N'پیکربندی'), (N'nt', 80, N'اپ‌های همراه');

/* فرم ← گروه */
DECLARE @map TABLE (FormCode NVARCHAR(64), Sub NVARCHAR(16), No INT);
INSERT @map (FormCode, Sub, No)
SELECT f.Code, f.SubSystemCode,
       CASE f.SubSystemCode
         WHEN N'pps' THEN CASE WHEN n IN (0, 1, 2, 3, 4, 13) THEN 10 WHEN n BETWEEN 5 AND 7 THEN 20 WHEN n BETWEEN 8 AND 10 THEN 30 ELSE 40 END
         WHEN N'qm'  THEN CASE WHEN n < 2 THEN 10 WHEN n < 20 THEN 20 WHEN n < 30 THEN 30 WHEN n < 40 THEN 40 WHEN n < 50 THEN 50 ELSE 60 END
         WHEN N'mc'  THEN CASE WHEN n < 20 THEN 10 WHEN n < 30 THEN 20 WHEN n < 40 THEN 30 ELSE 40 END
         WHEN N'wm'  THEN CASE WHEN n IN (0, 1, 6) THEN 10
                               WHEN n IN (2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18) THEN 20
                               WHEN n IN (20, 21, 25, 26, 29, 43, 44, 46, 47) THEN 30
                               WHEN n IN (22, 23, 31, 32, 33, 34, 35, 36, 94) THEN 40
                               WHEN n IN (40, 41, 42, 48) THEN 50
                               WHEN n IN (38, 39, 51, 52, 53, 54) THEN 60
                               WHEN n IN (37, 61, 62, 63) THEN 70
                               WHEN n IN (70, 71, 72) THEN 80
                               WHEN n IN (90, 91, 92, 93, 95) THEN 95
                               ELSE 90 END
         WHEN N'nt'  THEN CASE WHEN n IN (1, 2, 3, 17, 30) THEN 10 WHEN n IN (4, 5, 6, 7, 8) THEN 20 WHEN n BETWEEN 9 AND 15 THEN 30
                               WHEN n IN (16, 19, 20, 22) THEN 40 WHEN n IN (18, 24, 25, 26) THEN 50 WHEN n IN (21, 23) THEN 60
                               WHEN n BETWEEN 27 AND 29 THEN 70 ELSE 80 END
       END
FROM alm.Form f
CROSS APPLY (SELECT TRY_CAST(RIGHT(f.Code, CASE WHEN f.SubSystemCode = N'nt' THEN 2 ELSE 4 END) AS INT) AS n) x
WHERE f.SubSystemCode IN (N'pps', N'qm', N'mc', N'wm', N'nt') AND f.Title NOT LIKE N'رزرو%' AND x.n IS NOT NULL;

DECLARE @creator NVARCHAR(64), @phase NVARCHAR(64);
SELECT @creator = CreatorCode, @phase = PhaseCode FROM alm.Menu WHERE Code = N'450';

/* سطح ۰ — سیستم‌ها؛ «مدیریت تولید» اول بماند */
UPDATE alm.Menu SET SortOrder = 10 WHERE Code = N'4' AND MenuLevel = 0 AND SortOrder IS NULL;

INSERT alm.Menu (Code, Title, ParentCode, SubSystemCode, MenuLevel, AnalysisDocumentCode, FormTypeCode, FormCode, SortOrder, Note, CreatorCode, CreationDate, Guid, PhaseCode)
SELECT s.Sub, s.Title, NULL, s.Sub, 0, s.Doc, NULL, NULL, s.Sort, N'منوی ساخته‌شده از alm.Form (۱۹ مهر ۱۴۰۵)', @creator, GETDATE(), NEWID(), @phase
FROM @sys s WHERE NOT EXISTS (SELECT 1 FROM alm.Menu m WHERE m.Code = s.Sub);

/* سطح ۱ — گروه‌ها (فقط گروهی که فرم دارد) */
INSERT alm.Menu (Code, Title, ParentCode, SubSystemCode, MenuLevel, AnalysisDocumentCode, FormTypeCode, FormCode, SortOrder, Note, CreatorCode, CreationDate, Guid, PhaseCode)
SELECT g.Sub + N'-' + CAST(g.No AS NVARCHAR(4)), g.Title, g.Sub, g.Sub, 1, s.Doc, NULL, NULL, g.No, NULL, @creator, GETDATE(), NEWID(), @phase
FROM @grp g JOIN @sys s ON s.Sub = g.Sub
WHERE EXISTS (SELECT 1 FROM @map m WHERE m.Sub = g.Sub AND m.No = g.No)
  AND NOT EXISTS (SELECT 1 FROM alm.Menu m WHERE m.Code = g.Sub + N'-' + CAST(g.No AS NVARCHAR(4)));

/* سطح ۲ — فرم‌ها */
INSERT alm.Menu (Code, Title, ParentCode, SubSystemCode, MenuLevel, AnalysisDocumentCode, FormTypeCode, FormCode, SortOrder, Note, CreatorCode, CreationDate, Guid, PhaseCode)
SELECT N'M-' + f.Code, f.Title, m.Sub + N'-' + CAST(m.No AS NVARCHAR(4)), m.Sub, 2, f.AnalysisDocumentCode, f.FormTypeCode, f.Code, f.SortOrder, NULL,
       @creator, GETDATE(), NEWID(), @phase
FROM @map m JOIN alm.Form f ON f.Code = m.FormCode
WHERE NOT EXISTS (SELECT 1 FROM alm.Menu x WHERE x.Code = N'M-' + f.Code);

COMMIT;

SELECT SubSystemCode, MenuLevel, COUNT(*) AS Rows FROM alm.Menu WHERE SubSystemCode IN (N'pps', N'qm', N'mc', N'wm', N'nt') GROUP BY SubSystemCode, MenuLevel ORDER BY 1, 2;
