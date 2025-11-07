// ==========================================================
// 1. GLOBAL VARIABLES & CONSTANTS (CORRECTED)
// ==========================================================

let coins = 100;
let fgm = 0;
let selectedSeed = 'wheat';
let farmSoil = 6;
let treeSoil = 6;
let farmPlots = [];
let treePlots = [];
let seeds = { wheat: 10, corn: 5, tree: 0 };
let crops = { wheat: 0, corn: 0, wood: 0 };
let normalTools = { wateringCan: 0, scissors: 0, axe: 0 };
let nftTools = { wateringCan: false, scissors: false, axe: false };
let normalToolUses = { wateringCan: 3, scissors: 3, axe: 3 }; // Uses left for each tool type
let nftToolUses = { wateringCan: 0, scissors: 0, axe: 0 }; // Uses left (NFTs usually have unlimited uses, 0 means unlim)
let rewards = {
    daily: { claimed: false, reward: 10, targetCrop: 10, targetTree: 5, crop: 0, tree: 0 },
    weekly: { claimed: false, reward: 50, targetCrop: 50, targetTree: 20, crop: 0, tree: 0 }
};
let lastClaimTimes = { daily: 0, weekly: 0 };
let progress = { cropsHarvested: 0, treesChopped: 0 };
let walletConnected = false;

// Time Constants (in SECONDS) 🛑 ویلیوز سیکنڈز میں ہی رہیں گی
const WHEAT_GROW_TIME = 1800; // 30 seconds
const CORN_GROW_TIME = 2700;  // 60 seconds
const TREE_GROW_TIME = 3600; // 1 hour (3600 seconds)
const TREE_CHOP_COUNT = 3; // How many chops per tree for wood
const FGM_TO_COINS_RATE = 100; // 1 FGM = 100 Coins

// HTML Elements (for quick access) - 🛑 ان کو صرف ڈیفائن کیا گیا ہے، init() میں سیٹ ہوں گے!
let farmDiv = null; 
let treeDiv = null;
let selectedTool = 'hand'; 

// ==========================================================
// 2. HELPER FUNCTIONS
// ==========================================================

function formatTime(ms) {
    if (ms <= 0) return "READY!";
    
    // Math.ceil() کا استعمال تاکہ ٹائمر ہمیشہ 1s زیادہ دکھائے
    const totalSeconds = Math.ceil(ms / 1000); 
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const secDisplay = seconds.toString().padStart(2, '0');
    
    return `${minutes}m ${secDisplay}s`;
}

function calculateUpgradeCost(currentSoil) {
    return Math.floor(currentSoil / 6) * 5 + 5; 
}

function navigatePage(url) {
    window.location.href = url;
}

function consumeTool(toolType, isNFT) {
    if (isNFT) {
        if (nftToolUses[toolType] > 0) {
            nftToolUses[toolType]--; 
            
            if (nftToolUses[toolType] === 0) {
                 nftTools[toolType] = false;
                 return { success: true, message: `Used ${toolType} NFT. It has broken!` };
            }
            
            return { success: true, message: `Used ${toolType} NFT. ${nftToolUses[toolType]} uses left.` };
        } else if (nftTools[toolType] === true) {
             nftTools[toolType] = false;
             return { success: false, message: `${toolType} NFT has no uses left. You need to buy a new one.` };
        } else {
             return { success: false, message: `You do not own the ${toolType} NFT.` };
        }
    } else {
        if (normalToolUses[toolType] > 0) {
            normalToolUses[toolType]--;
            return { success: true, message: `Used ${toolType}. ${normalToolUses[toolType]} uses left.` };
        } else if (normalTools[toolType] > 0) {
            normalTools[toolType]--;
            normalToolUses[toolType] = 2; // 3 سے شروع ہو کر 1 استعمال ہو چکا، 2 باقی
            return { success: true, message: `Used new ${toolType}. 25 uses left.` }; 
        } else {
            return { success: false, message: `No uses left for ${toolType} and no spare tools.` };
        }
    }
}
// ==========================================================
// 3. UI, SAVING, LOADING
// ==========================================================
function updateUI() {
    // Currencies
    const coinsEl = document.getElementById('coinsEl');
    if (coinsEl) coinsEl.textContent = `${coins} 💰 Coins`;
    const fgmEl = document.getElementById('fgmEl');
    if (fgmEl) fgmEl.textContent = `${fgm} 💎 FGM`;
    
    // Inventory PopUp Update (Simple update, assumes table bodies are handled elsewhere)
    const coinsInv = document.getElementById('coinsElInventory');
    if (coinsInv) coinsInv.textContent = `${coins} 💰 Coins`;
    const fgmInv = document.getElementById('fgmElInventory');
    if (fgmInv) fgmInv.textContent = `${fgm} 💎 FGM`;

    // Seed Selector
    const seedDisp = document.getElementById('currentSeedDisplay');
    if (seedDisp) seedDisp.textContent = selectedSeed.charAt(0).toUpperCase() + selectedSeed.slice(1);

    // Upgrade Section
    const farmSoilCountEl = document.getElementById('farmSoilCount');
    if (farmSoilCountEl) farmSoilCountEl.textContent = `${farmSoil} / 75`;
    const treeSoilCountEl = document.getElementById('treeSoilCount');
    if (treeSoilCountEl) treeSoilCountEl.textContent = `${treeSoil} / 75`;
    
    const farmCost = calculateUpgradeCost(farmSoil);
    const farmUpgradeBtn = document.getElementById('farmUpgradeBtn');
    if (farmUpgradeBtn) farmUpgradeBtn.textContent = farmSoil < 75 ? `Upgrade Farm (${farmCost} FGM)` : 'Max Level';

    const treeCost = calculateUpgradeCost(treeSoil);
    const treeUpgradeBtn = document.getElementById('treeUpgradeBtn');
    if (treeUpgradeBtn) treeUpgradeBtn.textContent = treeSoil < 75 ? `Upgrade Tree Farm (${treeCost} FGM)` : 'Max Level';

    // Plot Redraw (Only if plots are not handled by createPlots)
    // 🛑 اہم: اگر پلاٹ کی تعداد بدلتی ہے تو ریڈرا کریں
    if (farmDiv && farmDiv.children.length !== farmPlots.length) {
         createPlots(farmDiv, farmPlots, 'farm');
    }
    if (treeDiv && treeDiv.children.length !== treePlots.length) {
         createPlots(treeDiv, treePlots, 'tree');
    }
    
    updateInventoryUI(); // Inventory UI کو بھی اپ ڈیٹ کریں
    updateToolSelectionUI(); // ٹول سلیکشن ہائی لائٹ کو اپ ڈیٹ کریں
    
    // 🛑 نئی تبدیلی: شاپ میں فصلوں کی مقدار کو اپ ڈیٹ کریں
    updateSellCounts(); 
}

