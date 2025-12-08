// Script para converter favicon.png para favicon.ico
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import toIco from 'to-ico';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function convertFavicon() {
  try {
    const pngPath = join(__dirname, '..', 'favicon.png');
    const icoPath = join(__dirname, 'public', 'favicon.ico');
    
    console.log('Lendo e redimensionando favicon.png...');
    // Redimensionar para 256x256 (tamanho padrão para ICO)
    const resizedBuffer = await sharp(pngPath)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    console.log('Convertendo para ICO...');
    const icoBuffer = await toIco([resizedBuffer], {
      sizes: [256, 128, 64, 48, 32, 16]
    });
    
    console.log('Salvando favicon.ico...');
    writeFileSync(icoPath, icoBuffer);
    
    console.log('✅ Conversão concluída! favicon.ico criado em src/public/');
  } catch (error) {
    console.error('❌ Erro ao converter:', error.message);
    process.exit(1);
  }
}

convertFavicon();
