// Сбор ключей перевода из исходников: tr('…'), tn(n, '…'), tp(n, '…'), m('…').
// Разбираем код компилятором TypeScript, чтобы не зависеть от скобок и кавычек в тексте.
// Используется только тестом полноты словарей (в браузер не попадает).
import * as ts from 'typescript';

/** Строки, которые попадают в tr() не литералом (например, значения из данных). */
export const DYNAMIC_KEYS = ['Все права у автора'];

export function extractKeys(source: string, fileName = 'file.tsx'): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const walk = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const name = n.expression.text;
      const arg = name === 'tr' || name === 'm' ? n.arguments[0] : name === 'tn' || name === 'tp' ? n.arguments[1] : undefined;
      if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) out.push(arg.text);
    }
    n.forEachChild(walk);
  };
  walk(sf);
  return out;
}