// -------------------------------------------------------------

// ==========================================================
// UPDATED: updateToolSelectionUI() 
// (Includes Hand tool, Highlight, and Uses Display)
// ==========================================================
// 🛑 نوٹ: یقینی بنائیں کہ MAX_NORMAL_USES (25) اور MAX_NFT_USES (800) پہلے سے سیٹ ہیں۔
function updateToolSelectionUI() {
    // 'hand' کو بھی شامل کریں تاکہ اسے بھی منتخب ٹول کے طور پر دکھایا جا سکے
    const tools = ['hand', 'scissors', 'wateringCan', 'axe'];
    const displayEl = document.getElementById('currentToolDisplay');
    
    // 1. ٹولز کو ہائی لائٹ کریں
    tools.forEach(tool => {
        const btn = document.getElementById(`${tool}Btn`);
        if (btn) {
            btn.classList.remove('selected');
            if (selectedTool === tool) {
                btn.classList.add('selected');
            }
        }
    });
    
    // 2. موجودہ ٹول ڈسپلے کو اپ ڈیٹ کریں (Uses Count کے ساتھ)
    if (displayEl) {
        let toolName = selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1);
        let icon = '';
        let usesDisplay = '';
        
        if (selectedTool !== 'hand') {
            // استعمال اور لیمٹ کا حساب لگائیں
            const isNFT = nftTools[selectedTool];
            const currentUses = isNFT ? (nftToolUses[selectedTool] || 0) : (normalToolUses[selectedTool] || 0);
            const maxUses = isNFT ? MAX_NFT_USES : MAX_NORMAL_USES;

            // اسٹیٹس دکھائیں
            if (currentUses <= 0) {
                 usesDisplay = ' (Broken 💔)';
            } else {
                 usesDisplay = ` (${currentUses} / ${maxUses})`;
            }
            
            // آئیکن سیٹ کریں
            icon = (selectedTool === 'scissors' ? '✂️' : 
                    selectedTool === 'wateringCan' ? '💧' : 
                    selectedTool === 'axe' ? '🪓' : '🖐️'); // fallback icon
        } else {
            // 'Hand' ٹول کے لیے
            icon = '🖐️';
            usesDisplay = ' (Unlimited)';
        }
        
        displayEl.innerHTML = `${toolName} ${icon} ${usesDisplay}`;
    }
}


function createFlyingItem(icon, targetElement, amount = 1) {
    if (!targetElement) return;

    // 1. عنصر بنائیں
    const flyer = document.createElement('div');
    flyer.textContent = `+${amount} ${icon}`;
    flyer.className = 'flying-item';

    // 2. 🛑 اہم: پوزیشننگ سیٹ کریں
    flyer.style.position = 'absolute'; 
    flyer.style.left = '50%'; // ہوریزونٹل مرکز پر سیٹ کریں
    flyer.style.top = '50%';  // ورٹیکل مرکز سے شروع کریں (پلاٹ کے بیچ میں)
    
    // transform کے ذریعے اس کو تھوڑا اوپر کھینچیں اور ہوریزونٹل مرکز پر لائیں
    flyer.style.transform = 'translate(-50%, -50%)'; 
    flyer.style.zIndex = 1000; 
    
    // 3. flyer کو plot کے اندر شامل کریں
    targetElement.appendChild(flyer); 
    
    // 4. اینیمیشن ٹرگر کریں (جو اسے اوپر کی طرف لے جائے گا)
    flyer.style.animation = 'flyUp 1.5s ease-out forwards';

    // 5. اینیمیشن کے بعد عنصر کو ہٹا دیں
    setTimeout(() => {
        flyer.remove();
    }, 1500); 
}
// ==========================================================
// NEW: SOUND EFFECTS LOGIC
// ==========================================================
function playSound(soundId) {
    const sound = document.getElementById(soundId);
    if (sound) {
        // اگر آواز پہلے سے چل رہی ہے، تو اسے دوبارہ شروع کریں تاکہ ہر کلک پر آواز آئے
        sound.currentTime = 0; 
        sound.play().catch(error => {
            // اکثر براؤزر آٹو پلے کو روکتے ہیں، اس ایرر کو نظر انداز کیا جا سکتا ہے
            console.log(`Sound playback failed for ${soundId}:`, error);
        });
    }
}
// ==========================================================
// NEW: CUSTOM ALERT WITH SOUND
// ==========================================================
function showErrorAlert(message) {
    // 🔊 'soundAlert' چلائیں (فرض کریں آپ نے alert.mp3 کو شامل کر لیا ہے)
    playSound('soundAlert'); 
    
    // پھر الرٹ دکھائیں
    alert(message);
    
    // چونکہ یہ فنکشن return alert(...) کی جگہ استعمال ہوگا،
    // اس لیے یہ خود بخود کال کرنے والے فنکشن کو واپس (return) نہیں کرے گا،
    // لیکن یہ الرٹ دکھا دے گا۔
}
// ==========================================================
// 10. SHOP UI UPDATE LOGIC (NEW)
// ==========================================================
function updateSellCounts() {
    // 1. گندم (Wheat) کی مقدار کو اپ ڈیٹ کریں
    const wheatCountEl = document.getElementById('cropWheatCount');
    if (wheatCountEl) {
        wheatCountEl.textContent = crops.wheat || 0;
    }

    // 2. مکئی (Corn) کی مقدار کو اپ ڈیٹ کریں
    const cornCountEl = document.getElementById('cropCornCount');
    if (cornCountEl) {
        cornCountEl.textContent = crops.corn || 0;
    }

    // 3. لکڑی (Wood) کی مقدار کو اپ ڈیٹ کریں
    const woodCountEl = document.getElementById('cropWoodCount');
    if (woodCountEl) {
        woodCountEl.textContent = crops.wood || 0;
    }
}

