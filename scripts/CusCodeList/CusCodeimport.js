const admin = require("firebase-admin");
const XLSX = require("xlsx");
const path = require("path");

// Lay service account tu thu muc goc project
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const collectionName = "CusCodeList";
const excelFilePath = path.join(__dirname, "CusCodeList.xlsx");

// Lam sach Document ID vi Firestore khong cho phep dau /
function makeSafeDocumentId(text) {
  return String(text || "")
    .trim()
    .replace(/\//g, "／")
    .replace(/\s+/g, " ")
    .substring(0, 1400);
}

// Neu CusName(Eng) bi trung, tu dong them __2, __3 de khong ghi de du lieu cu
async function getUniqueDocumentId(collectionName, baseId, usedIds) {
  let documentId = baseId;
  let count = 2;

  while (true) {
    if (!usedIds.has(documentId)) {
      const snapshot = await db.collection(collectionName).doc(documentId).get();

      if (!snapshot.exists) {
        usedIds.add(documentId);
        return documentId;
      }
    }

    documentId = `${baseId}__${count}`;
    count++;
  }
}

async function importData() {
  const workbook = XLSX.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
  });

  console.log(`Dang import file: CusCodeList.xlsx`);
  console.log(`Sheet: ${sheetName}`);
  console.log(`So dong doc duoc: ${rows.length}`);

  const usedIds = new Set();

  let successCount = 0;
  let skipCount = 0;

  for (const row of rows) {
    const CusCode = String(row["CusCode"] || "").trim();
    const CusNameEng = String(row["CusName(Eng)"] || "").trim();
    const CusNameJP = String(row["CusName(JP)"] || "").trim();
    const CusAddress = String(row["CusAddress"] || "").trim();

    // Bo qua dong khong co CusName(Eng)
    if (!CusNameEng) {
      skipCount++;
      continue;
    }

    const baseDocumentId = makeSafeDocumentId(CusNameEng);
    const documentId = await getUniqueDocumentId(
      collectionName,
      baseDocumentId,
      usedIds
    );

    const data = {
      CusCode,
      CusNameEng,
      CusNameJP,
      CusAddress,

      // Luu lai ten cot goc de de kiem tra
      "CusName(Eng)": CusNameEng,
      "CusName(JP)": CusNameJP,

      documentId,
      baseDocumentId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection(collectionName).doc(documentId).set(data);

    successCount++;
    console.log(`Imported: ${documentId}`);
  }

  console.log("------------------------------------");
  console.log("Hoan thanh import CusCodeList!");
  console.log(`Thanh cong: ${successCount}`);
  console.log(`Bo qua vi khong co CusName(Eng): ${skipCount}`);
}

importData().catch((error) => {
  console.error("Loi import:", error);
  process.exit(1);
});