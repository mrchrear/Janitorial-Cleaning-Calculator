// Timesheet Calculator module
'use strict';

function initTimesheet() {
    const container = document.getElementById('timesheetApp');
    if (!container) return;

    container.innerHTML = `
        <table class="timesheet-table" id="timesheetTable">
            <thead>
                <tr>
                    <th>Position</th>
                    <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th>
                    <th>Thu</th><th>Fri</th><th>Sat</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody id="timesheetBody"></tbody>
        </table>
        <button id="addRowBtn" class="btn btn-primary" style="margin-top:10px;">Add Row</button>
        <div id="timesheetSummary" style="margin-top:20px;"></div>
    `;

    const body = document.getElementById('timesheetBody');
    document.getElementById('addRowBtn').addEventListener('click', addRow);

    function addRow() {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" class="ts-position"></td>
            ${Array(7).fill(0).map(() => '<td><input type="number" min="0" step="0.1" class="ts-hour" value="0"></td>').join('')}
            <td class="row-total">0</td>
        `;
        body.appendChild(row);
        row.querySelectorAll('.ts-hour').forEach(input => input.addEventListener('input', updateTotals));
    }

    function updateTotals() {
        const rows = body.querySelectorAll('tr');
        let grandTotal = 0;
        rows.forEach(row => {
            const hours = Array.from(row.querySelectorAll('.ts-hour')).map(i => parseFloat(i.value) || 0);
            const total = hours.reduce((a,b) => a + b, 0);
            row.querySelector('.row-total').textContent = total.toFixed(1);
            grandTotal += total;
        });
        document.getElementById('timesheetSummary').textContent = `Total Hours: ${grandTotal.toFixed(1)}`;
    }

    addRow();
}

document.addEventListener('DOMContentLoaded', initTimesheet);