// ==========================================================
// UPDATED: updateInventoryUI()
// ==========================================================

// 🛑 اہم: یہ کانسٹینٹس (Constants) بھی اپنی game.js فائل میں سب سے اوپر شامل کریں
const MAX_NORMAL_USES = 25; 
const MAX_NFT_USES = 800; 

function updateInventoryUI() {
    const inventoryTableBody = document.getElementById('inventoryTableBody');
    const toolTableBody = document.getElementById('toolTableBody');

    if (!inventoryTableBody || !toolTableBody) return;

    // --- 1. ITEMS (Seeds & Crops) ---
    inventoryTableBody.innerHTML = '';
    const allItems = ['wheat', 'corn', 'tree', 'wood'];
    
    for (const item of allItems) {
        const seedCount = item === 'wood' ? 'N/A' : `${seeds[item] || 0} 🌱`;
        const cropCount = (item === 'tree') ? (crops['wood'] || 0) : (crops[item] || 0);
        const cropUnit = (item === 'wood' || item === 'tree') ? '🪵' : '📦';
        const itemName = item.charAt(0).toUpperCase() + item.slice(1);
        
        const newRow = `
            <tr>
                <td>${itemName}</td>
                <td>${seedCount}</td>
                <td>${cropCount} ${cropUnit}</td>
            </tr>
        `;
        inventoryTableBody.innerHTML += newRow;
    }

    // --- 2. TOOLS ---
    toolTableBody.innerHTML = '';
    const allTools = ['wateringCan', 'scissors', 'axe'];
    
    for (const toolType of allTools) {
        const toolName = toolType.charAt(0).toUpperCase() + toolType.slice(1);
        
        // نارمل ٹول سٹیٹس (25 uses)
        const normalUses = normalToolUses[toolType] || 0;
        const normalStatus = (normalTools[toolType] && normalUses > 0)
            ? `${normalUses} / ${MAX_NORMAL_USES}` 
            : ((normalTools[toolType] && normalUses === 0) ? 'Broken' : 'Not Owned');
        
        // NFT ٹول سٹیٹس (800 uses)
        let nftStatus = 'Not Owned';
        if (nftTools[toolType]) {
            const nftUses = nftToolUses[toolType] || 0;
            
            if (nftUses > 0) {
                 nftStatus = `${nftUses} / ${MAX_NFT_USES}`;
            } else {
                 nftStatus = 'Broken';
            }
        }
        
        const newRow = `
            <tr>
                <td>${toolName}</td>
                <td>${normalStatus}</td>
                <td>${nftStatus}</td>
            </tr>
        `;
        toolTableBody.innerHTML += newRow;
    }
}

function toggleMenu() {
    const menu = document.getElementById('menuDropdown');
    
    if (menu) {
        if (menu.style.display === 'none') {
            menu.style.display = 'block';
        } else {
            menu.style.display = 'none';
        }
    }
}
function toggleInventory() {
    const inventory = document.getElementById('inventoryPopup');
    if (inventory) {
        inventory.style.display = inventory.style.display === 'none' ? 'block' : 'none';
        if (inventory.style.display === 'block') {
            updateInventoryUI(); 
        }
    }
}
function toggleShop() {
    alert("Shop functionality is not yet fully implemented."); 
}
function toggleLeaderboard() {
    alert("Leaderboard functionality is not yet fully implemented."); 
}


function saveGame() {
    const gameState = {
        coins, fgm, selectedSeed, farmSoil, treeSoil, 
        farmPlots, treePlots, seeds, crops, 
        normalTools, nftTools, normalToolUses, nftToolUses, 
        rewards, lastClaimTimes, progress
    };
    localStorage.setItem('farmGameMoneySave', JSON.stringify(gameState));
}

function loadGame() {
    const savedData = localStorage.getItem('farmGameMoneySave');
    if (savedData) {
        const gameState = JSON.parse(savedData);
        coins = gameState.coins || 0;
        fgm = gameState.fgm || 0;
        selectedSeed = gameState.selectedSeed || 'wheat';
        farmSoil = gameState.farmSoil || 6;
        treeSoil = gameState.treeSoil || 6;
        farmPlots = gameState.farmPlots || [];
        treePlots = gameState.treePlots || [];
        seeds = gameState.seeds || { wheat: 10, corn: 5, tree: 0 };
        crops = gameState.crops || { wheat: 0, corn: 0, wood: 0 };
        normalTools = gameState.normalTools || { wateringCan: 1, scissors: 1, axe: 1 };
        nftTools = gameState.nftTools || { wateringCan: false, scissors: false, axe: false };
        normalToolUses = gameState.normalToolUses || { wateringCan: 3, scissors: 3, axe: 3 };
        nftToolUses = gameState.nftToolUses || { wateringCan: 0, scissors: 0, axe: 0 };
        rewards = gameState.rewards || {daily: { claimed: false, reward: 10, targetCrop: 10, targetTree: 5, crop: 0, tree: 0 }, weekly: { claimed: false, reward: 50, targetCrop: 50, targetTree: 20, crop: 0, tree: 0 }};
        lastClaimTimes = gameState.lastClaimTimes || { daily: 0, weekly: 0 };
        progress = gameState.progress || { cropsHarvested: 0, treesChopped: 0 };
        
        // 🛑 setInterval کو یہاں سے ہٹا دیا گیا ہے
        
        // 🛑 اہم: آٹو پلے کی کوشش کو ہٹا دیا گیا ہے۔
        
        // 🏁 نئے پیج پر میوزک کی حالت چیک کر کے اسے دوبارہ چلائیں
        checkAndResumeMusic(); 
        
        return true;
    }
    
    // اگر سیو ڈیٹا نہیں ہے، تو بھی میوزک کی حالت چیک کریں
    checkAndResumeMusic();
    
    return false;
}

