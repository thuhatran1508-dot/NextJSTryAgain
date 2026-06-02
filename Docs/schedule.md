# Quy Trinh Vibecoding Web App Next.js Bang Codex

Tai lieu nay dung de follow tung buoc khi lam web app thay the quy trinh VBA Excel hien tai. Doi tuong doc la nguoi non-tech, nen moi buoc se noi ro:

- Can lam gi.
- Noi voi Codex nhu the nao.
- Can kiem tra ket qua nao.
- Khi nao duoc xem la xong buoc do.

Web app muc tieu:

- Frontend/backend: Next.js.
- Database: Firebase Firestore.
- Luu file neu can: Firebase Storage.
- Hosting: Vercel.
- Logic can giu lai tu VBA: import Excel don hang, apply rule MHB/MAV, validation master data, export CSV.

## Nguyen Tac Lam Viec Voi Codex

### 1. Moi lan chi yeu cau mot viec ro rang

Khong nen noi chung chung nhu:

```text
Hay lam het app cho toi.
```

Nen noi cu the:

```text
Hay tao man hinh quan ly CusCodeList gom danh sach, them, sua, xoa, tim kiem. Du lieu luu vao Firestore collection cusCodeList.
```

### 2. Sau moi buoc phai chay thu

Sau khi Codex code xong, luon yeu cau:

```text
Hay chay test/build/lint neu co, va bao toi ket qua.
```

Neu app co giao dien, can mo trinh duyet va tu kiem tra:

- Nut co bam duoc khong.
- Form co nhap duoc khong.
- Luu data co vao Firebase khong.
- Loi co hien thi de hieu khong.

### 3. Khong sua qua nhieu module trong mot lan

Thu tu uu tien:

1. Lam nen tang du lieu.
2. Lam master data.
3. Lam cau hinh import.
4. Lam import Excel.
5. Lam rule MHB/MAV.
6. Lam validation.
7. Lam export CSV.
8. Lam deploy.

### 4. Khi Codex lam sai, dua loi cu the

Nen copy loi va noi:

```text
Khi toi bam Upload Excel thi bi loi sau: [dan loi vao day]. Hay doc code lien quan va sua loi nay.
```

Khong nen noi:

```text
App loi roi sua di.
```

## Tong Quan Quy Trinh Tu VBA Sang Web App

Quy trinh Excel hien tai co 3 buoc lon:

1. `ImportOrderData`: chon file Excel don hang, doc cac sheet hien thi, lay du lieu tu dong 17 tro xuong neu cot `R` co gia tri, map vao sheet `CSVExport`.
2. `FillDataMHB` / `FillDataMAV`: tuy khach hang MHB hoac MAV, copy gia tri co dinh, lookup master data, tinh gia, danh so dong, danh dau cac o thieu.
3. `Export`: xuat tu cot `A:AO`, tu dong `8` den dong cuoi, giu format ngay `yyyymmdd`, CSV UTF-8 co BOM.

Trong web app, 3 buoc nay se thanh cac man hinh/chuc nang:

1. Quan ly master data.
2. Quan ly cau hinh gia tri co dinh.
3. Quan ly mapping file Excel don hang.
4. Upload/import Excel tao batch.
5. Nhap ma PIC/kho cho batch.
6. Chon rule MHB/MAV va apply.
7. Validation va goi y bo sung master data.
8. Export CSV.

## Phase 0: Chuan Bi Moi Truong

### Buoc 0.1: Kiem tra project hien tai

Muc tieu: biet project dang co gi, dung framework/package nao.

Prompt cho Codex:

```text
Hay kiem tra cau truc project hien tai, doc package.json va cho toi biet app dang dung Next.js version nao, co TypeScript khong, co Tailwind/shadcn khong, va len danh sach cac thu muc quan trong.
```

Can kiem tra:

- Co file `package.json`.
- Co chay duoc `npm install` hoac package manager tuong ung.
- Co chay duoc dev server.

Tieu chi xong:

