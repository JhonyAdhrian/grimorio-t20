import {
    calculateModifier,
    calculateMaxCarrySpaces,
    rollDice,
    generateId
} from './utils.js';

// ==========================================================================
// ESTADO GLOBAL DO CLIENTE
// ==========================================================================
let socket = null;
let currentProfile = null; // 'master' ou 'player'
let roomCode = '';
let myCharacter = null;
let connectedPlayers = []; // Apenas para Mestre

// URL de conexão com fallback inteligente para desenvolvimento
const socketHost = window.location.port === "5173" ? "http://localhost:3000" : window.location.origin;

// ==========================================================================
// ELEMENTOS DOM
// ==========================================================================
const DOM = {
    // Telas
    screenSelection: document.getElementById('screen-role-selection'),
    screenMaster: document.getElementById('screen-master-dashboard'),
    screenPlayer: document.getElementById('screen-player-sheet'),
    
    // Entrada / Seleção
    btnHostGame: document.getElementById('btn-host-game'),
    btnJoinGame: document.getElementById('btn-join-game'),
    joinRoomCode: document.getElementById('join-room-code'),
    joinCharName: document.getElementById('join-char-name'),
    
    // Mestre
    masterRoomCode: document.getElementById('master-room-code'),
    masterConnectionIp: document.getElementById('master-connection-ip'),
    btnMasterCustomRoll: document.getElementById('btn-master-custom-roll'),
    masterDiceModifier: document.getElementById('master-dice-modifier'),
    globalLog: document.getElementById('global-log'),
    playersMonitorGrid: document.getElementById('players-monitor-grid'),
    connectedPlayersCount: document.getElementById('connected-players-count'),
    btnCloseRoom: document.getElementById('btn-close-room'),
    
    // Jogador: Info Ficha
    playerCharTitle: document.getElementById('player-char-title'),
    playerClassRaceLvl: document.getElementById('player-class-race-lvl'),
    playerRoomDisplay: document.getElementById('player-room-display'),
    btnEditDetails: document.getElementById('btn-edit-details'),
    btnExitRoom: document.getElementById('btn-exit-room'),
    
    // Jogador: Vitais
    pCurrentPV: document.getElementById('p-current-pv'),
    pMaxPV: document.getElementById('p-max-pv'),
    pPVBar: document.getElementById('p-pv-bar'),
    pPVAdjVal: document.getElementById('p-pv-adj-val'),
    btnPPVMinus: document.getElementById('btn-p-pv-minus'),
    btnPPVPlus: document.getElementById('btn-p-pv-plus'),
    
    pCurrentPM: document.getElementById('p-current-pm'),
    pMaxPM: document.getElementById('p-max-pm'),
    pPMBar: document.getElementById('p-pm-bar'),
    pPMAdjVal: document.getElementById('p-pm-adj-val'),
    btnPPMMinus: document.getElementById('btn-p-pm-minus'),
    btnPPMPlus: document.getElementById('btn-p-pm-plus'),
    
    pDefense: document.getElementById('p-defense'),
    pInitiative: document.getElementById('p-initiative'),
    
    // Jogador: Atributos
    pStr: document.getElementById('p-str'),
    pDex: document.getElementById('p-dex'),
    pCon: document.getElementById('p-con'),
    pInt: document.getElementById('p-int'),
    pWis: document.getElementById('p-wis'),
    pCha: document.getElementById('p-cha'),
    
    // Jogador: Abas & Inventário
    playerTabs: document.querySelectorAll('.p-tab-btn'),
    playerTabContents: document.querySelectorAll('.player-tab-body .p-tab-content'),
    pCurrentSlots: document.getElementById('p-current-slots'),
    pMaxSlots: document.getElementById('p-max-slots'),
    pCarryBar: document.getElementById('p-carry-bar'),
    invItemName: document.getElementById('inv-item-name'),
    invItemSlots: document.getElementById('inv-item-slots'),
    invItemQty: document.getElementById('inv-item-qty'),
    btnAddInvItem: document.getElementById('btn-add-inv-item'),
    inventoryListBody: document.getElementById('inventory-list-body'),
    pDeity: document.getElementById('p-deity'),
    pOrigin: document.getElementById('p-origin'),
    pBackstory: document.getElementById('p-backstory'),
    
    // Modais Config
    detailsModal: document.getElementById('details-modal'),
    confCharName: document.getElementById('conf-char-name'),
    confCharLvl: document.getElementById('conf-char-lvl'),
    confCharRace: document.getElementById('conf-char-race'),
    confCharClass: document.getElementById('conf-char-class'),
    confCharMaxPV: document.getElementById('conf-char-max-pv'),
    confCharMaxPM: document.getElementById('conf-char-max-pm'),
    confCharAvatar: document.getElementById('conf-char-avatar'),
    btnSaveDetails: document.getElementById('btn-save-details'),
    btnCancelDetails: document.getElementById('btn-cancel-details'),
    btnCloseDetails: document.getElementById('btn-close-details')
};

