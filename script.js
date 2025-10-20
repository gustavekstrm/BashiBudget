/*
Bashins Budget - JavaScript Logic
Komplett state management, localStorage operations, rendering och event handling
Alla funktioner för budget-tracking, utgifter, inkomster och data persistence
*/

// ===== KONSTANTER & STATE =====
const LS_KEY = 'bashinsBudgetData_v1';

// Standard data struktur
const DEFAULT = {
    expenseCategories: [
        'Hyra', 'Mat', 'Egenvård', 'Transport', 'Nöje', 'Abonnemang', 
        'Kläder', 'Presenter', 'Resor', 'Hälsa & träning', 'Sparande', 'Övrigt'
    ],
    incomeCategories: ['CSN', 'Jobb', 'Extra'],
    budgets: {},             // objekt: kategori -> nummer
    expenses: [],            // array av { id, category, amount, desc, date }
    incomes: []              // array av { id, source, amount, date }
};

// Global app state
let state = { ...DEFAULT };

// Variabel för att spåra osparade ändringar
let hasUnsavedChanges = false;
let reminderTimer = null;

// ===== HJÄLPFUNKTIONER =====

/**
 * Formaterar nummer som svensk valuta
 * @param {number} n - Nummer att formatera
 * @returns {string} Formaterat belopp med "kr"
 */
function formatCurrency(n) {
    const num = toNumber(n);
    return num.toLocaleString('sv-SE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }) + ' kr';
}

/**
 * Konverterar värde till nummer med felhantering
 * @param {any} value - Värde att konvertera
 * @returns {number} Konverterat nummer eller 0
 */
function toNumber(value) {
    const num = Number(value);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100; // Avrunda till 2 decimaler
}

/**
 * Genererar unikt ID för transaktioner
 * @returns {string} Unikt ID
 */
function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

/**
 * Visar användarmeddelande
 * @param {string} message - Meddelande att visa
 * @param {string} type - Typ av meddelande ('success', 'error', 'info')
 */
function showMessage(message, type = 'info') {
    // Enkel alert för nu, kan utökas med toast-komponent senare
    alert(message);
}

/**
 * Markerar att det finns osparade ändringar
 */
function markUnsavedChanges() {
    hasUnsavedChanges = true;
    startReminderTimer();
}

/**
 * Markerar att ändringar har sparats
 */
function markSavedChanges() {
    hasUnsavedChanges = false;
    clearReminderTimer();
}

/**
 * Startar timer för påminnelse om osparade ändringar
 */
function startReminderTimer() {
    // Rensa befintlig timer om den finns
    clearReminderTimer();
    
    // Visa påminnelse efter 2 minuter av inaktivitet
    reminderTimer = setTimeout(() => {
        if (hasUnsavedChanges) {
            showReminder();
        }
    }, 2 * 60 * 1000); // 2 minuter
}

/**
 * Rensar påminnelse-timer
 */
function clearReminderTimer() {
    if (reminderTimer) {
        clearTimeout(reminderTimer);
        reminderTimer = null;
    }
}

/**
 * Visar påminnelse om att spara
 */
function showReminder() {
    const shouldSave = confirm('Har du kommit ihåg att spara din budget/dina utgifter?');
    
    if (shouldSave) {
        // Användaren bekräftar att de ska spara
        saveState();
        markSavedChanges();
        showMessage('Perfekt! Budgeten och utgifterna är sparade. 💛', 'success');
    } else {
        // Användaren vill inte spara just nu, starta timer igen
        startReminderTimer();
    }
}

// ===== LOCALSTORAGE OPERATIONER =====

/**
 * Sparar aktuell state till localStorage
 */
function saveState() {
    try {
        // Dubbel-kontroll: se till att state är giltigt innan sparning
        if (!state || typeof state !== 'object') {
            console.error('Ogiltig state, kan inte sparas');
            return false;
        }
        
        const stateString = JSON.stringify(state);
        if (!stateString || stateString === '{}') {
            console.error('Tom eller ogiltig state data');
            return false;
        }
        
        localStorage.setItem(LS_KEY, stateString);
        
        // Verifiera att det faktiskt sparades
        const verification = localStorage.getItem(LS_KEY);
        if (verification === stateString) {
            markSavedChanges(); // Markera att ändringar är sparade
            console.log('State säkert sparad till localStorage:', state);
            return true;
        } else {
            console.error('Kunde inte verifiera sparning');
            return false;
        }
    } catch (error) {
        console.error('Fel vid sparande till localStorage:', error);
        showMessage('Kunde inte spara data. Kontrollera att webbläsaren har tillräckligt med utrymme.', 'error');
        return false;
    }
}

/**
 * Laddar state från localStorage eller använder default
 */
function loadState() {
    try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Validera att sparad data har rätt struktur
            if (parsed && typeof parsed === 'object') {
                state = {
                    expenseCategories: parsed.expenseCategories || DEFAULT.expenseCategories,
                    incomeCategories: parsed.incomeCategories || DEFAULT.incomeCategories,
                    budgets: parsed.budgets || {},
                    expenses: parsed.expenses || [],
                    incomes: parsed.incomes || []
                };
                console.log('State laddad från localStorage');
                return true;
            }
        }
    } catch (error) {
        console.error('Fel vid laddning från localStorage:', error);
        showMessage('Kunde inte ladda sparad data. Använder standardinställningar.', 'error');
    }
    
    // Fallback till default data
    state = { ...DEFAULT };
    return false;
}

