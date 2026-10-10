# سیستم تولید پلاس (Manufacturing GNG+) — مستند کامل پروژه

> **وضعیت این سند:** آنچه تا ۱۸ مهر ۱۴۰۵ (2026-10-09) ساخته و روی دیتابیس لوکال اجرا شده است. ۱۷ مهر: FRM-RM-09 به‌عنوان استثنای فاز اول به درخواست کاربر، و یک‌جا بقیه‌ی فرم‌های مهندسی محصول با فیچر الزامی (PE-03، 04، 05، 06، 08، 09). شب ۱۷ مهر: کل حوزه‌ی مهندسی تولید (ME-01 تا ME-10) و PE-07 — سه حوزه‌ی RM، PE و ME در فاز اول کامل شدند. این شش فرم و RM-09 همان روز در مرورگر روی API اصلی آزموده شدند (بنر خطاهای عمدی، جدول‌ها، پنل کناری و منبع داده‌ی زنده). ۱۸ مهر: کل حوزه‌ی **کنترل تولید (PC-01 تا PC-12)** روی جدول‌های اجرای قدیم (WorkOrder*) با یک سناریوی یکپارچه‌ی یک روز کارخانه — به خواست کاربر فقط‌خواندنی ولی پرامکانات، چون درستی نشستن روی دیتابیس قدیم در این بخش اجرایی مهم‌ترین است.
> نسخه‌ی اول تا ۱۲ مهر را پوشش می‌داد؛ در ۱۵ مهر با دیتابیس واقعی مقایسه و تأیید شد و FRM-RM-06، FRM-RM-07، FRM-RM-08 و FRM-PE-01 به آن اضافه شدند؛ ۱۶ مهر FRM-PE-02 (نسخه‌ی اول — قرار است در چند دور بهتر شود).

---

## ۱. پروژه در یک نگاه

| موضوع | مقدار |
|---|---|
| نام | سیستم تولید پلاس / Manufacturing GNG+ |
| هدف | نسخه‌ی جدید سیستم مدیریت تولید، با حفظ بستر جدول‌های نسخه‌ی قبل |
| محل پروژه | `D:\Claude\Golrang Claude\Manufacturing` |
| فرانت‌اند | `gng-mfr-app` — Angular 18 (standalone) + PrimeNG 17، راست‌به‌چپ، فارسی |
| بک‌اند | `gng-mfr-api` — Node.js + Express + `mssql`، پورت ۴۳۱۱ |
| دیتابیس | SQL Server لوکال، دیتابیس `MNG_System` |
| اسکیمای داده‌ی جدید | `mes` — ۱۷۲ جدول، ۱۷۴ رویه، ۱۵ تابع |
| اسکیمای مرجع قدیم | `mfr` (۱۰۵ جدول) و `generalmfr` (۵۲ جدول) — فقط مرجع، خالی از داده |
| اسکیمای طراحی | `alm` (۲۵ جدول) — فرم‌ها، فیچرها، دسترسی، عملیات، منو |
| شرکت نمونه | `CompanyId = 222` |

### پیشرفت

- ۴۷ فرم در ۵ حوزه تعریف شده است.
- ۴۰ فرم روی داده‌ی واقعی دیتابیس بالا آمده‌اند (فقط‌خواندنی): هر ۹ فرم «مدیریت منابع» (RM-01 تا RM-09)، هر ۹ فرم «مهندسی محصول» (PE-01 تا PE-09)، هر ۱۰ فرم «مهندسی تولید» (ME-01 تا ME-10) و هر ۱۲ فرم «کنترل تولید» (PC-01 تا PC-12).
- چهار حوزه‌ی مدیریت منابع، مهندسی محصول، مهندسی تولید و کنترل تولید در فاز اول کامل‌اند. RM-09، PE-07 و ME-10 فیچر الزامی ندارند و به درخواست صریح کاربر (۱۷ مهر) به‌عنوان استثنا ساخته شدند.
- ۷ فرم «چارچوب مشترک» (PF) هنوز پروتوتایپ با داده‌ی ساختگی‌اند.
- دو ابزار توسعه ساخته شده: «شناسنامه‌ی فرم در ALM» و «بررسی دیتابیس».

---

## ۲. معماری و اجرا

```
مرورگر  ──►  gng-mfr-app (پورت ۴۴۰۰)  ──►  gng-mfr-api (پورت ۴۳۱۱)  ──►  SQL Server / MNG_System
                Angular + PrimeNG              Express + mssql               اسکیماهای mes، alm
```

- مرورگر مستقیم به SQL Server وصل نمی‌شود؛ همه‌چیز از API می‌گذرد.
- فرانت‌اند آدرس API را از روی آدرس خود صفحه می‌سازد (`http://<همان هاست>:4311`)، پس روی سیستم‌های دیگر شبکه هم بدون تنظیم کار می‌کند.
- **ورود:** صفحه‌ی Login سرور، دیتابیس و نوع احراز هویت را می‌گیرد و یک «نشست» باز می‌کند. توکن نشست در `sessionStorage` مرورگر (کلید `gng-mfr.session`) می‌ماند و در هدر `x-alm-session` با هر درخواست می‌رود.
- **خروج:** دکمه‌ی ریز خروج در گوشه‌ی نوار بالا. برای کار با دیتابیس دیگر، خروج و ورود دوباره.

### اجرا

1. در پوشه‌ی `gng-mfr-api` فایل `run-api.bat` را اجرا کنید (پورت ۴۳۱۱).
2. در پوشه‌ی `gng-mfr-app` فایل `run.bat` را اجرا کنید (پورت ۴۴۰۰).
3. در مرورگر `http://localhost:4400` را باز کنید و وارد شوید.

بعد از هر تغییر در `server.js` باید `run-api.bat` ری‌استارت شود.
تنظیم اتصال در فایل `.env` پوشه‌ی API است (`DB_AUTH=sql`). رمزها در این سند نیامده‌اند.

---

## ۳. قواعد ثابت پروژه

این‌ها تصمیم‌های گرفته‌شده‌اند و هر فرم تازه باید از آن‌ها پیروی کند.

### ۳-۱. قاعده‌ی مدل داده

1. همه‌ی جدول‌های جدید در اسکیمای `mes` ساخته می‌شوند.
2. پیش از ساختن هر جدول، `mfr` و `generalmfr` بررسی می‌شود. اگر معادل دارد، **همان نام جدول و همان فیلدها** استفاده می‌شود و فقط جایی که لازم است فیلد اضافه یا عوض می‌شود. هدف: بستر تولید تا حد ممکن ثابت بماند.
3. تفاوت `mfr` و `generalmfr` مهم نیست؛ هر دو در `mes` یکی می‌شوند.
4. غلط‌های املایی نسخه‌ی قبل عیناً حفظ شده‌اند (مثل `ScheduleRealeseCode`).

### ۳-۲. ستون‌های استاندارد پایان هر جدول

هر جدول `mes` این ۱۱ ستون را در انتها دارد (یک بلوک تکراری در هر اسکریپت آن‌ها را به هر جدولی که ندارد اضافه می‌کند):

| ستون | نوع | پیش‌فرض |
|---|---|---|
| `CompanyId` | BIGINT NOT NULL | — |
| `BranchId` | BIGINT NOT NULL | 100 |
| `RecGuid` | UNIQUEIDENTIFIER NOT NULL | NEWID() |
| `OwnerId`، `CreatedBy`، `ModifiedBy` | BIGINT NOT NULL | 1 |
| `CreatedOn` | DATETIME NOT NULL | GETDATE() |
| `ModifiedOn` | DATETIME NULL | GETDATE() |
| `StateCode` | INT NOT NULL | 1 |
| `IsDeleted` | BIT NOT NULL | 0 |
| `RowVersion` | TIMESTAMP | — |

همه‌ی رویه‌ها `IsDeleted = 0` را فیلتر می‌کنند.

### ۳-۳. قراردادهای رویه‌ها

- شناسه‌ها در خروجی به `INT` تبدیل می‌شوند، چون `BIGINT` در JSON به شکل رشته می‌رسد.
- زمان‌های شیفت و تقویم «دقیقه از نیمه‌شب» هستند (۰ تا ۱۴۳۹) — **فرض، منتظر تأیید**.
- روز هفته: شنبه = ۱ … جمعه = ۷، مستقل از تنظیم `DATEFIRST`.

### ۳-۴. قاعده‌ی راست‌به‌چپ

ترتیب همه‌چیز از راست به چپ و از بالا به پایین است. درخت فیلتر (سلسله‌مراتب سازمانی) همیشه سمت راست صفحه می‌نشیند.

### ۳-۵. «دامنه‌ی انتخاب» مشترک

درخت «سلسله‌مراتب سازمانی و مکانی» انتخابگر مشترک فرم‌های مدیریت منابع است:

| انتخاب | معنی |
|---|---|
| گره‌ی سازمانی | آن گره با همه‌ی زیرگره‌هایش |
| خط | فقط همان خط |
| ایستگاه | همان ایستگاه |

پارامترهای API: `orgNodeId` یا `lineId` یا `lineId + stationId`.
فرم‌های تقویمی یک پنجره‌ی زمانی هم دارند: `from` (تاریخ میلادی `YYYY-MM-DD`، پیش‌فرض امروز) و `days` (پیش‌فرض ۱۴).

### ۳-۶. روش فاز اول

همه‌ی فرم‌ها ابتدا با **فیچرهای الزامی** و منطبق بر دیتابیس بالا می‌آیند. فیچرهای «مهم» و پایین‌تر به فازهای بعد می‌روند. فرم‌ها در این فاز **فقط‌خواندنی**‌اند: دکمه‌های ثبت و ویرایش در نوار ابزار دیده می‌شوند ولی هنوز کاری نمی‌کنند.

### ۳-۷. ثبت پیشرفت در ALM

با تحویل هر فرم، وضعیت فیچرهای پیاده‌شده‌اش در `alm.FormFeatureMapping.DevStatusCode` روی «در حال کار» (`InProgress`) گذاشته می‌شود و در `Note` همان ردیف نوشته می‌شود چه چیزی پیاده شده و چه چیزی مانده. «تحویل شده» (`Delivered`) وضعیت پایانی است و تا ثبت و ویرایش فرم کامل نشود استفاده نمی‌شود.

---

## ۴. دیتابیس — اسکیمای `mes`

هر فرم یک اسکریپت نصب دارد در `gng-mfr-api/scripts`. همه idempotent هستند (اجرای دوباره چیزی را خراب نمی‌کند) و باید به ترتیب اجرا شوند.

| اسکریپت | فرم | جدول | تابع | رویه |
|---|---|---|---|---|
| `mes_frm_rm01_setup.sql` | ساختار کارخانه و خطوط | ۱۰ | ۲ | ۱۰ |
| `mes_frm_rm02_setup.sql` | تجهیزات، ابزار و قالب | ۱۱ | ۱ | ۶ |
| `mes_frm_rm03_setup.sql` | نیروی کار و ماتریس مهارت | ۱۰ | ۱ | ۶ |
| `mes_frm_rm04_setup.sql` | شیفت و برنامه‌ی حضور | ۸ | ۱ | ۷ |
| `mes_frm_rm05_setup.sql` | تقویم تولید | ۳ | ۲ | ۵ |
| `mes_frm_rm06_setup.sql` | کارکرد استاندارد و ظرفیت | ۴ | ۲ | ۵ |
| `mes_frm_rm07_setup.sql` | طبقه‌بندی علل | ۷ | ۳ | ۴ |
| `mes_frm_rm08_setup.sql` | پیمانکاران تولید | ۴ | ۰ | ۴ |
| `mes_frm_pe01_setup.sql` | ویژگی‌های تولیدی قلم | ۱۱ | ۰ | ۹ |
| `mes_frm_pe02_setup.sql` | ساختار محصول | ۹ | ۱ | ۸ |
| `mes_frm_rm09_setup.sql` | مبانی هزینه‌یابی و ABC | ۵ | ۰ | ۴ |
| `mes_frm_pe03_setup.sql` | گروه جایگزین و سیاست جایگزینی | ۳ | ۰ | ۳ |
| `mes_frm_pe04_setup.sql` | خروجی‌های چندگانه و بازده | ۰ | ۰ | ۱ |
| `mes_frm_pe05_setup.sql` | بازیافت و مواد بازیافتی | ۲ | ۰ | ۴ |
| `mes_frm_pe06_setup.sql` | ساختار ماتریسی و واریانت | ۱ | ۰ | ۳ |
| `mes_frm_pe08_setup.sql` | نماها و محاسبات ساختار | ۰ | ۱ | ۳ |
| `mes_frm_pe09_setup.sql` | مدیریت تغییر مهندسی (ECO) | ۴ | ۰ | ۳ |
| `mes_frm_me01_setup.sql` | کتابخانه‌ی عملیات | ۵ | ۰ | ۵ |
| `mes_frm_me02_setup.sql` | روش ساخت | ۶ | ۰ | ۶ |
| `mes_frm_me03_setup.sql` | کارکرد استاندارد و زمان عملیات | ۲ | ۰ | ۳ |
| `mes_frm_me04_setup.sql` | اقلام و خروجی در سطح عملیات | ۲ | ۰ | ۴ |
| `mes_frm_me05_setup.sql` | عملیات بازیابی مواد | ۱ | ۰ | ۲ |
| `mes_frm_me06_setup.sql` | سیاست‌های تغذیه، مصرف و رسید | ۱ | ۰ | ۲ |
| `mes_frm_me07_setup.sql` | برون‌سپاری و کارمزدی | ۳ | ۰ | ۴ |
| `mes_frm_me08_setup.sql` | نسخه‌ی تولید | ۱ | ۰ | ۲ |
| `mes_frm_me09_setup.sql` | تولید پیوسته و کمپین | ۲ | ۰ | ۳ |
| `mes_frm_me10_setup.sql` | فعالیت و محرک هزینه‌ی عملیات | ۱ | ۰ | ۲ |
| `mes_frm_pe07_setup.sql` | پیکربندی محصول | ۵ | ۰ | ۵ |
| **جمع** | | **۱۲۱** | **۱۴** | **۱۲۳** |

گام‌های ME به ترتیب شماره اجرا می‌شوند (`me02` … `me10`) و سپس `pe07`. `me06` به جدول `ManufacturingVersion` گام `me08` ارجاع دارد (رویه با تأخیر نام‌یابی ساخته می‌شود و تا گام `me08` آن لایه خالی است). `me09` یک روش پیوسته با زمان، مواد و خروجی کامل می‌سازد تا فرم‌های ME-02 تا ME-04 برایش کامل باشند.

ترتیب اجرا همان ترتیب جدول است؛ `rm09` بعد از `pe02` ساخته شد و به جدول‌های گام ۶ (`CapacityType`) و گام ۳ (`ProductionOperation`) نیاز دارد. گام‌های ۱۲ تا ۱۷ (`pe03` … `pe09`) همه روی جدول‌های ساختار گام ۱۰ بنا شده‌اند؛ `pe09` برای تحلیل اثر به `GetWhereUsed` گام ۱۶ نیاز دارد.

فایل‌های `cl_frm_*.sql` منسوخ‌اند (اسکیمای قدیمی `cl` حذف شده) و نباید اجرا شوند.

### ۴-۱. جدول‌ها و نسبتشان با نسخه‌ی قبل

**گام ۱ — FRM-RM-01**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `ProductionLine` | همان `generalmfr.ProductionLine` + `OrgNodeId` |
| `ProductionLineHead` | همان + `HeadTitle`، `IsBackup` |
| `ProductionLineInventory` | همان، بدون تغییر |
| `WorkCenter` | همان `generalmfr.WorkCenter` + `ProductionLineId`، `SequenceNo`، `StationTypeTitle`، `TopologyTypeCode`، `CostCenterTitle`، `SharePercentText`، `ResourceGroupId`، `LineSideInventoryId`، `ValidToDate` |
| `OrgNode` | جدید — درخت سازمانی (مجموعه ← هلدینگ ← شرکت ← کارخانه ← واحد) |
| `WorkCenterLink` | جدید — اتصال بین دو ایستگاه یک خط (اصلی، دوباره‌کاری، بای‌پس) |
| `ResourceGroup`، `ResourceGroupMember` | جدید — گروه منبع |
| `LineSideInventory` | جدید — انبار پای کار |
| `MobileResource` | جدید — منبع سیار |

**گام ۲ — FRM-RM-02**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `WorkCenterEquipment` | همان، بدون تغییر — تخصیص تجهیز به ایستگاه |
| `ToolsProductionGroup` | همان، بدون تغییر |
| `ToolsProduction` | همان + `OrgNodeId`، `EquipmentId`، `LifeUnitTitle`، `LifeLimit`، `LifeUsed`، `NextServiceAt`، `ServiceTitle`، `IsActive` |
| `EquipmentAvailability` | همان، بدون تغییر — وضعیت نت؛ ردیف جاری = `ToDateTime` خالی |
| `EquipmentProduction` | همان، بدون تغییر — هنوز فرمی از آن نمی‌خواند |
| `Equipment` | جدید — جانشین موقت «اصلِ تجهیز» تا سیستم نت/دارایی وصل شود |
| `EquipmentAttribute` | جدید — ویژگی فنی قابل‌تعریف |
| `EquipmentCapability` | جدید — قابلیت تجهیز |
| `ChangeoverClass`، `ChangeoverTime` | جدید — ماتریس زمان تعویض |
| `EquipmentSoftware` | جدید — نسخه‌ی برنامه‌ی دستگاه |

**گام ۳ — FRM-RM-03**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `ProductionPersonnelGroup` | همان، بدون تغییر |
| `ProductionPersonnelGroupMapping` | همان، بدون تغییر — عضویت نفر در گروه پرسنلی و گروه کاری |
| `ProductionWorkingGroup` | همان + `ProductionLineId`، `WorkCenterId`، `HeadPartyId`، `Description` |
| `WorkCenterLabor` | همان، بدون تغییر — تخصیص نفر به ایستگاه با درصد اشتغال |
| `ProductionOperationGroup`، `ProductionOperation` | همان، بدون تغییر |
| `ProductionPersonnel` | جدید — جانشین موقت HR؛ `Id` همان `PersonnelPartyId` است |
| `Skill`، `PersonnelSkill`، `OperationSkillRequirement` | جدید — مهارت، سطح مهارت نفر، الزام مهارت عملیات |

**گام ۴ — FRM-RM-04**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `ProductionWorkingShift` | همان، بدون تغییر — الگوی شیفت |
| `ProductionCalendar` | همان، بدون تغییر — یک ردیف به‌ازای هر روز |
| `ProductionCalendarDetail` | همان، بدون تغییر — روز × شیفت × گروه کاری |
| `ProductionWorkingShiftBreak` | جدید — استراحت‌های شیفت |
| `ShiftRotation`، `ShiftRotationDay`، `ShiftRotationAssignment` | جدید — چرخه‌ی شیفت و تخصیص به گروه |
| `PersonnelAbsence` | جدید — غیبت و جایگزین |

**گام ۵ — FRM-RM-05**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `ProductionShutdownDetail` | همان + `WorkCenterId`، `RequestedByTitle` — رزرو نت |
| `ProductionCalendarRule` | جدید — تعریف تقویم پایه در هر سطح |
| `ProductionCalendarException` | جدید — استثنا با وضعیت تأیید |

**گام ۶ — FRM-RM-06**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `CapacityRequirmentScheduling` | همان `mfr.CapacityRequirmentScheduling` + `CapacityTypeId`، `ProductTitle`، `WorkOrderNumber` — بار زمان‌بندی‌شده روی ایستگاه. `SiteId`، `ProductId`، `MeasureUnitId` و `UniqueShiftCode` این‌جا `NULL`اند چون جدول‌های مرجعشان هنوز در `mes` نیستند. `CapacityTypeId` خالی یعنی ماشین‌ساعت، مثل نسخه‌ی قبل. |
| `CapacityType` | جدید — انواع کارکرد پویا؛ جانشین فیلدهای ثابت `NumberOfEquipments`/`NumberOfLabors` و `MachineLoad`/`LaborLoad`. ستون `LegacyFieldCode` نوع پایه را به فیلد قدیم نگاشت می‌کند. |
| `WorkCenterCapacity` | جدید — ظرفیت هر نوع کارکرد به‌ازای ایستگاه **یا** گروه منبع، با در دسترس‌بودن و توقف استاندارد. نام ستون‌های درصد همان قدیم است (`EquipmentAvailPercent`، `ProductivityPercent`). هر تغییر یک نسخه‌ی تازه با `ValidFromDate` است و سابقه‌ی تغییرات از همین نسخه‌ها ساخته می‌شود. |
| `WorkCenterProductRate` | جدید — نرخ تولید وابسته به محصول یا گروه محصول، با ضریب کارایی و اعتبار. `ProductTitle` جانشین موقت اصل کالاست. |

