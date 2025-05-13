/**
 * Pagetalk - Agent Management Functions
 */
import { generateUniqueId } from './utils.js';

// Default settings for new agents
const defaultAgentSettings = {
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 65536,
    topP: 0.95,
};

/** Helper function to get translation string */
function _(key, replacements = {}, translations) {
    let translation = translations[key] || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

/**
 * 加载助手列表并初始化
 * @param {object} state - Global state reference
 * @param {function} updateAgentsListCallback - Callback to update UI list
 * @param {function} updateAgentSelectionInChatCallback - Callback to update chat dropdown
 * @param {function} saveCurrentAgentIdCallback - Callback to save current agent ID
 * @param {object} currentTranslations - Translations object
 */
export function loadAgents(state, updateAgentsListCallback, updateAgentSelectionInChatCallback, saveCurrentAgentIdCallback, currentTranslations) {
    chrome.storage.sync.get(['agents', 'currentAgentId'], (result) => {
        console.log('Storage get result:', result); // Add logging
        if (result.agents && Array.isArray(result.agents) && result.agents.length > 0) {
            state.agents = result.agents;
        } else {
            // Create default agent if none exist
            const defaultAgent = {
                id: 'default', // Keep 'default' ID for the initial one
                name: 'defaultAgentName', // Store the translation key
                ...defaultAgentSettings
            };
            state.agents = [defaultAgent];
        }

        console.log('Loaded agents:', state.agents); // Add logging

        // Set current agent ID
        if (result.currentAgentId && state.agents.find(a => a.id === result.currentAgentId)) {
            state.currentAgentId = result.currentAgentId;
        } else if (state.agents.length > 0) {
            state.currentAgentId = state.agents[0].id; // Default to first agent
        } else {
            state.currentAgentId = null; // No agents
        }

        updateAgentsListCallback(); // Update UI
        updateAgentSelectionInChatCallback(); // Update chat dropdown

        // Load current agent settings into global state
        loadCurrentAgentSettingsIntoState(state);
    });
}

/**
 * 更新助手列表UI (可折叠，实时保存)
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 * @param {function} autoSaveAgentSettingsCallback - Callback. This is the wrapper from main.js
 * @param {function} showDeleteConfirmDialogCallback - Callback
 * @param {function} switchAgentCallback - Callback
 */
export function updateAgentsListUI(state, elements, currentTranslations, autoSaveAgentSettingsCallback, showDeleteConfirmDialogCallback, switchAgentCallback) {
    if (!elements.agentsList) return;
    elements.agentsList.innerHTML = '';

    if (!state.agents || state.agents.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `<p>${_('emptyAgentList', {}, currentTranslations)}</p>`;
        elements.agentsList.appendChild(emptyState);
        return;
    }

    state.agents.forEach(agent => {
        const agentItem = document.createElement('div');
        agentItem.className = 'agent-item';
        agentItem.dataset.agentId = agent.id; // Use agentId for dataset

        // --- Header ---
        const header = document.createElement('div');
        header.className = 'agent-item-header';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'agent-item-name';
        nameSpan.textContent = _(agent.name, {}, currentTranslations);

        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon';
        expandIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>`;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'agent-item-actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn'; // Use specific class for styling
        deleteBtn.title = _('delete', {}, currentTranslations);
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/></svg>`;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeleteConfirmDialogCallback(agent.id); // Use callback
        });
        actionsDiv.appendChild(deleteBtn);

        header.appendChild(nameSpan);
        header.appendChild(expandIcon);
        header.appendChild(actionsDiv);

        // --- Body ---
        const body = document.createElement('div');
        body.className = 'agent-item-body';

        // Name Input
        const nameGroup = document.createElement('div');
        nameGroup.className = 'setting-group';
        nameGroup.innerHTML = `
            <label for="agent-name-${agent.id}">${_('agentNameLabel', {}, currentTranslations)}</label>
            <input type="text" id="agent-name-${agent.id}" value="${_(agent.name, {}, currentTranslations)}">
        `;
        nameGroup.querySelector('input').addEventListener('input', () => {
            clearTimeout(agentItem._saveTimeout);
            agentItem._saveTimeout = setTimeout(() => autoSaveAgentSettingsCallback(agent.id, agentItem), 500);
        });
        body.appendChild(nameGroup);

        // System Prompt
        const promptGroup = document.createElement('div');
        promptGroup.className = 'setting-group';
        promptGroup.innerHTML = `
            <label for="system-prompt-${agent.id}">${_('agentSystemPromptLabel', {}, currentTranslations)}</label>
            <textarea id="system-prompt-${agent.id}" placeholder="${_('agentSystemPromptLabel', {}, currentTranslations)}">${agent.systemPrompt}</textarea>
        `;
        promptGroup.querySelector('textarea').addEventListener('input', () => {
            clearTimeout(agentItem._saveTimeout);
            agentItem._saveTimeout = setTimeout(() => autoSaveAgentSettingsCallback(agent.id, agentItem), 500);
        });
        body.appendChild(promptGroup);

        // Temperature Slider
        const tempGroup = createSliderGroup(agent.id, 'temperature', _('agentTemperatureLabel', {}, currentTranslations), agent.temperature, 0, 1, 0.1, autoSaveAgentSettingsCallback, agentItem);
        body.appendChild(tempGroup);

        // Top P Slider
        const topPGroup = createSliderGroup(agent.id, 'top-p', _('agentTopPLabel', {}, currentTranslations), agent.topP, 0, 1, 0.05, autoSaveAgentSettingsCallback, agentItem);
        body.appendChild(topPGroup);

        // Max Tokens Input
        const maxTokensGroup = document.createElement('div');
        maxTokensGroup.className = 'setting-group';
        maxTokensGroup.innerHTML = `
            <label for="max-tokens-${agent.id}">${_('agentMaxOutputLabel', {}, currentTranslations)}</label>
            <input type="number" id="max-tokens-${agent.id}" value="${agent.maxTokens}" min="50" max="65536">
        `;
        maxTokensGroup.querySelector('input').addEventListener('input', () => {
            clearTimeout(agentItem._saveTimeout);
            agentItem._saveTimeout = setTimeout(() => autoSaveAgentSettingsCallback(agent.id, agentItem), 500);
        });
        body.appendChild(maxTokensGroup);

        // --- Assembly & Events ---
        agentItem.appendChild(header);
        agentItem.appendChild(body);
        elements.agentsList.appendChild(agentItem);

        // Expand/Collapse Listener
        header.addEventListener('click', () => {
            const isExpanded = agentItem.classList.contains('expanded');
            // Collapse others
            elements.agentsList.querySelectorAll('.agent-item.expanded').forEach(item => {
                if (item !== agentItem) {
                    item.classList.remove('expanded');
                }
            });
            // Toggle current
            agentItem.classList.toggle('expanded', !isExpanded);

            // If expanding, switch the current agent
            if (!isExpanded) {
                switchAgentCallback(agent.id); // Use callback
            }
        });

        // If it's the currently selected agent, expand it initially
        if (agent.id === state.currentAgentId) {
            agentItem.classList.add('expanded');
        }
    });
}

