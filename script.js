// Initial Data
const initialItem = {
    name: '',
    price: 0,
    qty: 1
};

// State
let currentInvoiceItems = [];

// Safe Storage Helper
const safeStorage = {
    getItem: (key) => {
        try { return localStorage.getItem(key); } catch (e) { console.warn('Storage Access Denied', e); return null; }
    },
    setItem: (key, val) => {
        try { localStorage.setItem(key, val); return true; } catch (e) {
            console.warn('Storage Access Denied', e);
            if (typeof showToast === 'function') showToast('Warning: Cannot save data (Browser blocked Storage).', 'error');
            else alert('Warning: Cannot save data (Browser blocked Storage).');
            return false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        // 1. Initialize Default Values
        initializeDefaults();

        // 2. Setup Event Listeners
        // 2. Setup Event Listeners (Already handled in initializeDefaults)
        // setupEventListeners();

        // 3. Render Initial State
        renderItems();
        updatePreview();

        // 4. Load History (if any) to check ID
        autoGenerateNextId();

        console.log("Invoice App Initialized Successfully");
    } catch (criticalError) {
        alert("App Initialization Error: " + criticalError.message);
        console.error(criticalError);
    }
});

function initializeDefaults() {
    const dateInput = document.getElementById('invoiceDate');
    if (dateInput && !dateInput.value) {
        setLocalTodayDate();
    }

    // Add default item if list is empty
    if (typeof currentInvoiceItems !== 'undefined' && currentInvoiceItems.length === 0) {
        currentInvoiceItems.push({ ...initialItem });
    }

    // Initialize Payment Settings
    const storedUpi = safeStorage.getItem('brandlift_upi_id');
    const upiInput = document.getElementById('upiId');
    if (storedUpi && upiInput) {
        upiInput.value = storedUpi;
    }

    // Safely try to render initial QR
    try {
        if (typeof updateQRCode === 'function') updateQRCode(1500);
    } catch (e) {
        console.warn('QR Code lib not loaded yet');
    }

    // 2. Setup Event Listeners


    // Input Bindings
    bindPreviewUpdater('invoiceId', 'previewInvoiceId');
    bindPreviewUpdater('invoiceDate', 'previewDate', (val) => {
        if (!val) return '';
        const d = new Date(val);
        return d.toLocaleDateString('en-GB');
    });
    bindPreviewUpdater('clientName', 'previewClientName');
    bindPreviewUpdater('clientAddress', 'previewClientAddress');

    // Bind Address separately since it might not have a direct preview element in the same way or needs custom handling
    // Actually our preview has it. Let's bind it.
    // If bindPreviewUpdater is generic:
    const addrInput = document.getElementById('clientAddress');
    if (addrInput) {
        addrInput.addEventListener('input', () => {
            // Assuming address maps to .company-address or similar? 
            // Wait, the cloned design has "INVOICE TO" + Name, and Company Address is fixed?
            // Let's check HTML. 
            // Ah, "INVOICE TO" -> previewClientName. 
            // Where does client address go? 
            // In the reference image, "INVOICE TO" has a Name below it. 
            // The address on the right is the SENDER (Company) address which is static in HTML?
            // Or is it the Client Address?
            // Let's look at `index.html` structure again.
            // <div class="bill-to"> <h3>INVOICE TO</h3> <h4 id="previewClientName">...</h4> </div>
            // The Bill To section in the reference usually has address too.
            // But my current HTML only has `previewClientName`.
            // If the user wants Client Address under Bill To, I might need to add it.
            // For now, I will just ensure changes to the input trigger autosave.
        });
    }


    // Auto-fill Address on Client Name selection
    document.getElementById('clientName').addEventListener('input', (e) => {
        const val = e.target.value;
        const invoices = getInvoices();
        // Find latest invoice with this client name
        const match = invoices.find(inv => inv.clientName === val && inv.clientAddress);
        if (match) {
            document.getElementById('clientAddress').value = match.clientAddress;
        }
        updateAddressOptions(); // Dynamically update datalist if needed, or just do it on load
    });
    updateAddressOptions(); // Init list

    // Buttons
    // Safe Listener Helper
    const safeBind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    safeBind('addItemBtn', 'click', () => {
        currentInvoiceItems.push({ name: '', price: 0, qty: 1 });
        renderItems();
        updatePreview();
    });

    safeBind('downloadBtn', 'click', generatePDF);
    safeBind('whatsappBtn', 'click', shareToWhatsApp);
    safeBind('printBtn', 'click', () => window.print());
    safeBind('saveBtn', 'click', () => saveInvoice(false));
    safeBind('newItemBtn', 'click', startNewInvoice); // Changed ID to match HTML (newItemBtn vs newInvoiceBtn)
    safeBind('exportCsvBtn', 'click', exportToCSV);
    safeBind('toggleHistoryBtn', 'click', toggleHistory);
    safeBind('closeHistoryBtn', 'click', toggleHistory);
    safeBind('whatsappBtn', 'click', shareToWhatsApp);

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveInvoice(false);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            // Check if user wants to print or download PDF? Usually print dialog
            // But here we have a PDF download button. Let's trigger download for better UX or stick to native print?
            // User requested "Ctrl+P to Print".
            window.print();
        }
    });

    // History Search
    safeBind('historySearch', 'input', (e) => {
        renderHistoryList(e.target.value);
    });
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAllHistory);

    // Settings
    safeBind('toggleSettingsBtn', 'click', toggleSettings);
    safeBind('closeSettingsBtn', 'click', toggleSettings);
    safeBind('saveSettingsBtn', 'click', saveSettings);

    // Test Connection
    safeBind('testConnectionBtn', 'click', () => {
        const url = document.getElementById('sheetUrl').value.trim();
        if (!url) return showToast("Please enter a URL first", 'error');

        showToast("Sending Test Data...", 'info');

        const payload = {
            id: "TEST-CONN",
            date: new Date().toISOString().split('T')[0],
            clientName: "Test Connection",
            amount: 100,
            status: "TEST",
            items: "Connection Check"
        };

        const formData = new URLSearchParams();
        for (const key in payload) formData.append(key, payload[key]);

        fetch(url, { method: 'POST', mode: 'no-cors', body: formData })
            .then(() => {
                showToast("Success! Test send complete.", 'success');
                alert("Connection Successful! Data sent to Google Sheet.");
            })
            .catch(err => {
                showToast("Test Failed: " + err.message, 'error');
                alert("Connection Failed. Check console for details.");
            });
    });

    // Load Settings
    const DEFAULT_GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbz67cGHm-LB-jJssrD2YuROeYbdZ5XcY6oyFQwbJMviO3-vBajUAQPfSZd_UQHd-2I3tA/exec";

    let storedUrl = safeStorage.getItem('brandlift_sheet_url');

    // Only set default if NO url is stored. 
    // This allows users to save their own URL without it being overwritten.
    if (!storedUrl) {
        storedUrl = DEFAULT_GOOGLE_SHEET_URL;
        safeStorage.setItem('brandlift_sheet_url', storedUrl);
    }

    if (storedUrl) document.getElementById('sheetUrl').value = storedUrl;

    // Calculation Inputs
    ['taxRate', 'discountVal', 'currencySymbol', 'invoiceStatus'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            updatePreview();
        });
    });

    // Payment Listeners
    document.getElementById('upiId').addEventListener('input', (e) => {
        safeStorage.setItem('brandlift_upi_id', e.target.value);
        updatePreview(); // Re-render QR
    });

    document.getElementById('qrUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = `<img src="${e.target.result}" style="width:100px; height:100px; object-fit:contain;">`;
                document.getElementById('qrcode').innerHTML = img;
                document.getElementById('qrcode').dataset.custom = "true";
            };
            reader.readAsDataURL(file);
        } else {
            document.getElementById('qrcode').dataset.custom = "false";
            updatePreview();
        }
    });

    // Logo Upload Logic
    const logoInput = document.getElementById('logoUpload');
    if (logoInput) {
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target.result;
                    // Update Image
                    document.getElementById('brandLogo').src = base64;
                    // Save to Storage
                    safeStorage.setItem('brandlift_logo_base64', base64);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Load Saved Logo
    const savedLogo = safeStorage.getItem('brandlift_logo_base64');
    if (savedLogo) {
        document.getElementById('brandLogo').src = savedLogo;
    }
}

