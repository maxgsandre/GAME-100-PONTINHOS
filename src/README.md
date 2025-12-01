# 🃏 100 Pontinhos - PWA Multiplayer

Webapp PWA multiplayer do jogo de cartas "100 Pontinhos" para 2-4 jogadores, construído com React + TypeScript + Firebase + Vite.

## 📋 Sobre o Jogo

**100 Pontinhos** é um jogo de cartas tradicional brasileiro onde:
- Cada jogador recebe 9 cartas inicialmente
- O objetivo é formar sequências (mesmo naipe) ou trincas (mesmo valor)
- O primeiro jogador a "bater" (baixar todas as cartas válidas) marca 0 pontos
- Os outros jogadores somam os valores de suas cartas restantes
- Ganha quem tiver menos pontos após várias rodadas

## 🚀 Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **Estilo**: Tailwind CSS v4.0
- **Estado**: Zustand
- **Backend**: Firebase (Firestore + Auth Anônima)
- **PWA**: vite-plugin-pwa + Workbox
- **Deploy**: Vercel
- **Roteamento**: React Router v6

## 📦 Estrutura do Projeto

```
pontinho-web/
├── public/                    # Assets estáticos do PWA
│   ├── pwa-192x192.png       # Ícone 192x192 do PWA
│   ├── pwa-512x512.png       # Ícone 512x512 do PWA
│   └── favicon.ico           # Favicon
├── src/
│   ├── components/           # Componentes React
│   │   ├── CardComponent.tsx # Carta individual
│   │   ├── Hand.tsx          # Mão do jogador
│   │   ├── Table.tsx         # Mesa de jogo
│   │   ├── Stock.tsx         # Pilha de compra
│   │   ├── Discard.tsx       # Pilha de descarte
│   │   ├── Melds.tsx         # Combinações baixadas
│   │   ├── Lobby.tsx         # Sala de espera
│   │   ├── Scoreboard.tsx    # Placar
│   │   └── RoundEnd.tsx      # Tela de fim de rodada
│   ├── lib/                  # Bibliotecas e utilitários
│   │   ├── firebase.ts       # Configuração do Firebase
│   │   ├── deck.ts           # Lógica do baralho
│   │   ├── rules.ts          # Regras do jogo
│   │   └── firestoreGame.ts  # Operações do Firestore
│   ├── app/
│   │   └── store.ts          # Estado global (Zustand)
│   ├── pages/                # Páginas
│   │   ├── Home.tsx          # Página inicial
│   │   ├── Room.tsx          # Sala de jogo
│   │   └── NotFound.tsx      # Página 404
│   ├── App.tsx               # Componente raiz (router)
│   └── main.tsx              # Entry point
├── styles/
│   └── globals.css           # Estilos globais + Tailwind v4
├── firebase.rules            # Regras de segurança do Firestore
├── vite.config.ts            # Configuração do Vite + PWA
├── vercel.json               # Configuração do Vercel
└── package.json              # Dependências

```

## 🛠️ Configuração Inicial

### 1️⃣ Pré-requisitos

- **Node.js** 18+ e npm/yarn
- **Conta Google** para Firebase
- **Conta Vercel** (gratuita)

### 2️⃣ Clone e Instalação

```bash
# Clone o repositório (ou copie os arquivos)
git clone <seu-repositorio>
cd pontinho-web

# Instale as dependências
npm install
```

## 🔥 Configuração do Firebase

### Passo 1: Criar Projeto Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em **"Adicionar projeto"**
3. Nome do projeto: `100-pontinhos` (ou outro nome)
4. Desabilite Google Analytics (opcional para este projeto)
5. Clique em **"Criar projeto"**

### Passo 2: Configurar Firebase Web App

1. No console do Firebase, clique no ícone **Web** (`</>`)
2. Apelido do app: `Pontinho Web`
3. **NÃO** marque "Configure Firebase Hosting"
4. Clique em **"Registrar app"**
5. **Copie as credenciais** que aparecem:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Passo 3: Adicionar Credenciais ao Projeto

Crie um arquivo `.env` na raiz do projeto:

```bash
# .env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

⚠️ **IMPORTANTE**: Adicione `.env` ao `.gitignore`:

```bash
# .gitignore
.env
.env.local
node_modules/
dist/
```

### Passo 4: Habilitar Authentication Anônima

1. No Firebase Console, vá em **Authentication**
2. Clique em **"Começar"**
3. Na aba **"Sign-in method"**, clique em **"Anônimo"**
4. **Ative** o provedor anônimo
5. Clique em **"Salvar"**

### Passo 5: Criar Firestore Database

1. No Firebase Console, vá em **Firestore Database**
2. Clique em **"Criar banco de dados"**
3. Selecione **"Iniciar no modo de produção"**
4. Escolha a localização: `southamerica-east1` (São Paulo) ou mais próxima
5. Clique em **"Ativar"**

### Passo 6: Aplicar Regras de Segurança

1. No Firestore, vá na aba **"Regras"**
2. **Substitua** todo o conteúdo pelas regras do arquivo `/firebase.rules` deste projeto
3. Clique em **"Publicar"**

**Resumo das regras**:
- ✅ Apenas usuários autenticados podem acessar dados
- ✅ Jogadores só veem suas próprias cartas (`/hands/{playerId}`)
- ✅ Membros da sala podem ver estado do jogo, descarte, melds
- ✅ Transações garantem integridade nas operações críticas

## 🎨 Criação dos Ícones PWA

O PWA precisa de ícones nas pastas `public/`:

### Opção 1: Usando Ferramenta Online

1. Acesse [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
2. Faça upload de uma imagem quadrada (mínimo 512x512px)
3. Baixe os ícones gerados
4. Coloque na pasta `public/`:
   - `pwa-192x192.png`
   - `pwa-512x512.png`
   - `favicon.ico`

### Opção 2: Manualmente com Design

Crie uma imagem 512x512px com:
- **Fundo**: Verde (#10b981)
- **Conteúdo**: Símbolo de cartas (♠♥♦♣) ou texto "100"
- **Formato**: PNG com transparência

Salve como:
- `pwa-512x512.png` (original)
- `pwa-192x192.png` (redimensionado)
- `favicon.ico` (32x32px)

## 🚀 Deploy na Vercel

### Método 1: Via CLI (Recomendado)

```bash
# Instale a CLI da Vercel globalmente
npm install -g vercel

# Login
vercel login

# Deploy (primeira vez)
vercel

# Siga as instruções:
# ? Set up and deploy? [Y/n] Y
# ? Which scope? Sua conta
# ? Link to existing project? [y/N] N
# ? What's your project's name? pontinho-web
# ? In which directory is your code located? ./
# ? Want to override the settings? [y/N] N

# Deploy de produção
vercel --prod
```

### Método 2: Via Interface Web

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **"Add New Project"**
3. Conecte seu repositório Git (GitHub/GitLab/Bitbucket)
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Adicione as variáveis de ambiente**:
   - Vá em **"Environment Variables"**
   - Adicione todas as variáveis do arquivo `.env`:
     ```
     VITE_FIREBASE_API_KEY=AIza...
     VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID=seu-projeto-id
     VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
     VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
     VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
     ```
6. Clique em **"Deploy"**

### Configurar Domínio Personalizado (Opcional)

1. No dashboard do projeto na Vercel, vá em **"Settings"** → **"Domains"**
2. Adicione seu domínio personalizado (ex: `pontinho.seudominio.com`)
3. Configure os registros DNS conforme instruções da Vercel

## 📱 Instalação do PWA

### Android (Chrome/Edge)

1. Acesse o app no navegador (ex: `https://pontinho-web.vercel.app`)
2. Toque no **menu** (⋮) → **"Adicionar à tela inicial"** ou **"Instalar app"**
3. Confirme a instalação
4. O ícone aparecerá na tela inicial

### iOS (Safari)

1. Acesse o app no Safari
2. Toque no botão **Compartilhar** (□↑)
3. Role e toque em **"Adicionar à Tela de Início"**
4. Digite o nome (100 Pontinhos) e confirme
5. O ícone aparecerá na tela inicial

### Desktop (Chrome/Edge)

1. Acesse o app no navegador
2. Clique no ícone **"Instalar"** na barra de endereço (ou no menu → "Instalar 100 Pontinhos")
3. Confirme a instalação
4. O app abrirá em janela standalone

## 🎮 Como Jogar

### Criar Sala

