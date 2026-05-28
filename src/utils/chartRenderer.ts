/**
 * Chart Renderer — Canvas 2D drawing primitives for report chart elements.
 *
 * Provides pure drawing functions that render bar, line, pie, and area charts
 * onto an HTML Canvas 2D context. Each function receives pre-computed layout
 * parameters (plot area dimensions, max value, colors) so it stays decoupled
 * from data resolution and scaling logic.
 *
 * Used by the report preview and PDF export pipeline to produce chart visuals.
 */

// ─── Shared Types ────────────────────────────────────────────────

/** Common parameters for axis-based chart renderers (bar, line, area). */
interface ChartDrawParams {
  /** Canvas 2D rendering context to draw on */
  ctx: CanvasRenderingContext2D;
  /** Category labels displayed along the X axis */
  categories: string[];
  /** Data series — each entry is a named array of numeric values per category */
  series: { name: string; data: number[] }[];
  /** Padding around the plot area (excludes axis labels) */
  padding: { top: number; right: number; bottom: number; left: number };
  /** Width of the drawable plot area (excludes padding) */
  plotW: number;
  /** Height of the drawable plot area (excludes padding) */
  plotH: number;
  /** Maximum data value — used to scale bar heights / Y positions */
  maxVal: number;
  /** Color palette — one color per series, cycled via modulo */
  colors: string[];
}

// ─── Bar Chart ───────────────────────────────────────────────────

/**
 * Draw a grouped bar chart.
 *
 * Categories determine group positions along the X axis; each series produces
 * one bar per category, side by side within its group. Bars have rounded top
 * corners and a 2px gap between adjacent bars.
 *
 * @param params - Standard chart drawing parameters
 */
export function drawBarChart(params: ChartDrawParams) {
  const { ctx, categories, series, padding, plotW, plotH, maxVal, colors } = params;
  const groupW = plotW / categories.length; // Width allocated per category group
  const barW = (groupW - 10) / series.length; // Width of a single bar (10px intra-group gap)

  // Grid lines — 4 horizontal guides evenly spaced across the plot height
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Draw bars — one group per category, one bar per series within each group
  categories.forEach((cat, ci) => {
    const groupX = padding.left + ci * groupW + 5; // 5px left margin inside group
    series.forEach((s, si) => {
      const val = s.data[ci] || 0;
      const barH = (val / maxVal) * plotH; // Scale bar height proportionally to maxVal
      const x = groupX + si * barW;
      const y = padding.top + plotH - barH; // Bars grow upward from the baseline
      ctx.fillStyle = colors[si % colors.length];
      ctx.beginPath();
      ctx.roundRect(x, y, barW - 2, barH, [2, 2, 0, 0]); // Rounded top corners only
      ctx.fill();
    });

    // Category label
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cat, groupX + (groupW - 10) / 2, padding.top + plotH + 14);
  });

  // Y axis labels — descending from maxVal (top) to 0 (bottom)
  ctx.fillStyle = '#999';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotH * i) / 4;
    const val = Math.round(maxVal * (1 - i / 4)); // Top label = maxVal, bottom = 0
    ctx.fillText(String(val), padding.left - 4, y + 3);
  }
}

// ─── Line Chart ──────────────────────────────────────────────────

/**
 * Draw a line chart with data-point dots.
 *
 * Each series is drawn as a connected polyline with filled circular markers
 * at each data point. The X axis is evenly spaced across categories.
 *
 * @param params - Standard chart drawing parameters
 */
