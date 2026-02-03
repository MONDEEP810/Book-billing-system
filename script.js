// --- Constants & State ---
const BUSINESS_KEY = 'billing_app_business_setup';
const PRODUCTS_KEY = 'billing_app_products';
const PASSWORD_KEY = 'billing_app_secret_password';
const BILLING_HISTORY_KEY = 'billing_app_history';
const BILL_NO_KEY = 'billNo'; // Key for incrementing bill number

let businessData = null;
let currentBillItems = [];
let availableProducts = [];
let isHistoryLoggedIn = false;


function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error("Storage Error:", e);
        return null;
    }
}

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        alert("Storage Full or Blocked!");
        return false;
    }
}

// --- Utility: UI Feedback ---
function showMessage(msg, type = 'info', id = 'status-message-setup') {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden', 'bg-red-900', 'text-red-300', 'bg-emerald-900', 'text-emerald-300', 'bg-blue-900', 'text-blue-300');
    el.innerHTML = msg;
    const colors = type === 'success' ? ['bg-emerald-900', 'text-emerald-300'] :
                   type === 'error' ? ['bg-red-900', 'text-red-300'] : 
                   ['bg-blue-900', 'text-blue-300'];
    el.classList.add(...colors);
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

// --- Utility: Generate Consistent Bill ID ---
function generateBillId() {
    // Format: YYYYMMDD-Number (e.g., 20240105-1226)
    const datePrefix = new Date().toISOString().slice(0,10).replace(/-/g,'');
    
    // Get current number or default to 1225
    let currentNo = parseInt(localStorage.getItem(BILL_NO_KEY)) || 1225;
    
    // Increment
    currentNo++;
    
    // Save back to storage
    localStorage.setItem(BILL_NO_KEY, currentNo);
    
    return `${datePrefix}-${currentNo}`;
}

// --- Initialization ---
function init() {
    setupEventListeners();
    checkSetup();
    setupEnterNavigation(); // Enable Fast Tab Feature
}

function checkSetup() {
    businessData = loadFromLocalStorage(BUSINESS_KEY);
    availableProducts = loadFromLocalStorage(PRODUCTS_KEY) || [];
    
    if (businessData) {
        renderApp(true);
        document.getElementById('business-name-display').textContent = businessData.businessName;
    } else {
        renderApp(false);
    }
}

function renderApp(isSetup) {
    document.getElementById('setup-page').classList.toggle('hidden', isSetup);
    document.getElementById('app-page').classList.toggle('hidden', !isSetup);
    if (isSetup) navigateTo('create-bill');
}

// --- SETUP FORM ---
function handleSetup(e) {
    e.preventDefault();
    const name = document.getElementById('businessName').value.trim();
    const address = document.getElementById('address').value.trim();
    const pass = document.getElementById('setupPassword').value.trim();
    const phone = document.getElementById('phone').value.trim();
    
    if (!name || !address || !pass) {
        showMessage("Please fill required fields", 'error');
        return;
    }

    saveToLocalStorage(BUSINESS_KEY, { businessName: name, address, phone });
    saveToLocalStorage(PASSWORD_KEY, pass);
    checkSetup();
}

// --- NAVIGATION ---
window.navigateTo = function(pageId) {
    document.querySelectorAll('.app-page-view').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    
    // Sidebar highlight
    document.querySelectorAll('.sidebar-link').forEach(l => {
        l.classList.remove('active-link', 'text-emerald-400');
        l.classList.add('text-gray-300');
    });
    const activeBtn = document.getElementById(`nav-${pageId}`);
    if (activeBtn) activeBtn.classList.add('active-link');

    if (pageId === 'product-management') renderProductsList();
    if (pageId === 'create-bill') {
        renderProductDropdown();
        renderBillTable();
        document.getElementById('bill-date').textContent = new Date().toLocaleDateString();
        // Focus on name for speed
        setTimeout(() => document.getElementById('customer-name').focus(), 100);
    }
    if (pageId === 'billing-history') checkAuth('history');
    if (pageId === 'sales-report') checkAuth('report');
}

// --- FAST NAVIGATION (ENTER KEY) ---

   function setupEnterNavigation() {
    const map = {
        'customer-name': 'customer-phone',
        'customer-phone': 'payment-mode',
        'payment-mode': 'item-product-select',
        'item-product-select': 'item-custom-price', // Go to Price first
        'item-custom-price': 'item-quantity',       // Then Quantity
        'item-quantity': 'ADD_BUTTON'
    };
    
    // ... rest of the function remains the same ...

    Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;

        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const nextId = map[id];

                if (nextId === 'ADD_BUTTON') {
                    // Trigger add button
                    document.getElementById('add-item-btn').click();
                } else {
                    // Focus next field
                    const nextEl = document.getElementById(nextId);
                    if (nextEl) nextEl.focus();
                }
            }
        });
    });
}