function bindPreviewUpdater(inputId, previewId, formatter = null) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    if (input && preview) {
        input.addEventListener('input', () => {
            preview.innerText = formatter ? formatter(input.value) : input.value;
        });
        // Initial sync
        preview.innerText = formatter ? formatter(input.value) : input.value;
    }
}

// --- Item Management ---

function renderItems() {
    const container = document.getElementById('lineItemsContainer');
    container.innerHTML = '';

    currentInvoiceItems.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'line-item-row';

        row.innerHTML = `
            <input type="text" class="item-name" value="${item.name}" placeholder="Item Name" data-idx="${index}">
            <input type="number" class="item-price" value="${item.price}" placeholder="Price" data-idx="${index}">
            <input type="number" class="item-qty" value="${item.qty}" placeholder="Qty" data-idx="${index}">
            <button type="button" class="remove-btn" data-idx="${index}">×</button>
        `;

        container.appendChild(row);
    });

    // Bind events to new inputs
    container.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.dataset.idx;
            const field = e.target.classList.contains('item-name') ? 'name' :
                e.target.classList.contains('item-price') ? 'price' : 'qty';

            currentInvoiceItems[idx][field] = field === 'name' ? e.target.value : parseFloat(e.target.value) || 0;
            updatePreview();
        });
    });

    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            currentInvoiceItems.splice(idx, 1);
            renderItems();
            updatePreview();
        });
    });
}

