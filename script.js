// --- Constants & State ---
const BUSINESS_KEY = 'billing_app_business_setup';
const PRODUCTS_KEY = 'billing_app_products';
const PASSWORD_KEY = 'billing_app_secret_password';
const BILLING_HISTORY_KEY = 'billing_app_history';
const BILL_NO_KEY = 'billNo'; 

let businessData = null;
let currentBillItems = [];
let availableProducts = [];
let isHistoryLoggedIn = false;

// --- Storage Helpers ---
function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
}

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) { return false; }
}

// --- Utility: Generate Bill ID ---
function generateBillId() {
    const datePrefix = new Date().toISOString().slice(0,10).replace(/-/g,'');
    let currentNo = parseInt(localStorage.getItem(BILL_NO_KEY)) || 1225;
    currentNo++;
    localStorage.setItem(BILL_NO_KEY, currentNo);
    return `${datePrefix}-${currentNo}`;
}

// --- Initialization ---
function init() {
    setupEventListeners();
    checkSetup();
    setupEnterNavigation(); 
}

function checkSetup() {
    businessData = loadFromLocalStorage(BUSINESS_KEY);
    availableProducts = loadFromLocalStorage(PRODUCTS_KEY) || [];
    if (businessData) {
        renderApp(true);
        const el = document.getElementById('business-name-display');
        if(el) el.textContent = businessData.businessName;
    } else {
        renderApp(false);
    }
}

function renderApp(isSetup) {
    document.getElementById('setup-page')?.classList.toggle('hidden', isSetup);
    document.getElementById('app-page')?.classList.toggle('hidden', !isSetup);
    if (isSetup) navigateTo('create-bill');
}

// --- NAVIGATION ---
window.navigateTo = function(pageId) {
    document.querySelectorAll('.app-page-view').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId)?.classList.remove('hidden');
    
    document.querySelectorAll('.sidebar-link').forEach(l => {
        l.classList.remove('active-link');
    });
    const activeBtn = document.getElementById(`nav-${pageId}`);
    if (activeBtn) activeBtn.classList.add('active-link');

    if (pageId === 'product-management') renderProductsList();
    if (pageId === 'create-bill') {
        renderProductDropdown();
        renderBillTable();
        document.getElementById('bill-date').textContent = new Date().toLocaleDateString();
    }
    if (pageId === 'billing-history') checkAuth('history');
    if (pageId === 'sales-report') checkAuth('report');
}

// --- ENTER KEY NAVIGATION ---
function setupEnterNavigation() {
    const map = {
        'customer-name': 'customer-phone',
        'customer-phone': 'product-search-input',
        'product-search-input': 'item-custom-price',
        'item-custom-price': 'item-quantity',       
        'item-quantity': 'ADD_BUTTON'
    };
    
    Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (map[id] === 'ADD_BUTTON') {
                    document.getElementById('add-item-btn').click();
                } else {
                    document.getElementById(map[id])?.focus();
                }
            }
        });
    });
}

// --- CSV & PRODUCTS ---
function handleCSVImport() {
    const fileInput = document.getElementById('csv-file-input');
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const lines = e.target.result.split(/\r\n|\n/);
        let products = [];

        lines.forEach((line, index) => {
            if (!line.trim() || index === 0) return; 
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (!cols || cols.length < 5) return;

            const bookId = cols[0].replace(/^"|"$/g, '').trim();
            const rawName = cols[1].replace(/^"|"$/g, '').trim();
            const rawPrice = cols[5] ? cols[5].replace(/[^0-9.]/g, '') : "0"; 

            if (rawName) {
                products.push({ id: Date.now() + index, bookId, name: rawName, price: parseFloat(rawPrice) });
            }
        });

        saveToLocalStorage(PRODUCTS_KEY, products);
        availableProducts = products;
        renderProductsList();
        renderProductDropdown();
        alert("Imported successfully!");
        
        // Reset file input
        fileInput.value = "";
        document.getElementById('csv-file-name').textContent = "Select BookStock.csv";
        document.getElementById('process-csv-btn').disabled = true;
    };
    reader.readAsText(file);
}