/**
 * Helper to create a slider group
 */
function createSliderGroup(agentId, settingName, labelText, value, min, max, step, saveCallback, agentItem) {
    const group = document.createElement('div');
    group.className = 'setting-group';
    const sliderId = `${settingName}-${agentId}`;
    const valueId = `${settingName}-value-${agentId}`;

    group.innerHTML = `
        <label for="${sliderId}">${labelText}</label>
        <div class="slider-container">
            <input type="range" id="${sliderId}" min="${min}" max="${max}" step="${step}" value="${value}" class="color-slider">
            <span id="${valueId}">${value}</span>
        </div>
    `;

    const sliderInput = group.querySelector('input[type="range"]');
    const valueSpan = group.querySelector(`#${valueId}`);

    sliderInput.addEventListener('input', (e) => {
        valueSpan.textContent = e.target.value;
        clearTimeout(agentItem._saveTimeout);
        agentItem._saveTimeout = setTimeout(() => saveCallback(agentId, agentItem), 300);
    });

    return group;
}

/**
 * 自动保存助手设置
 * @param {string} agentId - 助手的ID
 * @param {HTMLElement} agentItemElement - 助手项DOM元素
 * @param {object} state - Global state reference
 * @param {function} saveAgentsListCallback - Callback to save the list (this is saveAgentsListState from main.js)
 * @param {function} updateAgentSelectionInChatCallback - Callback (this is updateAgentSelectionInChatUI from main.js)
 * @param {function} showToastCallback - Callback (this is showToastUI from main.js)
 * @param {object} currentTranslations - Translations object
 */
