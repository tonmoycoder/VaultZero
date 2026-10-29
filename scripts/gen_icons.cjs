const fs = require("fs");
const path = require("path");

const iconsDir = path.join("src-tauri", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAuSURBVHgB7cxBDQAwDMCw8y+9Zggrz0wBfSVN1uUe5z93wM8D/uMD/uMD/uMDfwP+5wJ9k+iW/QAAAABJRU5ErkJggg==";
const pngBuf = Buffer.from(validPngBase64, "base64");

fs.writeFileSync(path.join(iconsDir, "32x32.png"), pngBuf);
fs.writeFileSync(path.join(iconsDir, "128x128.png"), pngBuf);
fs.writeFileSync(path.join(iconsDir, "128x128@2x.png"), pngBuf);
fs.writeFileSync(path.join(iconsDir, "icon.png"), pngBuf);
fs.writeFileSync(path.join(iconsDir, "icon.icns"), pngBuf);

const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader.writeUInt8(32, 6);
icoHeader.writeUInt8(32, 7);
icoHeader.writeUInt8(0, 8);
icoHeader.writeUInt8(0, 9);
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(pngBuf.length, 14);
icoHeader.writeUInt32LE(22, 18);

const icoBuf = Buffer.concat([icoHeader, pngBuf]);
fs.writeFileSync(path.join(iconsDir, "icon.ico"), icoBuf);
console.log("Icons created successfully!");
