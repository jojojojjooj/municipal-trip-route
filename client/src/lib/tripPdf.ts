import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export async function downloadTripPdf(reportElement: HTMLElement, fileName: string) {
  const canvas = await html2canvas(reportElement, {
    backgroundColor: "#f7f2e9",
    logging: false,
    onclone: clonedDocument => {
      const clonedReport = clonedDocument.querySelector<HTMLElement>("[data-trip-pdf-report]");
      clonedDocument.documentElement.style.setProperty("background-color", "rgb(247, 242, 233)", "important");
      clonedDocument.documentElement.style.setProperty("background", "rgb(247, 242, 233)", "important");
      clonedDocument.body.style.setProperty("background-color", "rgb(247, 242, 233)", "important");
      clonedDocument.body.style.setProperty("background", "rgb(247, 242, 233)", "important");
      if (clonedReport) {
        clonedReport.style.setProperty("background-color", "rgb(247, 242, 233)", "important");
        clonedReport.style.setProperty("background", "rgb(247, 242, 233)", "important");
        clonedReport.querySelectorAll<HTMLElement>("*").forEach(element => {
          element.style.setProperty("background-color", "transparent", "important");
          element.style.setProperty("background", "transparent", "important");
          element.style.setProperty("color", "rgb(31, 45, 43)", "important");
          element.style.setProperty("border-color", "rgba(31, 45, 43, 0.22)", "important");
          element.style.setProperty("box-shadow", "none", "important");
        });
        clonedReport.querySelectorAll<HTMLElement>("[data-trip-pdf-card]").forEach(element => element.style.setProperty("background", "rgb(238, 231, 218)", "important"));
        clonedReport.querySelectorAll<HTMLElement>("[data-trip-pdf-route]").forEach(element => element.style.setProperty("background", "rgb(241, 234, 220)", "important"));
      }
      const style = clonedDocument.createElement("style");
      style.textContent = `
        html, body, [data-trip-pdf-report], [data-trip-pdf-report] * {
          color: rgb(31, 45, 43) !important;
          border-color: rgba(31, 45, 43, 0.22) !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        [data-trip-pdf-report] { background-color: rgb(247, 242, 233) !important; }
        [data-trip-pdf-report] [data-trip-pdf-card] { background-color: rgb(238, 231, 218) !important; }
        [data-trip-pdf-report] [data-trip-pdf-route] { background-color: rgb(241, 234, 220) !important; }
        [data-trip-pdf-report] .pdf-accent { color: rgb(196, 80, 61) !important; }
        [data-trip-pdf-report] svg * { color: initial !important; }
      `;
      clonedDocument.head.append(style);
    },
    scale: 2,
    useCORS: false,
  });

  const pdf = new jsPDF({ compress: true, format: "a4", orientation: "portrait", unit: "mm" });
  pdf.setProperties({ subject: "출장 경로 요약", title: fileName.replace(/\.pdf$/i, "") });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pagePixelHeight = Math.floor((canvas.width * pageHeight) / pageWidth);

  for (let sourceY = 0, pageIndex = 0; sourceY < canvas.height; sourceY += pagePixelHeight, pageIndex += 1) {
    const sourceHeight = Math.min(pagePixelHeight, canvas.height - sourceY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sourceHeight;
    const context = pageCanvas.getContext("2d");
    if (!context) throw new Error("PDF 캔버스를 만들 수 없습니다.");

    context.fillStyle = "#f7f2e9";
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

    if (pageIndex > 0) pdf.addPage();
    const renderedHeight = (sourceHeight / canvas.width) * pageWidth;
    pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, pageWidth, renderedHeight, undefined, "FAST");
  }

  pdf.save(fileName);
}
