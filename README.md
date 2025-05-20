# Janitorial Cleaning Calculator

This project is a single-page web application for generating professional kitchen cleaning quotes. All logic lives in `app.js` while the UI is built from `index.html` and `styles.css`.

## Opening the Application

1. Clone or download this repository.
2. Open `index.html` directly in a modern web browser.

The application loads **html2canvas** and **jsPDF** from CDN links (see the bottom of `index.html`). These libraries are needed for screenshot and PDF export features, so an internet connection is required when running the app for the first time.

## Main Features

- **Quick Quote** tab to calculate costs for labor, materials, equipment and hood cleaning.
- **Configuration** tab to adjust rates such as pay, transportation costs, and insurance percentages.
- **Breakdown** section showing a detailed profit analysis.
- Options to print the quote, download it as a PDF or capture an image of the results.
- Built-in dark mode toggle and advanced profit optimization options.
