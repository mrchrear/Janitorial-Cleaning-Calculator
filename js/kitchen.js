"use strict";

/**
 * Kitchen Cleaning Calculator Application
 * 
 * A comprehensive tool for calculating and optimizing professional kitchen cleaning quotes.
 * Allows for detailed cost breakdowns, profit optimization, and professional quote generation.
 * 
 * @author Christian Reyes
 * @version 2.4.0
 */

// ===== Application State =====
const state = {
    // Core Data
    useSubcontractor: false,
    subcontractorCost: 0,
    workers: 2,
    hours: 4,
    days: 1,
    materialsPerDay: 50,
    equipmentPerDay: 40,
    largeHoods: 0,
    smallHoods: 0,
    hoodCleaningFrequency: 1,
    hoodLaborCostPerc: 38,  // Default 38% of hood price is labor cost
    hoodMaterialCostPerc: 12, // Default 12% of hood price is material cost
    isHoliday: false,
    outsideHouston: false,
    includeInsurance: true,
    
    // Configuration shared across calculators
    config: GlobalState.config,
    
    // Options
    options: {
        includeTransport: true,
        includeMaterials: true,
        includeEquipment: true,
        enableRounding: true,
        roundingMethod: 'up',
        roundingValue: 50,
        useCustomMarkup: false,
        customMarkupPercentage: 120,
        commissionPercentage: 20,
        enableCommissionSplit: false,
        commissionSplits: [10, 10],
        regularSuppliesPercentage: 6,
        additionalEquipmentPercentage: 2.75,
        uniformSafetyPercentage: 2.5,
        communicationsPercentage: 1,
        overheadPercentage: 5,
        enableInitialFee: false,
        initialFeeValue: 150,
        enableResidualPercentage: false,
        residualPercentageValue: 10,
        enableAutoCostOptimization: false
    },
    
    // UI State
    ui: {
        sectionStates: {},
        operationalCostsExpanded: false,
        isDarkMode: false,
        isCalculating: false,
        hasUnsavedConfigChanges: false,
        highlightedElements: new Set(),
        valueHistory: {}, // For tracking value changes
        toastQueue: []
    },
    
    // Calculation results cache
    results: {
        laborCost: 0,
        laborTax: 0,
        workCompCost: 0,
        transportCost: 0,
        materialsCost: 0,
        equipmentCost: 0,
        hoodCleaningCost: 0,
        operationalCosts: 0,
        subtotal: 0,
        residualAmount: 0,
        markup: 0,
        markupPercentage: 0,
        holidaySurcharge: 0,
        totalPrice: 0,
        generalLiabilityCost: 0,
        initialFeeAmount: 0,
        roundingAdjustment: 0,
        grandTotal: 0,
        netProfit: 0,
        costPercentage: 0,
        profitPercentage: 0,
        salesCommission: 0,
        finalCompanyProfit: 0,
        splitCommissions: []
    },
    
    // History for undo/redo functionality
    history: {
        snapshots: [],
        currentIndex: -1,
        maxSnapshots: 20
    }
};

// ===== Helper Functions =====

/**
 * Format a number as USD currency.
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
const formatCurrency = amount => '$' + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');

/**
 * Extract numeric value from currency string
 * @param {string} str - Currency string
 * @returns {number} - Extracted numeric value
 */
const extractNumericValue = str => {
    if (typeof str !== 'string') return 0;
    return parseFloat(str.replace(/[^0-9.-]+/g, '')) || 0;
};

/**
 * Round an amount using the desired method.
 * @param {number} amount - Value to round.
 * @param {'up'|'down'|'nearest'} method - Rounding mode.
 * @param {number} value - Step value for rounding.
 * @returns {number} - Rounded amount
 */
const roundAmount = (amount, method = 'up', value = 50) => {
    if (!value) return amount;
    switch (method) {
        case 'up': return Math.ceil(amount / value) * value;
        case 'down': return Math.floor(amount / value) * value;
        case 'nearest': default: return Math.round(amount / value) * value;
    }
};

/**
 * Calculate markup percentage based on contract length or custom value.
 * @param {number} days - Number of service days.
 * @returns {number} - Calculated markup percentage
 */
const calculateMarkupPercentage = (days) => {
    if (state.options.useCustomMarkup) return state.options.customMarkupPercentage;
    const baseMarkup = 120;
    if (days === 1) return baseMarkup;
    const minMarkup = 35;
    const daysEffect = Math.min(1, (days - 1) / 29);
    let markup = baseMarkup - (baseMarkup - minMarkup) * daysEffect;
    return Math.round(markup);
};

/**
 * Create a deep copy of an object
 * @param {Object} obj - Object to clone
 * @returns {Object} - Deep copy of the object
 */
const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

/**
 * Highlight an element to draw attention to changes
 * @param {string} id - Element ID to highlight
 * @param {string} [className='highlight-change'] - Class to add for highlighting
 * @param {number} [duration=1500] - Duration of the highlight in milliseconds
 */
const highlightElement = (id, className = 'highlight-change', duration = 1500) => {
    const el = $(id);
    if (!el) return;
    
    // Don't highlight if this element is already highlighted
    if (state.ui.highlightedElements.has(id)) return;
    
    // Store current value for comparison
    const currentValue = el.textContent;
    const previousValue = state.ui.valueHistory[id] || currentValue;
    
    // Check if value has changed significantly (more than 0.5%)
    const oldValue = extractNumericValue(previousValue);
    const newValue = extractNumericValue(currentValue);
    
    if (!isNaN(oldValue) && !isNaN(newValue) && oldValue !== 0) {
        const percentChange = Math.abs((newValue - oldValue) / oldValue) * 100;
        
        if (percentChange > 0.5) {
            // Add to set of highlighted elements
            state.ui.highlightedElements.add(id);
            
            // Add special class for an increase or decrease
            const changeClass = newValue > oldValue ? 'value-increased' : 'value-decreased';
            el.classList.add(className, changeClass);
            
            // Show notification for significant changes (more than 15%)
            if (percentChange > 15) {
                const changeType = newValue > oldValue ? 'increased' : 'decreased';
                const message = `<strong>${el.closest('.result-row, .profit-row, .result-total')?.querySelector('.label')?.textContent || 'Value'}</strong> ${changeType} by ${Math.round(percentChange)}%`;
                queueToast(message, changeType === 'increased' ? 'warning' : 'success');
            }
            
            // Remove the highlight after duration
            setTimeout(() => {
                el.classList.remove(className, changeClass);
                state.ui.highlightedElements.delete(id);
            }, duration);
        }
    }
    
    // Update stored value
    state.ui.valueHistory[id] = currentValue;
};

/**
 * Queue a toast notification
 * @param {string} message - Message to display
 * @param {string} [type='info'] - Notification type
 */
const queueToast = (message, type = 'info') => {
    state.ui.toastQueue.push({ message, type });
    
    // If this is the only item in the queue, show it immediately
    if (state.ui.toastQueue.length === 1) {
        processToastQueue();
    }
};

/**
 * Process the toast queue
 */
const processToastQueue = () => {
    if (state.ui.toastQueue.length === 0) return;
    
    const { message, type } = state.ui.toastQueue[0];
    showNotification(message, type);
    
    // Remove from queue and process next item after delay
    setTimeout(() => {
        state.ui.toastQueue.shift();
        if (state.ui.toastQueue.length > 0) {
            processToastQueue();
        }
    }, 3500); // Slightly longer than notification display time
};

/**
 * Save a snapshot of the current state for undo/redo functionality
 */
const saveSnapshot = () => {
    // Create a deep copy of the relevant parts of the state
    const snapshot = {
        useSubcontractor: state.useSubcontractor,
        subcontractorCost: state.subcontractorCost,
        workers: state.workers,
        hours: state.hours,
        days: state.days,
        materialsPerDay: state.materialsPerDay,
        equipmentPerDay: state.equipmentPerDay,
        largeHoods: state.largeHoods,
        smallHoods: state.smallHoods,
        hoodCleaningFrequency: state.hoodCleaningFrequency,
        hoodLaborCostPerc: state.hoodLaborCostPerc,
        hoodMaterialCostPerc: state.hoodMaterialCostPerc,
        isHoliday: state.isHoliday,
        outsideHouston: state.outsideHouston,
        includeInsurance: state.includeInsurance,
        options: deepClone(state.options)
    };
    
    // If we've used undo and then make changes, remove the future snapshots
    if (state.history.currentIndex < state.history.snapshots.length - 1) {
        state.history.snapshots = state.history.snapshots.slice(0, state.history.currentIndex + 1);
    }
    
    // Add the snapshot and update the index
    state.history.snapshots.push(snapshot);
    state.history.currentIndex = state.history.snapshots.length - 1;
    
    // Limit the number of snapshots
    if (state.history.snapshots.length > state.history.maxSnapshots) {
        state.history.snapshots.shift();
        state.history.currentIndex--;
    }
    
    // Enable/disable undo/redo buttons (if they exist)
    updateUndoRedoButtons();
};

/**
 * Update the state of undo/redo buttons
 */
const updateUndoRedoButtons = () => {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
        undoBtn.disabled = state.history.currentIndex <= 0;
        undoBtn.setAttribute('aria-disabled', state.history.currentIndex <= 0);
    }
    
    if (redoBtn) {
        redoBtn.disabled = state.history.currentIndex >= state.history.snapshots.length - 1;
        redoBtn.setAttribute('aria-disabled', state.history.currentIndex >= state.history.snapshots.length - 1);
    }
};

/**
 * Apply a snapshot from history for undo/redo
 * @param {number} index - Index of the snapshot to apply
 */