// ==========================================================================
// INICIALIZAÇÃO E BINDINGS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    lucide.createIcons();
});

function initApp() {
    // Botões de Seleção de Perfil
    DOM.btnHostGame.addEventListener('click', hostGame);
    DOM.btnJoinGame.addEventListener('click', joinGame);
    
    // Tecla Enter no formulário de Jogador
    DOM.joinRoomCode.addEventListener('keypress', (e) => { if (e.key === 'Enter') joinGame(); });
    DOM.joinCharName.addEventListener('keypress', (e) => { if (e.key === 'Enter') joinGame(); });
    
    // Tabs da Ficha do Jogador
    DOM.playerTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            DOM.playerTabs.forEach(btn => btn.classList.remove('active'));
            DOM.playerTabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        });
    });
}

// Cria uma notificação Toast na tela
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info'}"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.classList.add('active');
    }, 50);
    
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================================================
// MESTRE: CRIAÇÃO E CONTROLE DA SALA
// ==========================================================================
function hostGame() {
    console.log(`Conectando ao Socket.io: ${socketHost}`);
    socket = io(socketHost);
    
    socket.on('connect', () => {
        socket.emit('create-room', (response) => {
            if (response.success) {
                currentProfile = 'master';
                roomCode = response.roomCode;
                
                // Transição de tela
                DOM.screenSelection.classList.remove('active');
                DOM.screenMaster.classList.add('active');
                
                // Exibe código da sala
                DOM.masterRoomCode.textContent = roomCode;
                
                // Exibe o endereço IP local de conexão
                // Substitui 'localhost' pelo IP correto do mestre no roteador
                const hostIp = window.location.hostname;
                const port = window.location.port ? `:${window.location.port}` : '';
                DOM.masterConnectionIp.textContent = `${window.location.protocol}//${hostIp}${port}/`;
                
                setupMasterSocketListeners();
                setupMasterUi();
                
                showToast(`Sala ${roomCode} criada com sucesso!`, 'success');
            } else {
                showToast("Erro ao criar sala de jogo.", 'error');
            }
        });
    });
    
    socket.on('connect_error', () => {
        showToast("Não foi possível conectar ao servidor de tempo real.", 'error');
    });
}

function setupMasterSocketListeners() {
    // Recebe rolagens dos jogadores
    socket.on('table-roll', (rollData) => {
        appendGlobalLog(rollData);
    });
    
    // Atualização da lista de jogadores conectados
    socket.on('update-player-list', (players) => {
        connectedPlayers = players;
        renderMasterPlayersGrid();
    });
    
    socket.on('player-joined', (data) => {
        showToast(`Herói ${data.characterData.name} entrou no jogo!`, 'success');
    });
    
    socket.on('player-left', (data) => {
        showToast(`Jogador ${data.name} saiu do jogo.`, 'info');
    });
}