// --- Helper: Currency Formatter ---
function formatCurrency(amount) {
    const symbol = document.getElementById('currencySymbol').value || '₹';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(amount).replace('₹', symbol);
}

function updatePreview() {
    const tbody = document.getElementById('previewItemsBody');
    const subtotalEl = document.getElementById('previewSubtotal');
    const taxRow = document.getElementById('taxRow');
    const discountRow = document.getElementById('discountRow');
    const subtotalRow = document.getElementById('subtotalRow');
    const totalEl = document.getElementById('previewTotal');

    // Get Settings
    const currency = document.getElementById('currencySymbol').value;
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const discountVal = parseFloat(document.getElementById('discountVal').value) || 0;
    const status = document.getElementById('invoiceStatus').value;

    tbody.innerHTML = '';
    let subtotal = 0;

    currentInvoiceItems.forEach(item => {
        const total = item.price * item.qty;
        subtotal += total;

        if (item.name || item.price > 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-left">${item.name}</td>
                <td class="text-center">${formatCurrency(item.price)}</td>
                <td class="text-center">${item.qty}</td>
                <td class="text-right">${formatCurrency(total)}</td>
            `;
            tbody.appendChild(tr);
        }
    });

    // Calculations
    const taxAmount = (subtotal * taxRate) / 100;
    let grandTotal = subtotal + taxAmount - discountVal;
    if (grandTotal < 0) grandTotal = 0;

    // Render Summary
    // Show subtotal if there's tax or discount
    if (taxRate > 0 || discountVal > 0) {
        subtotalRow.style.display = 'flex';
        subtotalEl.innerText = formatCurrency(subtotal);

        if (taxRate > 0) {
            taxRow.style.display = 'flex';
            document.getElementById('previewTaxRate').innerText = taxRate;
            document.getElementById('previewTaxAmt').innerText = formatCurrency(taxAmount);
        } else {
            taxRow.style.display = 'none';
        }

        if (discountVal > 0) {
            discountRow.style.display = 'flex';
            document.getElementById('previewDiscountAmt').innerText = `-${formatCurrency(discountVal)}`;
        } else {
            discountRow.style.display = 'none';
        }
    } else {
        subtotalRow.style.display = 'none';
        taxRow.style.display = 'none';
        discountRow.style.display = 'none';
    }

    totalEl.innerText = formatCurrency(grandTotal);

    // Update Stamp
    const stamp = document.getElementById('statusStamp');
    if (status) {
        stamp.innerText = status;
        stamp.classList.remove('hidden');
        stamp.setAttribute('data-status', status);
        // Green for PAID, Red for PENDING
        if (status === 'PENDING') {
            stamp.style.color = "rgba(239, 68, 68, 0.25)";
            stamp.style.borderColor = "rgba(239, 68, 68, 0.25)";
        } else {
            stamp.style.color = "rgba(34, 197, 94, 0.25)";
            stamp.style.borderColor = "rgba(34, 197, 94, 0.25)";
        }
    } else {
        stamp.classList.add('hidden');
    }

    updateQRCode(grandTotal);
}

function updateQRCode(amount) {
    const qrContainer = document.getElementById('qrcode');

    // If user uploaded a custom image and didn't clear it, don't overwrite with auto-generated code
    // UNLESS the amount changed? Actually, if it's a static image (like GPay screenshot), it doesn't encode amount.
    // So we respect the custom image if present.
    if (qrContainer.dataset.custom === "true") return;

    qrContainer.innerHTML = ''; // Clear previous
    const upiId = document.getElementById('upiId').value || 'brandinvo@upi';

    if (typeof QRCode === 'undefined') {
        qrContainer.innerHTML = '<p style="font-size:0.7rem; color:#666; text-align:center; padding:10px; border:1px dashed #ccc;">QR Lib Missing</p>';
        return;
    }

    new QRCode(qrContainer, {
        text: `upi://pay?pa=${upiId}&pn=BrandInvo&am=${amount}`,
        width: 100,
        height: 100
    });
}

// --- History & Storage Logic ---

function getInvoices() {
    const stored = safeStorage.getItem('brandlift_invoices');
    return stored ? JSON.parse(stored) : [];
}

function saveInvoice(silent = false) {
    // alert("Debug: Save Button Clicked"); 
    const id = document.getElementById('invoiceId').value;
    if (!id) return silent ? null : showToast('Please enter an Invoice ID', 'error');

    // Calculate Totals for Saving
    const items = currentInvoiceItems;
    const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const discountVal = parseFloat(document.getElementById('discountVal').value) || 0;
    const taxAmt = (subtotal * taxRate) / 100;
    const grandTotal = Math.max(0, subtotal + taxAmt - discountVal);

    const invoiceData = {
        id: id,
        date: document.getElementById('invoiceDate').value,
        clientName: document.getElementById('clientName').value,
        clientAddress: document.getElementById('clientAddress').value,
        items: items,
        status: document.getElementById('invoiceStatus').value,
        savedAt: new Date().toISOString(),
        // New Financial Fields
        subtotal: subtotal,
        taxRate: taxRate,
        discountVal: discountVal,
        amount: grandTotal // "amount" is used for Total Revenue
    };

    const invoices = getInvoices();
    const existingIndex = invoices.findIndex(inv => inv.id === id);

    if (existingIndex >= 0) {
        invoices[existingIndex] = invoiceData;
    } else {
        invoices.push(invoiceData);
    }

    // Update Debug Form URL if present
    const debugForm = document.getElementById('debugForm');
    if (debugForm) {
        const url = safeStorage.getItem('brandlift_sheet_url');
        if (url) debugForm.action = url;
    }

    if (safeStorage.setItem('brandlift_invoices', JSON.stringify(invoices))) {
        if (!silent) {
            showToast("Invoice Saved Successfully!", 'success');
            // alert("Debug: Saved locally. Now syncing to Google...");

            // Keep the sync call
            syncToGoogleSheet(invoiceData);
        } else {
            showAutoSaveIndicator();
        }
        renderHistoryList();
        updateDashboard(); // Update stats immediately
    }
}

// --- Google Sheets Sync ---
function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.toggle('open');

    // Sync Debug Form URL
    if (modal.classList.contains('open')) {
        const url = document.getElementById('sheetUrl').value || safeStorage.getItem('brandlift_sheet_url');
        const debugForm = document.getElementById('debugForm');
        if (debugForm && url) debugForm.action = url;
    }
}