// --- PRODUCT MANAGEMENT ---
function renderProductsList() {
    availableProducts = loadFromLocalStorage(PRODUCTS_KEY) || [];
    const tbody = document.getElementById('products-list');
    if (!tbody) return;

    if (availableProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">No books found. Import CSV or Add manually.</td></tr>';
        return;
    }

    tbody.innerHTML = availableProducts.map((p, i) => `
        <tr class="border-b border-gray-700 hover:bg-[#2a3440]">
            <td class="py-2 px-4 text-sm">${i + 1}</td>
            <td class="py-2 px-4 text-sm font-medium text-cyan-400">${p.name}</td>
            <td class="py-2 px-4 text-sm text-right">₹ ${parseFloat(p.price).toFixed(2)}</td>
        </tr>
    `).join('');
}

function handleAddManualProduct(e) {
    e.preventDefault();
    const name = document.getElementById('product-name').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    
    if (!name || isNaN(price)) return;

    const newProd = { id: Date.now(), name, price, unit: 'Pcs' };
    availableProducts.push(newProd);
    saveToLocalStorage(PRODUCTS_KEY, availableProducts);
    
    document.getElementById('product-form').reset();
    renderProductsList();
    showMessage("Product Added!", 'success', 'product-status-message');
}

// --- CSV IMPORT LOGIC ---
function handleCSVImport() {
    const fileInput = document.getElementById('csv-file-input');
    const file = fileInput.files[0];
    if (!file) return showMessage("Select a file first", 'error', 'product-status-message');

    const reader = new FileReader();
    reader.onload = function(e) {
        const lines = e.target.result.split(/\r\n|\n/);
        let count = 0;
        let products = loadFromLocalStorage(PRODUCTS_KEY) || [];

        lines.forEach((line, index) => {
            if (!line.trim()) return;
            if (index === 0) return; // Skip Header

            // FIX: Use split with a regex that handles commas inside quotes correctly.
            // This preserves spaces in names and empty fields (like missing Writers).
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

            if (!cols || cols.length < 5) return;

            // Remove surrounding quotes if present and trim whitespace
            const rawName = cols[0].replace(/^"|"$/g, '').trim();
            // Price is strictly at index 4
            const rawPrice = cols[4].replace(/[^0-9.]/g, ''); 

            const price = parseFloat(rawPrice);
            
            // Ensure we have a valid name and a valid price number
            if (rawName && !isNaN(price)) {
                products.push({
                    id: Date.now() + index,
                    name: rawName,
                    price: price,
                    unit: 'Pcs'
                });
                count++;
            }
        });

        if (count > 0) {
            saveToLocalStorage(PRODUCTS_KEY, products);
            renderProductsList();
            showMessage(`Imported ${count} books successfully!`, 'success', 'product-status-message');
            fileInput.value = '';
            document.getElementById('process-csv-btn').disabled = true;
            document.getElementById('csv-file-name').textContent = "Select CSV File";
        } else {
            showMessage("No valid data found. Check CSV format.", 'error', 'product-status-message');
        }
    };
    reader.readAsText(file);
}