function setupMasterUi() {
    // Rolagem do Mestre
    const diceButtons = DOM.screenMaster.querySelectorAll('.btn-dice');
    diceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const sides = parseInt(btn.dataset.sides, 10);
            const modVal = parseInt(DOM.masterDiceModifier.value, 10) || 0;
            const rollObj = rollDice(sides);
            
            const total = rollObj.roll + modVal;
            let detail = `d${sides} (${rollObj.roll})`;
            if (modVal > 0) detail += ` + ${modVal}`;
            if (modVal < 0) detail += ` - ${Math.abs(modVal)}`;
            
            const rollData = {
                sender: "Mestre",
                detail,
                total,
                time: rollObj.time
            };
            
            // Mestre adiciona no seu log local e envia para a sala se necessário
            appendGlobalLog(rollData);
            socket.emit('dice-roll', { roomCode, rollData });
        });
    });
    
    DOM.btnMasterCustomRoll.addEventListener('click', () => {
        const modVal = parseInt(DOM.masterDiceModifier.value, 10) || 0;
        const rollObj = rollDice(20);
        const total = rollObj.roll + modVal;
        
        const rollData = {
            sender: "Mestre",
            detail: `d20 (${rollObj.roll}) ${modVal >= 0 ? '+' : ''}${modVal}`,
            total,
            time: rollObj.time
        };
        
        appendGlobalLog(rollData);
        socket.emit('dice-roll', { roomCode, rollData });
    });
    
    // Fechar Sala
    DOM.btnCloseRoom.addEventListener('click', () => {
        if (confirm("Deseja fechar a sala de jogo? Todos os jogadores serão desconectados.")) {
            socket.disconnect();
            location.reload(); // Recarrega para voltar à tela inicial
        }
    });
}

function appendGlobalLog(rollData) {
    const placeholder = DOM.globalLog.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();
    
    const entry = document.createElement('div');
    entry.className = 'global-log-entry';
    entry.innerHTML = `
        <div class="log-content">
            <strong>${rollData.sender}</strong> rolu: ${rollData.detail} <span class="roll-res">➔ ${rollData.total}</span>
        </div>
        <div class="log-time">${rollData.time}</div>
    `;
    
    DOM.globalLog.appendChild(entry);
    DOM.globalLog.scrollTop = DOM.globalLog.scrollHeight;
}

function renderMasterPlayersGrid() {
    DOM.playersMonitorGrid.innerHTML = '';
    
    if (connectedPlayers.length === 0) {
        DOM.playersMonitorGrid.innerHTML = `
            <div class="no-players-connected" id="no-players-msg">
                <i data-lucide="hourglass" class="waiting-icon"></i>
                <h3>Aguardando Conexão de Jogadores...</h3>
                <p>Os jogadores devem usar o código de sala para se conectar.</p>
            </div>
        `;
        DOM.connectedPlayersCount.textContent = "0 Heróis";
        lucide.createIcons();
        return;
    }
    
    DOM.connectedPlayersCount.textContent = `${connectedPlayers.length} Herói${connectedPlayers.length !== 1 ? 's' : ''}`;
    
    connectedPlayers.forEach(player => {
        const card = document.createElement('div');
        card.className = 'monitor-card';
        
        const avatarUrl = player.avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="%23a61c28" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
        
        const pvPercent = Math.min(100, Math.max(0, (player.currentPv / player.maxPv) * 100));
        const pmPercent = Math.min(100, Math.max(0, (player.currentPm / player.maxPm) * 100));
        
        // Calcula capacidade de carga por espaços
        const maxSlots = calculateMaxCarrySpaces(player.stats.str);
        const currentSlots = calculateInventorySlots(player.inventory);
        
        // Gera lista de inventário HTML
        let inventoryHtml = '<div class="monitor-item-row text-muted text-xs">Mochila vazia.</div>';
        if (player.inventory && player.inventory.length > 0) {
            inventoryHtml = player.inventory.map(item => `
                <div class="monitor-item-row">
                    <span class="monitor-item-name" title="${item.name}">${item.name}</span>
                    <span class="monitor-item-qty">x${item.qty} (${item.slots * item.qty} esp.)</span>
                </div>
            `).join('');
        }
        
        card.innerHTML = `
            <div class="monitor-card-header">
                <img src="${avatarUrl}" class="monitor-card-avatar" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'50\' height=\'50\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23a61c28\' stroke-width=\'1.5\'><path d=\'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\'/></svg>'">
                <div class="monitor-card-identity">
                    <h3>${player.name}</h3>
                    <p>${player.class} Nvl ${player.level} - ${player.race}</p>
                </div>
            </div>
            
            <div class="monitor-vitals-bars">
                <!-- PV -->
                <div class="monitor-vital-item">
                    <div class="monitor-vital-label">
                        <span>Vida (PV)</span>
                        <span>${player.currentPv} / ${player.maxPv}</span>
                    </div>
                    <div class="monitor-bar-wrapper">
                        <div class="monitor-bar-fill pv" style="width: ${pvPercent}%;"></div>
                    </div>
                </div>
                
                <!-- PM -->
                <div class="monitor-vital-item">
                    <div class="monitor-vital-label">
                        <span>Mana (PM)</span>
                        <span>${player.currentPm} / ${player.maxPm}</span>
                    </div>
                    <div class="monitor-bar-wrapper">
                        <div class="monitor-bar-fill pm" style="width: ${pmPercent}%;"></div>
                    </div>
                </div>
            </div>
            
            <div class="monitor-stats-row">
                <div class="monitor-stat-col">
                    <span class="monitor-stat-label">Defesa</span>
                    <span class="monitor-stat-val">${player.defense}</span>
                </div>
                <div class="monitor-stat-col">
                    <span class="monitor-stat-label">Iniciativa</span>
                    <span class="monitor-stat-val">${player.initiative >= 0 ? '+' : ''}${player.initiative}</span>
                </div>
            </div>
            
            <div class="monitor-inventory-panel">
                <div class="monitor-inventory-header">
                    <span>Mochila</span>
                    <span>Carga: ${currentSlots} / ${maxSlots} Esp.</span>
                </div>
                <div class="monitor-inventory-list">
                    ${inventoryHtml}
                </div>
            </div>
        `;
        
        DOM.playersMonitorGrid.appendChild(card);
    });
}

