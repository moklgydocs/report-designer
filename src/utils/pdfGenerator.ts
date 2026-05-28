import type {
  Report,
  TextElement,
  TableElement,
  BarcodeElement,
  QRCodeElement,
} from "../types";
import type { RenderedPage } from "./reportRenderer";
import { evaluateExpression } from "./elementFactory";

// ─── Main PDF Generation ────────────────────────────────────────

/**
 * High-Accuracy 600DPI Vector PDF Export Engine.
 * Programmatically translates report elements into high-resolution native PDF geometry,
 * providing crystal-clear printing outputs, selectable text, and minimized file sizes.
 *
 * @param report - The report definition (page settings, data sources, etc.)
 * @param pages  - Pre-rendered paginated bands produced by the report renderer
 * @returns A jsPDF instance ready for saving or further manipulation
 */
export async function generateVectorReportPDF(
  report: Report,
  pages: RenderedPage[],
): Promise<any> {
  const jsPDF = (await import("jspdf")).default;
  const QRCode = (await import("qrcode")).default;
  const JsBarcode = (await import("jsbarcode")).default;

  // Derive page layout dimensions from report settings
  const { width, height, marginTop, marginLeft, marginRight } =
    report.pageSettings;
  const contentWidth = width - marginLeft - marginRight; // Horizontal space available for content

  // Create the PDF document with the report's orientation and page size
  const pdf = new jsPDF({
    orientation:
      report.pageSettings.orientation === "landscape"
        ? "landscape"
        : "portrait",
    unit: "px",
    format: [width, height],
  });

  // Iterate through each page
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    if (pageIdx > 0) {
      pdf.addPage();
    }

    const page = pages[pageIdx];
    let currentY = marginTop; // Tracks the Y cursor as bands are laid out top-to-bottom

    for (const rb of page.bands) {
      // Draw Band background (if visible and colored)
      if (rb.backgroundColor && rb.backgroundColor !== "transparent") {
        pdf.setFillColor(rb.backgroundColor);
        pdf.rect(marginLeft, currentY, contentWidth, rb.height, "F");
      }

      // Filter elements by printOn condition and sort by z-order for correct layering
      const filteredElements = rb.elements.filter((el: any) => {
        if (!el.printOn || el.printOn.length === 0) return true;
        return el.printOn.includes(rb.bandType as any);
      });
      const sortedElements = [...filteredElements].sort(
        (a, b) => a.zOrder - b.zOrder, // Lower z-order drawn first (behind)
      );

      for (const el of sortedElements) {
        // Compute absolute position on the page by combining band offset with element offset
        const elX = marginLeft + el.x;
        const elY = currentY + el.y;

        // ── Rectangle Element ──
        if (el.type === "rectangle") {
          const rect = el as any;
          // Fill + border ("FD"), fill only ("F"), or border only ("D")
          if (rect.fillColor && rect.fillColor !== "transparent") {
            pdf.setFillColor(rect.fillColor);
            if (
              rect.borderColor &&
              rect.borderColor !== "transparent" &&
              rect.borderWidth > 0
            ) {
              pdf.setDrawColor(rect.borderColor);
              pdf.setLineWidth(rect.borderWidth);
              pdf.rect(elX, elY, el.width, el.height, "FD"); // Fill + Draw
            } else {
              pdf.rect(elX, elY, el.width, el.height, "F"); // Fill only
            }
          } else if (
            rect.borderColor &&
            rect.borderColor !== "transparent" &&
            rect.borderWidth > 0
          ) {
            pdf.setDrawColor(rect.borderColor);
            pdf.setLineWidth(rect.borderWidth);
            pdf.rect(elX, elY, el.width, el.height, "D"); // Draw (border) only
          }
        // ── Line Element ──
        } else if (el.type === "line") {
          const line = el as any;
          pdf.setDrawColor(line.color || "#000000");
          pdf.setLineWidth(line.lineWidth || 1);
          // Draw line based on direction — horizontal, vertical, or diagonal
          if (line.direction === "horizontal") {
            pdf.line(
              elX,
              elY + el.height / 2,
              elX + el.width,
              elY + el.height / 2,
            );
          } else if (line.direction === "vertical") {
            pdf.line(
              elX + el.width / 2,
              elY,
              elX + el.width / 2,
              elY + el.height,
            );
          } else {
            pdf.line(elX, elY, elX + el.width, elY + el.height);
          }
        // ── Text Element ──
        } else if (el.type === "text") {
          const txt = el as TextElement;
          // Evaluate the text content: tries expression → content → dataField in order
          const rawVal = evaluateExpression(
            txt.content || txt.expression || txt.dataField || "",
            rb.dataRow,
          );
          const displayVal = String(
            rawVal !== undefined && rawVal !== null ? rawVal : "",
          );

          if (txt.backgroundColor && txt.backgroundColor !== "transparent") {
            pdf.setFillColor(txt.backgroundColor);
            pdf.rect(elX, elY, el.width, el.height, "F");
          }

          // Draw Text
          pdf.setTextColor(txt.font?.color || "#333333");
          const size = txt.font?.size || 12;
          pdf.setFontSize(size);

          // Resolve font style from bold/italic flags
          let style = "normal";
          if (txt.font?.bold && txt.font?.italic) style = "bolditalic";
          else if (txt.font?.bold) style = "bold";
          else if (txt.font?.italic) style = "italic";

          pdf.setFont("helvetica", style);

          // Standard padding align computation
          const padL = txt.padding?.left || 4;
          const padR = txt.padding?.right || 4;

          let textX = elX + padL;

          // Compute horizontal text alignment position
          if (txt.horizontalAlign === "center") {
            textX = elX + el.width / 2;
            pdf.setFont("helvetica", style);
          } else if (txt.horizontalAlign === "right") {
            textX = elX + el.width - padR;
          }

          // Vertical alignment: approximate middle using a baseline offset of fontSize/3
          const textY = elY + el.height / 2 + size / 3;

          pdf.text(displayVal, textX, textY, {
            align:
              txt.horizontalAlign === "center"
                ? "center"
                : txt.horizontalAlign === "right"
                  ? "right"
                  : "left",
            maxWidth: el.width - padL - padR,
          });
        // ── Table Element ──
        } else if (el.type === "table") {
          const table = el as TableElement;
          const { tableData } = table;

          let tableY = elY;
          for (let ri = 0; ri < tableData.rows.length; ri++) {
            const row = tableData.rows[ri];
            let tableX = elX;

            for (let ci = 0; ci < tableData.columns.length; ci++) {
              const cell = tableData.cells[ri]?.[ci];
              if (!cell || cell.rowSpan <= 0 || cell.colSpan <= 0) {
                // Skip merged/sub cells — just advance the X cursor by the column width
                tableX += tableData.columns[ci]?.width || 120;
                continue;
              }

              // Compute combined cell dimensions accounting for colSpan and rowSpan
              let cellWidth = 0;
              for (let c = 0; c < cell.colSpan; c++) {
                cellWidth += tableData.columns[ci + c]?.width || 120;
              }
              let cellHeight = 0;
              for (let r = 0; r < cell.rowSpan; r++) {
                cellHeight += tableData.rows[ri + r]?.height || 28;
              }

              // Draw cell background
              const cellBgColor =
                cell.backgroundColor || (row.isHeader ? "#f0f4f8" : "#ffffff");
              if (cellBgColor && cellBgColor !== "transparent") {
                pdf.setFillColor(cellBgColor);
                pdf.rect(tableX, tableY, cellWidth, cellHeight, "F");
              }

              // Draw cell borders
              pdf.setDrawColor("#d0d5dd");
              pdf.setLineWidth(1);
              pdf.rect(tableX, tableY, cellWidth, cellHeight, "D");

              // Draw diagonal line across cell if requested (e.g. for split-header cells)
              if (cell.diagonalLine) {
                pdf.setDrawColor("#94a3b8");
                pdf.setLineWidth(1);
                pdf.line(
                  tableX,
                  tableY,
                  tableX + cellWidth,
                  tableY + cellHeight,
                );
              }

              // Draw table cell text
              const rawValue = evaluateExpression(
                cell.content || cell.expression || cell.dataField || "",
                rb.dataRow,
              );
              const displayVal = String(
                rawValue !== undefined && rawValue !== null ? rawValue : "",
              );

              if (displayVal) {
                const fConfig = cell.font || {
                  family: "helvetica",
                  size: 11,
                  bold: row.isHeader,
                  italic: false,
                  underline: false,
                  color: "#333333",
                };
                pdf.setTextColor(fConfig.color);

                const size = fConfig.size || 11;
                pdf.setFontSize(size);

                let style = "normal";
                if (fConfig.bold && fConfig.italic) style = "bolditalic";
                else if (fConfig.bold) style = "bold";
                else if (fConfig.italic) style = "italic";

                pdf.setFont("helvetica", style);

                const padL = cell.padding?.left || 4;
                const padR = cell.padding?.right || 4;

                let cellTextX = tableX + padL;
                const cellTextAlign = cell.horizontalAlign || "center";

                if (cellTextAlign === "center") {
                  cellTextX = tableX + cellWidth / 2;
                } else if (cellTextAlign === "right") {
                  cellTextX = tableX + cellWidth - padR;
                }

                const cellTextY = tableY + cellHeight / 2 + size / 3;

                pdf.text(displayVal, cellTextX, cellTextY, {
                  align: cellTextAlign,
                  maxWidth: cellWidth - padL - padR,
                });
              }

              tableX += cellWidth;
            }
            tableY += row.height;
          }
        // ── Barcode Element ──
        } else if (el.type === "barcode") {
          const barcode = el as BarcodeElement;
          const displayVal = String(
            evaluateExpression(
              barcode.value || barcode.dataField || "",
              rb.dataRow,
            ) || "12345678",
          );

          try {
            // Render barcode to an offscreen canvas, then embed as PNG image in the PDF
            const canvas = document.createElement("canvas");
            JsBarcode(canvas, displayVal, {
              format: barcode.format || "CODE128",
              displayValue: barcode.showText !== false,
              margin: 4,
              fontSize: 14,
              background: "#ffffff",
              lineColor: "#000000",
              width: 2,
              height: 50,
            });
            const dataUrl = canvas.toDataURL("image/png");
            pdf.addImage(dataUrl, "PNG", elX, elY, el.width, el.height);
          } catch (err) {
            console.error("Vector barcode error:", err);
            // Fallback: draw a red-outlined rectangle with an X to indicate rendering failure
            pdf.setDrawColor("#f87171");
            pdf.setLineWidth(1);
            pdf.rect(elX, elY, el.width, el.height, "D");
            pdf.line(elX, elY, elX + el.width, elY + el.height);
          }
        // ── QR Code Element ──
        } else if (el.type === "qrcode") {
          const qrcode = el as QRCodeElement;
          const displayVal = String(
            evaluateExpression(
              qrcode.value || qrcode.dataField || "",
              rb.dataRow,
            ) || "https://example.com",
          );

          try {
            // Render QR code to a 300px DataURL for crisp embedding in the PDF
            const dataUrl = await QRCode.toDataURL(displayVal, {
              margin: 1,
              width: 300,
              color: { dark: "#000000", light: "#ffffff" },
            });
            pdf.addImage(dataUrl, "PNG", elX, elY, el.width, el.height);
          } catch (err) {
            console.error("Vector QRCode error:", err);
            pdf.setDrawColor("#f87171");
            pdf.setLineWidth(1);
            pdf.rect(elX, elY, el.width, el.height, "D");
          }
        // ── Image Element ──
        } else if (el.type === "image") {
          const img = el as any;
          let src =
            img.src || evaluateExpression(img.dataField || "", rb.dataRow);
          if (src) {
            src = src.trim();
            // Auto-detect and prefix base64 data URIs based on the leading bytes of the encoded string
            if (
              !src.startsWith("data:") &&
              !src.startsWith("http://") &&
              !src.startsWith("https://") &&
              !src.startsWith("blob:")
            ) {
              if (src.startsWith("iVBORw")) {
                src = `data:image/png;base64,${src}`;
              } else if (src.startsWith("/9j/")) {
                src = `data:image/jpeg;base64,${src}`;
              } else if (src.startsWith("R0lGOD")) {
                src = `data:image/gif;base64,${src}`;
              } else if (src.startsWith("PHN2")) {
                src = `data:image/svg+xml;base64,${src}`;
              } else if (/^[A-Za-z0-9+/=]+$/.test(src) && src.length > 50) {
                // Heuristic: looks like base64 but no recognized header — assume PNG
                src = `data:image/png;base64,${src}`;
              }
            }
            try {
              pdf.addImage(src, "PNG", elX, elY, el.width, el.height);
            } catch (err) {
              console.warn("Vector image loader warning:", err);
            }
          }
        // ── Chart Element ──
        } else if (el.type === "chart") {
          // Find the rendered chart canvas in the preview DOM and capture it as an image
          const chartEl = document.querySelector(
            `.chart-element-content canvas`,
          ) as HTMLCanvasElement;
          if (chartEl) {
            try {
              const dataUrl = chartEl.toDataURL("image/png");
              pdf.addImage(dataUrl, "PNG", elX, elY, el.width, el.height);
            } catch (err) {
              console.error("Vector chart integration error:", err);
            }
          }
        // ── CrossTab Element ──
        } else if (el.type === "crosstab") {
          const xtab = el as any;
          const { rowField, columnField, valueField, valueFunction } = xtab;

          // Determine data source: prefer group data, then all data, then first report data source
          let dataToUse: any[] = [];
          if (rb.renderContext?.groupData && rb.renderContext.groupData.length > 0) {
            dataToUse = rb.renderContext.groupData;
          } else if (rb.renderContext?.allData && rb.renderContext.allData.length > 0) {
            dataToUse = rb.renderContext.allData;
          } else {
            dataToUse = report.dataSources[0]?.data || [];
          }

          if (dataToUse.length > 0 && rowField && columnField && valueField) {
            // Compute the cross-tabulation matrix from the raw data
            const { computeCrossTab } = await import("./reportRenderer");
            const result = computeCrossTab(
              dataToUse,
              rowField,
              columnField,
              valueField,
              valueFunction || "sum"
            );

            if (result) {
              const {
                rowHeaders,
                columnHeaders,
                values,
                rowTotals,
                columnTotals,
                grandTotal,
              } = result;

              const totalCols = columnHeaders.length + 2; // Data columns + row header + total column
              const colWidth = el.width / totalCols;
              const rowHeight = 24;

              // Chinese labels for aggregation functions
              const funcLabel: Record<string, string> = {
                sum: "合计",
                count: "计数",
                avg: "均值",
                min: "最小",
                max: "最大",
              };

              let tableY = elY;

              /** Helper to draw a single CrossTab cell with background, border, and text */
              const drawCell = (
                text: string,
                x: number,
                y: number,
                w: number,
                h: number,
                bgColor: string,
                textColor: string,
                isBold: boolean,
                align: "left" | "center" | "right" = "right"
              ) => {
                if (bgColor && bgColor !== "transparent") {
                  pdf.setFillColor(bgColor);
                  pdf.rect(x, y, w, h, "F");
                }
                pdf.setDrawColor("#d0d5dd");
                pdf.setLineWidth(1);
                pdf.rect(x, y, w, h, "D");

                pdf.setTextColor(textColor);
                pdf.setFontSize(10);
                pdf.setFont("helvetica", isBold ? "bold" : "normal");

                const textY = y + h / 2 + 3.5;
                let textX = x + w / 2;
                if (align === "left") {
                  textX = x + 4;
                } else if (align === "right") {
                  textX = x + w - 4;
                }

                pdf.text(text, textX, textY, { align, maxWidth: w - 8 });
              };

              // Draw header row: row field label → column headers → aggregation label
              let tableX = elX;
              drawCell(
                rowField,
                tableX,
                tableY,
                colWidth,
                rowHeight,
                "#dbeafe",
                "#1e40af",
                true,
                "center"
              );
              tableX += colWidth;

              for (const ch of columnHeaders) {
                drawCell(
                  ch,
                  tableX,
                  tableY,
                  colWidth,
                  rowHeight,
                  "#dbeafe",
                  "#1e40af",
                  true,
                  "center"
                );
                tableX += colWidth;
              }

              drawCell(
                funcLabel[valueFunction || "sum"] || "合计",
                tableX,
                tableY,
                colWidth,
                rowHeight,
                "#dbeafe",
                "#1e40af",
                true,
                "center"
              );

              tableY += rowHeight;

              // Draw data rows: row header → cell values → row totals
              for (let ri = 0; ri < rowHeaders.length; ri++) {
                tableX = elX;
                const rh = rowHeaders[ri];

                drawCell(
                  rh,
                  tableX,
                  tableY,
                  colWidth,
                  rowHeight,
                  "#f8fafc",
                  "#334155",
                  false,
                  "left"
                );
                tableX += colWidth;

                for (let ci = 0; ci < columnHeaders.length; ci++) {
                  const val = values[ri]?.[ci];
                  // Format numbers: use 2 decimal places for avg, 0 for others
                  const displayVal =
                    typeof val === "number"
                      ? val.toFixed(valueFunction === "avg" ? 2 : 0)
                      : String(val ?? "");

                  drawCell(
                    displayVal,
                    tableX,
                    tableY,
                    colWidth,
                    rowHeight,
                    "#ffffff",
                    "#333333",
                    false,
                    "right"
                  );
                  tableX += colWidth;
                }

                const rTotal = rowTotals[ri];
                const displayTotal =
                  typeof rTotal === "number"
                    ? rTotal.toFixed(valueFunction === "avg" ? 2 : 0)
                    : String(rTotal ?? "");

                drawCell(
                  displayTotal,
                  tableX,
                  tableY,
                  colWidth,
                  rowHeight,
                  "#f1f5f9",
                  "#1e40af",
                  true,
                  "right"
                );

                tableY += rowHeight;
              }

              // Draw totals footer row: aggregation label → column totals → grand total
              tableX = elX;
              drawCell(
                funcLabel[valueFunction || "sum"] || "合计",
                tableX,
                tableY,
                colWidth,
                rowHeight,
                "#eff6ff",
                "#1e40af",
                true,
                "left"
              );
              tableX += colWidth;

              for (let ci = 0; ci < columnTotals.length; ci++) {
                const cTotal = columnTotals[ci];
                const displayTotal =
                  typeof cTotal === "number"
                    ? cTotal.toFixed(valueFunction === "avg" ? 2 : 0)
                    : String(cTotal ?? "");

                drawCell(
                  displayTotal,
                  tableX,
                  tableY,
                  colWidth,
                  rowHeight,
                  "#eff6ff",
                  "#1e40af",
                  true,
                  "right"
                );
                tableX += colWidth;
              }

              const displayGrand =
                typeof grandTotal === "number"
                  ? grandTotal.toFixed(valueFunction === "avg" ? 2 : 0)
                  : String(grandTotal ?? "");

              drawCell(
                displayGrand,
                tableX,
                tableY,
                colWidth,
                rowHeight,
                "#dbeafe",
                "#1e3a8a",
                true,
                "right"
              );
            }
          }
        }
      }

      currentY += rb.height;
    }
  }

  return pdf;
}

// ─── Direct Print ────────────────────────────────────────────────

/**
 * Direct High-Precision Printing Service:
 * Directly outputs the 600DPI vectorized report to standard native PDF stream,
 * opens a hidden print frame, and launches printer immediately, bypassing browser scaling completely.
 *
 * @param report - The report definition
 * @param pages  - Pre-rendered paginated bands
 */
export async function printVectorReportDirectly(
  report: Report,
  pages: RenderedPage[],
): Promise<void> {
  // Generate the PDF and get a blob URL for the iframe
  const pdfInstance = await generateVectorReportPDF(report, pages);
  const blobUrl = pdfInstance.output("bloburl");

  // Create a hidden iframe to host the PDF and trigger the browser print dialog
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = blobUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(blobUrl); // Free the blob URL reference
    }, 60000); // Remove iframe after 60s to allow print dialog to complete
  };
}