const applySnapshot = (index) => {
    if (index < 0 || index >= state.history.snapshots.length) return;
    
    const snapshot = state.history.snapshots[index];
    
    // Apply the snapshot to the state
    Object.assign(state, {
        useSubcontractor: snapshot.useSubcontractor,
        subcontractorCost: snapshot.subcontractorCost,
        workers: snapshot.workers,
        hours: snapshot.hours,
        days: snapshot.days,
        materialsPerDay: snapshot.materialsPerDay,
        equipmentPerDay: snapshot.equipmentPerDay,
        largeHoods: snapshot.largeHoods,
        smallHoods: snapshot.smallHoods,
        hoodCleaningFrequency: snapshot.hoodCleaningFrequency,
        hoodLaborCostPerc: snapshot.hoodLaborCostPerc,
        hoodMaterialCostPerc: snapshot.hoodMaterialCostPerc,
        isHoliday: snapshot.isHoliday,
        outsideHouston: snapshot.outsideHouston,
        includeInsurance: snapshot.includeInsurance,
        options: deepClone(snapshot.options)
    });
    
    // Update the UI to match the state
    updateUIFromState();
    calculateAll();
    
    // Update the current index and button states
    state.history.currentIndex = index;
    updateUndoRedoButtons();
};

/**
 * Implement undo functionality
 */
const undo = () => {
    if (state.history.currentIndex > 0) {
        applySnapshot(state.history.currentIndex - 1);
        queueToast('Changes undone', 'info');
    }
};

/**
 * Implement redo functionality
 */
const redo = () => {
    if (state.history.currentIndex < state.history.snapshots.length - 1) {
        applySnapshot(state.history.currentIndex + 1);
        queueToast('Changes restored', 'info');
    }
};

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
const debounce = (func, wait) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
};

// ===== DOM Utilities =====

/**
 * Shorthand for getElementById
 * @param {string} id - Element ID
 * @returns {HTMLElement} - The element with the given ID
 */
const $ = id => document.getElementById(id);

/**
 * Set the display property of an element
 * @param {string} id - Element ID
 * @param {boolean} show - Whether to show the element
 * @param {string} [displayValue='block'] - Display value to use when showing
 */
const setDisplay = (id, show, displayValue = 'block') => {
    const el = $(id);
    if (el) el.style.display = show ? (el.classList.contains('grid') ? 'grid' : displayValue) : 'none';
};

/**
 * Set the text content of an element
 * @param {string} id - Element ID
 * @param {string} content - Content to set
 */
const setContent = (id, content) => {
    const el = $(id);
    if (el) el.textContent = content;
};

/**
 * Set the HTML content of an element
 * @param {string} id - Element ID
 * @param {string} content - HTML content to set
 */
const setHTML = (id, content) => {
    const el = $(id);
    if (el) el.innerHTML = content;
};

/**
 * Toggle a class on an element
 * @param {string} id - Element ID
 * @param {string} className - Class to toggle
 * @param {boolean} condition - Whether to add or remove the class
 */
const toggleClass = (id, className, condition) => {
    const el = $(id);
    if (el) el.classList.toggle(className, condition);
};

/**
 * Set loading state for UI during calculations
 * @param {boolean} isLoading - Whether the calculator is loading
 */
const setLoadingState = (isLoading) => {
    state.ui.isCalculating = isLoading;
    document.body.classList.toggle('loading', isLoading);
};

/**
 * Check if browser supports required features
 * @returns {Object} - Object with support status for each feature
 */
const checkBrowserSupport = () => {
    const support = {
        html2canvas: typeof html2canvas !== 'undefined',
        jsPDF: typeof window.jspdf !== 'undefined' || typeof jsPDF !== 'undefined',
        localStorage: false,
        downloadAPI: 'download' in document.createElement('a')
    };
    
    // Check localStorage
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        support.localStorage = true;
    } catch (e) {
        support.localStorage = false;
    }
    
    return support;
};

// ===== Event Handlers =====

/**
 * Initialize all event listeners
 */
function initEventListeners() {
    // Tab navigation
    $('quotationTab').addEventListener('click', () => {
        // Check for unsaved changes in config
        if (state.ui.hasUnsavedConfigChanges) {
            if (confirm('You have unsaved changes in Configuration. Would you like to save them before leaving?')) {
                $('saveConfigBtn').click();
            } else {
                state.ui.hasUnsavedConfigChanges = false;
                updateUnsavedChangesIndicator();
            }
        }
        showContent('quotationContent');
    });
    
    $('configTab').addEventListener('click', () => showContent('configContent'));
    
    $('breakdownTab').addEventListener('click', () => {
        // Check for unsaved changes in config
        if (state.ui.hasUnsavedConfigChanges) {
            if (confirm('You have unsaved changes in Configuration. Would you like to save them before leaving?')) {
                $('saveConfigBtn').click();
            } else {
                state.ui.hasUnsavedConfigChanges = false;
                updateUnsavedChangesIndicator();
            }
        }
        
        showContent('quotationContent');
        const resultsEl = document.querySelector('.results-column') || document.querySelector('.result-section');
        if (resultsEl) resultsEl.scrollIntoView({behavior: 'smooth'});
    });
    
    $('resetBtn').addEventListener('click', resetCalculator);
    $('darkModeToggle').addEventListener('click', toggleDarkMode);
    
    // Toggle sections
    document.querySelectorAll('.toggle-section').forEach(button => {
        button.addEventListener('click', function() {
            toggleSection(this.getAttribute('data-target'), this);
        });
    });
    
    // Advanced options toggle
    $('advancedOptionsToggle').addEventListener('click', function() {
        const content = $('advancedOptionsContent');
        const icon = this.querySelector('i.fas');
        content.classList.toggle('visible');
        icon.className = content.classList.contains('visible') ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    });
    
    // Operational costs toggle
    $('operationalCostsRow').addEventListener('click', function() {
        this.classList.toggle('expanded');
        const icon = this.querySelector('i.fas');
        const details = $('operationalCostsDetails');
        
        if (this.classList.contains('expanded')) {
            details.style.display = 'block';
            icon.className = 'fas fa-chevron-up';
            state.ui.operationalCostsExpanded = true;
        } else {
            details.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
            state.ui.operationalCostsExpanded = false;
        }
    });
    
    // Setup checkbox handlers using event delegation
    document.addEventListener('change', e => {
        if (e.target.type === 'checkbox') {
            handleCheckboxChange(e.target);
        }
    });
    
    // Handle numeric input and percentage input changes with debounce
    document.addEventListener('input', debounce(e => {
        if (e.target.type === 'number' || e.target.classList.contains('commission-split-input')) {
            handleNumericInput(e.target);
        }
        
        // Track configuration changes
        if (e.target.closest('#configContent')) {
            state.ui.hasUnsavedConfigChanges = true;
            updateUnsavedChangesIndicator();
        }
    }, 300));
    
    // Add commission split button
    $('addCommissionSplitBtn').addEventListener('click', function() {
        state.options.commissionSplits.push(0);
        updateCommissionSplitInputs();
        saveSnapshot();
        calculateAll();
    });
    
    // Markup Slider
    $('markupSlider').addEventListener('input', function() {
        const value = parseInt(this.value);
        state.options.customMarkupPercentage = value;
        $('markupInput').value = value;
        calculateAll();
    });
    
    // Save configuration button
    $('saveConfigBtn').addEventListener('click', function() {
        if (!validateAllInputs()) {
            showNotification('Please fix the errors before saving configuration.', 'error');
            return;
        }
        
        // Update configuration values
        state.config.regularPayRate = parseFloat($('regularPayRate').value) || 16;
        state.config.supervisorPayRate = parseFloat($('supervisorPayRate').value) || 18;
        state.config.transportCostPerDay = parseFloat($('transportCostConfig').value) || 150;
        state.config.outsideHoustonTransportCostPerDay = parseFloat($('outsideHoustonTransportConfig').value) || 300;
        state.config.largeHoodPrice = parseFloat($('largeHoodPriceConfig').value) || 650;
        state.config.smallHoodPrice = parseFloat($('smallHoodPriceConfig').value) || 550;
        state.config.workCompRate = parseFloat($('workCompRate').value) || 1.88;
        state.config.glRate = parseFloat($('glRate').value) || 7.33;
        
        // Reset unsaved changes indicator
        state.ui.hasUnsavedConfigChanges = false;
        updateUnsavedChangesIndicator();
        
        // Update UI elements that display configuration values
        updateHoodPriceLabels();
        updateInsuranceDetails();
        
        saveSnapshot();
        calculateAll();
        showContent('quotationContent');
        showNotification('Configuration saved successfully.', 'success');
    });
    
    // Print and Export buttons
    $('printQuoteBtn').addEventListener('click', function() {
        preparePdfOrPrint('print');
    });
    
    $('downloadPdfBtn').addEventListener('click', function() {
        preparePdfOrPrint('pdf');
    });
    
    $('screenshotBtn').addEventListener('click', captureScreenshot);
    
    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.classList.remove('visible');
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            }
        });
    });
    
    // Initialize profit options classes
    updateProfitOptionClasses();
    updatePercentageDisplays();
    updateInsuranceDetails();
    
    // Initialize configuration values
    $('workCompRate').value = state.config.workCompRate;
    $('glRate').value = state.config.glRate;
    $('largeHoodPriceConfig').value = state.config.largeHoodPrice;
    $('smallHoodPriceConfig').value = state.config.smallHoodPrice;
    $('transportCostConfig').value = state.config.transportCostPerDay;
    $('outsideHoustonTransportConfig').value = state.config.outsideHoustonTransportCostPerDay;
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Save initial state for undo/redo
    saveSnapshot();
    
    // Add input event listeners for config fields to track changes
    document.querySelectorAll('#configContent input').forEach(input => {
        input.addEventListener('change', () => {
            state.ui.hasUnsavedConfigChanges = true;
            updateUnsavedChangesIndicator();
        });
    });
    
    // Add undo/redo button listeners
    if ($('undoBtn')) {
        $('undoBtn').addEventListener('click', undo);
    }
    
    if ($('redoBtn')) {
        $('redoBtn').addEventListener('click', redo);
    }
    
    // Check browser support
    const support = checkBrowserSupport();
    
    // Alert for missing features
    if (!support.html2canvas || !support.jsPDF) {
        const missingFeatures = [];
        if (!support.html2canvas) missingFeatures.push('HTML2Canvas (screenshot capture)');
        if (!support.jsPDF) missingFeatures.push('jsPDF (PDF generation)');
        
        showNotification(`Some features are not available: ${missingFeatures.join(', ')}. Please check your internet connection.`, 'warning', 8000);
    }
}

