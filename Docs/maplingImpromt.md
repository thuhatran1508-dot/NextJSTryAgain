# Bộ Prompt Triển Khai Chức Năng Mapping

Mục tiêu của file này: cung cấp các prompt chi tiết theo đúng thứ tự thực hiện để hiện thực hóa các plan đã nêu trong `Docs/Plan.md` và `Docs/maplingusecase.md`.

Cách dùng cho người non-tech:

1. Copy từng prompt theo thứ tự từ trên xuống.
2. Gửi cho AI/dev thực hiện.
3. Sau mỗi prompt, yêu cầu AI/dev báo rõ đã sửa file nào, chạy test gì, còn thiếu gì.
4. Không nhảy bước nếu bước trước chưa chạy được hoặc chưa kiểm tra xong.

Lưu ý bắt buộc xuyên suốt:

- Đây là web app Next.js.
- Toàn bộ UI/UX hiển thị cho người dùng Nhật phải dùng tiếng Nhật.
- Không dùng tiếng Việt/Anh trên UI sản phẩm, trừ dữ liệu master data do người dùng nhập.
- Chức năng Mapping: `Admin` và `Operator` có full quyền như nhau.
- `startDetailRow` / `明細開始行` và `validRowColumn` / `有効行判定列` là bắt buộc.
- Nếu thiếu hoặc sai `startDetailRow` hoặc `validRowColumn`, hệ thống phải báo lỗi tiếng Nhật và không cho lưu, preview, import hoặc apply mapping.
- Không hard-code mapping trong UI component. Logic xử lý nên nằm ở service/helper riêng.

---

## Prompt 01: Khảo sát codebase trước khi triển khai

```text
Hãy đọc codebase hiện tại để hiểu cấu trúc dự án Next.js trước khi sửa code.

Nhiệm vụ:
- Xác định app đang dùng App Router hay Pages Router.
- Xác định thư mục chính: app/pages, components, lib, services, hooks, types, styles.
- Xác định dự án đang dùng Firebase/Firestore chưa.
- Xác định đã có authentication/role Admin/Operator chưa.
- Xác định đã có layout/sidebar/navbar chưa.
- Xác định đã có màn hình import batch hoặc master data chưa.
- Xác định package đang dùng cho form, table, icon, toast, test.

Yêu cầu:
- Chưa sửa code ở bước này.
- Sau khi đọc xong, hãy trả lời ngắn gọn:
  1. Cấu trúc dự án hiện tại.
  2. Những phần đã có thể tái sử dụng.
  3. Những phần cần tạo mới cho Mapping.
  4. Thứ tự file dự kiến sẽ sửa/tạo.
```

---

## Prompt 02: Tạo cấu trúc route và sidebar cho app

