const STAT_DISPLAY_NAMES = {
  "Luck": "Luck",
  "Capacity": "Capacity",
  "DigSpeed": "Dig Speed",
  "DigStrength": "Dig Strength",
  "ShakeStrength": "Shake Strength",
  "ShakeSpeed": "Shake Speed",
  "SellBoost": "Sell Boost",
  "SizeBoost": "Size Boost",
  "ModBoost": "Mod Boost",
}

let ORE_REGISTRY = null;
let MODIFIER_REGISTRY = null;

let ORE_ID_MAP = null;
let MODIFIER_ID_MAP = null;

let AppState = {
  activeMuseumId: null,
  museums: {}
}

let ALL_GEM_SLOTS = [];
function discoverGemSlots() {
  const slots = document.querySelectorAll(".gem-button[data-gem]");
  ALL_GEM_SLOTS = Array.from(slots).map(button => button.getAttribute("data-gem"));
}

function switchMuseum(museumId) {
  AppState.activeMuseumId = museumId;
  saveToLocalStorage();

  document.querySelectorAll(".museum-tabs .tab").forEach(tab => {
    tab.classList.remove("is-active");
  });

  const currentTab = document.querySelector(`.museum-tabs .tab[data-id="${museumId}"]`);
  if (currentTab) {
    currentTab.classList.add("is-active");
  }

  closeEditorModal();
  refreshPedestalsOnly();
  aggregateGlobalStats();
}

function createNewMuseumData(customName) {
  const snowflakeId = `museum-${Date.now()}`;
  return {
    id: snowflakeId,
    museum: {
      name: customName,
      gems: {}
    }
  }
}

function loadFromLocalStorage() {
  const savedData = localStorage.getItem("rblx_museum_data");

  if (savedData) {
    try {
      AppState = JSON.parse(savedData);
      console.log("Welcome back! Loaded active layout ID:", AppState.activeMuseumId);
      // TODO: Popup notification instead.

      for (const museumId in AppState.museums) {
        const gemsObj = AppState.museums[museumId].gems;
        for (const slotId in gemsObj) {
          const gem = gemsObj[slotId];

          if (gem && gem.name !== "None") {
            gem.calculated = calculateSingleGemBoost(gem);
          }
        }
      }

      return;
    } catch (e) {
      console.error("Failed to load saved data:", e);
    }
  }

  const defaultMuseum = createNewMuseumData("My Museum");

  AppState.museums[defaultMuseum.id] = defaultMuseum.museum;
  AppState.activeMuseumId = defaultMuseum.id;
  saveToLocalStorage();
  console.log("Fresh user session generated with Snowflake ID:", defaultMuseum.id);
}

function saveToLocalStorage() {
  const cleanState = JSON.parse(JSON.stringify(AppState));

  for (const museumId in cleanState.museums) {
    const gemsObj = cleanState.museums[museumId].gems;
    for (const gemId in gemsObj) {
      delete gemsObj[gemId].calculated;
    }
  }

  localStorage.setItem("rblx_museum_data", JSON.stringify(cleanState));
}