/**
 * Update the unsaved changes indicator
 */
function updateUnsavedChangesIndicator() {
    const configTab = $('configTab');
    if (!configTab) return;
    
    if (state.ui.hasUnsavedConfigChanges) {
        if (!configTab.querySelector('.unsaved-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'unsaved-indicator';
            indicator.setAttribute('aria-label', 'Unsaved changes');
            indicator.textContent = '*';
            configTab.appendChild(indicator);
        }
    } else {
        const indicator = configTab.querySelector('.unsaved-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
}

/**
 * Handle checkbox changes
 * @param {HTMLInputElement} checkbox - The checkbox that changed
 */
function handleCheckboxChange(checkbox) {
    // Track configuration changes
    if (checkbox.closest('#configContent')) {
        state.ui.hasUnsavedConfigChanges = true;
        updateUnsavedChangesIndicator();
    }
    
    const checkboxHandlers = {
        'enableInitialFee': checked => {
            state.options.enableInitialFee = checked;
            setDisplay('initialFeeContainer', checked);
        },
        'enableResidualPercentage': checked => {
            state.options.enableResidualPercentage = checked;
            setDisplay('residualPercentageContainer', checked);
            updateProfitOptionClasses();
        },
        'useCustomMarkup': checked => {
            if (state.options.enableAutoCostOptimization && checked) {
                $('useCustomMarkup').checked = false;
                return;
            }
            state.options.useCustomMarkup = checked;
            setDisplay('markupSliderContainer', checked);
            updateProfitOptionClasses();
        },
        'enableAutoCostOptimization': checked => {
            state.options.enableAutoCostOptimization = checked;
            if (checked) {
                $('useCustomMarkup').checked = false;
                state.options.useCustomMarkup = false;
                setDisplay('markupSliderContainer', false);
            }
            updateProfitOptionClasses();
        },
        'includeTransport': checked => state.options.includeTransport = checked,
        'includeMaterials': checked => state.options.includeMaterials = checked,
        'includeEquipment': checked => state.options.includeEquipment = checked,
        'isHoliday': checked => state.isHoliday = checked,
        'outsideHouston': checked => state.outsideHouston = checked,
        'useSubcontractor': checked => {
            state.useSubcontractor = checked;
            $('subcontractorDetails').classList.toggle('visible', checked);
        },
        'enableRounding': checked => state.options.enableRounding = checked,
        'includeInsurance': checked => state.includeInsurance = checked,
        'enableCommissionSplit': checked => {
            state.options.enableCommissionSplit = checked;
            setDisplay('splitCommissionContainer', checked);
            setDisplay('salesCommissionRow', !checked);
            setDisplay('splitCommissionRows', checked);
            updateCommissionSplitDisplay();
        }
    };
    
    if (checkboxHandlers[checkbox.id]) {
        checkboxHandlers[checkbox.id](checkbox.checked);
        saveSnapshot();
        calculateAll();
    }
}

/**
 * Handle numeric input changes
 * @param {HTMLInputElement} input - The input element that changed
 */
function handleNumericInput(input) {
    // Handle percentage inputs
    const percentageInputMap = {
        'regularSuppliesPercentage': 'regularSuppliesPercentage',
        'additionalEquipmentPercentage': 'additionalEquipmentPercentage',
        'uniformSafetyPercentage': 'uniformSafetyPercentage',
        'communicationsPercentage': 'communicationsPercentage',
        'overheadPercentage': 'overheadPercentage',
        'commissionPercentage': 'commissionPercentage',
        'residualPercentageValue': 'residualPercentageValue',
        'hoodLaborCostPerc': 'hoodLaborCostPerc',
        'hoodMaterialCostPerc': 'hoodMaterialCostPerc'
    };
    
    if (percentageInputMap[input.id]) {
        const value = parseFloat(input.value) || 0;
        
        if (input.id === 'residualPercentageValue') {
            state.options.residualPercentageValue = value;
            setContent('residualPercentageDisplay', value);
        } else if (input.id === 'commissionPercentage') {
            state.options.commissionPercentage = value;
            setContent('commissionPercentageDisplay', value);
        } else if (input.id === 'hoodLaborCostPerc') {
            state.hoodLaborCostPerc = value;
        } else if (input.id === 'hoodMaterialCostPerc') {
            state.hoodMaterialCostPerc = value;
        } else {
            state.options[input.id] = value;
        }
        
        updatePercentageDisplays();
        saveSnapshot();
        calculateAll();
        return;
    }
    
    // Handle commission split inputs
    if (input.classList.contains('commission-split-input')) {
        const index = parseInt(input.id.replace('commissionSplit', '')) - 1;
        if (!isNaN(index) && index >= 0 && index < state.options.commissionSplits.length) {
            state.options.commissionSplits[index] = parseFloat(input.value) || 0;
            updateCommissionSplitTotals();
            saveSnapshot();
            calculateAll();
        }
        return;
    }
    
    // Handle numeric value inputs
    const valueInputMap = {
        'workers': { stateKey: 'workers', min: 0 }, // Changed min to 0 to allow 0 workers
        'hours': { stateKey: 'hours', min: 1 },
        'days': { stateKey: 'days', min: 1 },
        'materials': { stateKey: 'materialsPerDay', min: 0 },
        'equipment': { stateKey: 'equipmentPerDay', min: 0 },
        'largeHoods': { stateKey: 'largeHoods', min: 0 },
        'smallHoods': { stateKey: 'smallHoods', min: 0 },
        'hoodFrequency': { stateKey: 'hoodCleaningFrequency', min: 1 },
        'subcontractorCost': { stateKey: 'subcontractorCost', min: 0 },
        'initialFeeValue': { stateKey: 'options.initialFeeValue', min: 0 },
        'markupInput': { stateKey: 'options.customMarkupPercentage', min: 20 }
    };
    
    if (valueInputMap[input.id]) {
        const { stateKey, min } = valueInputMap[input.id];
        validateInput(input);
        
        // Parse value and enforce minimum
        let value = Math.max(min, parseFloat(input.value) || min);
        
        // Special handling for markup input
        if (input.id === 'markupInput') {
            input.value = value;
            state.options.customMarkupPercentage = value;
            $('markupSlider').value = Math.min(500, value);
            saveSnapshot();
            calculateAll();
            return;
        }
        
        // Set state value
        if (stateKey.includes('.')) {
            const [obj, prop] = stateKey.split('.');
            state[obj][prop] = value;
        } else {
            state[stateKey] = value;
        }
        
        // Special validation: enforce at least workers=0 when there are hood cleanings
        if (input.id === 'workers' || input.id === 'largeHoods' || input.id === 'smallHoods') {
            validateWorkersWithHoods();
        }
        
        saveSnapshot();
        calculateAll();
    }
}

/**
 * Validate that we have workers or hoods
 */
function validateWorkersWithHoods() {
    // If there are no workers, there should be at least one hood
    if (state.workers === 0 && state.largeHoods === 0 && state.smallHoods === 0) {
        showNotification("You must have at least one worker or one hood to clean.", "error");
        state.workers = 1;
        $('workers').value = 1;
    }
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleKeyboardShortcuts(e) {
    // Only handle shortcuts with modifier keys
    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'z':
                if (e.shiftKey) {
                    e.preventDefault();
                    redo();
                } else {
                    e.preventDefault();
                    undo();
                }
                break;
            case 'p':
                e.preventDefault();
                preparePdfOrPrint('print');
                break;
            case 's':
                if ($('configTab').classList.contains('active')) {
                    e.preventDefault();
                    $('saveConfigBtn').click();
                }
                break;
            case 'd':
                e.preventDefault();
                toggleDarkMode();
                break;
        }
    }
}

// ===== Validation Functions =====

/**
 * Validate a single input field
 * @param {HTMLInputElement} input - Input to validate
 * @returns {boolean} - Whether the input is valid
 */
function validateInput(input) {
    const errorElement = document.getElementById(input.id + 'Error');
    if (!errorElement) return true;
    
    let isValid = true, errorMsg = '';
    const min = parseFloat(input.getAttribute('min'));
    const max = parseFloat(input.getAttribute('max'));
    const value = parseFloat(input.value);
    
    if (input.value === '' || isNaN(value)) {
        isValid = false;
        errorMsg = 'Please enter a valid number';
    } else if (!isNaN(min) && value < min) {
        isValid = false;
        errorMsg = `Minimum value is ${min}`;
    } else if (!isNaN(max) && value > max) {
        isValid = false;
        errorMsg = `Maximum value is ${max}`;
    }
    
    input.classList.toggle('invalid-input', !isValid);
    errorElement.style.display = isValid ? 'none' : 'block';
    if (!isValid) errorElement.textContent = errorMsg;
    input.setAttribute('aria-invalid', !isValid);
    
    return isValid;
}

/**
 * Validate all inputs in the form
 * @returns {boolean} - Whether all inputs are valid
 */
function validateAllInputs() {
    let isValid = true;
    document.querySelectorAll('input[type="number"]').forEach(input => {
        if (!validateInput(input)) isValid = false;
    });
    return isValid;
}

/**
 * Initialize validation for all input fields
 */
function initValidation() {
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('input', () => validateInput(input));
        validateInput(input);
    });
}

