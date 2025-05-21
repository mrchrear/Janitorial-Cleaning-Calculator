// Central application logic for calculator selector and shared state
'use strict';

const globalState = {
    regularPayRate: 15,
    supervisorPayRate: 18,
    workCompRate: 6, // dollars per $100
    darkMode: false,
};

function initSelectors() {
    const kitchenBtn = document.getElementById('kitchenCalcBtn');
    const timesheetBtn = document.getElementById('timesheetCalcBtn');
    const kitchenPanel = document.getElementById('kitchenCalculator');
    const timesheetPanel = document.getElementById('timesheetCalculator');

    kitchenBtn.addEventListener('click', () => switchCalc('kitchen'));
    timesheetBtn.addEventListener('click', () => switchCalc('timesheet'));

    function switchCalc(type) {
        const isKitchen = type === 'kitchen';
        kitchenBtn.classList.toggle('active', isKitchen);
        timesheetBtn.classList.toggle('active', !isKitchen);
        kitchenBtn.setAttribute('aria-selected', isKitchen);
        timesheetBtn.setAttribute('aria-selected', !isKitchen);
        kitchenPanel.hidden = !isKitchen;
        timesheetPanel.hidden = isKitchen;
    }
}

document.addEventListener('DOMContentLoaded', initSelectors);