function bindActionButtons() {
  const addTabButton = document.querySelector(".tab-add");
  if (addTabButton) {
    addTabButton.replaceWith(addTabButton.cloneNode(true));
    const cleanAddButton = document.querySelector(".tab-add");

    cleanAddButton.addEventListener("click", handleAddMuseum);
  }

  // *** EDIT MODAL BUTTONS ***
  const editButton = document.getElementById("edit-button");
  if (editButton) {
    editButton.replaceWith(editButton.cloneNode(true));
    const cleanEditButton = document.getElementById("edit-button");

    cleanEditButton.addEventListener("click", openMuseumSettingsModal)
  }

  const closeSettingsBtn = document.getElementById("settings-modal-close-btn");
  if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", closeMuseumSettingsModal);

  const settingsOverlay = document.getElementById("settings-modal");
  if (settingsOverlay) {
    settingsOverlay.addEventListener("click", (e) => {
      if (e.target === settingsOverlay) closeMuseumSettingsModal();
    })
  }

  const saveSettingsBtn = document.getElementById("settings-save-btn");
  if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", handleMuseumSettingsUpdate);

  const deleteMuseumBtn = document.getElementById("settings-delete-btn");
  if (deleteMuseumBtn) deleteMuseumBtn.addEventListener("click", handleMuseumDeletion)

  // *** IMPORT/EXPORT MODAL BUTTONS ***
  const shareButton = document.getElementById("share-button");
  if (shareButton) {
    shareButton.replaceWith(shareButton.cloneNode(true));
    const cleanShareButton = document.getElementById("share-button");

    cleanShareButton.addEventListener("click", openShareModal);
  }

  const closeShareBtn = document.getElementById("share-modal-close-btn");
  if (closeShareBtn) closeShareBtn.addEventListener("click", closeShareModal);

  const shareOverlay = document.getElementById("share-modal");
  if (shareOverlay) {
    shareOverlay.addEventListener("click", (e) => {
      if (e.target === shareOverlay) closeShareModal();
    })
  }

  const copyBtn = document.getElementById("share-copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const outputField = document.getElementById("share-code-output");
      if (outputField) {
        outputField.select();
        navigator.clipboard.writeText(outputField.value);

        copyBtn.innerText = "Copied!";
        setTimeout(() => {
          copyBtn.innerText = "Copy";
        }, 2000);
      }
    })
  }

  const importButton = document.getElementById("share-import-btn");
  if (importButton) {
    importButton.addEventListener("click", handleMuseumImport);
  }
}

function openMuseumSettingsModal() {
  const settingsOverlay = document.getElementById("settings-modal");
  const nameInput = document.getElementById("settings-name-input");
  if (!settingsOverlay || !nameInput) return;

  const currentMuseum = AppState.museums[AppState.activeMuseumId];
  if (!currentMuseum) return;

  nameInput.value = currentMuseum.name || "Unnamed Museum";

  settingsOverlay.classList.add("is-active");
}

function closeMuseumSettingsModal() {
  const settingsOverlay = document.getElementById("settings-modal");
  if (settingsOverlay) settingsOverlay.classList.remove("is-active");
}

function handleMuseumSettingsUpdate() {
  const nameInput = document.getElementById("settings-name-input");
  if (!nameInput) return;

  const currentMuseum = AppState.museums[AppState.activeMuseumId];
  if (!currentMuseum) return;

  const cleanName = nameInput.value.trim();
  if (cleanName !== "" || cleanName !== currentMuseum.name) {
    currentMuseum.name = cleanName;

    saveToLocalStorage();
    initTabsUI();
    refreshPedestalsOnly();
    aggregateGlobalStats();
  }

  closeMuseumSettingsModal();
}

function handleMuseumDeletion() {
  const currentMuseum = AppState.museums[AppState.activeMuseumId];
  if (!currentMuseum) return;

  const confirmFirst = confirm("Are you sure you want to delete this museum? This action cannot be undone.");
  if (!confirmFirst) return;

  delete AppState.museums[AppState.activeMuseumId];

  const remainingIds = Object.keys(AppState.museums);
  if (remainingIds.length === 0) {
    const defaultMuseum = createNewMuseumData("My Museum");
    AppState.museums[defaultMuseum.id] = defaultMuseum.museum
    AppState.activeMuseumId = defaultMuseum.id;
  } else {
    AppState.activeMuseumId = remainingIds[0];
  }

  saveToLocalStorage();
  initTabsUI();
  refreshPedestalsOnly();
  aggregateGlobalStats();

  closeMuseumSettingsModal();
}

function openShareModal() {
  const shareOverlay = document.getElementById("share-modal");
  const outputField = document.getElementById("share-code-output");

  if (!shareOverlay || !outputField) return;

  const activeMuseum = AppState.museums[AppState.activeMuseumId];
  if (!activeMuseum) return;

  const museumName = activeMuseum.name || "Unnamed Museum";
  const encodedGems = [];

  for (const slotId in activeMuseum.gems) {
    const gem = activeMuseum.gems[slotId];
    if (gem && gem.name !== "None") {
      const numericId = parseInt(slotId.split("-")[1]) || 0;
      const oreIndex = ORE_ID_MAP.indexOf(gem.name);
      const modIndex = MODIFIER_ID_MAP.indexOf(gem.modifier);
      const cleanWeight = parseFloat(gem.weight.toFixed(2));

      if (oreIndex !== -1) {
        encodedGems.push(`${numericId}-${oreIndex}-${modIndex}-${cleanWeight}`);
      }
    }
  }

  const rawDataPayload = `${museumName}|${encodedGems.join(":")}`;
  outputField.value = btoa(rawDataPayload);

  shareOverlay.classList.add("is-active");
}