```text
Hãy triển khai sidebar/navigation cho web app để người dùng có thể đi tới các màn hình chính.

Bối cảnh:
- Đây là app xử lý import Excel đơn hàng, apply rule MHB/MAV, validation và export CSV.
- UI hiển thị cho người Nhật nên toàn bộ text trên sidebar phải bằng tiếng Nhật.

Yêu cầu sidebar:
- Tận dụng layout/sidebar hiện có nếu project đã có.
- Sidebar chỉ cần thêm hoặc giữ một mục chính cho chức năng này:
  - `設定`
- Không đưa các mục `インポート`, `バッチ処理`, `固定値設定`, `マスタデータ`, `照明`, `エクスポート履歴` ra sidebar.
- `マスタデータ` đã có phân hệ riêng, không đặt lặp lại trong phần này.
- Mục `設定` dẫn tới route chính của phần cấu hình, ví dụ `/settings` hoặc route phù hợp với pattern hiện có của project.
- Active state phải hiển thị rõ khi người dùng đang ở bất kỳ màn hình/tab con nào thuộc `設定`.
- Trên mobile, sidebar vẫn phải hoạt động theo pattern responsive hiện có của project.
- Dùng icon nếu project đã có icon library. Nếu chưa có, cài hoặc dùng icon library phù hợp với project.
- Không dùng text tiếng Việt/Anh trên UI.

Yêu cầu màn hình sau khi click sidebar `設定`:
- Route `設定` là màn hình container chính cho phần cấu hình.
- Bên trong màn hình `設定`, tạo navigation dạng tab hoặc segmented tabs.
- Cấu trúc tab trong giai đoạn này:
  - `Hiển thị`: tạm thời để trống; phiên làm việc sau sẽ thiết lập.
  - `マッピング一覧`
- Tab mặc định khi mở `設定` là `マッピング一覧`.
- Không tạo các tab `インポート`, `バッチ処理`, `固定値設定`, `マスタデータ`, `照明`, `エクスポート履歴` trong màn hình `設定`.
- `固定値設定` không tách thành tab riêng; giá trị cố định là một lựa chọn trong `Cách lấy dữ liệu` của từng dòng Mapping.
- Các tab có thể dùng query string, nested route hoặc state nội bộ tùy pattern project, nhưng URL/deep link nên rõ ràng nếu triển khai được.
- Active state của tab phải hiển thị rõ tab đang được chọn.
- Trên mobile, tab bar phải có thể scroll ngang hoặc chuyển thành UI phù hợp để không vỡ layout.
- Ở bước này chỉ cần tạo khung route/tab và màn hình `マッピング一覧`; không viết logic nghiệp vụ chi tiết ngoài phạm vi Mapping.

Yêu cầu tab `マッピング一覧`:
- Cho phép người dùng xem danh sách Mapping.
- Cho phép thêm mới, sửa, xóa và lưu Mapping.
- Mỗi Mapping phải có `Tên Mapping` / `マッピング名`.
- Mỗi Mapping cho phép người dùng nhập thiết lập quy tắc nhập liệu cho từng cột trong file CSV.
- Cấu trúc dòng Mapping cần hỗ trợ các cột chính:
  - `Cột trong File CSV`
  - `Tên Cột`
  - `Cách lấy dữ liệu`
- `Cách lấy dữ liệu` có các lựa chọn:
  - Lấy từ file đơn hàng.
  - Giá trị cố định.
  - Đối chiếu / lấy dữ liệu từ master data.
  - Công thức tính toán.
- Với `Lấy từ file đơn hàng`, cho phép người dùng chọn kiểu lấy:
  - Lấy từ 1 ô cố định.
  - Lấy từ 1 mảng dữ liệu.
  - Lấy bằng công thức tính toán dựa trên dữ liệu lấy vào từ file đơn hàng.
- Nếu lấy từ 1 ô cố định, UI phải có input nhập vị trí ô nguồn, ví dụ `K4`.
- Nếu lấy từ 1 mảng dữ liệu, UI phải có input/select cho:
  - Cột nguồn cần lấy dữ liệu.
  - Dòng bắt đầu.
  - Cột dùng để xác định dòng kết thúc, tức dòng cuối có giá trị ở cột đó.
- Nếu lấy bằng công thức dựa trên file đơn hàng, UI phải có field cho:
  - Dữ liệu nguồn là số hay mảng.
  - Vị trí ô/cột nguồn.
  - Công thức tính toán.
  - Giai đoạn đầu ưu tiên hỗ trợ trường hợp lấy ngày tháng rồi cộng/trừ một số ngày.
- Format dữ liệu lấy vào có 3 lựa chọn:
  - Giữ nguyên format file gốc.
  - Number `00,000.00`.
  - Date `yyyymmdd`.
- Với `Giá trị cố định`, cho phép nhập giá trị cố định trực tiếp.
- Với `Công thức tính toán`, cho phép nhập công thức kiểu Excel, ví dụ `=A*C`, nghĩa là cột CSV hiện tại bằng giá trị cột `A` nhân với cột `C` ở cùng dòng CSV.
- Với `Đối chiếu / lấy dữ liệu từ master data`, UI phải mô phỏng `VLOOKUP` và có field:
  - Cột có dữ liệu cần tham chiếu trong file CSV.
  - Collection master data cần tham chiếu, hiển thị danh sách collection cho người dùng chọn.
  - Field dùng để tham chiếu trong collection đã chọn, hiển thị danh sách field của collection.
  - Field cần lấy ra trong document đã tìm thấy, hiển thị danh sách field của collection.
  - Cột CSV nhận kết quả trả về.

Yêu cầu kỹ thuật:
- Tận dụng layout/component hiện có nếu có.
- Nếu chưa có layout, tạo layout dùng chung.
- Không làm landing page.
- Không sửa logic nghiệp vụ ở bước này.
- Sau khi làm xong, chạy lint/typecheck nếu project có script.

Kết quả mong muốn:
- Người dùng vào app thấy sidebar có mục chính `設定` cho phần cấu hình.
- Click `設定` mở được route cấu hình.
- Bên trong `設定` có tab `マッピング一覧`; phần `Hiển thị` tạm để trống.
- Không xuất hiện các mục/tab `インポート`, `バッチ処理`, `固定値設定`, `マスタデータ`, `照明`, `エクスポート履歴` trong cấu trúc này.
- Báo rõ đã tạo/sửa những file nào.
```

---

## Prompt 03: Tạo type/model cho Import Mapping Config

```text
Hãy tạo type/model cho cấu hình Mapping theo tài liệu `Docs/maplingusecase.md`.

Data model cần có:
- `id`
- `name`
- `description`
- `startDetailRow`
- `validRowColumn`
- `entries`
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`
- `deleted` nếu dùng soft delete

Mỗi entry cần có:
- `sourceType`: `sheetCell`, `detailColumn`, `expression`, `generated`
- `source`
- `targetColumns`
- `targetColumnName`
- `scope`: `sheet`, `detail`
- `format`: type `string`, `number`, `date`; nếu date có thể có `format: yyyymmdd`, `offsetDays`
- `note`

Yêu cầu:
- Đặt type ở vị trí phù hợp với codebase, ví dụ `src/types`, `lib/types` hoặc pattern đang có.
- Tạo helper sắp xếp target columns theo thứ tự CSV A -> B -> C -> ... -> AO.
- Tạo constant danh sách cột CSV từ `A` đến `AO`.
- Không làm UI ở bước này.
- Không hard-code dữ liệu vào component.
- Chạy typecheck sau khi làm.

Kết quả mong muốn:
- Có type rõ ràng để các bước sau dùng lại.
- Có helper sort cột CSV đúng thứ tự.
- Báo rõ file đã tạo/sửa.
```

---

## Prompt 04: Tạo validation cho Mapping

```text
Hãy triển khai validation cho Import Mapping Config.