/**
 * Återställer state till default och rensar localStorage
 */
function resetState() {
    if (confirm('Är du säker på att du vill återställa all data? Detta kan inte ångras.')) {
        try {
            localStorage.removeItem(LS_KEY);
            state = { ...DEFAULT };
            showMessage('All data har återställts till standardinställningar.', 'success');
            renderAll();
        } catch (error) {
            console.error('Fel vid återställning:', error);
            showMessage('Kunde inte återställa data.', 'error');
        }
    }
}

// ===== RENDERING FUNKTIONER =====

/**
 * Huvudrenderare - anropar alla underfunktioner
 */
function renderAll() {
    populateExpenseSelect();
    renderBudgetTable();
    renderTxList();
    renderIncomeList();
    updateTotals();
}

/**
 * Fyller expense category select med kategorier
 */
function populateExpenseSelect() {
    const select = document.getElementById('expenseCategory');
    if (!select) return;
    
    select.innerHTML = '';
    state.expenseCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
}

/**
 * Renderar budget tabellen med alla kategorier
 */
function renderBudgetTable() {
    const tbody = document.getElementById('budgetBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    state.expenseCategories.forEach(category => {
        const row = document.createElement('tr');
        
        // Kategori
        const catCell = document.createElement('td');
        catCell.textContent = category;
        row.appendChild(catCell);
        
        // Startbudget input
        const budgetCell = document.createElement('td');
        const budgetInput = document.createElement('input');
        budgetInput.type = 'number';
        budgetInput.step = '0.01';
        budgetInput.min = '0';
        budgetInput.value = state.budgets[category] || 0;
        budgetInput.placeholder = '0';
        budgetInput.addEventListener('input', (e) => {
            const value = toNumber(e.target.value);
            state.budgets[category] = value;
            updateTotals();
            saveState(); // Auto-save budget ändringar direkt
        });
        budgetCell.appendChild(budgetInput);
        row.appendChild(budgetCell);
        
        // Utgifter (beräknat)
        const spentCell = document.createElement('td');
        const spent = state.expenses
            .filter(exp => exp.category === category)
            .reduce((sum, exp) => sum + toNumber(exp.amount), 0);
        spentCell.textContent = formatCurrency(spent);
        spentCell.style.textAlign = 'right';
        row.appendChild(spentCell);
        
        // Återstående (beräknat)
        const remainingCell = document.createElement('td');
        const budget = toNumber(state.budgets[category] || 0);
        const remaining = budget - spent;
        
        // Visar beloppet med minus om negativt
        if (remaining < 0) {
            remainingCell.textContent = '-' + formatCurrency(Math.abs(remaining));
        } else {
            remainingCell.textContent = formatCurrency(remaining);
        }
        
        remainingCell.style.textAlign = 'right';
        remainingCell.style.fontWeight = '600';
        
        // Färgkodning baserat på återstående belopp
        if (remaining < 0) {
            remainingCell.style.color = '#dc3545'; // Röd för negativt
        } else {
            remainingCell.style.color = '#28a745'; // Grön för positivt
        }
        
        row.appendChild(remainingCell);
        tbody.appendChild(row);
    });
}