جدول‌های `CapacityRequirment*` و `RoughCutCapacity*` دیگر (خروجی محاسبه‌ی CRP و RCCP) و `WorkCenterShiftDetail` و `WorkCenterAvailability` هنوز به `mes` نیامده‌اند؛ جای طبیعی‌شان برنامه‌ریزی تولید است.

**گام ۷ — FRM-RM-07**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `ProductionProblemGroup` | همان `generalmfr.ProductionProblemGroup` (درخت چندسطحی با `ParentId`، `Level` و `Chain` از قبل) + `IsActive`، `SortOrder` |
| `ProductionProblem` | همان `generalmfr.ProductionProblem` + `OeeLossCode`، `IsExcludedFromOee`، `IsActive`، `SortOrder`، `Description` — علت توقف |
| `ProductionWasteReason` | همان `generalmfr.ProductionWasteReason` (فهرست تخت) + `ParentId` (درختی)، `WasteTypeCode`، `OeeLossCode`، `IsActive`، `SortOrder`، `Description` |
| `ProductionReworkReason` | همان `mfr.ProductionReworkReason` + `ParentId`، `IsActive`، `SortOrder`، `Description` |
| `ProductionPlanDeviation` | همان `generalmfr.ProductionPlanDeviation` + `ParentId`، `IsActive`، `SortOrder`، `Description` |
| `OeeLoss` | جدید — شش زیان بزرگ OEE |
| `ProductionReasonRestriction` | جدید — علل مجاز به‌ازای خط، ایستگاه یا نوع تجهیز |

`ProductionExcessUsageReason` (علت مصرف اضافه)، `ReasonCancel` (علت ابطال) و `ProductionRepair`/`ProductionProblemRepairMapping` (اقدام اصلاحی، F-RM-052) هنوز به `mes` نیامده‌اند.

**گام ۸ — FRM-RM-08**

همه‌ی جدول‌ها جدیدند؛ نسخه‌ی قبل جدول مستقل پیمانکار نداشت و برون‌سپاری را با پرچم روی منابع نشان می‌داد (`WorkCenter.IsOutsourced` و `WorkCenterPartyId`، `ProductionLine.IsOutsourced`، `ProductionLineInventory.IsOutsourced`). طبق تصمیم ۱۵ مهر، پیمانکار فعلاً مستقل تعریف می‌شود (تصمیم باز ۱۲).

| جدول `mes` | کار |
|---|---|
| `ProductionContractor` | پیمانکار: قرارداد، وضعیت تأیید صلاحیت، کارمزدی یا خرید کامل، تقویم کاری (`WorkDaysMask`، `FromTime`، `ToTime`، `Is24x7` با همان معنای `ProductionCalendarRule`). `PartyId` برای اتصال بعدی به سیستم اشخاص. |
| `ProductionContractorCapability` | قابلیت: عملیات (`ProductionOperationId`)، محصول یا گروه محصول، ظرفیت در دوره، تأیید صلاحیت تا تاریخ |
| `ProductionContractorRate` | نرخ کارمزد، زمان تحویل و حداقل سفارش با اعتبار زمانی |
| `ProductionContractorInventory` | انبار امانی نزد پیمانکار؛ `InventoryId` و `ReferenceInventoryNumber` مثل `LineSideInventory` |

**گام ۹ — FRM-PE-01** (اولین گام مهندسی محصول)

کاتالوگ کالا در این دیتابیس نیست؛ در نسخه‌ی قبل هم در سیستم انبار بود و جدول‌های `mfr` فقط `ProductId` دارند. `mes.Product` جانشین موقت کاتالوگ است (مثل `Equipment` و `ProductionPersonnel`) و `Id` آن همان `ProductId` است. دیتابیس‌های `AshaERP_Dev*` روی همین سرور سیستم دیگری‌اند (کاتالوگشان `md.Part` است) و عمداً استفاده نشدند. همه‌ی جدول‌ها جدیدند؛ نسخه‌ی قبل ویژگی تولیدی در سطح قلم نداشت.

| جدول `mes` | کار |
|---|---|
| `Product` | جانشین موقت کاتالوگ کالای انبار |
| `ProductionItem` | افزوده‌ی تولید به کالا: نقش تولیدی، سطح ردیابی، فانتوم، ابعادی (یک ردیف به‌ازای هر `ProductId`) |
| `ProductionItemSupplyPolicy` | سیاست تأمین چندگانه با اولویت و سهم؛ `ProductSourceCode` همان نام `mfr.ProductEngineeringGroup` است؛ برون‌سپاری به `ProductionContractor` وصل است |
| `ProductionAttribute`، `ProductionItemAttribute` | تعریف ویژگی تولیدی قابل‌گسترش و مقدار اسمی/بازه‌ی هر کالا |
| `ProductionDimension`، `ProductionDimensionValue` | بُعد و مقادیرش |
| `ProductionItemDimensionValue` | مقادیر مجاز هر بُعد برای یک کالای ابعادی |
| `ProductionItemVariant`، `ProductionItemVariantValue` | ترکیب‌های ساخته‌شده و مقادیر هر ترکیب |
| `ProductionItemLotSize` | اندازه‌ی بچ (`BatchSize`، همان نام نسخه‌ی قبل)، حداقل، حداکثر و مضرب به‌ازای کالا و خط |

**گام ۱۰ — FRM-PE-02**

نسخه‌ی قبل مدل کامل ساختار داشت؛ هفت جدول با همان نام و فیلدها آمده‌اند و فقط دو جدول جدید است.

| جدول `mes` | نسبت با قدیم |
|---|---|
| `ProductStructure` | همان `mfr.ProductStructure` + `TemplateProductStructureId` (ارث‌بری از الگو)، `BatchMultiple`، `AllowPercentOver100`، `ProfileCode` |
| `ProductStructureMaster` | همان، بدون تغییر — محصول اصلی و اندازه‌ی مرجع (`Quantity`). محصولات همزاد و جانبی در PE-04 به همین جدول می‌آیند. |
| `ProductStructureItem` | همان + `Sequence`، `ItemRoleTitle`، `QuantityFormula`، `WasteTypeCode`/`WasteQuantity`/`IsWastePriorityOverOperation`، `MinConsumptionPercent`/`MaxConsumptionPercent`، `AssayBasisPercent`/`PotencyCompensationProductId`، `ConsumptionUnitTitle`/`UnitConversionFactor`/`IsBatchDependentConversion`، `InheritanceActionCode`. ستون‌های قدیم `IsQuantumSatis` (q.s.)، `IsActiveIngredient` (عیارمحور) و `ToleranceForNormalWaste` (ضایعات درصدی) همان معنا را دارند. ردیف‌ها مثل قدیم به نسخه (`RevisionId`) وابسته‌اند. |
| `ProductionRevision` | همان، بدون تغییر — کد نسخه |
| `ProductStructureRevision` | همان + `EffectivityTypeCode`، `FromBatchNumber`، `ToBatchNumber`، `WorkOrderNumber`، `RevisionStatusCode`، `ApproverTitle`، `EcoNumber`. `ProductId` این‌جا `NULL` است چون الگو محصول ندارد. |
| `ProductStructureSite` | همان + `OrgNodeId`، `ProductionLineId` (دامنه‌ی سازمانی)؛ `SiteId` این‌جا `NULL` |
| `ProductStructureGroup` | همان، بدون تغییر |
| `ProductStructureTypeChange` | جدید — درخواست و سابقه‌ی تبدیل نوع با تأیید QC و مدیر |
| `ProductStructureAttachment` | جدید — مدارک و پیوست؛ `DmsDocumentId` برای اتصال بعدی به مدیریت مستندات |

`ProductStructureItemSub` (جایگزین، PE-03)، `ProductStructureTree` (بسط درختی، PE-08)، `ProductStructureMasterCost` و `*AnalysisMapping` هنوز نیامده‌اند.

**گام ۱۱ — FRM-RM-09** (استثنای فاز اول به درخواست کاربر)

| جدول `mes` | نسبت با قدیم |
|---|---|
| `ProductionActivity` | همان `generalmfr.ProductionActivity` + `Description`، `IsActive`، `SortOrder`. `ActivityPropertyTypeCode` فعلاً «سطح فعالیت» ABC گرفته شده (منتظر تأیید). |
| `ProductionOperationActivity` | جدید — فعالیت‌های هر عملیات کتابخانه؛ فیلدها از `mfr.RoutingOperationActivity` گرفته شده ولی در سطح کتابخانه‌ی عملیات است، نه مسیر ساخت |
| `ProductionActivityResource` | جدید — فعالیت روی کدام ایستگاه یا گروه منبع |
| `CostDriver` | جدید — محرک هزینه‌ی هر فعالیت بر پایه‌ی یک نوع کارکرد (`CapacityType`)، با لحظه‌ی گردآوری و نام رویداد ارسال به CO |
| `SharedResourceAllocation` | جدید — تسهیم تجهیز، گروه منبع یا کارکرد/انرژی بین مراکز هزینه با ضریب ثابت یا مقدار واقعی محرک |

ستون `IsCostDriver` به `mes.CapacityType` (گام ۶) افزوده شد. مرکز هزینه فعلاً متن است (`CostCenterTitle`، مثل `WorkCenter.CostCenterTitle`).

**گام ۱۲ — FRM-PE-03**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `SubstituteGroup` | جدید — گروه جایگزین مستقل از ساختار، با `IsCombinable` (ترکیب گزینه‌ها مجاز است یا نه) |
| `SubstituteGroupOption` | جدید — گزینه‌های گروه؛ `OptionNo = 0` اقلام اصلی‌اند، بقیه جایگزین با `Priority` |
| `SubstituteGroupMember` | جدید — اقلام هر گزینه با نسبت مقدار (`Quantity`)؛ «چند به چند» |

`ProductStructureItemSub` قدیم (یک ردیف ← یک جایگزین) به کار نرفت چون جایگزینی چندبه‌چند و مشترک بین ساختارها لازم بود؛ ستون `SubstituteGroupId` به `ProductStructureItem` افزوده شد.

**گام ۱۳ — FRM-PE-04:** جدول تازه ندارد. `ProductStructureMaster` (که قدیم هم ردیف محصول اصلی/همزاد/فرعی را داشت) ستون‌های `OutputProcessCode`، `ByProductValuationCode`، `YieldPercent`، `MinYieldPercent`، `MaxYieldPercent`، `IsRecyclable`، `SortOrder` گرفت.

**گام ۱۴ — FRM-PE-05**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `RecoveredMaterial` | جدید — ماده‌ی بازیافتی (قلم مستقل یا گرید)، نرخ بازیافت و افت، نسبت هم‌ارزی، حداقل خلوص، الزام QC، حداکثر چرخه، اولویت مصرف |
| `RecoveryPolicy` | جدید — سیاست کلی بازیافت شرکت |

ستون‌های قدیم `IsRecovery` و `RecoveryPercentage` در `ProductStructureItem` همان معنا را دارند؛ `MaxRecoveredUsePercent` افزوده شد.

**گام ۱۵ — FRM-PE-06**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `ProductStructureItemDimensionValue` | جدید — مقدار ردیف ساختار ماتریسی به‌ازای هر مقدار بُعد |

ستون `ProductionDimensionId` به `ProductStructureItem` افزوده شد (ردیف به کدام بُعد وابسته است).

**گام ۱۶ — FRM-PE-08:** جدول ندارد. `ProductStructureTree` قدیم (بسط ذخیره‌شده) نیامد؛ بسط هر بار با `ExplodeStructure` حساب می‌شود.

**گام ۱۷ — FRM-PE-09**

| جدول `mes` | نسبت با قدیم |
|---|---|
| `EngineeringChangeOrder` | جدید — ECO با منشأ، اولویت، وضعیت، تاریخ اثر و سیاست موجودی موجود. شماره‌اش همان `ProductStructureRevision.EcoNumber` است. |
| `EngineeringChangeOrderItem` | جدید — دامنه‌ی چندموجودیتی (ساختار، کالا، گروه جایگزین، الگو) با پیش/پس |
| `EngineeringChangeOrderApproval` | جدید — زنجیره‌ی امضای الکترونیک |
| `EngineeringChangeOrderNotification` | جدید — اطلاع‌رسانی به واحدها |

**گام ۱۸ — FRM-ME-01**

نسخه‌ی قبل در سطح کتابخانه فقط نام و گروه عملیات را داشت؛ منابع، انرژی و دستورالعمل در سطح مسیر ساخت بودند (`mfr.RoutingOperation*`). همان فیلدها به سطح کتابخانه آمده‌اند تا روش ساخت (ME-02) به ارث ببرد.

| جدول `mes` | نسبت با قدیم |
|---|---|
| `ProductionOperationGroup` | (گام ۳) + `ParentId`، `SortOrder` — درختی شد؛ «عملیات جامدات» ریشه است |
| `ProductionOperation` | (گام ۳) + `OperationTypeCode` (ماهیت؛ نام از `mfr.RoutingOperation`)، `IsActive`، `SortOrder` |
| `ProductionOperationResource` | جدید — ایستگاه یا گروه منبع اصلی و جایگزین با اولویت |
| `ProductionOperationTools` | جدید — همان فیلدهای `mfr.RoutingOperationTools` در سطح کتابخانه (`ToolsGroupId` ← `ToolsProductionGroup`) |
| `ProductionOperationEnergy` | جدید — همان فیلدهای `mfr.RoutingOperationEnergy`؛ `EnergyId` به `CapacityTypeId` تبدیل شد (تصمیم باز ۹) |
| `ProductionOperationInstruction` | جدید — همان فیلدهای `mfr.RoutingOperationInstruction` (`InstructionDescription`، `NeededTools`، `NeededUniforms`، `IsMandatory`) + شماره سند، نسخه، وضعیت، نوع رسانه، فایل، `DmsDocumentId`، تاریخ اثر، تأییدکننده، نمایش در ترمینال |
| `ProductionOperationParameter` | جدید — پارامتر فرایندی هدف با حد پایین/بالا، منبع خوانش، فاصله‌ی نمونه‌برداری، رفتار خارج از محدوده |

مهارت لازم همان `OperationSkillRequirement` گام ۳ است. گروه ابزار «توری و الک» (`SCREEN`) به `ToolsProductionGroup` گام ۲ افزوده شد.

**گام‌های ۱۹ تا ۲۷ — مهندسی تولید (ME-02 تا ME-10)**

| جدول `mes` | گام | نسبت با قدیم |
|---|---|---|
| `RoutingMaster` | ME-02 | همان `mfr.RoutingMaster` + `IsTemplate`، `TemplateRoutingId`، `IsTollManufacturing`، `CustomerPartyId`، `CustomerTitle`؛ ME-04: `ProcessWastePercent`، `WastePriorityCode`؛ ME-09: `RateQuantity`، `RateTimeBasisCode`. `MeasureUnitId` این‌جا NULL پذیر. |
| `RoutingProductStructureAssignment` | ME-02 | همان، بدون تغییر |
| `RoutingOperation` | ME-02 | همان + `ResourceGroupId` (ME-04: `IntermediateStorageCode`، `LineSideInventoryId`)؛ `WorkCenterId` NULL پذیر (منبع از کتابخانه به ارث می‌رسد) |
| `RoutingOperationOutput` | ME-02 | همان (املای `OuputProductId` حفظ شده) + `RoutingOperationId`؛ ME-10: `CostSharePercent` |
| `RoutingOperationLink` | ME-02 | جدید — یال گراف با سهم‌بری و هم‌پوشانی |
| `RoutingOperationAlternative` | ME-02 | جدید — عملیات جایگزین با شرط انتخاب |
| `RoutingOperationTiming` | ME-03 | همان + `TeardownTimePerBatch`، `WaitTimePerBatch`، `IsWaitOccupyingResource`، `IsWaitRequiringLabor`، `TransferBatchSize`، `BatchSplitRuleCode`، `MaxRunQuantity` |
| `RoutingOperationCapacity` | ME-03 | جدید — هر نوع کارکرد با مبنای محاسبه؛ جای ستون‌های ثابت `RoutingOperationCost` |
| `RoutingOperationMaterial` | ME-04 | همان + `ProductStructureItemId`، `ConsumptionPointCode`، `AllocationPercent` |
| `RoutingOperationBatchAttribute` | ME-04 | جدید — ویژگی‌های بچ هر عملیات |
| `RoutingOperationRecovery` | ME-05 | جدید — عملیات بازیابی |
| `ProductionMaterialPolicy` | ME-06 | جدید — سیاست لایه‌ای؛ جای پرچم‌های پخش `generalmfr.Setting` و `ProductionLineInventory` |
| `RoutingOperationSubcontract`، `RoutingOperationSubcontractItem`، `RoutingTollMaterial` | ME-07 | جدید |
| `ManufacturingVersion` | ME-08 | جدید — `mfr.ProductionVersion` نسخه‌ی برنامه‌ریزی (MPS/MRP) است، مفهوم دیگر؛ تصمیم باز ۱۵ |
| `ShiftOrderTemplate`، `ShiftHandoverRule` | ME-09 | جدید |
| `RoutingOperationActivity` | ME-10 | همان `mfr.RoutingOperationActivity` + `CostDriverId`، `IsValueAdded` |

ستون‌های افزوده به جدول‌های قبلی: `ProductionItem.ChangeoverClassId` (ME-03)، `ProductionMaterialPolicy.ManufacturingVersionId` (ME-08)؛ اعضای گروه منبع `POOL-PRESS` و `POOL-MIX` به تجهیزشان وصل شدند (ME-03). عملیات کتابخانه‌ای `OP-38` «تهیه‌ی محلول روکش» در ME-02 افزوده شد.

**گام ۲۸ — FRM-PE-07:** `ProductConfigurationModel`، `ProductConfigurationFeature`، `ProductConfigurationValue`، `ProductConfigurationRule`، `ProductStructureItemCondition` — همه جدید؛ نسخه‌ی قبل پیکربندی نداشت. چهار کالای بسته‌بندی (P-4006 تا P-4009) به کاتالوگ افزوده شد.

**گام‌های ۳۱ تا ۴۲ — کنترل تولید (PC-01 تا PC-12)**

جدول‌های اجرای نسخه‌ی قبل (mfr.WorkOrder*) با همه‌ی فیلدها و همان نام (املای قدیم حفظ شده) آمده‌اند و فقط فیلد لازم اضافه شده است. ستون‌های افزوده در جدول زیر آمده‌اند.

