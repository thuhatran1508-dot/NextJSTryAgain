# Plan Chuyển Quy Trình VBA Excel Sang Web App Next.js

## Mục Tiêu

Chuyển quy trình hiện tại từ VBA Excel sang một web app dùng Next.js, Firebase và Vercel.

Quy trình mới cần giữ đúng logic đang làm trong Excel:

1. Quản lý master data.
2. Quản lý cấu hình dữ liệu đầu vào, gồm giá trị cố định và mapping dữ liệu lấy từ file Excel đơn hàng.
3. Import file Excel đơn hàng.
4. Apply rule theo khách hàng MHB/MAV.
5. Validation dữ liệu.
6. Hiển thị thông tin còn thiếu và gợi ý cần update vào master data.
7. Người dùng quyết định bổ sung master data để hoàn thiện dữ liệu hoặc export luôn với các ô thiếu để trống.
8. Export CSV.
9. Đây là webapp cho người Nhật dùng nên tất cả thanh tiêu đề, button, alert, confirm, tooltip, label, validation message và các text UI/UX khác đều phải bằng tiếng Nhật (trừ dữ liệu master data do người dùng quản lý).
## Workflow Đề Xuất

### 1. Master Data

Hệ thống cần có các màn hình quản lý danh mục thay cho các sheet danh mục trong Excel:

- `CusCodeList`
- `ItemCodeList`
- `UnitPriceList`
- `PIC.WH.CodeList`
- `UnitCodeList`

Người dùng có thể thêm, sửa, xóa, import và tìm kiếm dữ liệu trong các danh mục này.

### 2. Quản Lý Cấu Hình Dữ Liệu Đầu Vào

Hiện tại dữ liệu đầu vào của quy trình đến từ 2 nguồn chính:

1. Các giá trị cố định đang được lấy từ dòng mẫu trong sheet `CSVExport`, ví dụ `C5`, `D5`, `O5`, `P5`, `Q5`, `R5`, `S5`, `U5`, `V5`, `AE5`.
2. Các giá trị được lấy trực tiếp từ file Excel đơn hàng import, ví dụ `K4`, `D4`, `K8`, `Q5`, `Q7` và các cột chi tiết từ dòng 17 trở xuống.

Khi chuyển sang web app, cả 2 nhóm này không nên hard-code trong source code. Nên có màn hình cấu hình riêng để người dùng có thể thay đổi khi form đơn hàng hoặc rule xử lý thay đổi.

#### 2.0. Cấu Trúc Màn Hình Cấu Hình Theo Quyết Định Mới

Phần cấu hình Mapping không đặt thành một nhóm menu riêng gồm nhiều mục con nữa. Sidebar chỉ tạo một mục chính:

- `設定`

Bên trong `設定`, cấu trúc tạm thời như sau:

- `Hiển thị`: tạm thời để trống. Phần này sẽ thiết lập sau trong phiên làm việc khác.
- `マッピング一覧`: tab quan trọng của phần cấu hình Mapping.

Không đặt các mục sau trong sidebar hoặc tab của phần cấu hình Mapping:

- `インポート`
- `バッチ処理`
- `固定値設定`
- `マスタデータ`
- `照明`
- `エクスポート履歴`

Lý do:

- `インポート`, `バッチ処理`, `エクスポート履歴` thuộc luồng xử lý nghiệp vụ import/export, không phải tab cấu hình Mapping.
- `マスタデータ` đã có phân hệ riêng, không đặt lặp lại trong phần này.
- `照明` không thuộc phạm vi cần làm ở giai đoạn này.
- `固定値設定` không tách thành tab riêng trong cấu trúc mới; các giá trị cố định được quản lý như một kiểu `Cách lấy dữ liệu` trong từng dòng Mapping.

Tab `マッピング一覧` là tab quan trọng của phần `設定`. Tab này cho phép người dùng quản lý Mapping theo từng cột CSV: thêm mới, sửa, xóa và lưu Mapping.

Mỗi Mapping cần có:

- Tên Mapping.
- Danh sách thiết lập quy tắc nhập liệu cho từng cột trong file CSV.

#### 2.1. Quản Lý Giá Trị Cố Định

Các giá trị cố định cần quản lý:

| Ô Excel hiện tại | Cột CSV tương ứng | Tên chỉ tiêu | Giá trị mặc định | Ghi chú |
| --- | --- | --- | --- | --- |
| `C5` | `C` | 分納区分 | `0` | Giá trị cố định |
| `D5` | `D` | 取引区分 | `1` | Giá trị cố định |
| `O5` | `O` | 売上担当者コード | `51` | Giá trị cố định |
| `P5` | `P` | 売上計上部門コード | `TK11` | Giá trị cố định |
| `Q5` | `Q` | 売上取引形態区分 | `1` | Giá trị cố định |
| `R5` | `R` | 売上計上基準区分 | `1` | Giá trị cố định |
| `S5` | `S` | 請求帳端区分 | `1` | Giá trị cố định |
| `U5` | `U` | 取引通貨コード | `JPY` | Giá trị cố định |
| `V5` | `V` | 明細取引通貨コード | `JPY` | Giá trị cố định |
| `AE5` | `AE` | 手配区分 | `1` | Giá trị cố định |

Yêu cầu cho màn hình quản lý giá trị cố định:

- Cho phép xem danh sách tất cả giá trị cố định.
- Cho phép sửa giá trị mặc định.
- Cho phép cấu hình theo khách hàng nếu sau này MHB/MAV có giá trị khác nhau.
- Lưu lịch sử thay đổi: ai sửa, sửa lúc nào, giá trị cũ, giá trị mới.
- Khi apply rule MHB/MAV, hệ thống lấy giá trị từ cấu hình này thay vì hard-code.

#### 2.2. Quản Lý Mapping Dữ Liệu Từ File Excel Đơn Hàng

Hiện tại macro `ImportOrderData` đang lấy dữ liệu từ file Excel đơn hàng theo mapping sau:

| Nguồn trong file Excel đơn hàng | Đích trong CSVExport | Tên chỉ tiêu | Ghi chú |
| --- | --- | --- | --- |
| `K4` | `A` | 会社コード | Giá trị cấp sheet |
| `D4` | `E` / `I` / `J` | 得意先コード | Cùng một giá trị nguồn dùng cho nhiều cột đích |
| `K8` | `K` | 納入先コード | Giá trị cấp sheet |
| `Q5` | `W` | 受注日 | Ngày, format export `yyyymmdd` |
| `Q7 - 1` | `X` / `AO` | 出荷予定日 | Ngày, format export `yyyymmdd` |
| `Q7` | `Y` | 出荷予定日 | Ngày, format export `yyyymmdd` |
| Hệ thống tự sinh | `AD` | 売上伝票行番号 | Đánh số thứ tự từ `1`, tăng dần theo từng dòng chi tiết hợp lệ |
| Cột `C` dòng chi tiết | `Z` | 拡張コード項目２ | Dữ liệu theo từng dòng chi tiết |
| Cột `I` dòng chi tiết | `AA` | 拡張コード項目３ | Dữ liệu theo từng dòng chi tiết |
| Cột `E` dòng chi tiết | `AB` | 拡張テキスト項目１ | Dữ liệu theo từng dòng chi tiết |
| Cột `M` dòng chi tiết | `AG` | 商品名 | Dữ liệu theo từng dòng chi tiết |
| Cột `R` dòng chi tiết | `AI` | 受注数 | Dữ liệu theo từng dòng chi tiết, hiện cũng là điều kiện xác định dòng hợp lệ |
| Cột `U` dòng chi tiết | `AM` | 取引通貨受注単価 | Dữ liệu theo từng dòng chi tiết |
| Cột `V` dòng chi tiết | `AN` | 取引通貨明細受注金額 | Dữ liệu theo từng dòng chi tiết |
| Cột `L` dòng chi tiết | `AP` | ベトナム工場の資材コード | Dữ liệu theo từng dòng chi tiết |
| Cột `S` dòng chi tiết | `AQ` | 単位コード(工場) | Dữ liệu theo từng dòng chi tiết |

Yêu cầu cho màn hình quản lý mapping dữ liệu import:

- Cho phép xem danh sách mapping nguồn - đích hiện tại.
- `Admin` và `Operator` có quyền xử lý tất cả tác vụ trong màn hình Mapping như nhau, bao gồm xem, tạo, sửa, xóa, lưu, preview và apply mapping. Không phân biệt quyền giữa 2 role này trong phạm vi Mapping.
- Cho phép sửa ô nguồn, cột nguồn hoặc cột đích nếu form Excel đơn hàng thay đổi.
- Cho phép cấu hình một nguồn map sang nhiều cột đích, ví dụ `D4` map sang `E`, `I`, `J`.
- Cho phép cấu hình biểu thức đơn giản, ví dụ `Q7 - 1` cho các cột `X` và `AO`.
- Cho phép phân biệt dữ liệu cấp sheet và dữ liệu theo dòng chi tiết.
- Cho phép quản lý `startDetailRow` (明細開始行) trong Mapping để người dùng nhập/sửa dòng bắt đầu đọc chi tiết, hiện tại gợi ý là dòng `17`.
- Cho phép quản lý `validRowColumn` (有効行判定列) trong Mapping để người dùng nhập/sửa cột dùng xác định dòng chi tiết hợp lệ, hiện tại gợi ý là cột `R`.
- `startDetailRow` và `validRowColumn` là 2 chỉ tiêu bắt buộc. Nếu người dùng không nhập, nhập sai kiểu hoặc nhập giá trị không hợp lệ, hệ thống phải báo lỗi bằng tiếng Nhật và không cho lưu mapping, preview, import hoặc apply mapping tiếp.
- Cho phép cấu hình theo khách hàng hoặc theo loại form đơn hàng nếu sau này MHB/MAV dùng form khác nhau.
- Lưu lịch sử thay đổi mapping: ai sửa, sửa lúc nào, giá trị cũ, giá trị mới.

- Cho phép cấu hình định dạng cho từng cột đích (ví dụ: `string`, `number`, `date` với `yyyymmdd`, hoặc `date` với offset như `Q7 - 1`).
- Khi hiển thị danh sách mapping, sắp xếp theo thứ tự cột CSV (A → B → C → ...) để người dùng dễ theo dõi.
- Toàn bộ UI/UX của màn hình Mapping phải dùng tiếng Nhật, ví dụ: `設定`, `マッピング一覧`, `新規マッピング`, `編集`, `削除`, `保存`, `プレビュー`, `適用`, `明細開始行`, `有効行判定列`. Các lỗi bắt buộc nhập nên hiển thị dạng `明細開始行を入力してください。` và `有効行判定列を入力してください。`

Trong tab `マッピング一覧`, cấu trúc cấu hình nhanh cho từng dòng Mapping:

| Cột trong File CSV | Tên Cột | Cách lấy dữ liệu |
| --- | --- | --- |
| `C` | `分納区分` | Người dùng chọn một cách lấy dữ liệu |

Các lựa chọn `Cách lấy dữ liệu`:

- Lấy từ file đơn hàng.
- Giá trị cố định.
- Đối chiếu / lấy dữ liệu từ master data.
- Công thức tính toán.

Chi tiết từng cách lấy dữ liệu:

- `Lấy từ file đơn hàng`: người dùng chọn kiểu lấy dữ liệu:
  - Lấy từ 1 ô cố định.
  - Lấy từ 1 mảng dữ liệu.
  - Lấy bằng công thức tính toán dựa trên dữ liệu lấy vào từ file đơn hàng.
- Nếu lấy từ 1 ô cố định: người dùng nhập vị trí ô nguồn, ví dụ `K4`, `Q5`, `Q7`.
- Nếu lấy từ 1 mảng dữ liệu: người dùng nhập cột nguồn cần lấy dữ liệu, dòng bắt đầu, và điều kiện xác định dòng kết thúc. Điều kiện kết thúc có thể là dòng cuối có giá trị ở một cột được chọn.
- Nếu lấy bằng công thức dựa trên dữ liệu file đơn hàng: người dùng nhập dữ liệu nguồn là số hay mảng, vị trí ô/cột nguồn, và công thức. Giai đoạn đầu áp dụng chủ yếu cho trường hợp lấy ngày tháng rồi cộng/trừ một số ngày, ví dụ lấy `Q7` rồi trừ `1` ngày.
- Format dữ liệu lấy vào gồm 3 loại:
  - Giữ nguyên format của file gốc.
  - Dạng number `00,000.00`.
  - Dạng ngày tháng `yyyymmdd`.