function renderProductsList() {
    const tbody = document.getElementById('products-list');
    if (!tbody) return;
    tbody.innerHTML = availableProducts.map((p) => `
        <tr class="border-b border-gray-800 hover:bg-gray-800/30">
            <td class="py-3 px-4 text-sm text-gray-500 font-mono">${p.bookId}</td>
            <td class="py-3 px-4 text-sm font-medium text-cyan-400">${p.name}</td>
            <td class="py-3 px-4 text-sm text-right font-bold text-gray-300">₹ ${p.price.toFixed(2)}</td>
        </tr>
    `).join('') || '<tr><td colspan="3" class="p-4 text-center text-gray-500">No products imported.</td></tr>';
}

// --- BILLING CORE ---
function renderProductDropdown() {
    const dataList = document.getElementById('product-suggestions');
    if(!dataList) return;
    dataList.innerHTML = availableProducts.map(p => `<option value="${p.bookId}">${p.name}</option>`).join('');
}

function handleAddItem(e) {
    if(e) e.preventDefault();
    const searchInput = document.getElementById('product-search-input');
    const priceInput = document.getElementById('item-custom-price');
    const qtyInput = document.getElementById('item-quantity');

    const inputVal = searchInput.value.trim();
    const product = availableProducts.find(p => p.bookId === inputVal || p.name === inputVal);

    if (!product) { alert("Book not found!"); return; }

    currentBillItems.push({
        id: Date.now(),
        name: product.name,
        price: parseFloat(priceInput.value),
        quantity: parseInt(qtyInput.value),
        subtotal: parseFloat(priceInput.value) * parseInt(qtyInput.value)
    });

    renderBillTable();
    searchInput.value = ""; priceInput.value = ""; qtyInput.value = 1;
    searchInput.focus();
}

function renderBillTable() {
    const tbody = document.getElementById('bill-items-table-body');
    const totalEl = document.getElementById('grand-total-display');
    const area = document.getElementById('save-print-area');
    if (!tbody) return;

    let total = 0;
    tbody.innerHTML = currentBillItems.map((item, i) => {
        total += item.subtotal;
        return `
            <tr class="border-b border-gray-800">
                <td class="py-3 px-3 text-gray-500">${i+1}</td>
                <td class="py-3 px-3 font-medium">${item.name}</td>
                <td class="py-3 px-3 text-right">₹${item.price.toFixed(2)}</td>
                <td class="py-3 px-3 text-right">${item.quantity}</td>
                <td class="py-3 px-3 text-right text-emerald-400 font-bold">₹${item.subtotal.toFixed(2)}</td>
                <td class="text-center"><button onclick="removeBillItem(${item.id})" class="text-red-500 hover:text-red-400">🗑</button></td>
            </tr>`;
    }).join('');
    
    totalEl.textContent = `₹ ${total.toFixed(2)}`;
    area.classList.toggle('hidden', currentBillItems.length === 0);
}

window.removeBillItem = function(id) {
    currentBillItems = currentBillItems.filter(i => i.id !== id);
    renderBillTable();
};

// --- FINALIZATION & PRINT ---
function handleFinalize() {
    if (currentBillItems.length === 0) return;
    const billId = generateBillId();
    const payMode = document.querySelector('input[name="payment-mode"]:checked')?.value || "Cash";
    
    const newBill = {
        billId,
        date: new Date().toISOString(),
        customerName: document.getElementById('customer-name').value || "Cash Customer",
        customerPhone: document.getElementById('customer-phone').value || "",
        paymentMode: payMode,
        items: [...currentBillItems],
        grandTotal: currentBillItems.reduce((acc, i) => acc + i.subtotal, 0)
    };

    let history = loadFromLocalStorage(BILLING_HISTORY_KEY) || [];
    history.push(newBill);
    saveToLocalStorage(BILLING_HISTORY_KEY, history);
    
    printBill(newBill);
    
    // RESET UI
    currentBillItems = [];
    document.getElementById('customer-name').value = "";
    document.getElementById('customer-phone').value = "";
    renderBillTable();

    // UPDATE TABLES
    renderHistoryTable();
    renderReportTable();
}