// ===== UI Update Functions =====

/**
 * Update profit option classes based on current state
 */
function updateProfitOptionClasses() {
    const customMarkupOption = $('customMarkupOption');
    const optimizeCostOption = $('optimizeCostOption');
    const residualOption = $('residualOption');
    
    // Reset classes first
    customMarkupOption.classList.remove('active', 'disabled');
    optimizeCostOption.classList.remove('active', 'disabled');
    residualOption.classList.remove('active');
    
    // Update based on state
    if (state.options.enableAutoCostOptimization) {
        optimizeCostOption.classList.add('active');
        customMarkupOption.classList.add('disabled');
        // Add accessibility attributes
        optimizeCostOption.setAttribute('aria-selected', true);
        customMarkupOption.setAttribute('aria-disabled', true);
    } else if (state.options.useCustomMarkup) {
        customMarkupOption.classList.add('active');
        customMarkupOption.setAttribute('aria-selected', true);
    }
    
    if (state.options.enableResidualPercentage) {
        residualOption.classList.add('active');
        residualOption.setAttribute('aria-selected', true);
    }
}

/**
 * Update percentage displays in UI
 */
function updatePercentageDisplays() {
    const percentageFields = ['regularSupplies', 'additionalEquipment', 'uniformSafety', 'communications', 'overhead'];
    percentageFields.forEach(field => {
        const percentage = state.options[field + 'Percentage'];
        document.querySelectorAll(`#${field}PercDisplay, #${field}PercDisplay2`).forEach(el => {
            if (el) el.textContent = percentage;
        });
    });
}

/**
 * Update hood price labels
 */
function updateHoodPriceLabels() {
    setContent('largeHoodPrice', `$${state.config.largeHoodPrice} each`);
    setContent('smallHoodPrice', `$${state.config.smallHoodPrice} each`);
}

/**
 * Update insurance details display
 */
function updateInsuranceDetails() {
    setContent('workCompDetails', `$${state.config.workCompRate} per $100 of labor cost`);
    setContent('generalLiabilityDetails', `$${state.config.glRate} per $1,000 of total price`);
}

/**
 * Update commission split input UI
 */
function updateCommissionSplitInputs() {
    const splitsWrapper = $('commissionSplitsWrapper');
    const splitRows = $('splitCommissionRowsContent');
    
    // Clear existing inputs and rows
    splitsWrapper.innerHTML = '';
    splitRows.innerHTML = '';
    
    // Create input for each split
    state.options.commissionSplits.forEach((percentage, index) => {
        // Create input field
        const inputContainer = document.createElement('div');
        inputContainer.className = 'percentage-option';
        inputContainer.style.marginBottom = '8px';
        inputContainer.innerHTML = `
            <label for="commissionSplit${index+1}">Commission ${index+1}</label>
            <input type="number" id="commissionSplit${index+1}" min="0" max="100" step="0.1" value="${percentage}" class="commission-split-input">
        `;
        
        // Add delete button if more than 2 splits
        if (state.options.commissionSplits.length > 2) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
            deleteBtn.style.marginLeft = '5px';
            deleteBtn.style.background = '#e74c3c';
            deleteBtn.style.color = 'white';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '4px';
            deleteBtn.style.padding = '3px 6px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.dataset.index = index;
            deleteBtn.setAttribute('aria-label', `Remove Commission ${index+1}`);
            deleteBtn.addEventListener('click', function() {
                const idx = parseInt(this.dataset.index);
                state.options.commissionSplits.splice(idx, 1);
                updateCommissionSplitInputs();
                saveSnapshot();
                calculateAll();
            });
            inputContainer.appendChild(deleteBtn);
        }
        
        splitsWrapper.appendChild(inputContainer);
        
        // Create result row
        const resultRow = document.createElement('div');
        resultRow.className = 'profit-row commission-split-row';
        resultRow.dataset.index = index + 1;
        resultRow.innerHTML = `
            <div class="label">Commission ${index+1} (<span class="commission-split-display">${percentage}</span>%):</div>
            <div class="value commission-split-value">$0.00</div>
        `;
        splitRows.appendChild(resultRow);
    });
    
    // Update totals
    updateCommissionSplitTotals();
}

/**
 * Update commission split totals
 */
function updateCommissionSplitTotals() {
    const totalPercentage = state.options.commissionSplits.reduce((sum, val) => sum + val, 0);
    setContent('totalCommissionSplit', totalPercentage + '%');
    setContent('totalCommissionSplitDisplay', totalPercentage);
}

/**
 * Update commission split display values
 * @param {Array} splitCommissions - Array of commission splits
 */
function updateCommissionSplitDisplay(splitCommissions) {
    splitCommissions.forEach((commission, index) => {
        const rows = document.querySelectorAll('.commission-split-row');
        if (index < rows.length) {
            const percentageDisplay = rows[index].querySelector('.commission-split-display');
            const valueDisplay = rows[index].querySelector('.commission-split-value');
            
            if (percentageDisplay) percentageDisplay.textContent = commission.percentage;
            if (valueDisplay) valueDisplay.textContent = formatCurrency(commission.amount);
            
            // Highlight if values changed
            if (valueDisplay) highlightElement(valueDisplay.id || `commission-split-value-${index}`);
        }
    });
}

/**
 * Show notification to user
 * @param {string} message - Message to display
 * @param {string} type - Notification type (success, error, warning)
 * @param {number} [duration=3000] - How long to show the notification
 */
