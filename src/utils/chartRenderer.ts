interface ChartDrawParams {
  ctx: CanvasRenderingContext2D;
  categories: string[];
  series: { name: string; data: number[] }[];
  padding: { top: number; right: number; bottom: number; left: number };
  plotW: number;
  plotH: number;
  maxVal: number;
  colors: string[];
}

export function drawBarChart(params: ChartDrawParams) {
  const { ctx, categories, series, padding, plotW, plotH, maxVal, colors } = params;
  const groupW = plotW / categories.length;
  const barW = (groupW - 10) / series.length;

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Bars
  categories.forEach((cat, ci) => {
    const groupX = padding.left + ci * groupW + 5;
    series.forEach((s, si) => {
      const val = s.data[ci] || 0;
      const barH = (val / maxVal) * plotH;
      const x = groupX + si * barW;
      const y = padding.top + plotH - barH;
      ctx.fillStyle = colors[si % colors.length];
      ctx.beginPath();
      ctx.roundRect(x, y, barW - 2, barH, [2, 2, 0, 0]);
      ctx.fill();
    });

    // Category label
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cat, groupX + (groupW - 10) / 2, padding.top + plotH + 14);
  });

  // Y axis labels
  ctx.fillStyle = '#999';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotH * i) / 4;
    const val = Math.round(maxVal * (1 - i / 4));
    ctx.fillText(String(val), padding.left - 4, y + 3);
  }
}

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

  const stepX = plotW / Math.max(categories.length - 1, 1);

  series.forEach((s, si) => {
    ctx.beginPath();
    ctx.strokeStyle = colors[si % colors.length];
    ctx.lineWidth = 2;
    s.data.forEach((val, di) => {
      const x = padding.left + di * stepX;
      const y = padding.top + plotH - (val / maxVal) * plotH;
      if (di === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
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

export function drawPieChart(
  ctx: CanvasRenderingContext2D,
  categories: string[],
  series: { name: string; data: number[] }[],
  w: number,
  h: number,
  colors: string[]
) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(cx, cy) - 30;
  const total = series[0]?.data.reduce((a, b) => a + b, 0) || 1;

  let startAngle = -Math.PI / 2;
  series[0]?.data.forEach((val, i) => {
    const sliceAngle = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    const midAngle = startAngle + sliceAngle / 2;
    const labelR = r * 0.65;
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

    startAngle += sliceAngle;
  });

  // Legend
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
    legendX += ctx.measureText(cat).width + 24;
  });
}

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
    // Fill area
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH);
    s.data.forEach((val, di) => {
      const x = padding.left + di * stepX;
      const y = padding.top + plotH - (val / maxVal) * plotH;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + (s.data.length - 1) * stepX, padding.top + plotH);
    ctx.closePath();
    ctx.fillStyle = colors[si % colors.length] + '30';
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