| جدول `mes` | گام | نسبت با قدیم |
|---|---|---|
| `ProductionRequest`، `ProductionRequestApprovalRule`، `ProductionRequestApproval`، `ProductionRequestWorkOrder` | PC-01 | جدید — درخواست با منشأ، قاعده و تصمیم تأیید، پیوند چندبه‌چند درخواست↔دستور |
| `MaterialStock` | PC-01 | جدید — **جانشین موقت موجودی انبار** (مثل `Product`): بچ، انقضا، عیار، خلوص، چرخه‌ی بازیابی، رزرو، در راه، وضعیت QC، مالک |
| `WorkOrder` | PC-02 | همان + `ManufacturingVersionId`، `VersionSelectionNote`، `IsVersionOverridden`، `VersionOverrideReason`، `BasisCode`، `BatchNumber`، `WorkingShiftId`، `ShiftDate`، `DueDate`، `CustomerTitle`، `ConfigurationText` |
| `WorkOrderProduct` | PC-02 | همان + `OutputTypeCode` |
| `WorkOrderOperation` | PC-02 | همان + `RoutingOperationId`، `ResourceGroupId` |
| `WorkOrderOperationMaterial` | PC-02 | همان (حدود ۵۰ فیلد) + `ProductStructureItemId`، `StandardQuantity`، `BatchNumber`، `IsRecoveredMaterial` |
| `WorkOrderReasonCancel` | PC-02 | همان + تاریخ، دلیل، تکلیف مواد و کار |
| `WorkOrderChangeLog` | PC-02 | جدید |
| `WorkOrderOperationMaterialKit` | PC-03 | همان + بچ، موجودی، عیار، شماره‌ی انتقال، وضعیت کیت، کد اسکن |
| `WorkOrderOperationMaterialExcess`، `…Returned` | PC-03 | همان + دلیل، وضعیت، تأییدکننده / بچ و سند |
| `WorkOrderOperationOutput` | PC-04 | همان + `ReportNumber`، `ReportedByTitle`، `SourceCode` |
| `WorkOrderOperationOutputLabor`، `…Waste`، `…Repair` | PC-04 | همان + سهم تسهیم / `IsSetupWaste` / `ReworkReasonId` |
| `WorkOrderOperationCapacityUsage`، `ShiftReport`، `ShiftReportWip` | PC-04 | جدید — کارکرد به تفکیک انواع RM-06؛ گزارش و تحویل شیفت |
| `WorkOrderOperationProblem`، `WorkOrderOperationInstruction` | PC-05 | همان + گزارشگر و منبع / `IsDone`، زمان و انجام‌دهنده |
| `PLC`، `PLCItem`، `PLCItemData` | PC-05 | همان + مقدار کاربر و توضیح اختلاف |
| `WorkOrderOperationParameterReading`، `ShopFloorTerminal` | PC-05 | جدید |
| `WorkOrderOperationMaterialConsumed` | PC-06 | همان + گزارش منشأ، بچ، حالت مصرف، مقدار نظری، عیار، رفتار کسری، معکوس، بازیابی‌شده، امانی، سند |
| `WorkOrderOperationOutputProduct` | PC-07 | همان + شماره و تاریخ رسید، نوع خروجی، سیاست، انبار، بچ، QC (تأیید/رد/مسیر)، سهم هزینه، نرخ ارزش‌گذاری، مالکیت، سند |
| `ProductionLineBatchNumber`، `…Setting` | PC-07 | همان `generalmfr` (الگوی شماره‌ی بچ خط) + گروه کالا، آخرین شماره |
| `ProductSerial` | PC-07 | همان `generalmfr` + بچ، سطح، عملیات تخصیص، الگو، زمان |
| `ProductLabelTemplate`، `…Detail`، `…Parameter` | PC-07 | همان `mfr` + سطح، ابعاد، جانمایی اجزا، فیلد منبع |
| `ProductionBatch`، `ProductionBatchAttributeValue`، `ProductSerialPattern`، `ProductionBatchGenealogy` | PC-07 | جدید |
| `WorkOrderMaterialBalance` | PC-08 | جدید — اندازه‌گیری موازنه‌ی ماده‌ی بازیابی و جرم پیوسته |
| `NonconformingDisposition` | PC-09 | جدید |
| `SubcontractShipment`، `…Item`، `SubcontractProgress`، `TollingContract` | PC-10 | جدید |
| `PortalAccount` | PC-11 | جدید |
| `ProductionPlanDeviation` | PC-12 | همان جدول RM-07 (درخت قدیم) — علت انحراف روی آن ثبت می‌شود؛ درخت علل جدید ساخته نشد |
| `ExceptionRule`، `ExceptionAlert`، `WorkOrderDeviation`، `WorkOrderCloseEvent` | PC-12 | جدید |

از ۱۷۲ جدول `mes`، ۶۵ تا هم‌نام در `mfr` یا `generalmfr` دارند و ۱۰۷ تا جدیدند.

### ۴-۲. توابع

| تابع | کار |
|---|---|
| `mes.fnOrgNodesUnder` | یک گره با همه‌ی زیرگره‌هایش |
| `mes.fnLinesInScope` | خطوط دامنه‌ی انتخاب |
| `mes.fnEquipmentInScope` | تجهیزات دامنه |
| `mes.fnPersonnelInScope` | پرسنل دامنه (از تخصیص به ایستگاه یا عضویت گروه کاری) |
| `mes.fnWorkingGroupsInScope` | گروه‌های کاری دامنه |
| `mes.fnLineOrgNodes` | هر خط با همه‌ی گره‌های بالاسرش |
| `mes.fnLineCalendarRule` | تقویمی که به هر خط به ارث می‌رسد |
| `mes.fnCapacityResourcesInScope` | منابع ظرفیتِ دامنه: ایستگاه‌ها (بدون بافر) و گروه‌های منبعی که عضوی در دامنه دارند |
| `mes.fnCapacityResourceTitle` | کد، عنوان و خطِ یک ایستگاه یا گروه منبع |
| `mes.fnReasonNodes` | همه‌ی علل چهار دسته در یک شکل «گره‌ی درخت» با کلید یکتا (G گروه توقف، P علت توقف، W ضایعات، R دوباره‌کاری، D انحراف) |
| `mes.fnReasonClosure` | هر گره‌ی علل با همه‌ی نیاکانش (برای «مجاز کردن یک گروه یعنی همه‌ی زیرشاخه‌ها») |
| `mes.fnReasonRules` | قواعد محدودسازی با کلید گره و سطح هدف |
| `mes.fnStructureItems` | ردیف‌های مؤثر یک ساختار در یک نسخه، با ادغام ردیف‌های الگو (خودش، بازنویسی، از الگو، حذف) |
| `mes.fnStructureItemQty` | مقدار مؤثر هر ردیف برای اندازه‌ی مرجع؛ ردیف q.s. باقی‌مانده‌ی تا ۱۰۰٪ را می‌گیرد |
| `mes.fnShopNow` | ساعت سناریو (`2026-10-09 11:30`) برای همه‌ی محاسبه‌های «الان» فرم‌های PC؛ در عملیات واقعی `SYSDATETIME()` |

### ۴-۳. رویه‌ها

| فرم | رویه‌ها |
|---|---|
| RM-01 | `GetOrgTree`، `GetProductionLines`، `GetNodeAncestry`، `GetLineAncestry`، `GetLinesUnderNode`، `GetStationsUnderNode`، `GetStationLinksUnderNode`، `GetResourceGroups`، `GetMobileResources`، `GetLineSideWarehouses` |
| RM-02 | `GetEquipmentInScope`، `GetEquipmentAttributesInScope`، `GetEquipmentCapabilitiesInScope`، `GetToolsInScope`، `GetChangeoverInScope`، `GetEquipmentSoftwareInScope` |
| RM-03 | `GetPersonnelInScope`، `GetSkillsInScope`، `GetPersonnelSkillsInScope`، `GetOperationSkillRequirementsInScope`، `GetWorkingGroupsInScope`، `GetPersonnelStationsInScope` |
| RM-04 | `GenerateShiftCalendar` (تنها رویه‌ای که می‌نویسد)، `GetWorkingShifts`، `GetWorkingShiftBreaks`، `GetShiftRotationDays`، `GetShiftRotationAssignmentsInScope`، `GetShiftRosterInScope`، `GetAbsencesInScope` |
| RM-05 | `GetCalendarRules`، `GetCalendarInheritanceInScope`، `GetEffectiveCalendarInScope`، `GetCalendarExceptionsInScope`، `GetShutdownsInScope` |
| RM-06 | `GetCapacityTypes`، `GetCapacitiesInScope`، `GetProductRatesInScope`، `GetCapacityLoadInScope`، `GetCapacityHistoryInScope` |
| RM-07 | `GetReasonTree`، `GetOeeLossMapping`، `GetReasonRestrictionsInScope`، `GetAllowedReasonsInScope` |
| RM-08 | `GetContractors`، `GetContractorCapabilities`، `GetContractorRates`، `GetContractorInventories` |
| RM-09 | `GetProductionActivities`، `GetCostDrivers`، `GetCostDriverCapacityTypes`، `GetSharedResourceAllocations` |
| PE-02 | `GetProductStructures`، `GetStructureItems`، `GetStructureRevisions`، `GetStructureScopes`، `GetStructureTypeChanges`، `GetStructureTypeTransitions`، `GetStructureAttachments`، `GetStructureDiff` |
| PE-01 | `GenerateItemVariants` (دومین رویه‌ای که می‌نویسد)، `GetProductionItems`، `GetItemSupplyPolicies`، `GetProductionAttributes`، `GetItemAttributes`، `GetProductionDimensions`، `GetItemDimensionValues`، `GetItemVariants`، `GetItemLotSizes` |
| PE-03 | `GetSubstituteGroups`، `GetSubstituteGroupOptions`، `GetSubstituteGroupUsage` |
| PE-04 | `GetStructureOutputs` |
| PE-05 | `GetRecoveryPolicy`، `GetRecoveredMaterials`، `GetRecoveryFormulaRows`، `GetRecoveryOutputs` |
| PE-06 | `GetMatrixStructures`، `GetMatrixItems`، `GetDerivedVariantStructures` |
| PE-08 | `ExplodeStructure` (بسط حلقه‌ای سطح‌به‌سطح، نه CTE بازگشتی؛ کنترل حلقه با مسیر)، `GetWhereUsed`، `FindStructureCycles` |
| PE-09 | `GetEcos`، `GetEcoDetail` (سه مجموعه‌ی نتیجه)، `GetEcoImpact` (با `INSERT … EXEC GetWhereUsed`؛ پس خودش داخل `INSERT … EXEC` نمی‌رود) |
| ME-01 | `GetOperationGroupTree`، `GetLibraryOperations`، `GetOperationResources` (ایستگاه/گروه، مهارت، ابزار، انرژی در یک شکل)، `GetOperationInstructions`، `GetOperationParameters` |
| ME-02 | `GetRoutings`، `GetRoutingAssignments`، `GetRoutingOperations` (منبع ارثی از کتابخانه)، `GetRoutingLinks`، `GetRoutingAlternatives`، `GetRoutingOutputs` |
| ME-03 | `GetRoutingTimings`، `GetRoutingCapacities`، `GetRoutingChangeovers` (سه مجموعه‌ی نتیجه) |
| ME-04 | `GetRoutingMaterials` (ردیف‌های مؤثر ساختار با `fnStructureItems` + تخصیص)، `GetRoutingOutputCoverage`، `GetRoutingStages`، `GetRoutingBatchAttributes` |
| ME-05 | `GetRoutingRecoveries`، `GetRecoveredMaterialCoverage` |
| ME-06 | `GetMaterialPolicies`، `GetPolicyItems` |
| ME-07 | `GetOutsourcedOperations`، `GetRoutingSubcontracts` (کنترل قابلیت و نرخ RM-08)، `GetRoutingSubcontractItems`، `GetRoutingTollMaterials` |
| ME-08 | `GetManufacturingVersions`، `SelectManufacturingVersion` (انتخاب خودکار با دلیل رد) |
| ME-09 | `GetContinuousRoutings`، `GetShiftOrderTemplates`، `GetShiftHandoverRules` |
| ME-10 | `GetRoutingOperationActivities`، `GetRoutingOutputCostShares` |
| PE-07 | `GetConfigurationModels`، `GetConfigurationValues`، `GetConfigurationRules`، `GetConfigurationConditions`، `ResolveConfiguredStructure` (دو مجموعه‌ی نتیجه) |
| PC-01 | `GetProductionRequests`، `GetProductionRequestApprovals` (۲)، `CheckRequestFeasibility` (۲؛ با `@AsOf`) |
| PC-02 | `GetWorkOrders`، `GetWorkOrderOperations`، `GetWorkOrderMaterials`، `GetWorkOrderProducts`، `GetWorkOrderHistory` (۲) |
| PC-03 | `GetReleaseChecks`، `GetMaterialKits`، `GetMaterialExcessAndReturns` (۲)، `GetLineSideStock` |
| PC-04 | `GetProductionReports`، `GetProductionReportDetails` (۴)، `GetShiftReports` (۲) |
| PC-05 | `GetTerminals`، `GetTerminalQueue`، `GetOperationStoppages`، `GetParameterReadings`، `GetOperationChecklist`، `GetDeviceData` |
| PC-06 | `GetMaterialConsumption`، `GetConsumptionVariance`، `GetRecoveredBatchEligibility` |
| PC-07 | `GetProductReceipts`، `GetReceiptReconciliation` (۲)، `GetProductionBatches` (۲)، `GetBatchAttributeProgress`، `GetSerialSummary` (۲)، `GetSerialLookup` (۲)، `GetBatchTrace` (CTE بازگشتی تا ۶ سطح)، `GetGenealogyLinks` (۲)، `GetLabelTemplates` (۲) |
| PC-08 | `GetRecoveryExecution` (۳) |
| PC-09 | `GetNonconformingDispositions`، `GetReworkOrders` (۳)، `GetReworkChains`، `GetCopq` |
| PC-10 | `GetSubcontractOrders` (۲)، `GetSubcontractShipments` (۲)، `GetSubcontractReconciliation`، `GetTollStatement` (۲)، `GetOwnershipSeparation` (۲) — سه‌تای اول پارامتر اختیاری پیمانکار/قرارداد هم دارند (پورتال) |
| PC-11 | `GetPortalAccounts`، `GetTollOrderProgress` |
| PC-13 (BI) | `GetBiOrderFacts` (واقعیت هر دستور)، `GetBiEvents` (جریان رویداد یکپارچه‌ی ۲۰ نوع رخداد در بازه — پایه‌ی ماشین زمان)، `GetBiDailyLine` (ماتریس روز × خط) |
| PC-12 | `GetProductionDashboard` (۴)، `GetLiveExceptions` (۲؛ با `INSERT … EXEC GetConsumptionVariance`، پس خودش داخل `INSERT … EXEC` نمی‌رود)، `GetWorkOrderDeviations` (۲)، `GetWipSummary`، `GetCloseReadiness` (۲)، `GetCostingEventPreview` (۴) |
همه در اسکیمای `mes` هستند.

`GetCapacityLoadInScope` تقویم مؤثر هر خط را با `INSERT … EXEC mes.GetEffectiveCalendarInScope` می‌گیرد؛ پس خودش را نمی‌شود دوباره داخل `INSERT … EXEC` صدا زد (محدودیت SQL Server). API مستقیم صدایش می‌زند و مشکلی نیست؛ اگر رویه‌ی دیگری به خروجی آن نیاز پیدا کند، محاسبه‌ی تقویم مؤثر باید به یک تابع جدولی منتقل شود.

### ۴-۴. داده‌ی نمونه

همه‌ی داده‌های `mes` نمونه‌اند و برای شرکت ۲۲۲ ساخته شده‌اند:

- **سازمان:** مجموعه صنعتی گلرنگ ← هلدینگ دارویی ← داروسازی آریا شفا ← کارخانه شماره ۱ ← سالن جامدات و سالن نیمه‌جامد و شربت.
- **خطوط:** خط قرص‌سازی ۱ (۵ ایستگاه) و خط قرص‌سازی ۲ (۸ ایستگاه)، هر دو در سالن جامدات.
- **نیرو:** ۱۰ نفر، ۷ مهارت، ۳ گروه کاری، ۶ عملیات.
- **شیفت:** ۵ الگوی شیفت، ۳ چرخه، ۳ غیبت؛ تقویم گروه‌ها از ۱۱ مهر تا ۱۰ دی ۱۴۰۵ تولید شده.
- **تقویم:** ۲ تعریف تقویم، ۴ استثنا، ۳ رزرو نت.
- **علل:** ۹ گروه و ۲۰ علت توقف (یکی غیرفعال)، ۱۷ گره‌ی ضایعات، ۹ دوباره‌کاری، ۱۰ انحراف، ۶ زیان OEE و ۲۸ قاعده‌ی محدودسازی (نوع تجهیز «پرس» و «بسته‌بندی»، ایستگاه روکش‌دهی خط ۲، و دوباره‌کاری خط ۱).
- **هزینه‌یابی:** ۹ فعالیت، ۱۱ محرک، ۵ کارکرد مجاز به‌عنوان محرک، تسهیم سه منبع مشترک (گروه پرس‌ها، هواساز سالن جامدات، بخار). عمداً خراب: جمع ضرایب هواساز ۹۵٪ است، محرک بسته‌بندی بر پایه‌ی «هوای فشرده» (غیرمجاز) است و «نظافت بین بچ» محرک ندارد.
- **ساختار محصول:** ۸ ساختار (یک الگو، یک آزمایشی، یک پیش‌نویس؛ قرص سفید ساده دو ساختار دارد)، ۴۲ ردیف، ۱۰ نسخه با اعتبار تاریخ/بچ/سفارش‌محور، ۶ مدرک؛ گام ۱۰ شش کالای تازه (نشاسته، پوویدون، آب خالص، کراس‌کارملوز، اکسید آهن، بروشور) هم به کاتالوگ افزوده.
- **مهندسی محصول گام‌های ۱۲–۱۷:** ۴ گروه جایگزین (SG-FILL، SG-BIND، SG-DIS، SG-LUB)؛ خروجی‌های چندگانه با بازده برای BOM-2001 (جمع ۱۰۰٪) و BOM-2003؛ ۲ ماده‌ی بازیافتی (RC-ETH، RC-GRN) و اتانول بازیافتی ۲۷٫۳۶ لیتر از BOM-2001؛ دو ساختار ماتریسی (BOM-4004 کپسول بر حسب اندازه و رنگ، BOM-4003 کارتن بر حسب اندازه)؛ ۴ ECO (دو اجراشده، ECO-1405-0102 «K30 ← K25» منتظر امضای مدیر فنی، ECO-1405-0109 در تحلیل اثر). کالاهای تازه: 2005–2007، 3009، 3011–3020، 5002، 5003.
- **کتابخانه‌ی عملیات (گام ۱۸):** ۹ گروه در سه سطح، ۱۴ عملیات (۸ تازه، یکی منسوخ) با هر شش ماهیت، ۱۳ منبع اصلی/جایگزین، ۴ ابزار، ۷ انرژی، ۴ الزام مهارت تازه، ۱۲ دستورالعمل (۴ نوع رسانه، با نسخه‌ی منسوخ و پیش‌نویس) و ۱۷ پارامتر فرایندی.
- **مهندسی تولید (گام‌های ۱۹–۲۷):** ۹ روش ساخت (یک الگو، دو نسخه‌ی RT-1001، یک پیش‌نویس R&D، یک تک‌مرحله‌ای، یک کارمزدی دریافتی، یک پیوسته) با ۴۴ عملیات، گراف با شاخه‌ی موازی ۷۰/۳۰ و هم‌پوشانی، ۴ جایگزین؛ زمان و کارکرد، تخصیص مواد و خروجی، یک عملیات بازیابی، ۹ لایه‌ی سیاست مواد، ۳ پیمانکار روکش، ۱۱ نسخه‌ی تولید، ۳ الگوی شیفتی؛ و مدل پیکربندی CFG-1001 (۴ ویژگی، ۳ قاعده، ۶ شرط).
- **کنترل تولید (گام‌های ۳۱–۴۲) — یک روز یکپارچه‌ی کارخانه، ساعت سناریو ۱۷ مهر ۱۴۰۵ ساعت ۱۱:۳۰ (`mes.fnShopNow`):** ۹ درخواست (PR-1405-0309 تا 0317)، ۱۵ دستور کار (WO-1405-0498 تا 0513) از همه‌ی انواع — بسته، تکمیل، در جریان، آزاد، برنامه‌ای، شیفتی پیوسته (M/E/N)، دوباره‌کاری، بازیافت، کارمزدی، R&D، باطل — با عملیات و مواد ساخته‌شده از روش و ساختار واقعی نسخه‌ی تولید؛ روی همین دستورها کیت و انتقال پای کار، ۴۶ گزارش تولید با کارکرد و ضایعات، ۶ ترمینال و داده‌ی PLC، ۶۶ ردیف مصرف، رسید و بچ و ۱۴٬۸۱۷ سریال (کارتن و شیپر)، شجره‌ی بچ از ردیف‌های مصرف، بازیابی اتانول با موازنه، ۳۸ تعیین تکلیف نامنطبق با COPQ، برون‌سپاری روکش به پارس‌دارو و کارمزدی دریافتی فارمد، ۴ حساب پورتال، ۱۱ قاعده‌ی استثنا و ۵ انحراف با اقدام اصلاحی. موجودی در `MaterialStock` (۳۳ بچ).- **کالا:** ۱۸ کالای کاتالوگ (۲ تا بدون نقش تولیدی)، ۱۶ قلم تولیدی، ۱۹ سیاست تأمین، ۶ ویژگی و ۱۰ مقدار، ۴ بُعد و ۱۳ ترکیب (کپسول خالی ۳×۳ و کارتن ۲×۲)، ۸ اندازه‌ی بچ.
- **پیمانکاران:** ۴ پیمانکار (یکی غیرفعال، یکی در تعلیق)، ۶ قابلیت، ۸ نرخ (یکی با سابقه‌ی تغییر)، ۳ انبار امانی.
- **ظرفیت:** ۱۱ نوع کارکرد (یکی غیرفعال)، ۳۰ ردیف ظرفیت (از جمله ۳ نسخه‌ی قدیمی و یک نسخه‌ی آینده)، ۹ نرخ محصول، و بار نمونه از ۱۱ مهر تا ۱۰ دی که از روی تقویم مؤثر ساخته شده.