// ==========================================================
// NEW: FUNCTION TO RESUME MUSIC ON NEW PAGE LOAD
// ==========================================================

function checkAndResumeMusic() {
    const state = localStorage.getItem('gameMusicState');
    const backgroundMusic = document.getElementById('soundMusic');
    const musicBtn = document.getElementById('musicBtn');

    if (state === 'ON' && backgroundMusic) {
        // پچھلے پیج پر ON تھا، اس لیے یہاں بھی چلائیں
        backgroundMusic.volume = 0.3;
        backgroundMusic.play().catch(e => {
            // آٹو پلے کی کوشش، یوزر کلک کا انتظار کر سکتا ہے
            console.log("Attempted to resume music.");
        });
        
        // UI اسٹیٹ کو اپ ڈیٹ کریں
        if (musicBtn) musicBtn.textContent = '🔊 Music ON';
        isMusicPlaying = true;
    } else if (musicBtn) {
        // اگر آف تھا یا پہلی بار ہے
        musicBtn.textContent = '🎵 Music OFF';
        isMusicPlaying = false;
    }
}
    let bgmAudio = null; 
let isMusicPlaying = false;
let bgmSource = 'sounds/farm_bgm.mp3'; // یہاں آپ کی BG Muzik File کا نام ڈالیں

function toggleMusic() {
    if (bgmAudio === null) {
        // 1. پہلی بار، آڈیو آبجیکٹ بنائیں (یوزر کے کلک کے بعد)
        bgmAudio = new Audio(bgmSource); 
        bgmAudio.loop = true;
    }
    
    if (isMusicPlaying) {
        bgmAudio.pause();
        isMusicPlaying = false;
        // آپ یہاں بٹن کا ٹیکسٹ یا آئیکن بدل سکتے ہیں
        console.log("Music Paused.");
    } else {
        // 2. یوزر کے کلک پر میوزک چلائیں (براؤزر کی اجازت سے)
        bgmAudio.play().catch(error => {
            console.error("Music playback failed (Autoplay Blocked):", error);
            // یہ alert صرف اس صورت میں آئے گا جب کوئی نایاب ایرر ہو
            alert("Music cannot be played. Check console for details.");
        });
        isMusicPlaying = true;
        // آپ یہاں بٹن کا ٹیکسٹ یا آئیکن بدل سکتے ہیں
        console.log("Music Playing.");
    }
}} else if (musicBtn) {
        // اگر آف تھا یا پہلی بار ہے
        musicBtn.textContent = '🎵 Music OFF';
        isMusicPlaying = false;
    }
}


// ==========================================================
// 4. PLOT CREATION & INITIALIZATION
// ==========================================================
function initializePlots() {
    if (farmPlots.length === 0) {
        for (let i = 0; i < farmSoil; i++) {
            farmPlots.push({
                hasSoil: true,
                stage: 0,
                ready: false,
                isGrowing: false,
                isTree: false,
                cropType: null, 
                readyTime: 0
            });
        }
    }

    if (treePlots.length === 0) {  
        for (let i = 0; i < treeSoil; i++) {   
            treePlots.push({   
                hasSoil: true,
                stage: 0,   
                ready: false,   
                isGrowing: false,   
                chops: 0,   
                isTree: true,
                readyTime: 0
            });  
        }  
    }
}
// NEW: Planting handler to force UI update immediately
function handlePlanting(index, type) {
    let success = false;
    
    if (type === 'farm') {
        // یہ آپ کے موجودہ plantFarmSeed فنکشن کو کال کرے گا
        plantFarmSeed(index); 
        success = true; 
    } else {
        // یہ آپ کے موجودہ plantTreeSeed فنکشن کو کال کرے گا
        plantTreeSeed(index);
        success = true; 
    }
    
    if (success) {
        // 🛑 اہم: یہ وہ لائن ہے جو تبدیلی کو فوراً دکھائے گی
        updateUI(); 
    }
}
function createPlots(container, plots, type) {
    if (typeof selectedTool === 'undefined') {
        console.error("Error: selectedTool variable is not defined globally.");
        return; 
    }
    
    if (!container) return;

    container.innerHTML = '';   

    plots.forEach((plot, index) => {  
        if (!plot) return;
        
        const plotEl = document.createElement('div');  
        plotEl.classList.add('plot');  
        plotEl.id = `${type}Plot_${index}`;  

        // 1. Ready State
        if (plot.ready && !plot.isGrowing) {   
            
            let readyIcon;  
            let action;  

            if (type === 'farm') {  
                readyIcon = (plot.cropType === "wheat" ? "🌾" : "🌽");   
                action = () => harvestFarm(index);   
            } else {  
                readyIcon = "🌲";   
                action = () => harvestTree(index);  
            }  
                  
            plotEl.textContent = readyIcon;  
            plotEl.onclick = action;  

        }   
          
        // 2. Growing/Needs Water State
        else if (plot.isGrowing || plot.needsWater) { 
              
            let currentIcon;
            
            if (type === 'farm') {  
                currentIcon = (plot.cropType === "wheat" ? "🌱" : "🌿"); 
            } else {  
                currentIcon = (plot.chops > 0 ? "🎋" : "🌱");
            }
            
            // 🛑 کلک لاجک: Watering Can کا استعمال یا الرٹ
            plotEl.onclick = () => {
                
                if (type === 'farm' && selectedTool === 'wateringCan') {
                    useWateringCan(index); 
                } 
                else if (type === 'farm' && plot.needsWater) {
                    alert("This crop needs water! Please select the Watering Can 💧 to start growth.");
                }
                else {
                    const timeLeft = formatTime(plot.readyTime - Date.now());
                    alert(`Crop is growing! Time remaining: ${timeLeft}`);
                }
            };
              
            plotEl.textContent = currentIcon;
              
            // 🛑 اہم: ٹائمر عنصر صرف تب شامل کریں جب پودا بڑھ رہا ہو اور پانی نہ مانگ رہا ہو
            if (type === 'farm' && plot.isGrowing && !plot.needsWater) {
                 const timerEl = document.createElement('div');  
                 timerEl.className = 'timer';  
                 timerEl.id = `${type}Timer_${index}`;   
                 timerEl.textContent = "..."; 
                 plotEl.appendChild(timerEl);
            }
            // Tree Plots کے لیے بھی یہی کریں
            else if (type === 'tree' && plot.isGrowing) {
                 const timerEl = document.createElement('div');  
                 timerEl.className = 'timer';  
                 timerEl.id = `${type}Timer_${index}`;   
                 timerEl.textContent = "..."; 
                 plotEl.appendChild(timerEl);
            }

        }   
          
        // 3. Empty State
        else {   
            plotEl.textContent = ' 🟫'; 
            
            plotEl.onclick = () => {
                if (selectedTool === 'hand') {
                    if (type === 'farm') {
                        // 🛑 اب یہ نیا ہینڈلر کال ہوگا جو UI کو اپ ڈیٹ کرے گا
                        handlePlanting(index, type); 
                    } else {
                        handlePlanting(index, type);
                    }
                } else {
                    alert(`You must select your Hand to plant seeds! Current tool: ${selectedTool}`);
                }
            };
        } 

        
        container.appendChild(plotEl);  
    });
}
        
