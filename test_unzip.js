import AdmZip from 'adm-zip';
try {
  const zip = new AdmZip('test.zip');
  console.log("ZIP Entries:");
  zip.getEntries().forEach(e => console.log(e.entryName));
} catch(e) {
  console.error("ZIP Validation Error:", e);
}