/**
 * Renderar senaste transaktioner i listan
 */
function renderTxList() {
    const container = document.getElementById('txList');
    if (!container) return;
    
    // Sortera transaktioner efter datum (nyaste först)
    const sortedExpenses = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sortedExpenses.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 1rem;">Inga transaktioner än</p>';
        return;
    }
    
    container.innerHTML = '';
    
    // Visa max 10 senaste transaktioner
    sortedExpenses.slice(0, 10).forEach(expense => {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        
        const info = document.createElement('div');
        info.className = 'transaction-info';
        
        const category = document.createElement('div');
        category.className = 'transaction-category';
        category.textContent = expense.category;
        
        const desc = document.createElement('div');
        desc.className = 'transaction-desc';
        desc.textContent = expense.desc || 'Ingen beskrivning';
        
        info.appendChild(category);
        info.appendChild(desc);
        
        const amount = document.createElement('span');
        amount.className = 'transaction-amount';
        amount.textContent = formatCurrency(expense.amount);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Ta bort';
        deleteBtn.addEventListener('click', () => deleteExpense(expense.id));
        
        item.appendChild(info);
        item.appendChild(amount);
        item.appendChild(deleteBtn);
        container.appendChild(item);
    });
}

/**
 * Renderar inkomstlistan
 */
function renderIncomeList() {
    const container = document.getElementById('incomeList');
    if (!container) return;
    
    // Sortera inkomster efter datum (nyaste först)
    const sortedIncomes = [...state.incomes].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sortedIncomes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 1rem;">Inga inkomster registrerade</p>';
        return;
    }
    
    container.innerHTML = '';
    
    sortedIncomes.forEach(income => {
        const item = document.createElement('div');
        item.className = 'income-item';
        
        const info = document.createElement('div');
        info.className = 'income-info';
        
        const source = document.createElement('div');
        source.className = 'income-source';
        source.textContent = income.source;
        
        const date = document.createElement('div');
        date.className = 'income-date';
        date.textContent = new Date(income.date).toLocaleDateString('sv-SE');
        
        info.appendChild(source);
        info.appendChild(date);
        
        const amount = document.createElement('span');
        amount.className = 'income-amount';
        amount.textContent = formatCurrency(income.amount);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Ta bort';
        deleteBtn.addEventListener('click', () => deleteIncome(income.id));
        
        item.appendChild(info);
        item.appendChild(amount);
        item.appendChild(deleteBtn);
        container.appendChild(item);
    });
}

/**
 * Beräknar total inkomst för månaden
 */
function calculateTotalIncome() {
    return state.incomes.reduce((sum, income) => sum + toNumber(income.amount), 0);
}

/**
 * Beräknar totala utgifter för månaden
 */
function calculateTotalExpenses() {
    return state.expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
}

/**
 * Uppdaterar total summering (inkomster - utgifter)
 */
