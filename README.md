# Rēķins → e-rēķins

Frontend MVP rēķinu PDF/JPG/PNG/DOC/DOCX augšupielādei un datu pārveides plūsmas demonstrācijai.

## API integrācija

Pašreizējais `dist/index.html` izmanto demo apstrādi. Lai ieslēgtu īsto pārveidi, servera pusē jāizveido endpoint, piemēram, `POST /api/convert`, kas pieņem multipart failu un izsauc izvēlēto OCR/e-rēķinu API. API atslēga jāglabā servera slepenajos mainīgajos, nevis pārlūkprogrammas JavaScript kodā.

Endpoint atbildei ieteicams atgriezt validētu XML, PDF priekšskatījuma URL un validācijas kļūdu sarakstu. Pirms nosūtīšanas uz VID vai e-adresi XML jāvalidē pret aktuālo shēmu un biznesa noteikumiem.