function showNotification(message, type = 'info', duration = 3000) {
    // Check if notification container exists
    let container = document.querySelector('.notification-container');
    
    // Create container if it doesn't exist
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        container.setAttribute('role', 'alert');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
        
        // Add styles if not already in CSS
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                }
                .notification {
                    margin-bottom: 10px;
                    padding: 15px 25px 15px 15px;
                    border-radius: 4px;
                    width: 300px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    position: relative;
                    animation: slide-in 0.3s ease, fade-out 0.5s ease ${(duration - 500) / 1000}s forwards;
                    color: white;
                }
                .notification-success {
                    background-color: var(--success-green);
                }
                .notification-error {
                    background-color: var(--danger-red);
                }
                .notification-info {
                    background-color: var(--brand-blue);
                }
                .notification-warning {
                    background-color: var(--warning-orange);
                }
                .notification-close {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    cursor: pointer;
                    font-size: 16px;
                    color: rgba(255,255,255,0.8);
                }
                @keyframes slide-in {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fade-out {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                .highlight-change {
                    position: relative;
                    z-index: 1;
                    animation: highlight-pulse 1.5s ease-out;
                }
                @keyframes highlight-pulse {
                    0% { background-color: transparent; }
                    20% { background-color: rgba(39, 174, 96, 0.2); }
                    100% { background-color: transparent; }
                }
                .value-increased {
                    position: relative;
                }
                .value-increased::after {
                    content: "↑";
                    color: var(--danger-red);
                    position: absolute;
                    right: -15px;
                    top: 0;
                    font-weight: bold;
                }
                .value-decreased {
                    position: relative;
                }
                .value-decreased::after {
                    content: "↓";
                    color: var(--success-green);
                    position: absolute;
                    right: -15px;
                    top: 0;
                    font-weight: bold;
                }
                .unsaved-indicator {
                    color: var(--warning-orange);
                    font-weight: bold;
                    margin-left: 5px;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        ${message}
        <span class="notification-close" aria-label="Close notification">&times;</span>
    `;
    
    // Add to container
    container.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
        notification.remove();
    }, duration);
    
    // Close button functionality
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
}

// ===== Tab and Section Management =====

/**
 * Toggle a section's visibility
 * @param {string} sectionId - ID of section to toggle
 * @param {HTMLElement} button - Toggle button
 */
function toggleSection(sectionId, button) {
    const section = $(sectionId);
    const icon = button.querySelector('i');
    
    if (section.classList.contains('hidden-section')) {
        section.classList.remove('hidden-section');
        icon.className = 'fas fa-chevron-up';
        state.ui.sectionStates[sectionId] = 'open';
        button.setAttribute('aria-expanded', 'true');
        section.setAttribute('aria-hidden', 'false');
    } else {
        section.classList.add('hidden-section');
        icon.className = 'fas fa-chevron-down';
        state.ui.sectionStates[sectionId] = 'closed';
        button.setAttribute('aria-expanded', 'false');
        section.setAttribute('aria-hidden', 'true');
    }
}

/**
 * Show a specific content tab
 * @param {string} contentId - ID of content to show
 */
function showContent(contentId) {
    // Hide all content sections
    document.querySelectorAll('.calculator-content').forEach(section => {
        section.style.display = 'none';
        section.setAttribute('aria-hidden', 'true');
    });
    
    // Show requested section
    $(contentId).style.display = 'block';
    $(contentId).setAttribute('aria-hidden', 'false');
    
    // Update tab selection
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });
    
    // Set active tab
    let tabId;
    switch (contentId) {
        case 'quotationContent': tabId = 'quotationTab'; break;
        case 'configContent': tabId = 'configTab'; break;
        default: tabId = 'quotationTab';
    }
    
    $(tabId).classList.add('active');
    $(tabId).setAttribute('aria-selected', 'true');
}

/**
 * Reset calculator to default state
 */
function resetCalculator() {
    if (!confirm('Are you sure you want to reset the calculator? All current data will be lost.')) return;
    
    // Save UI state and config
    const uiSectionStates = state.ui.sectionStates;
    const isDarkMode = state.ui.isDarkMode;
    const savedConfig = GlobalState.config;
    
    // Reset state to defaults but keep saved config
    Object.assign(state, {
        useSubcontractor: false,
        subcontractorCost: 0,
        workers: 2,
        hours: 4,
        days: 1,
        materialsPerDay: 50,
        equipmentPerDay: 40,
        largeHoods: 0,
        smallHoods: 0,
        hoodCleaningFrequency: 1,
        hoodLaborCostPerc: 38,
        hoodMaterialCostPerc: 12,
        isHoliday: false,
        outsideHouston: false,
        includeInsurance: true,
        config: savedConfig,
        options: {
            includeTransport: true,
            includeMaterials: true,
            includeEquipment: true,
            enableRounding: true,
            roundingMethod: 'up',
            roundingValue: 50,
            useCustomMarkup: false,
            customMarkupPercentage: 120,
            commissionPercentage: 20,
            enableCommissionSplit: false,
            commissionSplits: [10, 10],
            regularSuppliesPercentage: 6,
            additionalEquipmentPercentage: 2.75,
            uniformSafetyPercentage: 2.5,
            communicationsPercentage: 1,
            overheadPercentage: 5,
            enableInitialFee: false,
            initialFeeValue: 150,
            enableResidualPercentage: false,
            residualPercentageValue: 10,
            enableAutoCostOptimization: false
        },
        ui: {
            sectionStates: uiSectionStates,
            operationalCostsExpanded: false,
            isDarkMode: isDarkMode,
            hasUnsavedConfigChanges: false,
            highlightedElements: new Set(),
            valueHistory: {},
            toastQueue: []
        }
    });
    
    // Reset history
    state.history = {
        snapshots: [],
        currentIndex: -1,
        maxSnapshots: 20
    };
    
    updateUIFromState();
    calculateAll();
    showContent('quotationContent');
    saveSnapshot();
    updateUnsavedChangesIndicator();
    showNotification('Calculator has been reset successfully.', 'success');
}

/**
 * Toggle dark mode styles
 */
function toggleDarkMode() {
    GlobalState.preferences.darkMode = !GlobalState.preferences.darkMode;
    document.body.classList.toggle('dark-mode', GlobalState.preferences.darkMode);
    state.ui.isDarkMode = GlobalState.preferences.darkMode;
    savePreferences();
    
    const btn = $('darkModeToggle');
    const icon = btn.querySelector('i');
    icon.className = state.ui.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    btn.setAttribute('aria-pressed', state.ui.isDarkMode);
    
    // Update message based on current mode
    showNotification(`${state.ui.isDarkMode ? 'Dark' : 'Light'} mode activated`, 'info');
}

// ===== Update UI From State =====

/**
 * Update UI to match state values
 */
function updateUIFromState() {
    // Basic fields
    $('useSubcontractor').checked = state.useSubcontractor;
    $('subcontractorDetails').classList.toggle('visible', state.useSubcontractor);
    $('subcontractorCost').value = state.subcontractorCost;
    $('workers').value = state.workers;
    $('hours').value = state.hours;
    $('days').value = state.days;
    $('materials').value = state.materialsPerDay;
    $('equipment').value = state.equipmentPerDay;
    $('isHoliday').checked = state.isHoliday;
    $('outsideHouston').checked = state.outsideHouston;
    $('includeInsurance').checked = state.includeInsurance;
    
    // Hood cleaning
    $('largeHoods').value = state.largeHoods;
    $('smallHoods').value = state.smallHoods;
    $('hoodFrequency').value = state.hoodCleaningFrequency;
    $('hoodLaborCostPerc').value = state.hoodLaborCostPerc;
    $('hoodMaterialCostPerc').value = state.hoodMaterialCostPerc;
    
    // Config values
    $('regularPayRate').value = state.config.regularPayRate;
    $('supervisorPayRate').value = state.config.supervisorPayRate;
    $('transportCostConfig').value = state.config.transportCostPerDay;
    $('outsideHoustonTransportConfig').value = state.config.outsideHoustonTransportCostPerDay;
    $('largeHoodPriceConfig').value = state.config.largeHoodPrice;
    $('smallHoodPriceConfig').value = state.config.smallHoodPrice;
    $('workCompRate').value = state.config.workCompRate;
    $('glRate').value = state.config.glRate;
    
    // Update display values
    updateHoodPriceLabels();
    updateInsuranceDetails();
    
    // Option checkboxes
    $('includeTransport').checked = state.options.includeTransport;
    $('includeMaterials').checked = state.options.includeMaterials;
    $('includeEquipment').checked = state.options.includeEquipment;
    $('enableAutoCostOptimization').checked = state.options.enableAutoCostOptimization;
    $('enableRounding').checked = state.options.enableRounding;
    $('enableCommissionSplit').checked = state.options.enableCommissionSplit;
    $('useCustomMarkup').checked = state.options.useCustomMarkup;
    $('enableInitialFee').checked = state.options.enableInitialFee;
    $('enableResidualPercentage').checked = state.options.enableResidualPercentage;
    
    // Toggle containers based on options
    $('splitCommissionContainer').style.display = state.options.enableCommissionSplit ? 'block' : 'none';
    $('salesCommissionRow').style.display = state.options.enableCommissionSplit ? 'none' : 'grid';
    $('splitCommissionRows').style.display = state.options.enableCommissionSplit ? 'block' : 'none';
    $('markupSliderContainer').style.display = state.options.useCustomMarkup ? 'block' : 'none';
    $('initialFeeContainer').style.display = state.options.enableInitialFee ? 'block' : 'none';
    $('residualPercentageContainer').style.display = state.options.enableResidualPercentage ? 'block' : 'none';
    
    // Update profit option visuals
    updateProfitOptionClasses();
    
    // Update slider and numeric inputs
    $('markupSlider').value = state.options.customMarkupPercentage;
    $('markupInput').value = state.options.customMarkupPercentage;
    $('initialFeeValue').value = state.options.initialFeeValue;
    $('residualPercentageValue').value = state.options.residualPercentageValue;
    $('residualPercentageDisplay').textContent = state.options.residualPercentageValue;
    $('regularSuppliesPercentage').value = state.options.regularSuppliesPercentage;
    $('additionalEquipmentPercentage').value = state.options.additionalEquipmentPercentage;
    $('uniformSafetyPercentage').value = state.options.uniformSafetyPercentage;
    $('communicationsPercentage').value = state.options.communicationsPercentage;
    $('overheadPercentage').value = state.options.overheadPercentage;
    $('commissionPercentage').value = state.options.commissionPercentage;
    $('commissionPercentageDisplay').textContent = state.options.commissionPercentage;
    
    // Update commission split inputs
    updateCommissionSplitInputs();
    
    // Update percentage displays
    updatePercentageDisplays();
    
    // Apply dark mode if enabled
    document.body.classList.toggle('dark-mode', state.ui.isDarkMode);
    if ($('darkModeToggle')) {
        const icon = $('darkModeToggle').querySelector('i');
        if (icon) icon.className = state.ui.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
        $('darkModeToggle').setAttribute('aria-pressed', state.ui.isDarkMode);
    }
    
    // Update unsaved changes indicator
    updateUnsavedChangesIndicator();
}

/**
 * Update UI based on subcontractor selection
 * @param {boolean} isSubcontractor - Whether using a subcontractor
 * @param {number} internalCost - Internal cost calculation
 * @param {number} subcontractorCost - Subcontractor cost
 * @param {number} extraBenefit - Extra benefit from using subcontractor
 */
function updateUIForSubcontractor(isSubcontractor, internalCost, subcontractorCost, extraBenefit) {
    if (isSubcontractor) {
        // Cross out internal costs since they're not what we'll actually pay
        document.querySelectorAll('#laborCost, #laborTax, #workCompCost, #transportCost, #materialsCost, #equipmentCost, #hoodCleaningCost')
            .forEach(el => el.classList.add('text-crossed'));
        
        // Explain they are reference costs for final price calculation
        const costsText = 'Reference cost used for final price calculation';
        setHTML('laborDetails', costsText);
        setHTML('laborTaxDetails', costsText);
        setHTML('workCompDetails', costsText);
        setHTML('transportDetails', costsText);
        setHTML('materialsDetails', costsText);
        setHTML('equipmentDetails', costsText);
        setHTML('hoodCleaningDetails', costsText);
        
        // Show subcontractor cost and additional benefit
        setContent('subcontractorCostDisplay', formatCurrency(subcontractorCost));
        setContent('extraBenefitValue', formatCurrency(extraBenefit));
        toggleClass('extraBenefitValue', 'text-highlight', extraBenefit > 0);
        
        // Show clearer text about savings
        setDisplay('extraBenefitRow', true);
        setHTML('extraBenefitDetails', 'Savings from using subcontractor instead of internal team (difference between internal costs and subcontractor cost)');
        
        // Also show these savings in profit breakdown section
        setDisplay('subcontractorSavingRow', true);
        setContent('subcontractorSaving', formatCurrency(extraBenefit));
    } else {
        // If not using a subcontractor, remove any cross-out styling
        document.querySelectorAll('#laborCost, #laborTax, #workCompCost, #transportCost, #materialsCost, #equipmentCost, #hoodCleaningCost')
            .forEach(el => el.classList.remove('text-crossed'));
        
        // Generate labor details text
        let laborDetails = '';
        if (state.workers > 0) {
            if (state.days === 1 && state.workers > 1) {
                laborDetails = `${state.workers-1} workers at ${formatCurrency(state.config.regularPayRate)}/hr × ${state.hours} hrs<br>` +
                            `1 supervisor at ${formatCurrency(state.config.supervisorPayRate)}/hr × ${state.hours} hrs`;
            } else if (state.workers > 0) {
                laborDetails = `${state.workers} workers at ${formatCurrency(state.config.regularPayRate)}/hr × ${state.hours} hrs × ${state.days} days`;
            }
            
            // Add hood labor costs if there are any hoods
            if (state.largeHoods > 0 || state.smallHoods > 0) {
                laborDetails += `<br>Plus hood cleaning labor costs`;
            }
        } else if (state.largeHoods > 0 || state.smallHoods > 0) {
            laborDetails = `Labor costs for hood cleaning only`;
        }
        
        // Set details for each row
        setHTML('laborDetails', laborDetails);
        setHTML('laborTaxDetails', "17% mandatory employment taxes on labor");
        setHTML('workCompDetails', `$${state.config.workCompRate} per $100 of labor cost`);
        
        // Transport details based on location
        let transportDetails = '';
        if (state.options.includeTransport) {
            const transportRate = state.outsideHouston ? 
                formatCurrency(state.config.outsideHoustonTransportCostPerDay) : 
                formatCurrency(state.config.transportCostPerDay);
            
            transportDetails = `${transportRate} per day × ${state.days} days`;
            
            if (state.days > 7) {
                transportDetails += " (with long-term contract discount)";
            }
            
            if (state.outsideHouston) {
                transportDetails += " - Outside Houston rate";
            }
        } else {
            transportDetails = "Transport cost excluded";
        }
        setHTML('transportDetails', transportDetails);
        
        // Materials and equipment details
        let materialsDetails = "";
        if (state.options.includeMaterials) {
            materialsDetails = `${formatCurrency(state.materialsPerDay)} per day × ${state.days} days`;
            
            // Add hood materials if there are any hoods
            if (state.largeHoods > 0 || state.smallHoods > 0) {
                materialsDetails += `<br>Plus materials for hood cleaning`;
            }
        } else {
            materialsDetails = "Materials cost excluded";
        }
        setHTML('materialsDetails', materialsDetails);
            
        setHTML('equipmentDetails', state.options.includeEquipment ? 
            `${formatCurrency(state.equipmentPerDay)} per day × ${state.days} days` : 
            "Equipment cost excluded");
    
        // Hood cleaning details
        let hoodDetails = '';
        if (state.largeHoods > 0) {
            hoodDetails += `${state.largeHoods} large hoods at $${state.config.largeHoodPrice} each<br>`;
        }
        if (state.smallHoods > 0) {
            hoodDetails += `${state.smallHoods} small hoods at $${state.config.smallHoodPrice} each<br>`;
        }
        if (state.hoodCleaningFrequency > 1) {
            hoodDetails += `Frequency: ${state.hoodCleaningFrequency} times (with discount)`;
        }
        
        if (state.largeHoods > 0 || state.smallHoods > 0) {
            hoodDetails += `<br>Labor: ${state.hoodLaborCostPerc}%, Materials: ${state.hoodMaterialCostPerc}% of price`;
        }
        
        setHTML('hoodCleaningDetails', hoodDetails);
        
        // Hide subcontractor-related rows
        setDisplay('extraBenefitRow', false);
        setDisplay('subcontractorSavingRow', false);
    }
}

// ===== Calculation Engine =====

/**
 * Perform all calculations and update the UI
 */
function calculateAll() {
    if (!validateAllInputs()) return;
    
    // Set loading state
    setLoadingState(true);
    
    // Use setTimeout to allow the browser to update the UI with the loading state
    setTimeout(() => {
        try {
            const { 
                useSubcontractor, subcontractorCost, workers, hours, days, materialsPerDay, 
                equipmentPerDay, largeHoods, smallHoods, hoodCleaningFrequency,
                hoodLaborCostPerc, hoodMaterialCostPerc, isHoliday, outsideHouston, includeInsurance, 
                config, options 
            } = state;
            
            // Calculate hood cleaning costs first
            let hoodCleaningCost = 0, showHoodCleaning = false;
            let hoodLaborCost = 0, hoodMaterialCost = 0;
            
            if (largeHoods > 0 || smallHoods > 0) {
                hoodCleaningCost = ((largeHoods * config.largeHoodPrice) + 
                                  (smallHoods * config.smallHoodPrice)) * hoodCleaningFrequency;
                
                // Apply quantity discount
                if (hoodCleaningFrequency > 1) {
                    hoodCleaningCost *= (0.9 - (Math.min(5, hoodCleaningFrequency) - 1) * 0.05);
                }
                
                // Calculate hood labor and material costs
                hoodLaborCost = hoodCleaningCost * (hoodLaborCostPerc / 100);
                hoodMaterialCost = hoodCleaningCost * (hoodMaterialCostPerc / 100);
                
                showHoodCleaning = true;
            }
            
            // Regular labor cost calculation
            let supervisors = 0, regularWorkers = workers;
            let regularLaborCost = 0;
            
            if (workers > 0) {
                if (days === 1 && workers > 1) {
                    supervisors = 1;
                    regularWorkers = workers - 1;
                }
                
                regularLaborCost = (regularWorkers * config.regularPayRate * hours * days) + 
                                (supervisors * config.supervisorPayRate * hours * days);
            }
            
            // Total labor cost (regular labor + hood labor)
            const laborCost = regularLaborCost + hoodLaborCost;
            const laborTax = laborCost * 0.17; // 17% tax on labor costs
            
            // Worker's Compensation
            const workCompCost = includeInsurance ? (laborCost * config.workCompRate / 100) : 0;
            
            // Transport cost calculation
            let transportCost = 0;
            if (options.includeTransport) {
                // Choose appropriate transport cost based on location
                const dailyTransportCost = outsideHouston ? 
                    config.outsideHoustonTransportCostPerDay : config.transportCostPerDay;
                transportCost = dailyTransportCost * days;
                
                // Apply discounts for longer contracts
                if (days > 7) transportCost *= 0.8;
                if (days > 21) transportCost *= 0.7;
            }
            
            // Materials and equipment (regular + hood materials)
            const materialsCost = options.includeMaterials ? (materialsPerDay * days) + hoodMaterialCost : hoodMaterialCost;
            const equipmentCost = options.includeEquipment ? equipmentPerDay * days : 0;
            
            // Base costs sum
            const baseCosts = laborCost + laborTax + workCompCost + transportCost + 
                            materialsCost + equipmentCost + hoodCleaningCost;
            
            // Operational costs calculation
            const regularSuppliesCost = baseCosts * (options.regularSuppliesPercentage / 100);
            const additionalEquipmentCost = baseCosts * (options.additionalEquipmentPercentage / 100);
            const uniformSafetyCost = baseCosts * (options.uniformSafetyPercentage / 100);
            const communicationsCost = baseCosts * (options.communicationsPercentage / 100);
            const overheadCost = baseCosts * (options.overheadPercentage / 100);
            
            // Total operational costs
            const operationalCosts = regularSuppliesCost + additionalEquipmentCost + 
                                  uniformSafetyCost + communicationsCost + overheadCost;
            
            // Subtotal
            const internalCostSubtotal = baseCosts + operationalCosts;
            const directCosts = internalCostSubtotal;
            const subtotal = internalCostSubtotal;
            
            // Apply residual percentage
            let residualPercentageAmount = 0;
            let adjustedSubtotal = subtotal;
            
            if (options.enableResidualPercentage) {
                residualPercentageAmount = subtotal * (options.residualPercentageValue / 100);
                adjustedSubtotal += residualPercentageAmount;
            }
            
            // Calculate markup percentage
            let markupPercentage = calculateMarkupPercentage(days);
            
            // Target cost percentage optimization
            const targetCostPercentage = 62;
            let isOptimizationActive = false;
            
            if (options.enableAutoCostOptimization) {
                isOptimizationActive = true;
                markupPercentage = Math.round(((directCosts * 100 / targetCostPercentage) / adjustedSubtotal - 1) * 100);
                markupPercentage = Math.max(20, markupPercentage);
            }
            
            // Apply markup
            const markup = adjustedSubtotal * (markupPercentage / 100);
            
            // Holiday surcharge
            const totalBeforeHoliday = adjustedSubtotal + markup;
            const holidaySurcharge = isHoliday ? totalBeforeHoliday * 0.25 : 0;
            
            // Total Price (before any rounding, initial fee, or insurance)
            let totalPrice = totalBeforeHoliday + holidaySurcharge;
            
            // Calculate General Liability Insurance
            const generalLiabilityCost = includeInsurance ? (totalPrice * config.glRate / 1000) : 0;
            
            // Initial Fee
            let initialFeeAmount = options.enableInitialFee ? options.initialFeeValue : 0;
            
            // Calculate grand total with rounding
            let preRoundingTotal = totalPrice + generalLiabilityCost + initialFeeAmount;
            let roundingAdjustment = 0;
            let grandTotal = preRoundingTotal;
            
            if (options.enableRounding) {
                const roundedTotal = roundAmount(preRoundingTotal, 'up', 50);
                roundingAdjustment = roundedTotal - preRoundingTotal;
                grandTotal = roundedTotal;
            }
            
            // Calculate cost and profit percentages
            let totalCostPercentage = 0;
            let extraBenefit = 0;
            
            if (useSubcontractor) {
                totalCostPercentage = Math.round((subcontractorCost / totalPrice) * 100);
                extraBenefit = internalCostSubtotal - subcontractorCost;
            } else {
                totalCostPercentage = Math.round((directCosts / totalPrice) * 100);
            }
            
            const totalProfitPercentage = 100 - totalCostPercentage;
            const isTargetAchieved = (totalCostPercentage === targetCostPercentage);
            
            // Net profit calculation
            let netProfit = 0;
            if (useSubcontractor) {
                netProfit = grandTotal - subcontractorCost;
            } else {
                netProfit = grandTotal - directCosts;
            }
            
            // Sales commission calculation
            let salesCommission = 0;
            let splitCommissions = [];
            
            if (options.enableCommissionSplit) {
                // Calculate each split commission
                let totalCommissionPercentage = 0;
                splitCommissions = options.commissionSplits.map(percentage => {
                    totalCommissionPercentage += percentage;
                    const commissionAmount = netProfit * (percentage / 100);
                    return { percentage, amount: commissionAmount };
                });
                
                // Total commission amount
                salesCommission = netProfit * (totalCommissionPercentage / 100);
            } else {
                // Standard commission
                salesCommission = netProfit * (options.commissionPercentage / 100);
            }
            
            // Final profit
            const finalCompanyProfit = netProfit - salesCommission;
            
            // Save results in state for easier access
            state.results = {
                laborCost,
                laborTax,
                workCompCost,
                transportCost,
                materialsCost,
                equipmentCost,
                hoodCleaningCost,
                operationalCosts,
                subtotal,
                residualPercentageAmount,
                markup,
                markupPercentage,
                holidaySurcharge,
                totalPrice,
                generalLiabilityCost,
                initialFeeAmount,
                roundingAdjustment,
                grandTotal,
                netProfit,
                costPercentage: totalCostPercentage,
                profitPercentage: totalProfitPercentage,
                salesCommission,
                finalCompanyProfit,
                extraBenefit,
                splitCommissions,
                isOptimizationActive,
                isTargetAchieved
            };
            
            // Update UI based on calculations
            updateUIForSubcontractor(useSubcontractor, internalCostSubtotal, subcontractorCost, extraBenefit);
            
            // Show/hide rows based on conditions
            setDisplay('holidayRow', isHoliday);
            setDisplay('hoodCleaningRow', showHoodCleaning);
            setDisplay('roundingRow', options.enableRounding);
            setDisplay('initialFeeRow', options.enableInitialFee);
            setDisplay('residualPercentageRow', options.enableResidualPercentage);
            setDisplay('workCompRow', includeInsurance);
            setDisplay('generalLiabilityRow', includeInsurance);
            setDisplay('grandTotalRow', true); // Always show
            setDisplay('salesCommissionRow', !options.enableCommissionSplit);
            setDisplay('splitCommissionRows', options.enableCommissionSplit);
            
            // Update split commission displays
            if (options.enableCommissionSplit) {
                updateCommissionSplitDisplay(splitCommissions);
                const totalSplitPercent = options.commissionSplits.reduce((sum, value) => sum + value, 0);
                setContent('totalCommissionSplitDisplay', totalSplitPercent);
                setContent('totalSplitCommission', formatCurrency(salesCommission));
            }
            
            // Show/hide optimization indicators
            setDisplay('optimizationBadge', isOptimizationActive);
            setDisplay('targetAchievedBadge', isTargetAchieved);
            
            // Update operational costs display
            setContent('operationalCostsValue', formatCurrency(operationalCosts));
            setContent('regularSuppliesValue', formatCurrency(regularSuppliesCost));
            setContent('additionalEquipmentValue', formatCurrency(additionalEquipmentCost));
            setContent('uniformSafetyValue', formatCurrency(uniformSafetyCost));
            setContent('communicationsValue', formatCurrency(communicationsCost));
            setContent('overheadValue', formatCurrency(overheadCost));
            
            if (options.enableInitialFee) {
                setContent('initialFeeAmount', formatCurrency(initialFeeAmount));
            }
            
            if (options.enableResidualPercentage) {
                setContent('residualPercentageDisplay', options.residualPercentageValue);
                setContent('residualPercentageAmount', formatCurrency(residualPercentageAmount));
            }
            
            // Display rounding details
            if (options.enableRounding) {
                setHTML('roundingDetails', 'Rounding Grand Total up to the next $50');
            }
            
            // Subcontractor UI updates
            setDisplay('subcontractorRow', useSubcontractor);
            setDisplay('extraBenefitRow', useSubcontractor);
            
            // Operational costs details display
            setDisplay('operationalCostsDetails', $('operationalCostsRow').classList.contains('expanded'));
            setDisplay('regularSuppliesRow', !useSubcontractor, 'flex');
            setDisplay('additionalEquipmentRow', !useSubcontractor, 'flex');
            setDisplay('uniformSafetyRow', !useSubcontractor, 'flex');
            
            // Cost percentage display
            setContent('totalCostPercentage', `${totalCostPercentage}%`);
            setContent('totalProfitPercentage', `${totalProfitPercentage}%`);
            $('costPercentageFill').style.width = `${totalCostPercentage}%`;
            $('costPercentageFill').setAttribute('aria-valuenow', totalCostPercentage);
            setContent('percentageTextOverlay', `${totalCostPercentage}%`);
            
            // Update total and grand total
            setContent('totalPrice', formatCurrency(totalPrice));
            setContent('generalLiabilityCost', formatCurrency(generalLiabilityCost));
            setContent('workCompCost', formatCurrency(workCompCost));
            setContent('roundingAdjustment', formatCurrency(roundingAdjustment));
            setContent('grandTotal', formatCurrency(grandTotal));
            
            // Update cost display
            setContent('laborCost', formatCurrency(laborCost));
            setContent('laborTax', formatCurrency(laborTax));
            setContent('transportCost', formatCurrency(transportCost));
            setContent('materialsCost', formatCurrency(materialsCost));
            setContent('equipmentCost', formatCurrency(equipmentCost));
            setContent('hoodCleaningCost', formatCurrency(hoodCleaningCost));
            setContent('subtotal', formatCurrency(subtotal));
            setContent('markup', formatCurrency(markup));
            setContent('markupPercentage', markupPercentage);
            setContent('profitMarkupPercentage', markupPercentage);
            setContent('holidaySurcharge', formatCurrency(holidaySurcharge));
            setContent('netProfit', formatCurrency(netProfit));
            setContent('salesCommission', formatCurrency(salesCommission));
            setContent('finalCompanyProfit', formatCurrency(finalCompanyProfit));
            setContent('profitMarkup', formatCurrency(markup));
            
            // Set color of cost percentage bar based on value
            if (totalCostPercentage > 75) {
                $('costPercentageFill').style.backgroundColor = '#e74c3c';
                $('finalCompanyProfit').classList.add('low-profit');
                $('finalCompanyProfit').classList.remove('high-profit');
            } else if (totalCostPercentage > 65) {
                $('costPercentageFill').style.backgroundColor = '#f39c12';
                $('finalCompanyProfit').classList.remove('low-profit');
                $('finalCompanyProfit').classList.remove('high-profit');
            } else {
                $('costPercentageFill').style.backgroundColor = '#27ae60';
                $('finalCompanyProfit').classList.remove('low-profit');
                $('finalCompanyProfit').classList.add('high-profit');
            }
            
            // Special coloring for 62% target
            if (isTargetAchieved) {
                $('costPercentageFill').style.backgroundColor = 'var(--optimize-color)';
            }
            
            // Set markup details text based on option
            let markupDetailsText = '';
            if (isOptimizationActive) {
                markupDetailsText = 'Automatically optimized for 62% cost ratio';
                $('markupRow').classList.add('optimization-active');
            } else if (options.useCustomMarkup) {
                markupDetailsText = 'Using custom markup percentage';
                $('markupRow').classList.remove('optimization-active');
            } else {
                markupDetailsText = `Calculated based on contract length of ${days} days`;
                $('markupRow').classList.remove('optimization-active');
            }
            setHTML('markupDetails', markupDetailsText);
            
            // Highlight key values that have changed
            highlightElement('grandTotal');
            highlightElement('finalCompanyProfit');
            highlightElement('netProfit');
            highlightElement('totalCostPercentage');
            
            // Clear loading state
            setLoadingState(false);
        } catch (error) {
            console.error("Calculation error:", error);
            setLoadingState(false);
            showNotification("There was an error during calculation. Please check your inputs.", "error");
        }
    }, 100); // Small delay to allow the loading indicator to render
}

// ===== PDF and Print Functions =====

/**
 * Prepare for PDF generation or printing
 * @param {string} mode - 'pdf' or 'print'
 */
function preparePdfOrPrint(mode) {
    // Add date stamp for printing
    document.querySelector('.profit-section').setAttribute('data-print-date', new Date().toLocaleDateString());
    
    if (mode === 'print') {
        // Show print preview modal first
        showPrintPreview();
    } else if (mode === 'pdf') {
        generatePDF();
    }
}

/**
 * Show print preview modal
 */
function showPrintPreview() {
    // Check if modal exists
    let modal = $('printPreviewModal');
    
    // Create modal if it doesn't exist
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'printPreviewModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal" aria-label="Close preview">&times;</span>
                <h2>Print Preview</h2>
                <p>Your quote is ready to print.</p>
                <div id="printPreviewContent"></div>
                <div class="modal-actions">
                    <button id="confirmPrintBtn" class="action-btn print-btn">
                        <i class="fas fa-print" aria-hidden="true"></i> Print Quote
                    </button>
                    <button class="action-btn" id="cancelPrintBtn">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listeners for the new modal
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.classList.remove('visible');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        });
        
        $('cancelPrintBtn').addEventListener('click', () => {
            modal.classList.remove('visible');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        });
        
        $('confirmPrintBtn').addEventListener('click', () => {
            modal.classList.remove('visible');
            setTimeout(() => { 
                modal.style.display = 'none';
                window.print();
            }, 300);
        });
    }
    
    // Clone summary content for preview
    const previewContent = $('printPreviewContent');
    previewContent.innerHTML = '';
    
    const contentClone = $('summaryContent').cloneNode(true);
    
    // Remove action buttons from clone
    const actionButtons = contentClone.querySelector('.action-buttons');
    if (actionButtons) {
        actionButtons.remove();
    }
    
    previewContent.appendChild(contentClone);
    
    // Show the modal
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('visible'), 10);
}

/**
 * Generate a PDF of the quote
 */
function generatePDF() {
    // Check if jsPDF is available
    const jsPdfAvailable = typeof window.jspdf !== 'undefined' || typeof jsPDF !== 'undefined';
     
    if (jsPdfAvailable) {
        // Generate PDF when jsPDF is loaded
        showNotification("Preparing PDF...", "info");
        
        try {
            // Create a clone of results section
            const quoteSummary = document.querySelector('#summaryContent').cloneNode(true);
            
            // Remove action buttons from the clone
            const actionButtons = quoteSummary.querySelector('.action-buttons');
            if (actionButtons) {
                actionButtons.remove();
            }
            
            // Style modifications for PDF
            const elements = quoteSummary.querySelectorAll('.result-section, .profit-section');
            elements.forEach(el => {
                el.style.backgroundColor = 'white';
                el.style.boxShadow = 'none';
                el.style.border = '1px solid #ccc';
            });
            
            // Create quote number
            const quoteNumber = 'PFS-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            
            // Create and format current date
            const currentDate = new Date();
            const formattedDate = currentDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            // Set up PDF document
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'p',
                unit: 'pt',
                format: 'a4',
                compress: true
            });
            
            // Define colors
            const brandBlue = '#03143A';
            const brandRed = '#C70532';
            
            // Add logo and header
            doc.setFillColor(brandBlue);
            doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, 'F');
            
            doc.setTextColor(255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('Prime Facility Services Group', 40, 35);
            
            doc.setFontSize(16);
            doc.setFont('helvetica', 'normal');
            doc.text('Professional Kitchen Cleaning Quote', 40, 60);
            
            // Add quote details
            doc.setTextColor(80);
            doc.setFillColor(245, 245, 245);
            doc.rect(0, 80, doc.internal.pageSize.getWidth(), 60, 'F');
            
            doc.setFontSize(12);
            doc.text(`Quote #: ${quoteNumber}`, 40, 100);
            doc.text(`Date: ${formattedDate}`, 40, 120);
            doc.text(`Valid until: ${new Date(currentDate.setMonth(currentDate.getMonth() + 1)).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}`, 300, 100);
            
            // Use html2canvas to render the quote content
            html2canvas(quoteSummary, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: 'white'
            }).then(canvas => {
                // Add quote content
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 520;
                const imgHeight = canvas.height * imgWidth / canvas.width;
                
                doc.addImage(imgData, 'PNG', 40, 160, imgWidth, imgHeight);
                
                // Add Terms & Conditions
                const footerY = 160 + imgHeight + 40;
                
                if (footerY < doc.internal.pageSize.getHeight() - 100) {
                    // Add terms and conditions
                    doc.setFillColor(245, 245, 245);
                    doc.rect(40, footerY, 520, 80, 'F');
                    
                    doc.setFontSize(10);
                    doc.setTextColor(80);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Terms & Conditions:', 50, footerY + 20);
                    
                    doc.setFont('helvetica', 'normal');
                    doc.text('This quote is valid for 30 days. Payment terms: 50% deposit, balance due upon completion.', 50, footerY + 40);
                    doc.text('All services are subject to our standard terms and conditions available upon request.', 50, footerY + 55);
                    doc.text('Please contact us with any questions or to schedule your service.', 50, footerY + 70);
                }
                
                // Add contact information
                doc.setDrawColor(200);
                doc.line(40, doc.internal.pageSize.getHeight() - 50, doc.internal.pageSize.getWidth() - 40, doc.internal.pageSize.getHeight() - 50);
                
                doc.setFontSize(9);
                doc.setTextColor(100);
                doc.text('Prime Facility Services Group | Phone: (713) 555-7890 | Email: info@primefacilityservices.com', doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 30, { align: 'center' });
                doc.text('www.primefacilityservicesgroup.com', doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 15, { align: 'center' });
                
                // Save the PDF
                doc.save(`kitchen-cleaning-quote-${quoteNumber}.pdf`);
                
                showNotification("PDF generated successfully!", "success");
            }).catch(err => {
                console.error('Error generating PDF:', err);
                showNotification("Error generating PDF. Please try again.", "error");
            });
        } catch (error) {
            console.error('PDF generation error:', error);
            showNotification("PDF generation failed. Please try printing instead.", "error");
        }
    } else {
        showNotification("PDF libraries not loaded. Please try printing instead.", "warning");
    }
}