- `Giá trị cố định`: cho phép nhập trực tiếp giá trị cố định cho cột CSV tương ứng.
- `Công thức tính toán`: cho phép nhập công thức tính toán theo cách hiển thị như trong Excel. Ví dụ `=A*C` nghĩa là cột CSV hiện tại có giá trị bằng kết quả phép nhân giữa giá trị ở cột `A` và giá trị ở cột `C` của cùng dòng CSV đang xét.
- `Đối chiếu / lấy dữ liệu từ master data`: mô phỏng logic giống hàm `VLOOKUP` trong Excel. Người dùng cần nhập/chọn:
  - Cột có dữ liệu cần tham chiếu trong file CSV.
  - Collection master data cần tham chiếu. UI hiển thị danh sách collection master data để người dùng chọn.
  - Field dùng để tham chiếu trong collection đã chọn. UI hiển thị danh sách field của collection đã chọn.
  - Field cần lấy ra trong document đã tìm thấy. UI hiển thị danh sách field của collection đã chọn.
  - Cột CSV nhận kết quả trả về.

Màn hình phải cho phép thêm mới, xóa, sửa và lưu Mapping.

Khi import Excel, hệ thống sẽ đọc mapping từ cấu hình này. Nếu sau này form đơn hàng thay đổi vị trí ô hoặc cột, người dùng chỉ cần cập nhật mapping trên giao diện, không cần sửa source code.

### 3. Giá Trị Nhập Tay Trên Màn Hình Xử Lý CSV

Giá trị tương ứng `T5` hiện tại là giá trị người dùng nhập tay cho cột `T` - 倉庫コード. Đây là mã liên quan đến `PICCodeList` / `PIC.WH.CodeList`, nên không nên đặt chung với nhóm giá trị cố định cấu hình một lần rồi dùng mãi.

Trong web app, giá trị này cần được đặt ngay tại màn hình xử lý file CSV/import batch.

Yêu cầu:

- Trên màn hình chi tiết batch hoặc màn hình xử lý CSV, có field nhập/sửa mã PIC/kho tương ứng cột `T` - 倉庫コード.
- Người dùng có thể nhập hoặc thay đổi mã này bất cứ lúc nào trước khi export.
- Khi người dùng thay đổi mã PIC, hệ thống apply lại dữ liệu liên quan cho batch hiện tại nếu cần.
- Nếu mã PIC nhập vào không tồn tại trong `PIC.WH.CodeList` hoặc danh mục liên quan, validation phải cảnh báo.
- Nếu người dùng vẫn muốn export khi mã PIC chưa hợp lệ hoặc chưa có trong master data, hệ thống cho phép export nhưng cột liên quan sẽ để trống theo rule export thiếu dữ liệu.

Giá trị này nên được lưu theo từng batch, không lưu như một giá trị cố định toàn hệ thống.

### 4. Import Excel

Người dùng upload một hoặc nhiều file Excel đơn hàng.

Hệ thống sẽ:

- Đọc từng workbook.
- Đọc từng sheet hợp lệ.
- Bỏ qua sheet ẩn nếu thư viện đọc Excel hỗ trợ.
- Trước khi parse, kiểm tra mapping đã chọn có `startDetailRow` và `validRowColumn` hợp lệ. Nếu thiếu hoặc không hợp lệ thì báo lỗi bằng tiếng Nhật và dừng import.
- Đọc dữ liệu chi tiết từ `startDetailRow` được cấu hình trong Mapping.
- Chỉ lấy những dòng có dữ liệu ở `validRowColumn` được cấu hình trong Mapping.
- Map dữ liệu nguồn vào cấu trúc trung gian tương đương sheet `CSVExport` theo cấu hình mapping import.

Mỗi lần import nên tạo một `Import Batch` để theo dõi riêng.

Thông tin batch nên gồm:

- Tên batch.
- Người import.
- Thời gian import.
- Danh sách file nguồn.
- Mã PIC nhập tay cho batch, tương ứng logic `T5`.
- Số dòng đã đọc.
- Số dòng hợp lệ.
- Số dòng đang thiếu thông tin.
- Trạng thái batch.