function closeShareModal() {
  const shareOverlay = document.getElementById("share-modal");
  if (shareOverlay) shareOverlay.classList.remove("is-active");
}

function handleMuseumImport() {
  const inputField = document.getElementById("import-code-input");
  const statusMsg = document.getElementById("import-status-msg");
  if (!inputField || !statusMsg) return;

  const rawCode = inputField.value.trim();
  if (!rawCode) {
    statusMsg.style.color = "#ff4a4a";
    statusMsg.innerText = "Please enter a valid code.";
    return;
  }

  try {
    const decodedPayload = decodeURIComponent(atob(rawCode));

    if (!decodedPayload.includes("|")) {
      throw new Error("Invalid custom hash configuration scheme.");
    }
    const [museumName, encodedGems] = decodedPayload.split("|");

    const importedMuseum = {
      name: museumName,
      gems: {}
    };

    if (encodedGems && encodedGems.trim() !== "") {
      const individualGemTokens = encodedGems.split(":");

      individualGemTokens.forEach(gemToken => {
        const [numericId, oreIndex, modIndex, weight] = gemToken.split("-");

        const oreName = ORE_ID_MAP[parseInt(oreIndex)];
        const modName = MODIFIER_ID_MAP[parseInt(modIndex)];
        const finalWeight = parseFloat(weight) || 0.00;
        const slotKey = `${ORE_REGISTRY[oreName].rarity.toLowerCase()}-${numericId}`;

        if (oreName) {
          const gem = {
            name: oreName,
            modifier: modName || "None",
            weight: finalWeight
          }

          gem.calculated = calculateSingleGemBoost(gem);

          importedMuseum.gems[slotKey] = gem;
        }
      });

      AppState.museums[`museum-${Date.now()}`] = importedMuseum;

      saveToLocalStorage();
      initTabsUI();
      refreshPedestalsOnly();
      aggregateGlobalStats();

      statusMsg.style.color = "#43b581";
      statusMsg.innerText = "Museum imported successfully!";
      setTimeout(closeShareModal, 3000);

    }
  } catch (err) {
    statusMsg.style.color = "#ff4a4a";
    statusMsg.innerText = "Failed to import museum. Please check the code and try again.";
  }
}

function handleAddMuseum() {
  const totalMuseums = Object.keys(AppState.museums).length + 1;
  const newMuseum = createNewMuseumData(`Museum ${totalMuseums}`);

  AppState.museums[newMuseum.id] = newMuseum.museum;
  AppState.activeMuseumId = newMuseum.id;

  switchMuseum(newMuseum.id);
  initTabsUI();
}

function initTabsUI() {
  const tabsContainer = document.querySelector(".museum-tabs");
  if (!tabsContainer) return;

  const addTabButton = tabsContainer.querySelector(".tab-add");

  tabsContainer.querySelectorAll(".tab:not(.tab-add)").forEach(oldTab => oldTab.remove());

  const museumIds = Object.keys(AppState.museums);

  museumIds.forEach(museumId => {
    const museumData = AppState.museums[museumId];

    const tabElement = document.createElement("button");
    tabElement.type = "button";
    tabElement.classList.add("tab");
    tabElement.innerText = museumData.name;

    tabElement.setAttribute("data-id", museumId);

    if (museumId === AppState.activeMuseumId) {
      tabElement.classList.add("is-active");
    }

    tabElement.addEventListener("click", () => {
      switchMuseum(museumId);
    });

    if (addTabButton) {
      tabsContainer.insertBefore(tabElement, addTabButton);
    } else {
      tabsContainer.appendChild(tabElement);
    }
  })
}