export function autoSaveAgentSettings(agentId, agentItemElement, state, saveAgentsListCallback, updateAgentSelectionInChatCallback, showToastCallback, currentTranslations) {
    console.log(`Attempting to auto-save agent with ID: ${agentId}`);

    const agentIndex = state.agents.findIndex(a => a.id === agentId);
    if (agentIndex === -1) {
        console.error(`Auto-save failed: Agent with ID ${agentId} not found in state.`);
        showToastCallback(_('agentSaveFailedNotFound', {}, currentTranslations), 'error');
        return;
    }

    // Read values from DOM
    const nameInput = agentItemElement.querySelector(`#agent-name-${agentId}`);
    const systemPromptInput = agentItemElement.querySelector(`#system-prompt-${agentId}`);
    const temperatureInput = agentItemElement.querySelector(`#temperature-${agentId}`);
    const topPInput = agentItemElement.querySelector(`#top-p-${agentId}`);
    const maxTokensInput = agentItemElement.querySelector(`#max-tokens-${agentId}`);

    const newName = nameInput ? nameInput.value.trim() : state.agents[agentIndex].name;
    const newSystemPrompt = systemPromptInput ? systemPromptInput.value : state.agents[agentIndex].systemPrompt;
    const newTemperature = temperatureInput ? parseFloat(temperatureInput.value) : state.agents[agentIndex].temperature;
    const newTopP = topPInput ? parseFloat(topPInput.value) : state.agents[agentIndex].topP;
    const newMaxTokens = maxTokensInput ? parseInt(maxTokensInput.value, 10) : state.agents[agentIndex].maxTokens;

    // Validate Name (cannot be empty)
    if (!newName) {
        showToastCallback(_('agentSaveFailedNameEmpty', {}, currentTranslations), 'error'); // Need translation key
        // Optionally revert the input field value
        if (nameInput) nameInput.value = state.agents[agentIndex].name;
        return;
    }
    // Validate Max Tokens
    if (isNaN(newMaxTokens) || newMaxTokens < 50 || newMaxTokens > 65536) {
        showToastCallback(_('agentSaveFailedMaxTokensInvalid', {}, currentTranslations), 'error'); // Need translation key
        if (maxTokensInput) maxTokensInput.value = state.agents[agentIndex].maxTokens;
        return;
    }


    // Update state object
    const agentToUpdate = state.agents[agentIndex];
    agentToUpdate.name = newName; // Save the raw name (user input)
    agentToUpdate.systemPrompt = newSystemPrompt;
    agentToUpdate.temperature = newTemperature;
    agentToUpdate.topP = newTopP;
    agentToUpdate.maxTokens = newMaxTokens;
    console.log(`Agent ${agentId} updated in state (Name: ${newName}, Prompt: "${newSystemPrompt}"):`, agentToUpdate);


    // Sync global state if this is the current agent
    if (agentId === state.currentAgentId) {
        loadCurrentAgentSettingsIntoState(state); // Reload settings from the updated agent
        console.log(`Global state synced for currently active agent: ${agentId} (New prompt: "${state.systemPrompt}")`);
    }

    // Save the entire list
    saveAgentsListCallback(); // This will eventually call chrome.storage.sync.set

    // Update UI elements
    const nameSpanInHeader = agentItemElement.querySelector('.agent-item-header .agent-item-name');
    if (nameSpanInHeader) {
        nameSpanInHeader.textContent = _(newName, {}, currentTranslations);
    }
    updateAgentSelectionInChatCallback(); // Update dropdown in chat tab

    // Optional feedback (e.g., subtle visual cue on the item)
    // showToastCallback(_('agentSettingsSaved', {}, currentTranslations), 'success'); // Maybe too noisy for auto-save
}

/**
 * 创建新助手
 * @param {object} state - Global state reference
 * @param {function} updateAgentsListCallback - Callback
 * @param {function} updateAgentSelectionInChatCallback - Callback
 * @param {function} saveAgentsListCallback - Callback
 * @param {function} showToastCallback - Callback
 * @param {object} currentTranslations - Translations object
 */
