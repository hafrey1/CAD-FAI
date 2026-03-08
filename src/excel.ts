// Excel Export Module for CAD-FAI
// 注意：Cloudflare Workers Edge Runtime 不支持 exceljs
// 本模块在 Node.js 环境或后端服务中使用
// 生成真正的 .xlsx 文件（而不仅仅是 CSV）

import { Dim, iso2768mApprox, generateMeasurement } from './parse';

/**
 * 生成 CSV 内容（推荐在 Edge Runtime 中使用）
 * 这是一个简单且兼容的替代方案，在 Excel 中打开效果相同
 */
export function generateCSVContent(items: Dim[]): string {
  const headers = ['序号', '标注类型', '标称尺寸', '公差(+/-)', '实测值', '判定'];
  const lines = [headers.map(h => `"${h}"`).join(',')];
  
  items.forEach((it, idx) => {
    let plus = it.tolPlus;
    let minus = it.tolMinus;
    if (plus === 0 && minus === 0) {
      const iso = iso2768mApprox(it.nominal);
      plus = iso.plus;
      minus = iso.minus;
    }
    const meas = generateMeasurement(it);
    const tolText = `+${plus.toFixed(4)}/-${minus.toFixed(4)}`;
    const row = [
      String(idx + 1),
      it.type,
      String(it.nominal),
      tolText,
      String(meas.measured),
      meas.ok ? 'OK' : 'NG'
    ];
    lines.push(row.map(v => `"${v}"`).join(','));
  });
  
  return lines.join('\n');
}

/**
 * 【后端服务专用】生成真正的 Excel 工作簿
 * 注意：此函数需要在 Node.js 环境中运行，不能在 Cloudflare Workers 中直接使用
 * 推荐方案：在后端服务器上实现此功能，Worker 调用后端 API
 * 
 * 使用示例（后端 Node.js）：
 * ```
 * import ExcelJS from 'exceljs';
 * 
 * async function generateExcel(items: Dim[]): Promise<Buffer> {
 *   const workbook = new ExcelJS.Workbook();
 *   const worksheet = workbook.addWorksheet('FAI 报告');
 *   // ... 添加列和数据 ...
 *   return await workbook.xlsx.writeBuffer();
 * }
 * ```
 */
export function generateExcelWorkbookNote(): string {
  return `
Excel 导出功能说明：

由于 Cloudflare Workers Edge Runtime 的限制，无法直接生成 .xlsx 二进制文件。

推荐方案 1: 使用 CSV（当前实现）
- ✅ 兼容 Excel（原生支持）
- ✅ 无依赖，体积小
- ✅ 完全在 Worker 中运行
- 缺点：无法自定义样式

推荐方案 2: 后端服务生成 Excel
- 在 Node.js 后端服务用 exceljs 库生成
- Worker 将数据发送到后端
- 后端返回 .xlsx 文件

推荐方案 3: 客户端 JavaScript 库
- 使用浏览器端库（如 xlsx、sheetjs）
- Worker 返回 JSON 数据
- 前端生成并下载 Excel

当前使用方案：CSV + Excel 兼容（方案 1）
`;
}

/**
 * 生成 JSON 格式（用于前端库生成 Excel）
 */
export function generateJSONData(items: Dim[]): object {
  return {
    headers: ['序号', '标注类型', '标称尺寸', '公差(+/-)', '实测值', '判定'],
    rows: items.map((it, idx) => {
      let plus = it.tolPlus;
      let minus = it.tolMinus;
      if (plus === 0 && minus === 0) {
        const iso = iso2768mApprox(it.nominal);
        plus = iso.plus;
        minus = iso.minus;
      }
      const meas = generateMeasurement(it);
      return {
        序号: idx + 1,
        标注类型: it.type,
        标称尺寸: it.nominal,
        'public差(+/-)': `+${plus.toFixed(4)}/-${minus.toFixed(4)}`,
        实测值: meas.measured,
        判定: meas.ok ? 'OK' : 'NG'
      };
    })
  };
}

/**
 * 生成 HTML 表格（用于网页预览）
 */
export function generateHTMLTable(items: Dim[]): string {
  let html = '<table border="1" cellpadding="5" style="border-collapse:collapse;">\n';
  html += '<thead><tr style="background-color:#4472C4;color:white;">';
  html += '<th>序号</th><th>标注类型</th><th>标称尺寸</th><th>公差(+/-)</th><th>实测值</th><th>判定</th>';
  html += '</tr></thead>\n<tbody>\n';
  
  items.forEach((it, idx) => {
    let plus = it.tolPlus;
    let minus = it.tolMinus;
    if (plus === 0 && minus === 0) {
      const iso = iso2768mApprox(it.nominal);
      plus = iso.plus;
      minus = iso.minus;
    }
    const meas = generateMeasurement(it);
    const bgColor = meas.ok ? '#C6EFCE' : '#FFC7CE';
    const textColor = meas.ok ? '#006100' : '#9C0006';
    const result = meas.ok ? 'OK' : 'NG';
    
    html += `<tr><td>${idx + 1}</td><td>${it.type}</td><td>${it.nominal}</td>`;
    html += `<td>+${plus.toFixed(4)}/-${minus.toFixed(4)}</td><td>${meas.measured}</td>`;
    html += `<td style="background-color:${bgColor};color:${textColor};font-weight:bold;">${result}</td></tr>\n`;
  });
  
  html += '</tbody></table>';
  return html;
}