let activeEditingSlotId = null;
function bindPedestalListeners() {
  const pedestals = document.querySelectorAll(".gem-button[data-gem]");
  pedestals.forEach(pedestal => {
    pedestal.addEventListener("click", () => {
      const slotId = pedestal.getAttribute("data-gem");
      openEditorModal(slotId);
    });
  });

  const clearBtn = document.getElementById("gem-modal-clear-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearEditorModal);
  }

  const closeBtn = document.getElementById("gem-modal-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeEditorModal);
  }

  const modalOverlay = document.getElementById("gem-modal");
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeEditorModal();
    });
  }
}

function refreshPedestalsOnly() {
  const currentMuseum = AppState.museums[AppState.activeMuseumId];
  if (!currentMuseum) return;

  const allPedestals = document.querySelectorAll(".gem-button[data-gem]");

  allPedestals.forEach(gemButton => {
    const slotId = gemButton.getAttribute("data-gem");
    const gemData = currentMuseum.gems[slotId];

    if (gemData && gemData.name !== "None") {
      let tooltipText = "";
      if (gemData.calculated) {
        const lines = [];
        for (const [statKey, value] of Object.entries(gemData.calculated)) {
          if (value !== 0) {
            const friendlyName = STAT_DISPLAY_NAMES[statKey] || statKey;
            lines.push(`${friendlyName}: ${value > 1 ? "+" : ""}${value.toFixed(2)}x`);
          }
        }
        tooltipText = lines.join("\n");
      }

      gemButton.setAttribute("data-info", tooltipText);

      if (slotId.startsWith("exotic-") || slotId.startsWith("mythic-")) {
        gemButton.classList.add("tooltip-flipped");
      } else {
        gemButton.classList.remove("tooltip-flipped");
      }

      gemButton.innerHTML = `
        <svg class="gem-icon" style="opacity: 0.20;" aria-hidden="true" focusable="false">
          <use href="#gem-solid-full"></use>
        </svg>
        <div class="gem-text-overlay">
          ${gemData.modifier !== "None" ? `<span class="gem-mod-line">${gemData.modifier}</span>` + `<br />` : ""}
          <span class="gem-type-line gem-${ORE_REGISTRY[gemData.name].rarity.toLowerCase()}">${gemData.name}</span>
          <br/>
          <span class="gem-weight-line">${gemData.weight}kg</span>
        </div>
      `;
    } else {
      gemButton.setAttribute("data-info", "");
      gemButton.classList.remove("tooltip-flipped");

      gemButton.innerHTML = `
        <svg class="gem-icon" aria-hidden="true" focusable="false">
          <use href="#gem-solid-full"></use>
        </svg>
      `;
    }
  });
}

function openEditorModal(slotId) {
  activeEditingSlotId = slotId;
  const modalOverlay = document.getElementById("gem-modal");
  const modalTitle = document.getElementById("gem-modal-title");
  const modalBody = document.getElementById("gem-modal-body");

  if (!modalOverlay || !modalTitle || !modalBody) return;

  const slotPrefix = slotId.split("-")[0];
  const targetRarity = slotPrefix.charAt(0).toUpperCase() + slotPrefix.slice(1);

  modalTitle.innerText = `Manage ${targetRarity}`;

  const currentMuseum = AppState.museums[AppState.activeMuseumId];

  if (!currentMuseum.gems[slotId]) {
    currentMuseum.gems[slotId] = {
      name: "None",
      weight: 0.00,
      modifier: "None"
    }
  }

  const gemData = currentMuseum.gems[slotId];

  let oreOptions = `<option value="None">None (Empty)</option>`;
  if (ORE_REGISTRY) {
    Object.entries(ORE_REGISTRY).forEach(([oreName, oreConfig]) => {
      if (oreConfig["rarity"] === targetRarity) {
        oreOptions += `<option value="${oreName}" ${gemData.name === oreName ? 'selected' : ''}>${oreName}</option>`;
      }
    })
  }

  let modOptions = `<option value="None">None (Empty)</option>`;
  if (MODIFIER_REGISTRY) {
    Object.keys(MODIFIER_REGISTRY["modifiers"]).forEach(modName => {
      modOptions += `<option value="${modName}" ${gemData.modifier === modName ? 'selected' : ''}>${modName}</option>`;
    })
  }

  modalBody.innerHTML = `
    <form class="editor-form" autocomplete="off" onsubmit="event.preventDefault();">
      <div class="editor-row">
        <label for="edit-name">Ore Type</label>
        <select id="edit-name" class="editor-input">${oreOptions}</select>
      </div>
      <div class="editor-row">
        <label for="edit-modifier">Modifier</label>
        <select id="edit-modifier" class="editor-input">${modOptions}</select>
      </div>
      <div class="editor-row">
        <label for="edit-weight">Weight (kg)</label>
        <input type="number" id="edit-weight" class="editor-input" step="0.1" min="0" value="${gemData.weight || 0}">
      </div>
    </form>
  `;

  document.getElementById("edit-name").addEventListener("change", handleModalFormUpdate);
  document.getElementById("edit-modifier").addEventListener("change", handleModalFormUpdate);
  document.getElementById("edit-weight").addEventListener("input", handleModalFormUpdate);

  modalOverlay.classList.add("is-active");
}