// --- BILLING LOGIC ---
function renderProductDropdown() {
    const dataList = document.getElementById('product-suggestions');
    dataList.innerHTML = ''; // Clear existing
    
    // Sort Alphabetically
    availableProducts.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
        const opt = document.createElement('option');
        // The 'value' is what shows up in the search bar
        opt.value = p.name; 
        // We can't use dataset in datalist easily, so we rely on name matching
        dataList.appendChild(opt);
    });
}
    // Sort Alphabetically
    availableProducts.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (₹${p.price})`;
        opt.dataset.price = p.price;
        opt.dataset.name = p.name;
        select.appendChild(opt);
    });

function handleAddItem(e) {
    e.preventDefault();
    
    const searchInput = document.getElementById('product-search-input');
    const priceInput = document.getElementById('item-custom-price');
    const qtyInput = document.getElementById('item-quantity');

    const productName = searchInput.value.trim();
    const price = parseFloat(priceInput.value);
    const qty = parseInt(qtyInput.value);

    // 1. Validation
    if (!productName) {
        alert("Please select or type a book name");
        return;
    }
    if (isNaN(price) || price < 0) {
        alert("Please enter a valid price");
        return;
    }

    // 2. Find Product ID (Optional, but good for tracking)
    // We try to find the original product to get its ID, otherwise generate a temp ID
    const originalProduct = availableProducts.find(p => p.name === productName);
    const productId = originalProduct ? originalProduct.id : Date.now();

    // 3. Add to List
    currentBillItems.push({
        id: Date.now(), // Unique ID for the bill item row
        productId: productId,
        name: productName,
        price: price,
        quantity: qty,
        subtotal: price * qty
    });

    renderBillTable();
    
    // 4. Reset Fields
    searchInput.value = "";
    priceInput.value = "";
    qtyInput.value = 1;
    
    // 5. Refocus for next item
    searchInput.focus();
}


function renderBillTable() {
    const tbody = document.getElementById('bill-items-table-body');
    const totalEl = document.getElementById('grand-total-display');
    const actionArea = document.getElementById('save-print-area');

    tbody.innerHTML = '';
    let total = 0;

    if (currentBillItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">Empty Bill</td></tr>';
        actionArea.classList.add('hidden');
    } else {
        actionArea.classList.remove('hidden');
        currentBillItems.forEach((item, i) => {
            total += item.subtotal;
            tbody.innerHTML += `
                <tr class="border-b border-gray-800">
                    <td class="py-2 px-3">${i+1}</td>
                    <td class="py-2 px-3">${item.name}</td>
                    <td class="py-2 px-3 text-right">₹${item.price}</td>
                    <td class="py-2 px-3 text-right">${item.quantity}</td>
                    <td class="py-2 px-3 text-right text-emerald-400">₹${item.subtotal}</td>
                    <td class="text-center"><button onclick="removeBillItem(${item.id})" class="text-red-500">🗑</button></td>
                </tr>
            `;
        });
    }
    totalEl.textContent = `₹ ${total.toFixed(2)}`;
}

window.removeBillItem = function(id) {
    currentBillItems = currentBillItems.filter(i => i.id !== id);
    renderBillTable();
}

// --- FINALIZATION & PRINTING (Using User Template) ---
function handleFinalize() {
    if (currentBillItems.length === 0) return;
    
    const custName = document.getElementById('customer-name').value || "Cash Customer";
    const custPhone = document.getElementById('customer-phone').value || "";
    
    // NEW: Get value from the selected Radio Button
    const payModeElement = document.querySelector('input[name="payment-mode"]:checked');
    const payMode = payModeElement ? payModeElement.value : "Cash";

    const grandTotal = currentBillItems.reduce((acc, i) => acc + i.subtotal, 0);

    // 1. Generate Consistent ID
    const billId = generateBillId();

    // 2. Prepare Data
    const newBill = {
        billId: billId,
        date: new Date().toISOString(),
        customerName: custName,
        customerPhone: custPhone,
        paymentMode: payMode, // Saved here
        items: [...currentBillItems],
        grandTotal: grandTotal
    };

    // 3. Save to History
    let history = loadFromLocalStorage(BILLING_HISTORY_KEY);
    if (!Array.isArray(history)) history = [];
    history.push(newBill);
    saveToLocalStorage(BILLING_HISTORY_KEY, history);

    // 4. Print
    printBill(newBill);
    
    // 5. Reset UI
    currentBillItems = [];
    document.getElementById('customer-name').value = "";
    document.getElementById('customer-phone').value = "";
    
    // Reset Radio to Cash
    const cashRadio = document.querySelector('input[name="payment-mode"][value="Cash"]');
    if(cashRadio) cashRadio.checked = true;

    renderBillTable();
    showMessage("Bill Saved & Printed", 'success', 'bill-status-message');
}

function printBill(bill) {
    // 1. Determine date
    const billDate = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'short', day: '2-digit' 
    });
    
    const customerName = bill.customerName;
    const customerPhone = bill.customerPhone;
    const grandTotal = bill.grandTotal;

    // 2. Generate Table Rows
    const billTableContent = bill.items.map((item, i) => `
        <tr>
             <td>${i+1}</td>
             <td>${item.name}</td>
             <td>${item.quantity}</td>
             <td>${item.price.toFixed(2)}</td>
             <td style="font-weight: 700;">${item.subtotal.toFixed(2)}</td>
        </tr>
    `).join('');

    // 3. Construct HTML
    const billHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Invoice - ${customerName}</title>
        <style>
          :root { --primary: #0f766e; --secondary: #334155; --muted: #64748b; --border: #e5e7eb; --bg-soft: #f8fafc; }
          * { box-sizing: border-box; }
          body { margin: 0; padding: 20px; font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff; color: var(--secondary); }
          .invoice { max-width: 80mm; margin: auto; background: #ffffff; padding: 10px; }
          .header { text-align: center; padding-bottom: 10px; border-bottom: 2px solid var(--primary); }
          .header h1 { margin: 0; font-size: 16px; font-weight: 700; color: var(--primary); letter-spacing: 0.3px; }
          .header h2 { margin: 2px 0 6px; font-size: 13px; font-weight: 600; }
          .header p { margin: 2px 0; font-size: 11px; color: var(--muted); line-height: 1.4; }
          .meta { margin: 12px 0; font-size: 12px; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; }
          thead th { text-align: right; padding: 6px 4px; border-bottom: 1px solid var(--border); font-weight: 700; color: #020617; }
          thead th:first-child, tbody td:first-child { text-align: left; }
          tbody td { padding: 6px 4px; border-bottom: 1px dashed var(--border); text-align: right; }
          .total-row td { border: none; padding-top: 8px; font-size: 14px; font-weight: 700; color: var(--primary); }
          .footer { margin-top: 14px; padding-top: 8px; border-top: 1px dashed var(--border); text-align: center; font-size: 11.5px; }
          @media print { @page { margin: 0; } body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <h2>Akhil Bharat Vivekananda Yuva Mahamandal</h2>
            <h1>Sthirpara Unit</h1>
            <p>Sthirpara, Kankinara, North 24 Parganas – 743127</p>
            <p>📞 6290795357</p>
          </div>
          <div class="meta">
            <div class="meta-row"><span><strong>Date:</strong> ${billDate}</span><span><strong>Bill:</strong> ${bill.billId}</span></div>
            <div class="meta-row"><span><strong>Name:</strong> ${customerName}</span></div>
            <div class="meta-row"><span><strong>Mode:</strong> ${bill.paymentMode}</span></div>
          </div>
          <table>
            <thead>
              <tr><th style="width:5%">#</th><th style="width:40%">Item</th><th style="width:15%">Qty</th><th style="width:20%">Rate</th><th style="width:20%">Amt</th></tr>
            </thead>
            <tbody>
              ${billTableContent}
              <tr class="total-row"><td colspan="4">Total</td><td>${grandTotal.toFixed(2)}</td></tr>
            </tbody>
          </table>
          <div class="footer"><strong>Thank You!</strong></div>
        </div>
        <script>
            // Automatically print when this window opens
            window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `;

    // 4. Open Window Safely
    const win = window.open('', '_blank', 'width=450,height=600');
    if (win) {
        win.document.open();
        win.document.write(billHTML);
        win.document.close();
        // Fallback if onload doesn't fire immediately
        setTimeout(() => { win.focus(); win.print(); }, 500);
    } else {
        alert("Please allow popups to print the bill!");
    }
}