export function drawLineChart(params: ChartDrawParams) {
  const { ctx, categories, series, padding, plotW, plotH, maxVal, colors } = params;

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  const stepX = plotW / Math.max(categories.length - 1, 1); // Horizontal step per category (clamped to avoid division by zero)

  // Draw each series as a line + dots
  series.forEach((s, si) => {
    // Line path
    ctx.beginPath();
    ctx.strokeStyle = colors[si % colors.length];
    ctx.lineWidth = 2;
    s.data.forEach((val, di) => {
      const x = padding.left + di * stepX;
      const y = padding.top + plotH - (val / maxVal) * plotH; // Invert Y — canvas origin is top-left
      if (di === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Data-point dots
    s.data.forEach((val, di) => {
      const x = padding.left + di * stepX;
      const y = padding.top + plotH - (val / maxVal) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = colors[si % colors.length];
      ctx.fill();
    });
  });

  // X labels
  categories.forEach((cat, i) => {
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cat, padding.left + i * stepX, padding.top + plotH + 14);
  });
}

// ─── Pie Chart ───────────────────────────────────────────────────

/**
 * Draw a pie chart with percentage labels and a legend.
 *
 * Uses the first series only. Each slice is proportional to its value relative
 * to the total. Percentage labels are drawn inside slices that exceed 5% of
 * the total. A horizontal legend is rendered at the bottom.
 *
 * @param ctx        - Canvas 2D rendering context
 * @param categories - Slice labels (also used in the legend)
 * @param series     - Data series (only the first series is used)
 * @param w          - Total canvas width
 * @param h          - Total canvas height
 * @param colors     - Color palette for slices
 */
export function drawPieChart(
  ctx: CanvasRenderingContext2D,
  categories: string[],
  series: { name: string; data: number[] }[],
  w: number,
  h: number,
  colors: string[]
) {
  const cx = w / 2; // Center X
  const cy = h / 2; // Center Y
  const r = Math.min(cx, cy) - 30; // Radius — leave 30px margin for labels/legend
  const total = series[0]?.data.reduce((a, b) => a + b, 0) || 1; // Sum of all values (clamped to 1 to avoid division by zero)

  let startAngle = -Math.PI / 2; // Start from the 12 o'clock position
  series[0]?.data.forEach((val, i) => {
    const sliceAngle = (val / total) * Math.PI * 2; // Angle proportional to value
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Percentage label — only render if slice is large enough (> 5%)
    const midAngle = startAngle + sliceAngle / 2;
    const labelR = r * 0.65; // Place label at 65% of radius from center
    const lx = cx + Math.cos(midAngle) * labelR;
    const ly = cy + Math.sin(midAngle) * labelR;
    const pct = Math.round((val / total) * 100);
    if (pct > 5) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pct}%`, lx, ly);
    }

    startAngle += sliceAngle; // Advance to the next slice
  });

  // Legend — horizontal row of color swatches + category labels at the bottom
  const legendY = h - 16;
  let legendX = 10;
  categories.forEach((cat, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(legendX, legendY - 6, 8, 8);
    ctx.fillStyle = '#666';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat, legendX + 12, legendY - 2);
    legendX += ctx.measureText(cat).width + 24; // 24px gap between legend items
  });
}

// ─── Area Chart ──────────────────────────────────────────────────

/**
 * Draw an area chart with a semi-transparent fill and an overlying line.
 *
 * Each series produces a filled polygon from the baseline up to the data line,
 * plus a 2px stroke on top. Areas are rendered with 30% opacity (hex "30")
 * appended to the series color for the fill.
 *
 * @param params - Standard chart drawing parameters
 */
export function drawAreaChart(params: ChartDrawParams) {
  const { ctx, categories, series, padding, plotW, plotH, maxVal, colors } = params;

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  const stepX = plotW / Math.max(categories.length - 1, 1);

  series.forEach((s, si) => {
    // Fill area — closed polygon from baseline → data points → back to baseline
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH); // Start at bottom-left of plot
    s.data.forEach((val, di) => {
      const x = padding.left + di * stepX;
      const y = padding.top + plotH - (val / maxVal) * plotH;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + (s.data.length - 1) * stepX, padding.top + plotH); // Close back to baseline
    ctx.closePath();
    ctx.fillStyle = colors[si % colors.length] + '30'; // Append alpha channel for semi-transparency
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = colors[si % colors.length];
    ctx.lineWidth = 2;
    s.data.forEach((val, di) => {
      const x = padding.left + di * stepX;
      const y = padding.top + plotH - (val / maxVal) * plotH;
      if (di === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  // X labels
  categories.forEach((cat, i) => {
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cat, padding.left + i * stepX, padding.top + plotH + 14);
  });
}