function updateTotals() {
    // Beräkna totals
    const totalIncome = calculateTotalIncome();
    const totalExpenses = calculateTotalExpenses();
    const remaining = totalIncome - totalExpenses;
    
    // Uppdatera total inkomst
    const totalIncomeElement = document.getElementById('totalIncome');
    if (totalIncomeElement) {
        totalIncomeElement.textContent = formatCurrency(totalIncome);
    }
    
    // Uppdatera summary breakdown
    const summaryIncomeElement = document.getElementById('summaryIncome');
    if (summaryIncomeElement) {
        summaryIncomeElement.textContent = formatCurrency(totalIncome);
    }
    
    const summaryExpensesElement = document.getElementById('summaryExpenses');
    if (summaryExpensesElement) {
        summaryExpensesElement.textContent = formatCurrency(totalExpenses);
    }
    
    // Uppdatera kvarvarande
    const totalElement = document.getElementById('totalRemaining');
    if (totalElement) {
        // Visar beloppet med minus om negativt
        if (remaining < 0) {
            totalElement.textContent = '-' + formatCurrency(Math.abs(remaining));
        } else {
            totalElement.textContent = formatCurrency(remaining);
        }
        
        // Färgkodning för kvarvarande
        if (remaining < 0) {
            totalElement.style.color = '#dc3545'; // Röd för negativt
        } else {
            totalElement.style.color = '#28a745'; // Grön för positivt
        }
    }
}

// ===== EVENT HANDLERS =====

/**
 * Startar appen - visar dashboard
 */
function onStart() {
    const startCard = document.getElementById('startCard');
    const dashboard = document.getElementById('dashboard');
    
    if (startCard && dashboard) {
        startCard.style.display = 'none';
        dashboard.style.display = 'block';
        renderAll();
    }
}

/**
 * Laddar tidigare data om det finns
 */
function onLoad() {
    const hasData = loadState();
    if (hasData) {
        onStart();
        showMessage('Tidigare data har laddats!', 'success');
    } else {
        showMessage('Ingen tidigare data hittades. Startar med standardinställningar.', 'info');
        onStart();
    }
}

/**
 * Lägger till ny utgift
 */
function onAddExpense() {
    const category = document.getElementById('expenseCategory')?.value;
    const desc = document.getElementById('expenseDesc')?.value?.trim();
    const amount = document.getElementById('expenseAmount')?.value;
    
    if (!category) {
        showMessage('Välj en kategori för utgiften.', 'error');
        return;
    }
    
    const numAmount = toNumber(amount);
    if (numAmount <= 0) {
        showMessage('Ange ett giltigt belopp (större än 0).', 'error');
        return;
    }
    
    const expense = {
        id: generateId(),
        category: category,
        amount: numAmount,
        desc: desc || 'Ingen beskrivning',
        date: new Date().toISOString()
    };
    
    state.expenses.push(expense);
    
    // Rensa formulär
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
    
    renderAll();
    
    // Auto-save för att säkerställa att inget försvinner
    const saved = saveState();
    if (saved) {
        markUnsavedChanges(); // Markera ändring för påminnelse-systemet
        showMessage(`Utgift på ${formatCurrency(numAmount)} för ${category} har lagts till!`, 'success');
    } else {
        showMessage(`Utgift lagd till men kunde inte sparas automatiskt. Klicka "Spara" för att säkerställa sparning.`, 'error');
    }
}

/**
 * Lägger till ny inkomst
 */
function onAddIncome() {
    const source = document.getElementById('incomeSource')?.value;
    const amount = document.getElementById('incomeAmount')?.value;
    
    if (!source) {
        showMessage('Välj en inkomstkälla.', 'error');
        return;
    }
    
    const numAmount = toNumber(amount);
    if (numAmount <= 0) {
        showMessage('Ange ett giltigt belopp (större än 0).', 'error');
        return;
    }
    
    const income = {
        id: generateId(),
        source: source,
        amount: numAmount,
        date: new Date().toISOString()
    };
    
    state.incomes.push(income);
    
    // Rensa formulär
    document.getElementById('incomeAmount').value = '';
    
    renderAll();
    
    // Auto-save för att säkerställa att inget försvinner
    const saved = saveState();
    if (saved) {
        markUnsavedChanges(); // Markera ändring för påminnelse-systemet
        showMessage(`Inkomst på ${formatCurrency(numAmount)} från ${source} har lagts till!`, 'success');
    } else {
        showMessage(`Inkomst lagd till men kunde inte sparas automatiskt. Klicka "Spara" för att säkerställa sparning.`, 'error');
    }
}


