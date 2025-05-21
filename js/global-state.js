const GlobalState = {
  config: {
    regularPayRate: 16,
    supervisorPayRate: 18,
    taxRate: 0.17
  },
  preferences: {
    darkMode: false
  }
};

function loadPreferences() {
  const stored = localStorage.getItem('preferences');
  if (stored) {
    try {
      Object.assign(GlobalState.preferences, JSON.parse(stored));
    } catch (e) {}
  }
  document.body.classList.toggle('dark-mode', GlobalState.preferences.darkMode);
}

function savePreferences() {
  localStorage.setItem('preferences', JSON.stringify(GlobalState.preferences));
}

function toggleDarkMode() {
  GlobalState.preferences.darkMode = !GlobalState.preferences.darkMode;
  document.body.classList.toggle('dark-mode', GlobalState.preferences.darkMode);
  savePreferences();
}

function switchCalculator(name) {
  const kitchen = document.getElementById('kitchenCalculator');
  const timesheet = document.getElementById('timesheetCalculator');
  if (!kitchen || !timesheet) return;

  if (name === 'kitchen') {
    kitchen.classList.remove('hidden-calculator');
    timesheet.classList.add('hidden-calculator');
  } else if (name === 'timesheet') {
    timesheet.classList.remove('hidden-calculator');
    kitchen.classList.add('hidden-calculator');
  }
}

window.GlobalState = GlobalState;
window.loadPreferences = loadPreferences;
window.toggleDarkMode = toggleDarkMode;
window.switchCalculator = switchCalculator;