/**
 * Capture screenshot of summary section
 */
function captureScreenshot() {
    try {
        // Check if html2canvas is available
        if (typeof html2canvas === 'undefined') {
            showNotification("Screenshot functionality requires the html2canvas library, which is not loaded.", "warning");
            return;
        }
        
        // Show loading notification
        showNotification("Creating screenshot...", "info");
        
        // Get the quote summary section
        const element = document.getElementById('summaryContent');
        
        // Use html2canvas to create a screenshot
        html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            allowTaint: false,
            backgroundColor: 'white'
        }).then(canvas => {
            // Show the modal
            const modal = document.getElementById('screenshotModal');
            modal.style.display = 'block';
            setTimeout(() => modal.classList.add('visible'), 10);
            
            // Clear previous screenshot
            const container = document.getElementById('screenshotContainer');
            container.innerHTML = '';
            
            // Add the canvas to the modal
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.borderRadius = '8px';
            canvas.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            container.appendChild(canvas);
            
            // Set up download link
            const downloadLink = document.getElementById('downloadLink');
            
            // Create quote number for filename
            const quoteNumber = 'PFS-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            
            // Set download attributes
            downloadLink.href = canvas.toDataURL('image/png');
            downloadLink.download = `kitchen-cleaning-quote-${quoteNumber}.png`;
            
            showNotification("Screenshot created successfully!", "success");
        }).catch(error => {
            console.error('Screenshot error:', error);
            showNotification("Error creating screenshot. Please try printing instead.", "error");
        });
    } catch (error) {
        console.error('Screenshot error:', error);
        showNotification("Error creating screenshot. Please try printing instead.", "error");
    }
}