چند مورد عمداً «خراب» گذاشته شده تا رفتار فرم‌ها دیده شود: ابزار نزدیک پایان عمر، نقض هم‌زمانی یک نفر، مهارت منقضی، کسری نفر در دو روز، شیفت برنامه‌ریزی‌شده روی یک تعطیل رسمی، گروه پرس خط ۲ با بار بالای ۱۰۰٪، بسته‌بندی هر دو خط نزدیک سقف، بازرسی بصری خط ۲ که بار دارد ولی ظرفیتی برایش تعریف نشده، دو علت بدون نگاشت OEE («کمبود مواد اولیه» و «لکه‌ی روکش غیرقابل اصلاح»)، و در پیمانکاران: قرارداد «بسته‌بندی نوین البرز» کمتر از ۶۰ روز مانده و تأیید صلاحیتش گذشته، همین پیمانکار برای روکش‌دهی نرخ دارد بی‌آنکه قابلیتش ثبت شده باشد، و «گرانول‌سازی تهران» در تعلیق است و انبار امانی ندارد؛ در کالاها: «قرص رنگی اطفال» محصول نهایی بدون ردیابی بچ و بدون اندازه‌ی بچ است، «پیش‌مخلوط رنگ» فانتوم با ردیابی بچ است، و گرانول قرص سفید سیاست پشتیبان برون‌سپاری به همان پیمانکار تعلیق‌شده دارد؛ در ساختارها: جمع درصد «پیش‌مخلوط رنگ» ۹۸٫۵٪ است، پروانه‌ی ساخت قرص روکش‌دار منقضی شده، و ساختار آزمایشی قرص ۱۰۰۰ برای کالایی است که نقش تولیدی ندارد؛ در جایگزین‌ها: SG-DIS دو گزینه با اولویت یکسان دارد، SG-LUB در هیچ ساختاری به کار نرفته و یکی از اعضایش (P-3020) نقش تولیدی ندارد، و ردیف منیزیم استئارات در BOM-1001-A اشتباهاً به گروه پرکننده (SG-FILL) وصل است؛ در خروجی‌ها: جمع بازده BOM-2003 ۹۷٪ است (خطای موازنه‌ی جرم)؛ در بازیافت: پاراستامول اجازه‌ی ۱۵٪ مصرف بازیافتی دارد ولی ماده‌ی بازیافتی‌اش تعریف نشده؛ در ماتریس: دی‌اکسید تیتانیوم برای رنگ BW مقدار ندارد؛ در ECO: ECO-1405-0109 هنوز تاریخ اثر و سیاست موجودی ندارد؛ در عملیات: «خشک‌کن بستر سیال» و «تقطیر و بازیافت حلال» تولیدی‌اند ولی منبع ندارند، «گرانولاسیون» فقط دستورالعمل پیش‌نویس دارد، SOP-PRS-014 دو نسخه‌ی تأییدشده‌ی هم‌زمان دارد، دمای هوای ورودی روکش‌دهی هدف ۶۲ با حد بالای ۶۰ است، تقطیر از «گاز» غیرفعال استفاده می‌کند و گروه ابزار «توری و الک» ابزار ثبت‌شده ندارد؛ در روش‌ها (ME-02): RT-1005 حلقه‌ی پرس ↔ بازرسی، عملیات یتیم، خشک‌کن بی‌منبع و بسته‌بندی بی‌خروجی دارد؛ در زمان (ME-03): الک RT-1001 v2 زمان ندارد، کارکرد پلکانی بی‌پله، دسته‌ی انتقال بزرگ‌تر از بچ و پرس B بی‌ماتریس تعویض؛ در مواد (ME-04): بروشور بی‌عملیات، فویل ۱۲۰٪ و تأیید LOD بی‌تعیین‌کننده؛ در بازیابی (ME-05): نرخ ۷۶٪ در برابر ۸۰٪ و بازگشت مستقیم با الزام QC؛ در سیاست (ME-06): پاراستامول عیاردار با Backflush، حداقل پای کار بیشتر از حداکثر و موجودی منفی اتانول؛ در برون‌سپاری (ME-07): پیمانکار بی‌قابلیت، پیمانکار غیرفعال و قلم کارمزدی بی‌مالکیت؛ در نسخه‌ها (ME-08): نسخه‌ی فعال روی روش منسوخ، روش اختصاص‌نیافته به ساختار و هم‌پوشانی بازه با اولویت یکسان؛ در پیوسته (ME-09): برنامه‌ی شیفت شب بالاتر از ظرفیت و خشک‌کن بی‌قاعده‌ی انتقال؛ در هزینه (ME-10): «نظافت بین بچ» بی‌محرک و سهم خروجی‌های خشک‌کن پیوسته ۹۹٪؛ در پیکربندی (PE-07): ویژگی بی‌اثر و سه قلم شرطی بی‌نقش تولیدی. بسته‌بندی خط ۱ از ۱ آذر نسخه‌ی تازه‌ی ظرفیت (دستگاه دوم) دارد و بارش از همان روز نصف می‌شود.

در کنترل تولید عمداً خراب: PR-0316 برای کالای بی‌ساختار، PR-0317 تأییدشده بی‌دستور با کسری پوویدون؛ پرس خط ۱ از دستور کارمزدی گرفته و به دستور فوری WO-0501 داده شده؛ دو دستور هم‌زمان روی خشک‌کن خط ۲ (هم‌پوشانی ایستگاه)؛ ابزار نزدیک پایان عمر و بچ قرنطینه در پیش‌شرط آزادسازی؛ پایانه‌ی پرس خط ۱ برون‌خط با ۳ رکورد معوق؛ توقف باز شکستگی پانچ؛ وزن قرص و دمای سیل خارج از حد؛ اختلاف ۱٫۶۳٪ داده‌ی دستگاه بی‌توضیح؛ گرانول ۴٪ بیش از استاندارد، پاراستامول عیاردار Backflush در دستور پیوسته، کسری بروشور جزئی، آب WO-0499 ثبت‌نشده؛ رسید ۶ کیلو بیش از گزارش، ریزدانه‌ی جانبی بی‌رسید، دروازه‌ی QC بی‌مقدار، شکاف شجره (مصرف بی‌بچ) و سهم تخمینی؛ بازیابی ۶۲٪ با شکاف موازنه‌ی ۲۱٪ و بچ زیر حداقل خلوص، شکاف موازنه‌ی جرم پیوسته ۲٫۴٪؛ دوباره‌کاری دوم یک بچ بیش از سقف، بلیستر ناقص بی‌تصمیم، ضایعات امانی بی‌نظر مشتری، ضایعات پیمانکار بیش از حد مجاز؛ تأخیر ۲روزه‌ی پیمانکار، ۱٫۲ کیلو محلول روکش و ۲٫۵۴ کیلو گرانول امانی بی‌توضیح؛ حساب پورتال کارمند جداشده؛ مازاد HPMC برنگشته و درجه‌بندی اجرانشده که بستن دستور را قفل کرده‌اند، درخواست بازگشایی منتظر و اقدام اصلاحی سررسیدگذشته.
داده‌ی نمونه‌ی هر گام کنترل تولید وقتی ساخته می‌شود که جدول اصلی همان گام خالی باشد (`ProductionRequest`، `WorkOrder`، `WorkOrderOperationMaterialKit`، `WorkOrderOperationOutput`، `ShopFloorTerminal`، `WorkOrderOperationMaterialConsumed`، `ProductionBatch`، `WorkOrderMaterialBalance`، `NonconformingDisposition`، `SubcontractShipment`، `PortalAccount`، `ExceptionRule`)؛ گام‌ها به هم وابسته‌اند، پس برای ساختن دوباره‌ی یک گام، داده‌ی گام‌های بعدش هم باید پاک و به‌ترتیب دوباره اجرا شود.

داده‌ی نمونه‌ی گام ۱۸ وقتی ساخته می‌شود که `mes.ProductionOperationParameter` خالی باشد؛ گام‌های ۱۹ تا ۲۸ به‌ترتیب وقتی که `RoutingMaster`، `RoutingOperationTiming`، `RoutingOperationMaterial`، `RoutingOperationRecovery`، `ProductionMaterialPolicy`، `RoutingOperationSubcontract`، `ManufacturingVersion`، `ShiftOrderTemplate`، `RoutingOperationActivity` و `ProductConfigurationModel` خالی باشند. داده‌ی نمونه‌ی گام‌های ۱۲ تا ۱۷ به‌ترتیب وقتی ساخته می‌شود که `mes.SubstituteGroup`، ردیف خروجی غیراصلی در `mes.ProductStructureMaster`، `mes.RecoveredMaterial`، `mes.ProductStructureItemDimensionValue` و `mes.EngineeringChangeOrder` خالی باشند (گام ۱۶ داده ندارد). داده‌ی نمونه‌ی گام ۱۱ فقط وقتی ساخته می‌شود که `mes.ProductionActivity` خالی باشد، گام ۱۰ وقتی `mes.ProductStructure` خالی باشد، گام ۹ وقتی `mes.Product` خالی باشد، گام ۸ وقتی `mes.ProductionContractor` خالی باشد، و گام ۷ وقتی `mes.OeeLoss` خالی باشد. داده‌ی نمونه‌ی گام ۶ فقط وقتی ساخته می‌شود که `mes.CapacityType` خالی باشد؛ برای ساختن دوباره، چهار جدول این گام را خالی کنید و اسکریپت را دوباره اجرا کنید.

---

## ۵. API — `gng-mfr-api/server.js`

### نشست و اتصال

| روش | نشانی | کار |
|---|---|---|
| GET | `/api/health` | سلامت سرویس |
| GET | `/api/auth-modes` | روش‌های احراز هویت در دسترس |
| GET / DELETE | `/api/connections`، `/api/connections/:id` | اتصال‌های به‌خاطرسپرده |
| POST | `/api/connect` | باز کردن نشست و گرفتن توکن |
| GET / DELETE | `/api/session` | وضعیت نشست / بستن آن |

### ALM

| روش | نشانی | کار |
|---|---|---|
| GET | `/api/alm/systems` | فهرست سیستم‌ها (سطح صفر منو) |
| GET | `/api/alm/menu?subSystemCode=` | درخت منوی یک سیستم |
| GET | `/api/alm/forms/:formCode` | شناسنامه‌ی فرم: مشخصات، فیچرها، دسترسی، عملیات |
| GET | `/api/alm/forms/:formCode/coverage` | خلاصه‌ی پوشش: کل، پیاده‌شده، تحویل‌شده |

### فرم‌های مدیریت منابع

| روش | نشانی | کار |
|---|---|---|
| GET | `/api/rm01/org-tree`، `/lines`، `/topology`، `/lines/:id/ancestry`، `/lines/:id/topology`، `/org-nodes/:id/ancestry`، `/resource-groups`، `/mobile-resources`، `/line-side-warehouses` | داده‌ی FRM-RM-01 |
| GET | `/api/rm02/bundle` | همه‌ی تب‌های FRM-RM-02 در یک درخواست |
| GET | `/api/rm03/bundle` | همه‌ی تب‌های FRM-RM-03 |
| GET | `/api/rm04/bundle` | همه‌ی تب‌های FRM-RM-04 (با پنجره‌ی زمانی) |
| GET | `/api/rm05/bundle` | همه‌ی تب‌های FRM-RM-05 (با پنجره‌ی زمانی) |
| GET | `/api/rm06/bundle` | همه‌ی تب‌های FRM-RM-06 (با پنجره‌ی زمانی؛ ظرفیت «جاری» نسبت به ابتدای پنجره) |
| GET | `/api/rm07/bundle` | همه‌ی تب‌های FRM-RM-07 (درخت علل و نگاشت OEE مشترک؛ قواعد و فهرست مجاز محدود به دامنه) |
| GET | `/api/rm08/bundle?contractorId=` | همه‌ی تب‌های FRM-RM-08؛ دامنه یک پیمانکار است (خالی = همه)، نه درخت سازمانی |
| GET | `/api/rm09/bundle` | همه‌ی تب‌های FRM-RM-09 (داده‌ی پایه‌ی شرکت، بدون دامنه) |
| GET | `/api/pe01/bundle?productId=` | همه‌ی تب‌های FRM-PE-01؛ دامنه یک کالاست (خالی = همه) |
| GET | `/api/pe02/structures` | فهرست ساختارها |
| GET | `/api/pe02/structures/:id?revisionId=` | جزئیات یک ساختار در یک نسخه (خالی = نسخه‌ی جاری) |
| GET | `/api/pe02/diff?left=&leftRevision=&right=&rightRevision=` | مقایسه‌ی دو ساختار یا دو نسخه |
| GET | `/api/pe03/bundle?groupId=` | همه‌ی تب‌های FRM-PE-03؛ گزینه‌ها برای گروه انتخاب‌شده |
| GET | `/api/pe04/bundle` | خروجی‌های همه‌ی ساختارها با بازده و سهم هزینه |
| GET | `/api/pe05/bundle` | سیاست، مواد بازیافتی، ردیف‌های فرمولی و خروجی‌های بازیافتی |
| GET | `/api/pe06/bundle?structureId=` | ساختارهای ماتریسی؛ ردیف‌ها و واریانت‌های مشتق یک ساختار (خالی = اولی) |
| GET | `/api/pe08/explode?structureId=&quantity=&applyWaste=` | بسط چندسطحی |
| GET | `/api/pe08/where-used?productId=&multi=` | کاربرد معکوس |
| GET | `/api/pe08/cycles` | کنترل حلقه‌ی بازگشتی |
| GET | `/api/me01/bundle` | همه‌ی تب‌های FRM-ME-01 (کل کتابخانه؛ فیلتر گروه/عملیات سمت فرانت) |
| GET | `/api/me02/bundle` … `/api/me10/bundle` | همه‌ی تب‌های هر فرم مهندسی تولید (داده‌ی پایه‌ی شرکت؛ انتخاب روش سمت فرانت). با کمک‌تابع `companyBundle` در `server.js` |
| GET | `/api/me08/select?productId=&lineId=&quantity=&date=&orderType=` | انتخاب خودکار نسخه‌ی تولید با دلیل رد هر نسخه (فقط‌خواندنی) |
| GET | `/api/pe07/bundle` | همه‌ی تب‌های FRM-PE-07 |
| GET | `/api/pe07/resolve?modelId=&values=` | ساختار مؤثر و نقض قواعد برای یک ترکیب انتخاب (فقط‌خواندنی) |
| GET | `/api/pe09/bundle?ecoId=` | فهرست ECOها و برای یکی (خالی = اولین منتظر تأیید) دامنه، امضاها، اطلاع‌رسانی و تحلیل اثر |

### فرم‌های کنترل تولید

بسته‌ها با کمک‌تابع `companySets` ساخته می‌شوند: مثل `companyBundle`، ولی هر کلید می‌تواند `[رویه، [نام هر مجموعه‌ی نتیجه]]` باشد تا رویه‌های چندخروجی در یک درخواست بیایند.

| روش | نشانی | کار |
|---|---|---|
| GET | `/api/pc01/bundle` … `/api/pc12/bundle` | همه‌ی داده‌ی هر فرم کنترل تولید (شرکت؛ انتخاب سمت فرانت) |
| GET | `/api/pc01/feasibility?requestId=&asOf=` | امکان‌سنجی یک درخواست در تاریخ دلخواه |
| GET | `/api/pc07/trace?batch=&direction=1\|2` | ردیابی پس‌رو (اجزا) یا پیش‌رو (مصرف‌کننده‌ها)ی یک بچ |
| GET | `/api/pc07/serial?serial=` | یک سریال با والد و تا ۲۰۰ فرزند |
| GET | `/api/pc11/view?accountId=` | نمای پورتال یک حساب؛ طرف (پیمانکار/قرارداد) از خود حساب در دیتابیس خوانده می‌شود و کارمزد بی‌مجوز `null` می‌شود |
| GET | `/api/pc12/costing?workOrderId=` | پیش‌نمایش رویداد بستن برای بهای تمام‌شده (چیزی ارسال نمی‌شود) |
| GET | `/api/pe10/bundle`، `/api/me11/bundle` | BI مهندسی محصول و مهندسی تولید (هر کدام یک درخواست؛ شبیه‌سازی سمت فرانت) |
| GET | `/api/pc13/bundle?from=&to=` | همه‌ی داده‌ی BI جلسه‌ی هفتگی در یک درخواست: واقعیت دستورها، جریان رویداد و ماتریس روز×خط در بازه، به‌اضافه‌ی هشدارها، انحراف‌ها، COPQ، انحراف مصرف، نامنطبق‌ها، مواد، عملیات، مغایرت رسید، برون‌سپاری و آمادگی بستن |

### سرویس‌ها و ابزارها

| روش | نشانی | کار |
|---|---|---|
| GET | `/api/pp/effective-calendar` | سرویس تقویم مؤثر برای برنامه‌ریزی تولید |
| GET | `/api/db-compare/schemas` | فهرست اسکیماهای دارای جدول |
| GET | `/api/db-compare/tables?schemas=a,b` | جدول‌ها و ستون‌های آن اسکیماها |
| GET | `/api/_inspect/:key` | «منبع داده‌ی زنده»: متن رویه و ۲۰ ردیف نمونه‌ی جدول پشت هر گرید |
| GET | `/api/debug/schema-counts` | شمارش جدول‌های `mfr` و `generalmfr` (عیب‌یابی) |

نکته‌ی امنیتی: نام جدول و رویه هیچ‌وقت از مرورگر نمی‌آید. `/api/_inspect` فقط یک «کلید» می‌گیرد که در رجیستری سمت سرور تعریف شده، و مقدارهای ورودی همیشه با پارامتر به SQL می‌روند.

---

## ۶. فرانت‌اند — `gng-mfr-app/src/app`

