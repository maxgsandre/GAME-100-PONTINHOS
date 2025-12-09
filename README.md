# 🃏 100 Pontinhos

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?logo=typescript)
![React](https://img.shields.io/badge/React-18.2-blue?logo=react)
![Firebase](https://img.shields.io/badge/Firebase-10.7-orange?logo=firebase)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)

**Jogo de cartas multiplayer em tempo real para 2-4 jogadores**

[🎮 Jogar Agora](#-como-jogar) • [📖 Documentação](#-sobre-o-jogo) • [🚀 Deploy](#-deploy)

</div>

---

## 📋 Índice

- [Sobre o Jogo](#-sobre-o-jogo)
- [Características](#-características)
- [Tecnologias](#-tecnologias)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Como Jogar](#-como-jogar)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Deploy](#-deploy)
- [PWA - Instalação no Celular](#-pwa---instalação-no-celular)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

---

## 🎯 Sobre o Jogo

**100 Pontinhos** é um jogo de cartas tradicional brasileiro onde o objetivo é formar combinações válidas (sequências ou trincas) e ser o primeiro a "bater" (descartar todas as cartas).

### Regras Básicas

- **Jogadores**: 2 a 4 jogadores
- **Cartas Iniciais**: 9 cartas por jogador
- **Baralho**: 2 baralhos completos (104 cartas)
- **Objetivo**: Formar combinações válidas e bater primeiro

### Combinações Válidas

#### 🔢 Sequências (Escalas)
- Mínimo de 3 cartas do mesmo naipe em ordem consecutiva
- Exemplo: `5♠ 6♠ 7♠` ou `Q♥ J♥ K♥ A♥`

#### 🎴 Trincas (Sets)
- Mínimo de 3 cartas do mesmo valor com naipes diferentes
- Exemplo: `4♠ 4♥ 4♦` ou `K♠ K♥ K♦ K♣`

### Pontuação

- **Vencedor da rodada**: 0 pontos
- **Outros jogadores**: Soma dos valores das cartas restantes na mão
- **Valores das cartas**:
  - Ás: 15 pontos (ou 11, conforme regras)
  - Figuras (J, Q, K): 10 pontos
  - Números: Valor nominal (2-10)
- **Fim do jogo**: Primeiro jogador a atingir ou ultrapassar 100 pontos **perde**
- **Jogadores com 100+ pontos**: Podem continuar jogando, mas não podem vencer

### Funcionalidades Especiais

- ⏸️ **Pausa para Bater**: Jogadores podem tentar bater fora de turno (com timer de 30 segundos)
- 🔄 **Layoff**: Adicionar cartas às combinações já baixadas na mesa
- 💬 **Chat em tempo real**: Comunicação entre jogadores
- 📊 **Placar dinâmico**: Acompanhamento de pontuação em tempo real

---

## ✨ Características

- 🎮 **Multiplayer em tempo real** via Firebase Firestore
- 📱 **PWA (Progressive Web App)** - Instalável no celular
- 🎨 **Interface responsiva** otimizada para mobile
- ⚡ **Tempo real** - Sincronização instantânea entre jogadores
- 🔐 **Autenticação** via Google
- 💾 **Offline-first** com Service Worker
- 🌐 **Multiplataforma** - Funciona em qualquer dispositivo

---

## 🛠️ Tecnologias

### Frontend
- **React 18.2** - Biblioteca UI
- **TypeScript 5.2** - Tipagem estática
- **Vite 5.0** - Build tool e dev server
- **Tailwind CSS 4.1** - Framework CSS
- **React Router 6.20** - Roteamento
- **Zustand 4.4** - Gerenciamento de estado

### Backend & Infraestrutura
- **Firebase Firestore** - Banco de dados em tempo real
- **Firebase Authentication** - Autenticação Google
- **Firebase Security Rules** - Regras de segurança

### PWA & Deploy
- **Vite PWA Plugin** - Geração de Service Worker
- **Workbox** - Cache e estratégias offline
- **Vercel** - Hospedagem e CI/CD

### UI Components
- **Radix UI** - Componentes acessíveis
- **Lucide React** - Ícones
- **shadcn/ui** - Componentes UI (Alert Dialog)

---

## 📦 Pré-requisitos

- **Node.js** 18+ e npm
- **Conta Firebase** (gratuita)
- **Conta Vercel** (opcional, para deploy)

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/maxgsandre/GAME-100-PONTINHOS.git
cd GAME-100-PONTINHOS/src
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Ative **Firestore Database** e **Authentication** (Google)
3. Copie as credenciais do projeto
4. Crie o arquivo `src/src/lib/firebase.ts` com suas credenciais:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

### 4. Configure as regras do Firestore

Copie o conteúdo de `firebase.rules` para o Firebase Console:
- Firestore Database → Rules → Editar

### 5. Execute o projeto

```bash
npm run dev
```

O app estará disponível em `http://localhost:5173`

---

## 🎮 Como Jogar

### Criar uma Sala

1. Faça login com sua conta Google
2. Clique em **"Criar Sala"**
3. Compartilhe o código da sala com seus amigos

### Entrar em uma Sala

1. Faça login com sua conta Google
2. Digite o código da sala
3. Clique em **"Entrar"**

### Durante o Jogo

1. **Comprar carta**: Clique no monte ou no descarte
2. **Formar combinações**: Selecione 3+ cartas válidas e arraste para a área de combinações
3. **Descartar**: Selecione uma carta e clique em **"Descartar"**
4. **Bater**: Quando tiver apenas cartas válidas, descarte a última para bater
5. **Bater fora de turno**: Use o botão **"Bater!"** (tem 30 segundos para formar combinações)

---

## 📁 Estrutura do Projeto

```
100-pontinhos/
├── src/
│   ├── public/              # Assets estáticos (ícones PWA)
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   │   ├── Table.tsx           # Mesa de jogo principal
│   │   │   ├── MobileGameLayout.tsx # Layout mobile
│   │   │   ├── Hand.tsx            # Mão do jogador
│   │   │   ├── MeldsArea.tsx       # Área de combinações
│   │   │   ├── Chat.tsx            # Chat em tempo real
│   │   │   └── ...
│   │   ├── lib/             # Bibliotecas e utilitários
│   │   │   ├── firebase.ts         # Configuração Firebase
│   │   │   ├── firestoreGame.ts    # Operações Firestore
│   │   │   ├── deck.ts             # Lógica do baralho
│   │   │   └── rules.ts            # Regras do jogo
│   │   ├── pages/           # Páginas
│   │   │   ├── Login.tsx           # Tela de login
│   │   │   ├── Home.tsx            # Tela inicial
│   │   │   └── Room.tsx            # Sala de jogo
│   │   ├── contexts/        # Contextos React
│   │   │   └── DialogContext.tsx   # Sistema de diálogos
│   │   └── app/
│   │       └── store.ts            # Estado global (Zustand)
│   ├── firebase.rules       # Regras de segurança Firestore
│   ├── vite.config.ts       # Configuração Vite + PWA
│   └── package.json
├── vercel.json              # Configuração Vercel
└── README.md                # Este arquivo
```

---

## 🌐 Deploy

### Deploy na Vercel

1. **Conecte seu repositório**:
   - Acesse [vercel.com](https://vercel.com)
   - Importe o repositório do GitHub

2. **Configure o build**:
   - Build Command: `cd src && npm install && npm run build`
   - Output Directory: `src/dist`
   - Install Command: `cd src && npm install`

3. **Variáveis de ambiente** (se necessário):
   - Adicione no dashboard da Vercel

4. **Deploy automático**:
   - Cada push na branch `main` gera um novo deploy

### Deploy Manual

```bash
cd src
npm run build
vercel --prod
```

---

## 📱 PWA - Instalação no Celular

### iPhone (Safari)

1. Abra o site no Safari
2. Toque no botão de compartilhar (□↑)
3. Selecione **"Adicionar à Tela de Início"**
4. O app será instalado como um aplicativo standalone

### Android (Chrome)

1. Abra o site no Chrome
2. Toque no menu (⋮)
3. Selecione **"Adicionar à tela inicial"** ou **"Instalar app"**
4. Confirme a instalação

### Requisitos PWA

- ✅ Manifest JSON configurado
- ✅ Service Worker registrado
- ✅ Ícones 192x192 e 512x512
- ✅ HTTPS (fornecido pela Vercel)
- ✅ Display standalone

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abrir um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

## 👨‍💻 Autor

**Maxgsandre**

- GitHub: [@maxgsandre](https://github.com/maxgsandre)
- Projeto: [100 Pontinhos](https://github.com/maxgsandre/GAME-100-PONTINHOS)

---

## 🙏 Agradecimentos

- [Firebase](https://firebase.google.com/) - Backend em tempo real
- [Vercel](https://vercel.com/) - Hospedagem
- [shadcn/ui](https://ui.shadcn.com/) - Componentes UI
- [Radix UI](https://www.radix-ui.com/) - Componentes acessíveis
- [Lucide](https://lucide.dev/) - Ícones

---

<div align="center">

**Desenvolvido com ❤️ usando React, TypeScript e Firebase**

⭐ Se este projeto foi útil, considere dar uma estrela!

</div>