Rule bắt buộc:
- `name` bắt buộc.
- `startDetailRow` bắt buộc, phải là số nguyên dương.
- `validRowColumn` bắt buộc, phải là tên cột Excel hợp lệ, ví dụ A, R, AA.
- `entries` không được rỗng khi lưu mapping có hiệu lực.
- Mỗi entry phải có `sourceType`, `source`, `targetColumns`, `targetColumnName`, `scope`.
- `targetColumns` phải là mảng không rỗng và từng cột phải hợp lệ.
- `sourceType` chỉ nhận `sheetCell`, `detailColumn`, `expression`, `generated`.
- `scope` chỉ nhận `sheet`, `detail`.
- Nếu `sourceType = expression`, expression đơn giản như `Q7 - 1` phải được validate.
- Nếu format là date và có offsetDays thì offsetDays phải là số nguyên.

Message lỗi phải bằng tiếng Nhật, ví dụ:
- Thiếu startDetailRow: `明細開始行を入力してください。`
- startDetailRow sai: `明細開始行は1以上の整数で入力してください。`
- Thiếu validRowColumn: `有効行判定列を入力してください。`
- validRowColumn sai: `有効行判定列はExcelの列名で入力してください。`
- Thiếu entries: `マッピング設定を入力してください。`

Yêu cầu kỹ thuật:
- Đặt validation ở service/helper riêng, không viết trực tiếp trong component.
- Function validation phải trả về danh sách lỗi có field, message, severity/blocking.
- Có function riêng kiểm tra lỗi blocking để chặn Save/Preview/Import/Apply.
- Viết test cho các case chính nếu project có test framework.
- Chạy test/typecheck.

Kết quả mong muốn:
- Validation có thể dùng lại ở màn hình Mapping, Preview, Import và Apply Mapping.
```

---

## Prompt 05: Tạo service Firestore hoặc data repository cho Mapping

```text
Hãy triển khai service/repository để CRUD cấu hình Mapping.

Bối cảnh:
- Collection đề xuất: `importMappingConfigs`.
- Nếu dự án đã có Firestore service pattern, hãy dùng đúng pattern đó.
- Nếu chưa có Firebase, tạo service tạm có thể dùng local/mock data nhưng phải thiết kế để sau này thay bằng Firestore dễ dàng.

Chức năng cần có:
- Lấy danh sách mapping chưa bị xóa.
- Lấy chi tiết mapping theo id.
- Tạo mapping mới.
- Cập nhật mapping.
- Xóa mapping. Ưu tiên soft delete bằng `deleted=true` trong giai đoạn đầu.
- Lưu audit metadata: createdAt, createdBy, updatedAt, updatedBy.

Yêu cầu:
- Không viết query Firestore trực tiếp trong component.
- Admin và Operator có quyền thao tác như nhau trong Mapping.
- Viewer nếu đã có role thì chỉ xem, nhưng không bắt buộc nếu app chưa có Viewer.
- Xử lý lỗi rõ ràng để UI hiển thị message tiếng Nhật.
- Chạy typecheck/test.

Kết quả mong muốn:
- Các màn hình sau có thể gọi service này để đọc/ghi Mapping.
- Báo rõ collection/field đang dùng.
```

---

## Prompt 06: Tạo seed/default Mapping theo Plan.md

```text
Hãy tạo default Mapping config dựa trên mapping trong `Docs/Plan.md` và `Docs/maplingusecase.md`.

Default config cần có:
- name: mapping tiêu chuẩn cho đơn hàng hiện tại.
- startDetailRow: 17.
- validRowColumn: R.

Entries bắt buộc:
- `K4` -> `A`, sourceType `sheetCell`, scope `sheet`.
- `D4` -> `E`, `I`, `J`, sourceType `sheetCell`, scope `sheet`.
- `K8` -> `K`, sourceType `sheetCell`, scope `sheet`.
- `Q5` -> `W`, date format `yyyymmdd`.
- `Q7 - 1` -> `X`, `AO`, expression date offset -1, format `yyyymmdd`.
- `Q7` -> `Y`, date format `yyyymmdd`.
- generated row number -> `AD`.
- detail column `C` -> `Z`.
- detail column `I` -> `AA`.
- detail column `E` -> `AB`.
- detail column `M` -> `AG`.
- detail column `R` -> `AI`.
- detail column `U` -> `AM`.
- detail column `V` -> `AN`.
- detail column `L` -> `AP`.
- detail column `S` -> `AQ`.

Yêu cầu:
- Không hard-code default này trong component UI.
- Đặt ở seed/config/helper phù hợp.
- Nếu có Firestore, tạo script hoặc nút dev-only để seed default mapping nếu chưa tồn tại.
- Nếu chưa dùng Firestore, tạo mock/default repository data để UI có dữ liệu ban đầu.
- Validate default mapping bằng validation đã tạo ở bước trước.

Kết quả mong muốn:
- App có một Mapping mặc định hợp lệ để dùng thử.
```

---

## Prompt 07: Triển khai màn hình danh sách Mapping

```text
Hãy triển khai màn hình danh sách Mapping.

Route:
- Màn hình `マッピング一覧` nằm trong route `設定`, ví dụ `/settings?tab=mapping` hoặc nested route phù hợp với pattern project.
- Sidebar mục `設定` phải dẫn tới route cấu hình này.

UI text bắt buộc bằng tiếng Nhật:
- Tiêu đề: `マッピング一覧`
- Nút tạo mới: `新規マッピング`
- Tìm kiếm: `マッピング名で検索`
- Loading: `マッピング一覧を読み込んでいます。`
- Empty state: `マッピングがまだ登録されていません。`
- Lỗi tải dữ liệu: `マッピング一覧を読み込めませんでした。`
- Nút retry: `再読み込み`

Bảng cần có các cột:
- `マッピング名`
- `説明`
- `明細開始行`
- `有効行判定列`
- `設定数`
- `ステータス`
- `最終更新日時`
- `最終更新者`
- `操作`