```
app.routes.ts                     مسیرها: login، dashboard، forms/:formCode، alm/forms/:formCode، db-compare
core/
  api-config.ts                   آدرس API
  session.service.ts              نشست اتصال
  session.interceptor.ts          افزودن توکن به درخواست‌ها
  services/menu.service.ts        منو از alm.Menu
  services/alm-form-spec.service.ts   شناسنامه و پوشش فرم
layout/
  shell/  sidebar-menu/  topbar/  قاب برنامه، منوی کناری، نوار بالا
pages/login/                      صفحه‌ی ورود
shared/
  operational-form-layout/        قاب مشترک فرم‌های پیاده‌شده (سربرگ، بنر، تب‌ها، پنل درخت)
  form-shell/                     قاب عمومی فرم‌های هنوز‌پیاده‌نشده
  form-code-chip/                 دکمه‌ی کد فرم با نشان پوشش
  data-source-badge/              دکمه‌ی سه‌نقطه‌ی «منبع داده‌ی زنده» گوشه‌ی هر گرید
  topology-graph/                 نمودار SVG توپولوژی خط
features/
  dashboard/
  alm/                            صفحه‌ی شناسنامه‌ی فرم
  db-compare/                     ابزار بررسی دیتابیس
  forms/
    form-page.component.ts        هر کد فرم را به کامپوننت خودش می‌رساند
    data/forms-registry.ts        نگاشت کد فرم ← کامپوننت
    data/{rm,pe,me,pc,pf}-forms.data.ts   تعریف فرم‌های هر حوزه
    rm/
      rm-scope.ts                 دامنه‌ی انتخاب و ساخت درخت
      rm-time.ts                  کمک‌تابع‌های زمان و تاریخ شمسی
      frm-rm-0N.{component.ts,component.html,service.ts,data.ts}
    pe/ me/                       فرم‌های پیاده‌شده‌ی مهندسی محصول و تولید (همان الگوی چهار فایل)
      me/me-routing.ts            مشترک ME-02 تا ME-10: ردیف روش، کدهای موقت، درخت پنل کناری روش‌ها
    pc/                           فرم‌های پیاده‌شده‌ی کنترل تولید؛ pc/pc-shared.ts: ساعت سناریو، قالب‌بندی فارسی، کدهای موقت، بارکد Code 39
    pf/                           فرم‌های پروتوتایپ
styles.scss، styles/_theme.scss   کلاس‌های مشترک و رنگ‌های تم (--gng-*)
```

الگوی هر فرم پیاده‌شده چهار فایل است:

| فایل | نقش |
|---|---|
| `*.data.ts` | شکل ردیف‌هایی که قالب نمایش می‌دهد |
| `*.service.ts` | گرفتن داده از API و تبدیل به شکل نمایش |
| `*.component.ts` | انتخاب درخت، بارگذاری، متن بنر |
| `*.component.html` | تب‌ها و جدول‌ها |

افزودن فرم جدید به مسیر تازه نیاز ندارد؛ کافی است کامپوننتش در `forms-registry.ts` ثبت شود.

---

## ۷. فرم‌ها

### ۷-۱. فهرست کامل (۴۷ فرم)

**مدیریت منابع (RM) — ۹ فرم**

| کد | عنوان | وضعیت |
|---|---|---|
| FRM-RM-01 | ساختار کارخانه و خطوط تولید | داده‌ی واقعی |
| FRM-RM-02 | تجهیزات، ابزار و قالب | داده‌ی واقعی |
| FRM-RM-03 | نیروی کار و ماتریس مهارت | داده‌ی واقعی |
| FRM-RM-04 | شیفت و برنامه‌ی حضور | داده‌ی واقعی |
| FRM-RM-05 | تقویم تولید | داده‌ی واقعی |
| FRM-RM-06 | کارکرد استاندارد و ظرفیت | داده‌ی واقعی |
| FRM-RM-07 | طبقه‌بندی علل | داده‌ی واقعی |
| FRM-RM-08 | پیمانکاران تولید | داده‌ی واقعی |
| FRM-RM-09 | مبانی هزینه‌یابی و ABC | داده‌ی واقعی — استثنای فاز اول به درخواست کاربر (۱۷ مهر) |

**مهندسی محصول (PE) — ۹ فرم، همه داده‌ی واقعی**

FRM-PE-01 ویژگی‌های تولیدی قلم · 02 ساختار محصول · 03 گروه جایگزین و سیاست جایگزینی · 04 خروجی‌های ساختار و بازدهی · 05 بازیابی مواد در فرایند · 06 ساختار ماتریسی و اقلام ابعادی · 07 پیکربندی محصول (استثنا به درخواست کاربر) · 08 نماها و محاسبات ساختار · 09 مدیریت تغییر مهندسی (ECO)

**مهندسی تولید (ME) — ۱۰ فرم، همه داده‌ی واقعی (ME-10 استثنا به درخواست کاربر)**

FRM-ME-01 کتابخانه‌ی عملیات · 02 روش ساخت · 03 کارکرد استاندارد و زمان عملیات · 04 اقلام و خروجی در سطح عملیات · 05 عملیات بازیابی مواد · 06 سیاست‌های تغذیه، مصرف و رسید · 07 برون‌سپاری و کارمزدی · 08 نسخه‌ی تولید · 09 تولید پیوسته و کمپین · 10 فعالیت و محرک هزینه‌ی عملیات

**کنترل تولید (PC) — ۱۲ فرم، همه داده‌ی واقعی (فقط‌خواندنی، ۱۸ مهر)**

FRM-PC-01 درخواست تولید · 02 دستور کار · 03 آزادسازی، شارژ و تغذیه‌ی پای کار · 04 گزارش تولید · 05 ترمینال کف کارگاه · 06 مصرف مواد · 07 رسید محصول و هویت‌بخشی · 08 بازیابی مواد در اجرا · 09 ضایعات، دوباره‌کاری و بازیافت · 10 اجرای برون‌سپاری و کارمزدی · 11 پورتال پیمانکار و مشتری کارمزدی · 12 کنسول پایش و بستن دستور

**چارچوب مشترک (PF) — ۷ فرم، همه پروتوتایپ**

FRM-PF-01 کنسول پیکربندی پلتفرم · 02 مدیریت نسخه، اعتبار و تغییر مهندسی · 03 طراح گردش کار و دسترسی · 04 استودیوی توسعه‌پذیری · 05 مرکز یکپارچگی · 06 انطباق و ممیزی · 07 مدیریت نیازمندی و ماتریس ردیابی

### ۷-۲. FRM-RM-01 — ساختار کارخانه و خطوط تولید

- **تب‌ها:** سلسله‌مراتب سازمانی · خط تولید و توپولوژی · ایستگاه کاری · گروه منبع · منبع سیار · انبار پای کار.
- **نکته‌ی اصلی:** با انتخاب هر گره در درخت، توپولوژی همه‌ی خطوط زیر آن، هر کدام در یک نمودار جدا، نمایش داده می‌شود.
- **توپولوژی به شکل گراف:** ایستگاه‌ها گره و `WorkCenterLink` یال است (اصلی، دوباره‌کاری، بای‌پس). نمودار SVG چیدمان خودکار راست‌به‌چپ دارد و می‌تواند مختصات صریح هم بگیرد — پایه‌ای برای نقشه‌ی گرافیکی کارخانه در آینده.
- **پوشش:** ۱۰ از ۱۰ فیچر. ویرایشگر گرافیکی (درگ‌اند‌دراپ) فقط نمای نمایشی‌اش آماده است.

### ۷-۳. FRM-RM-02 — تجهیزات، ابزار و قالب

- **تب‌ها:** تجهیز و سلسله‌مراتب · ویژگی‌های فنی · قابلیت تجهیز · ابزار و قالب · کارکرد تجمعی · ماتریس زمان تعویض · نسخه‌ی برنامه‌ی دستگاه.
- **بنر:** ابزار بالای ۹۰٪ عمر مفید (خطر)، تجهیز خارج از دسترس (هشدار).
- **وضعیت نت:** از ردیف جاری `EquipmentAvailability` خوانده می‌شود.
- **پوشش:** ۹ از ۹ فیچر. کنترل ابزار هنگام آزادسازی سفارش، ارسال کارکرد به نت و دریافت رویدادی وضعیت از نت هنوز نیست.

### ۷-۴. FRM-RM-03 — نیروی کار و ماتریس مهارت

- **تب‌ها:** پرسنل تولید · مهارت‌ها (با الزام مهارت عملیات) · ماتریس مهارت · گروه کاری (با محدودیت هم‌زمانی) · نرخ و محرک هزینه (پیاده نشده).
- **ماتریس مهارت:** نفر × مهارت با سطح ۱ تا ۴ و علامت منقضی / موعد بازآموزی گذشته / نزدیک موعد.
- **هم‌زمانی:** نفری که بیش از سقف ایستگاه هم‌زمان یا بالای ۱۰۰٪ اشتغال دارد «نقض» نشان داده می‌شود.
- **«چندمهارته»:** نفری با سطح مستقل به بالا در دست‌کم دو مهارت عملیاتی.
- **پوشش:** ۵ از ۶ فیچر. نرخ ساعتی و محرک هزینه (F-RM-028، مهم، فاز ۳) نیامده.

### ۷-۵. FRM-RM-04 — شیفت و برنامه‌ی حضور

- **تب‌ها:** الگوی شیفت (با نمای ۲۴ساعته) · چرخه‌ی شیفت · برنامه‌ی حضور · غیبت و جایگزینی.
- **برنامه‌ی حضور:** جدول گروه × روز در پنجره‌ی ۱۴روزه‌ی قابل جابه‌جایی؛ زیر هر شیفت «حاضر / برنامه‌ای».
- **تولید خودکار تقویم:** رویه‌ی `mes.GenerateShiftCalendar` تقویم گروه‌ها را از چرخه می‌سازد. دکمه‌ی آن در فرم هنوز وصل نیست.
- **پوشش:** ۳ از ۴ فیچر. دریافت حضور و غیاب واقعی از HR (F-RM-027، مهم، فاز ۳) نیامده.

### ۷-۶. FRM-RM-05 — تقویم تولید

- **تب‌ها:** تعریف تقویم (با ارث‌بری) · تقویم مؤثر · استثناها · رزرو نت · سناریو (پیاده نشده).
- **تقویم مؤثر:** برای هر خط، شش لایه در هر روز: پایه، شیفت، استثنا، رزرو نت، نفر، در دسترس.
- **فرمول:** در دسترس = کمینه‌ی (پایه، شیفت) − تعطیلی جزئی − رزرو نت.
- **سرویس PP:** همان خروجی از `/api/pp/effective-calendar` در اختیار برنامه‌ریزی تولید است.
- **پوشش:** ۶ از ۸ فیچر. ویرایش روی گانت (035) و سناریو (036) — هر دو مهم، فاز ۳ — نیامده‌اند.

### ۷-۷. FRM-RM-06 — کارکرد استاندارد و ظرفیت

- **تب‌ها:** انواع کارکرد · ظرفیت منبع · در دسترس‌بودن · ظرفیت وابسته به محصول · محدودیت متقابل (پیاده نشده) · نمای بار/ظرفیت · سابقه‌ی تغییرات.
- **انواع کارکرد پویا:** همان محدودیتی که ALM برای این فرم نوشته («انواع کارکرد پویا، نه ثابت») برداشته شد: ماشین‌ساعت و نفرساعت دیگر ستون ثابت نیستند، دو نوع «پایه» از یک فهرست قابل‌تعریف‌اند.
- **مبنای اندازه‌گیری:** زمان‌محور (تعداد واحد هم‌زمان × ساعت)، نرخی (مقدار در ساعت)، ثابت (مثل حجم مخزن؛ در نمای بار نمی‌آید).
- **ظرفیت روزانه:** (دقیقه‌ی در دسترسِ تقویم مؤثر خط − تعداد شیفت × توقف استاندارد) ÷ ۶۰ × (تعداد در دسترس | نرخ) × درصد در دسترس‌بودن × درصد بهره‌وری. همان فرمول `MachineCapacity` نسخه‌ی قبل، این‌بار روی تقویم مؤثر.
- **گروه منبع:** ظرفیت می‌تواند روی گروه تعریف شود (مثلاً دو پرس موازی خط ۲). زمان در دسترس گروه بیشینه‌ی خطوط اعضاست. با انتخاب یک ایستگاه، ظرفیت گروهش هم می‌آید.
- **تخصیص بار:** بار هر ایستگاه به خودش می‌رسد اگر ظرفیت آن نوع کارکرد را دارد؛ وگرنه به گروه منبعش؛ وگرنه «بدون ظرفیت» نشان داده می‌شود.
- **نمای بار:** منبع × نوع کارکرد × روز در پنجره‌ی ۱۴روزه، با درصد و رنگ (زیر ۹۰٪، ۹۰ تا ۱۰۰٪، بالای ۱۰۰٪، بدون ظرفیت). ظرفیت‌های بی‌بار پیش‌فرض پنهان‌اند.
- **بنر:** اول گلوگاه (بالای ۱۰۰٪)، بعد بارِ بدون ظرفیت، بعد منابع نزدیک سقف.
- **سابقه:** نسخه‌های ظرفیت و نرخ محصول با مقدار قبلی، درصد تغییر، علت و ثبت‌کننده؛ نسخه‌ی آینده علامت می‌خورد.
- **پوشش:** ۷ از ۹ فیچر. محدودیت متقابل منابع (043) و بازخورد واقعی به استاندارد با گردش تأیید (045) — هر دو مهم، فاز ۳ — نیامده‌اند.

### ۷-۸. FRM-RM-07 — طبقه‌بندی علل

- **تب‌ها:** علل توقف · نگاشت شش زیان OEE · علل ضایعات · علل دوباره‌کاری و انحراف · محدودسازی به‌ازای منبع · اقدام اصلاحی (پیاده نشده).
- **یک فرم درختی:** طبق یادداشت ALM، هر دسته یک تب است، نه فرم جدا. هر چهار دسته با یک تابع (`fnReasonNodes`) به یک شکل «گره‌ی درخت» درمی‌آیند و در فرانت‌اند با یک قالب TreeTable نمایش داده می‌شوند.
- **علل توقف:** نوع توقف (برنامه‌ریزی‌شده/نشده) جدا از «خارج از OEE» است: تعویض قالب برنامه‌ریزی‌شده است ولی زیان «راه‌اندازی و تعویض» به حساب می‌آید؛ استراحت و نت برنامه‌ریزی‌شده خارج از OEE‌اند.
- **شش زیان:** خرابی و راه‌اندازی (در دسترس‌بودن)، توقف کوتاه و کاهش سرعت (عملکرد)، ضایعات راه‌اندازی و فرایند (کیفیت). علت توقفِ داخل OEE یا ضایعات محصولی که نگاشت نشده باشد در بنر هشدار می‌گیرد.
- **محدودسازی:** قاعده یک گره (و زیرشاخه‌هایش) را برای یک خط، نوع تجهیز یا ایستگاه مجاز می‌کند. برای هر «ایستگاه × دسته» دقیق‌ترین سطح دارای قاعده برنده است (ایستگاه ← نوع تجهیز ← خط)؛ بدون قاعده همه‌ی علل مجازند. نوع تجهیز از تجهیزات نصب‌شده روی ایستگاه (`WorkCenterEquipment`) می‌آید.
- **دامنه:** درخت علل بین همه‌ی منابع مشترک است. درخت سازمانی سمت راست قواعد و ماتریس «ایستگاه × دسته» را محدود می‌کند؛ با انتخاب یک ایستگاه، مجاز بودن هر علت در همه‌ی درخت‌ها علامت می‌خورد.
- **پوشش:** ۶ از ۷ فیچر. ارتباط علت با اقدام اصلاحی و مسئول (052، مهم، فاز ۳) نیامده.

### ۷-۹. FRM-RM-08 — پیمانکاران تولید

- **تب‌ها:** پیمانکار · قابلیت · نرخ و زمان تحویل · انبار امانی · ظرفیت در نمای کل (پیاده نشده) · ارزیابی عملکرد (پیاده نشده).
- **دامنه:** پیمانکار در درخت سازمانی نیست؛ پنل کناری این فرم فهرست پیمانکاران است («همه» یا یکی) و همه‌ی تب‌ها با آن فیلتر می‌شوند.
- **بنر:** پیمانکار تعلیق‌شده، قرارداد تمام‌شده یا کمتر از ۶۰ روز مانده، تأیید صلاحیت منقضی، نرخِ بدون قابلیت، و پیمانکار کارمزدیِ بدون انبار امانی.
- **پوشش:** ۴ از ۶ فیچر. ظرفیت پیمانکار در نمای ظرفیت کل (058، مهم، فاز ۳) و ارزیابی عملکرد (059، مطلوب، فاز ۴) نیامده‌اند.

### ۷-۹-۱. FRM-RM-09 — مبانی هزینه‌یابی و ABC

- **استثنا:** همه‌ی ۵ فیچر «مهم، فاز ۳»اند؛ کاربر ۱۷ مهر صریحاً ساختنش را خواست. یادداشت ALM: «مدل داده در این فاز؛ منطق محاسبه در سیستم بهای تمام‌شده».
- **تب‌ها:** فعالیت · محرک هزینه (با زنجیره‌ی مرکز هزینه ← فعالیت ← محرک) · نگاشت به کارکرد استاندارد · تسهیم منبع مشترک.
- **بدون درخت:** داده‌ی پایه‌ی شرکت است؛ پنل کناری ندارد.
- **بنر:** جمع ضرایب تسهیم ≠ ۱۰۰٪، محرک روی کارکرد غیرمجاز، فعالیت بدون محرک.
- **پوشش:** ۵ از ۵ ثبت شده، ولی F-RM-063 فقط پیکربندی رویداد است؛ گردآوری واقعی و ارسال به CO به گزارش تولید نیاز دارد.

### ۷-۱۰. FRM-PE-01 — ویژگی‌های تولیدی قلم

- **تب‌ها:** نقش تولیدی · سیاست تأمین · هویت و ردیابی · ویژگی‌های تولیدی · فانتوم · ابعاد · پیکربندی‌پذیری (پیاده نشده) · اندازه‌ی بسته.
- **افزوده، نه بازتعریف:** کالا از کاتالوگ می‌آید و این فرم فقط نقش و ویژگی تولیدی به آن می‌افزاید؛ کالای بدون نقش تولیدی هم نشان داده می‌شود.
- **دامنه:** پنل کناری کاتالوگ کالا به تفکیک نقش تولیدی است («همه» یا یک کالا).
- **ترکیب‌های ابعادی:** `mes.GenerateItemVariants` حاصل‌ضرب دکارتی مقادیر مجاز همه‌ی بُعدها را می‌سازد (با هر تعداد بُعد)، ترکیب تازه را می‌افزاید و ترکیبی را که دیگر ساخته نمی‌شود غیرفعال می‌کند. دکمه‌اش هنوز در فرم وصل نیست (مثل تولید تقویم در RM-04).
- **بنر:** محصول نهایی/نیمه‌ساخته بدون ردیابی بچ (GMP)، فانتوم با ردیابی یا با سیاست غیر تولید داخلی، برون‌سپاری به پیمانکار تعلیق‌شده یا غیرفعال، تولید داخلی بدون اندازه‌ی بچ، کالای ابعادی بدون ترکیب.
- **پوشش:** ۷ از ۸ فیچر. قلم پیکربندی‌پذیر (007، مهم، فاز ۳) نیامده.

### ۷-۱۱. FRM-PE-02 — ساختار محصول (نسخه‌ی اول)

- **فرم مرکزی:** طبق یادداشت ALM، کپی، مقایسه، تبدیل نوع و اکسل اقدام درون همین فرم‌اند. کاربر گفته این فرم در چند دور بهتر می‌شود.
- **تب‌ها:** اطلاعات کلی (سربرگ، دامنه‌ی اعتبار، تبدیل نوع) · ردیف‌های مصرفی · نسخه و اعتبار (با مقایسه) · مدارک و پیوست.
- **پنل کناری:** ساختارها به تفکیک محصول (★ پیش‌فرض) و الگوها در گروه جدا.
- **ارث‌بری از الگو:** ساختار فرزند فقط تفاوت‌ها را نگه می‌دارد؛ ردیف‌های الگو با ردیف‌های خودش ادغام می‌شوند و هر ردیف برچسب منشأ دارد (از الگو، بازنویسی، حذف).
- **ترکیب درصدی:** جمع اجزای درصدی کنترل می‌شود؛ q.s. باقی‌مانده را پر می‌کند؛ انحراف در بنر خطاست مگر «بیش از ۱۰۰٪ مجاز» باشد. نوار ترکیب نمایش داده می‌شود.
- **عیارمحور:** مقدار نظری و نمونه‌ی مقدار واقعی در کمترین عیار مجاز ماده (ویژگی ASSAY از PE-01)، و مقداری که از قلم جبران‌کننده کم می‌شود.
- **نسخه‌ها:** هر نسخه ردیف‌های خودش را دارد؛ «مشاهده» ردیف‌های نسخه‌ی قدیم را می‌آورد.
- **فعال در فاز اول:** مقایسه (دو نسخه، دو ساختار یک محصول، یا ساختار با الگویش) و خروجی اکسل (CSV با BOM).
- **پوشش:** ۱۶ از ۱۹ فیچر (068 فقط نیمه‌ی خروجی). کپی ساختار (016) و ورود از اکسل اقدام نوشتنی‌اند و با ثبت و ویرایش می‌آیند؛ قلم اختیاری/مشروط (025) و مصرف منفی (026) «مهم»، فاز ۳.