// --- AUTH & HISTORY ---
function checkAuth(context) {
    const loginDiv = context === 'history' ? document.getElementById('history-login') : document.getElementById('report-login');
    const viewDiv = context === 'history' ? document.getElementById('history-view') : document.getElementById('report-view');

    if (isHistoryLoggedIn) {
        loginDiv.classList.add('hidden');
        viewDiv.classList.remove('hidden');
        if (context === 'history') renderHistoryTable();
        if (context === 'report') renderReportTable();
    } else {
        loginDiv.classList.remove('hidden');
        viewDiv.classList.add('hidden');
    }
}

function handleLogin(e, context) {
    e.preventDefault();
    const input = context === 'history' ? document.getElementById('history-password') : document.getElementById('history-password-report');
    const saved = loadFromLocalStorage(PASSWORD_KEY);
    
    if (input.value === saved) {
        isHistoryLoggedIn = true;
        input.value = "";
        checkAuth(context);
    } else {
        alert("Wrong Password");
    }
}

// --- HISTORY RENDERING ---
function renderHistoryTable() {
    let history = loadFromLocalStorage(BILLING_HISTORY_KEY) || [];
    if (!Array.isArray(history)) history = [];

    const tbody = document.getElementById('history-table-body');
    const count = document.getElementById('history-count');
    const clearBtn = document.getElementById('clear-all-history-btn');

    count.textContent = history.length;
    tbody.innerHTML = '';
    
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">No bills found.</td></tr>';
        clearBtn.classList.add('hidden');
        return;
    }
    clearBtn.classList.remove('hidden');

    history.slice().reverse().forEach(bill => {
        if (!bill) return;
        
        // Handle ID: Support both old int IDs and new string IDs
        const displayId = bill.billId ? bill.billId.toString() : 'ERR';
        const date = bill.date ? new Date(bill.date).toLocaleDateString() : 'N/A';
        const mode = bill.paymentMode || 'Cash';
        
        tbody.innerHTML += `
            <tr class="border-b border-gray-700 hover:bg-[#2a3440]">
                <td class="py-2 px-4 text-sm font-mono text-gray-400">${displayId}</td>
                <td class="py-2 px-4 text-cyan-400">${bill.customerName || '-'}</td>
                <td class="py-2 px-4 text-xs font-semibold ${mode==='UPI'?'text-pink-400':'text-green-400'}">${mode}</td>
                <td class="py-2 px-4 text-gray-400">${date}</td>
                <td class="py-2 px-4 text-right text-emerald-400">₹${(bill.grandTotal || 0).toFixed(2)}</td>
                <td class="text-center">
                    <button onclick="deleteBill('${bill.billId}')" class="text-red-500 hover:text-red-300">🗑</button>
                </td>
            </tr>
        `;
    });
}