Action trên từng dòng:
- `詳細`
- `編集`
- `削除`
- `プレビュー`
- `エクスポート`
- `適用`
- `履歴` nếu audit history đã có hoặc sẽ có.

Rule:
- Admin và Operator thấy cùng toàn bộ action.
- Mapping thiếu `startDetailRow` hoặc `validRowColumn` phải hiển thị trạng thái `未設定` hoặc `エラー`.
- Mapping thiếu field bắt buộc không được `プレビュー` hoặc `適用`.
- Vẫn cho `編集` để sửa lỗi.

Yêu cầu kỹ thuật:
- Dùng service/repository đã tạo.
- Có loading, empty, error state.
- Có search cơ bản theo tên/mô tả.
- Entries hiển thị/sắp xếp theo thứ tự cột CSV nếu có preview target.
- Chạy lint/typecheck.
```

---

## Prompt 08: Triển khai form tạo Mapping mới

```text
Hãy triển khai màn hình hoặc modal tạo Mapping mới.

Luồng:
1. Người dùng mở `マッピング一覧`.
2. Bấm `新規マッピング`.
3. Hệ thống mở form `新規マッピング`.
4. Người dùng nhập thông tin.
5. Bấm `保存`.
6. Hệ thống validate và lưu nếu hợp lệ.

Field UI:
- `マッピング名` bắt buộc.
- `説明` tùy chọn.
- `明細開始行` bắt buộc, placeholder `例：17`.
- `有効行判定列` bắt buộc, placeholder `例：R`.
- `マッピング設定` bắt buộc, có thể dùng JSON editor/textarea trong giai đoạn đầu.
- `備考` tùy chọn nếu model có note.

Button:
- `保存`
- `キャンセル`

Validation message:
- Thiếu tên: `マッピング名を入力してください。`
- Thiếu start row: `明細開始行を入力してください。`
- start row sai: `明細開始行は1以上の整数で入力してください。`
- Thiếu valid column: `有効行判定列を入力してください。`
- valid column sai: `有効行判定列はExcelの列名で入力してください。`
- Entries sai: `マッピング設定の形式が正しくありません。`

Yêu cầu:
- Không cho lưu nếu validation fail.
- Message lỗi hiển thị ngay dưới field hoặc khu vực lỗi rõ ràng.
- Sau khi lưu thành công, quay lại danh sách và hiển thị `保存しました。`
- Admin và Operator đều tạo được.
- Chạy lint/typecheck/test.
```

---

## Prompt 09: Triển khai chỉnh sửa Mapping

```text
Hãy triển khai chức năng chỉnh sửa Mapping.

Luồng:
1. Người dùng bấm `編集` ở một Mapping.
2. Hệ thống mở form edit và load dữ liệu cũ.
3. Người dùng sửa name, description, startDetailRow, validRowColumn hoặc entries.
4. Người dùng bấm `保存`.
5. Hệ thống validate.
6. Nếu hợp lệ, cập nhật Mapping và audit metadata.

Yêu cầu UI:
- Tiêu đề: `マッピング編集`.
- Button: `保存`, `キャンセル`.
- Text lỗi và success đều bằng tiếng Nhật.
- Nếu không tải được mapping: `マッピングを読み込めませんでした。`
- Nếu lưu thành công: `保存しました。`
- Nếu lưu thất bại: `保存できませんでした。`

Rule:
- startDetailRow và validRowColumn vẫn bắt buộc khi sửa.
- Không cho save nếu hai field này thiếu hoặc sai.
- Admin và Operator có quyền sửa như nhau.
- Không xóa dữ liệu không liên quan.

Yêu cầu kỹ thuật:
- Tái sử dụng form/validation từ bước tạo mới nếu có.
- Cập nhật `updatedAt`, `updatedBy`.
- Chạy lint/typecheck/test.
```

---

## Prompt 10: Triển khai xóa mềm Mapping

```text
Hãy triển khai chức năng xóa Mapping bằng soft delete.

Luồng:
1. Người dùng bấm `削除` trên một Mapping.
2. Hệ thống hiển thị confirm modal bằng tiếng Nhật.
3. Nếu người dùng bấm hủy, không làm gì.
4. Nếu người dùng xác nhận, set `deleted=true` và cập nhật audit metadata.
5. Mapping biến mất khỏi danh sách chính.

Confirm modal:
- Title: `マッピングを削除しますか？`
- Body: `この操作は取り消せません。削除してもよろしいですか？`
- Confirm button: `削除`
- Cancel button: `キャンセル`

Message:
- Thành công: `削除しました。`
- Thất bại: `削除できませんでした。`

Rule:
- Admin và Operator đều xóa được.
- Không hard delete trong giai đoạn đầu trừ khi tài liệu/owner yêu cầu.
- Ghi audit nếu audit đã triển khai, hoặc chuẩn bị field để ghi audit.

Yêu cầu kỹ thuật:
- Không xóa document thật nếu đang dùng Firestore.
- Chạy lint/typecheck/test.
```

---

## Prompt 11: Tạm không triển khai import/export Mapping JSON

```text
Không triển khai import/export JSON cho Mapping ở giai đoạn này.

Lý do:
- Trong cấu trúc mới, sidebar chỉ có `設定`.
- Bên trong `設定`, tab chính là `マッピング一覧`; phần `Hiển thị` tạm để trống.
- Không tạo mục/tab/nút chính `インポート` hoặc `エクスポート` trong phần cấu hình Mapping.
- Người dùng hiện chỉ cần thêm mới, sửa, xóa và lưu Mapping trên màn hình.