function clearEditorModal() {
  if (!activeEditingSlotId) return;

  const currentMuseum = AppState.museums[AppState.activeMuseumId];
  if (!currentMuseum) return;

  if (currentMuseum.gems[activeEditingSlotId]) {
    delete currentMuseum.gems[activeEditingSlotId];
  }

  const typeSelect = document.getElementById("edit-name");
  if (typeSelect) typeSelect.value = "None";

  const modSelect = document.getElementById("edit-modifier");
  if (modSelect) modSelect.value = "None";

  const weightInput = document.getElementById("edit-weight");
  if (weightInput) weightInput.value = 0;

  saveToLocalStorage();
  refreshPedestalsOnly();
  aggregateGlobalStats();

  closeEditorModal();
}

function closeEditorModal() {
  activeEditingSlotId = null;
  const modalOverlay = document.getElementById("gem-modal");
  if (modalOverlay) modalOverlay.classList.remove("is-active");
}

function handleModalFormUpdate() {
  if (!activeEditingSlotId) return;

  const currentMuseum = AppState.museums[AppState.activeMuseumId];

  const selectedName = document.getElementById("edit-name") ? document.getElementById("edit-name").value : "None";
  if (selectedName === "None") {
    delete currentMuseum.gems[activeEditingSlotId];
  } else {
    if (!currentMuseum.gems[activeEditingSlotId]) {
      currentMuseum.gems[activeEditingSlotId] = {
        name: "None",
        weight: 0.00,
        modifier: "None"
      }
    }

    const gemData = currentMuseum.gems[activeEditingSlotId];
    gemData.name = selectedName;
    gemData.modifier = document.getElementById("edit-modifier").value;
    gemData.weight = parseFloat(document.getElementById("edit-weight").value) || 0.00;

    gemData.calculated = calculateSingleGemBoost(gemData);
  }

  saveToLocalStorage();
  refreshPedestalsOnly();
  aggregateGlobalStats();
}

function calculateSingleGemBoost(gem) {
  const calculatedStats = {
    "Luck": 0.00,
    "Capacity": 0.00,
    "DigSpeed": 0.00,
    "DigStrength": 0.00,
    "ShakeStrength": 0.00,
    "ShakeSpeed": 0.00,
    "SellBoost": 0.00,
    "SizeBoost": 0.00,
    "ModBoost": 0.00,
    "WalkSpeed": 0.00
  }

  if (!gem || gem.name === "None" || !ORE_REGISTRY) {
    return calculatedStats;
  }

  const oreConfig = ORE_REGISTRY[gem.name];
  const modifierConfig = MODIFIER_REGISTRY["modifiers"][gem.modifier];
  if (!oreConfig) return calculatedStats;

  for (let i = 0; i < oreConfig["boosts"].length; i++) {
    let boostType = oreConfig["boosts"][i];
    let itemWeight = gem.weight >= oreConfig["maxWeight"] ? oreConfig["maxWeight"] : gem.weight;
    let boost = oreConfig["boostMults"][i] * Math.sqrt(itemWeight / oreConfig["maxWeight"]);

    if (calculatedStats[boostType] !== undefined) {
      calculatedStats[boostType] += boost;
    }
  }

  if (modifierConfig) {
    let isTreasured = gem.modifier === "Treasured" ? 2 : 1;

    for (let boost of modifierConfig) {
      let modBoost = isTreasured * (MODIFIER_REGISTRY["rarityMods"][oreConfig["rarity"]]);
      calculatedStats[boost] += modBoost;
    }
  }

  return calculatedStats;
}