### 5. Apply Rule MHB/MAV

Sau khi import, người dùng chọn rule khách hàng:

- `MHB`
- `MAV`

Hệ thống apply các rule tương ứng:

- Điền giá trị cố định từ màn hình cấu hình giá trị cố định.
- Điền mã PIC nhập tay từ màn hình xử lý CSV vào cột tương ứng.
- Lookup dữ liệu từ master data.
- Tính toán các cột cần thiết.
- Đánh số thứ tự.
- Tạo dữ liệu trung gian theo format CSV.

Logic rule cần tách riêng theo khách hàng để sau này có thể thêm rule mới mà không ảnh hưởng toàn bộ hệ thống.

### 6. Validation

Sau khi apply rule, hệ thống validation toàn bộ dữ liệu.

Các lỗi/cảnh báo cần bắt gồm:

- Không tìm thấy customer code trong `CusCodeList`.
- Không tìm thấy item code trong `ItemCodeList`.
- Không tìm thấy unit price trong `UnitPriceList`.
- Không tìm thấy PIC/warehouse code trong `PIC.WH.CodeList`.
- Không tìm thấy unit code trong `UnitCodeList`.
- Mã PIC nhập tay cho batch đang trống hoặc không tồn tại trong danh mục liên quan.
- Thiếu giá trị bắt buộc trong các cột quan trọng.
- Ngày tháng không hợp lệ.
- Giá tiền rỗng hoặc bằng 0 nếu cột đó bắt buộc phải có giá.
- Dữ liệu trùng lặp nếu có rule xác định trùng lặp.

Kết quả validation phải hiển thị rõ trên giao diện:

- Dòng nào lỗi.
- Cột nào lỗi.
- Lý do lỗi.
- Gợi ý cần bổ sung vào danh mục nào.
- Giá trị nguồn nào đang thiếu mapping trong master data.
- Danh sách bản ghi để người dùng có thể thêm nhanh vào master data.

Validation trong hệ thống này không mặc định chặn export. Validation có nhiệm vụ chỉ ra dữ liệu nào đang thiếu, ảnh hưởng đến cột nào trong file CSV và nên bổ sung vào master data nào.

### 7. Hiển Thị Dữ Liệu Thiếu Và Gợi Ý Cập Nhật Master Data

Nếu validation phát hiện dữ liệu còn thiếu, hệ thống sẽ hiển thị một màn hình tổng hợp các thông tin cần bổ sung. Người dùng có thể xem rõ:

- Dữ liệu nào đang thiếu.
- Dòng nào bị ảnh hưởng.
- Cột CSV nào sẽ bị trống nếu không bổ sung.
- Cần bổ sung vào master data nào.
- Giá trị đề xuất tạo mới trong master data nếu có thể suy ra từ file import.

Ví dụ:

- Nếu item code chưa có trong `ItemCodeList`, người dùng thêm item code mới.
- Nếu customer code chưa có trong `CusCodeList`, người dùng thêm thông tin customer.
- Nếu chưa có giá trong `UnitPriceList`, người dùng thêm giá.
- Nếu chưa có mã PIC/kho, người dùng thêm vào `PIC.WH.CodeList`.
- Nếu chưa có unit code, người dùng thêm vào `UnitCodeList`.

Sau khi xem danh sách dữ liệu thiếu, người dùng có 2 lựa chọn:

1. Bổ sung master data rồi chạy lại apply rule/validation.
2. Export CSV luôn, chấp nhận các cột chưa có đủ thông tin sẽ để trống.

Nếu người dùng chọn bổ sung master data, vòng lặp xử lý là:

1. Validation phát hiện lỗi hoặc thiếu thông tin.
2. Người dùng bổ sung master data/thông tin còn thiếu.
3. Hệ thống apply lại rule MHB/MAV cho batch hiện tại.
4. Hệ thống validation lại.
5. Lặp lại cho đến khi người dùng thấy dữ liệu đã đủ hoặc quyết định export.

Nếu người dùng chọn export ngay, hệ thống vẫn tạo file CSV nhưng các field không lookup được hoặc chưa có thông tin sẽ để trống. Trước khi export, hệ thống nên hiển thị cảnh báo xác nhận:

- Tổng số dòng còn thiếu thông tin.
- Tổng số ô/cột sẽ bị để trống.
- Danh sách nhóm lỗi chính.
- Xác nhận rằng người dùng chấp nhận export file chưa đầy đủ.

Batch không bắt buộc phải hoàn chỉnh mới được export. Tuy nhiên, batch cần ghi rõ trạng thái export là đầy đủ hay còn thiếu thông tin.

Trạng thái batch đề xuất:

- `imported`: đã import Excel.
- `rules_applied`: đã apply rule khách hàng.
- `needs_review`: có dữ liệu thiếu cần người dùng xem lại.
- `needs_master_data`: có thông tin nên bổ sung vào danh mục.
- `validated_complete`: dữ liệu đã đầy đủ.
- `exported_complete`: đã export CSV với dữ liệu đầy đủ.
- `exported_with_missing_data`: đã export CSV nhưng vẫn còn ô/cột để trống do thiếu thông tin.

### 8. Export CSV

Cho phép export trong 2 trường hợp:

- Batch đã đầy đủ thông tin và ở trạng thái `validated_complete`.
- Batch còn thiếu thông tin nhưng người dùng xác nhận export với các ô thiếu để trống.

Chức năng export cần:

- Export các cột tương đương `A:AO`.
- Giữ đúng format ngày `yyyymmdd`.
- Tạo file CSV UTF-8 có BOM nếu hệ thống nhận file yêu cầu.
- Escape dấu phẩy, dấu nháy kép và ký tự xuống dòng đúng chuẩn CSV.
- Để trống các field không lookup được nếu người dùng export khi dữ liệu chưa đầy đủ.
- Lưu lịch sử export.

Thông tin lịch sử export nên gồm:

- Batch đã export.
- Người export.
- Thời gian export.
- Số dòng export.
- Trạng thái export: đầy đủ hay còn thiếu thông tin.
- Số dòng/ô/cột còn thiếu tại thời điểm export.
- Tên file CSV.

## MoSCoW Plan

### Must Have

- Web app Next.js deploy trên Vercel.
- Firebase Authentication nếu cần phân quyền người dùng.
- Firestore lưu master data, cấu hình giá trị cố định, import batch, rows và export history.
- Màn hình quản lý các master data chính.
- Màn hình quản lý các giá trị cố định như `C5`, `D5`, `O5`, `P5`, `Q5`, `R5`, `S5`, `U5`, `V5`, `AE5`.
- Màn hình quản lý mapping dữ liệu lấy từ file Excel đơn hàng import sang các cột CSVExport.
- Trong Mapping, `Admin` và `Operator` có full quyền như nhau cho tất cả tác vụ, không phân biệt.
- Cho phép người dùng nhập/sửa `startDetailRow` và `validRowColumn` trực tiếp trong Mapping.
- Bắt buộc validate `startDetailRow` và `validRowColumn`; nếu thiếu hoặc không hợp lệ thì báo lỗi bằng tiếng Nhật và không cho lưu/import/apply mapping tiếp.
- Toàn bộ UI/UX, label, button, alert, confirm và validation message của web app phải bằng tiếng Nhật, trừ dữ liệu master data.
- Field nhập/sửa mã PIC tương ứng `T5` ngay trên màn hình xử lý CSV/import batch.
- Upload và parse file Excel đơn hàng.
- Tạo batch import.
- Map dữ liệu Excel vào cấu trúc trung gian tương đương `CSVExport`.
- Apply rule riêng cho `MHB` và `MAV`.
- Validation dữ liệu sau khi apply rule.
- Hiển thị danh sách lỗi validation theo dòng/cột.
- Hiển thị danh sách thông tin cần update vào master data để hoàn thiện CSV.
- Cho phép người dùng bổ sung master data sau validation.
- Cho phép chạy lại apply rule và validation trên batch hiện tại sau khi bổ sung danh mục hoặc thay đổi mã PIC.
- Cho phép người dùng export CSV ngay cả khi còn thiếu thông tin, với các field thiếu để trống.
- Ghi nhận trạng thái export là `complete` hoặc `with_missing_data`.
- Export CSV đúng format hiện tại.

### Should Have