### ۷-۱۲. FRM-PE-03 — گروه جایگزین و سیاست جایگزینی

- **پنل کناری:** فهرست گروه‌های جایگزین. گروه موجودیت مستقل است و چند ساختار از آن استفاده می‌کنند.
- **مدل:** گزینه‌ی صفر اقلام اصلی است؛ هر گزینه‌ی دیگر یک ترکیب جایگزین با اولویت؛ هر عضو نسبت مقدار دارد (چند به چند)؛ نمودار نسبت تبدیل.
- **بنر:** اولویت تکراری، گروه بدون کاربرد، عضو بدون نقش تولیدی، ردیف ساختاری که کالایش در اقلام اصلی گروه نیست.
- **پوشش:** ۴ از ۷ (027–030). جایگزینی خودکار بر مبنای موجودی (031)، درصد مجاز (032) و الزام تأیید کیفی در بچ (033) نیامده‌اند.

### ۷-۱۳. FRM-PE-04 — خروجی‌های ساختار و بازدهی

- **پنل کناری:** ساختارها؛ هر ساختار خروجی‌های اصلی، همزاد، فرعی، ضایعات مورد انتظار و بازیافتی دارد (`MasterProductTypeCode` ۱ تا ۵).
- **بازده:** درصد با حد پایین/بالا؛ جمع بازده‌ها باید ۱۰۰ باشد (موازنه‌ی جرم)، سهم هزینه‌ی هر خروجی و روش ارزش‌گذاری محصول فرعی.
- **پوشش:** ۵ از ۷ (034–037، 039). بازده وابسته به کیفیت خوراک (038) و انبار پیش‌فرض رسید هر خروجی (040) نیامده‌اند.

### ۷-۱۴. FRM-PE-05 — بازیابی مواد در فرایند

- **بدون پنل کناری** (داده‌ی پایه‌ی شرکت). تب‌ها: سیاست بازیافت، مواد بازیافتی (قلم مستقل یا گرید، نرخ، افت، هم‌ارزی، خلوص، QC، حداکثر چرخه، اولویت مصرف)، ردیف‌های ساختار با سقف مصرف بازیافتی، خروجی‌های بازیافتی.
- **پوشش:** ۹ از ۱۱ (041–048، 050). مصرف در محصولی غیر از مبدأ (049) و ارزش‌گذاری برای بهای تمام‌شده (051) نیامده‌اند.

### ۷-۱۵. FRM-PE-06 — ساختار ماتریسی و اقلام ابعادی

- **پنل کناری:** ساختارهای پایه‌ی مدل. ردیف‌ها مستقل یا وابسته به یک بُعد (مقدار به‌ازای هر مقدار بُعد).
- **ماتریس مشتق:** برای هر واریانت (از PE-01) مقدار هر ردیف؛ مقدار ناقص در بنر خطاست. خروجی CSV.
- **پوشش:** ۴ از ۵ (052، 053، 055، 056 فقط خروجی). مصرف بر مبنای مارکر/الگوی برش (054) نیامده.

### ۷-۱۶. FRM-PE-08 — نماها و محاسبات ساختار

- **کنسول تحلیلی:** درخت چندسطحی با فانتوم شفاف، بسط برای مقدار دلخواه با ضایعات ردیف و گرد کردن واحد شمارشی، جمع نیاز ناخالص مواد برگ، کاربرد معکوس تک/چندسطحی (همه‌ی نسخه‌ها و از راه الگو)، و کنترل حلقه‌ی بازگشتی در کل ساختارها.
- **پوشش:** ۴ از ۶ (062–064، 066). خواص تجمعی (065) و شبیه‌ساز تغییر ماده (067) نیامده‌اند.

### ۷-۱۷. FRM-PE-09 — مدیریت تغییر مهندسی (ECO)

- **پنل کناری:** ECOها به تفکیک باز / اجراشده / ردشده. مراحل: پیش‌نویس ← تحلیل اثر ← در انتظار تأیید ← تأییدشده ← اجراشده.
- **تب‌ها:** درخواست تغییر (منشأ، اولویت، تاریخ اثر، نسخه‌های ساختار ثبت‌شده با همین شماره) · دامنه‌ی چندموجودیتی (پیش/پس) · تحلیل اثر (کالاهای مستقیم و ساختارهای بالادستی با فاصله) · سیاست موجودی · تأیید و امضا با اطلاع‌رسانی.
- **پوشش:** ۵ از ۶ (069–071، 073، 074). فعال‌سازی اتمیک در تاریخ اثر (072) نیامده. اثر روی سفارش، موجودی و خرید به سیستم‌های دیگر وابسته است.

### ۷-۱۸. FRM-ME-01 — کتابخانه‌ی عملیات

- **پنل کناری:** درخت گروه‌ها با عملیات زیرشان («همه‌ی عملیات» در ریشه). انتخاب گروه همه‌ی زیرگروه‌ها را می‌آورد؛ انتخاب عملیات فقط همان را.
- **تب‌ها:** درخت گروه عملیات · عملیات استاندارد (ماهیت، منبع اصلی، شمارش منابع/دستورالعمل/پارامتر و فعالیت‌های ABC از RM-09) · منابع مورد نیاز (ایستگاه/گروه منبع اصلی و جایگزین، مهارت، ابزار، انرژی) · دستورالعمل کار (چندرسانه‌ای، نسخه‌دار) · چک‌لیست (پیاده نشده) · پارامترهای فرایندی (با نوار محدوده) · HSE (پیاده نشده).
- **بنر:** عملیات تولیدی بدون منبع، فقط دستورالعمل پیش‌نویس، دو نسخه‌ی تأییدشده‌ی هم‌زمان یک سند، هدف بیرون از محدوده، انرژی غیرفعال یا غیرمصرفی، گروه ابزار بدون ابزار.
- **پوشش:** ۵ از ۷ (001–004، 006). چک‌لیست اجرایی (005، مهم) و HSE (007، مطلوب) نیامده‌اند. «کاربرد در روش‌های ساخت» با ME-02 می‌آید.

فرم‌های ME-02 تا ME-04 و ME-10 پنل کناری مشترک «روش‌های ساخت» دارند (`me/me-routing.ts`: به تفکیک محصول، کارمزدی دریافتی جدا، الگوها جدا؛ هر برگ یک نسخه). ME-05، ME-07 و ME-09 بدون پنل کناری‌اند (همه‌ی روش‌ها در یک نما).

### ۷-۱۹. FRM-ME-02 — روش ساخت

- **تب‌ها:** اطلاعات کلی (اختصاص به ساختارها، الگو، کارمزدی) · گراف عملیات (نمای SVG راست‌به‌چپ، جدول عملیات و یال‌ها) · عملیات جایگزین · نسخه و اعتبار (مقایسه‌ی دو نسخه یا روش با الگو) · کارمزدی دریافتی.
- **منبع ارثی:** عملیاتی که در روش منبع ندارد، منبع اصلی کتابخانه (ME-01) را می‌گیرد و برچسب «ارث از کتابخانه» دارد.
- **اعتبارسنجی:** حلقه (یال برگشتی خط‌چین قرمز)، یتیم، مسیر بدون خروجی، عملیات بی‌منبع (الگو و برون‌سپاری مستثنا)، جمع سهم‌بری، تک‌مرحله‌ای با چند عملیات.
- **پوشش:** ۱۱ از ۱۲. عملیات شرطی (014) نیامده؛ ویرایش درگ‌اند‌دراپ اقدام نوشتنی است.

### ۷-۲۰. FRM-ME-03 — کارکرد استاندارد و زمان عملیات

- **مقدار سفارش ورودی است** و نیاز هر کارکرد و زمان هر عملیات زنده حساب می‌شود؛ شاخه‌ی موازی فقط سهم خودش را می‌گیرد.
- **تب‌ها:** کارکردهای عملیات · مبنای محاسبه · زمان‌ها (راه‌اندازی، اجرا، پس از اجرا، انتظار، جابه‌جایی+صف، تعداد اجرا) · ماتریس تعویض (به‌ازای تجهیز گروه منبع، ردیف طبقه‌ی محصول پررنگ) · اندازه‌ی بچ · منحنی یادگیری (پیاده نشده).
- **پوشش:** ۷ از ۹. منحنی یادگیری (027) و پیشنهاد اصلاح از داده‌ی واقعی (028) نیامده‌اند.

### ۷-۲۱. FRM-ME-04 — اقلام و خروجی در سطح عملیات

- **تب‌ها:** تخصیص اقلام (پوشش و جمع ۱۰۰٪) · نقطه‌ی مصرف · خروجی‌های عملیات (و پوشش خروجی‌های ساختار) · ضایعات فرایند و عملیات (بازده انباشته روی گراف و ورودی لازم به عملیات اول) · ذخیره‌سازی بین‌مرحله‌ای · ویژگی‌های بچ.
- **پوشش:** ۸ از ۸. روش منسوخ و پیش‌نویس فقط هشدار می‌گیرند.

### ۷-۲۲. FRM-ME-05 — عملیات بازیابی مواد

- **تب‌ها:** عملیات بازیابی (و پوشش مواد بازیابی‌شده‌ی PE-05) · نرخ و تلفات (خروجی مورد انتظار = ورودی مبدأ × نرخ) · انبار و سند رسید · محل اجرا.
- **پوشش:** ۳ از ۳.

### ۷-۲۳. FRM-ME-06 — سیاست‌های تغذیه، مصرف و رسید (کنسول)

- **پنل کناری:** لایه‌های سیاست (شرکت، گروه کالا، کالا، عملیات روش، نسخه‌ی تولید). انتخاب لایه اقلامی را نشان می‌دهد که آن لایه رویشان اثر دارد.
- **سیاست مؤثر:** برای هر قلم × عملیات روش‌های تأییدشده هر فیلد از خاص‌ترین لایه می‌آید و منشأ آن نمایش داده می‌شود.
- **تب‌ها:** تغذیه · مصرف و Backflush · اقلام مستثنی · رسید · انبار و الگوی سند · تخصیص موجودی · انتقال پای کار · محدوده‌ی مصرف.
- **پوشش:** ۱۰ از ۱۰. لایه‌ی نسخه‌ی تولید فقط در فهرست و هنگام صدور دستور اثر دارد.

### ۷-۲۴. FRM-ME-07 — برون‌سپاری و کارمزدی

- **تب‌ها:** عملیات برون‌سپاری (جایگاه در روش) · اقلام ارسالی و دریافتی · نرخ و شرایط (مقایسه با نرخ جاری RM-08، قلم خدمت خرید) · پیمانکار جایگزین (قابلیت، صلاحیت، قرارداد) · کارمزدی دریافتی (مالکیت هر قلم) · تسویه‌ی مازاد.
- **پوشش:** ۹ از ۹؛ اتصال واقعی به تدارکات (058) فقط قلم خدمت را نگه می‌دارد.

### ۷-۲۵. FRM-ME-08 — نسخه‌ی تولید

- **پنل کناری:** نسخه‌ها به تفکیک محصول.
- **تب‌ها:** ترکیب ساختار و روش · دامنه‌ی مکانی (خطوط در دامنه) · محدوده‌ی بچ (در برابر روش) · اعتبار و اولویت + **شبیه‌ساز انتخاب خودکار** (کالا، خط، مقدار، تاریخ، نوع دستور ← نسخه‌ی برنده با دلیل، و دلیل رد بقیه) · انواع مجاز · چرخه‌ی عمر · هزینه و زمان مبنا.
- **پوشش:** ۸ از ۹. انتخاب دستی با دلیل (064) با دستور کار می‌آید؛ در دسترس بودن منبع و مواد در انتخاب بررسی نمی‌شود.

### ۷-۲۶. FRM-ME-09 — تولید پیوسته و کمپین

- **تب‌ها:** روش ساخت پیوسته (نرخ) · دستور شیفتی (برنامه‌ی هر شیفت در برابر ظرفیت نظری = نرخ × زمان خالص) · کمپین (پیاده نشده) · موازنه‌ی جرم (پیاده نشده) · انتقال شیفت.
- **پوشش:** ۳ از ۵. کمپین (070) و موازنه‌ی جرم/انرژی (071) «مهم»اند.

### ۷-۲۷. FRM-ME-10 — فعالیت و محرک هزینه‌ی عملیات (استثنا به درخواست کاربر)

- **تب‌ها:** فعالیت عملیات (از کتابخانه، عملیات بی‌فعالیت هم دیده می‌شود) · محرک هزینه (و مجاز بودن کارکرد) · سهم هم‌زادها (جمع ۱۰۰٪ به‌ازای عملیات) · ارزش‌افزا و غیرارزش‌افزا (سهم زمان).
- **پوشش:** ۴ از ۴.

### ۷-۲۸. FRM-PE-07 — پیکربندی محصول (استثنا به درخواست کاربر)

- **نمونه:** مدل CFG-1001 «بسته‌بندی قرص ۵۰۰ برای بازارهای مختلف» (بازار، زبان بروشور، مهر امنیتی، تعداد در بلیستر) روی BOM-1001-A.
- **تب‌ها:** ویژگی‌ها و مقادیر · قواعد سازگاری (الزام/منع) · شرط ردیف‌ها (فقط اگر، حذف اگر، افزودن اگر) · ساختار مؤثر — **پیکربند زنده:** انتخاب‌ها ← نقض قواعد و Resolved BOM با وضعیت هر ردیف (ثابت، شرطی، افزوده، حذف‌شده).
- **پوشش:** ۴ از ۵. نگهداری پیکربندی روی سفارش و بچ (061) با دستور کار می‌آید.

### ۷-۲۹. حوزه‌ی کنترل تولید (FRM-PC-01 تا PC-12) — ۱۸ مهر

همه فقط‌خواندنی (تصمیم کاربر: درستی نشستن روی دیتابیس قدیم در بخش اجرایی مهم‌تر از ثبت است) ولی پرامکانات: شبیه‌سازی «اگر»، شمارنده‌های زنده، نمودار SVG، بنر زنده‌ی مشکلات سناریو. ساعت «الان» همه‌جا ساعت سناریو است (`SHOP_NOW` در `pc/pc-shared.ts` = `mes.fnShopNow`). پنل کناری راست انتخاب اصلی هر فرم است.

| فرم | تب‌ها و امکانات اصلی |
|---|---|
| PC-01 درخواست تولید | کانبان وضعیت با شمارش معکوس تاریخ نیاز · منشأ و اولویت · گردش تأیید با قاعده‌ی فعال‌شده · امکان‌سنجی ATP/CTP با لغزنده‌ی «تاریخ امکان‌سنجی» و پرش به تاریخ رفع کسری · گراف تجمیع/تفکیک درخواست↔دستور · پیشرفت برای واحد درخواست‌کننده |
| PC-02 دستور کار | کابین دستور با فیلتر نوع/وضعیت · گانت راست‌به‌چپ برنامه/واقعی با خط «الان» · مواد با موجود/رزرو/در راه/کسری و «اگر» مقدار ۵۰–۲۰۰٪ · بچ با بارکد · نوار شیفت M/E/N · درخت والد-فرزند · تغییر و ابطال |
| PC-03 آزادسازی و تغذیه | ماتریس آمادگی (مواد، ظرفیت، ابزار، مهارت، QC، تجهیز) با چراغ و علت · دستور شارژ · کارت کیت با بارکد · تخصیص FEFO و تصحیح عیار · مازاد و برگشتی · سنجه‌ی پای کار با حداقل/حداکثر/نقطه‌ی سفارش و زمان اتمام |
| PC-04 گزارش تولید | خط زمانی گزارش‌ها به تفکیک منبع · پارتو ضایعات · کارکرد در برابر استاندارد · زنجیره‌ی تحویل شیفت · بار اپراتور و هم‌پوشانی · پیش‌بینی پایان با لغزنده‌ی نرخ و تأخیر ازسرگیری |
| PC-05 ترمینال کارگاه | انتخاب ترمینال (برون‌خط چشمک می‌زند) · کارتابل لمسی با دکمه‌های بزرگ غیرفعال · زمان‌سنج زنده‌ی توقف باز · نوار توقف‌ها با زیان OEE · نمودار کنترل پارامتر با حدود · چک‌لیست · داده‌ی دستگاه در برابر کاربر با آستانه‌ی «اگر» |
| PC-06 مصرف مواد | دفتر مصرف با حالت و زنجیره‌ی معکوس · نمودار گلوله‌ای انحراف در باند ساختار · ماشین‌حساب تصحیح عیار · سقف ترکیب بازیابی‌شده · مواد امانی جدا |
| PC-07 رسید و هویت | رسید با سیاست و QC · تسهیم هزینه‌ی هم‌زاد «اگر» · رسید جزئی مرحله‌ای · بورد بچ و **پیش‌نمایش زنده‌ی شماره‌ی بچ از الگوی خط** · ماتریس ویژگی‌ها · جست‌وجوی سریال و تجمیع · **کاوشگر شجره** پس‌رو/پیش‌رو · **پیش‌نمایش برچسب SVG با بارکد Code 39** · مغایرت‌گیری |
| PC-08 بازیابی در اجرا | کارت رسید بازیابی با چرخه و خلوص · سنجه‌ی نیم‌دایره‌ی نرخ در برابر استاندارد · میله‌ی موازنه‌ی ماده · نمودار موازنه‌ی جرم پیوسته با تلورانس «اگر» |
| PC-09 نامنطبق | بورد چهارستونه‌ی تکلیف · مقایسه‌ی عملیات مبدا/نگه‌داشته · زنجیره‌ی دوباره‌کاری با سقف · ماشین‌حساب ترکیب بازیافتی · گزارش IsReprocess · درجه‌بندی مجدد · ضایعات پیمانکار با شبیه‌سازی جریمه · پارتو COPQ با گروه‌بندی متغیر |
| PC-10 برون‌سپاری و کارمزدی | ردیاب مرحله و شمارش معکوس موعد · برگه‌ی همراه قابل چاپ با بارکد · آبشار مغایرت · ماشین‌حساب کارمزد · صورت‌حساب مواد مشتری · تفکیک سه‌ستونه‌ی مالکیت |
| PC-11 پورتال | «نمایش به‌جای» هر حساب در قاب مرورگر جدا؛ کارمزد بی‌مجوز پوشیده؛ فرم ثبت پیشرفت غیرفعال؛ حساب غیرفعال از سرور ۴۰۳ می‌گیرد |
| PC-12 کنسول | OEE جاری هر خط (حلقه و A/P/Q) · توقف با شمارنده‌ی زنده · مانیتور استثنا با شمارش معکوس تشدید · درخت علل قدیم و اقدام اصلاحی · کار در جریان · آمادگی بستن هفت‌گانه و **پیش‌نمایش رویداد بهای تمام‌شده** · **آندون تمام‌صفحه** |

- **پوشش:** ۹۹ از ۱۰۰ فیچر؛ تقسیم/ادغام دستور (F-PC-015) نیامده.
- **فایل مشترک:** `pc/pc-shared.ts`؛ `frm-pc-02.service` نگاشت‌گرهایش را به PC-03 می‌دهد و `frm-pc-10.service` به PC-11 — پیش از جایگزینی این دو فایل، وابسته‌ها را ببینید.

### ۷-۳۰. FRM-PC-13 — اتاق جلسه‌ی کنترل تولید (BI سناریومحور، به درخواست کاربر ۱۸ مهر)

تکیه‌گاه جلسه‌ی هفتگی کنترل تولید در پایان هفته؛ فقط‌خواندنی، روی داده‌ی PC-01 تا PC-12 و `/api/pc13/bundle`. منو: «کنترل تولید ← اتاق جلسه‌ی کنترل تولید (BI)» (`alm.Menu` 45013).

