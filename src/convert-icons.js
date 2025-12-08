// Script para converter Gemini_Generated_Image.png para favicon.ico e apple-touch-icon.png
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import toIco from 'to-ico';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function convertIcons() {
  try {
    const geminiPath = join(__dirname, '..', 'Gemini_Generated_Image.png');
    const publicPath = join(__dirname, 'public');
    
    console.log('Lendo Gemini_Generated_Image.png...');
    
    // Converter para favicon.ico
    console.log('Criando favicon.ico...');
    const faviconSizes = [256, 128, 64, 48, 32, 16];
    const faviconBuffers = await Promise.all(
      faviconSizes.map(size => 
        sharp(geminiPath)
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer()
      )
    );
    
    const icoBuffer = await toIco(faviconBuffers, {
      sizes: faviconSizes
    });
    
    const icoPath = join(publicPath, 'favicon.ico');
    writeFileSync(icoPath, icoBuffer);
    console.log('✅ favicon.ico criado!');
    
    // Criar apple-touch-icon.png (180x180 para iOS)
    console.log('Criando apple-touch-icon.png...');
    const appleTouchIcon = await sharp(geminiPath)
      .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    const appleTouchPath = join(publicPath, 'apple-touch-icon.png');
    writeFileSync(appleTouchPath, appleTouchIcon);
    console.log('✅ apple-touch-icon.png criado!');
    
    // Criar ícones para PWA (vários tamanhos)
    console.log('Criando ícones para PWA...');
    const pwaSizes = [192, 512];
    for (const size of pwaSizes) {
      const icon = await sharp(geminiPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      
      const iconPath = join(publicPath, `icon-${size}x${size}.png`);
      writeFileSync(iconPath, icon);
      console.log(`✅ icon-${size}x${size}.png criado!`);
    }
    
    console.log('✅ Todos os ícones foram criados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao converter:', error.message);
    process.exit(1);
  }
}

convertIcons();