function aggregateGlobalStats() {
  const currentMuseum = AppState.museums[AppState.activeMuseumId];
  if (!currentMuseum) return;

  const nameDisplay = document.getElementById("museum-info-name");
  if (nameDisplay) {
    nameDisplay.innerText = currentMuseum.name || "UNNAMED MUSEUM";
  }

  const globalTotals = {
    "Luck": 0.00,
    "Capacity": 0.00,
    "DigSpeed": 0.00,
    "DigStrength": 0.00,
    "ShakeStrength": 0.00,
    "ShakeSpeed": 0.00,
    "SellBoost": 0.00,
    "SizeBoost": 0.00,
    "ModBoost": 0.00,
    "WalkSpeed": 0.00
  };

  for (const slotId in currentMuseum.gems) {
    const gem = currentMuseum.gems[slotId];
    if (gem && gem.calculated) {
      for (const statKey in globalTotals) {
        globalTotals[statKey] += gem.calculated[statKey] || 0;
      }
    }
  }

  const statsContainer = document.getElementById("museum-info-stats");
  if (!statsContainer) return;

  const activeEntries = Object.entries(globalTotals).filter(([_, value]) => value.toFixed(3) !== "0.000");

  let leftColumnHtml = "";
  let rightColumnHtml = "";

  const halfLength = Math.ceil(activeEntries.length / 2);

  activeEntries.forEach(([statKey, value], index) => {
    let finalMultiplierValue = 1.00 + value;

    if (value > 0) {
      finalMultiplierValue += 0.0001;
    } else if (value < 0) {
      finalMultiplierValue -= 0.0001;
    }

    const displayValue = `${value > 0 ? "+" : ""}${finalMultiplierValue.toFixed(2)}x`;
    const colorClass = value > 0 ? "stat-pos" : "stat-neg";
    const friendlyName = STAT_DISPLAY_NAMES[statKey] || statKey;

    const rowMarkup = `
      <div class="info-row">
        <span class="info-row-label">${friendlyName}:</span>
        <span class="${colorClass}">${displayValue}</span>
      </div>
    `;

    if (index < halfLength) {
      leftColumnHtml += rowMarkup;
    } else {
      rightColumnHtml += rowMarkup;
    }
  });

  statsContainer.innerHTML = `
    <div class="info-column">${leftColumnHtml}</div>
    <div class="info-column">${rightColumnHtml}</div>
  `;
}

async function bootstrapApplication() {
  try {
    const [oreResponse, modResponse] = await Promise.all([
      fetch("data/oreData.json"),
      fetch("data/modData.json")
    ]);

    if (!oreResponse.ok || !modResponse.ok) {
      throw new Error("Critical metadata registry loading error.");
    }

    ORE_REGISTRY = await oreResponse.json();
    MODIFIER_REGISTRY = await modResponse.json();

    ORE_ID_MAP = Object.keys(ORE_REGISTRY);
    MODIFIER_ID_MAP = [ "None", ...Object.keys(MODIFIER_REGISTRY["modifiers"])];

    console.log("Database registries loaded successfully.");

    discoverGemSlots();

    loadFromLocalStorage();

    initTabsUI();
    bindPedestalListeners();
    bindActionButtons();

    switchMuseum(AppState.activeMuseumId);
  } catch (e) {
    console.error("Application Boot Failed:", e);
  }
}
document.addEventListener("DOMContentLoaded", bootstrapApplication);