function printBill(bill) {
    const tableRows = bill.items.map((item, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${item.price.toFixed(2)}</td>
            <td>${item.subtotal.toFixed(2)}</td>
        </tr>`).join('');

    const html = `
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; border-bottom: 2px solid #0f766e; margin-bottom: 20px; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { border-bottom: 2px solid #eee; text-align: left; padding: 10px 5px; }
                td { padding: 10px 5px; border-bottom: 1px solid #f9f9f9; }
                .total { font-weight: bold; font-size: 1.4em; text-align: right; margin-top: 30px; color: #0f766e; }
                .footer { margin-top: 50px; text-align: center; font-size: 0.8em; color: #888; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 style="margin:0;">Sthirpara Unit</h1>
                <p style="margin:5px 0;">Akhil Bharat Vivekananda Yuva Mahamandal</p>
            </div>
            <div style="display:flex; justify-content: space-between;">
                <div>
                    <p><strong>Bill No:</strong> ${bill.billId}</p>
                    <p><strong>Date:</strong> ${new Date(bill.date).toLocaleDateString()}</p>
                </div>
                <div style="text-align: right;">
                    <p><strong>Customer:</strong> ${bill.customerName}</p>
                    <p><strong>Payment:</strong> ${bill.paymentMode}</p>
                </div>
            </div>
            <table>
                <thead><tr><th>#</th><th>Item Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
            <div class="total">Grand Total: ₹${bill.grandTotal.toFixed(2)}</div>
            <div class="footer">Thank you for your purchase!</div>
        </body>
        </html>`;

    const win = window.open('', '_blank');
    if(win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => {
            win.print();
            win.close();
        }, 500);
    }
}

// --- HISTORY & REPORT RENDERING ---
function renderHistoryTable() {
    let history = loadFromLocalStorage(BILLING_HISTORY_KEY) || [];
    const tbody = document.getElementById('history-table-body');
    const countEl = document.getElementById('history-count');
    if (!tbody) return;
    if (countEl) countEl.textContent = history.length;

    tbody.innerHTML = history.slice().reverse().map(bill => `
        <tr class="border-b border-gray-800 hover:bg-gray-800/20">
            <td class="p-3 font-mono text-xs text-cyan-500">${bill.billId}</td>
            <td class="p-3">${bill.customerName}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-[10px] font-bold ${bill.paymentMode === 'Cash' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-pink-900/40 text-pink-400'}">${bill.paymentMode}</span></td>
            <td class="p-3 text-gray-400">${new Date(bill.date).toLocaleDateString()}</td>
            <td class="p-3 text-right font-bold">₹${bill.grandTotal.toFixed(2)}</td>
            <td class="p-3 text-center">
                <button onclick="deleteBill('${bill.billId}')" class="text-red-500 hover:scale-110 transition">🗑</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="p-8 text-center text-gray-500">No transaction history found.</td></tr>';
}

function renderReportTable() {
    let history = loadFromLocalStorage(BILLING_HISTORY_KEY) || [];
    let salesMap = {};
    let totalRevenue = 0;

    history.forEach(bill => {
        totalRevenue += bill.grandTotal;
        bill.items.forEach(item => {
            if (!salesMap[item.name]) salesMap[item.name] = { qty: 0, income: 0 };
            salesMap[item.name].qty += item.quantity;
            salesMap[item.name].income += item.subtotal;
        });
    });

    const revEl = document.getElementById('total-revenue-display');
    if (revEl) revEl.textContent = `₹ ${totalRevenue.toFixed(2)}`;

    const tbody = document.getElementById('report-table-body');
    if (!tbody) return;

    tbody.innerHTML = Object.keys(salesMap).map(name => `
        <tr class="border-b border-gray-800 hover:bg-gray-800/20">
            <td class="p-4 text-cyan-400 font-medium">${name}</td>
            <td class="p-4 text-right">${salesMap[name].qty}</td>
            <td class="p-4 text-right font-bold text-emerald-400">₹${salesMap[name].income.toFixed(2)}</td>
        </tr>
    `).join('') || '<tr><td colspan="3" class="p-8 text-center text-gray-500">No sales data available.</td></tr>';
}

window.deleteBill = function(id) {
    if(!confirm("Are you sure you want to delete this bill record? This cannot be undone.")) return;
    let history = loadFromLocalStorage(BILLING_HISTORY_KEY) || [];
    history = history.filter(b => b.billId !== id);
    saveToLocalStorage(BILLING_HISTORY_KEY, history);
    renderHistoryTable();
    renderReportTable();
}

// --- SALES REPORT CSV ---
window.downloadReportCSV = function() {
    let history = loadFromLocalStorage(BILLING_HISTORY_KEY) || [];
    if(history.length === 0) { alert("No data to export!"); return; }
    
    let csv = "Item Name,Total Quantity,Total Income\n";
    let sales = {};
    history.forEach(b => b.items.forEach(i => {
        if(!sales[i.name]) sales[i.name] = {q:0, p:0};
        sales[i.name].q += i.quantity;
        sales[i.name].p += i.subtotal;
    }));
    Object.keys(sales).forEach(name => {
        csv += `"${name}",${sales[name].q},${sales[name].p.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sales_Report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

// --- AUTH & EVENT LISTENERS ---
function checkAuth(context) {
    const isVisible = isHistoryLoggedIn;
    document.getElementById(`${context}-login`)?.classList.toggle('hidden', isVisible);
    document.getElementById(`${context}-view`)?.classList.toggle('hidden', !isVisible);
    if(isVisible) {
        if(context === 'history') renderHistoryTable();
        else renderReportTable();
    }
}

function handleLogin(e, context) {
    e.preventDefault();
    const passInput = document.getElementById(context === 'history' ? 'history-password' : 'history-password-report');
    const pass = passInput.value;
    if(pass === loadFromLocalStorage(PASSWORD_KEY)) {
        isHistoryLoggedIn = true;
        checkAuth(context);
    } else { 
        alert("Incorrect Password!"); 
        passInput.value = "";
    }
}

function setupEventListeners() {
    // Setup Form
    document.getElementById('setup-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveToLocalStorage(BUSINESS_KEY, { businessName: document.getElementById('businessName').value });
        saveToLocalStorage(PASSWORD_KEY, document.getElementById('setupPassword').value);
        checkSetup();
    });

    // CSV Import UI Logic
    const fileInput = document.getElementById('csv-file-input');
    const processBtn = document.getElementById('process-csv-btn');
    const fileNameDisplay = document.getElementById('csv-file-name');

    fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
            processBtn.disabled = false;
            processBtn.classList.remove('opacity-30');
        } else {
            fileNameDisplay.textContent = "Select BookStock.csv";
            processBtn.disabled = true;
            processBtn.classList.add('opacity-30');
        }
    });

    processBtn?.addEventListener('click', handleCSVImport);

    // Billing Logic
    document.getElementById('add-item-form')?.addEventListener('submit', handleAddItem);
    document.getElementById('finalize-bill-btn')?.addEventListener('click', handleFinalize);
    document.getElementById('clear-bill-btn')?.addEventListener('click', () => {
        if(confirm("Clear current bill?")) {
            currentBillItems = [];
            renderBillTable();
        }
    });

    // Auth Forms
    document.getElementById('history-login-form')?.addEventListener('submit', (e) => handleLogin(e, 'history'));
    document.getElementById('report-login-form')?.addEventListener('submit', (e) => handleLogin(e, 'report'));

    // Product Search Auto-fill
    document.getElementById('product-search-input')?.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const product = availableProducts.find(p => p.bookId === val || p.name === val);
        if(product) {
            document.getElementById('item-custom-price').value = product.price.toFixed(2);
            document.getElementById('item-quantity').focus();
        }
    });

    // Logout
    document.getElementById('nav-logout')?.addEventListener('click', () => {
        if(confirm("This will permanently delete ALL data including products and history. Proceed?")) { 
            localStorage.clear(); 
            location.reload(); 
        }
    });
}

window.onload = init;