export function createNewAgent(state, updateAgentsListCallback, updateAgentSelectionInChatCallback, saveAgentsListCallback, showToastCallback, currentTranslations) {
    const baseName = _('newAgentBaseName', {}, currentTranslations);
    let counter = 1;
    let newAgentName = `${baseName} ${counter}`;
    while (state.agents.some(agent => agent.name === newAgentName)) {
        counter++;
        newAgentName = `${baseName} ${counter}`;
    }

    const newAgent = {
        id: generateUniqueId(),
        name: newAgentName,
        ...defaultAgentSettings
    };

    state.agents.push(newAgent);
    state.currentAgentId = newAgent.id; // Switch to the new agent

    updateAgentsListCallback(); // Update UI list
    loadCurrentAgentSettingsIntoState(state); // Load new agent settings into global state
    updateAgentSelectionInChatCallback(); // Update chat dropdown

    showToastCallback(_('newAgentCreatedToast', {}, currentTranslations), 'success');
    saveAgentsListCallback(); // Save the updated list and current ID
}

/**
 * 显示删除确认对话框
 * @param {string} agentId - 要删除���助手ID
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 */
export function showDeleteConfirmDialog(agentId, state, elements, currentTranslations) {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent || !elements.deleteConfirmDialog) return;

    const confirmPromptElement = elements.deleteConfirmDialog.querySelector('p');
    if (confirmPromptElement) {
        confirmPromptElement.innerHTML = _('deleteConfirmPrompt', { agentName: `<strong>${agent.name}</strong>` }, currentTranslations);
    }
    elements.deleteConfirmDialog.dataset.agentId = agentId;
    elements.deleteConfirmDialog.style.display = 'flex';
}

/**
 * 确认���除助手
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {function} updateAgentsListCallback - Callback
 * @param {function} updateAgentSelectionInChatCallback - Callback
 * @param {function} saveAgentsListCallback - Callback
 * @param {function} showToastCallback - Callback
 * @param {object} currentTranslations - Translations object
 */
export function confirmDeleteAgent(state, elements, updateAgentsListCallback, updateAgentSelectionInChatCallback, saveAgentsListCallback, showToastCallback, currentTranslations) {
    const agentId = elements.deleteConfirmDialog.dataset.agentId;
    if (!agentId) return;

    if (state.agents.length <= 1) {
        showToastCallback(_('minOneAgentError', {}, currentTranslations), 'error');
        elements.deleteConfirmDialog.style.display = 'none';
        return;
    }

    state.agents = state.agents.filter(a => a.id !== agentId);

    if (state.currentAgentId === agentId) {
        state.currentAgentId = state.agents[0].id; // Switch to the first available agent
        loadCurrentAgentSettingsIntoState(state); // Load new current agent's settings
    }

    updateAgentsListCallback();
    updateAgentSelectionInChatCallback();
    elements.deleteConfirmDialog.style.display = 'none';
    showToastCallback(_('agentDeletedToast', {}, currentTranslations), 'success');
    saveAgentsListCallback();
}

/**
 * �����������使用的助手
 * @param {string} agentId - 要切换到的助手ID
 * @param {object} state - Global state reference
 * @param {function} saveCurrentAgentIdCallback - Callback
 */
export function switchAgent(agentId, state, saveCurrentAgentIdCallback) {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return;

    state.currentAgentId = agentId;
    loadCurrentAgentSettingsIntoState(state); // Load settings for the switched agent
    saveCurrentAgentIdCallback(); // Save the new current ID

    // Optional: Show toast feedback
    // showToastCallback(_('agentSwitchedToast', { agentName: agent.name }, currentTranslations), 'success');
    console.log(`Switched to agent: ${agent.name} (ID: ${agentId}) (Prompt: "${state.systemPrompt}")`);
}

/**
 * 更新聊天界面中的助手选择器
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 */
export function updateAgentSelectionInChat(state, elements, currentTranslations) { // Add currentTranslations parameter
    if (!elements.chatAgentSelection) return;
    const currentVal = elements.chatAgentSelection.value; // Store current selection
    elements.chatAgentSelection.innerHTML = '';

    state.agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = _(agent.name, {}, currentTranslations);
        elements.chatAgentSelection.appendChild(option);
    });

    // Try to restore selection, otherwise set to currentAgentId
    if (state.agents.find(a => a.id === currentVal)) {
        elements.chatAgentSelection.value = currentVal;
    } else {
        elements.chatAgentSelection.value = state.currentAgentId;
    }
}

/**
 * 保存助手列表和当前助手ID到存储
 * @param {object} state - Global state reference
 */
export function saveAgentsList(state) {
    chrome.storage.sync.set({
        agents: state.agents,
        currentAgentId: state.currentAgentId
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving agents list:", chrome.runtime.lastError);
            // Optionally show an error toast
        } else {
            console.log("Agents list saved to storage.", state.agents);
        }
    });
}