// ==========================================================
// 5. CORE GAME LOGIC
// ==========================================================
function selectSeed(seedType) {
    selectedSeed = seedType;
    updateUI();
}
function selectTool(toolName) {
    if (selectedTool === toolName) {
        selectedTool = 'hand';
    } else {
        selectedTool = toolName;
    }
    
    updateToolDisplay();
    updateToolSelectionUI(); 
    updateUI(); 
}
function updateToolDisplay() {
    const toolDisplay = document.getElementById('currentToolDisplay');
    if (!toolDisplay) return;

    let displayIcon = '';
    let displ        // 3. Empty State
        else {   
            plotEl.textContent = ' 🟫'; 
            
            plotEl.onclick = () => {
                if (selectedTool === 'hand') {
                    if (type === 'farm') {
                        // 🛑 اب یہ نیا ہینڈلر کال ہوگا جو UI کو اپ ڈیٹ کرے گا
                        handlePlanting(index, type); 
                    } else {
                        handlePlanting(index, type);
                    }
                } else {
                    alert(`You must select your Hand to plant seeds! Current tool: ${selectedTool}`);
                }
            };
        } 
ayName = selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1);

    switch (selectedTool) {
        case 'hand':
            displayIcon = '🖐️';
            break;
        case 'scissors':
            displayIcon = '✂️';
            break;
        case 'wateringCan':
            displayIcon = '💧';
            break;
        case 'axe':
            displayIcon = '🪓';
            break;
        default:
            displayIcon = '❓';
            displayName = 'Unknown';
    }
    
    toolDisplay.innerHTML = `${displayName} ${displayIcon}`;
}
function useWateringCan(index) {
    const plot = farmPlots[index];
    
    // 1. غلطی چیک کریں اور ساؤنڈ کے ساتھ الرٹ دکھائیں
    if (!plot || plot.ready || !plot.hasSoil) {
        return showErrorAlert("Watering Can can only be used on a growing or newly planted crop.");
    }
    
    if (plot.isGrowing && !plot.needsWater) {
        return showErrorAlert("This crop is already growing and does not need water right now.");
    }
    
    if (selectedTool !== 'wateringCan') {
        // یہ چیک بھی لازمی ہے، اگرچہ اسے عام طور پر event handler میں check ہونا چاہیے
        return showErrorAlert("You must select the Watering Can 💧 to water your crops!");
    }

    const isNFT = nftTools.wateringCan;
    const toolResult = consumeTool('wateringCan', isNFT); 
    
    if (!toolResult.success) {
        return showErrorAlert(toolResult.message);
    }

    // 🔊 اہم: پانی دینے کی آواز کامیابی پر
    playSound('soundWatering'); 

    // 4. لاجک: پودے کو پانی دیں اور ٹائمر شروع کریں
    if (plot.needsWater) {
        plot.needsWater = false; 
        plot.isGrowing = true;  
        plot.ready = false;     
        
        // 🛑 CROP_TIMES اب سیکنڈز میں ہے، لہذا * 1000 درست ہے
        const cropTime = plot.cropType === 'wheat' ? WHEAT_GROW_TIME : CORN_GROW_TIME;
        plot.readyTime = Date.now() + (cropTime * 1000); 
        
    } else {
        // اگر غلطی کے تمام چیکس گزر گئے ہیں لیکن پھر بھی needsWater false ہے، 
        // تو یہاں کوئی کارروائی نہیں کریں گے۔
    }

    updateUI(); 
    saveGame();
}
// ==========================================================
// NEW: FGM TO COINS EXCHANGE LOGIC
// ==========================================================
function exchangeFGMForCoins() {
    const rate = 100; // 1 FGM = 100 Coins
    
    // چونکہ prompt ایک بلٹ ان فنکشن ہے، یہ showErrorAlert کو سپورٹ نہیں کرتا۔
    // اگر یوزر 'Cancel' کرے یا غلط ان پٹ دے تو ہم اسے ہینڈل کریں گے۔
    const input = prompt("Enter amount of FGM 💎 to exchange for Coins 💰:", 1);
    
    // اگر یوزر نے کینسل کر دیا ہو تو
    if (input === null || input.trim() === "") {
        return; 
    }
    
    const exchangeAmount = parseInt(input);

    if (exchangeAmount > 0) {
        if (fgm >= exchangeAmount) {
            
            fgm -= exchangeAmount;
            const earnedCoins = exchangeAmount * rate;
            coins += earnedCoins;
            
            // 🔊 کامیابی کی آواز
            playSound('soundCoin'); 
            
            // اب کامیابی کا الرٹ دکھائیں
            alert(`${exchangeAmount} FGM 💎 exchanged successfully for ${earnedCoins} Coins 💰!`);
            
            updateUI();
            saveGame();
            
        } else {
            // 🛑 ناکامی پر: showErrorAlert استعمال کیا
            return showErrorAlert(`Not enough FGM 💎! You only have ${fgm}.`);
        }
    } else {
        // 🛑 ناکامی پر: showErrorAlert استعمال کیا
        return showErrorAlert("Please enter a valid amount greater than 0.");
    }
}
function upgradeFarm() {
    const cost = Number(calculateUpgradeCost(farmSoil));
    if (isNaN(cost)) return showErrorAlert('Error: Invalid upgrade cost!'); // 🛑 showErrorAlert استعمال کیا

    if (farmSoil >= 75) {  
        showErrorAlert('Farm is already at max level.'); // 🛑 showErrorAlert استعمال کیا
        return;  
    }  

    if (fgm >= cost) {  
        fgm -= cost;  
        const oldSoil = farmSoil; 
        farmSoil += 2;  
        
        // 🔊 کامیابی کی آواز
        playSound('soundUpgrade'); 
        
        alert('Farm upgraded! You now have ' + farmSoil + ' soil plots.');  

        for (let i = oldSoil; i < farmSoil; i++) {
            farmPlots.push({
                hasSoil: true,
                stage: 0,
                ready: false,
                isGrowing: false,
                isTree: false,
                cropType: null, 
                readyTime: 0
            });
        }
        
        const container = document.getElementById('farmDiv'); 
        if (container && farmPlots) createPlots(container, farmPlots, 'farm');  

    } else {  
        // 🛑 غلطی پر ساؤنڈ کے ساتھ الرٹ
        showErrorAlert(`Not enough FGM 💎 to upgrade the farm (need ${cost} FGM).`);  
    }  

    updateUI();  
    saveGame();
}
function upgradeTreeFarm() {
    const cost = Number(calculateUpgradeCost(treeSoil));
    
    if (isNaN(cost)) {
        return showErrorAlert('Error: Invalid upgrade cost!'); // 🛑 showErrorAlert استعمال کیا
    }

    if (treeSoil >= 75) {  
        showErrorAlert('Tree Farm is already at max level.'); // 🛑 showErrorAlert استعمال کیا
        return;  
    }  

    if (fgm >= cost) {  
        fgm -= cost;  
        const oldSoil = treeSoil; 
        treeSoil += 2;  
        
        // 🔊 کامیابی کی آواز
        playSound('soundUpgrade'); 
        
        alert('Tree Farm upgraded! You now have ' + treeSoil + ' tree plots.');  

        for (let i = oldSoil; i < treeSoil; i++) {
            treePlots.push({   
                hasSoil: true,
                stage: 0,   
                ready: false,   
                isGrowing: false,   
                chops: 0,   
                isTree: true,
                readyTime: 0
            }); 
        }
        
        const container = document.getElementById('treeDiv'); 
        if (container && treePlots) createPlots(container, treePlots, 'tree');  

    } else {  
        // 🛑 غلطی پر ساؤنڈ کے ساتھ الرٹ
        showErrorAlert(`Not enough FGM 💎 to upgrade the tree farm (need ${cost} FGM).`);  
    }  

    updateUI();  
    saveGame();
}
// ==========================================================
// 6. TOOL & SHOP LOGIC
// ==========================================================
function showQuantityPopup(itemType, actionType) {
    let promptMessage = `Enter quantity of ${itemType} to `; 
    let actionFunction;

    if (actionType === 'buy') {  
        promptMessage += 'buy:';  
        actionFunction = buySeeds;  
    } else if (actionType === 'buyTool') {  
        promptMessage += 'buy:';  
        actionFunction = buyTools;  
    } else if (actionType === 'sellCoins') {  
        promptMessage += 'sell for COINS:';  
        actionFunction = (item, qty) => sellCrops(item, 'coins', qty);  
    } else if (actionType === 'sellFGM') {  
        promptMessage += 'sell for FGM:';  
        actionFunction = (item, qty) => sellCrops(item, 'fgm', qty);  
    } else {  
        return; 
    }  

    const quantity = prompt(promptMessage);  

    if (quantity && !isNaN(quantity) && parseInt(quantity) > 0) {  
        const qty = parseInt(quantity);  
        actionFunction(itemType, qty);  
    } else if (quantity !== null) {  
        alert("Please enter a valid number greater than 0.");  
    }
}