function calculateInventorySlots(inventory) {
    if (!inventory) return 0;
    return inventory.reduce((acc, item) => acc + (parseFloat(item.slots) * parseInt(item.qty, 10)), 0);
}

// ==========================================================================
// JOGADOR: CONEXÃO E FICHA EM TEMPO REAL
// ==========================================================================
function joinGame() {
    const rCode = DOM.joinRoomCode.value.toUpperCase().trim();
    const charName = DOM.joinCharName.value.trim();
    
    if (!rCode || !charName) {
        showToast("Código da sala e nome do personagem são obrigatórios!", 'error');
        return;
    }
    
    // Inicializa personagem padrão
    myCharacter = {
        name: charName,
        level: 1,
        race: "Humano",
        class: "Guerreiro",
        currentPv: 20,
        maxPv: 20,
        currentPm: 5,
        maxPm: 5,
        defense: 10,
        initiative: 0,
        speed: "9m (6 metros)",
        stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        inventory: [],
        deity: "",
        origin: "",
        backstory: "",
        avatar: ""
    };
    
    console.log(`Conectando jogador ao Socket.io: ${socketHost}`);
    socket = io(socketHost);
    
    socket.on('connect', () => {
        socket.emit('join-room', { roomCode: rCode, characterData: myCharacter }, (response) => {
            if (response.success) {
                currentProfile = 'player';
                roomCode = rCode;
                
                // Transição de tela
                DOM.screenSelection.classList.remove('active');
                DOM.screenPlayer.classList.add('active');
                
                DOM.playerRoomDisplay.textContent = roomCode;
                
                setupPlayerUi();
                setupPlayerSocketListeners();
                syncPlayerToUi();
                
                showToast(`Conectado à sala ${roomCode}!`, 'success');
            } else {
                showToast(response.message || "Erro ao conectar à sala.", 'error');
                socket.disconnect();
            }
        });
    });
    
    socket.on('connect_error', () => {
        showToast("Erro ao conectar ao servidor do Mestre.", 'error');
    });
}

function setupPlayerSocketListeners() {
    socket.on('room-closed', (data) => {
        alert(data.message || "A sala foi encerrada pelo Mestre.");
        location.reload();
    });
    
    socket.on('disconnect', () => {
        showToast("Conexão perdida com o servidor.", 'error');
        const dot = DOM.screenPlayer.querySelector('.status-dot');
        if (dot) dot.className = 'status-dot disconnected';
    });
}