function renderReportTable() {
    let history = loadFromLocalStorage(BILLING_HISTORY_KEY) || [];
    if (!Array.isArray(history)) history = [];

    const tbody = document.getElementById('report-table-body');
    const totalRev = document.getElementById('total-revenue-display');
    
    let grandTotal = 0;
    let map = {};

    history.forEach(bill => {
        if (!bill.items) return;
        bill.items.forEach(item => {
            if (!map[item.productId]) {
                map[item.productId] = { name: item.name, qty: 0, income: 0 };
            }
            map[item.productId].qty += (item.quantity || 0);
            map[item.productId].income += (item.subtotal || 0);
            grandTotal += (item.subtotal || 0);
        });
    });

    totalRev.textContent = `₹ ${grandTotal.toFixed(2)}`;
    tbody.innerHTML = '';

    const sortedIds = Object.keys(map).sort((a,b) => map[b].income - map[a].income);
    
    if(sortedIds.length === 0) {
         tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center">No sales data.</td></tr>';
         return;
    }

    sortedIds.forEach(id => {
        const d = map[id];
        tbody.innerHTML += `
             <tr class="border-b border-gray-700 hover:bg-[#2a3440]">
                <td class="py-2 px-4 text-cyan-400">${d.name}</td>
                <td class="py-2 px-4 text-right text-yellow-400">${d.qty}</td>
                <td class="py-2 px-4 text-right text-emerald-400">₹${d.income.toFixed(2)}</td>
            </tr>
        `;
    });
}
function downloadReportCSV() {
    // 1. Load and aggregate data (Same logic as renderReportTable)
    let history = loadFromLocalStorage(BILLING_HISTORY_KEY) || [];
    if (!Array.isArray(history)) history = [];

    let map = {};

    history.forEach(bill => {
        if (!bill.items) return;
        bill.items.forEach(item => {
            if (!map[item.productId]) {
                map[item.productId] = { name: item.name, qty: 0, income: 0 };
            }
            map[item.productId].qty += (item.quantity || 0);
            map[item.productId].income += (item.subtotal || 0);
        });
    });

    // Sort by income descending (same as your table)
    const sortedIds = Object.keys(map).sort((a, b) => map[b].income - map[a].income);

    if (sortedIds.length === 0) {
        alert("No sales data available to download.");
        return;
    }

    // 2. Construct CSV content
    // Header row
    let csvContent = "Product Name,Total Quantity,Total Income (INR)\n";

    sortedIds.forEach(id => {
        const d = map[id];
        // Handle potential commas or quotes in the product name
        const safeName = `"${d.name.replace(/"/g, '""')}"`; 
        
        // Add row: Name, Quantity, Income
        csvContent += `${safeName},${d.qty},${d.income.toFixed(2)}\n`;
    });

    // 3. Create a temporary link to trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    // Set filename with current date (e.g., Sales_Report_2023-10-27.csv)
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `Sales_Report_${dateStr}.csv`);
    
    // Append, click, and cleanup
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- DELETION ---
window.deleteBill = function(id) {
    if(!confirm("Delete this bill?")) return;
    let history = loadFromLocalStorage(BILLING_HISTORY_KEY) || [];
    // Filter using string comparison for safety
    history = history.filter(b => String(b.billId) !== String(id));
    saveToLocalStorage(BILLING_HISTORY_KEY, history);
    renderHistoryTable();
}