1. Acesse a página inicial
2. Clique em **"Criar Sala"**
3. Digite seu nome
4. Compartilhe o código da sala (4 dígitos) com outros jogadores

### Entrar em Sala

1. Acesse a página inicial
2. Clique em **"Entrar em Sala"**
3. Digite o código da sala
4. Digite seu nome
5. Aguarde o dono da sala iniciar o jogo

### Jogando

1. **Comprar**: Clique na pilha de compra ou na carta de descarte
2. **Descartar**: Após comprar, clique em uma carta da sua mão para descartar
3. **Baixar Combinações**: Arraste cartas para formar sequências ou trincas
4. **Bater**: Quando todas as suas cartas forem válidas, clique em "Bater"

### Regras

- **Sequência**: 3+ cartas do mesmo naipe em ordem (ex: 4♠ 5♠ 6♠)
- **Trinca**: 3+ cartas do mesmo valor (ex: 7♠ 7♥ 7♦)
- **Curinga**: Cartas especiais podem substituir qualquer carta
- **Bater**: Todas as cartas devem estar em combinações válidas
- **Pontuação**: Quem bate marca 0; outros somam cartas restantes

## 🧪 Desenvolvimento Local

```bash
# Rodar em desenvolvimento
npm run dev

# Abrir em http://localhost:5173

# Build de produção
npm run build

# Preview da build
npm run preview
```

## 📊 Arquitetura do Firestore

```
rooms/{roomId}
  ├── (document) - código, ownerId, status, configurações
  ├── players/{playerId} - nome, avatar, ordem, pontuação total
  ├── hands/{playerId} - cartas privadas de cada jogador
  ├── state/game - baralho, descarte, turno atual, rodada
  └── melds/{meldId} - combinações baixadas por cada jogador
```

### Transações Críticas

Operações que usam transações do Firestore para garantir integridade:

- **Comprar carta** do baralho (evita 2 jogadores comprarem a mesma)
- **Descartar carta** (atualiza mão + descarte atomicamente)
- **Baixar combinações** (valida + move cartas)
- **Bater** (valida + finaliza rodada)

## 🔒 Segurança

- **Auth Anônima**: Cada dispositivo recebe um UID único
- **Regras Firestore**: Impedem trapaça (ver cartas de outros, jogar fora do turno)
- **Validação**: Regras do jogo validadas tanto no client quanto nas regras do Firestore
- **Rate Limiting**: Firebase tem proteção nativa contra abuso

⚠️ **Nota sobre PII**: Este app não coleta dados pessoais identificáveis. Nomes são pseudônimos temporários.

## 🐛 Troubleshooting

### Erro: "Firebase não inicializado"

- Verifique se todas as variáveis no `.env` estão corretas
- Confirme que o arquivo está na raiz do projeto
- Reinicie o servidor de desenvolvimento (`npm run dev`)

### Erro: "Missing or insufficient permissions"

- Verifique se as regras do Firestore foram aplicadas corretamente
- Confirme que a autenticação anônima está habilitada
- Verifique se o usuário está autenticado antes de acessar dados

### PWA não instala no celular

- Certifique-se de estar usando HTTPS (Vercel provê automaticamente)
- Verifique se os ícones existem em `/public/pwa-*.png`
- Teste em modo anônimo/privado do navegador
- No iOS, só funciona no Safari

### Build falha na Vercel

- Verifique se todas as variáveis de ambiente foram adicionadas
- Confirme que não há erros de TypeScript (`npm run build` local)
- Verifique os logs de build no dashboard da Vercel

## 📈 Próximas Funcionalidades

- [ ] Sistema de convites via link
- [ ] Chat na sala
- [ ] Animações de cartas
- [ ] Sons e feedback tátil
- [ ] Modo offline (vs IA)
- [ ] Ranking global
- [ ] Salas privadas com senha
- [ ] Múltiplas variantes do jogo

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit suas mudanças: `git commit -m 'Adiciona nova funcionalidade'`
4. Push para a branch: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🙏 Créditos

- **Jogo**: Baseado no tradicional jogo de cartas brasileiro "100 Pontinhos"
- **Stack**: React + TypeScript + Firebase + Tailwind CSS
- **Desenvolvido com**: Figma Make (AI-powered web builder)

---

**Feito com ❤️ para jogadores de cartas**
