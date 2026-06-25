#!/bin/bash

# Define caminhos absolutos
ROOT_DIR="/home/jhony/Downloads/Antigravity/rpg"
ENV_DIR="$ROOT_DIR/.build-env"
JDK_DIR="$ENV_DIR/jdk-17"
SDK_DIR="$ENV_DIR/android-sdk"
APK_OUT_DIR="$ROOT_DIR/android/app/build/outputs/apk/debug"

# Cores para logs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Iniciando Compilação Portátil do APK ===${NC}"
mkdir -p "$ENV_DIR"

# 1. DOWNLOAD E INSTALAÇÃO DO JDK 17 PORTÁTIL (Se necessário)
if [ ! -d "$JDK_DIR" ]; then
    echo -e "${BLUE}JDK 17 não encontrado. Baixando OpenJDK portátil...${NC}"
    JDK_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.10_7.tar.gz"
    JDK_TAR="$ENV_DIR/openjdk17.tar.gz"
    
    echo "Baixando JDK de: $JDK_URL"
    curl -L "$JDK_URL" -o "$JDK_TAR"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Erro ao baixar JDK.${NC}"
        exit 1
    fi
    
    echo "Extraindo JDK..."
    mkdir -p "$JDK_DIR"
    tar -xzf "$JDK_TAR" -C "$JDK_DIR" --strip-components=1
    rm "$JDK_TAR"
    echo -e "${GREEN}JDK instalado com sucesso em $JDK_DIR${NC}"
else
    echo -e "${GREEN}JDK 17 portátil já está instalado.${NC}"
fi

# 2. DOWNLOAD E INSTALAÇÃO DO ANDROID SDK COMMAND LINE TOOLS (Se necessário)
if [ ! -d "$SDK_DIR/cmdline-tools/latest" ]; then
    echo -e "${BLUE}Android SDK Command Line Tools não encontrado. Baixando...${NC}"
    SDK_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
    SDK_ZIP="$ENV_DIR/cmdline-tools.zip"
    
    echo "Baixando SDK de: $SDK_URL"
    curl -L "$SDK_URL" -o "$SDK_ZIP"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Erro ao baixar Android SDK Command Line Tools.${NC}"
        exit 1
    fi
    
    echo "Extraindo Command Line Tools..."
    # Capacitor/Android SDK exige a estrutura cmdline-tools/latest/bin
    mkdir -p "$SDK_DIR/cmdline-tools"
    unzip -q "$SDK_ZIP" -d "$SDK_DIR/cmdline-tools"
    mv "$SDK_DIR/cmdline-tools/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
    rm "$SDK_ZIP"
    echo -e "${GREEN}Android Command Line Tools instalado com sucesso.${NC}"
else
    echo -e "${GREEN}Android Command Line Tools já está instalado.${NC}"
fi

# 3. CONFIGURAÇÃO DE VARIÁVEIS DE AMBIENTE
export JAVA_HOME="$JDK_DIR"
export ANDROID_HOME="$SDK_DIR"
export PATH="$JAVA_HOME/bin:$SDK_DIR/cmdline-tools/latest/bin:$SDK_DIR/platform-tools:$PATH"

echo "JAVA_HOME set to: $JAVA_HOME"
echo "ANDROID_HOME set to: $ANDROID_HOME"

# 4. ACEITAR LICENÇAS E INSTALAR PLATAFORMAS/BUILD TOOLS
echo -e "${BLUE}Aceitando licenças do Android SDK...${NC}"
# Aceita licenças enviando "yes" automaticamente
yes | sdkmanager --licenses

echo -e "${BLUE}Instalando Android SDK Platform 34 e Build Tools 34.0.0...${NC}"
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"

if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao instalar pacotes do Android SDK via sdkmanager.${NC}"
    exit 1
fi
echo -e "${GREEN}Componentes do Android SDK instalados com sucesso.${NC}"

# 5. GERAR BUILD WEB E SINCRONIZAR COM CAPACITOR
echo -e "${BLUE}Executando build do projeto web...${NC}"
npm run build

echo -e "${BLUE}Sincronizando arquivos com o projeto Android do Capacitor...${NC}"
npx cap sync

if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao sincronizar ativos com o Capacitor.${NC}"
    exit 1
fi

# 6. COMPILAR O APK USANDO GRADLE
echo -e "${BLUE}Compilando APK nativo com Gradle...${NC}"
cd "$ROOT_DIR/android"
chmod +x gradlew

# Executa a compilação
./gradlew assembleDebug

if [ $? -ne 0 ]; then
    echo -e "${RED}Erro na compilação do APK com Gradle.${NC}"
    exit 1
fi

# 7. COPIAR APK FINAL
if [ -f "$APK_OUT_DIR/app-debug.apk" ]; then
    cp "$APK_OUT_DIR/app-debug.apk" "$ROOT_DIR/grimorio-do-mestre.apk"
    echo -e "${GREEN}=== SUCESSO! ===${NC}"
    echo -e "${GREEN}O arquivo APK foi gerado na raiz do projeto:${NC}"
    echo -e "${GREEN}$ROOT_DIR/grimorio-do-mestre.apk${NC}"
else
    echo -e "${RED}Erro: O arquivo APK compilado não foi encontrado no diretório de saída Gradle.${NC}"
    exit 1
fi