- Biet lenh chay app, vi du `npm run dev`.
- Biet project dung App Router hay Pages Router.
- Biet UI dang dung thu vien nao.

### Buoc 0.2: Tao file env cho Firebase

Muc tieu: chuan bi bien moi truong de ket noi Firebase.

Viec ban can lam tren Firebase Console:

1. Tao Firebase project.
2. Tao Web App trong Firebase.
3. Bat Firestore Database.
4. Neu can login, bat Authentication.
5. Neu can luu file Excel/CSV, bat Storage.
6. Copy config Firebase.

Prompt cho Codex:

```text
Hay tao cau truc ket noi Firebase cho Next.js. Tao file vi du .env.example voi cac bien NEXT_PUBLIC_FIREBASE_..., tao module lib/firebase.ts de khoi tao app, auth, firestore, storage. Khong dua secret that vao code.
```

Can kiem tra:

- `.env.example` co du bien.
- `.env.local` cua ban co gia tri that.
- App chay khong bao loi Firebase config.

Tieu chi xong:

- Next.js import duoc Firebase.
- Firestore san sang de doc/ghi data.

## Phase 1: Thiet Ke Data Model

### Buoc 1.1: Tao schema Firestore

Muc tieu: thong nhat du lieu se luu nhu the nao truoc khi lam giao dien.

Collections can co toi thieu:

- `cusCodeList`
- `itemCodeList`
- `unitPriceList`
- `picWhCodeList`
- `unitCodeList`
- `fixedValueConfigs`
- `importMappingConfigs`
- `importBatches`
- `importBatchRows`
- `validationIssues`
- `exportHistory`

Prompt cho Codex:

```text
Du vao Docs/Plan.md va Docs/VBACode.docx, hay tao data model TypeScript cho Firestore. Can co types/interfaces cho master data, fixed value config, import mapping config, import batch, batch row, validation issue, export history. Dat trong thu muc phu hop cua project.
```

Can kiem tra:

- Ten field de hieu, khong qua viet tat.
- Cac cot Excel quan trong duoc map ro: `A`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`, `K`, `L`, `M`, `N`, `O`, `P`, `Q`, `R`, `S`, `T`, `U`, `V`, `W`, `X`, `Y`, `Z`, `AA`, `AB`, `AD`, `AE`, `AF`, `AG`, `AH`, `AI`, `AJ`, `AK`, `AL`, `AM`, `AN`, `AO`, `AP`, `AQ`.
- Co field audit nhu `createdAt`, `updatedAt`, `createdBy`, `updatedBy` neu can.

Tieu chi xong:

- Co type ro rang cho toan bo app.
- Cac buoc sau chi dung lai type nay, khong tao lung tung.

### Buoc 1.2: Tao service doc/ghi Firestore

Muc tieu: UI khong goi Firestore truc tiep lung tung, ma qua service.

Prompt cho Codex:

```text
Hay tao cac service Firestore cho master data va config. Moi service can co list, get, create, update, delete. Viet gon, dung type da tao, va dung converter/helper neu phu hop voi pattern project.
```

Can kiem tra:

- Co service rieng cho master data.
- Co service cho fixed value config.
- Co service cho import mapping config.
- Loi Firebase duoc handle de hien thong bao de hieu.

Tieu chi xong:

- Code UI sau nay co the goi service de doc/ghi.

## Phase 2: Lam Master Data

Master data thay the cac sheet danh muc trong Excel.

### Buoc 2.1: Man hinh danh sach master data

Muc tieu: co khu vuc quan ly cac danh muc:

- `CusCodeList`
- `ItemCodeList`
- `UnitPriceList`
- `PIC.WH.CodeList`
- `UnitCodeList`

Prompt cho Codex:

```text
Hay tao man hinh Master Data gom cac tab: CusCodeList, ItemCodeList, UnitPriceList, PIC.WH.CodeList, UnitCodeList. Moi tab hien danh sach data tu Firestore, co search, nut them moi, sua, xoa. Giao dien don gian, de dung cho nhan vien van hanh.
```

Can kiem tra:

- Chuyen tab khong loi.
- Them moi duoc.
- Sua duoc.
- Xoa duoc.
- Search duoc.
- Reload trang data van con.

Tieu chi xong:

- 5 danh muc quan trong co the quan ly tren web.

### Buoc 2.2: Import master data tu CSV/Excel

Muc tieu: khong phai nhap tay tung dong master data.

Prompt cho Codex:

```text
Hay them chuc nang import master data tu file CSV hoac Excel cho tung tab master data. Can preview truoc khi luu, bao loi dong nao thieu field bat buoc, va chi luu khi nguoi dung xac nhan.
```

Can kiem tra:

- Upload file dung format thi preview duoc.
- File sai format thi bao loi de hieu.
- Khong tao duplicate neu co khoa chinh trung.

Tieu chi xong:

- Co the dua du lieu tu Excel cu vao Firestore nhanh.

## Phase 3: Lam Cau Hinh Gia Tri Co Dinh

### Buoc 3.1: Man hinh fixed values

Muc tieu: thay the cac o mau trong `CSVExport` nhu `C5`, `D5`, `O5`, `P5`, `Q5`, `R5`, `S5`, `U5`, `V5`, `AE5`.

Gia tri ban dau:

| O Excel | Cot CSV | Gia tri |
| --- | --- | --- |
| `C5` | `C` | `0` |
| `D5` | `D` | `1` |
| `O5` | `O` | `51` |
| `P5` | `P` | `TK11` |
| `Q5` | `Q` | `1` |
| `R5` | `R` | `1` |
| `S5` | `S` | `1` |
| `U5` | `U` | `JPY` |
| `V5` | `V` | `JPY` |
| `AE5` | `AE` | `1` |

Prompt cho Codex:

```text
Hay tao man hinh cau hinh Fixed Values cho cac gia tri co dinh tu CSVExport. Hien thi cot Excel goc, cot CSV dich, ten chi tieu, gia tri mac dinh, ghi chu. Cho phep sua gia tri va luu vao Firestore collection fixedValueConfigs.
```

Can kiem tra:

- Data mac dinh duoc seed neu Firestore chua co.
- Sua gia tri va luu duoc.
- Refresh van thay gia tri moi.

Tieu chi xong:

- Logic apply rule co the lay gia tri tu config, khong hard-code.

### Buoc 3.2: Luu lich su thay doi fixed values

Muc tieu: biet ai sua, sua luc nao, gia tri cu/moi.

Prompt cho Codex:

```text
Hay them lich su thay doi cho fixedValueConfigs. Moi lan sua can ghi oldValue, newValue, userId/userEmail neu co, changedAt. Tao man hinh xem history theo tung config.
```

Can kiem tra:

- Sua mot gia tri tao ra mot record history.
- Xem history duoc.

Tieu chi xong:

- Co audit trail cho gia tri co dinh.

## Phase 4: Lam Cau Hinh Mapping Import Excel

### Buoc 4.1: Tao mapping mac dinh tu VBA

Muc tieu: chuyen logic `ImportOrderData` thanh cau hinh.

Mapping mac dinh:

| Nguon Excel don hang | Dich CSV | Ghi chu |
| --- | --- | --- |
| `K4` | `A` | gia tri cap sheet |
| `D4` | `E`, `I`, `J` | mot nguon ra nhieu cot |
| `K8` | `K` | gia tri cap sheet |
| `Q5` | `W` | ngay dat hang |
| `Q7 - 1` | `X`, `AO` | ngay tru 1 |
| `Q7` | `Y` | ngay |
| auto number | `AD` | so thu tu |
| cot `C` dong chi tiet | `Z` | theo dong |
| cot `I` dong chi tiet | `AA` | theo dong |
| cot `E` dong chi tiet | `AB` | theo dong |
| cot `M` dong chi tiet | `AG` | ten hang |
| cot `R` dong chi tiet | `AI` | so luong, dong hop le |
| cot `U` dong chi tiet | `AM` | don gia |
| cot `V` dong chi tiet | `AN` | thanh tien |
| cot `L` dong chi tiet | `AP` | ma vat tu nha may VN |
| cot `S` dong chi tiet | `AQ` | unit code nha may |

Prompt cho Codex:

```text
Hay tao importMappingConfigs mac dinh dua tren macro ImportOrderData. Can ho tro sourceType la sheetCell, detailColumn, expression, generated. Can co startDetailRow mac dinh 17 va validRowColumn mac dinh R. Tao seed/helper de tao config neu Firestore chua co.
```

Can kiem tra:

- Mapping hien dung nhu bang tren.
- Co `startDetailRow = 17`.
- Co `validRowColumn = R`.
- Co ho tro `Q7 - 1`.

Tieu chi xong:

- Import Excel sau nay khong phu thuoc hard-code vi tri o/cot.

### Buoc 4.2: Man hinh sua mapping

Muc tieu: nguoi dung sua mapping khi form don hang thay doi.

Prompt cho Codex:

```text
Hay tao man hinh Import Mapping Config. Cho phep xem/sua mapping nguon-dich, chon sourceType, sourceCell/sourceColumn, targetColumns, expression, startDetailRow, validRowColumn. Can validate input de tranh mapping sai.
```

Can kiem tra:

- Sua `startDetailRow`.
- Sua `validRowColumn`.
- Sua mapping mot nguon ra nhieu cot.
- Luu va refresh khong mat.

Tieu chi xong:

- Nguoi dung co the doi mapping tren giao dien.

## Phase 5: Lam Import Excel Tao Batch

### Buoc 5.1: Tao man hinh Upload Excel

Muc tieu: thay the viec VBA mo dialog chon nhieu file Excel.

Prompt cho Codex:

```text
Hay tao man hinh Import Batch cho phep upload mot hoac nhieu file Excel .xls/.xlsx/.xlsm. Khi upload, app doc workbook, bo qua sheet an neu thu vien ho tro, doc cac sheet hien thi, lay dong chi tiet tu startDetailRow, chi lay dong co gia tri o validRowColumn, map theo importMappingConfigs, roi tao import batch va rows trong Firestore.
```

Can kiem tra:

- Upload duoc nhieu file.
- Sheet an bi bo qua neu lam duoc.
- Dong chi tiet bat dau tu 17.
- Chi lay dong co cot `R`.
- Data duoc luu thanh batch.

Tieu chi xong:

- Sau upload, thay duoc batch moi va so dong import.

### Buoc 5.2: Man hinh chi tiet batch

Muc tieu: xem data da import va nhap ma PIC/kho tuong ung `T5`.

Prompt cho Codex:

```text
Hay tao man hinh chi tiet Import Batch. Hien thong tin batch, danh sach rows da import, ten file nguon, so dong. Them field nhap/sua ma PIC/kho tuong ung cot T. Gia tri nay luu theo batch, khong luu vao fixed values.
```

Can kiem tra:

- Vao batch xem rows.
- Nhap ma PIC/kho va luu.
- Refresh van con ma PIC/kho.

Tieu chi xong:

- Batch co du thong tin de apply rule.

## Phase 6: Apply Rule MHB/MAV

### Buoc 6.1: Tao core logic apply rule

Muc tieu: chuyen `FillDataMHB` va `FillDataMAV` thanh code backend/service, khong viet trong UI.

Logic can co:

- Dien fixed values vao cac cot tuong ung.
- Dien ma PIC/kho cua batch vao cot `T`.
- Lookup `CusCodeList` de dien `F/G/H` tu `E`, va `L/M/N` tu `K`.
- Lookup `ItemCodeList` de dien `AF`.
- Lookup `PIC.WH.CodeList` de dien `AH`.
- Lookup cac danh muc can thiet khac cho `AJ/AK/AL` neu cong thuc Excel cu dang dung.
- Danh so thu tu `AD`.
- Giu logic rieng cho MHB va MAV neu khac nhau.

Prompt cho Codex:

```text
Hay tao service applyCustomerRule cho import batch. Ho tro customerRule = MHB hoac MAV. Logic phai dua tren FillDataMHB/FillDataMAV trong Docs/VBACode.docx va Docs/Plan.md. Khong viet logic trong component UI. Ket qua cap nhat batch rows va batch status rules_applied.
```

Can kiem tra:

- Chon MHB apply duoc.
- Chon MAV apply duoc.
- `AD` duoc danh so tu 1.
- Fixed values lay tu Firestore.
- Ma PIC/kho lay tu batch.

Tieu chi xong:

- Batch sau import co the tao du lieu trung gian giong `CSVExport`.

### Buoc 6.2: Nut Apply Rule tren UI

Muc tieu: nguoi dung bam nut de chay rule.

Prompt cho Codex:

```text
Hay them tren man hinh chi tiet batch mot selector chon rule MHB/MAV va nut Apply Rule. Khi bam, goi service applyCustomerRule, hien loading, hien ket qua so dong da xu ly, va cap nhat status batch.
```

Can kiem tra:

- Khong co ma PIC/kho thi canh bao nhung van cho xu ly theo rule neu thiet ke cho phep.
- Bam Apply Rule khong duplicate rows.
- Apply lai sau khi sua ma PIC/kho duoc.

Tieu chi xong:

- Nguoi dung non-tech co the import xong va bam apply rule.

## Phase 7: Validation Va Goi Y Bo Sung Master Data

### Buoc 7.1: Tao validation service

Muc tieu: thay the viec Excel to mau vang cac o thieu.

Can bat toi thieu:

- Khong tim thay customer code trong `CusCodeList`.
- Khong tim thay item code trong `ItemCodeList`.
- Khong tim thay unit price trong `UnitPriceList`.
- Khong tim thay PIC/warehouse code trong `PIC.WH.CodeList`.
- Khong tim thay unit code trong `UnitCodeList`.
- Ma PIC/kho cua batch trong hoac khong hop le.
- Cot bat buoc bi trong.
- Ngay khong hop le.
- Gia tien trong hoac bang 0 neu bat buoc.

Prompt cho Codex:

```text
Hay tao validation service cho import batch sau khi apply rule. Service tra ve danh sach validationIssues gom rowId, rowNumber, csvColumn, severity, message, missingMasterDataType, sourceValue, suggestedAction. Validation khong mac dinh chan export, chi ghi ro du lieu nao thieu.
```

Can kiem tra:

- Xoa mot master data roi validation phai bao loi.
- Loi co chi ra dong nao, cot nao.
- Loi co goi y can them vao danh muc nao.

Tieu chi xong:

- App biet ro du lieu nao thieu truoc khi export.

### Buoc 7.2: Man hinh validation issues

Muc tieu: nguoi dung xem danh sach loi de bo sung.

Prompt cho Codex:

```text
Hay tao khu vuc Validation tren man hinh batch. Hien tong so loi, loc theo master data can bo sung, loc theo cot CSV, hien dong/cot/ly do/source value/suggested action. Them nut Run Validation.
```

Can kiem tra:

- Xem duoc tong so loi.
- Loc loi duoc.
- Bam vao loi xem duoc dong lien quan.

Tieu chi xong:

- Nguoi dung hieu can sua hoac them master data nao.

### Buoc 7.3: Them nhanh master data tu validation

Muc tieu: giam thao tac cho nguoi dung.

Prompt cho Codex:

```text
Hay them chuc nang Add to Master Data tu moi validation issue neu issue co missingMasterDataType. Khi bam, mo form them nhanh voi sourceValue da dien san. Sau khi luu, cho phep apply rule lai va validation lai batch hien tai.
```

Can kiem tra:

- Tu loi item code them nhanh vao `ItemCodeList`.
- Tu loi customer them nhanh vao `CusCodeList`.
- Them xong chay lai validation, loi giam.

Tieu chi xong:

- Tao duoc vong lap: validation -> bo sung master data -> apply lai -> validation lai.

## Phase 8: Preview Va Export CSV

### Buoc 8.1: Preview CSV

Muc tieu: xem truoc file CSV nhu sheet `CSVExport`.

Prompt cho Codex:

```text
Hay tao man hinh Preview CSV cho batch, hien cac cot A den AO, bat dau tu header tuong duong dong 8 neu co cau hinh header. Cac o thieu du lieu can highlight de nguoi dung thay ro truoc khi export.
```

Can kiem tra:

- Cac cot hien dung thu tu `A:AO`.
- Ngay hien format `yyyymmdd`.
- O thieu duoc danh dau.

Tieu chi xong:

- Nguoi dung xem duoc CSV truoc khi tai file.

### Buoc 8.2: Export CSV UTF-8 co BOM

Muc tieu: thay the macro `Export`.

Yeu cau:

- Export cot `A:AO`.
- Format ngay `W`, `X`, `Y`, `AO` la `yyyymmdd`.
- CSV UTF-8 co BOM.
- Escape dung dau phay, dau nhay kep, xuong dong.
- Cho export ca khi con thieu data, nhung phai canh bao.

Prompt cho Codex:

```text
Hay tao chuc nang Export CSV cho batch. File phai UTF-8 co BOM, export cot A den AO, format ngay W/X/Y/AO thanh yyyymmdd, escape CSV dung chuan. Neu validation con issue, hien dialog xac nhan export with missing data va ghi exportHistory status with_missing_data.
```

Can kiem tra:

- Mo CSV bang Excel khong loi tieng Viet/tieng Nhat.
- Ngay khong bi thanh format la.
- Dong co dau phay/dau nhay van dung cot.
- Export khi con loi co canh bao.
- Export xong co record trong `exportHistory`.

Tieu chi xong:

- Tao duoc file CSV dung format hien tai.

## Phase 9: Authentication Va Phan Quyen

### Buoc 9.1: Firebase Authentication

Muc tieu: biet ai import, ai sua master data, ai export.

Prompt cho Codex:

```text
Hay them Firebase Authentication bang email/password hoac Google login. Tao trang login, logout, guard cac trang noi bo. Luu user email vao cac thao tac create/update/export neu co.
```

Can kiem tra:

- Chua login khong vao duoc app.
- Login xong vao duoc.
- Export history co user email.

Tieu chi xong:

- App co danh tinh nguoi dung.

### Buoc 9.2: Role Admin/Operator/Viewer

Muc tieu: tranh nguoi xem sua nham du lieu.

Prompt cho Codex:

```text
Hay them role Admin, Operator, Viewer. Admin sua config va master data. Operator import/apply/export. Viewer chi xem. An hoac disable nut theo role, dong thoi kiem tra quyen trong service/API route.
```

Can kiem tra:

- Viewer khong sua/xoa/export duoc.
- Operator khong sua mapping/fixed values neu quy dinh khong cho.
- Admin lam duoc tat ca.

Tieu chi xong:

- Quyen han co ban hoat dong.

## Phase 10: Testing

### Buoc 10.1: Test logic quan trong

Muc tieu: tranh sua UI lam hong logic CSV.

Prompt cho Codex:

```text
Hay viet test cho cac logic quan trong: parse Excel theo mapping, apply rule MHB/MAV, validation missing master data, export CSV escaping va format ngay yyyymmdd.
```

Can kiem tra:

- Test pass.
- Co test cho `Q7 - 1`.
- Co test cho CSV co dau phay va dau nhay.
- Co test cho export khi thieu master data.

Tieu chi xong:

- Cac logic loi nhat co test bao ve.

### Buoc 10.2: Test bang file that

Muc tieu: so sanh output web app voi output Excel VBA.

Cach lam:

1. Lay 1 file don hang MHB that.
2. Chay quy trinh cu bang Excel VBA, export CSV.
3. Upload cung file do len web app, chon MHB, export CSV.
4. So sanh 2 file CSV.
5. Lam tuong tu voi MAV.

Prompt cho Codex:

```text
Hay tao huong dan hoac script so sanh 2 file CSV: file export tu Excel VBA va file export tu web app. Can bao dong/cot nao khac nhau.
```

Can kiem tra:

- Dong/cot khac nhau duoc bao ro.
- Neu khac do format ngay/gia, sua logic.

Tieu chi xong:

- Output web app khop VBA voi file mau chap nhan duoc.

## Phase 11: Deploy Len Vercel

### Buoc 11.1: Chuan bi build

Muc tieu: app build thanh cong truoc khi deploy.

Prompt cho Codex:

```text
Hay chay lint/typecheck/build cho project. Neu co loi, hay doc loi va sua den khi build thanh cong.
```

Can kiem tra:

- `npm run build` thanh cong.
- Khong co loi TypeScript.
- Khong co secret Firebase trong code.

Tieu chi xong:

- San sang deploy.

### Buoc 11.2: Deploy Vercel

Muc tieu: dua app len internet cho nguoi dung dung.

Viec ban can lam:

1. Tao account Vercel.
2. Ket noi GitHub repository.
3. Import project vao Vercel.
4. Them environment variables Firebase vao Vercel.
5. Deploy.

Prompt cho Codex:

```text
Hay kiem tra project can cau hinh gi de deploy len Vercel. Neu can sua next.config hoac bien moi truong, hay thuc hien va giai thich ngan gon.
```

Can kiem tra:

- Link Vercel mo duoc.
- Login duoc.
- Doc/ghi Firestore duoc tren production.
- Upload/import/export duoc tren production.

Tieu chi xong:

- Web app co link production dung duoc.

## Phase 12: UAT Cho Nguoi Dung

### Buoc 12.1: Checklist nghiem thu

Dung checklist nay de test truoc khi xem la hoan thanh.

Master data:

- Them/sua/xoa/search 5 danh muc duoc.
- Import master data tu file duoc.
- Data reload khong mat.

Config:

- Sua fixed values duoc.
- Sua import mapping duoc.
- Sua `startDetailRow` va `validRowColumn` duoc.

Import:

- Upload nhieu file Excel duoc.
- Bo qua sheet an neu co.
- Chi lay dong co cot `R`.
- Tao batch va rows dung.

Apply rule:

- Chon MHB apply duoc.
- Chon MAV apply duoc.
- Ma PIC/kho cot `T` lay tu batch.
- `AD` danh so dung.

Validation:

- Bao loi thieu customer/item/unit price/PIC/unit code.
- Loi co dong, cot, ly do.
- Them nhanh master data duoc.
- Apply lai va validation lai duoc.

Export:

- Preview cot `A:AO`.
- Export CSV UTF-8 co BOM.
- Ngay la `yyyymmdd`.
- Export khi con thieu data co canh bao.
- Export history co ghi nhan.

Deploy:

- Production Vercel chay duoc.
- Firestore production doc/ghi duoc.

### Buoc 12.2: Sua theo feedback

Prompt cho Codex:

```text
Day la feedback UAT: [dan danh sach feedback]. Hay phan loai thanh bug, improvement, va question. Sau do sua cac bug truoc, moi lan sua xong hay chay build/test.
```

Tieu chi xong:

- Bug nghiem trong da sua.
- Nguoi dung co the chay quy trinh tu import den export.

## Lich Lam Viec De Xuat

Neu lam theo vibecoding tung buoc, nen chia nhu sau:

### Ngay 1: Nen tang

- Kiem tra project.
- Cai Firebase.
- Tao data model.
- Tao Firestore services.

Ket qua can co: app chay duoc va ket noi Firebase.

### Ngay 2: Master Data

- Lam 5 man hinh/tab master data.
- Them/sua/xoa/search.
- Import master data tu file.

Ket qua can co: danh muc Excel cu dua duoc len web.

### Ngay 3: Config

- Fixed values.
- Import mapping.
- Seed config mac dinh tu VBA.

Ket qua can co: khong hard-code cac o/cot Excel quan trong.

### Ngay 4: Import Excel

- Upload nhieu file.
- Parse workbook/sheet.
- Map theo config.
- Tao batch va rows.

Ket qua can co: file Excel don hang vao duoc web app.

### Ngay 5: Apply Rule

- Rule MHB.
- Rule MAV.
- Ma PIC/kho theo batch.
- Danh so `AD`.
- Lookup master data.

Ket qua can co: batch co du lieu trung gian giong `CSVExport`.

### Ngay 6: Validation

- Validation service.
- Man hinh loi.
- Goi y bo sung master data.
- Them nhanh master data.

Ket qua can co: biet ro du lieu nao thieu va sua duoc.

### Ngay 7: Export

- Preview CSV.
- Export UTF-8 BOM.
- Format ngay.
- Export history.
- Canh bao khi con thieu data.

Ket qua can co: co file CSV dung nhu quy trinh cu.

### Ngay 8: Auth, Role, Test

- Login.
- Role Admin/Operator/Viewer.
- Test logic import/rule/validation/export.

Ket qua can co: app an toan hon va co test bao ve logic.

### Ngay 9: So Sanh Voi VBA

- Chay file MHB mau tren VBA va web app.
- Chay file MAV mau tren VBA va web app.
- So sanh CSV.
- Sua cac khac biet.

Ket qua can co: output web app khop output Excel VBA.

### Ngay 10: Deploy Va UAT

- Build.
- Deploy Vercel.
- Test production.
- UAT voi nguoi dung.

Ket qua can co: link web app dung duoc that.

## Prompt Mau Tong Hop Cho Tung Buoc

### Prompt khi bat dau mot buoc moi

```text
Hay doc Docs/Plan.md, Docs/VBACode.docx va Docs/schedule.md. Bay gio toi muon lam Phase [so phase] - [ten phase]. Hay kiem tra code hien tai truoc, sau do implement theo dung pattern project. Sau khi xong hay chay test/build neu co va tom tat file da sua.
```

### Prompt khi can sua loi

```text
Toi gap loi khi [hanh dong]. Loi hien thi la:
[dan loi]