- **دامنه‌ی مشترک:** هفته‌ی جاری/قبل/سفارشی، «یک سفارش ↔ بازه»، خط، نوع دستور، مشتری؛ جمله‌ی فارسی توصیف دامنه.
- **ماشین زمان:** نوار زمانی با چگالی رخداد و نشانگر کشیدنی، پخش ساعت‌به‌ساعت؛ همه‌ی اعداد «وضع در لحظه‌ی t» از جریان رویداد بازسازی می‌شوند.
- **فضاها:** تصویر هفته (کاشی‌ها با مقایسه‌ی هفته‌ی قبل، نقشه‌ی حرارتی روز×خط، «DNA سفارش‌ها») · سناریوها (آبشار «چرا برنامه محقق نشد»، ماتریس ریسک تحویل، هزینه‌ی کیفیت، مواد، بیرون از کارخانه، شبیه‌ساز «اگر…») · رادار مشکلات (۱۴ منبع، امتیاز اثر با فرمول نمایان، داستان و پیشنهاد تصمیم) · مسیر سفارش (خطوط شنای زمانی و روایت خودکار) · دستور جلسه (جعبه‌ی زمانی، یادداشت پیش‌نویس محلی در مرورگر، چاپ صورت‌جلسه) · حالت ارائه (اسلاید تمام‌صفحه با زمان‌سنج).
- **ساختار کد:** `pc/frm-pc-13.*` + `pc/pc13/` (موتور خالص `pc13-engine.ts` و کامپوننت‌های فرزند) — استثنای آگاهانه از قاعده‌ی چهار فایل به‌خاطر حجم.
- **فرض‌های مدل:** امتیاز اثر = ۱۰×شدت + پول (میلیون ریال، سقف ۳۰) + ۲×ساعت تأخیر (سقف ۳۰) + ۱۰ سفارش مشتری + سن/۶ (سقف ۱۰)؛ شبیه‌ساز با دقیقه‌ی استاندارد باقی‌مانده‌ی گلوگاه، نرخ خط، شیفت اضافه، تعمیر توقف باز، انتظار تصمیم و رسیدن ماده.

### ۷-۳۱. FRM-PE-10 — رصدخانه‌ی مهندسی محصول (BI، به درخواست کاربر ۱۸ مهر)

منو: «مهندسی محصول ← رصدخانه‌ی مهندسی محصول (BI)» (`alm.Menu` 43010)؛ `/api/pe10/bundle`؛ اسکریپت `mes_frm_pe10_setup.sql` (رویه‌های `GetBiPe*`)؛ کد `pe/frm-pe-10.*` + `pe/pe10/`.
فضاها: صورت‌فلکی محصولات با امتیاز سلامت مهندسی · پرتونگاری چندسطحی ساختار با ریسک هر قلم · «اگر این ماده نرسد…» (موج اثر تا دستور و درخواست، پوشش جایگزین و روز موجودی) · **دقت ساختار در اجرا** (استاندارد در برابر مصرف واقعی با مقدار پیشنهادی و اعتماد) · رادار تغییر ECO · بدهی فنی داده.

### ۷-۳۲. FRM-ME-11 — رصدخانه‌ی مهندسی تولید (BI، به درخواست کاربر ۱۸ مهر)

منو: «مهندسی تولید ← رصدخانه‌ی مهندسی تولید (BI)» (`alm.Menu` 44011)؛ `/api/me11/bundle`؛ اسکریپت `mes_frm_me11_setup.sql` (`GetBiRoutingHealth`، `GetBiMeDefects`، `GetBiStandardVsActual`، `GetBiVersionCoverage`، `GetBiCapacityModel`)؛ کد `me/frm-me-11.*` + `me/me11/`.
فضاها: نقشه‌ی سلامت روش‌ها (گراف عملیات با امتیاز کامل‌بودن) · **استاندارد در برابر واقعیت** (زمان و بازده گزارش تولید با استاندارد پیشنهادی و لغزنده‌ی ترکیب) · شبیه‌ساز گلوگاه برای سبد هفتگی · پوشش نسخه‌ی تولید کالا×خط · وابستگی بیرونی و هزینه · بدهی فنی مهندسی تولید.---

## ۸. ابزارهای توسعه

### ۸-۱. دکمه‌ی کد فرم و شناسنامه‌ی فرم در ALM

- بالای هر فرم، کنار کد آن، پوشش فیچر نوشته می‌شود (مثلاً «FRM-RM-03 · ۵ از ۶ فیچر»).
- با کلیک، صفحه‌ی شناسنامه در تب جدا باز می‌شود (`/alm/forms/:formCode`) با چهار تب: مشخصات فرم، فیچرها (با شرح پیاده‌سازی هر کدام)، ماتریس دسترسی، عملیات‌ها.
- بالای صفحه نوشته می‌شود فرم باید چند فیچر را پوشش دهد، چند تا پیاده شده، چند تا مانده و چند تا تحویل نهایی شده.

### ۸-۲. بررسی دیتابیس

- دکمه‌اش در نوار بالا جای «تغییر دیتابیس» نشسته است (`/db-compare`).
- دو ستون: چپ `mes`، راست `mfr` و `generalmfr`. اسکیماهای هر طرف انتخابی‌اند، پس برای مقایسه‌ی هر دو دسته اسکیمای دیگری هم کار می‌کند.
- جدول‌های هم‌نام روبه‌روی هم می‌آیند؛ با باز کردن هر ردیف، فیلدها با نوع، طول و NULL مقایسه می‌شوند.
- فیلتر وضعیت، جستجوی نام، و گزینه‌ی «نادیده گرفتن ۱۱ ستون استاندارد» (پیش‌فرض روشن).
- فقط ساختار خوانده می‌شود، نه داده.

### ۸-۳. منبع داده‌ی زنده

دکمه‌ی سه‌نقطه‌ی گوشه‌ی هر گرید نشان می‌دهد آن گرید از کدام رویه و جدول می‌خواند، همراه با متن رویه و ۲۰ ردیف نمونه.
### ۸-۴. منوی زیرسیستم‌های هم‌خانواده (۱۹ مهر ۱۴۰۵)

پیکر «سیستم‌ها» بالای منوی کناری ردیف‌های سطح صفر `alm.Menu` را نشان می‌دهد. اسکریپت `gng-mfr-api/scripts/alm_menu_subsystems_setup.sql` از روی `alm.Form` پنج زیرسیستم دیگر را با گروه‌بندی موضوعی ساخت: برنامه‌ریزی تولید (pps، ۴ گروه، ۱۴ فرم)، کنترل کیفیت و آزمایشگاه (qm، ۶ گروه، ۲۸ فرم)، بهای تمام‌شده‌ی تولید (mc، ۴ گروه، ۱۲ فرم)، کنترل موجودی و انبار (wm، ۱۰ گروه، ۷۰ فرم) و نگهداری و تعمیرات ناوگان (nt، ۸ گروه، ۳۴ فرم؛ در ALM «مدیریت ناوگان گلرنگ»). فرم‌های جای‌خالی «رزرو» در منو نیامده‌اند. کد ردیف‌ها: سیستم = کد زیرسیستم، گروه = «کد-شماره»، فرم = «M-کد فرم».
فرمی که هنوز صفحه ندارد (همه‌ی فرم‌های این پنج زیرسیستم) به‌جای پیام خالی، **شناسنامه‌ی طراحی‌اش از ALM** را نشان می‌دهد: زیرسیستم، نوع، مرحله، تب‌ها، فیچرها به تفکیک اولویت با وضعیت توسعه، عملیات، کاربران، برآورد و پیوند به شناسنامه‌ی کامل (`form-page.component`).

---

## ۹. وضعیت ثبت‌شده در ALM

| فرم | باید پوشش دهد | پیاده‌شده در فرم | تحویل نهایی |
|---|---|---|---|
| FRM-RM-01 | ۱۰ | ۱۰ | ۰ |
| FRM-RM-02 | ۹ | ۹ | ۰ |
| FRM-RM-03 | ۶ | ۵ | ۰ |
| FRM-RM-04 | ۴ | ۳ | ۰ |
| FRM-RM-05 | ۸ | ۶ | ۰ |
| FRM-RM-06 | ۹ | ۷ | ۰ |
| FRM-RM-07 | ۷ | ۶ | ۰ |
| FRM-RM-08 | ۶ | ۴ | ۰ |
| FRM-PE-01 | ۸ | ۷ | ۰ |
| FRM-PE-02 | ۱۹ | ۱۶ | ۰ |
| FRM-RM-09 | ۵ | ۵ | ۰ |
| FRM-PE-03 | ۷ | ۴ | ۰ |
| FRM-PE-04 | ۷ | ۵ | ۰ |
| FRM-PE-05 | ۱۱ | ۹ | ۰ |
| FRM-PE-06 | ۵ | ۴ | ۰ |
| FRM-PE-08 | ۶ | ۴ | ۰ |
| FRM-PE-09 | ۶ | ۵ | ۰ |
| FRM-ME-01 | ۷ | ۵ | ۰ |
| FRM-ME-02 | ۱۲ | ۱۱ | ۰ |
| FRM-ME-03 | ۹ | ۷ | ۰ |
| FRM-ME-04 | ۸ | ۸ | ۰ |
| FRM-ME-05 | ۳ | ۳ | ۰ |
| FRM-ME-06 | ۱۰ | ۱۰ | ۰ |
| FRM-ME-07 | ۹ | ۹ | ۰ |
| FRM-ME-08 | ۹ | ۸ | ۰ |
| FRM-ME-09 | ۵ | ۳ | ۰ |
| FRM-ME-10 | ۴ | ۴ | ۰ |
| FRM-PE-07 | ۵ | ۴ | ۰ |
| FRM-PC-01 | ۶ | ۶ | ۰ |
| FRM-PC-02 | ۱۳ | ۱۲ | ۰ |
| FRM-PC-03 | ۱۱ | ۱۱ | ۰ |
| FRM-PC-04 | ۷ | ۷ | ۰ |
| FRM-PC-05 | ۸ | ۸ | ۰ |
| FRM-PC-06 | ۱۲ | ۱۲ | ۰ |
| FRM-PC-07 | ۹ | ۹ | ۰ |
| FRM-PC-08 | ۴ | ۴ | ۰ |
| FRM-PC-09 | ۹ | ۹ | ۰ |
| FRM-PC-10 | ۱۰ | ۱۰ | ۰ |
| FRM-PC-11 | ۱ | ۱ | ۰ |
| FRM-PC-12 | ۱۰ | ۱۰ | ۰ |
| FRM-PC-13 (BI) | ۰ | — | ۰ |
| **جمع** | **۳۱۸** | **۲۸۰** | **۰** |

همه‌ی ۲۸۰ فیچر «در حال کار» ثبت شده‌اند، چون فرم‌ها هنوز ثبت و ویرایش ندارند. در PC تنها فیچر نیامده تقسیم و ادغام دستور (F-PC-015، مهم) است.
حجم داده‌ی `alm`: ۴۷۵ فرم، ۳۱۵۹ فیچر، ۱۱۱۴ نگاشت فرم–فیچر، ۳۸۵ ردیف دسترسی، ۴۵۰ عملیات.

---

## ۱۰. کدهای موقت و فرض‌ها

این‌ها را من گذاشته‌ام تا کدلیست اصلی برسد یا تأیید شوند.

| موضوع | مقدار فعلی |
|---|---|
| واحد زمان شیفت و تقویم | دقیقه از نیمه‌شب (۰۶:۰۰ = ۳۶۰) |
| وضعیت نت تجهیز | ۱ در دسترس، ۲ تحت تعمیر، ۳ متوقف |
| سطح مهارت | ۱ کارآموز، ۲ با نظارت، ۳ مستقل، ۴ مربی |
| رفتار الزام مهارت | ۱ هشدار، ۲ منع |
| نوع غیبت | ۱ مرخصی، ۲ غیبت، ۳ آموزش / مأموریت |
| نوع روز | ۱ روز کاری، ۲ تعطیل (فعلاً فقط جمعه) |
| روزهای کاری تقویم | ماسک بیتی: بیت ۰ شنبه … بیت ۶ جمعه (۶۳ = شنبه تا پنجشنبه) |
| نوع استثنا | ۱ تعطیل رسمی، ۲ تعطیلی فوق‌العاده، ۳ روز کاری فوق‌العاده |
| وضعیت تأیید استثنا | ۱ در انتظار، ۲ تأییدشده، ۳ ردشده |
| نوع توقف | ۱ نت پیشگیرانه، ۲ تعمیر اساسی، ۳ توقف برنامه‌ای غیر نت |
| تعطیل رسمی و خط پیوسته | تعطیل رسمی روی تقویم ۲۴/۷ اثر ندارد؛ تعطیلی فوق‌العاده روی همه اثر دارد |
| `ProductionOperation.LaborClassCode` | با ۱ پر شده، هنوز استفاده نمی‌شود |
| مبنای اندازه‌گیری کارکرد | ۱ زمان‌محور، ۲ نرخی، ۳ ثابت/فیزیکی |
| روش گردآوری کارکرد | ۱ دستی، ۲ از PLC، ۳ محاسباتی |
| توقف استاندارد | دقیقه به‌ازای هر شیفت |
| آستانه‌ی نمای بار | از ۹۰٪ هشدار، بالای ۱۰۰٪ گلوگاه |
| زمان در دسترس گروه منبع | بیشینه‌ی خطوط اعضا |
| `ProductionProblem.ProblemTypeCode` | ۱ توقف برنامه‌ریزی‌شده، ۲ برنامه‌ریزی‌نشده — **معنای این فیلد در نسخه‌ی قبل روشن نیست** |
| `ProductionPlanDeviation.DeviationTypeCode` | ۱ مقداری، ۲ زمانی، ۳ ترتیب — **منتظر تأیید** |
| `ProductionWasteReason.WasteTypeCode` | ۱ ضایعات مواد، ۲ ضایعات محصول (همان معنای `WasteTypeCode` در جدول‌های اجرای قدیم) |
| مؤلفه‌ی OEE | ۱ در دسترس‌بودن، ۲ عملکرد، ۳ کیفیت |
| دسته‌ی علت در محدودسازی | ۱ توقف، ۲ ضایعات، ۳ دوباره‌کاری، ۴ انحراف |
| وضعیت تأیید صلاحیت پیمانکار | ۱ تأییدشده، ۲ مشروط، ۳ تعلیق |
| دوره‌ی ظرفیت پیمانکار | ۱ روز، ۲ هفته، ۳ ماه |
| نوع انبار امانی | ۱ مواد امانی، ۲ محصول و نیمه‌ساخته |
| هشدار قرارداد / صلاحیت | کمتر از ۶۰ / ۳۰ روز مانده |
| نقش تولیدی قلم | ۱ محصول نهایی، ۲ نیمه‌ساخته، ۳ ماده‌ی اولیه، ۴ مواد بسته‌بندی، ۵ محصول جانبی |
| `ProductSourceCode` (سیاست تأمین) | ۱ تولید داخلی، ۲ خرید، ۳ برون‌سپاری، ۴ انتقال بین‌سایتی — **معنای این کد در نسخه‌ی قبل منتظر تأیید** |
| سطح ردیابی | ۰ بدون، ۱ بچ، ۲ سریال، ۳ بچ + سریال |
| نوع ویژگی تولیدی | ۱ عددی، ۲ بازه، ۳ متنی |
| `ProductStructureTypeCode` | ۱ تولیدی، ۲ آزمایشی/R&D، ۳ الگو، ۴ نمونه‌سازی، ۵ مهندسی |
| `ProductStructureStatusCode` | ۱ پیش‌نویس، ۲ در گردش تأیید، ۳ تأییدشده، ۴ منسوخ |
| `ProductStructureItem.QuantityTypeCode` | ۱ ثابت در هر بچ، ۲ متناسب با اندازه‌ی مرجع، ۳ فرمولی، ۴ درصدی — **معنای این فیلد در نسخه‌ی قبل منتظر تأیید** |
| اعتبار نسخه | ۱ تاریخ‌محور، ۲ بچ‌محور، ۳ سفارش‌محور |
| تبدیل‌های مجاز نوع ساختار | آزمایشی ← نمونه‌سازی، نمونه‌سازی ← تولیدی، آزمایشی ← تولیدی، مهندسی ← آزمایشی |
| هشدار پروانه‌ی ساخت | کمتر از ۶۰ روز مانده |
| `ProductionActivity.ActivityPropertyTypeCode` | ۱ سطح واحد، ۲ سطح بچ، ۳ سطح محصول، ۴ سطح کارخانه — **معنای این فیلد در نسخه‌ی قبل منتظر تأیید** |
| لحظه‌ی گردآوری محرک | ۱ ثبت گزارش تولید، ۲ بستن شیفت، ۳ بستن دستور |
| روش تسهیم | ۱ ضریب ثابت، ۲ مقدار واقعی محرک |
| `ProductStructureMaster.MasterProductTypeCode` | ۱ اصلی، ۲ همزاد، ۳ فرعی، ۴ ضایعات مورد انتظار، ۵ بازیافتی — **معنای این فیلد در نسخه‌ی قبل منتظر تأیید** |
| حالت ماده‌ی بازیافتی | ۱ قلم مستقل، ۲ گرید همان ماده |
| ECO — منشأ | ۱ کیفیت، ۲ تأمین، ۳ بهبود، ۴ الزام قانونی، ۵ مشتری |
| ECO — وضعیت | ۱ پیش‌نویس، ۲ تحلیل اثر، ۳ در انتظار تأیید، ۴ تأییدشده، ۵ اجراشده، ۶ ردشده |
| ECO — سیاست موجودی موجود | ۱ مصرف تا اتمام، ۲ کنارگذاری، ۳ اختلاط با شرط |
| ECO — موجودیت / نوع تغییر | موجودیت: ۱ ساختار، ۲ کالا، ۳ گروه جایگزین، ۴ الگو؛ تغییر: ۱ افزودن، ۲ حذف، ۳ تغییر مقدار/ویژگی، ۴ جایگزینی |
| ECO — اولویت / اطلاع‌رسانی | اولویت: ۱ عادی، ۲ فوری؛ اطلاع‌رسانی: ۱ در صف، ۲ ارسال‌شده |
| واحدهای شمارشی در بسط | عدد، قرص، بلیستر — به بالا گرد می‌شوند |
| `ProductionOperation.OperationTypeCode` (ماهیت) | ۱ تولیدی، ۲ کیفی، ۳ تولیدی-کیفی، ۴ اطلاعاتی، ۵ برون‌سپاری، ۶ انتقال/جابه‌جایی — **نام از `mfr.RoutingOperation`؛ معنای آن در نسخه‌ی قبل منتظر تأیید** |
| نوع منبع عملیات | ۱ ایستگاه کاری، ۲ گروه منبع |
| دستورالعمل — رسانه / وضعیت | رسانه: ۱ متن، ۲ تصویر، ۳ ویدئو، ۴ PDF؛ وضعیت: ۱ پیش‌نویس، ۲ تأییدشده، ۳ منسوخ |
| پارامتر فرایندی | منبع: ۱ دستی، ۲ PLC/حسگر؛ خارج از محدوده: ۱ هشدار، ۲ توقف خط |
| انرژی معتبر برای عملیات | `CapacityType` فعال با مبنای نرخی/مصرفی (۲) |
| `RoutingMaster.RoutingMasterStatusCode` | ۱ پیش‌نویس، ۲ در گردش تأیید، ۳ تأییدشده، ۴ منسوخ |
| `RoutingMaster.RoutingMethodCode` / `ProductionTypeCode` | روش: ۱ تک‌مرحله‌ای، ۲ چندمرحله‌ای؛ تولید: ۱ بچی، ۲ پیوسته — **معنای هر دو در نسخه‌ی قبل منتظر تأیید** |
| یال روش / جایگزین | هم‌پوشانی: ۱ ندارد، ۲ پس از مقدار، ۳ پس از دقیقه؛ شرط جایگزین: ۱ بازه‌ی مقدار، ۲ منبع در دسترس نیست، ۳ انتخاب کاربر، ۴ کمترین هزینه، ۵ کمترین زمان |
| `RoutingOperationOutput.ReceiveOutputTypeCode` | ۱ اصلی، ۲ همزاد، ۳ جانبی، ۴ ضایعات، ۵ بازیافتی، ۶ نیمه‌ساخته — **معنای کد قدیم منتظر تأیید** |
| زمان عملیات (ME-03) | دقیقه؛ اجرا به‌ازای هر واحد؛ مبنای کارکرد: ۱ ثابت، ۲ متناسب، ۳ پلکانی («از-تا:مقدار;…»)، ۴ ثابت+متغیر، ۵ فرمول (Quantity، عدد، چهار عمل)؛ اختلاف بچ: ۱ تقسیم، ۲ گرد کردن، ۳ یکجا تا سقف |
| مواد عملیات (ME-04) | نقطه‌ی مصرف: ۱ ابتدا، ۲ حین، ۳ پایان؛ ذخیره‌سازی: ۱ مستقیم، ۲ انبار میانی، ۳ پای کار؛ ارجحیت ضایعات: ۱ ردیف ساختار، ۲ عملیات، ۳ فرایند؛ ویژگی بچ: ۱ تعیین، ۲ به‌روزرسانی، ۳ تأیید |
| بازیابی (ME-05) | روش: ۱ تقطیر، ۲ تغلیظ، ۳ جداسازی، ۴ فیلتراسیون؛ مقصد: ۱ همان دستور، ۲ انبار عمومی؛ محل: ۱ همان خط، ۲ مرکزی، ۳ برون‌سپاری |
| سیاست مواد (ME-06) | ۱۱ کدلیست در سرآیند `mes_frm_me06_setup.sql` (لایه، تغذیه، مصرف، Backflush، کسری، استثنا، رسید، تخصیص، انتقال، کنترل) |
| برون‌سپاری و کارمزدی (ME-07) | شرط پیمانکار: ۱ اصلی، ۲ ظرفیت، ۳ هزینه، ۴ زمان تحویل؛ تأمین: ۱ ما، ۲ پیمانکار، ۳ ترکیبی؛ مالکیت: ۱ مشتری، ۲ ما؛ تسویه: ۱ بازگشت، ۲ فروش، ۳ اسقاط |
| نسخه‌ی تولید (ME-08) | وضعیت: ۱ پیش‌نویس، ۲ در تأیید، ۳ فعال، ۴ معلق، ۵ منسوخ؛ مبنای دستور: ۱ مقدار، ۲ شیفت؛ نوع دستور در انتخاب: ۱ عادی، ۲ دوباره‌کاری، ۳ نمونه، ۴ کارمزدی |
| پیوسته (ME-09) | نرخ: ۱ در ساعت، ۲ در شیفت؛ انتقال شیفت: ۱ به شیفت بعد، ۲ بستن و رسید، ۳ برگشت به پای کار |
| پیکربندی (PE-07) | قاعده: ۱ الزام، ۲ منع؛ شرط ردیف: ۱ فقط اگر، ۲ حذف اگر، ۳ افزودن اگر |
| درخواست تولید (PC-01) | منشأ: ۱ فروش، ۲ انبار، ۳ برنامه‌ریزی مواد، ۴ داخلی، ۵ مشتری کارمزدی؛ اولویت: ۱ عادی، ۲ بالا، ۳ فوری؛ وضعیت: ۱ پیش‌نویس … ۶ ردشده |
| `MaterialStock` | نوع: ۱ مرکزی، ۲ پای کار، ۳ قرنطینه، ۴ امانی مشتری، ۵ نزد پیمانکار، ۶ در راه؛ QC: ۱ آزاد، ۲ قرنطینه، ۳ مردود |
| `WorkOrder.WOTypeCode` | ۱ عادی، ۲ شیفتی/پیوسته، ۳ دوباره‌کاری، ۴ بازیافت، ۵ برون‌سپاری، ۶ کارمزدی دریافتی، ۷ R&D، ۸ تعمیراتی-تولیدی، ۹ پروژه‌ای — **معنای کد قدیم منتظر تأیید** |
| `WorkOrder.WorkOrderStatusCode` | ۱ برنامه‌ریزی‌شده، ۲ آزادشده، ۳ در جریان، ۴ تکمیل‌شده، ۵ بسته‌شده، ۶ باطل، ۷ معلق — **معنای کد قدیم منتظر تأیید** |
| `WorkOrderOperationStatusCode` / وضعیت ماده | عملیات: ۱ در انتظار، ۲ آماده، ۳ در جریان، ۴ متوقف، ۵ تکمیل، ۶ نزد پیمانکار؛ ماده: ۱ برنامه‌ای … ۵ تسویه‌شده — **منتظر تأیید** |
| گزارش و مصرف (PC-04، 06) | منبع: ۱ اداری، ۲ ترمینال، ۳ PLC، ۴ محاسبه‌ای؛ مصرف: ۱ دستی، ۲ Backflush عملیات، ۳ Backflush رسید؛ کسری: ۱ عادی، ۲ موجودی منفی، ۳ جزئی + صف اصلاح |
| رسید و هویت (PC-07) | نوع خروجی ۱ اصلی … ۵ بازیابی‌شده؛ سیاست ۱ مستقیم، ۲ مجوز ورود، ۳ مشروط به QC، ۴ قرنطینه؛ QC رسید ۱ در انتظار، ۲ آزاد، ۳ رد، ۴ آزاد جزئی؛ وضعیت بچ ۱ باز … ۷ باطل؛ سریال ۱ تولیدشده … ۵ باطل؛ جزء الگوی بچ ۱ متن، ۲ سال، ۳ ماه، ۴ خط، ۵ شمارنده؛ پیوند شجره ۱ مصرف، ۲ دوباره‌کاری، ۳ بازیافت، ۴ تفکیک، ۵ بازیابی |
| نامنطبق (PC-09) | نوع: ۱ اسقاط، ۲ بازیافت، ۳ دوباره‌کاری، ۴ درجه‌دو؛ منشأ: ۱ گزارش، ۲ QC، ۳ پیمانکار، ۴ گزارش دوباره‌کاری؛ تصمیم: ۱ منتظر، ۲ گرفته‌شده، ۳ اجراشده؛ تکلیف پیمانکار: ۱ بازگشت، ۲ جریمه، ۳ پذیرش؛ سقف دوباره‌کاری یک بچ پارامتر روال (پیش‌فرض ۱) |
| برون‌سپاری (PC-10) | جهت سند: ۱ ارسال، ۲ دریافت، ۳ ورود مواد مشتری، ۴ تحویل به مشتری؛ نقش قلم ۱ تا ۸ (سرآیند اسکریپت)؛ مرحله: ۱ دریافت مواد، ۲ در جریان، ۳ آماده، ۴ ارسال‌شده |
| کنسول (PC-12) | ۱۱ نوع قاعده‌ی استثنا؛ شدت ۱ اطلاع، ۲ هشدار، ۳ بحرانی؛ کانال ۱ سامانه، ۲ پیامک، ۳ ایمیل، ۴ آندون؛ آندون ۱ بیکار، ۲ کار، ۳ متوقف، ۴ توقف باز، ۵ هم‌پوشانی؛ OEE جاری از ساعت ۰۶:۰۰؛ دوباره‌کاری و بازیافت در OEE حساب نمی‌شوند |
---