Nếu sau này cần sao lưu/khôi phục Mapping bằng JSON:
- Tạo yêu cầu riêng.
- Không đặt thành tab chính trong `設定`.
- Không làm ảnh hưởng cấu trúc hiện tại: sidebar `設定` -> tab `マッピング一覧`.
```

---

## Prompt 12: Triển khai audit history cho Mapping

```text
Hãy triển khai audit history cho Mapping.

Các thao tác cần ghi:
- Tạo Mapping.
- Sửa Mapping.
- Xóa Mapping.
- Import Mapping.
- Apply Mapping nếu hệ thống có thao tác apply độc lập.

Thông tin cần lưu:
- mappingId
- action: create/update/delete/import/apply
- changedAt
- changedBy
- oldValue nếu có
- newValue nếu có
- summary ngắn

UI:
- Trên danh sách Mapping có nút `履歴`.
- Màn hình/modal history có tiêu đề `変更履歴`.
- Cột hiển thị:
  - `日時`
  - `ユーザー`
  - `操作`
  - `変更内容`
- Empty state: `変更履歴がありません。`
- Loading: `変更履歴を読み込んでいます。`
- Error: `変更履歴を読み込めませんでした。`

Rule:
- Admin và Operator xem history như nhau.
- Nếu app có Viewer thì Viewer có thể chỉ xem history nếu đang được hỗ trợ.

Yêu cầu kỹ thuật:
- Nếu Firestore đã có collection audit chung, dùng lại.
- Nếu chưa có, tạo collection phù hợp, ví dụ `importMappingConfigHistories`.
- Không làm UI quá phức tạp, chỉ cần người dùng truy vết được ai sửa gì lúc nào.
- Chạy lint/typecheck/test.
```

---

## Prompt 13: Triển khai preview Mapping với file Excel mẫu

```text
Hãy triển khai chức năng preview Mapping trước khi import/apply thật.

Mục tiêu:
- Người dùng chọn Mapping và upload file Excel mẫu.
- Hệ thống đọc thử dữ liệu theo Mapping.
- Hiển thị vài dòng kết quả để người dùng kiểm tra.

Yêu cầu:
- Trước khi preview phải validate Mapping.
- Nếu thiếu `明細開始行`, báo `明細開始行を入力してください。` và không preview.
- Nếu thiếu `有効行判定列`, báo `有効行判定列を入力してください。` và không preview.
- Nếu file Excel không đọc được, báo `Excelファイルを読み込めませんでした。`
- Nếu không tìm thấy source cell/column, hiển thị warning tiếng Nhật.
- Preview hiển thị:
  - Tên sheet.
  - Số dòng đọc thử.
  - Các target columns theo thứ tự A -> AO.
  - Giá trị preview của từng cột.
  - Warning nếu có.

Yêu cầu kỹ thuật:
- Dùng thư viện đọc Excel hiện có trong project, hoặc chọn thư viện phù hợp.
- Logic parse preview đặt ở service/helper riêng, không viết trong component.
- Chỉ preview, chưa tạo batch thật.
- Chạy lint/typecheck/test.
```

---

## Prompt 14: Triển khai parser apply Mapping từ Excel sang rows trung gian

```text
Hãy triển khai parser/service apply Mapping từ file Excel sang dữ liệu rows trung gian tương đương CSVExport.

Input:
- File Excel hoặc workbook đã đọc.
- Mapping config.

Rule xử lý:
- Validate Mapping trước khi parse.
- `startDetailRow` là dòng bắt đầu đọc detail.
- `validRowColumn` là cột dùng xác định dòng detail hợp lệ.
- Chỉ lấy dòng detail có giá trị ở `validRowColumn`.
- `sheetCell`: lấy giá trị từ ô cố định, ví dụ K4.
- `detailColumn`: lấy giá trị từ cột theo từng dòng detail.
- `expression`: hỗ trợ tối thiểu expression ngày như `Q7 - 1`.
- `generated`: hỗ trợ row number cho cột AD, bắt đầu từ 1 và tăng dần theo dòng detail hợp lệ.
- Một source có thể map sang nhiều target columns, ví dụ D4 -> E/I/J.
- Ngày export format `yyyymmdd`.

Yêu cầu:
- Output là danh sách row object có key là cột CSV, ví dụ A, E, I, J, ...
- Cột không có dữ liệu để trống, không crash.
- Có warnings/errors rõ ràng để UI hiển thị.
- Không hard-code Mapping trong parser, parser phải đọc từ config.
- Viết test cho các case chính nếu có test framework.
- Chạy lint/typecheck/test.
```

---

## Prompt 15: Tích hợp chọn Mapping khi tạo Import Batch

```text
Hãy tích hợp chọn Mapping vào luồng tạo Import Batch.

Luồng mong muốn:
1. Người dùng mở màn hình xử lý import Excel của luồng nghiệp vụ riêng, không phải tab trong `設定`.
2. Người dùng upload một hoặc nhiều file Excel.
3. Người dùng chọn Mapping template từ dropdown.
4. Nếu không chọn nhưng có default mapping, hệ thống dùng default.
5. Trước khi parse, hệ thống validate Mapping.
6. Nếu Mapping hợp lệ, tạo Import Batch và rows trung gian.
7. Nếu Mapping lỗi, dừng import và báo lỗi tiếng Nhật.

