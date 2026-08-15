# 4×6 Shipping Label Converter

A browser-based PDF converter for turning shipping-label PDFs into true 4×6-inch PDFs for thermal printers.

## Features

- Runs entirely in the browser
- No Python installation or local server required
- Works on desktop and mobile browsers
- Drag-and-drop PDF upload
- Multiple-page PDFs supported
- Selectable rotation
- Outputs a 4×6-inch PDF
- Uploaded labels are not sent to a backend server

## GitHub Pages

In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/(root)**, then Save.

The site will then be available at:

https://shuncoding122.github.io/label-4x6-converter/

## Notes

The converter renders each source PDF page in the browser and places it onto a 4×6-inch PDF page. The default rotation is 90° counter-clockwise; change it in the UI if the source label has a different orientation.
