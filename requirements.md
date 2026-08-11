# Requisitos e Setup de Instalação - extinction-app

## 📋 Pré-requisitos
* **Git**: Controle de versão
* **Node.js**: Runtime JS (LTS recomendada)
* **NPM**: Gerenciador de pacotes
* **Expo SDK**: ~54.0.0

---

## 🚀 Comandos de Instalação e Execução (Windows CMD)

### 1. Instalar Ferramentas Nativas (CMD como Administrador)
```cmd
winget install --id Git.Git -e --source winget
winget install OpenJS.NodeJS.LTS --source winget
```
*(Após instalar, feche e abra um novo terminal CMD)*

### 2. Clonar o Repositório
```cmd
git clone https://github.com/Fdanielsantos/extinction-app.git
cd extinction-app
```

### 3. Instalar Dependências e Ajustar o Expo
```cmd
npm install
npm install expo@~54.0.0
npx expo install --fix
```

### 4. Executar o Projeto (Com limpeza de cache)
```cmd
npx expo start -c
```