/**
 * 保存当前选中的助手ID
 * @param {object} state - Global state reference
 */
export function saveCurrentAgentId(state) {
    chrome.storage.sync.set({ currentAgentId: state.currentAgentId }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving current agent ID:", chrome.runtime.lastError);
        } else {
            // console.log("Current agent ID saved.");
        }
    });
}

/**
 * 处理 Agent 配置导出
 * @param {object} state - Global state reference
 * @param {function} showToastCallback - Callback
 * @param {object} currentTranslations - Translations object
 */
export function handleAgentExport(state, showToastCallback, currentTranslations) {
    if (!state.agents || state.agents.length === 0) {
        showToastCallback(_('agentExportEmptyError', {}, currentTranslations), 'error');
        return;
    }
    try {
        const agentsToExport = state.agents.map(agent => ({
            name: agent.name,
            systemPrompt: agent.systemPrompt,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
            topP: agent.topP
        }));
        const jsonString = JSON.stringify(agentsToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `pagetalk_agents_${timestamp}.json`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToastCallback(_('agentExportSuccess', {}, currentTranslations), 'success');
    } catch (error) {
        console.error('Error exporting agents:', error);
        showToastCallback(_('agentExportError', { error: error.message }, currentTranslations), 'error');
    }
}

/**
 * 处理 Agent 配置文件导入
 * @param {Event} event - 文件输入���的 change ���件
 * @param {object} state - Global state reference
 * @param {function} saveAgentsListCallback - Callback
 * @param {function} updateAgentsListCallback - Callback
 * @param {function} updateAgentSelectionInChatCallback - Callback
 * @param {function} saveCurrentAgentIdCallback - Callback
 * @param {function} showToastCallback - Callback
 * @param {object} currentTranslations - Translations object
 */
export function handleAgentImport(event, state, saveAgentsListCallback, updateAgentsListCallback, updateAgentSelectionInChatCallback, saveCurrentAgentIdCallback, showToastCallback, currentTranslations) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) {
                throw new Error(_('agentImportErrorInvalidFormatArray', {}, currentTranslations));
            }

            let importedCount = 0;
            let updatedCount = 0;
            const validationErrors = [];

            importedData.forEach((importedAgent, index) => {
                // --- Validation ---
                const errors = validateImportedAgent(importedAgent, index, currentTranslations);
                if (errors.length > 0) {
                    validationErrors.push(...errors);
                    return; // Skip this agent
                }
                // --- End Validation ---

                const existingAgentIndex = state.agents.findIndex(a => a.name === importedAgent.name.trim());
                if (existingAgentIndex !== -1) {
                    // Update existing
                    const agentToUpdate = state.agents[existingAgentIndex];
                    agentToUpdate.systemPrompt = importedAgent.systemPrompt;
                    agentToUpdate.temperature = importedAgent.temperature;
                    agentToUpdate.maxTokens = importedAgent.maxTokens;
                    agentToUpdate.topP = importedAgent.topP;
                    updatedCount++;
                } else {
                    // Add new
                    const newAgent = {
                        id: generateUniqueId(),
                        name: importedAgent.name.trim(),
                        systemPrompt: importedAgent.systemPrompt,
                        temperature: importedAgent.temperature,
                        maxTokens: importedAgent.maxTokens,
                        topP: importedAgent.topP
                    };
                    state.agents.push(newAgent);
                    importedCount++;
                }
            });

            if (validationErrors.length > 0) {
                // Show only the first validation error for simplicity
                throw new Error(validationErrors[0]);
            }

            saveAgentsListCallback();
            updateAgentsListCallback();
            updateAgentSelectionInChatCallback();

            // Ensure currentAgentId is valid
            if (!state.agents.find(a => a.id === state.currentAgentId)) {
                if (state.agents.length > 0) {
                    state.currentAgentId = state.agents[0].id;
                    loadCurrentAgentSettingsIntoState(state); // Load settings for the new current agent
                    saveCurrentAgentIdCallback();
                    updateAgentSelectionInChatCallback(); // Update dropdown again
                } else {
                    // Handle case where import results in empty list (e.g., import empty array)
                    // Maybe create a default agent here?
                }
            } else {
                // If current agent still exists, reload its settings in case it was updated
                loadCurrentAgentSettingsIntoState(state);
            }

            showToastCallback(_('agentImportSuccess', { imported: importedCount, updated: updatedCount }, currentTranslations), 'success');

        } catch (error) {
            console.error('Error importing agents:', error);
            showToastCallback(_('agentImportError', { error: error.message }, currentTranslations), 'error');
        } finally {
            event.target.value = null; // Reset file input
        }
    };
    reader.onerror = (e) => {
        console.error('Error reading agent import file:', e);
        showToastCallback(_('agentImportErrorFileRead', {}, currentTranslations), 'error');
        event.target.value = null;
    };
    reader.readAsText(file);
}

