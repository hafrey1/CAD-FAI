// 简单的文本解析器：从标注文本中识别尺寸、直径(Ø/φ)、半径(R)、以及公差形式（±、+x/-y）
export type Dim = {
  label: string;
  type: '线性' | '直径' | '半径';
  nominal: number;
  tolPlus: number; // 正容差
  tolMinus: number; // 负容差 (positive number)
};

function toNumber(s: string): number {
  return Number(s.replace(/[，,\s]+/g, ''));
}

export function parseText(input: string): Dim[] {
  const out: Dim[] = [];
  if (!input) return out;
  // 先处理直径 Ø 或 φ
  const diamRegex = /(?:Ø|φ)\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(?:±|\+|\-|\/|\u00B1)\s*([0-9.]+)(?:\/?-?([0-9.]+))?)?/g;
  let m;
  while ((m = diamRegex.exec(input)) !== null) {
    const nominal = toNumber(m[1]);
    let tolPlus = 0, tolMinus = 0;
    if (m[2]) {
      tolPlus = Number(m[2]);
      tolMinus = m[3] ? Number(m[3]) : Number(m[2]);
    }
    out.push({ label: `Ø${nominal}`, type: '直径', nominal, tolPlus, tolMinus });
  }

  // 半径 R
  const rRegex = /R\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(?:±)\s*([0-9.]+))?/g;
  while ((m = rRegex.exec(input)) !== null) {
    const nominal = toNumber(m[1]);
    const tol = m[2] ? Number(m[2]) : 0;
    out.push({ label: `R${nominal}`, type: '半径', nominal, tolPlus: tol, tolMinus: tol });
  }

  // 对称 ± 公差和非对称 +x/-y
  const plusMinusRegex = /([0-9]+(?:\.[0-9]+)?)\s*(?:±|\u00B1)\s*([0-9]+(?:\.[0-9]+)?)/g;
  while ((m = plusMinusRegex.exec(input)) !== null) {
    const nominal = toNumber(m[1]);
    const tol = Number(m[2]);
    out.push({ label: `${nominal}`, type: '线性', nominal, tolPlus: tol, tolMinus: tol });
  }

  const asymRegex = /([0-9]+(?:\.[0-9]+)?)\s*\+\s*([0-9]+(?:\.[0-9]+)?)\s*\/?\s*-\s*([0-9]+(?:\.[0-9]+)?)/g;
  while ((m = asymRegex.exec(input)) !== null) {
    const nominal = toNumber(m[1]);
    const plus = Number(m[2]);
    const minus = Number(m[3]);
    out.push({ label: `${nominal}`, type: '线性', nominal, tolPlus: plus, tolMinus: minus });
  }

  // 最后，尝试捕获孤立的数字（可能没有公差）
  const numRegex = /([^A-Za-z0-9]|^)([0-9]+(?:\.[0-9]+)?)(?:\s*(mm|MM|mm\.|))?(?![\d\.\w])/g;
  while ((m = numRegex.exec(input)) !== null) {
    const nominal = toNumber(m[2]);
    // 如果已存在相同 nominal 则跳过
    if (out.some(d => Math.abs(d.nominal - nominal) < 1e-9)) continue;
    // 无公差时后续会应用 ISO 2768-m 近似
    out.push({ label: `${nominal}`, type: '线性', nominal, tolPlus: 0, tolMinus: 0 });
  }

  return out;
}

// 简化的 ISO 2768-m 近似策略：对于没有显式公差的标注，返回一个近似的对称公差（单位同标注）
export function iso2768mApprox(nominal: number): { plus: number; minus: number } {
  let t = 0.2;
  if (nominal <= 6) t = 0.1;
  else if (nominal <= 30) t = 0.2;
  else if (nominal <= 120) t = 0.3;
  else t = 0.5;
  return { plus: t, minus: t };
}

// 生成一次“看起来合格真实”的随机实测值，并判定 OK/NG
export function generateMeasurement(d: Dim): { measured: number; ok: boolean } {
  const nominal = d.nominal;
  let plus = d.tolPlus;
  let minus = d.tolMinus;
  if (plus === 0 && minus === 0) {
    const iso = iso2768mApprox(nominal);
    plus = iso.plus;
    minus = iso.minus;
  }
  const chance = Math.random();
  let measured = nominal;
  if (chance < 0.9) {
    const low = nominal - minus;
    const high = nominal + plus;
    measured = low + Math.random() * (high - low);
  } else {
    const direction = Math.random() < 0.5 ? -1 : 1;
    const over = (Math.random() * 2 + 0.01) * (direction > 0 ? plus || 1 : minus || 1);
    measured = nominal + direction * ((direction>0?plus:minus) + over);
  }
  const ok = measured >= (nominal - minus - 1e-9) && measured <= (nominal + plus + 1e-9);
  return { measured: Number(measured.toFixed(4)), ok };
}

export function toCSV(items: Dim[]): string {
  const headers = ['序号', '标注类型', '标称尺寸', '公差(+/-)', '实测值', '判定'];
  const lines = [headers.map(h => `"${h}"`).join(',')];
  items.forEach((it, idx) => {
    let plus = it.tolPlus;
    let minus = it.tolMinus;
    if (plus === 0 && minus === 0) {
      const iso = iso2768mApprox(it.nominal);
      plus = iso.plus; minus = iso.minus;
    }
    const meas = generateMeasurement(it);
    const tolText = `+${plus.toFixed(4)}/-${minus.toFixed(4)}`;
    const typeMap = { '线性': '线性', '直径': '直径', '半径': '半径' };
    const row = [
      String(idx + 1),
      typeMap[it.type] || it.type,
      String(it.nominal),
      tolText,
      String(meas.measured),
      meas.ok ? 'OK' : 'NG'
    ];
    lines.push(row.map(v => `"${v}"`).join(','));
  });
  return lines.join('\n');
}
