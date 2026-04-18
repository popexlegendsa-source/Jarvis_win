import fs from 'fs';
fetch('http://localhost:3000/api/sync/bundle')
  .then(res => res.arrayBuffer())
  .then(buffer => {
    fs.writeFileSync('test.zip', Buffer.from(buffer));
    console.log("Saved test.zip, length:", buffer.byteLength);
  })
  .catch(console.error);
