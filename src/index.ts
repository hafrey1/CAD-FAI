import { parseText, toCSV } from './parse';
import { parseDXF } from './dxf';
import { generateCSVContent, generateHTMLTable, generateJSONData } from './excel';

const indexHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>CAD → FAI 报告</title>
<style>
  body { 
    font-family: Arial, sans-serif; 
    margin: 20px; 
    background: #f5f5f5;
  }
  h1 { 
    color: #333; 
    text-align: center;
    border-bottom: 3px solid #2196F3;
    padding-bottom: 10px;
  }
  button { 
    padding: 12px 24px; 
    font-size: 16px; 
    margin-right: 10px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover {
    background: #0b7dda;
  }
  input[type="file"] { 
    margin: 10px 0; 
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .format-selector { 
    margin: 15px 0;
    padding: 10px;
    background: #fff;
    border-radius: 4px;
  }
  #status { 
    margin-top: 15px; 
    color: #333;
    padding: 10px;
    background: #fff;
    border-left: 4px solid #2196F3;
    border-radius: 4px;
  }
  .output-format { 
    margin-top: 20px;
    background: #fff;
    padding: 15px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
  .output-format pre {
    background: #f0f0f0;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
    max-height: 400px;
  }
  .info-box { 
    background: #e3f2fd; 
    padding: 15px; 
    margin: 20px 0; 
    border-left: 4px solid #2196F3;
    border-radius: 4px;
  }
  .input-section {
    background: #fff;
    padding: 20px;
    margin: 20px 0;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
  }
  small {
    display: block;
    margin-top: 8px;
  }
</style>
</head>
<body>
  <h1>CAD 标注 → FAI 报告生成器</h1>
  
  <div class="info-box">
    <strong>支持格式：</strong> DXF 文件（AutoCAD 图纸） | 多种输出格式
  </div>
  
  <div id="cad-input" class="input-section">
    <p>上传 CAD 文件 (DXF 格式)</p>
    <input type="file" id="cad-file" accept=".dxf" required /><br/>
    <small style="color: #666;">支持的格式：DXF 文件（*.dxf） - AutoCAD 或 LibreCAD 图纸</small>
  </div>
  
  <div class="format-selector">
    <label><input type="radio" name="output" value="csv" checked> CSV 下载</label>
    <label><input type="radio" name="output" value="json"> JSON 数据</label>
    <label><input type="radio" name="output" value="html"> HTML 预览</label>
  </div>
  
  <button id="go">生成报告</button>
  <button id="preview">预览结果</button>
  <div id="status"></div>
  
  <div id="result" class="output-format" style="display:none;"></div>
  
  <script>
    document.getElementById('go').addEventListener('click', async () => {
      const output = document.querySelector('input[name="output"]:checked').value;
      const status = document.getElementById('status');
      
      status.textContent = '生成中...';
      try {
        const file = document.getElementById('cad-file').files[0];
        if (!file) { 
          status.textContent = '❌ 请选择 CAD 文件'; 
          status.style.color = 'red';
          return; 
        }
        
        const data = await file.text();
        
        const resp = await fetch(location.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            dxf: data,
            output: output
          })
        });
        
        if (!resp.ok) { 
          status.textContent = '❌ 错误: ' + resp.statusText;
          status.style.color = 'red';
          return; 
        }
        
        if (output === 'csv') {
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'FAI_Report.csv';
          document.body.appendChild(a); a.click(); a.remove();
          status.textContent = '✓ CSV 已下载';
          status.style.color = 'green';
        } else if (output === 'json') {
          const json = await resp.json();
          document.getElementById('result').innerHTML = '<pre>' + JSON.stringify(json, null, 2) + '</pre>';
          document.getElementById('result').style.display = 'block';
          status.textContent = '✓ JSON 已生成';
          status.style.color = 'green';
        } else if (output === 'html') {
          const html = await resp.text();
          document.getElementById('result').innerHTML = html;
          document.getElementById('result').style.display = 'block';
          status.textContent = '✓ HTML 已生成';
          status.style.color = 'green';
        }
      } catch (e) {
        status.textContent = '❌ 错误: ' + (e.message || '未知错误');
        status.style.color = 'red';
      }
    });
    
    document.getElementById('preview').addEventListener('click', () => {
      document.getElementById('result').style.display = document.getElementById('result').style.display === 'none' ? 'block' : 'none';
    });
  </script>
</body>
</html>`;

export default {
  async fetch(request: Request) {
    if (request.method === 'POST') {
      try {
        const data = await request.json() as { dxf?: string; output?: string };
        
        if (!data.dxf) {
          return new Response('错误: 请上传 CAD 文件', { status: 400 });
        }
        
        const parsed = parseDXF(data.dxf);
        
        if (parsed.length === 0) {
          return new Response('警告: 在 CAD 文件中未找到标注信息', { status: 400 });
        }
        
        const output = data.output || 'csv';
        
        if (output === 'json') {
          return new Response(JSON.stringify(generateJSONData(parsed)), {
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        } else if (output === 'html') {
          const html = generateHTMLTable(parsed);
          return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        } else {
          // CSV (default)
          const csv = generateCSVContent(parsed);
          const bom = '\ufeff';
          const csvWithBom = bom + csv;
          return new Response(csvWithBom, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="FAI_Report.csv"'
            }
          });
        }
      } catch (e) {
        return new Response('错误: ' + String(e), { status: 400 });
      }
    }
    return new Response(indexHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};
