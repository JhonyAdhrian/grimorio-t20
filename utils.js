/**
 * Utilitários para o Aplicativo de RPG (D&D 5e)
 */

/**
 * Calcula o modificador de um atributo baseado nas regras do Tormenta 20.
 * Em T20, o valor do atributo é diretamente o próprio modificador.
 * @param {number} score - O valor do atributo (ex: -2, 0, 3, 5)
 * @returns {string} O modificador formatado (ex: "+3", "-1", "+0")
 */
export function calculateModifier(score) {
    const val = parseInt(score, 10);
    if (isNaN(val)) return "+0";
    return val >= 0 ? `+${val}` : `${val}`;
}

/**
 * Calcula a capacidade máxima de carga por espaços no Tormenta 20.
 * Fórmula básica: 10 + Modificador de Força (mínimo de 1)
 * @param {number} strength - Modificador de Força do personagem
 * @returns {number} Limite máximo de espaços de inventário
 */
export function calculateMaxCarrySpaces(strength) {
    const str = parseInt(strength, 10);
    const limit = 10 + (isNaN(str) ? 0 : str);
    return Math.max(1, limit);
}

/**
 * Rola um dado de N lados e retorna o resultado detalhado.
 * @param {number} sides - Quantidade de lados do dado (ex: 20, 6, 8)
 * @returns {object} Resultado contendo o valor do dado e hora formatada
 */
export function rollDice(sides) {
    const roll = Math.floor(Math.random() * sides) + 1;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    return {
        sides,
        roll,
        time: timeStr
    };
}

/**
 * Gera um ID único simples.
 * @returns {string} ID único gerado
 */
export function generateId() {
    return 'char_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Salva a lista de personagens no LocalStorage.
 * @param {Array} characters - Array de objetos de personagens
 */
export function saveCharacters(characters) {
    try {
        localStorage.setItem('dnd_master_characters', JSON.stringify(characters));
    } catch (e) {
        console.error("Erro ao salvar no LocalStorage:", e);
        alert("Erro ao salvar dados. O limite de espaço do navegador pode ter sido atingido (especialmente com fotos grandes). Tente usar fotos menores ou links.");
    }
}

/**
 * Recupera a lista de personagens do LocalStorage.
 * @returns {Array} Array de personagens (ou vazio se não existir)
 */
export function loadCharacters() {
    try {
        const data = localStorage.getItem('dnd_master_characters');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Erro ao carregar do LocalStorage:", e);
        return [];
    }
}

/**
 * Exporta a lista de personagens como um arquivo JSON baixável.
 * @param {Array} characters - Lista de personagens
 */
export function exportToJSON(characters) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(characters, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    downloadAnchor.setAttribute("download", `dnd_master_backup_${dateStr}.json`);
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

/**
 * Converte um arquivo de imagem em Base64 para ser salvo localmente.
 * @param {File} file - Arquivo de imagem do input file
 * @returns {Promise<string>} Promise que resolve com a string Base64 da imagem
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
