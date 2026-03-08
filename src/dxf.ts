// DXF Parser Module for CAD-FAI
// 从 DXF 文件中提取尺寸标注

import { Dim } from './parse';

/**
 * 解析 DXF 文件内容并提取标注
 * DXF 格式：标注存储在 DIMENSION 实体中
 * 这是一个简化实现，真实场景可能需要更复杂的解析
 */
export function parseDXF(dxfContent: string): Dim[] {
  const dims: Dim[] = [];
  
  // DXF 格式简化解析：查找标注实体
  // DIMENSION 实体包含以下关键信息：
  // - 210/220: 尺寸类型标记
  // - 1: 尺寸值（文本）
  // - 42: 实际尺寸值
  
  const lines = dxfContent.split('\n');
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // 查找 DIMENSION 实体
    if (line === 'DIMENSION') {
      const dimEntity = parseDimensionEntity(lines, i);
      if (dimEntity) {
        dims.push(dimEntity);
        i += dimEntity._linesRead || 1;
      } else {
        i++;
      }
    }
    // 查找 MTEXT（多行文本，可能包含标注）
    else if (line === 'MTEXT' || line === 'TEXT') {
      const textEntity = parseTextEntity(lines, i);
      if (textEntity && shouldIncludeText(textEntity.content)) {
        const parsed = extractDimensionFromText(textEntity.content);
        if (parsed) {
          dims.push(parsed);
        }
        i += textEntity._linesRead || 1;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  
  return dims;
}

/**
 * 解析 DXF DIMENSION 实体
 */
function parseDimensionEntity(
  lines: string[],
  startIdx: number
): (Dim & { _linesRead?: number }) | null {
  let i = startIdx;
  const entity: any = { _linesRead: 0 };
  
  while (i < lines.length && lines[i].trim() !== 'ENDSEC') {
    const line = lines[i].trim();
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
    
    // DXF 格式：奇数行为组码，偶数行为值
    if (line === '1') {
      // 文本字符串
      entity.text = nextLine;
      entity._linesRead = i - startIdx + 2;
    } else if (line === '42') {
      // 尺寸值
      entity.value = parseFloat(nextLine);
    } else if (line === '210' || line === '220') {
      // 尺寸方向（用于判断直径/半径）
      if (nextLine.includes('Ø') || nextLine.includes('φ')) {
        entity.type = '直径';
      }
    }
    
    i++;
    if (entity._linesRead && entity._linesRead > 20) break; // 防止无限循环
  }
  
  if (entity.value !== undefined) {
    return {
      label: `DXF-${entity.value}`,
      type: entity.type || '线性',
      nominal: entity.value,
      tolPlus: 0,
      tolMinus: 0,
      _linesRead: entity._linesRead || 10
    };
  }
  
  return null;
}

/**
 * 解析 DXF TEXT/MTEXT 实体
 */
function parseTextEntity(
  lines: string[],
  startIdx: number
): ({ content: string; _linesRead?: number }) | null {
  let i = startIdx;
  let content = '';
  let linesRead = 0;
  
  while (i < lines.length && lines[i].trim() !== 'ENDSEC') {
    const line = lines[i].trim();
    
    if (line === '1' && i + 1 < lines.length) {
      // 文本内容
      content = lines[i + 1].trim();
      linesRead = i - startIdx + 2;
      break;
    }
    
    i++;
    if (i - startIdx > 20) break; // 防止无限循环
  }
  
  if (content) {
    return { content, _linesRead: linesRead };
  }
  
  return null;
}

/**
 * 判断文本是否应该被解析为标注
 */
function shouldIncludeText(text: string): boolean {
  // 包含数字和尺寸符号的文本
  return /[\d.Ø±φ\+\-\/Rr]/.test(text) && text.length < 50;
}

/**
 * 从文本中提取尺寸信息
 */
function extractDimensionFromText(text: string): Dim | null {
  // 移除特殊字符并提取数字
  let nominal = 0;
  let type: '线性' | '直径' | '半径' = '线性';
  
  if (text.includes('Ø') || text.includes('φ')) {
    type = '直径';
    const match = text.match(/[\d.]+/);
    if (match) nominal = parseFloat(match[0]);
  } else if (text.match(/^R\s*[\d.]+/i)) {
    type = '半径';
    const match = text.match(/[\d.]+/);
    if (match) nominal = parseFloat(match[0]);
  } else {
    const match = text.match(/[\d.]+/);
    if (match) nominal = parseFloat(match[0]);
  }
  
  if (nominal > 0) {
    return {
      label: text,
      type,
      nominal,
      tolPlus: 0,
      tolMinus: 0
    };
  }
  
  return null;
}

/**
 * 将 DXF Base64 字符串解码为文本
 */
export function decodeDXFBase64(base64: string): string {
  try {
    return atob(base64);
  } catch {
    return '';
  }
}