function buyTools(toolType, quantity) {
    const qty = quantity;
    if (!qty || qty <= 0) return alert("Please enter a valid quantity greater than 0.");  
      
    const costPerTool = 50; 
    const toolName = toolType === "wateringCan" ? "Watering Can 💧" :  
                     toolType === "scissors" ? "Scissors ✂️" :  
                     toolType === "axe" ? "Axe 🪓" : toolType;  

    const totalCost = costPerTool * qty;  

    if (coins < totalCost) {  
        return alert(`Not enough 💰 Coins! You need ${totalCost - coins} more to buy ${qty} ${toolName}(s).`);  
    }  

    coins -= totalCost;  
      
    for (let i = 0; i < qty; i++) {  
        normalTools[toolType] = (normalTools[toolType] || 0) + 1;  
    }  
      
    alert(`You bought ${qty} ${toolName}(s) for ${totalCost} 💰 Coins!`);  
      
    updateUI();
    saveGame(); 
}

function buySeeds(seedType, quantity) {
    
    // 🛑 گندم کے بیج کی قیمت کو 5 کوئنز پر سیٹ کیا گیا ہے
    let costPerSeed;
    if (seedType === 'wheat') {
        costPerSeed = 5; 
    } else {
        // پہلے والی ڈیفالٹ قیمت 10 کوئنز (مکئی اور درخت کے لیے)
        costPerSeed = 10; 
    }
    
    const totalCost = costPerSeed * quantity;
    
    if (coins < totalCost) {
        return alert(`Not enough coins! Need ${totalCost}.`);
    }
    
    coins -= totalCost;
    seeds[seedType] = (seeds[seedType] || 0) + quantity;
    alert(`Bought ${quantity} ${seedType} seeds for ${totalCost} Coins.`);
    updateUI();
    saveGame();
}
function sellCrops(itemType, currencyType, quantity) {
    
    // ... (Rates اور Checking لاجک) ...
    const rates = {
        wheat: { coins: 10, fgm: 0.01 }, 
        corn:  { coins: 18, fgm: 0.02 }, 
        wood:  { coins: 5,  fgm: 0.005 } 
    };
    
    const itemRate = rates[itemType];
    
    // 1. نامعلوم آئٹم کی غلطی پر
    if (!itemRate) {
        return showErrorAlert(`Error: Cannot sell unknown item type: ${itemType}`); // 🛑 showErrorAlert استعمال کیا
    }

    // 2. ناکافی انوینٹری کی غلطی پر
    if ((crops[itemType] || 0) < quantity) {
        return showErrorAlert(`You don't have ${quantity} ${itemType} to sell.`); // 🛑 showErrorAlert استعمال کیا
    }

    crops[itemType] -= quantity;
    
    const displayName = itemType.charAt(0).toUpperCase() + itemType.slice(1);
    const targetEl = currencyType === 'coins' ? document.getElementById('coinsEl') : document.getElementById('fgmEl');
    
    // 3. Coins میں فروخت (کامیابی)
    if (currencyType === 'coins') {
        const earnings = quantity * itemRate.coins;
        coins += earnings;
        
        // 🔊 کامیابی کی آواز پہلے آئے گی
        playSound('soundCoin'); 
        
        // اب کامیابی کا الرٹ دکھائیں
        alert(`Sold ${quantity} ${displayName}(s) for ${earnings} Coins.`); 
        
        if (targetEl) createFlyingItem('💰', targetEl, earnings);
        
    // 4. FGM میں فروخت (کامیابی)
    } else if (currencyType === 'fgm') {
        const earnings = quantity * itemRate.fgm;
        fgm += earnings;

        // 🔊 کامیابی کی آواز پہلے آئے گی
        playSound('soundCoin'); 
        
        // اب کامیابی کا الرٹ دکھائیں
        alert(`Sold ${quantity} ${displayName}(s) for ${earnings.toFixed(3)} FGM.`);
        
        if (targetEl) createFlyingItem('💎', targetEl, earnings.toFixed(2));
    }
    
    updateUI();
    saveGame();
}

