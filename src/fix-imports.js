// Script para remover versões dos imports nos arquivos UI
import { readFileSync, writeFileSync } from 'fs';
import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function fixImportsInFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Remover versões de @radix-ui imports
    const radixPattern = /(@radix-ui\/[^"']+)@[\d.]+/g;
    if (radixPattern.test(content)) {
      content = content.replace(radixPattern, '$1');
      modified = true;
    }
    
    // Remover versões de class-variance-authority
    const cvaPattern = /(class-variance-authority)@[\d.]+/g;
    if (cvaPattern.test(content)) {
      content = content.replace(cvaPattern, '$1');
      modified = true;
    }
    
    // Remover versões de lucide-react
    const lucidePattern = /(lucide-react)@[\d.]+/g;
    if (lucidePattern.test(content)) {
      content = content.replace(lucidePattern, '$1');
      modified = true;
    }
    
    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Corrigido: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
    return false;
  }
}

function processDirectory(dirPath) {
  const files = readdirSync(dirPath);
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = join(dirPath, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      fixedCount += processDirectory(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (fixImportsInFile(filePath)) {
        fixedCount++;
      }
    }
  }
  
  return fixedCount;
}

const uiDir = join(__dirname, 'components', 'ui');
console.log('Corrigindo imports nos arquivos UI...');
const fixed = processDirectory(uiDir);
console.log(`\n✅ Total de arquivos corrigidos: ${fixed}`);