UI text:
- Label chọn mapping: `マッピング`
- Placeholder: `マッピングを選択してください`
- Lỗi thiếu mapping nếu không có default: `マッピングを選択してください。`
- Lỗi thiếu start row: `明細開始行を入力してください。`
- Lỗi thiếu valid column: `有効行判定列を入力してください。`
- Import thành công: `インポートしました。`
- Import thất bại: `インポートできませんでした。`

Batch cần lưu:
- mappingId
- mappingName
- mappingSnapshot nếu cần để batch không bị thay đổi khi mapping sau này bị sửa.
- file nguồn.
- số dòng đã đọc.
- số dòng hợp lệ.
- trạng thái batch.

Yêu cầu:
- Admin và Operator import như nhau nếu app có role.
- Không cho import tiếp nếu Mapping thiếu `startDetailRow` hoặc `validRowColumn`.
- Chạy lint/typecheck/test.
```

---

## Prompt 16: Triển khai field mã PIC/kho trên màn hình batch

```text
Hãy triển khai field nhập/sửa mã PIC/kho cho từng Import Batch.

Bối cảnh:
- Giá trị này tương ứng logic Excel cũ `T5`.
- Đây không phải fixed value toàn hệ thống.
- Phải lưu theo từng batch.

UI tiếng Nhật:
- Label: `倉庫コード`
- Placeholder: `倉庫コードを入力してください`
- Lưu thành công: `倉庫コードを保存しました。`
- Lỗi trống nếu cần cảnh báo: `倉庫コードを入力してください。`
- Lỗi không có trong master: `倉庫コードがマスタに存在しません。`

Yêu cầu:
- Người dùng có thể nhập/sửa mã PIC/kho trước khi export.
- Khi đổi mã PIC/kho, hệ thống có thể apply lại rule/validation cho batch hiện tại nếu service đã có.
- Nếu mã không tồn tại trong `PIC.WH.CodeList`, validation cảnh báo nhưng không khóa export tuyệt đối.
- Nếu export khi mã PIC/kho thiếu hoặc chưa hợp lệ, các cột liên quan được để trống theo rule export thiếu dữ liệu.

Yêu cầu kỹ thuật:
- Lưu field này vào batch, ví dụ `picWarehouseCode`.
- Không lưu như fixed config toàn hệ thống.
- Chạy lint/typecheck/test.
```

---

## Prompt 17: Tích hợp Apply Rule MHB/MAV sau Mapping

```text
Hãy tích hợp bước Apply Rule MHB/MAV cho batch sau khi đã parse Excel bằng Mapping.

Yêu cầu nghiệp vụ:
- Người dùng chọn rule khách hàng: `MHB` hoặc `MAV`.
- Hệ thống dùng rows trung gian đã tạo từ Mapping.
- Hệ thống điền fixed values từ cấu hình fixed values, không hard-code trong component.
- Hệ thống điền mã PIC/kho từ batch.
- Hệ thống lookup master data.
- Hệ thống tính toán các cột cần thiết.
- Hệ thống đánh số thứ tự.
- Rule MHB và MAV phải tách riêng để sau này thêm rule mới dễ hơn.

UI tiếng Nhật:
- Label chọn rule: `取引先ルール`
- Option: `MHB`, `MAV`
- Button: `ルール適用`
- Thành công: `ルールを適用しました。`
- Thất bại: `ルールを適用できませんでした。`

Yêu cầu kỹ thuật:
- Không viết rule trực tiếp trong component.
- Tạo service/module riêng cho rule.
- Chạy validation sau khi apply rule nếu validation service đã có.
- Chạy lint/typecheck/test.
```

---

## Prompt 18: Triển khai validation batch sau Apply Rule

```text
Hãy triển khai validation dữ liệu batch sau khi apply rule.

Cần kiểm tra:
- Không tìm thấy customer code trong `CusCodeList`.
- Không tìm thấy item code trong `ItemCodeList`.
- Không tìm thấy unit price trong `UnitPriceList`.
- Không tìm thấy PIC/warehouse code trong `PIC.WH.CodeList`.
- Không tìm thấy unit code trong `UnitCodeList`.
- Mã PIC/kho của batch đang trống hoặc không tồn tại.
- Thiếu giá trị bắt buộc trong các cột quan trọng.
- Ngày tháng không hợp lệ.
- Giá tiền rỗng hoặc bằng 0 nếu cột đó bắt buộc.
- Dữ liệu trùng lặp nếu rule hiện tại có tiêu chí trùng lặp.

Output validation cần có:
- batchId
- rowIndex
- csvColumn
- fieldName
- issueType
- message tiếng Nhật
- suggestedMasterDataType nếu cần bổ sung master data
- sourceValue
- blocking hay warning

Rule quan trọng:
- Validation không mặc định khóa export.
- Validation phải chỉ ra dòng nào lỗi, cột nào lỗi, lý do lỗi, nên bổ sung vào master nào.

Yêu cầu:
- Logic validation đặt trong service/helper riêng.
- UI có thể dùng output này để hiển thị danh sách lỗi.
- Viết test cho case chính nếu có test framework.
- Chạy lint/typecheck/test.
```

---

## Prompt 19: Triển khai màn hình danh sách lỗi và dữ liệu cần bổ sung

```text
Hãy triển khai màn hình hiển thị lỗi validation và dữ liệu cần bổ sung cho batch.

UI tiếng Nhật:
- Tiêu đề: `確認が必要なデータ`
- Cột bảng:
  - `行`
  - `CSV列`
  - `項目`
  - `値`
  - `内容`
  - `追加先マスタ`
  - `操作`