window.clearAllHistory = function() {
    if(!confirm("Permanently delete ALL history?")) return;
    saveToLocalStorage(BILLING_HISTORY_KEY, []);
    renderHistoryTable();
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    document.getElementById('setup-form')?.addEventListener('submit', handleSetup);
    document.getElementById('product-form')?.addEventListener('submit', handleAddManualProduct);
    document.getElementById('add-item-form')?.addEventListener('submit', handleAddItem);
    document.getElementById('finalize-bill-btn')?.addEventListener('click', handleFinalize);
    document.getElementById('clear-bill-btn')?.addEventListener('click', () => {
        currentBillItems = [];
        renderBillTable();
    });

    document.getElementById('history-login-form')?.addEventListener('submit', (e) => handleLogin(e, 'history'));
    document.getElementById('report-login-form')?.addEventListener('submit', (e) => handleLogin(e, 'report'));

    // CSV
    document.getElementById('csv-file-input')?.addEventListener('change', (e) => {
        if(e.target.files[0]) {
            document.getElementById('csv-file-name').textContent = e.target.files[0].name;
            document.getElementById('process-csv-btn').disabled = false;
        }
    });
    document.getElementById('process-csv-btn')?.addEventListener('click', handleCSVImport);

    // Logout
    document.getElementById('nav-logout')?.addEventListener('click', () => {
        if(confirm("Reset entire app data?")) {
            localStorage.clear();
            location.reload();
        }
    });

// Add this inside setupEventListeners()
 // ADD THIS NEW CODE
document.getElementById('product-search-input')?.addEventListener('input', (e) => {
    const searchVal = e.target.value;
    
    // Find the product object that matches the name typed
    const product = availableProducts.find(p => p.name === searchVal);
    
    if (product) {
        // Auto-fill the price input
        document.getElementById('item-custom-price').value = parseFloat(product.price).toFixed(2);
        // Auto-focus the quantity for speed
        document.getElementById('item-quantity').focus();
    }
});  }

window.onload = init;