// Sincroniza dados da memória local com os elementos HTML da tela
function syncPlayerToUi() {
    if (!myCharacter) return;
    
    // Header
    DOM.playerCharTitle.textContent = myCharacter.name;
    DOM.playerClassRaceLvl.textContent = `${myCharacter.class} Nvl ${myCharacter.level} - ${myCharacter.race}`;
    
    // PV
    DOM.pCurrentPV.textContent = myCharacter.currentPv;
    DOM.pMaxPV.textContent = myCharacter.maxPv;
    const pvPercent = Math.min(100, Math.max(0, (myCharacter.currentPv / myCharacter.maxPv) * 100));
    DOM.pPVBar.style.width = `${pvPercent}%`;
    
    // PM
    DOM.pCurrentPM.textContent = myCharacter.currentPm;
    DOM.pMaxPM.textContent = myCharacter.maxPm;
    const pmPercent = Math.min(100, Math.max(0, (myCharacter.currentPm / myCharacter.maxPm) * 100));
    DOM.pPMBar.style.width = `${pmPercent}%`;
    
    // Defesa e Iniciativa
    DOM.pDefense.value = myCharacter.defense;
    DOM.pInitiative.value = myCharacter.initiative;
    
    // Atributos
    DOM.pStr.value = myCharacter.stats.str;
    DOM.pDex.value = myCharacter.stats.dex;
    DOM.pCon.value = myCharacter.stats.con;
    DOM.pInt.value = myCharacter.stats.int;
    DOM.pWis.value = myCharacter.stats.wis;
    DOM.pCha.value = myCharacter.stats.cha;
    
    // RP
    DOM.pDeity.value = myCharacter.deity || '';
    DOM.pOrigin.value = myCharacter.origin || '';
    DOM.pBackstory.value = myCharacter.backstory || '';
    
    // Inventário
    renderPlayerInventory();
}

function updateAndEmitCharacter() {
    if (!socket || !roomCode || !myCharacter) return;
    socket.emit('update-character', { roomCode, characterData: myCharacter });
}