function saveSettings() {
    const url = document.getElementById('sheetUrl').value.trim();
    safeStorage.setItem('brandlift_sheet_url', url);
    showToast('Settings Saved', 'success');
    toggleSettings();
}

// New Test Function


function syncToGoogleSheet(data) {
    try {
        // PRIORITY: Get from Input Field first (what user sees), then Storage
        let url = document.getElementById('sheetUrl').value.trim();
        if (!url) url = safeStorage.getItem('brandlift_sheet_url');

        if (!url) {
            // Only show toast if it's an explicit save (not autosave silent)
            // But here we are usually called by save which checks silent?
            // saveInvoice calls us inside (!silent) block, so safe to toast.
            showToast("Sync Skipped: No Google Sheet URL.", 'error');
            return;
        }

        // Use data.amount property if available (Phase 3), otherwise calc simple total
        let finalAmount = data.amount;
        if (finalAmount === undefined || finalAmount === null) {
            finalAmount = data.items.reduce((s, i) => s + (i.price * i.qty), 0);
        }

        // Format Payload
        const payload = {
            id: data.id,
            date: data.date,
            clientName: data.clientName,
            amount: finalAmount, // Number or String
            status: data.status || 'PENDING',
            items: data.items.map(i => `${i.name} (${i.qty})`).join(', ')
        };

        // Standard GAS Method: Form Data
        const formData = new URLSearchParams();
        for (const key in payload) {
            formData.append(key, payload[key]);
        }

        // console.log("Syncing to:", url);

        fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        }).then(() => {
            // Success Feedback
            const btn = document.getElementById('saveBtn');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = 'Saved & Synced <i class="fas fa-check"></i>';
                setTimeout(() => btn.innerHTML = originalText, 2500);
            }
        }).catch(err => {
            console.error('Sync failed', err);
            showToast("Sync Network Error: " + err.message, 'error');
        });
    } catch (e) {
        showToast("Sync Error: " + e.message, 'error');
        console.error(e);
    }
}