function buyNFT(type) {
    const cost = 5; 
    const initialUses = 800; 

    if (nftTools[type]) return alert('You already own this NFT!');
    
    if (fgm < cost) return alert(`Not enough FGM 💎! You need ${cost} FGM to buy this NFT.`);
      
    fgm -= cost;  
    nftTools[type] = true;  
    nftToolUses[type] = initialUses; 
    
    alert(`NFT purchased! You now have the ${type} NFT with ${initialUses} uses.`);  
    updateUI();
    saveGame();
}
// ==========================================================
// 7. HARVEST & PLANT 
// ==========================================================
function plantFarmSeed(index) {
    if (selectedTool !== 'hand') {
        // 🛑 showErrorAlert استعمال کیا
        return showErrorAlert("You must select your Hand to plant seeds!");
    }

    if (!selectedSeed) { 
        // 🛑 showErrorAlert استعمال کیا
        return showErrorAlert("Please select a seed first.");
    }
    const seedType = selectedSeed;

    if ((seeds[seedType] || 0) < 1) { 
        // 🛑 showErrorAlert استعمال کیا
        return showErrorAlert(`You need more ${seedType} seeds to plant this.`);
    }

    seeds[seedType]--;
    
    // 🔊 کامیابی کی آواز
    playSound('soundSeedPlant'); // فرض کریں آپ نے soundSeedPlant کو سیٹ کیا ہے

    farmPlots[index] = {
        hasSoil: true,
        stage: 1, 
        ready: false,
        isGrowing: false,      
        needsWater: true,      
        isTree: false,
        cropType: seedType, 
        readyTime: 0           
    };

    updateUI();
    saveGame();
}
function harvestFarm(index) {
    const plot = farmPlots[index];
    
    // 1. تیار ہے یا نہیں؟
    if (!plot || !plot.ready) { 
        return showErrorAlert("This plot is not ready to be harvested!"); // 🛑 showErrorAlert استعمال کیا
    }

    // 2. ٹول چیک اور واضح الرٹ
    if (selectedTool !== 'scissors') {
        return showErrorAlert("This crop is ready! You must select Scissors ✂️ to harvest this crop!"); // 🛑 showErrorAlert استعمال کیا
    }
    
    // 3. ٹول استعمال کریں
    const toolResult = consumeTool('scissors', nftTools.scissors);

    if (!toolResult.success) {
        return showErrorAlert(toolResult.message); // 🛑 showErrorAlert استعمال کیا
    }
    
    // 🔊 کامیابی کی آواز (آپ نے پہلے ہی شامل کر دی تھی)
    playSound('soundHarvest'); 
    
    let cropType = plot.cropType;
    let icon = cropType === 'wheat' ? '🌾' : '🌽'; 
    
    crops[cropType] = (crops[cropType] || 0) + 1; 
    progress.cropsHarvested++; 
    
    // اینیمیشن کال:
    const plotElement = document.getElementById(`farmPlot_${index}`);
    if (plotElement) createFlyingItem(icon, plotElement, 1);
    
    // پلاٹ کو صاف کریں 
    farmPlots[index] = { hasSoil: true, stage: 0, ready: false, isGrowing: false, isTree: false, cropType: null, readyTime: 0 };

    updateUI();
    saveGame();
}