function setupPlayerUi() {
    // 1. Controle de Vida (PV)
    DOM.btnPPVMinus.addEventListener('click', () => {
        const val = parseInt(DOM.pPVAdjVal.value, 10) || 1;
        myCharacter.currentPv = Math.max(0, myCharacter.currentPv - val);
        DOM.pCurrentPV.textContent = myCharacter.currentPv;
        DOM.pPVBar.style.width = `${(myCharacter.currentPv / myCharacter.maxPv) * 100}%`;
        updateAndEmitCharacter();
    });
    
    DOM.btnPPVPlus.addEventListener('click', () => {
        const val = parseInt(DOM.pPVAdjVal.value, 10) || 1;
        myCharacter.currentPv = Math.min(myCharacter.maxPv, myCharacter.currentPv + val);
        DOM.pCurrentPV.textContent = myCharacter.currentPv;
        DOM.pPVBar.style.width = `${(myCharacter.currentPv / myCharacter.maxPv) * 100}%`;
        updateAndEmitCharacter();
    });
    
    // 2. Controle de Mana (PM)
    DOM.btnPPMMinus.addEventListener('click', () => {
        const val = parseInt(DOM.pPMAdjVal.value, 10) || 1;
        myCharacter.currentPm = Math.max(0, myCharacter.currentPm - val);
        DOM.pCurrentPM.textContent = myCharacter.currentPm;
        DOM.pPMBar.style.width = `${(myCharacter.currentPm / myCharacter.maxPm) * 100}%`;
        updateAndEmitCharacter();
    });
    
    DOM.btnPPMPlus.addEventListener('click', () => {
        const val = parseInt(DOM.pPMAdjVal.value, 10) || 1;
        myCharacter.currentPm = Math.min(myCharacter.maxPm, myCharacter.currentPm + val);
        DOM.pCurrentPM.textContent = myCharacter.currentPm;
        DOM.pPMBar.style.width = `${(myCharacter.currentPm / myCharacter.maxPm) * 100}%`;
        updateAndEmitCharacter();
    });
    
    // 3. Inputs Numéricos Simples (Defesa, Iniciativa)
    DOM.pDefense.addEventListener('change', () => {
        myCharacter.defense = parseInt(DOM.pDefense.value, 10) || 10;
        updateAndEmitCharacter();
    });
    
    DOM.pInitiative.addEventListener('change', () => {
        myCharacter.initiative = parseInt(DOM.pInitiative.value, 10) || 0;
        updateAndEmitCharacter();
    });
    
    // 4. Atributos
    const attrInputs = [DOM.pStr, DOM.pDex, DOM.pCon, DOM.pInt, DOM.pWis, DOM.pCha];
    attrInputs.forEach(input => {
        input.addEventListener('change', () => {
            const val = parseInt(input.value, 10) || 0;
            const attrKey = input.id.replace('p-', ''); // 'str', 'dex', etc.
            myCharacter.stats[attrKey] = val;
            
            // Se mudou Força, recalcula capacidade de inventário
            if (attrKey === 'str') {
                const maxSlots = calculateMaxCarrySpaces(val);
                DOM.pMaxSlots.textContent = maxSlots;
                updateCarryBar();
            }
            
            updateAndEmitCharacter();
        });
    });
    
    // 5. Inventário: Adicionar Item
    DOM.btnAddInvItem.addEventListener('click', () => {
        const name = DOM.invItemName.value.trim();
        const slots = parseFloat(DOM.invItemSlots.value);
        const qty = parseInt(DOM.invItemQty.value, 10);
        
        if (!name || isNaN(slots) || isNaN(qty) || slots < 0 || qty < 1) {
            showToast("Insira um nome, espaços e quantidade válidos!", 'error');
            return;
        }
        
        const newItem = {
            id: generateId(),
            name,
            slots,
            qty
        };
        
        myCharacter.inventory.push(newItem);
        
        // Limpa campos
        DOM.invItemName.value = '';
        DOM.invItemSlots.value = 1;
        DOM.invItemQty.value = 1;
        
        renderPlayerInventory();
        updateAndEmitCharacter();
        showToast(`Adicionado: ${name} (x${qty})`, 'success');
    });
    
    // 6. RP & Background
    DOM.pDeity.addEventListener('change', () => {
        myCharacter.deity = DOM.pDeity.value.trim();
        updateAndEmitCharacter();
    });
    DOM.pOrigin.addEventListener('change', () => {
        myCharacter.origin = DOM.pOrigin.value.trim();
        updateAndEmitCharacter();
    });
    DOM.pBackstory.addEventListener('change', () => {
        myCharacter.backstory = DOM.pBackstory.value.trim();
        updateAndEmitCharacter();
    });
    
    // 7. Modais de Configuração Ficha
    DOM.btnEditDetails.addEventListener('click', openDetailsModal);
    DOM.btnCloseDetails.addEventListener('click', closeDetailsModal);
    DOM.btnCancelDetails.addEventListener('click', closeDetailsModal);
    DOM.btnSaveDetails.addEventListener('click', saveDetailsModal);
    
    // 8. Rolador de Dados do Jogador
    const pDiceButtons = DOM.screenPlayer.querySelectorAll('.btn-p-dice');
    pDiceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const sides = parseInt(btn.dataset.sides, 10);
            
            // Tenta pegar bônus de atributo correspondente à perícia se necessário, mas no rolador rápido pegamos bônus manual de modificador
            // Para d20, adicionamos um prompt simples ou apenas rolamos e mostramos.
            const rollObj = rollDice(sides);
            const detail = `d${sides} (${rollObj.roll})`;
            
            showToast(`Rolou d${sides}: ${rollObj.roll}`, 'success');
            
            // Envia para o Mestre
            socket.emit('dice-roll', {
                roomCode,
                rollData: {
                    sender: myCharacter.name,
                    detail,
                    total: rollObj.roll,
                    time: rollObj.time
                }
            });
        });
    });
    
    // 9. Sair da Sala
    DOM.btnExitRoom.addEventListener('click', () => {
        if (confirm("Deseja sair da sala de jogo? Seu personagem será desconectado.")) {
            socket.disconnect();
            location.reload();
        }
    });
}