// ===== Application Initialization =====

/**
 * Add loading indicator to the page
 */
function addLoadingIndicator() {
    // Create loading indicator if it doesn't exist
    if (!document.querySelector('.loading-indicator')) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.setAttribute('role', 'progressbar');
        loadingIndicator.setAttribute('aria-busy', 'true');
        loadingIndicator.setAttribute('aria-label', 'Loading...');
        document.body.appendChild(loadingIndicator);
    }
}

/**
 * Create undo/redo buttons if they don't exist
 */
function addUndoRedoButtons() {
    // Check if buttons already exist
    if ($('undoBtn')) return;
    
    // Find the tab navigation area
    const tabNav = document.querySelector('.nav-tabs');
    if (!tabNav) return;
    
    // Create undo button
    const undoBtn = document.createElement('button');
    undoBtn.id = 'undoBtn';
    undoBtn.className = 'nav-tab nav-tab-action';
    undoBtn.disabled = true;
    undoBtn.setAttribute('aria-disabled', true);
    undoBtn.setAttribute('aria-label', 'Undo last change');
    undoBtn.innerHTML = '<i class="fas fa-undo"></i>';
    undoBtn.addEventListener('click', undo);
    
    // Create redo button
    const redoBtn = document.createElement('button');
    redoBtn.id = 'redoBtn';
    redoBtn.className = 'nav-tab nav-tab-action';
    redoBtn.disabled = true; 
    redoBtn.setAttribute('aria-disabled', true);
    redoBtn.setAttribute('aria-label', 'Redo last change');
    redoBtn.innerHTML = '<i class="fas fa-redo"></i>';
    redoBtn.addEventListener('click', redo);
    
    // Add buttons before the dark mode toggle
    tabNav.insertBefore(undoBtn, $('darkModeToggle'));
    tabNav.insertBefore(redoBtn, $('darkModeToggle'));
}