/**
 * Validates a single imported agent object.
 * @param {object} agent - The imported agent data.
 * @param {number} index - The index of the agent in the imported array.
 * @param {object} currentTranslations - Translations object.
 * @returns {string[]} An array of error messages, empty if valid.
 */
function validateImportedAgent(agent, index, currentTranslations) {
    const errors = [];
    const prefix = `Agent ${index + 1}:`;

    if (typeof agent !== 'object' || agent === null) {
        errors.push(`${prefix} ${_('importValidationErrorNotObject', {}, currentTranslations)}`); // Need translation
        return errors; // Stop further validation if not an object
    }

    // Validate Name
    if (typeof agent.name !== 'string' || !agent.name.trim()) {
        errors.push(`${prefix} ${_('importValidationErrorInvalidName', {}, currentTranslations)}`); // Need translation
    }
    // Validate System Prompt
    if (typeof agent.systemPrompt !== 'string') {
        // Allow empty string for systemPrompt
        // errors.push(`${prefix} ${_('importValidationErrorInvalidPrompt', {}, currentTranslations)}`); // Need translation
    }
    // Validate Temperature
    if (typeof agent.temperature !== 'number' || isNaN(agent.temperature) || agent.temperature < 0 || agent.temperature > 1) {
        errors.push(`${prefix} ${_('importValidationErrorInvalidTemp', {}, currentTranslations)}`); // Need translation
    }
    // Validate Max Tokens
    if (typeof agent.maxTokens !== 'number' || !Number.isInteger(agent.maxTokens) || agent.maxTokens < 50 || agent.maxTokens > 65536) {
        errors.push(`${prefix} ${_('importValidationErrorInvalidTokens', {}, currentTranslations)}`); // Need translation
    }
    // Validate Top P
    if (typeof agent.topP !== 'number' || isNaN(agent.topP) || agent.topP < 0 || agent.topP > 1) {
        errors.push(`${prefix} ${_('importValidationErrorInvalidTopP', {}, currentTranslations)}`); // Need translation
    }

    return errors;
}


/**
 * Loads the settings of the currently selected agent into the global state.
 * @param {object} state - Global state reference.
 */
export function loadCurrentAgentSettingsIntoState(state) {
    const currentAgent = state.agents.find(a => a.id === state.currentAgentId);
    if (currentAgent) {
        state.systemPrompt = currentAgent.systemPrompt;
        state.temperature = currentAgent.temperature;
        state.maxTokens = currentAgent.maxTokens;
        state.topP = currentAgent.topP;
        console.log(`Loaded settings for agent ${state.currentAgentId} (Prompt: "${currentAgent.systemPrompt}") into global state.`);
    } else if (state.agents.length > 0) {
        // Fallback: if currentAgentId is somehow invalid, load the first agent's settings
        console.warn(`Current agent ID ${state.currentAgentId} not found. Loading settings from the first agent.`);
        const firstAgent = state.agents[0];
        state.currentAgentId = firstAgent.id; // Correct the currentAgentId
        state.systemPrompt = firstAgent.systemPrompt;
        state.temperature = firstAgent.temperature;
        state.maxTokens = firstAgent.maxTokens;
        state.topP = firstAgent.topP;
        saveCurrentAgentId(state); // Save the corrected ID
        console.log(`Loaded settings for agent ${state.currentAgentId} (Prompt: "${state.systemPrompt}") into global state.`);
    } else {
        // No agents exist, reset to defaults
        console.warn("No agents found. Resetting global settings to defaults.");
        state.currentAgentId = null;
        state.systemPrompt = defaultAgentSettings.systemPrompt;
        state.temperature = defaultAgentSettings.temperature;
        state.maxTokens = defaultAgentSettings.maxTokens;
        state.topP = defaultAgentSettings.topP;
    }
}