function updateCarryBar() {
    const maxSlots = calculateMaxCarrySpaces(myCharacter.stats.str);
    const currentSlots = calculateInventorySlots(myCharacter.inventory);
    
    DOM.pCurrentSlots.textContent = currentSlots;
    DOM.pMaxSlots.textContent = maxSlots;
    
    const carryPercent = Math.min(100, (currentSlots / maxSlots) * 100);
    DOM.pCarryBar.style.width = `${carryPercent}%`;
    
    // Muda a cor da barra de carga se exceder
    if (currentSlots > maxSlots) {
        DOM.pCarryBar.style.backgroundColor = 'var(--color-ruby)';
    } else {
        DOM.pCarryBar.style.backgroundColor = 'var(--color-gold)';
    }
}

function renderPlayerInventory() {
    DOM.inventoryListBody.innerHTML = '';
    
    if (!myCharacter.inventory || myCharacter.inventory.length === 0) {
        DOM.inventoryListBody.innerHTML = `
            <tr class="empty-inventory-row">
                <td colspan="5" class="text-center text-muted">Mochila vazia. Adicione itens acima.</td>
            </tr>
        `;
        updateCarryBar();
        return;
    }
    
    myCharacter.inventory.forEach(item => {
        const tr = document.createElement('tr');
        const total = item.slots * item.qty;
        
        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.slots}</td>
            <td>${item.qty}</td>
            <td><strong>${total} esp.</strong></td>
            <td>
                <button class="btn-danger btn-xs btn-del-item" data-item-id="${item.id}">
                    <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Excluir
                </button>
            </td>
        `;
        
        // Excluir Item
        tr.querySelector('.btn-del-item').addEventListener('click', () => {
            myCharacter.inventory = myCharacter.inventory.filter(i => i.id !== item.id);
            renderPlayerInventory();
            updateAndEmitCharacter();
            showToast(`Removido: ${item.name}`, 'info');
        });
        
        DOM.inventoryListBody.appendChild(tr);
    });
    
    updateCarryBar();
    lucide.createIcons();
}

// Modal Config Ficha
function openDetailsModal() {
    DOM.confCharName.value = myCharacter.name;
    DOM.confCharLvl.value = myCharacter.level;
    DOM.confCharRace.value = myCharacter.race;
    DOM.confCharClass.value = myCharacter.class;
    DOM.confCharMaxPV.value = myCharacter.maxPv;
    DOM.confCharMaxPM.value = myCharacter.maxPm;
    DOM.confCharAvatar.value = myCharacter.avatar || '';
    
    DOM.detailsModal.classList.add('active');
}

function closeDetailsModal() {
    DOM.detailsModal.classList.remove('active');
}

function saveDetailsModal() {
    const name = DOM.confCharName.value.trim();
    const lvl = parseInt(DOM.confCharLvl.value, 10);
    const race = DOM.confCharRace.value.trim();
    const clazz = DOM.confCharClass.value.trim();
    const maxPv = parseInt(DOM.confCharMaxPV.value, 10);
    const maxPm = parseInt(DOM.confCharMaxPM.value, 10);
    const avatar = DOM.confCharAvatar.value.trim();
    
    if (!name || isNaN(lvl) || isNaN(maxPv) || isNaN(maxPm) || lvl < 1 || maxPv < 1 || maxPm < 0) {
        showToast("Preencha todos os campos corretamente!", 'error');
        return;
    }
    
    myCharacter.name = name;
    myCharacter.level = lvl;
    myCharacter.race = race;
    myCharacter.class = clazz;
    myCharacter.maxPv = maxPv;
    // Se a vida máxima diminuiu, ajusta o PV atual
    myCharacter.currentPv = Math.min(myCharacter.currentPv, maxPv);
    myCharacter.maxPm = maxPm;
    myCharacter.currentPm = Math.min(myCharacter.currentPm, maxPm);
    myCharacter.avatar = avatar;
    
    syncPlayerToUi();
    updateAndEmitCharacter();
    closeDetailsModal();
    
    showToast("Ficha atualizada com sucesso!", 'success');
}