- Import master data từ file Excel/CSV.
-Export master data ra file Excel/CSV.
- Preview dữ liệu trước khi lưu batch.
- Giao diện sửa nhanh các dòng dữ liệu lỗi.
- Giao diện nhập liệu nhanh bổ sung dữ liệu thiếu sau đó cho phép tự động nhập liệu bổ sung vào master data tương ứng
- Bộ lọc theo trạng thái lỗi.
- Nút thêm nhanh master data từ màn hình validation.
- Màn hình preview CSV trước khi export, bao gồm các ô đang để trống.
- Lịch sử thay đổi master data.
- Lịch sử thay đổi giá trị cố định.
- Lịch sử export CSV.
- Phân quyền Viewer chỉ xem nếu cần. Riêng Mapping thì `Admin` và `Operator` luôn có quyền xử lý đầy đủ như nhau.


### Could Have

- Cấu hình mapping cột/field trên giao diện.
- Cấu hình nhiều template import khác nhau cho nhiều form đơn hàng khác nhau.
- Cấu hình giá trị cố định theo từng khách hàng, từng loại đơn hàng
- Dashboard thống kê batch import/export.
- Cảnh báo dữ liệu trùng lặp giữa các batch.
- Cho phép thêm rule cho khách hàng mới từ màn hình admin.
- Khi có rule cho khách mới thì tự động có thêm tùy chọn xử lý thông tin theo rules mới trên màn hình xử lý import file đơn hàng, export file csv
- So sánh dữ liệu trước và sau khi bổ sung master data.
- Export báo cáo riêng về các thông tin còn thiếu tại thời điểm export.

### Won't Have Trong Giai Đoạn Đầu

- Workflow phê duyệt nhiều cấp.
- Realtime collaboration nhiều người cùng sửa một batch.
- AI tự động sửa dữ liệu.
- Thay thế toàn bộ Excel ngay lập tức.
- Cấu hình rule qua giao diện quá phức tạp.

## Luồng Xử Lý Chính

```text
Master Data + Cau hinh gia tri co dinh + Cau hinh mapping import
    |
    v
Kiem tra startDetailRow + validRowColumn trong Mapping
    |
    v
Import Excel
    |
    v
Nhap/Sua ma PIC cho batch
    |
    v
Apply Rule MHB/MAV
    |
    v
Validation
    |
    v
Co loi/thieu thong tin?
    |-- Co: Hien thi danh sach can update vao master data
    |       |-- Bo sung master data / sua ma PIC -> Apply lai rule -> Validation lai
    |       |-- Export luon -> Cac field thieu de trong
    |-- Khong: Export CSV day du
```

## Ghi Chú Thiết Kế

- Master data là nền tảng của toàn bộ quy trình, nên cần ưu tiên làm ổn định trước.
- Các giá trị cố định cần được quản lý bằng cấu hình, không hard-code trong source code.
- Mapping dữ liệu từ file Excel đơn hàng cũng cần được quản lý bằng cấu hình để khi form import thay đổi thì không cần sửa code.
- `startDetailRow` và `validRowColumn` thuộc cấu hình Mapping, là bắt buộc nhập và phải được validate trước khi lưu mapping hoặc import Excel.
- Trong phạm vi Mapping, không tách quyền thao tác giữa `Admin` và `Operator`; cả hai role có full quyền xử lý như nhau.
- UI/UX phải thống nhất tiếng Nhật cho toàn bộ text hệ thống để phù hợp người dùng Nhật.
- Giá trị nhập tay tương ứng `T5` nên lưu theo từng batch và đặt ngay trên màn hình xử lý CSV để người dùng sửa bất cứ lúc nào.
- Validation không chỉ báo lỗi, mà phải chỉ ra người dùng cần bổ sung thông tin vào danh mục nào.
- Export CSV là bước cuối cùng, nhưng không bị khóa tuyệt đối nếu dữ liệu chưa đầy đủ.
- Khi export với dữ liệu thiếu, hệ thống phải ghi lại rõ batch/export đó còn thiếu thông tin nào.
- Rule MHB/MAV nên nằm ở layer riêng, không viết trực tiếp trong component UI.
- Nên có test cho logic parse Excel, apply rule, validation, cấu hình giá trị cố định và export CSV.