/**
 * Add or update accessibility attributes
 */
function enhanceAccessibility() {
    // Add proper roles to main elements
    const container = document.querySelector('.container');
    if (container) container.setAttribute('role', 'application');
    
    // Add accessibility attributes to form elements
    document.querySelectorAll('input, select').forEach(el => {
        if (!el.hasAttribute('aria-label') && !el.getAttribute('id')) {
            const label = el.closest('.input-field')?.querySelector('label');
            if (label) {
                el.setAttribute('aria-label', label.textContent);
            }
        }
    });
    
    // Make expandable sections accessible
    document.querySelectorAll('.toggle-section').forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const target = $(targetId);
        
        if (target && btn) {
            btn.setAttribute('aria-expanded', !target.classList.contains('hidden-section'));
            btn.setAttribute('aria-controls', targetId);
            target.setAttribute('aria-hidden', target.classList.contains('hidden-section'));
        }
    });
    
    // Enhance options accessibility
    document.querySelectorAll('.profit-option').forEach(option => {
        option.setAttribute('role', 'option');
        if (option.classList.contains('active')) {
            option.setAttribute('aria-selected', 'true');
        }
        if (option.classList.contains('disabled')) {
            option.setAttribute('aria-disabled', 'true');
        }
    });
    
    // Make tooltips accessible
    document.querySelectorAll('.tooltip').forEach(tooltip => {
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('tabindex', '0');
    });
}

/**
 * Initialize the application
 */
function initApp() {
    // Add loading indicator
    addLoadingIndicator();
    
    // Add undo/redo buttons
    addUndoRedoButtons();
    
    // Initialize event listeners
    initEventListeners();
    
    // Initialize validation
    initValidation();
    
    // Enhance accessibility
    enhanceAccessibility();
    
    // Update UI labels from config
    updateHoodPriceLabels();
    
    // Apply stored preference for dark mode
    document.body.classList.toggle('dark-mode', GlobalState.preferences.darkMode);
    
    // Perform initial calculation
    calculateAll();
    
    // Check for missing required libraries
    const support = checkBrowserSupport();
    
    if (!support.html2canvas || !support.jsPDF) {
        console.warn('Some export libraries not loaded. PDF or screenshot functionality may be limited.');
    }
    
    // Welcome notification for first-time users
    if (support.localStorage) {
        if (!localStorage.getItem('welcomeShown')) {
            setTimeout(() => {
                showNotification("Welcome to the Kitchen Cleaning Calculator! Enter your details and get an instant quote.", "info", 6000);
                localStorage.setItem('welcomeShown', 'true');
            }, 1000);
        }
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);