Hay tim nguyen nhan trong code, sua loi, va chay lai lenh kiem tra phu hop.
```

### Prompt khi can them giao dien

```text
Hay them giao dien cho [ten chuc nang]. Doi tuong dung la nhan vien van hanh non-tech, nen UI can ro rang, it chu giai thich thua, nut bam de hieu, co loading/error/empty state.
```

### Prompt khi can bao ve logic

```text
Hay viet test cho logic [ten logic]. Test can co case thanh cong, case data thieu, va case format dac biet. Sau do chay test va bao ket qua.
```

## Cac Diem Khong Duoc Quen

- `T5` trong Excel khong nen la fixed value toan he thong. Tren web, no la ma PIC/kho nhap theo tung batch.
- Validation khong duoc mac dinh chan export. Nguoi dung co the export voi field thieu de trong sau khi xac nhan.
- Fixed values va import mapping phai quan ly bang Firestore config, khong hard-code trong code.
- Rule MHB/MAV phai o service/core logic, khong nam truc tiep trong component UI.
- Export CSV phai co UTF-8 BOM de tranh loi tieng Viet/tieng Nhat khi mo bang Excel.
- Cot ngay `W`, `X`, `Y`, `AO` phai format `yyyymmdd`.
- Import chi lay dong chi tiet tu dong `17` va cot dieu kien mac dinh la `R`, nhung 2 gia tri nay phai cho phep cau hinh.
- Can so sanh output web app voi output VBA bang file mau truoc khi dung that.