// --- Autosave Logic ---
let autoSaveTimeout;
const AUTOSAVE_DELAY = 1000; // 1 second debounce

function triggerAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        saveInvoice(true);
    }, AUTOSAVE_DELAY);
}

function showAutoSaveIndicator() {
    const btn = document.getElementById('saveBtn');
    const originalText = btn.innerText;
    btn.innerText = 'Saved ✓';
    setTimeout(() => {
        btn.innerText = originalText;
    }, 1500);
}

// --- Auto Generation Logic ---

function autoGenerateNextId() {
    const invoices = getInvoices();
    const today = new Date();
    const yy = today.getFullYear().toString().slice(-2);
    const mm = (today.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `BL-${yy}-${mm}`;

    if (invoices.length === 0) {
        document.getElementById('invoiceId').value = `${prefix}-01`;
        updatePreviewText('previewInvoiceId', `${prefix}-01`);
        return;
    }

    // Find max number for current month/year prefix
    let maxNum = 0;
    invoices.forEach(inv => {
        if (inv.id && inv.id.startsWith(prefix)) {
            const parts = inv.id.split('-');
            const num = parseInt(parts[parts.length - 1]);
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
    });

    // Use global max if current month has no invoices yet? 
    // Or reset for new month? Usually reset.
    // But if user wants a running number regardless of month?
    // Let's stick to simple sequential if monthly reset is confusing.
    // Actually, let's look at all IDs to be safe against collisions.

    // Revised Strategy: Just get the absolute highest suffix number found in ANY ID to prevent duplicates,
    // OR strict monthly format. Let's do strict monthly `BL-YY-MM-XX`.

    const nextNum = maxNum + 1;
    const paddedNum = nextNum.toString().padStart(2, '0');
    const newId = `${prefix}-${paddedNum}`;

    document.getElementById('invoiceId').value = newId;
    updatePreviewText('previewInvoiceId', newId);
}



function updatePreviewText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

function setLocalTodayDate() {
    const dateInput = document.getElementById('invoiceDate');
    const now = new Date();
    const localISOTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
    if (dateInput) dateInput.value = localISOTime;

    // Also trigger preview update
    const d = new Date();
    document.getElementById('previewDate').innerText = d.toLocaleDateString('en-GB');
}

function startNewInvoice() {
    if (confirm('Are you sure you want to start a new invoice? Unsaved changes will be lost.')) {
        // Reset fields
        document.getElementById('clientName').value = '';
        const addr = document.getElementById('clientAddress');
        if (addr) addr.value = '';

        setLocalTodayDate();

        currentInvoiceItems = [{ name: '', price: 0, qty: 1 }];
        renderItems();
        updatePreview();

        // Generate new ID
        autoGenerateNextId();

        // Reset QR State if needed
        const qr = document.getElementById('qrcode');
        if (qr) {
            qr.innerHTML = '';
            qr.dataset.custom = "false";
            updateQRCode(0);
        }
    }
}


function resetQRState() {
    document.getElementById('qrcode').dataset.custom = "false";
    document.getElementById('qrUpload').value = "";
}

// --- History UI ---

function toggleHistory() {
    const sidebar = document.getElementById('historySidebar');
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
        renderHistoryList();
        updateDashboard(); // Update stats when opening
    }
}

function updateDashboard() {
    const invoices = getInvoices();

    // Total Revenue
    const totalRev = invoices.reduce((sum, inv) => {
        // Calculate invoice total
        const itemsTotal = inv.items.reduce((s, i) => s + (i.price * i.qty), 0);
        // Note: We should ideally save grand total in invoice object but for now re-calc
        // Simplification: Assume Items Total is close enough or if we saved grand total, use that.
        // Let's use logic similar to renderHistoryItem
        return sum + itemsTotal;
    }, 0);

    // Monthly Revenue
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyRev = invoices.reduce((sum, inv) => {
        const d = new Date(inv.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            const itemsTotal = inv.items.reduce((s, i) => s + (i.price * i.qty), 0);
            return sum + itemsTotal;
        }
        return sum;
    }, 0);

    const totalEl = document.getElementById('totalRevenueDisplay');
    const monthEl = document.getElementById('monthlyRevenueDisplay');

    if (totalEl) totalEl.innerText = formatCurrency(totalRev);
    if (monthEl) monthEl.innerText = formatCurrency(monthlyRev);
}

function renderHistoryList(filterText = '') {
    const list = document.getElementById('historyList');
    const invoices = getInvoices();

    // Sort Newest First
    invoices.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    list.innerHTML = '';

    // Filter
    const filtered = invoices.filter(inv => {
        const text = filterText.toLowerCase();
        return (inv.id && inv.id.toLowerCase().includes(text)) ||
            (inv.clientName && inv.clientName.toLowerCase().includes(text));
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p style="color:#666; text-align:center; margin-top:20px;">No history found</p>';
        return;
    }

    filtered.forEach(inv => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const total = inv.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        // Calculate status
        const status = inv.status || 'PENDING';
        const isPaid = status === 'PAID';

        item.innerHTML = `
            <div class="history-info" onclick="loadInvoice('${inv.id}')">
                <h4>${inv.id}</h4>
                <p>${inv.clientName || 'Unknown Client'}</p>
                    <span>${new Date(inv.date).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>${formatCurrency(total)}</span>
                    <span class="history-status-badge ${isPaid ? 'paid' : 'pending'}" onclick="toggleInvoiceStatus('${inv.id}', event)" title="Click to toggle status">${status}</span>
                </div>
            </div>
            <div class="history-actions-row">
                <button class="action-btn" onclick="duplicateInvoice('${inv.id}', event)" title="Duplicate / Clone">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteInvoice('${inv.id}', event)" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

window.loadInvoice = function (id) {
    const invoices = getInvoices();
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;

    if (confirm('Load this invoice? Unsaved changes in current editor will be lost.')) {
        loadInvoiceData(inv);
    }
}

window.deleteInvoice = function (id, event) {
    if (event) event.stopPropagation();
    if (!confirm('Delete this invoice from history?')) return;

    let invoices = getInvoices();
    invoices = invoices.filter(inv => inv.id !== id);
    safeStorage.setItem('brandlift_invoices', JSON.stringify(invoices));

    const searchVal = document.getElementById('historySearch').value;
    renderHistoryList(searchVal);
}

window.toggleInvoiceStatus = function (id, event) {
    if (event) event.stopPropagation();

    let invoices = getInvoices();
    const index = invoices.findIndex(inv => inv.id === id);

    if (index !== -1) {
        const currentStatus = invoices[index].status || 'PENDING';
        const newStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';

        invoices[index].status = newStatus;
        safeStorage.setItem('brandlift_invoices', JSON.stringify(invoices));

        // Refresh list
        const searchVal = document.getElementById('historySearch').value;
        renderHistoryList(searchVal);

        // If this invoice is currently loaded in editor, update the editor status too
        if (document.getElementById('invoiceId').value === id) {
            document.getElementById('invoiceStatus').value = newStatus;
            updatePreview();
        }
    }
}

window.clearAllHistory = function () {
    if (!confirm('Are you sure you want to clear ALL invoice history? This cannot be undone.')) return;
    safeStorage.setItem('brandlift_invoices', JSON.stringify([]));
    renderHistoryList();
}

function loadInvoiceData(inv) {
    document.getElementById('invoiceId').value = inv.id;
    document.getElementById('invoiceDate').value = inv.date;
    document.getElementById('clientName').value = inv.clientName;
    document.getElementById('clientAddress').value = inv.clientAddress;

    currentInvoiceItems = JSON.parse(JSON.stringify(inv.items)); // Deep copy

    // Reset QR to standard before rendering
    document.getElementById('qrcode').dataset.custom = "false";
    document.getElementById('qrUpload').value = "";

    renderItems();
    updatePreview();

    // Trigger input events to update preview text for static fields
    document.getElementById('previewInvoiceId').innerText = inv.id;
    document.getElementById('previewClientName').innerText = inv.clientName || '';
    const d = new Date(inv.date);
    document.getElementById('previewDate').innerText = d.toLocaleDateString('en-GB');

    // Set Status if exists
    if (inv.status) {
        document.getElementById('invoiceStatus').value = inv.status;
    } else {
        document.getElementById('invoiceStatus').value = "";
    }

    // Restore Financial Settings (Phase 3)
    document.getElementById('taxRate').value = inv.taxRate || 0;
    document.getElementById('discountVal').value = inv.discountVal || 0;

    toggleHistory(); // Close sidebar
}

window.duplicateInvoice = function (id, event) {
    if (event) event.stopPropagation();

    const invoices = getInvoices();
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;

    if (!confirm('Create a new invoice based on this one?')) return;

    // Load data but treat as new
    loadInvoiceData(inv);

    // Set to today
    setLocalTodayDate();

    // Generate NEW ID
    autoGenerateNextId();

    // Clear autosave status/ui if any
    toggleHistory(); // Close sidebar if open
}

function updateAddressOptions() {
    const invoices = getInvoices();
    const names = [...new Set(invoices.map(i => i.clientName).filter(n => n))];
    const datalist = document.getElementById('clientList');
    if (datalist) {
        datalist.innerHTML = names.map(n => `<option value="${n}">`).join('');
    }
}

function exportToCSV() {
    const invoices = getInvoices();
    if (invoices.length === 0) return showToast('No data to export', 'info');

    const headers = ['Invoice ID', 'Date', 'Client Name', 'Client Address', 'Items', 'Total Amount', 'Status', 'Created At'];
    const rows = invoices.map(inv => {
        const total = inv.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        const itemSummary = inv.items.map(i => `${i.name} (${i.qty}x${i.price})`).join('; ');

        return [
            inv.id,
            inv.date,
            `"${inv.clientName || ''}"`, // Quote strings with commas
            `"${inv.clientAddress || ''}"`,
            `"${itemSummary}"`,
            total,
            inv.status || 'PENDING',
            inv.savedAt
        ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `invoices_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- PDF Generation ---
// --- PDF Generation ---
function generatePDF() {
    const element = document.getElementById('invoicePreview'); // Capture the Preview Panel, not the hidden/complex editor
    const button = document.getElementById('downloadBtn');
    const originalText = button.innerHTML;

    button.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Generating...";
    button.disabled = true;

    if (typeof html2pdf === 'undefined') {
        showToast('Error: PDF Generator library not loaded.', 'error');
        button.innerHTML = originalText;
        button.disabled = false;
        return;
    }

    // Clone to ensure we capture the full height without scrollbars
    // We clone the 'invoice-box' which is the actual paper representation
    const invoiceContent = document.querySelector('.invoice-box').cloneNode(true);

    // Force specific print styles on the clone
    invoiceContent.style.width = '100%'; // Fit container
    invoiceContent.style.maxWidth = 'none';
    // invoiceContent.style.minHeight = '297mm'; // REMOVED: Caused overflow
    invoiceContent.style.height = 'auto'; // Allow it to grow
    invoiceContent.style.margin = '0';
    invoiceContent.style.padding = '40px'; // Ensure padding is consistent
    invoiceContent.style.boxShadow = 'none';
    invoiceContent.style.transform = 'none'; // Reset any scaling

    // Temporary container off-screen
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm'; // Restrict width
    container.appendChild(invoiceContent);
    document.body.appendChild(container);

    const opt = {
        margin: [0, 0, 0, 0], // Top, Left, Bottom, Right (mm)
        filename: `invoice ${document.getElementById('invoiceId').value || 'Draft'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] } // Respect CSS page-break-inside: avoid
    };

    html2pdf().set(opt).from(invoiceContent).save().then(() => {
        document.body.removeChild(container);
        button.innerHTML = originalText;
        button.disabled = false;
    }).catch(err => {
        console.error(err);
        showToast("PDF Generation Error: " + err.message, 'error');
        document.body.removeChild(container);
        button.innerHTML = originalText;
        button.disabled = false;
    });
}

// --- WhatsApp Share ---
function shareToWhatsApp() {
    const clientName = document.getElementById('clientName').value || 'Client';
    const invoiceId = document.getElementById('invoiceId').value || 'DRAFT';
    const total = document.getElementById('previewTotal').innerText;
    const date = document.getElementById('previewDate').innerText;

    const text = `*INVOICE: ${invoiceId}*\n` +
        `To: ${clientName}\n` +
        `Date: ${date}\n` +
        `Total: *${total}*\n\n` +
        `Here is your invoice for the recent work. Please find the details attached/above.\n` +
        `Thank you for your business!`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// --- Toast Logic ---
function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    // Remove after 3s
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createToastContainer() {
    const div = document.createElement('div');
    div.className = 'toast-container';
    document.body.appendChild(div);
    return div;
}

// --- Backup & Restore ---
function exportData() {
    const data = {
        invoices: getInvoices(),
        settings: {
            sheetUrl: safeStorage.getItem('brandlift_sheet_url'),
            upiId: safeStorage.getItem('brandlift_upi_id'),
            logo: safeStorage.getItem('brandlift_logo_base64')
        },
        version: '1.1'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brandinvo_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('Backup Downloaded', 'success');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.invoices) safeStorage.setItem('brandlift_invoices', JSON.stringify(data.invoices));
            if (data.settings) {
                if (data.settings.sheetUrl) safeStorage.setItem('brandlift_sheet_url', data.settings.sheetUrl);
                if (data.settings.upiId) safeStorage.setItem('brandlift_upi_id', data.settings.upiId);
                if (data.settings.logo) safeStorage.setItem('brandlift_logo_base64', data.settings.logo);
            }
            showToast('Data Restored Successfully!', 'success');
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            showToast('Invalid Backup File', 'error');
            console.error(err);
        }
    };
    reader.readAsText(file);
}