function plantTreeSeed(index) {
    if (selectedTool !== 'hand') {
        // 🛑 showErrorAlert استعمال کیا
        return showErrorAlert("You must select your Hand to plant seeds!");
    }
    const seedType = 'tree';
    
    if ((seeds[seedType] || 0) <= 0) {
        // 🛑 showErrorAlert استعمال کیا
        return showErrorAlert(`You need more ${seedType} seeds!`);
    }

    seeds[seedType]--;
    
    // 🔊 کامیابی کی آواز
    playSound('soundSeedPlant'); // یا اگر آپ Tree planting کے لیے الگ ساؤنڈ چاہتے ہیں

    treePlots[index].isGrowing = true;
    treePlots[index].isTree = true;
    treePlots[index].stage = 1; 
    
    // 🛑 TREE_GROW_TIME کو سیکنڈز میں سیٹ کیا گیا ہے
    treePlots[index].readyTime = Date.now() + (TREE_GROW_TIME * 1000);
    
    updateUI();
    saveGame();
}
function harvestTree(i) {
    const plot = treePlots[i];
    
    // 1. تیار ہے یا نہیں؟
    if (!plot.ready) { 
        return showErrorAlert("Tree is still regrowing! Wait for it to grow back."); // 🛑 showErrorAlert استعمال کیا
    }
    
    // 2. ٹول چیک کریں
    if (selectedTool !== 'axe') { 
        return showErrorAlert("You must select Axe 🪓 to chop this tree!"); // 🛑 showErrorAlert استعمال کیا
    }
    
    // 3. ٹول استعمال کریں
    const toolResult = consumeTool('axe', nftTools.axe);  
    if (!toolResult.success) {
        return showErrorAlert(toolResult.message); // 🛑 showErrorAlert استعمال کیا
    }
    
    // 🔊 کامیابی کی آواز (آپ نے پہلے ہی شامل کر دی تھی)
    playSound('soundChop'); 

    plot.chops++;  
    crops.wood += 1;  
    progress.treesChopped++;   
    
    const plotElement = document.getElementById(`treePlot_${i}`);
    if (plotElement) createFlyingItem('🪵', plotElement, 1);
    
    // Regrowing لاجک
    if (plot.chops >= TREE_CHOP_COUNT) { 
        plot.ready = false; plot.isGrowing = false; plot.stage = 0; plot.chops = 0; plot.readyTime = 0;
    } else {  
        plot.ready = false; plot.isGrowing = true; plot.readyTime = Date.now() + (TREE_GROW_TIME * 1000); plot.stage = 1;           
    }  
      
    saveGame();  
    updateUI();
}
// ==========================================================
// 8. FGM & EXCHANGE LOGIC
// ==========================================================
function depositFGM() {
    if (!walletConnected) return alert("Please connect your wallet first!");
    const depositAmount = parseInt(prompt("Enter amount of FGM 💎 to deposit (Simulated):", 10));
    
    if (depositAmount > 0) {
        fgm += depositAmount;
        alert(`${depositAmount} FGM 💎 deposited successfully!`); 
        
        updateUI();
        saveGame();
    }
}

function claimFGM(amount) {
    fgm += amount;   
    updateUI();   
    saveGame();   
    alert(`${amount} FGM کامیابی سے شامل کر دیے گئے ہیں! موجودہ بیلنس: ${fgm}`);
}

function claimReward(period) {
    const r = rewards[period];

    if (r.claimed) return alert("You already claimed this reward!");  
      
    if (r.crop < r.targetCrop || r.tree < r.targetTree) {  
        return alert(`You haven't completed the ${period} challenge yet!`);  
    }  

    fgm += r.reward; 
      
    r.claimed = true;  
    lastClaimTimes[period] = Date.now();  
      
    alert(`Congratulations! You claimed ${r.reward} FGM 💎 for the ${period} challenge.`);  
    updateUI();  
    saveGame();
}

// ==========================================================
// 9. TIMER & INITIALIZATION (FINAL WORKING LOGIC)
// ==========================================================

function updateTimers() {
    const now = Date.now();
    let needsRedraw = false;

    // 1. Farm Plots Timer Update   
    farmPlots.forEach((plot, i) => {  
        if (!plot) return; 

        if (plot.isGrowing && !plot.needsWater) { 
            
            const timeLeft = plot.readyTime - now;

            if (timeLeft <= 1000) { 
                
                plot.isGrowing = false;  
                plot.ready = true;  
                plot.stage = 2; 
                needsRedraw = true; 
            } 
            else {  
                // ٹائمر عنصر کو تلاش کریں (farmDiv کو گلوبلی سیٹ کیا گیا ہے)
                const el = farmDiv ? farmDiv.children[i] : null;  
                const timerEl = el ? el.querySelector('.timer') : null;  
                
                if (timerEl) {  
                    timerEl.textContent = formatTime(timeLeft);  
                }  
            }  
        }
    });  
      
    // 2. Tree Plots Timer Update 
    treePlots.forEach((plot, i) => {  
        if (!plot) return; 
        
        if (plot.isGrowing) { 
            const timeLeft = plot.readyTime - now;

            if (timeLeft <= 1000) {  
                plot.isGrowing = false;  
                plot.ready = true;  
                plot.stage = 1; 
                needsRedraw = true; 
            } else {  
                // ٹائمر عنصر کو تلاش کریں (treeDiv کو گلوبلی سیٹ کیا گیا ہے)
                const el = treeDiv ? treeDiv.children[i] : null;  
                const timerEl = el ? el.querySelector('.timer') : null;  
                if (timerEl) {  
                    timerEl.textContent = formatTime(timeLeft);  
                }  
            }  
        }
    });  
      
    if (needsRedraw) {  
        updateUI();   
        saveGame(); 
    }
}

function init() {
    // 1. Load Data
    const isLoaded = loadGame();

    // 2. Initialize Plots (Only if no data was loaded)  
    if (!isLoaded) {  
        initializePlots();  
    }  

    // 🛑 اہم: گلوبل ویری ایبلز کو DOM elements پر سیٹ کریں تاکہ updateTimers انہیں استعمال کر سکے
    farmDiv = document.getElementById('farmDiv');
    treeDiv = document.getElementById('treeDiv');

    // Farm Plots کو ڈرا کریں
    if (farmDiv) { 
        createPlots(farmDiv, farmPlots, 'farm');
    }
    
    // Tree Plots کو ڈرا کریں
    if (treeDiv) {
        createPlots(treeDiv, treePlots, 'tree');
    }
    
    // 3. Start Main Loop (Timer)  
    setInterval(updateTimers, 1000);   

    // 4. Update UI to draw the farm/tree plots and all data  
    updateUI();   
    
    // 5. Update Leaderboard (only runs on leaderboard page)  
    if (document.getElementById('leaderboardTableBody')) {  
         // updateLeaderboardUI(); // Placeholder
    }
    
    // ✅ یہ کال کو درست کریں
    updateToolSelectionUI(); 
}

// 🛑 جب HTML/DOM پوری طرح لوڈ ہو جائے تو initGame کو کال کریں
document.addEventListener('DOMContentLoaded', init);