- Button bổ sung master: `マスタに追加`
- Button chạy lại rule/validation: `再チェック`
- Button export dù còn thiếu: `未入力のままエクスポート`

Yêu cầu:
- Hiển thị rõ dòng nào lỗi.
- Hiển thị cột CSV nào sẽ bị trống nếu không bổ sung.
- Hiển thị nên bổ sung vào master data nào.
- Cho người dùng mở nhanh màn hình master data tương ứng nếu route đã có.
- Nếu chưa có màn hình master data, tạo action placeholder rõ ràng hoặc modal nhập nhanh nếu feasible.
- Sau khi bổ sung master data hoặc sửa mã PIC/kho, cho chạy lại apply rule/validation trên batch hiện tại.

Rule:
- Không bắt buộc người dùng sửa hết lỗi mới được export.
- Nếu còn thiếu dữ liệu, export vẫn được nhưng phải có confirm trước.

Yêu cầu kỹ thuật:
- Dùng output từ validation service.
- Không hard-code message tiếng Việt/Anh trên UI.
- Chạy lint/typecheck/test.
```

---

## Prompt 20: Triển khai export CSV với dữ liệu đầy đủ hoặc còn thiếu

```text
Hãy triển khai chức năng export CSV cho batch.

Cho phép export khi:
- Batch đã đầy đủ dữ liệu và trạng thái `validated_complete`.
- Batch còn thiếu dữ liệu nhưng người dùng xác nhận export với field thiếu để trống.

Yêu cầu CSV:
- Export các cột tương đương `A:AO` theo đúng thứ tự.
- Format ngày `yyyymmdd`.
- CSV UTF-8 có BOM nếu hệ thống cần.
- Escape dấu phẩy, dấu nháy kép và ký tự xuống dòng đúng chuẩn CSV.
- Field không lookup được hoặc còn thiếu thì để trống khi người dùng chọn export thiếu dữ liệu.

Confirm khi còn thiếu dữ liệu:
- Title: `未入力のデータがあります。`
- Body cần hiển thị:
  - Tổng số dòng còn thiếu.
  - Tổng số ô/cột sẽ để trống.
  - Nhóm lỗi chính.
- Confirm button: `エクスポート`
- Cancel button: `キャンセル`

Lưu export history:
- batchId
- exportedBy
- exportedAt
- rowCount
- exportStatus: `complete` hoặc `with_missing_data`
- missingRowCount
- missingCellCount
- fileName

UI message:
- Thành công: `CSVをエクスポートしました。`
- Thất bại: `CSVをエクスポートできませんでした。`

Yêu cầu kỹ thuật:
- Logic tạo CSV đặt trong service/helper riêng.
- Không tạo CSV trong component.
- Chạy lint/typecheck/test.
```

---

## Prompt 21: Triển khai màn hình export history

```text
Hãy triển khai màn hình lịch sử export CSV.

Lưu ý cấu trúc navigation:
- Không đặt `エクスポート履歴` trong sidebar hoặc trong tab của `設定`.
- Nếu cần màn hình lịch sử export CSV, đặt ở khu vực xử lý nghiệp vụ export/batch riêng theo pattern project.

Màn hình cần hiển thị:
- Tiêu đề: `エクスポート履歴`
- Cột bảng:
  - `日時`
  - `ユーザー`
  - `バッチ名`
  - `ファイル名`
  - `行数`
  - `ステータス`
  - `未入力行数`
  - `未入力セル数`
- Trạng thái:
  - Complete: `完了`
  - With missing data: `未入力あり`

Yêu cầu:
- Lấy dữ liệu từ export history service/collection.
- Có loading: `エクスポート履歴を読み込んでいます。`
- Empty state: `エクスポート履歴がありません。`
- Error: `エクスポート履歴を読み込めませんでした。`
- Có filter theo ngày/trạng thái nếu dễ triển khai theo pattern hiện có.
- Chạy lint/typecheck/test.
```

---

## Prompt 22: Kiểm tra quyền Admin/Operator trong Mapping

```text
Hãy kiểm tra và chỉnh lại quyền trong toàn bộ chức năng Mapping.

Rule bắt buộc:
- Admin và Operator có full quyền như nhau trong Mapping.
- Nếu Admin thấy action nào thì Operator cũng phải thấy action đó.
- Nếu Admin làm được thao tác nào thì Operator cũng làm được thao tác đó.
- Không phân biệt quyền giữa Admin và Operator trong các thao tác:
  - Xem danh sách Mapping.
  - Xem chi tiết.
  - Tạo.
  - Sửa.
  - Xóa.
  - Lưu.
  - Preview.
  - Apply Mapping.
  - Xem audit history.

Yêu cầu:
- Kiểm tra cả UI và service/API nếu có.
- Viewer nếu tồn tại thì chỉ xem, không thao tác chỉnh sửa.
- Không làm ảnh hưởng quyền ở module khác ngoài Mapping.
- Viết test hoặc checklist kiểm tra role nếu project chưa có test auth.
- Chạy lint/typecheck/test.
```

---

## Prompt 23: Rà soát toàn bộ UI text tiếng Nhật

```text
Hãy rà soát toàn bộ UI text của các phần đã triển khai liên quan đến Mapping, Import Batch, Validation và Export.