/**
 * Tar bort en utgift
 */
function deleteExpense(expenseId) {
    if (confirm('Är du säker på att du vill ta bort denna utgift?')) {
        state.expenses = state.expenses.filter(exp => exp.id !== expenseId);
        renderAll();
        
        // Auto-save för att säkerställa att inget försvinner
        const saved = saveState();
        if (saved) {
            markUnsavedChanges(); // Markera ändring för påminnelse-systemet
            showMessage('Utgiften har tagits bort.', 'success');
        } else {
            showMessage('Utgiften togs bort men kunde inte sparas automatiskt. Klicka "Spara" för att säkerställa sparning.', 'error');
        }
    }
}

/**
 * Tar bort en inkomst
 */
function deleteIncome(incomeId) {
    if (confirm('Är du säker på att du vill ta bort denna inkomst?')) {
        state.incomes = state.incomes.filter(inc => inc.id !== incomeId);
        renderAll();
        
        // Auto-save för att säkerställa att inget försvinner
        const saved = saveState();
        if (saved) {
            markUnsavedChanges(); // Markera ändring för påminnelse-systemet
            showMessage('Inkomsten har tagits bort.', 'success');
        } else {
            showMessage('Inkomsten togs bort men kunde inte sparas automatiskt. Klicka "Spara" för att säkerställa sparning.', 'error');
        }
    }
}

/**
 * Exporterar data som JSON-fil
 */
function onExport() {
    try {
        const dataStr = JSON.stringify(state, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `bashins-budget-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showMessage('Data har exporterats som JSON-fil!', 'success');
    } catch (error) {
        console.error('Fel vid export:', error);
        showMessage('Kunde inte exportera data.', 'error');
    }
}

/**
 * Sparar budget explicit (användarbekräftelse) - dubbelkolla sparning
 */
function onSaveBudget() {
    const saved = saveState();
    if (saved) {
        showMessage('Budget sparad! Du kan nu återbesöka denna budget senare. 💛', 'success');
    } else {
        showMessage('Fel vid budgetsparning - försök igen.', 'error');
    }
}

/**
 * Sparar data explicit (användarbekräftelse) - dubbelkolla att allt sparas
 */
function onSaveClick() {
    const saved = saveState();
    if (saved) {
        showMessage('All data är säkert sparad! 💛', 'success');
    } else {
        showMessage('Fel vid sparning - försök igen eller kontrollera webbläsarens inställningar.', 'error');
    }
}


// ===== INITIERING =====

/**
 * Sätter upp event listeners när sidan laddas
 */
function initializeApp() {
    // Start knappar
    document.getElementById('startBtn')?.addEventListener('click', onStart);
    document.getElementById('loadBtn')?.addEventListener('click', onLoad);
    
    // Dashboard knappar
    document.getElementById('addExpenseBtn')?.addEventListener('click', onAddExpense);
    document.getElementById('addIncomeBtn')?.addEventListener('click', onAddIncome);
    document.getElementById('saveBudgetBtn')?.addEventListener('click', onSaveBudget);
    document.getElementById('exportBtn')?.addEventListener('click', onExport);
    document.getElementById('resetBtn')?.addEventListener('click', resetState);
    document.getElementById('saveBtn')?.addEventListener('click', onSaveClick);
    
    // Enter-tangent för formulär
    document.getElementById('expenseAmount')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') onAddExpense();
    });
    
    document.getElementById('incomeAmount')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') onAddIncome();
    });
    
    console.log('Bashins Budget initialiserad!');
    
    // Starta påminnelse-systemet
    markSavedChanges(); // Initiera som sparad från början
}

// Starta appen när DOM är redo
document.addEventListener('DOMContentLoaded', initializeApp);