## ۱۱. تصمیم‌های باز

1. ~~هر ایستگاه فقط مال یک خط است؟~~ **بسته شد (۱۵ مهر ۱۴۰۵):** بله، ایستگاه کاری مختص یک خط است و نمی‌تواند برای دو خط باشد. `mes.WorkCenter.ProductionLineId` همین را نگه می‌دارد. منبعی که بین خطوط مشترک است (مثل میکسرهای گرانولاسیون) با «گروه منبع» بیان می‌شود، نه با ایستگاه مشترک.
2. **واحد زمان شیفت** در سیستم قدیم (`FromTime`، `ToTime`) دقیقه از نیمه‌شب است یا شکل دیگری؟
3. **تعطیل رسمی روی خط پیوسته** اثر نداشته باشد؟
4. **`SiteId` در `ProductionLine`:** در قدیم `NOT NULL` است و در `mes` فعلاً `NULL`، چون جدول سایت هنوز نیست.
5. **عنوان گروه‌های کاربری:** در `alm` جدول عنوان ندارند؛ فقط شش گروه عنوان فارسی دارند و بقیه با کد نمایش داده می‌شوند.
6. **کدلیست‌های اصلی** برای همه‌ی موارد بخش ۱۰.
7. **نام `Setting`:** این جدول در هر دو اسکیمای `mfr` و `generalmfr` هست و هنگام آمدن به `mes` باید یکی یا تفکیک شود.
8. **فیلدهای ثابت ظرفیت در `WorkCenter`:** `NumberOfEquipments`، `NumberOfLabors`، `EquipmentAvailPercent` و `ProductivityPercent` هنوز در `mes.WorkCenter` هستند (با مقدار پیش‌فرض) ولی فرم ۶ از `WorkCenterCapacity` می‌خواند. حذف شوند، یا از روی دو نوع پایه هم‌گام نگه داشته شوند تا گزارش‌های قدیمی کار کنند؟
9. **`generalmfr.Energy` و `ProductionActivity`:** هر دو با «نوع کارکرد» هم‌پوشانی دارند (انرژی یکی از انواع کارکرد است). فعلاً `CapacityType` مستقل ساخته شده؛ هنگام آمدن فرم‌های مهندسی تولید (`RoutingOperationEnergy`، `RoutingOperationActivity`) باید روشن شود که به `CapacityType` وصل شوند یا جدول‌های قدیم بمانند.
10. **معنای `ProblemTypeCode` و `DeviationTypeCode`:** هر دو در نسخه‌ی قبل `NOT NULL`اند ولی کدلیستشان در دسترس نیست. فعلاً `ProblemTypeCode` «برنامه‌ریزی‌شده/نشده» و `DeviationTypeCode` «مقداری/زمانی/ترتیب» گرفته شده. اگر معنای قدیم چیز دیگری است، باید فیلد جدا اضافه شود.
11. **نوع تجهیز به‌صورت متن:** محدودسازی به‌ازای نوع تجهیز روی `Equipment.EquipmentTypeTitle` (متن) کار می‌کند، چون جدول نوع تجهیز هنوز نیست. با وصل شدن سیستم نت/دارایی باید به شناسه‌ی نوع تجهیز تبدیل شود.
12. **پیمانکار: جدول مستقل یا منبع بیرونی؟** فعلاً (تصمیم ۱۵ مهر) جدول‌های مستقل. گزینه‌ی دیگر مدل نسخه‌ی قبل است: هر پیمانکار یک خط/ایستگاه برون‌سپاری (`IsOutsourced`، `WorkCenterPartyId`) زیر یک گره‌ی «پیمانکاران» در درخت سازمانی، تا تقویم (RM-05)، ظرفیت (RM-06، و F-RM-058) و انبار خط بی‌کار اضافه برای پیمانکار هم کار کند. اگر روزی به آن مدل برگردیم، قابلیت‌ها به ایستگاه‌های برون‌سپاری وصل می‌شوند.
13. ~~جایگزین: `ProductStructureItemSub` قدیم یا گروه مستقل؟~~ **بسته شد (۱۷ مهر ۱۴۰۵):** گروه مستقل چندبه‌چند (`SubstituteGroup*`)؛ جدول قدیم استفاده نمی‌شود. اگر گزارش‌های قدیم به `ProductStructureItemSub` نیاز داشتند، یک view سازگار ساخته می‌شود.
14. ~~ECO و `PF-02`~~ **بسته شد برای این مرحله (۱۷ مهر ۱۴۰۵):** جدول‌های ECO مشترک نیستند؛ `mes.EngineeringChangeOrder*` مختص ساختار و مهندسی محصول است. هنگام ساخت PF-02 دوباره بررسی می‌شود.
15. **نسخه‌ی تولید: `mes.ManufacturingVersion` یا `ProductionVersion`؟** `mfr.ProductionVersion` نسخه‌ی برنامه‌ریزی است (دوره‌های MPS/RCCP/MRP/CRP، بودجه) و با «ساختار + روش» یکی نیست؛ برای اینکه بررسی دیتابیس دو مفهوم را هم‌نام نشان ندهد نام جدید گرفته شد. اگر فرم‌های برنامه‌ریزی همان جدول قدیم را لازم داشتند، نام فعلی می‌ماند.
16. **کدهای قدیم روش ساخت:** معنای `RoutingMethodCode`، `ProductionTypeCode`، `OperationTypeCode`، `ReceiveOutputTypeCode` و `ReceptionRequestTypeCode` در نسخه‌ی قبل در دسترس نیست؛ معنای فرض‌شده در بخش ۱۰ آمده.
17. **انبار و الگوی سند به‌صورت متن:** ME-05، ME-06 و ME-07 انبار و الگوی سند را متنی نگه می‌دارند تا سیستم انبار وصل شود.
18. **موجودی: `mes.MaterialStock` جانشین موقت است** (مثل `mes.Product`). با وصل شدن سیستم انبار، رویه‌های PC همان ستون‌ها را از سرویس انبار می‌گیرند؛ اسم جدول عمداً با جدول‌های انبار نسخه‌ی قبل یکی نشده.
19. **کدهای قدیم دستور کار:** معنای `WOTypeCode`، `WorkOrderStatusCode`، `WorkOrderOperationStatusCode` و `WorkOrderOperationMaterialStatusCode` در نسخه‌ی قبل در دسترس نیست؛ فرض‌ها در بخش ۱۰.
20. **ردیف مصرف چندبچه‌ای:** در `WorkOrderOperationMaterialConsumed` قدیم یک ردیف یک `BatchNumber` دارد؛ داده‌ی نمونه چند بچ را با «،» در یک ردیف گذاشته و شجره سهم هر بچ را تخمینی (مساوی) می‌گیرد. تصمیم: هنگام ثبت، هر بچ یک ردیف جدا شود؟
21. **ساعت سناریو:** `mes.fnShopNow()` ثابت است تا داده‌ی نمونه همیشه یک‌جور دیده شود؛ پیش از استفاده‌ی واقعی باید `SYSDATETIME()` برگرداند.
---

## ۱۲. محدودیت‌های شناخته‌شده

- همه‌ی فرم‌ها فقط‌خواندنی‌اند؛ هیچ ثبت و ویرایشی از داخل برنامه انجام نمی‌شود.
- هیچ منطق دسترسی و نقش کاربری پیاده نشده است؛ ماتریس دسترسی فقط در شناسنامه‌ی فرم نمایش داده می‌شود.
- `mes.Equipment`، `mes.ProductionPersonnel` و `mes.Product` جانشین موقت سیستم‌های نت/دارایی، منابع انسانی و کاتالوگ کالای انبارند. فرم‌های RM-06 و RM-08 هنوز عنوان محصول را متنی نگه می‌دارند و باید به `mes.Product` وصل شوند.
- تقویم مؤثر در سطح «خط × روز» و با جمع ساعت حساب می‌شود؛ هم‌پوشانی ساعتی بازه‌ها و سطح ایستگاه هنوز نیست.
- تحلیل اثر استثنا بر سفارش‌ها به جدول‌های سفارش تولید نیاز دارد که هنوز در `mes` نیامده‌اند.
- بار نمای ظرفیت (FRM-RM-06) داده‌ی نمونه است؛ بار واقعی وقتی می‌رسد که دستور کار و برنامه‌ریزی تولید ساخته شوند. نرخ وابسته به محصول هنوز در محاسبه‌ی بار استفاده نمی‌شود.
- انتخاب درخت بین فرم‌ها مشترک نیست؛ هر فرم از ریشه شروع می‌کند.
- قاب برنامه برای صفحه‌ی باریک (موبایل) طراحی نشده است.
- صفحه‌های رابط کاربری در محیط آزمایشی با رونوشت داده تست شده‌اند؛ رویه‌ها و کوئری‌ها روی دیتابیس واقعی لوکال اجرا و بررسی شده‌اند.
- فرم‌های PC-01 تا PC-12 (۱۸ مهر) هم مثل ME روی API موقت ۴۳۱۲ آزموده شدند (هدایت `/api/pc*`).
- فرم‌های ME-01 تا ME-10 و PE-07 (۱۷ مهر) در مرورگر روی یک API موقت (پورت ۴۳۱۲، همان `server.js`) آزموده شدند، چون API اصلی کاربر هنوز نسخه‌ی قبلی بود: در زبانه‌ی آزمون، درخواست‌های `/api/me*` و `/api/pe07` به ۴۳۱۲ هدایت شد. پس از اجرای دوباره‌ی `run-api.bat` همین فرم‌ها مستقیم کار می‌کنند.

---

## ۱۳. گام‌های بعدی

1. ~~FRM-RM-06 — کارکرد استاندارد و ظرفیت~~ — انجام شد (۱۵ مهر ۱۴۰۵).
2. ~~FRM-RM-07 — طبقه‌بندی علل~~ — انجام شد (۱۵ مهر ۱۴۰۵). ~~FRM-RM-08 — پیمانکاران تولید~~ — انجام شد (۱۵ مهر ۱۴۰۵). ~~FRM-RM-09~~ به درخواست کاربر به‌عنوان استثنا انجام شد (۱۷ مهر ۱۴۰۵)؛ حوزه‌ی مدیریت منابع کامل است. FRM-RM-09 (هزینه‌یابی) باید روی `CapacityType` همین گام بنا شود (F-RM-062: کدام نوع کارکرد محرک هزینه است).
3. حوزه‌های مهندسی محصول و مهندسی تولید؛ جدول‌های پرارتباط قدیم (`RoutingMaster`، `RoutingOperation`، `WorkOrder`) این‌جا وارد می‌شوند. ~~FRM-PE-01~~ انجام شد (۱۵ مهر ۱۴۰۵). ~~FRM-PE-02~~ نسخه‌ی اول انجام شد (۱۶ مهر ۱۴۰۵)؛ دورهای بعدی بهبود با نظر کاربر. ~~PE-03، 04، 05، 06، 08، 09~~ یک‌جا انجام و در مرورگر آزموده شدند (۱۷ مهر ۱۴۰۵). PE-07 فیچر الزامی ندارد و مثل RM-09 پروتوتایپ می‌ماند؛ ME-10 هم همین‌طور. ~~FRM-ME-01 تا ME-10 و PE-07~~ انجام شدند (۱۷ مهر ۱۴۰۵، ME-10 و PE-07 به درخواست کاربر). سه حوزه‌ی RM، PE و ME در فاز اول کامل‌اند.
   ~~حوزه‌ی کنترل تولید (PC-01 تا PC-12)~~ انجام شد (۱۸ مهر ۱۴۰۵)، فقط‌خواندنی به خواست کاربر. چهار حوزه‌ی RM، PE، ME و PC در فاز اول کامل‌اند.
   بعدی: حوزه‌ی **چارچوب مشترک (PF)** یا شروع فاز ثبت و ویرایش — تصمیم با کاربر. دورهای بهبود PE-02 و فرم‌های PC با نظر کاربر.
4. افزودن ثبت و ویرایش به فرم‌های پیاده‌شده و تغییر وضعیت فیچرها به «تحویل شده».
5. جایگزینی کدهای موقت با کدلیست اصلی.

---

## ۱۴. روند تحویل هر فرم

1. خواندن مشخصات فرم، فیچرها و عملیات از `alm`.
2. بررسی جدول‌های معادل در `mfr` و `generalmfr`.
3. ساخت جدول‌ها، توابع و رویه‌ها در `mes` و اجرای آن‌ها روی دیتابیس لوکال؛ اسکریپت کامل در `scripts` ثبت می‌شود.
4. اجرای رویه‌ها روی داده‌ی واقعی در سطح کل مجموعه، خط و ایستگاه.
5. افزودن اندپوینت به `server.js` و چهار فایل فرم در فرانت‌اند.
6. ساخت برنامه و تست صفحه در مرورگر آزمایشی.
7. ثبت وضعیت و شرح پیاده‌سازی فیچرها در ALM.
8. گزارش به همراه فرض‌ها و موارد باز.