Yêu cầu:
- Tất cả title, label, button, tooltip, alert, confirm modal, empty state, loading state, validation message, toast đều bằng tiếng Nhật.
- Không còn text tiếng Việt/Anh trên UI sản phẩm, trừ dữ liệu do người dùng nhập hoặc mã kỹ thuật như MHB/MAV.
- Các message bắt buộc phải đúng:
  - `明細開始行を入力してください。`
  - `有効行判定列を入力してください。`
  - `明細開始行は1以上の整数で入力してください。`
  - `有効行判定列はExcelの列名で入力してください。`

Nhiệm vụ:
- Tìm toàn bộ text UI còn tiếng Việt/Anh trong các file liên quan.
- Thay bằng tiếng Nhật phù hợp.
- Không đổi tên biến/type/service nếu không cần.
- Chạy lint/typecheck/test.
```

---

## Prompt 24: Viết test nghiệp vụ cho Mapping

```text
Hãy viết test cho chức năng Mapping theo khả năng test hiện có của project.

Test tối thiểu:
- Tạo Mapping hợp lệ.
- Tạo Mapping thiếu `startDetailRow`.
- Tạo Mapping thiếu `validRowColumn`.
- Tạo Mapping với `startDetailRow` không phải số nguyên dương.
- Tạo Mapping với `validRowColumn` sai định dạng.
- Entry thiếu `sourceType`.
- Entry thiếu `targetColumns`.
- Expression `Q7 - 1` hợp lệ.
- Expression sai định dạng bị báo lỗi.
- Sort target columns theo A -> AO.
- Mapping thiếu field bắt buộc bị chặn Save/Preview/Import/Apply.
- Admin và Operator có quyền giống nhau trong Mapping nếu test auth khả thi.

Yêu cầu:
- Ưu tiên test service/helper trước vì ổn định hơn UI test.
- Nếu project đã có Playwright/Cypress, thêm UI test cho màn hình danh sách/tạo Mapping nếu phù hợp.
- Chạy toàn bộ test liên quan.
- Báo rõ test nào đã thêm và kết quả.
```

---

## Prompt 25: Chạy kiểm tra cuối cùng và sửa lỗi phát sinh

```text
Hãy chạy kiểm tra cuối cùng cho toàn bộ phần đã triển khai.

Việc cần làm:
- Chạy typecheck.
- Chạy lint.
- Chạy test.
- Nếu có dev server, chạy thử app và kiểm tra các route chính:
  - Sidebar.
  - `マッピング一覧`.
  - Tạo Mapping.
  - Sửa Mapping.
  - Xóa Mapping.
  - Preview Mapping.
  - Import batch chọn Mapping.
  - Validation batch.
  - Export CSV.
  - Export history.

Yêu cầu:
- Nếu lỗi, sửa lỗi trong phạm vi chức năng vừa triển khai.
- Không refactor lan rộng ngoài phạm vi cần thiết.
- Không xóa hoặc revert thay đổi không liên quan của người dùng.
- Sau khi xong, tóm tắt:
  1. Đã hoàn thành những gì.
  2. File chính đã sửa/tạo.
  3. Lệnh kiểm tra đã chạy.
  4. Lỗi còn lại nếu có.
```

---

## Prompt 26: Prompt tổng hợp nếu muốn giao cho AI làm từ đầu đến cuối

```text
Hãy đọc kỹ `Docs/Plan.md`, `Docs/maplingusecase.md` và `Docs/maplingImpromt.md`, sau đó triển khai chức năng Mapping theo thứ tự prompt trong `Docs/maplingImpromt.md`.

Yêu cầu quan trọng:
- Không chỉ lập kế hoạch, phải hiện thực hóa bằng code.
- Làm từng bước, kiểm tra sau từng bước lớn.
- Tạo sidebar có mục `設定`.
- Bên trong `設定`, chỉ tạo tab chính `マッピング一覧`; phần `Hiển thị` tạm để trống.
- Không tạo các tab/mục `インポート`, `バッチ処理`, `固定値設定`, `マスタデータ`, `照明`, `エクスポート履歴` trong `設定`.
- Toàn bộ UI text cho người dùng phải bằng tiếng Nhật.
- Admin và Operator có full quyền như nhau trong Mapping.
- `startDetailRow` / `明細開始行` và `validRowColumn` / `有効行判定列` là bắt buộc.
- Nếu thiếu hoặc sai hai field này, không cho Save, Preview, Import hoặc Apply Mapping.
- Mapping phải hỗ trợ sheetCell, detailColumn, expression, generated.
- Mapping phải hỗ trợ một source map sang nhiều target columns.
- Mapping phải hỗ trợ expression ngày như `Q7 - 1`.
- Mapping entries phải sort theo thứ tự cột CSV A -> AO khi hiển thị.
- Import Excel phải dùng Mapping config, không hard-code vị trí ô/cột trong component.
- Export CSV vẫn được khi còn thiếu dữ liệu, nhưng phải confirm và để trống field thiếu.

Kết quả cuối cùng cần có:
- Sidebar/navigation.
- Màn hình danh sách Mapping.
- Tạo/sửa/xóa Mapping.
- Preview Mapping.
- Audit history.
- Parser apply Mapping từ Excel sang rows trung gian.
- Tích hợp chọn Mapping khi import batch.
- Field mã PIC/kho theo batch.
- Validation batch và màn hình dữ liệu cần bổ sung.
- Export CSV và export history.
- Test/typecheck/lint chạy được hoặc báo rõ lý do chưa chạy được.

Sau khi hoàn tất, hãy báo rõ file đã sửa/tạo, test đã chạy, và phần nào còn cần dữ liệu thật để kiểm chứng.
```
