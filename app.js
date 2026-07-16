// State storage
let transactions = [];
let userProfile = {
    name: "",
    email: "",
    avatar: "bg-blue-500",
    biometricLock: false
};

function getAvatarHtml(name, colorClass) {
    const firstLetter = name ? name.trim().charAt(0).toUpperCase() : 'U';
    const bgClass = colorClass || 'bg-blue-500';
    return `<div class="w-full h-full rounded-full ${bgClass} text-white flex items-center justify-center font-bold text-lg uppercase select-none">${firstLetter}</div>`;
}

let budgetEnabled = false;
let monthlyBudgetLimit = 0;
let categoryBudgetLimits = {
    'Food and Dining': 0,
    'Groceries': 0,
    'Shopping': 0,
    'Education': 0,
    'Transport': 0,
    'Bills & Utilities': 0,
    'Entertainment': 0,
    'Medical': 0,
    'Travelling': 0,
    'Insurance': 0,
    'Taxes': 0,
    'Investments': 0,
    'Personal Care': 0,
    'Gift & Donations': 0,
    'Others': 0,
    'Family': 0,
    'Veer Auto': 0
};
let userAccounts = [
    { id: 'cash', name: 'Cash Wallet', holderName: '', type: 'cash', startingBalance: 0.00 }
];
let scheduledTransactions = [];
let dashboardFilter = 'month';
let editingTransactionId = null;
let selectedTxDateObj = new Date();
let currentTheme = 'dark';
let autoBackupEnabled = false;
let lastBackupAt = null;
let lastStateChangeAt = null;

const SUPABASE_APP_ID = 'expenledge';
const SUPABASE_CONFIG_KEY = 'expenledge_supabase_config';
const SUPABASE_DEVICE_KEY = 'expenledge_supabase_device_id';
const SUPABASE_LAST_SYNC_KEY = 'expenledge_last_supabase_sync_at';
const SUPABASE_LAST_STATE_CHANGE_KEY = 'expenledge_last_state_change_at';
const SUPABASE_LAST_REMOTE_APPLIED_KEY = 'expenledge_last_remote_applied_at';
/* Fingerprint of the local snapshot that was last successfully pushed to Supabase.
   When the local state hasn't changed since this fingerprint was computed, we
   can skip the (very expensive) upsert of a 10k+ transaction payload entirely. */
const SUPABASE_LAST_PUSH_FINGERPRINT_KEY = 'expenledge_last_supabase_push_fp';
/* The remote `updated_at` we last saw. Used to short-circuit pullSupabaseSnapshot
   when nothing has changed on the server. */
const SUPABASE_LAST_REMOTE_UPDATED_AT_KEY = 'expenledge_last_supabase_remote_updated_at';

let supabaseClient = null;
let supabaseRealtimeChannel = null;
let supabaseConfig = {
    url: '',
    anonKey: '',
    appId: SUPABASE_APP_ID,
    deviceId: localStorage.getItem(SUPABASE_DEVICE_KEY) || (crypto?.randomUUID ? crypto.randomUUID() : `device_${Date.now()}_${Math.random().toString(36).slice(2)}`)
};
const SUPABASE_VERSION_TABLE = 'expenledge_state_versions';
const SUPABASE_MAX_VERSIONS = 2;

let supabaseIntegration = {
    connected: false,
    connecting: false,
    pendingSync: false,
    syncInProgress: false,
    applyingRemote: false,
    booting: true,
    lastError: '',
    lastSyncAt: null,
    lastRemoteAppliedAt: null
};
let supabaseSyncTimer = null;
let supabaseInitialLoadDone = false;

let currentView = 'home';
let isSearching = false;
let dashboardSearchOpen = false;

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let incomeDetailsYear = currentYear;
let incomeDetailsMonth = currentMonth;
let spendingDetailsYear = currentYear;
let spendingDetailsMonth = currentMonth;
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let analysisPeriod = 'month'; // 'week' | 'month' | 'year' | 'custom'
let analysisYear = new Date().getFullYear();
let analysisMonth = new Date().getMonth();
let analysisWeekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d; })();
let analysisCatType = 'spending'; // 'spending' | 'income'

// Add transaction state variables
let selectedTxType = 'expense';
let categoryLayout = 'grid';
let selectedCategory = 'Groceries';
let selectedCategoryIcon = 'shopping_basket';
let selectedPaymentMode = 'Cash';
let selectedPaymentIcon = 'payments';
let selectedTags = [];
let allAvailableTags = [];
let includeCashInBalance = true;
const CATEGORY_ORDER_PRESET_VERSION = '2';

// Demo tags from older releases are removed the next time saved data is loaded.
const legacyPlaceholderTags = new Set([
    'amazon', 'netflix', 'spotify', 'zomato', 'swiggy', 'uber', 'ola', 'flipkart', 'myntra'
]);

const expenseCategories = [
    { name: 'Others', icon: 'more_horiz', color: 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant', fillClass: 'group-hover:bg-surface-container-highest text-on-surface-variant', builtIn: true },
    { name: 'Bills & Utilities', icon: 'receipt_long', color: 'bg-error/10 border-error/20 text-error', fillClass: 'group-hover:bg-error/20 text-error', builtIn: true },
    { name: 'Shopping', icon: 'shopping_bag', color: 'bg-secondary-container/10 border-secondary-container/20 text-secondary', fillClass: 'group-hover:bg-secondary-container/20 text-secondary', builtIn: true },
    { name: 'Groceries', icon: 'shopping_basket', color: 'bg-tertiary-container/10 border-tertiary-container/20 text-tertiary', fillClass: 'group-hover:bg-tertiary-container/20 text-tertiary', builtIn: true },
    { name: 'Food and Dining', icon: 'restaurant', color: 'bg-primary-container/10 border-primary-container/20 text-primary', fillClass: 'group-hover:bg-primary-container/20 text-primary', builtIn: true },
    { name: 'Travelling', icon: 'flight', color: 'bg-secondary-container/10 border-secondary-container/20 text-secondary', fillClass: 'group-hover:bg-secondary-container/20 text-secondary', builtIn: true },
    { name: 'Veer Auto', icon: 'directions_car', color: 'bg-primary/10 border-primary/20 text-primary', fillClass: 'group-hover:bg-primary/20 text-primary', builtIn: true },
    { name: 'Entertainment', icon: 'sports_esports', color: 'bg-tertiary-container/10 border-tertiary-container/20 text-tertiary', fillClass: 'group-hover:bg-tertiary-container/20 text-tertiary', builtIn: true },
    { name: 'Medical', icon: 'medical_services', color: 'bg-error-container/20 border-error-container/30 text-error', fillClass: 'group-hover:bg-error-container/40 text-error', builtIn: true },
    { name: 'Education', icon: 'school', color: 'bg-primary-container/10 border-primary-container/20 text-primary', fillClass: 'group-hover:bg-primary-container/20 text-primary', builtIn: true },
    { name: 'Family', icon: 'family_restroom', color: 'bg-primary/10 border-primary/20 text-primary', fillClass: 'group-hover:bg-primary/20 text-primary', builtIn: true },
    { name: 'Gift & Donations', icon: 'volunteer_activism', color: 'bg-primary-container/10 border-primary-container/20 text-primary', fillClass: 'group-hover:bg-primary-container/20 text-primary', builtIn: true },
    { name: 'Transport', icon: 'commute', color: 'bg-primary/10 border-primary/20 text-primary', fillClass: 'group-hover:bg-primary/20 text-primary', builtIn: true },
    { name: 'Insurance', icon: 'health_and_safety', color: 'bg-primary/10 border-primary/20 text-primary', fillClass: 'group-hover:bg-primary/20 text-primary', builtIn: true },
    { name: 'Taxes', icon: 'request_quote', color: 'bg-error/10 border-error/20 text-error', fillClass: 'group-hover:bg-error/20 text-error', builtIn: true },
    { name: 'Investments', icon: 'trending_up', color: 'bg-secondary-container/10 border-secondary-container/20 text-secondary', fillClass: 'group-hover:bg-secondary-container/20 text-secondary', builtIn: true },
    { name: 'Personal Care', icon: 'spa', color: 'bg-tertiary-container/10 border-tertiary-container/20 text-tertiary', fillClass: 'group-hover:bg-tertiary-container/20 text-tertiary', builtIn: true }
];

const incomeCategories = [
    { name: 'Salary', icon: 'work', color: 'bg-primary-container/10 border-primary-container/20 text-primary', fillClass: 'group-hover:bg-primary-container/20 text-primary', builtIn: true },
    { name: 'Other Income', icon: 'payments', color: 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant', fillClass: 'group-hover:bg-surface-container-highest text-on-surface-variant', builtIn: true },
    { name: 'Investments', icon: 'trending_up', color: 'bg-secondary-container/10 border-secondary-container/20 text-secondary', fillClass: 'group-hover:bg-secondary-container/20 text-secondary', builtIn: true },
    { name: 'Rentals', icon: 'home_work', color: 'bg-primary/10 border-primary/20 text-primary', fillClass: 'group-hover:bg-primary/20 text-primary', builtIn: true },
    { name: 'Veer Auto', icon: 'directions_car', color: 'bg-primary/10 border-primary/20 text-primary', fillClass: 'group-hover:bg-primary/20 text-primary', builtIn: true },
    { name: 'Freelance', icon: 'laptop_mac', color: 'bg-tertiary-container/10 border-tertiary-container/20 text-tertiary', fillClass: 'group-hover:bg-tertiary-container/20 text-tertiary', builtIn: true },
    { name: 'Sold Items', icon: 'sell', color: 'bg-tertiary-container/10 border-tertiary-container/20 text-tertiary', fillClass: 'group-hover:bg-tertiary-container/20 text-tertiary', builtIn: true }
];

const DEFAULT_EXPENSE_CATEGORY_ORDER = [
    'Others',
    'Bills & Utilities',
    'Shopping',
    'Groceries',
    'Food and Dining',
    'Travelling',
    'Veer Auto',
    'Entertainment',
    'Medical',
    'Education',
    'Family',
    'Gift & Donations',
    'Transport',
    'Insurance',
    'Taxes',
    'Investments',
    'Personal Care'
];

const DEFAULT_INCOME_CATEGORY_ORDER = [
    'Salary',
    'Other Income',
    'Investments',
    'Rentals',
    'Veer Auto',
    'Freelance',
    'Sold Items'
];

function applyDefaultCategoryOrder() {
    applyCategoryOrder(expenseCategories, DEFAULT_EXPENSE_CATEGORY_ORDER);
    applyCategoryOrder(incomeCategories, DEFAULT_INCOME_CATEGORY_ORDER);
}

function suppressBrowserAutofill(root = document) {
    const fields = [];
    if (root.matches && root.matches('input, textarea')) fields.push(root);
    if (root.querySelectorAll) fields.push(...root.querySelectorAll('input, textarea'));

    fields.forEach((el) => {
        if (!el || el.disabled) return;

        const type = (el.getAttribute('type') || el.type || '').toLowerCase();
        if (['hidden', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color'].includes(type)) return;

        // Force autocomplete off - some password managers ignore "off" but respect "new-password"
        // We use a combination: set to "off" and also set data-lpignore etc.
        el.setAttribute('autocomplete', 'new-password');
        el.setAttribute('autocapitalize', 'none');
        el.setAttribute('autocorrect', 'off');
        el.setAttribute('spellcheck', 'false');
        el.setAttribute('data-form-type', 'other');
        el.setAttribute('data-lpignore', 'true');
        el.setAttribute('data-1p-ignore', 'true');
        el.setAttribute('data-bwignore', 'true');
        el.setAttribute('data-protonpass-ignore', 'true');

        // Additional attributes to block Google Payment Manager and autofill
        el.setAttribute('aria-autocomplete', 'none');
        el.setAttribute('x-autocompletetype', 'none');
        el.setAttribute('x-webkit-autofill', 'off');
        el.setAttribute('x-moz-autofill', 'off');

        // Set a random, non-semantic name attribute to avoid pattern matching
        if (!el.name || el.name.startsWith('expenledge_')) {
            const safeId = (el.id || 'field').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
            el.setAttribute('name', `expenledge_${safeId}_${Date.now()}`);
        }

        // For number fields, switch to text + inputmode decimal to block payment detection
        if (type === 'number') {
            el.setAttribute('type', 'text');
            el.setAttribute('inputmode', 'decimal');
        } else if (type === 'email') {
            el.setAttribute('inputmode', 'email');
        } else if (!el.getAttribute('inputmode')) {
            el.setAttribute('inputmode', 'text');
        }

        // Remove any payment-related attributes that Chrome might use
        el.removeAttribute('payment');
        el.removeAttribute('payment-request');
        el.removeAttribute('cc-number');
        el.removeAttribute('cc-exp');
        el.removeAttribute('cc-csc');
        el.removeAttribute('cc-name');

        // Ensure the field is not treated as a payment field
        const form = el.closest('form');
        if (form) {
            form.setAttribute('autocomplete', 'off');
            form.setAttribute('x-autocompletetype', 'none');
            form.setAttribute('data-lpignore', 'true');
        }

        // CRITICAL: Set readonly to block password managers completely
        // Remove on first pointer interaction (before focus) so Payment Manager never triggers
        if (!el.hasAttribute('readonly')) {
            el.setAttribute('readonly', 'readonly');
            // Remove readonly on first pointer/tap interaction (happens BEFORE focus)
            el.addEventListener('pointerdown', function onFirstInteraction(e) {
                if (this.hasAttribute('readonly')) {
                    this.removeAttribute('readonly');
                    this.focus();
                }
                this.removeEventListener('pointerdown', onFirstInteraction);
            }, { once: true });
            // Fallback for keyboard-only users
            el.addEventListener('keydown', function onFirstKeydown(e) {
                if (this.hasAttribute('readonly') && !e.ctrlKey && !e.metaKey && e.key !== 'Tab') {
                    this.removeAttribute('readonly');
                    this.removeEventListener('keydown', onFirstKeydown);
                }
            }, { once: true });
        }
    });
}

function renameCategoryBudgetKey(oldName, newName) {
    if (Object.prototype.hasOwnProperty.call(categoryBudgetLimits, oldName)) {
        categoryBudgetLimits[newName] = categoryBudgetLimits[newName] || categoryBudgetLimits[oldName] || 0;
        delete categoryBudgetLimits[oldName];
    }
}

function normalizeBuiltInCategoryNames() {
    const renamedCategories = {
        'Food & Drinks': 'Food and Dining',
        'Food and drinks': 'Food and Dining',
        'Travel': 'Travelling',
        'Gifts & Grants': 'Other Income',
        'Gift & Grants': 'Other Income'
    };

    transactions.forEach(t => {
        if (renamedCategories[t.category]) {
            t.category = renamedCategories[t.category];
            const categoryList = t.type === 'income' ? incomeCategories : expenseCategories;
            const matchedCategory = categoryList.find(c => c.name === t.category);
            if (matchedCategory) t.categoryIcon = matchedCategory.icon;
        }
    });

    renameCategoryBudgetKey('Food & Drinks', 'Food and Dining');
    renameCategoryBudgetKey('Food and drinks', 'Food and Dining');
    renameCategoryBudgetKey('Travel', 'Travelling');

    expenseCategories.forEach(cat => {
        if (!Object.prototype.hasOwnProperty.call(categoryBudgetLimits, cat.name)) {
            categoryBudgetLimits[cat.name] = 0;
        }
    });
}

function saveCategoryOrders() {
    localStorage.setItem('expenledge_category_orders', JSON.stringify({
        expense: expenseCategories.map(category => category.name),
        income: incomeCategories.map(category => category.name)
    }));
}

function createUserCategory(name, icon) {
    return {
        name,
        icon,
        color: 'bg-primary-container/10 border-primary-container/20 text-primary',
        fillClass: 'group-hover:bg-primary-container/20 text-primary'
    };
}

function saveCustomCategories() {
    localStorage.setItem('expenledge_custom_categories', JSON.stringify({
        expense: expenseCategories.filter(category => !category.builtIn),
        income: incomeCategories.filter(category => !category.builtIn)
    }));
}

function restoreCustomCategories(categories, savedCategories) {
    if (!Array.isArray(savedCategories)) return;
    savedCategories.forEach(category => {
        if (!category || typeof category.name !== 'string' || !category.name.trim()) return;
        if (categories.some(existing => existing.name.toLowerCase() === category.name.trim().toLowerCase())) return;
        categories.push(createUserCategory(category.name.trim(), typeof category.icon === 'string' ? category.icon : 'category'));
    });
}

function applyCategoryOrder(categories, order) {
    if (!Array.isArray(order)) return;
    const categoriesByName = new Map(categories.map(category => [category.name, category]));
    const orderedCategories = order.map(name => categoriesByName.get(name)).filter(Boolean);
    const remainingCategories = categories.filter(category => !order.includes(category.name));
    categories.splice(0, categories.length, ...orderedCategories, ...remainingCategories);
}

function getAllTags() {
    const tags = new Set(allAvailableTags);
    transactions.forEach(transaction => {
        (transaction.tags || []).forEach(tag => tags.add(tag));
    });
    return [...tags]
        .filter(tag => typeof tag === 'string' && tag.trim())
        .sort((a, b) => a.localeCompare(b));
}

function removeLegacyPlaceholderTags() {
    if (localStorage.getItem('expenledge_placeholder_tags_removed') === 'true') return false;

    const isPlaceholderTag = tag => legacyPlaceholderTags.has(String(tag).trim().toLowerCase());
    const originalTagCount = allAvailableTags.length;
    allAvailableTags = allAvailableTags.filter(tag => !isPlaceholderTag(tag));

    let changed = allAvailableTags.length !== originalTagCount;
    transactions.forEach(transaction => {
        if (!Array.isArray(transaction.tags)) return;
        const remainingTags = transaction.tags.filter(tag => !isPlaceholderTag(tag));
        if (remainingTags.length !== transaction.tags.length) {
            transaction.tags = remainingTags;
            changed = true;
        }
    });

    localStorage.setItem('expenledge_placeholder_tags_removed', 'true');
    return changed;
}

function saveInterfacePreferences() {
    localStorage.setItem('expenledge_interface_preferences', JSON.stringify({
        categoryLayout,
        manageCategoryLayout,
        budgetPeriod
    }));
}

function loadInterfacePreferences() {
    const savedPreferences = localStorage.getItem('expenledge_interface_preferences');
    if (!savedPreferences) return;

    const preferences = JSON.parse(savedPreferences);
    if (!preferences || typeof preferences !== 'object') return;

    if (preferences.categoryLayout === 'grid' || preferences.categoryLayout === 'list') categoryLayout = preferences.categoryLayout;
    if (preferences.manageCategoryLayout === 'grid' || preferences.manageCategoryLayout === 'list') manageCategoryLayout = preferences.manageCategoryLayout;
    if (preferences.budgetPeriod === 'monthly' || preferences.budgetPeriod === 'yearly') budgetPeriod = preferences.budgetPeriod;
    syncCategoryLayoutUI();
    syncManageCategoryLayoutUI();
}

function syncCategoryLayoutUI() {
    const btnGrid = document.getElementById('btn-cat-layout-grid');
    const btnList = document.getElementById('btn-cat-layout-list');
    if (!btnGrid || !btnList) return;

    const activeCls = "p-1 rounded-full bg-primary text-on-primary shadow-sm flex items-center justify-center transition-all duration-150";
    const inactiveCls = "p-1 rounded-full text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all duration-150";

    if (categoryLayout === 'list') {
        btnList.className = activeCls;
        btnGrid.className = inactiveCls;
    } else {
        btnGrid.className = activeCls;
        btnList.className = inactiveCls;
    }
}

// Local Storage Persistence Helpers
function saveToLocalStorage() {
    try {
        localStorage.setItem('expenledge_transactions', JSON.stringify(transactions));
        localStorage.setItem('expenledge_profile', JSON.stringify(userProfile));
        localStorage.setItem('expenledge_budget_enabled', budgetEnabled.toString());
        localStorage.setItem('expenledge_budget_limit', monthlyBudgetLimit.toString());
        localStorage.setItem('expenledge_yearly_budget_limit', yearlyBudgetLimit.toString());
        localStorage.setItem('expenledge_active_balance_type', activeDashboardBalanceType);
        localStorage.setItem('expenledge_category_limits', JSON.stringify(categoryBudgetLimits));
        localStorage.setItem('expenledge_user_accounts', JSON.stringify(userAccounts));
        localStorage.setItem('expenledge_scheduled', JSON.stringify(scheduledTransactions));
        localStorage.setItem('expenledge_all_tags', JSON.stringify(allAvailableTags));
        localStorage.setItem('expenledge_include_cash', includeCashInBalance.toString());
        localStorage.removeItem('expenledge_dashboard_filter');
        localStorage.setItem('expenledge_auto_backup_enabled', autoBackupEnabled.toString());
        localStorage.setItem('expenledge_last_backup_at', lastBackupAt || '');
        saveDeletedTransactionLogSnapshot();
        saveCategoryOrders();
        saveCustomCategories();
        saveInterfacePreferences();
        markLocalStateChanged();
        queueSupabaseSync();
    } catch (e) {
        console.error("Local storage save failed: ", e);
    }
}

function shouldQueueSupabaseSync() {
    return !!supabaseClient && supabaseIntegration.connected && !supabaseIntegration.booting && !supabaseIntegration.applyingRemote;
}

function getSupabaseVersionTable() {
    return SUPABASE_VERSION_TABLE;
}

async function writeSupabaseVersionSnapshot(payload, updatedAt) {
    if (!supabaseClient?.from) return false;

    const snapshot = {
        app_id: SUPABASE_APP_ID,
        device_id: supabaseConfig.deviceId,
        payload,
        updated_at: updatedAt || new Date().toISOString()
    };

    try {
        const { error } = await supabaseClient
            .from(getSupabaseVersionTable())
            .insert(snapshot);

        if (error) throw error;
        // Prune only every Nth write — the prune is a separate SELECT + DELETE
        // round-trip that, for 10k+ transactions, is wasteful to run on every
        // single sync. With SUPABASE_MAX_VERSIONS = 2 we still keep the history
        // tightly bounded; we just don't pay the prune cost on every write.
        _versionWriteCount = (_versionWriteCount + 1) % 5;
        if (_versionWriteCount === 0) {
            pruneSupabaseVersionHistory().catch(() => { });
        }
        return true;
    } catch (error) {
        console.warn('Supabase version history write skipped:', error?.message || error);
        return false;
    }
}
let _versionWriteCount = 0;

async function pruneSupabaseVersionHistory() {
    if (!supabaseClient?.from) return false;

    try {
        const { data, error } = await supabaseClient
            .from(getSupabaseVersionTable())
            .select('id')
            .eq('app_id', SUPABASE_APP_ID)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        const idsToDelete = (data || []).slice(SUPABASE_MAX_VERSIONS).map(row => row.id).filter(Boolean);
        if (!idsToDelete.length) return true;

        const { error: deleteError } = await supabaseClient
            .from(getSupabaseVersionTable())
            .delete()
            .in('id', idsToDelete);

        if (deleteError) throw deleteError;
        return true;
    } catch (error) {
        console.warn('Supabase version history prune skipped:', error?.message || error);
        return false;
    }
}

function loadFromLocalStorage() {
    try {
        const savedT = localStorage.getItem('expenledge_transactions');
        if (savedT) transactions = JSON.parse(savedT);

        const savedP = localStorage.getItem('expenledge_profile');
        if (savedP) userProfile = JSON.parse(savedP);

        const savedE = localStorage.getItem('expenledge_budget_enabled');
        if (savedE) budgetEnabled = savedE === 'true';

        const savedL = localStorage.getItem('expenledge_budget_limit');
        if (savedL) {
            const val = parseFloat(savedL);
            monthlyBudgetLimit = (val === 9000) ? 0 : (val || 0);
        }

        const savedYL = localStorage.getItem('expenledge_yearly_budget_limit');
        if (savedYL) {
            const val = parseFloat(savedYL);
            yearlyBudgetLimit = (val === 108000) ? 0 : (val || 0);
        }

        const savedBT = localStorage.getItem('expenledge_active_balance_type');
        if (savedBT) activeDashboardBalanceType = savedBT;

        const savedC = localStorage.getItem('expenledge_category_limits');
        if (savedC) {
            categoryBudgetLimits = JSON.parse(savedC);
            const oldCatDefaults = {
                'Groceries': 2000, 'Shopping': 1000, 'Education': 800, 'Transport': 500,
                'Bills & Utilities': 1500, 'Entertainment': 600, 'Medical': 1000, 'Food & Drinks': 1200
            };
            let isOldDefault = true;
            for (const key in oldCatDefaults) {
                if (categoryBudgetLimits[key] !== oldCatDefaults[key]) {
                    isOldDefault = false;
                    break;
                }
            }
            if (isOldDefault) {
                for (const key in categoryBudgetLimits) {
                    categoryBudgetLimits[key] = 0;
                }
            }
        }
        normalizeBuiltInCategoryNames();

        const savedCustomCategories = localStorage.getItem('expenledge_custom_categories');
        if (savedCustomCategories) {
            const customCategories = JSON.parse(savedCustomCategories);
            restoreCustomCategories(expenseCategories, customCategories.expense);
            restoreCustomCategories(incomeCategories, customCategories.income);
        }

        const savedCategoryOrderPreset = localStorage.getItem('expenledge_category_order_preset');
        const savedCategoryOrders = localStorage.getItem('expenledge_category_orders');
        if (savedCategoryOrderPreset !== CATEGORY_ORDER_PRESET_VERSION) {
            applyDefaultCategoryOrder();
            saveCategoryOrders();
            localStorage.setItem('expenledge_category_order_preset', CATEGORY_ORDER_PRESET_VERSION);
        } else if (savedCategoryOrders) {
            const categoryOrders = JSON.parse(savedCategoryOrders);
            applyCategoryOrder(expenseCategories, categoryOrders.expense);
            applyCategoryOrder(incomeCategories, categoryOrders.income);
        } else {
            applyDefaultCategoryOrder();
            saveCategoryOrders();
        }

        const savedUA = localStorage.getItem('expenledge_user_accounts');
        if (savedUA) {
            userAccounts = JSON.parse(savedUA)
                .filter(acc => acc.id !== 'bank' && acc.id !== 'card')
                .map(acc => ({
                    ...acc,
                    // Clear the generated holder name used by older versions.
                    holderName: acc.holderName === 'Alex Thompson' ? '' : acc.holderName
                }));
            localStorage.setItem('expenledge_user_accounts', JSON.stringify(userAccounts));
        } else {
            const savedA = localStorage.getItem('expenledge_accounts');
            let initialCashBal = 0.00;
            if (savedA) {
                const legacyBal = JSON.parse(savedA);
                if (legacyBal.cash !== 950) {
                    initialCashBal = legacyBal.cash || 0.00;
                }
            }
            userAccounts = [
                { id: 'cash', name: 'Cash Wallet', holderName: '', type: 'cash', startingBalance: initialCashBal }
            ];
            localStorage.setItem('expenledge_user_accounts', JSON.stringify(userAccounts));
        }

        const savedS = localStorage.getItem('expenledge_scheduled');
        if (savedS) scheduledTransactions = JSON.parse(savedS);

        const savedTags = localStorage.getItem('expenledge_all_tags');
        if (savedTags) allAvailableTags = JSON.parse(savedTags);

        if (removeLegacyPlaceholderTags()) saveToLocalStorage();

        const savedCash = localStorage.getItem('expenledge_include_cash');
        if (savedCash !== null) includeCashInBalance = savedCash === 'true';

        const savedAutoBackup = localStorage.getItem('expenledge_auto_backup_enabled');
        if (savedAutoBackup) autoBackupEnabled = savedAutoBackup === 'true';

        const savedLastBackupAt = localStorage.getItem('expenledge_last_backup_at');
        if (savedLastBackupAt) lastBackupAt = savedLastBackupAt;

        const deletedLog = getDeletedTransactionLogSnapshot();
        if (deletedLog.length) {
            saveDeletedTransactionLogSnapshot(deletedLog);
        }

        const txMetadataChanged = ensureTransactionMetadata();
        const pruneChanged = pruneDeletedTransactionsFromCurrentState();
        if ((txMetadataChanged || pruneChanged) && !supabaseIntegration.applyingRemote) {
            saveToLocalStorage();
        }

        loadInterfacePreferences();

    } catch (e) {
        console.error("Local storage load failed: ", e);
    }
}
function getBackupStorageKeys() {
    const backupKeys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('expenledge_')) {
            backupKeys.push(key);
        }
    }
    return backupKeys.sort();
}

function buildBackupPayload() {
    saveToLocalStorage();
    const storage = {};
    getBackupStorageKeys().forEach(key => {
        storage[key] = localStorage.getItem(key);
    });

    return {
        app: 'ExpenLedge',
        type: 'full-backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        storage
    };
}

function updateBackupTimeDisplay() {
    const labels = [document.getElementById('cloud-backup-time'), document.getElementById('supabase-sync-time'), document.getElementById('supabase-header-sync-time')].filter(Boolean);
    if (!labels.length) return;

    const stamp = supabaseIntegration.lastSyncAt || localStorage.getItem(SUPABASE_LAST_SYNC_KEY) || lastBackupAt;
    if (!stamp) {
        labels.forEach(label => label.innerText = 'Last sync: Never');
        return;
    }

    const backupDate = new Date(stamp);
    if (Number.isNaN(backupDate.getTime())) {
        labels.forEach(label => label.innerText = 'Last sync: Never');
        return;
    }

    const timeStr = backupDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = backupDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    labels.forEach(label => label.innerText = `Last sync: ${dateStr} at ${timeStr}`);
}

function persistBackupMetadata() {
    localStorage.setItem('expenledge_auto_backup_enabled', autoBackupEnabled.toString());
    localStorage.setItem('expenledge_last_backup_at', lastBackupAt || '');
}

function setLastBackupNow() {
    lastBackupAt = new Date().toISOString();
    persistBackupMetadata();
    updateBackupTimeDisplay();
}

function applyBackupSheetPreferences() {
    const autoBackupToggle = document.getElementById('backup-auto-toggle');
    if (autoBackupToggle) autoBackupToggle.checked = autoBackupEnabled;
    updateBackupTimeDisplay();
}

function restoreBackupPayload(imported) {
    if (Array.isArray(imported)) {
        localStorage.setItem('expenledge_transactions', JSON.stringify(imported));
        lastBackupAt = new Date().toISOString();
        persistBackupMetadata();
        return true;
    }

    if (!imported || typeof imported !== 'object' || imported.type !== 'full-backup' || !imported.storage || typeof imported.storage !== 'object') {
        return false;
    }

    getBackupStorageKeys().forEach(key => localStorage.removeItem(key));
    Object.entries(imported.storage).forEach(([key, value]) => {
        if (key.startsWith('expenledge_')) {
            localStorage.setItem(key, value ?? '');
        }
    });

    lastBackupAt = imported.exportedAt || new Date().toISOString();
    persistBackupMetadata();
    return true;
}


function getSupabaseStorageSnapshot() {
    const storage = {};
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('expenledge_')) {
            storage[key] = localStorage.getItem(key);
        }
    }
    return storage;
}

/**
 * Compute a cheap fingerprint of the local storage snapshot.
 *
 * With 10,000+ transactions, JSON.stringify-ing the entire snapshot on every
 * sync just to compare it against the previous one is brutally slow. Instead
 * we build a fingerprint from:
 *   - the set of `expenledge_*` keys present
 *   - the length of each value (changes whenever a transaction is added /
 *     edited / deleted — the common case)
 *   - a tiny hash of each value's first + last 64 chars (catches edits that
 *     don't change the length, e.g. toggling a boolean setting)
 * The result is a single small string that can be compared in O(keys) time.
 */
function computeStorageFingerprint(storage) {
    const src = storage && typeof storage === 'object' ? storage : getSupabaseStorageSnapshot();
    const keys = Object.keys(src).sort();
    let acc = '';
    for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        const v = src[k] || '';
        const len = v.length;
        // Mix in key + length + first/last slice. Cheap and good enough to
        // detect any real-world user edit.
        const head = len > 64 ? v.slice(0, 64) : v;
        const tail = len > 128 ? v.slice(-64) : '';
        acc += k + ':' + len + ':' + head + ':' + tail + '|';
    }
    // FNV-1a 32-bit hash — fast, dependency-free, good distribution.
    let h = 0x811c9dc5;
    for (let i = 0; i < acc.length; i += 1) {
        h ^= acc.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return keys.length + '_' + h.toString(16) + '_' + acc.length;
}

function getLastPushFingerprint() {
    return localStorage.getItem(SUPABASE_LAST_PUSH_FINGERPRINT_KEY) || '';
}
function setLastPushFingerprint(fp) {
    if (fp) localStorage.setItem(SUPABASE_LAST_PUSH_FINGERPRINT_KEY, fp);
}
function getLastRemoteUpdatedAt() {
    return localStorage.getItem(SUPABASE_LAST_REMOTE_UPDATED_AT_KEY) || '';
}
function setLastRemoteUpdatedAt(ts) {
    if (ts) localStorage.setItem(SUPABASE_LAST_REMOTE_UPDATED_AT_KEY, ts);
}

function parseJsonSafe(raw, fallback) {
    if (raw === null || raw === undefined || raw === '') return fallback;
    try {
        return JSON.parse(raw);
    } catch (_error) {
        return fallback;
    }
}

function getTransactionSyncKey(tx) {
    return String(tx?.syncId || tx?.id || '').trim();
}

function generateTransactionSyncId() {
    return `tx_${crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function getTransactionFreshness(tx) {
    const stamp = tx?.updatedAt || tx?.rawDate || tx?.createdAt || '';
    const time = new Date(stamp).getTime();
    return Number.isFinite(time) ? time : 0;
}

function normalizeTransactionRecord(tx, index = 0) {
    if (!tx || typeof tx !== 'object') return tx;
    const next = { ...tx };
    if (!getTransactionSyncKey(next)) {
        next.syncId = generateTransactionSyncId();
    }
    if (!next.updatedAt) {
        next.updatedAt = next.rawDate || new Date().toISOString();
    }
    if (!next.createdAt) {
        next.createdAt = next.updatedAt;
    }
    if (next.id === undefined || next.id === null || next.id === '') {
        next.id = index + 1;
    }
    return next;
}

function normalizeTransactionsList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.map((tx, index) => {
        const next = normalizeTransactionRecord(tx, index);
        let key = getTransactionSyncKey(next);
        if (!key || seen.has(key)) {
            next.syncId = generateTransactionSyncId();
            key = next.syncId;
        }
        seen.add(key);
        return next;
    });
}

function getDeletedTransactionLogSnapshot(storage = localStorage) {
    const raw = storage.getItem('expenledge_deleted_transaction_log');
    const parsed = parseJsonSafe(raw, []);
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map(item => ({
            syncId: String(item?.syncId || item?.id || '').trim(),
            deletedAt: item?.deletedAt || new Date().toISOString(),
            deletedBy: item?.deletedBy || ''
        }))
        .filter(item => item.syncId);
}

function saveDeletedTransactionLogSnapshot(log = null) {
    const entries = log || getDeletedTransactionLogSnapshot();
    localStorage.setItem('expenledge_deleted_transaction_log', JSON.stringify(entries));
}

function markLocalStateChanged() {
    lastStateChangeAt = new Date().toISOString();
    localStorage.setItem(SUPABASE_LAST_STATE_CHANGE_KEY, lastStateChangeAt);
}

function ensureTransactionMetadata() {
    // Avoid the old O(n) `JSON.stringify(normalized) !== JSON.stringify(transactions)`
    // comparison — for 10k+ transactions that's two full serializations just to
    // detect a change. Instead we normalize in place and check whether any
    // record actually gained a missing `syncId` / `updatedAt` / `createdAt` /
    // `id` field, which is the only thing normalizeTransactionRecord ever adds.
    if (!Array.isArray(transactions) || !transactions.length) return false;
    let changed = false;
    for (let i = 0; i < transactions.length; i += 1) {
        const tx = transactions[i];
        if (!tx || typeof tx !== 'object') continue;
        if (!getTransactionSyncKey(tx) || !tx.updatedAt || !tx.createdAt || tx.id === undefined || tx.id === null || tx.id === '') {
            transactions[i] = normalizeTransactionRecord(tx, i);
            changed = true;
        }
    }
    return changed;
}

function pruneDeletedTransactionsFromCurrentState() {
    const deletedIds = new Set(getDeletedTransactionLogSnapshot().map(item => item.syncId));
    const before = transactions.length;
    transactions = transactions.filter(tx => !deletedIds.has(getTransactionSyncKey(tx)));
    return before !== transactions.length;
}

function mergeDeletionLogs(localLog = [], remoteLog = []) {
    const merged = new Map();
    [...localLog, ...remoteLog].forEach(entry => {
        const syncId = String(entry?.syncId || entry?.id || '').trim();
        if (!syncId) return;
        const deletedAt = entry?.deletedAt || new Date().toISOString();
        const existing = merged.get(syncId);
        const candidateTime = new Date(deletedAt).getTime();
        const existingTime = existing ? new Date(existing.deletedAt).getTime() : -1;
        if (!existing || candidateTime >= existingTime) {
            merged.set(syncId, { syncId, deletedAt, deletedBy: entry?.deletedBy || '' });
        }
    });
    return [...merged.values()];
}

function mergeTransactionLists(localTxs = [], remoteTxs = [], deletedIds = new Set()) {
    const merged = new Map();

    const put = (tx) => {
        const next = normalizeTransactionRecord(tx);
        const syncId = getTransactionSyncKey(next);
        if (!syncId || deletedIds.has(syncId)) return;

        const current = merged.get(syncId);
        if (!current) {
            merged.set(syncId, next);
            return;
        }

        if (getTransactionFreshness(next) >= getTransactionFreshness(current)) {
            merged.set(syncId, { ...current, ...next });
        }
    };

    localTxs.forEach(put);
    remoteTxs.forEach(put);

    return [...merged.values()].sort((a, b) => getTransactionFreshness(b) - getTransactionFreshness(a));
}

function mergeSupabaseStorageSnapshots(localSnapshot = {}, remoteSnapshot = {}) {
    const local = localSnapshot && typeof localSnapshot === 'object' ? { ...localSnapshot } : {};
    const remote = remoteSnapshot && typeof remoteSnapshot === 'object' ? { ...remoteSnapshot } : {};

    // Fast path: nothing came from the remote — just use local as-is.
    // This avoids parsing/normalizing/stringifying the (potentially 10k+)
    // local transactions list when there's nothing to merge.
    if (!Object.keys(remote).length) return local;

    const localTxs = normalizeTransactionsList(parseJsonSafe(local.expenledge_transactions, []));
    const remoteTxs = normalizeTransactionsList(parseJsonSafe(remote.expenledge_transactions, []));
    const localDeleted = parseJsonSafe(local.expenledge_deleted_transaction_log, []);
    const remoteDeleted = parseJsonSafe(remote.expenledge_deleted_transaction_log, []);

    const mergedDeleted = mergeDeletionLogs(Array.isArray(localDeleted) ? localDeleted : [], Array.isArray(remoteDeleted) ? remoteDeleted : []);
    const deletedIds = new Set(mergedDeleted.map(item => item.syncId));
    const mergedTransactions = mergeTransactionLists(localTxs, remoteTxs, deletedIds);

    const merged = { ...local };

    Object.entries(remote).forEach(([key, value]) => {
        if (key === 'expenledge_transactions' || key === 'expenledge_deleted_transaction_log') return;
        if (value !== undefined && value !== null && value !== '') {
            merged[key] = value;
        }
    });

    merged.expenledge_transactions = JSON.stringify(mergedTransactions);
    merged.expenledge_deleted_transaction_log = JSON.stringify(mergedDeleted);

    return merged;
}

function applyStorageSnapshotToLocal(storage, preserveKeys = new Set([SUPABASE_CONFIG_KEY, SUPABASE_DEVICE_KEY])) {
    const current = getSupabaseStorageSnapshot();
    Object.keys(current).forEach(key => {
        if (!preserveKeys.has(key) && !Object.prototype.hasOwnProperty.call(storage, key)) {
            localStorage.removeItem(key);
        }
    });

    Object.entries(storage || {}).forEach(([key, value]) => {
        if (key.startsWith('expenledge_')) {
            localStorage.setItem(key, value ?? '');
        }
    });
}

function buildCloudSnapshotFromStorage(storage) {
    return {
        app: 'ExpenLedge',
        type: 'cloud-sync',
        version: 3,
        exportedAt: new Date().toISOString(),
        storage
    };
}

function buildCloudSnapshot() {
    return buildCloudSnapshotFromStorage(getSupabaseStorageSnapshot());
}

function setSupabaseStatus(message, isConnected = false, isError = false) {
    const statusEl = document.getElementById('supabase-connection-status');
    if (statusEl) {
        statusEl.innerText = message;
        statusEl.className = isError ? 'text-label-md text-error' : 'text-label-md text-on-surface-variant';
    }
    const syncEl = document.getElementById('supabase-sync-time');
    if (syncEl && !syncEl.innerText) syncEl.innerText = 'Last sync: Never';
    updateBackupTimeDisplay();
    const connectBtn = document.getElementById('supabase-connect-btn');
    const syncBtn = document.querySelector('#sheet-supabase-sync button[onclick*="syncSupabaseNow"]');
    const disconnectBtn = document.querySelector('#sheet-supabase-sync button[onclick="disconnectSupabaseConnection()"]');
    const loadBtn = document.querySelector('#sheet-supabase-sync button[onclick="loadSupabaseCredentialsIntoForm()"]');
    const urlInput = document.getElementById('supabase-project-url');
    const keyInput = document.getElementById('supabase-anon-key');

    if (connectBtn) connectBtn.classList.toggle('hidden', isConnected);
    if (syncBtn) syncBtn.classList.toggle('hidden', !isConnected);
    if (disconnectBtn) disconnectBtn.classList.toggle('hidden', !isConnected);
    if (loadBtn) loadBtn.classList.toggle('hidden', isConnected);
    if (urlInput) urlInput.classList.toggle('hidden', isConnected);
    if (keyInput) keyInput.classList.toggle('hidden', isConnected);

    if (connectBtn) connectBtn.disabled = supabaseIntegration.connecting;
    if (syncBtn) syncBtn.disabled = !isConnected || supabaseIntegration.connecting;
    if (disconnectBtn) disconnectBtn.disabled = !isConnected && !supabaseClient;

    // Update dashboard header SVG sync icon.
    // We only flip the icon to "connected / disconnected / error" here —
    // the "syncing" and "success" states are driven by syncSupabaseNow() so
    // they take priority and play their full animation before reverting.
    const staticIcon = document.getElementById('supabase-sync-icon-static');
    const animatedIcon = document.getElementById('supabase-sync-icon-animated');

    // Hide animated icon, show static icon when not syncing
    if (animatedIcon) animatedIcon.style.display = 'none';
    if (staticIcon) {
        staticIcon.style.display = '';
        staticIcon.classList.remove('sync-icon--disconnected', 'sync-icon--connected', 'sync-icon--error');
        if (isConnected && !isError) {
            staticIcon.classList.add('sync-icon--connected');
        } else if (isError) {
            staticIcon.classList.add('sync-icon--error');
        } else {
            staticIcon.classList.add('sync-icon--disconnected');
        }
    }
}
function persistSupabaseCredentials() {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({
        url: supabaseConfig.url,
        anonKey: supabaseConfig.anonKey,
        appId: supabaseConfig.appId,
        deviceId: supabaseConfig.deviceId
    }));
    localStorage.setItem(SUPABASE_DEVICE_KEY, supabaseConfig.deviceId);
}

function loadSupabaseCredentialsIntoForm() {
    const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
    const urlInput = document.getElementById('supabase-project-url');
    const keyInput = document.getElementById('supabase-anon-key');
    if (!saved) {
        if (urlInput) urlInput.value = '';
        if (keyInput) keyInput.value = '';
        return;
    }

    const parsed = JSON.parse(saved);
    if (urlInput) urlInput.value = parsed.url || '';
    if (keyInput) keyInput.value = parsed.anonKey || '';
}

function markSupabaseStateDirty() {
    supabaseIntegration.pendingSync = true;
}

function updateSupabaseSyncTime() {
    const now = new Date().toISOString();
    supabaseIntegration.lastSyncAt = now;
    localStorage.setItem(SUPABASE_LAST_SYNC_KEY, now);
    updateBackupTimeDisplay();
}

function disconnectSupabaseRealtime() {
    if (supabaseRealtimeChannel) {
        try {
            supabaseClient?.removeChannel(supabaseRealtimeChannel);
        } catch (_err) {
            // ignore cleanup errors
        }
    }
    supabaseRealtimeChannel = null;
}

function disconnectSupabaseConnection(clearSavedCredentials = true) {
    disconnectSupabaseRealtime();
    supabaseClient = null;
    supabaseIntegration.connected = false;
    supabaseIntegration.connecting = false;
    supabaseIntegration.pendingSync = false;
    supabaseIntegration.lastError = '';
    supabaseIntegration.lastSyncAt = null;
    supabaseIntegration.lastRemoteAppliedAt = null;
    if (clearSavedCredentials) {
        localStorage.removeItem(SUPABASE_CONFIG_KEY);
        localStorage.removeItem(SUPABASE_LAST_SYNC_KEY);
        // Clear the cached fingerprints so the next connect will do a full
        // pull + push instead of incorrectly short-circuiting.
        localStorage.removeItem(SUPABASE_LAST_PUSH_FINGERPRINT_KEY);
        localStorage.removeItem(SUPABASE_LAST_REMOTE_UPDATED_AT_KEY);
        localStorage.removeItem(SUPABASE_LAST_REMOTE_APPLIED_KEY);
    }
    setSupabaseStatus('Supabase disconnected', false, false);

    // Hide connected status in sheet
    const connectedStatus = document.getElementById('supabase-connected-status');
    const credentialsInputs = document.getElementById('supabase-credentials-inputs');
    if (connectedStatus) connectedStatus.classList.add('hidden');
    if (credentialsInputs) credentialsInputs.classList.remove('hidden');
}

function applySupabasePayloadToApp(payload, options = {}) {
    if (!payload || typeof payload !== 'object') return false;
    const storage = payload.storage && typeof payload.storage === 'object' ? payload.storage : null;
    if (!storage) return false;

    const mergedStorage = mergeSupabaseStorageSnapshots(getSupabaseStorageSnapshot(), storage);
    applyStorageSnapshotToLocal(mergedStorage);

    const savedStateAt = localStorage.getItem(SUPABASE_LAST_STATE_CHANGE_KEY);
    if (savedStateAt) lastStateChangeAt = savedStateAt;
    const savedBackupAt = localStorage.getItem('expenledge_last_backup_at');
    if (savedBackupAt) lastBackupAt = savedBackupAt;

    loadFromLocalStorage();
    refreshAppUiFromState();
    if (options.remoteAt) {
        supabaseIntegration.lastRemoteAppliedAt = options.remoteAt;
        localStorage.setItem(SUPABASE_LAST_REMOTE_APPLIED_KEY, options.remoteAt);
    }
    return true;
}
function refreshAppUiFromState() {
    suppressBrowserAutofill();
    syncCategoryLayoutUI();
    syncManageCategoryLayoutUI();
    toggleBudgetActiveState(budgetEnabled);
    setBudgetPeriod(budgetPeriod);
    setAnalysisPeriod(analysisPeriod);
    setAnalysisCatType(analysisCatType);
    updateSheetMonthLabels();
    updateDashboard();
    updateAnalysis();
    updateAccounts();
    updateBudget();
    applyBackupSheetPreferences();

    const nameDisplay = document.getElementById('profile-name-display');
    const emailDisplay = document.getElementById('profile-email-display');
    if (nameDisplay) nameDisplay.innerText = userProfile.name;
    if (emailDisplay) emailDisplay.innerText = userProfile.email;

    const dbAvatar = document.getElementById('dashboard-user-avatar');
    const stAvatar = document.getElementById('settings-user-avatar');
    if (dbAvatar) dbAvatar.innerHTML = getAvatarHtml(userProfile.name, userProfile.avatar);
    if (stAvatar) stAvatar.innerHTML = getAvatarHtml(userProfile.name, userProfile.avatar);

    const dbName = document.getElementById('dashboard-user-name');
    if (dbName) dbName.innerText = userProfile.name;

    const hr = new Date().getHours();
    let greet = 'Good Morning';
    if (hr >= 12 && hr < 17) greet = 'Good Afternoon';
    else if (hr >= 17) greet = 'Good Evening';
    const greetingLabel = document.getElementById('greeting-label');
    if (greetingLabel) greetingLabel.innerText = greet;

    initAvatars();
}

function subscribeSupabaseRealtime() {
    if (!supabaseClient || !supabaseClient.channel) return;
    disconnectSupabaseRealtime();
    supabaseRealtimeChannel = supabaseClient
        .channel(`expenledge-${supabaseConfig.deviceId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'expenledge_state',
            filter: `app_id=eq.${SUPABASE_APP_ID}`
        }, (payload) => {
            const row = payload?.new || payload?.old;
            if (!row || row.device_id === supabaseConfig.deviceId) return;
            if (supabaseIntegration.pendingSync) return;
            const remoteAt = row.updated_at || row.inserted_at || new Date().toISOString();
            const localAt = lastStateChangeAt ? new Date(lastStateChangeAt).getTime() : 0;
            const remoteTime = new Date(remoteAt).getTime();
            if (Number.isFinite(localAt) && Number.isFinite(remoteTime) && localAt > remoteTime) return;
            if (applySupabasePayloadToApp(row.payload, { remoteAt })) {
                setSupabaseStatus('Supabase connected and synced', true, false);
            }
        })
        .subscribe(status => {
            if (status === 'SUBSCRIBED') {
                setSupabaseStatus('Supabase connected and listening', true, false);
            }
        });
}

async function pullSupabaseSnapshot() {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from('expenledge_state')
        .select('payload, updated_at, device_id')
        .eq('app_id', SUPABASE_APP_ID)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        supabaseIntegration.lastError = error.message || String(error);
        setSupabaseStatus(`Supabase error: ${supabaseIntegration.lastError}`, false, true);
        return null;
    }
    return data || null;
}

/**
 * Lightweight metadata-only fetch of the latest remote row.
 * Returns `{ updated_at, device_id }` or `null`. Used to decide whether a
 * full `pullSupabaseSnapshot` (which can be 5–10 MB for 10k+ transactions)
 * is actually necessary.
 */
async function fetchRemoteSnapshotMetadata() {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from('expenledge_state')
        .select('updated_at, device_id')
        .eq('app_id', SUPABASE_APP_ID)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) return null;
    return data || null;
}

function queueSupabaseSync() {
    if (!shouldQueueSupabaseSync()) return;
    supabaseIntegration.pendingSync = true;
    if (supabaseIntegration.syncInProgress) return;
    if (supabaseSyncTimer) clearTimeout(supabaseSyncTimer);
    supabaseSyncTimer = setTimeout(() => {
        processSupabaseSyncQueue().catch(() => { });
    }, 900);
}

async function processSupabaseSyncQueue() {
    if (!shouldQueueSupabaseSync() || supabaseIntegration.syncInProgress || supabaseIntegration.connecting) return false;
    if (!supabaseIntegration.pendingSync) return false;
    return syncSupabaseNow();
}

async function syncSupabaseNow(options) {
    const manual = !!(options && options.manual);

    if (!supabaseClient) {
        setSupabaseStatus('Supabase is not connected', false, true);
        if (manual) {
            showSyncErrorOverlay('Supabase is not connected. Please connect first.');
        } else {
            showToast('Connect Supabase first');
        }
        return false;
    }

    // Call the internal implementation
    return _syncSupabaseNowInternal(options);
}

// Expose to global scope for inline onclick handlers
window.syncSupabaseNow = syncSupabaseNow;

async function _syncSupabaseNowInternal(options) {
    const manual = !!(options && options.manual);

    if (!supabaseClient) {
        setSupabaseStatus('Supabase is not connected', false, true);
        if (manual) {
            showSyncErrorOverlay('Supabase is not connected. Please connect first.');
        } else {
            showToast('Connect Supabase first');
        }
        return false;
    }

    // If a sync is already in progress:
    //   - For AUTO syncs: just queue and return (original behaviour).
    //   - For MANUAL syncs: show the loading overlay and wait for the
    //     in-progress sync to finish, then surface its result.
    if (supabaseIntegration.syncInProgress) {
        supabaseIntegration.pendingSync = true;
        if (manual) {
            showSyncLoadingOverlay('Waiting for previous sync…');
            try {
                while (supabaseIntegration.syncInProgress) {
                    await new Promise(r => setTimeout(r, 150));
                }
                return syncSupabaseNow({ manual: true });
            } catch (_e) {
                hideSyncResultOverlay();
                return false;
            }
        }
        return false;
    }

    supabaseIntegration.syncInProgress = true;
    supabaseIntegration.pendingSync = true;
    supabaseIntegration.manualActive = manual;

    // Drive the dashboard SVG icon to its spinning state.
    const staticIcon = document.getElementById('supabase-sync-icon-static');
    const animatedIcon = document.getElementById('supabase-sync-icon-animated');

    // Show animated icon, hide static icon during syncing
    if (staticIcon) staticIcon.style.display = 'none';
    if (animatedIcon) {
        animatedIcon.style.display = '';
        animatedIcon.classList.remove('sync-icon--disconnected', 'sync-icon--connected',
            'sync-icon--success', 'sync-icon--error');
        void animatedIcon.offsetWidth;
        animatedIcon.classList.add('sync-icon--syncing');
    }

    if (manual) showSyncLoadingOverlay('Checking for changes…');
    setSupabaseStatus('Syncing to Supabase…', true, false);

    // Helper to update the loading overlay subtitle (no-op when manual=false).
    const updateLoadingMsg = (msg) => { if (manual) showSyncLoadingOverlay(msg); };

    try {
        // ------------------------------------------------------------------
        // STEP 1 — Cheap metadata-only fetch to decide if a full pull is needed.
        // For 10k+ transactions a full pull is 5–10 MB; the metadata fetch is
        // a few hundred bytes. We skip the full pull when the remote
        // `updated_at` is unchanged since our last successful sync AND the
        // pull wouldn't be needed for any other reason.
        // ------------------------------------------------------------------
        let latest = null;
        let remoteStorage = {};
        let needApply = false;

        const lastRemoteApplied = supabaseIntegration.lastRemoteAppliedAt || getLastRemoteUpdatedAt();
        // For a manual "Sync Now" we always pull once so the user sees fresh
        // remote data; for auto-syncs we short-circuit when remote is unchanged.
        if (!manual && lastRemoteApplied) {
            const meta = await fetchRemoteSnapshotMetadata();
            const remoteUpdatedAt = meta?.updated_at || '';
            if (remoteUpdatedAt && remoteUpdatedAt === lastRemoteApplied) {
                // Remote hasn't changed — no need to download the big payload.
                latest = null;
            } else {
                updateLoadingMsg('Pulling latest from cloud…');
                latest = await pullSupabaseSnapshot();
            }
        } else {
            updateLoadingMsg('Pulling latest from cloud…');
            latest = await pullSupabaseSnapshot();
        }

        if (latest) {
            const remoteUpdatedAt = latest.updated_at || '';
            if (remoteUpdatedAt) setLastRemoteUpdatedAt(remoteUpdatedAt);
            remoteStorage = latest?.payload?.storage && typeof latest.payload.storage === 'object'
                ? latest.payload.storage
                : {};
            // Did the remote actually move vs. what we last applied?
            if (!lastRemoteApplied || remoteUpdatedAt !== lastRemoteApplied) {
                needApply = true;
            }
        }

        // ------------------------------------------------------------------
        // STEP 2 — Merge (only when the remote moved) + apply to localStorage.
        // mergeSupabaseStorageSnapshots is expensive for 10k+ transactions
        // (it parses + normalizes + stringifies the whole array), so we skip
        // it entirely when the remote payload is unchanged.
        // ------------------------------------------------------------------
        const localSnapshot = getSupabaseStorageSnapshot();
        let mergedStorage = localSnapshot;
        if (needApply && Object.keys(remoteStorage).length) {
            updateLoadingMsg('Merging changes…');
            // Yield to the browser so the spinner keeps spinning through the
            // (potentially long) merge operation.
            await new Promise(r => setTimeout(r, 0));
            mergedStorage = mergeSupabaseStorageSnapshots(localSnapshot, remoteStorage);
            applyStorageSnapshotToLocal(mergedStorage);
            loadFromLocalStorage();
            // Defer the (heavy, multi-pass over all transactions) UI refresh
            // to the next animation frame so the loading overlay paints first.
            await new Promise(r => requestAnimationFrame(r));
            refreshAppUiFromState();
            if (latest?.updated_at) {
                supabaseIntegration.lastRemoteAppliedAt = latest.updated_at;
                localStorage.setItem(SUPABASE_LAST_REMOTE_APPLIED_KEY, latest.updated_at);
            }
        } else if (manual) {
            // Even on a no-op manual sync, make sure the in-memory state is in
            // sync with localStorage (cheap — no merge, no UI rebuild unless
            // something actually changed).
            loadFromLocalStorage();
        }

        // ------------------------------------------------------------------
        // STEP 3 — Fingerprint short-circuit: skip the (very expensive)
        // upsert of the 10k+ transaction payload when local state hasn't
        // changed since our last successful push.
        // ------------------------------------------------------------------
        const currentFingerprint = computeStorageFingerprint(mergedStorage);
        const lastPushFp = getLastPushFingerprint();

        if (!manual && currentFingerprint === lastPushFp) {
            // Nothing to push and (per step 1) nothing new to pull → done.
            supabaseIntegration.pendingSync = false;
            supabaseIntegration.lastError = '';
            updateSupabaseSyncTime();
            setSupabaseStatus('Supabase synced successfully', true, false);
            triggerSyncBadgeSuccessAnimation();
            if (manual) showSyncSuccessOverlay();
            return true;
        }

        // ------------------------------------------------------------------
        // STEP 4 — Push the merged snapshot up to Supabase.
        // ------------------------------------------------------------------
        updateLoadingMsg('Uploading to cloud…');
        // Yield so the "Uploading…" message paints before the big stringify.
        await new Promise(r => setTimeout(r, 0));

        const payload = buildCloudSnapshotFromStorage(mergedStorage);
        const row = {
            app_id: SUPABASE_APP_ID,
            device_id: supabaseConfig.deviceId,
            payload,
            updated_at: new Date().toISOString()
        };
        const { error } = await supabaseClient
            .from('expenledge_state')
            .upsert(row, { onConflict: 'app_id,device_id' });

        if (error) throw error;

        // Record the fingerprint NOW so subsequent auto-syncs can short-circuit.
        setLastPushFingerprint(currentFingerprint);
        setLastRemoteUpdatedAt(row.updated_at);

        // Version-history write is fire-and-forget: it's a SECOND copy of the
        // 10k-transaction payload and is purely for diagnostics. Don't block
        // the user-visible success state on it.
        writeSupabaseVersionSnapshot(payload, row.updated_at).catch(() => { });

        supabaseIntegration.pendingSync = false;
        supabaseIntegration.lastError = '';
        updateSupabaseSyncTime();
        setSupabaseStatus('Supabase synced successfully', true, false);

        triggerSyncBadgeSuccessAnimation();
        if (manual) showSyncSuccessOverlay();
        return true;
    } catch (error) {
        supabaseIntegration.lastError = error?.message || String(error);
        setSupabaseStatus(`Sync failed: ${supabaseIntegration.lastError}`, true, true);

        const staticIcon = document.getElementById('supabase-sync-icon-static');
        const animatedIcon = document.getElementById('supabase-sync-icon-animated');

        if (animatedIcon) {
            animatedIcon.classList.remove('sync-icon--syncing', 'sync-icon--success');
            void animatedIcon.offsetWidth;
            animatedIcon.classList.add('sync-icon--error');
            setTimeout(() => {
                animatedIcon.classList.remove('sync-icon--error');
                // After error, show static icon with connected/disconnected state
                if (staticIcon) {
                    staticIcon.style.display = '';
                    animatedIcon.style.display = 'none';
                    if (supabaseIntegration.connected) {
                        staticIcon.classList.add('sync-icon--connected');
                    } else {
                        staticIcon.classList.add('sync-icon--disconnected');
                    }
                }
            }, 1200);
        }

        if (manual) {
            showSyncErrorOverlay(supabaseIntegration.lastError || 'Sync failed. Please try again.');
        } else {
            showToast('Supabase sync failed');
        }
        return false;
    } finally {
        supabaseIntegration.syncInProgress = false;
        supabaseIntegration.connecting = false;
        supabaseIntegration.manualActive = false;
        if (supabaseIntegration.pendingSync && shouldQueueSupabaseSync()) {
            if (supabaseSyncTimer) clearTimeout(supabaseSyncTimer);
            supabaseSyncTimer = setTimeout(() => {
                processSupabaseSyncQueue().catch(() => { });
            }, 1200);
        }
    }
}

/* ============================================================
   SYNC BADGE + FULL-SCREEN OVERLAY HELPERS
   ============================================================ */

/**
 * Pulse the dashboard SVG sync icon to confirm a successful sync.
 * Works for both auto-syncs (just the icon pulse) and manual syncs
 * (icon pulse + full-screen success overlay shown elsewhere).
 */
function triggerSyncBadgeSuccessAnimation() {
    const staticIcon = document.getElementById('supabase-sync-icon-static');
    const animatedIcon = document.getElementById('supabase-sync-icon-animated');

    if (!animatedIcon) return;

    animatedIcon.classList.remove('sync-icon--syncing', 'sync-icon--error', 'sync-icon--disconnected');
    void animatedIcon.offsetWidth;
    animatedIcon.classList.add('sync-icon--success');
    setTimeout(() => {
        animatedIcon.classList.remove('sync-icon--success');
        // After success, show static icon with connected state
        if (staticIcon) {
            staticIcon.style.display = '';
            animatedIcon.style.display = 'none';
            if (supabaseIntegration.connected) {
                staticIcon.classList.add('sync-icon--connected');
            } else {
                staticIcon.classList.add('sync-icon--disconnected');
            }
        }
    }, 1200);
}

function _setSyncOverlayState(state) {
    const overlay = document.getElementById('sync-result-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-loading', 'is-success', 'is-error');
    if (state) overlay.classList.add('is-' + state);
}

/** Show the loading spinner overlay (no auto-dismiss).
 *  @param {string} [message] — optional subtitle to display under "Syncing…" */
function showSyncLoadingOverlay(message) {
    const overlay = document.getElementById('sync-result-overlay');
    if (!overlay) return;
    const msgEl = document.getElementById('sync-result-loading-msg');
    if (msgEl && message) msgEl.textContent = message;
    _setSyncOverlayState('loading');
    overlay.classList.add('is-visible');
}

/** Switch the visible overlay to the success state and auto-dismiss after 1.8s. */
let _syncSuccessDismissTimer = null;
function showSyncSuccessOverlay() {
    const overlay = document.getElementById('sync-result-overlay');
    if (!overlay) return;
    _setSyncOverlayState('success');
    overlay.classList.add('is-visible');

    if (_syncSuccessDismissTimer) clearTimeout(_syncSuccessDismissTimer);
    _syncSuccessDismissTimer = setTimeout(() => {
        hideSyncResultOverlay();
        _syncSuccessDismissTimer = null;
    }, 1800);
}

/** Switch the visible overlay to the error state. Stays until dismissed. */
function showSyncErrorOverlay(message) {
    const overlay = document.getElementById('sync-result-overlay');
    if (!overlay) return;
    const msgEl = document.getElementById('sync-result-error-msg');
    if (msgEl && message) {
        // Trim very long error messages so the overlay stays readable.
        const trimmed = String(message).trim();
        msgEl.textContent = trimmed.length > 220 ? trimmed.slice(0, 220) + '…' : trimmed;
    }
    _setSyncOverlayState('error');
    overlay.classList.add('is-visible');

    if (_syncSuccessDismissTimer) {
        clearTimeout(_syncSuccessDismissTimer);
        _syncSuccessDismissTimer = null;
    }
}

/** Fade the overlay out and reset its state. Safe to call anytime. */
function hideSyncResultOverlay() {
    const overlay = document.getElementById('sync-result-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    // Clear the state class after the fade so the next show starts clean.
    setTimeout(() => {
        if (!overlay.classList.contains('is-visible')) {
            overlay.classList.remove('is-loading', 'is-success', 'is-error');
        }
    }, 340);
    if (_syncSuccessDismissTimer) {
        clearTimeout(_syncSuccessDismissTimer);
        _syncSuccessDismissTimer = null;
    }
}
async function connectSupabaseFromSheet() {
    const urlInput = document.getElementById('supabase-project-url');
    const keyInput = document.getElementById('supabase-anon-key');
    // Fall back to saved supabaseConfig when called from auto-init (sheet not open)
    const url = (urlInput?.value?.trim() || supabaseConfig.url || '');
    const anonKey = (keyInput?.value?.trim() || supabaseConfig.anonKey || '');

    // Check if this is a manual connect - only true when user clicks the Connect button
    // The sheet is open when user is viewing it, so we check if the sheet is visible
    const sheet = document.getElementById('sheet-supabase-sync');
    const isManual = sheet && !sheet.classList.contains('translate-y-full') &&
        (urlInput && !urlInput.closest('.hidden'));

    if (!url || !anonKey) {
        if (isManual) showToast('Please enter Project URL and Anon Key');
        return;
    }
    if (!window.supabase?.createClient) {
        showToast('Supabase client script is missing');
        return;
    }

    // Show loading overlay only for manual connect (user clicked Connect button)
    if (isManual) {
        showSyncLoadingOverlay('Connecting to Supabase…');
    }

    supabaseConfig.url = url;
    supabaseConfig.anonKey = anonKey;
    persistSupabaseCredentials();

    try {
        supabaseIntegration.connecting = true;
        supabaseClient = window.supabase.createClient(url, anonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });

        setSupabaseStatus('Connecting…', false, false);
        const latest = await pullSupabaseSnapshot();
        const localStorageSnapshot = getSupabaseStorageSnapshot();
        const remoteStorage = latest?.payload?.storage && typeof latest.payload.storage === 'object' ? latest.payload.storage : {};
        const mergedStorage = mergeSupabaseStorageSnapshots(localStorageSnapshot, remoteStorage);

        supabaseIntegration.applyingRemote = true;
        applyStorageSnapshotToLocal(mergedStorage);
        loadFromLocalStorage();
        refreshAppUiFromState();
        supabaseIntegration.applyingRemote = false;

        subscribeSupabaseRealtime();
        supabaseIntegration.connected = true;
        supabaseIntegration.pendingSync = true;
        supabaseIntegration.lastError = '';
        setSupabaseStatus('Connected', true, false);

        // Update UI to show connected status in sheet
        const connectedStatus = document.getElementById('supabase-connected-status');
        const credentialsInputs = document.getElementById('supabase-credentials-inputs');
        if (connectedStatus) connectedStatus.classList.remove('hidden');
        if (credentialsInputs) credentialsInputs.classList.add('hidden');

        await syncSupabaseNow();

        // Show success overlay only for manual connect
        if (isManual) {
            showSyncSuccessOverlay();
        }
    } catch (error) {
        supabaseIntegration.connected = false;
        supabaseIntegration.lastError = error?.message || String(error);
        setSupabaseStatus(`Connection failed: ${supabaseIntegration.lastError}`, false, true);
        if (isManual) {
            showSyncErrorOverlay(supabaseIntegration.lastError || 'Connection failed. Please check your credentials.');
        } else {
            // Silent fail for auto-connect - only show toast
            showToast('Supabase connect failed');
        }
    } finally {
        supabaseIntegration.connecting = false;
        supabaseIntegration.applyingRemote = false;
    }
}
function initializeSupabaseFromSavedCredentials() {
    const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (!saved || !window.supabase?.createClient) {
        setSupabaseStatus('Supabase not connected', false, false);
        updateBackupTimeDisplay();
        return;
    }

    const parsed = JSON.parse(saved);
    if (!parsed?.url || !parsed?.anonKey) {
        setSupabaseStatus('Supabase not connected', false, false);
        return;
    }

    supabaseConfig = {
        ...supabaseConfig,
        ...parsed,
        appId: SUPABASE_APP_ID,
        deviceId: parsed.deviceId || supabaseConfig.deviceId
    };
    persistSupabaseCredentials();
    connectSupabaseFromSheet().catch(err => console.error('Supabase init failed:', err));
}

// Initial setup
window.addEventListener('DOMContentLoaded', () => {
    // Setup color theming for both sync icons (static and animated)
    const staticSyncIconEl = document.getElementById('supabase-sync-icon-static');
    const animatedSyncIconEl = document.getElementById('supabase-sync-icon-animated');

    const updateSyncIconColor = (iconEl) => {
        if (!iconEl) return;
        // Force green color for connected state regardless of theme
        if (iconEl.classList.contains('sync-icon--connected')) {
            iconEl.style.color = '#22c55e'; // Green-500
        } else if (iconEl.classList.contains('sync-icon--syncing')) {
            iconEl.style.color = 'var(--primary)';
        } else if (iconEl.classList.contains('sync-icon--success')) {
            iconEl.style.color = 'var(--tertiary)';
        } else if (iconEl.classList.contains('sync-icon--error')) {
            iconEl.style.color = 'var(--error)';
        } else {
            iconEl.style.color = 'var(--on-surface-variant)';
        }
    };

    // Observe class changes to update color for static icon
    if (staticSyncIconEl) {
        const staticObserver = new MutationObserver(() => updateSyncIconColor(staticSyncIconEl));
        staticObserver.observe(staticSyncIconEl, { attributes: true, attributeFilter: ['class'] });
        updateSyncIconColor(staticSyncIconEl); // Initial call
    }

    // Observe class changes to update color for animated icon
    if (animatedSyncIconEl) {
        const animatedObserver = new MutationObserver(() => updateSyncIconColor(animatedSyncIconEl));
        animatedObserver.observe(animatedSyncIconEl, { attributes: true, attributeFilter: ['class'] });
        updateSyncIconColor(animatedSyncIconEl); // Initial call
    }
    // Capitalize first letter of every text input
    document.addEventListener('input', function (e) {
        const target = e.target;
        if (target.tagName === 'INPUT' && target.type === 'text') {
            const val = target.value;
            if (val.length > 0) {
                const capitalized = val.charAt(0).toUpperCase() + val.slice(1);
                if (target.value !== capitalized) {
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    target.value = capitalized;
                    target.setSelectionRange(start, end);
                }
            }
        }
    });

    history.replaceState({ viewId: 'home' }, '', '');
    loadFromLocalStorage();
    suppressBrowserAutofill();
    syncCategoryLayoutUI();
    syncManageCategoryLayoutUI();

    const autofillObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node && node.nodeType === 1) {
                    suppressBrowserAutofill(node);
                }
            });
        }
    });
    autofillObserver.observe(document.body, { childList: true, subtree: true });

    // Set initial budget visibility and states
    toggleBudgetActiveState(budgetEnabled);
    setBudgetPeriod(budgetPeriod);
    setAnalysisPeriod(analysisPeriod);
    setAnalysisCatType(analysisCatType);

    // Check onboarding
    const onboarded = localStorage.getItem('expenledge_onboarded');
    if (!onboarded || !userProfile.name || !userProfile.email) {
        document.getElementById('onboarding-screen').classList.remove('hidden');
    } else {
        document.getElementById('onboarding-screen').classList.add('hidden');
    }

    updateSheetMonthLabels();
    updateDashboard();
    updateAnalysis();
    updateAccounts();
    updateBudget();
    applyBackupSheetPreferences();

    // Sync profile display in settings header
    const nameDisplay = document.getElementById('profile-name-display');
    const emailDisplay = document.getElementById('profile-email-display');
    if (nameDisplay) nameDisplay.innerText = userProfile.name;
    if (emailDisplay) emailDisplay.innerText = userProfile.email;

    const dbAvatar = document.getElementById('dashboard-user-avatar');
    const stAvatar = document.getElementById('settings-user-avatar');
    if (dbAvatar) {
        dbAvatar.innerHTML = getAvatarHtml(userProfile.name, userProfile.avatar);
    }
    if (stAvatar) {
        stAvatar.innerHTML = getAvatarHtml(userProfile.name, userProfile.avatar);
    }

    // Populate the onboarding and settings avatar selector grids
    initAvatars();

    // Sync dashboard name
    const dbName = document.getElementById('dashboard-user-name');
    if (dbName) dbName.innerText = userProfile.name;

    // Set dynamic greeting based on hour
    const hr = new Date().getHours();
    let greet = "Good Morning";
    if (hr >= 12 && hr < 17) greet = "Good Afternoon";
    else if (hr >= 17) greet = "Good Evening";
    document.getElementById('greeting-label').innerText = greet;

    // Start background scheduler checks
    setInterval(checkScheduledTransactions, 5000);

    // Sync Cash in Balance toggle on the Accounts page
    const accCashToggle = document.getElementById('acc-include-cash-toggle');
    if (accCashToggle) accCashToggle.checked = includeCashInBalance;

    // Block Google Payments overlay: add autocomplete=off to all number/text inputs
    document.querySelectorAll('input[type="number"], input[type="text"], input[type="email"]').forEach(el => {
        if (!el.hasAttribute('autocomplete')) el.setAttribute('autocomplete', 'off');
        el.setAttribute('data-lpignore', 'true');
    });

    // focusin listener removed - readonly is now removed on pointerdown/keydown instead
    // This prevents Google Payment Manager from appearing above the keyboard

    supabaseIntegration.booting = false;
    supabaseInitialLoadDone = true;
    initializeSupabaseFromSavedCredentials();
});


function initAvatars() {
    const colors = [
        'bg-red-500', 'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
        'bg-sky-500', 'bg-cyan-500', 'bg-teal-500', 'bg-green-500', 'bg-orange-500'
    ];
    const onboardGrid = document.getElementById('onboard-avatar-grid');
    if (onboardGrid) {
        onboardGrid.innerHTML = '';
        colors.forEach((col, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isDefault = index === 0;
            btn.className = `w-12 h-12 rounded-full overflow-hidden flex items-center justify-center p-1 bg-surface hover:bg-surface-container transition-all border ${isDefault ? 'border-2 border-primary scale-110' : 'border-transparent scale-90'}`;
            btn.onclick = () => selectOnboardAvatar(col, btn);
            btn.innerHTML = `<div class="w-full h-full rounded-full ${col} text-white flex items-center justify-center font-bold text-sm uppercase">U</div>`;
            onboardGrid.appendChild(btn);
        });
        const nameInput = document.getElementById('onboard-name');
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const val = nameInput.value.trim().charAt(0).toUpperCase() || 'U';
                const circles = document.querySelectorAll('#onboard-avatar-grid button div');
                circles.forEach(c => c.innerText = val);
            });
        }
    }
    const profileGrid = document.getElementById('profile-avatar-grid');
    if (profileGrid) {
        profileGrid.innerHTML = '';
        colors.forEach((col, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `w-12 h-12 rounded-full overflow-hidden flex items-center justify-center p-1 bg-surface hover:bg-surface-container transition-all border border-transparent scale-90`;
            btn.onclick = () => selectProfileAvatar(col, btn);
            const initial = userProfile.name ? userProfile.name.trim().charAt(0).toUpperCase() : 'U';
            btn.innerHTML = `<div class="w-full h-full rounded-full ${col} text-white flex items-center justify-center font-bold text-sm uppercase">${initial}</div>`;
            profileGrid.appendChild(btn);
        });
        const profNameInput = document.getElementById('profile-input-name');
        if (profNameInput) {
            profNameInput.addEventListener('input', () => {
                const val = profNameInput.value.trim().charAt(0).toUpperCase() || 'U';
                const circles = document.querySelectorAll('#profile-avatar-grid button div');
                circles.forEach(c => c.innerText = val);
            });
        }
    }
}

function selectOnboardAvatar(col, btn) {
    document.getElementById('onboard-selected-avatar').value = col;
    const buttons = document.querySelectorAll('#onboard-avatar-grid button');
    buttons.forEach(b => {
        b.className = "w-12 h-12 rounded-full overflow-hidden flex items-center justify-center p-1 bg-surface hover:bg-surface-container transition-all border border-transparent scale-90";
    });
    btn.className = "w-12 h-12 rounded-full overflow-hidden flex items-center justify-center p-1 bg-surface hover:bg-surface-container transition-all border-2 border-primary scale-110";
}

function submitOnboarding(event) {
    event.preventDefault();
    const name = document.getElementById('onboard-name').value.trim();
    const email = document.getElementById('onboard-email').value.trim();
    const avatar = document.getElementById('onboard-selected-avatar').value;
    if (!name || !email) {
        showToast("Please enter a valid name and email address");
        return;
    }
    userProfile.name = name;
    userProfile.email = email;
    userProfile.avatar = avatar;
    localStorage.setItem('expenledge_profile', JSON.stringify(userProfile));
    localStorage.setItem('expenledge_onboarded', 'true');

    // Hide onboarding screen
    document.getElementById('onboarding-screen').classList.add('hidden');

    // Update labels and avatars
    const nameDisplay = document.getElementById('profile-name-display');
    const emailDisplay = document.getElementById('profile-email-display');
    if (nameDisplay) nameDisplay.innerText = userProfile.name;
    if (emailDisplay) emailDisplay.innerText = userProfile.email;

    const dbAvatar = document.getElementById('dashboard-user-avatar');
    const stAvatar = document.getElementById('settings-user-avatar');
    if (dbAvatar) {
        dbAvatar.innerHTML = getAvatarHtml(userProfile.name, userProfile.avatar);
    }
    if (stAvatar) {
        stAvatar.innerHTML = getAvatarHtml(userProfile.name, userProfile.avatar);
    }

    const dbName = document.getElementById('dashboard-user-name');
    if (dbName) dbName.innerText = userProfile.name;

    updateDashboard();
    showToast(`Welcome to ExpenLedge, ${name}!`);
}

// View router
function switchView(viewId, isBackNavigation = false) {
    document.querySelectorAll('.page-view').forEach(view => {
        view.classList.remove('active');
    });
    const activeView = document.getElementById(`view-${viewId}`);
    if (activeView) {
        activeView.classList.add('active');
    }
    currentView = viewId;
    if (viewId !== 'home') closeDashboardSearch(false);

    // Show/hide footer navigation bar and global FAB
    const footerNav = document.querySelector('nav');
    if (footerNav) {
        const mainViews = ['home', 'analysis', 'accounts', 'more'];
        if (mainViews.includes(viewId)) {
            footerNav.classList.remove('hidden');
        } else {
            footerNav.classList.add('hidden');
        }
    }

    const globalFab = document.getElementById('global-structured-fab');
    if (globalFab) {
        if (viewId === 'structured-tx') {
            globalFab.classList.remove('hidden');
        } else {
            globalFab.classList.add('hidden');
        }
    }

    // Scroll to top on view changes
    try {
        window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (e) {
        window.scrollTo(0, 0);
    }

    // Update tab button styles
    const navButtons = {
        home: document.getElementById('nav-btn-home'),
        analysis: document.getElementById('nav-btn-analysis'),
        accounts: document.getElementById('nav-btn-accounts'),
        more: document.getElementById('nav-btn-more')
    };

    for (const key in navButtons) {
        if (navButtons[key]) {
            if (key === viewId) {
                navButtons[key].classList.add('text-primary', 'font-bold');
                navButtons[key].classList.remove('text-on-surface-variant', 'opacity-70');
                const icon = navButtons[key].querySelector('.material-symbols-outlined');
                if (icon) icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                navButtons[key].classList.remove('text-primary', 'font-bold');
                navButtons[key].classList.add('text-on-surface-variant', 'opacity-70');
                const icon = navButtons[key].querySelector('.material-symbols-outlined');
                if (icon) icon.style.fontVariationSettings = "'FILL' 0";
            }
        }
    }

    // Sync specific view content
    if (viewId === 'home') updateDashboard();
    if (viewId === 'analysis') updateAnalysis();
    if (viewId === 'accounts') updateAccounts();
    if (viewId === 'budget') updateBudget();
    if (viewId === 'transactions-all') updateAllTransactionsView();
    if (viewId === 'structured-tx') renderStructuredTx();

    if (!isBackNavigation) {
        history.pushState({ viewId: viewId }, '', '');
    }
}

let structuredTxMode = 'day';
let structuredSelectedDate = new Date();
let structuredTypeFilter = null; // 'expense', 'income', or null

function toggleStructuredFilter(type) {
    if (structuredTypeFilter === type) {
        structuredTypeFilter = null; // Toggle off
    } else {
        structuredTypeFilter = type; // Toggle on
    }
    updateStructuredFilterUI();
    renderStructuredTx();
}

function updateStructuredFilterUI() {
    const spentCard = document.getElementById('structured-spent-card');
    const incomeCard = document.getElementById('structured-income-card');
    if (!spentCard || !incomeCard) return;

    if (structuredTypeFilter === 'expense') {
        spentCard.classList.remove('opacity-50');
        spentCard.classList.add('border-secondary', 'border-2');

        incomeCard.classList.add('opacity-50');
        incomeCard.classList.remove('border-primary', 'border-2');
    } else if (structuredTypeFilter === 'income') {
        incomeCard.classList.remove('opacity-50');
        incomeCard.classList.add('border-primary', 'border-2');

        spentCard.classList.add('opacity-50');
        spentCard.classList.remove('border-secondary', 'border-2');
    } else {
        spentCard.classList.remove('opacity-50', 'border-secondary', 'border-2');
        incomeCard.classList.remove('opacity-50', 'border-primary', 'border-2');
    }
}

function openStructuredTxView(mode) {
    structuredTxMode = mode;
    structuredSelectedDate = new Date(); // Reset to today on entry

    structuredTypeFilter = null;
    updateStructuredFilterUI();
    const searchInput = document.getElementById('structured-search-input');
    if (searchInput) searchInput.value = '';

    const titleEl = document.getElementById('structured-tx-title');
    const subtitleEl = document.getElementById('structured-tx-subtitle');

    if (mode === 'day') {
        if (titleEl) titleEl.innerText = "Day-wise";
        if (subtitleEl) subtitleEl.innerText = "All transactions grouped by date";
    } else if (mode === 'month') {
        if (titleEl) titleEl.innerText = "Month-wise";
        if (subtitleEl) subtitleEl.innerText = "All transactions grouped by month";
    } else if (mode === 'custom') {
        if (titleEl) titleEl.innerText = "Custom Range";
        if (subtitleEl) subtitleEl.innerText = "Transactions in a specific range";

        // Seed default custom dates (start of month to today) if empty
        const fromEl = document.getElementById('structured-date-from');
        const toEl = document.getElementById('structured-date-to');
        if (fromEl && !fromEl.value) {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            fromEl.value = first.toISOString().slice(0, 10);
            toEl.value = now.toISOString().slice(0, 10);
        }
    }

    switchView('structured-tx');
}

function backToHomeFromStructuredTx() {
    switchView('home');
}

function structuredTxNavPrev() {
    if (structuredTxMode === 'day') {
        structuredSelectedDate.setDate(structuredSelectedDate.getDate() - 1);
    } else if (structuredTxMode === 'month') {
        structuredSelectedDate.setMonth(structuredSelectedDate.getMonth() - 1);
    }
    renderStructuredTx();
}

function structuredTxNavNext() {
    if (structuredTxMode === 'day') {
        structuredSelectedDate.setDate(structuredSelectedDate.getDate() + 1);
    } else if (structuredTxMode === 'month') {
        structuredSelectedDate.setMonth(structuredSelectedDate.getMonth() + 1);
    }
    renderStructuredTx();
}

let allTxRenderLimit = 50;
let structuredTxRenderLimit = 50;
let accountDetailsTxRenderLimit = 50;
let incomeTxRenderLimit = 50;
let spendingTxRenderLimit = 50;

function getTransactionRenderBatchSize() {
    const deviceMemory = navigator.deviceMemory || 8;
    const cpuCores = navigator.hardwareConcurrency || 8;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isMobile || deviceMemory <= 4 || cpuCores <= 4 ? 20 : 50;
}

function renderStructuredTx(loadMore = false) {
    const wasStructured = (currentView === 'structured-tx');
    const scrollPos = wasStructured ? window.scrollY : 0;

    if (!loadMore) {
        structuredTxRenderLimit = 50;
    }
    const listContainer = document.getElementById('structured-tx-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const navContainer = document.getElementById('structured-period-nav');
    const labelEl = document.getElementById('structured-period-label');
    const sublabelEl = document.getElementById('structured-period-sublabel');

    if (structuredTxMode === 'custom') {
        if (navContainer) navContainer.classList.add('hidden');
    } else {
        if (navContainer) navContainer.classList.remove('hidden');
        if (structuredTxMode === 'day') {
            const todayStr = getRelativeDateString(new Date());
            const selectedStr = getRelativeDateString(structuredSelectedDate);

            if (labelEl) {
                labelEl.innerText = selectedStr;
            }
            if (sublabelEl) {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                sublabelEl.innerText = days[structuredSelectedDate.getDay()];
            }
        } else if (structuredTxMode === 'month') {
            if (labelEl) {
                labelEl.innerText = `${monthNames[structuredSelectedDate.getMonth()]} ${structuredSelectedDate.getFullYear()}`;
            }
            if (sublabelEl) {
                sublabelEl.innerText = 'Monthly Summary';
            }
        }
    }

    const customContainer = document.getElementById('structured-custom-date-container');
    if (customContainer) {
        if (structuredTxMode === 'custom') {
            customContainer.classList.remove('hidden');
        } else {
            customContainer.classList.add('hidden');
        }
    }

    let filtered = [];
    if (structuredTxMode === 'day') {
        filtered = transactions.filter(t => {
            const txDate = getTransactionDate(t);
            return txDate.getDate() === structuredSelectedDate.getDate() &&
                txDate.getMonth() === structuredSelectedDate.getMonth() &&
                txDate.getFullYear() === structuredSelectedDate.getFullYear();
        });
    } else if (structuredTxMode === 'month') {
        filtered = transactions.filter(t => {
            const txDate = getTransactionDate(t);
            return txDate.getMonth() === structuredSelectedDate.getMonth() &&
                txDate.getFullYear() === structuredSelectedDate.getFullYear();
        });
    } else if (structuredTxMode === 'custom') {
        const fromEl = document.getElementById('structured-date-from');
        const toEl = document.getElementById('structured-date-to');
        const fromVal = fromEl ? fromEl.value : '';
        const toVal = toEl ? toEl.value : '';
        if (fromVal && toVal) {
            const fromDate = new Date(fromVal); fromDate.setHours(0, 0, 0, 0);
            const toDate = new Date(toVal); toDate.setHours(23, 59, 59, 999);
            filtered = transactions.filter(t => {
                const txDate = getTransactionDate(t);
                const checkDate = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
                return checkDate >= fromDate && checkDate <= toDate;
            });
        }
    }

    // Update compact totals cards (always, including zero state, based on date filter only)
    const totalSpendingEl = document.getElementById('structured-total-spending');
    const totalIncomeEl = document.getElementById('structured-total-income');
    const totalBalanceEl = document.getElementById('structured-total-balance');
    const txCountEl = document.getElementById('structured-tx-count');
    {
        let sumSpend = 0, sumInc = 0;
        filtered.forEach(t => {
            if (t.type === 'income') sumInc += t.amount;
            else sumSpend += t.amount;
        });
        const bal = sumInc - sumSpend;
        if (totalSpendingEl) totalSpendingEl.innerText = `₹${sumSpend.toFixed(2)}`;
        if (totalIncomeEl) totalIncomeEl.innerText = `₹${sumInc.toFixed(2)}`;
        if (totalBalanceEl) {
            const prefix = bal >= 0 ? '+' : '-';
            totalBalanceEl.innerText = `${prefix}₹${Math.abs(bal).toFixed(2)}`;
            const balCard = document.getElementById('structured-balance-card');
            if (balCard) {
                balCard.className = `px-4 py-1.5 rounded-full ${bal >= 0 ? 'bg-primary/15 text-primary' : 'bg-secondary/15 text-secondary'}`;
            }
        }
    }

    const periodTransactions = filtered;

    // Apply mini search bar filter
    const queryVal = document.getElementById('structured-search-input') ? document.getElementById('structured-search-input').value : '';
    if (queryVal) {
        filtered = filtered.filter(t => matchTransaction(t, queryVal));
    }

    // Apply tab spent/income filters
    if (structuredTypeFilter) {
        filtered = filtered.filter(t => t.type === (structuredTypeFilter === 'expense' ? 'expense' : 'income'));
    }

    if (txCountEl) {
        txCountEl.innerText = `${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-on-surface-variant py-lg">No transactions found</p>`;
        // Restore scroll even for zero state if user had scrolled
        if (wasStructured && scrollPos > 0) {
            window.scrollTo(0, scrollPos);
        }
        return;
    }

    const totalMatching = filtered.length;
    const itemsToRender = filtered.slice(0, structuredTxRenderLimit);

    const getStructuredGroupName = (transaction) => {
        if (structuredTxMode === 'month') {
            const txDate = getTransactionDate(transaction);
            return `${monthNames[txDate.getMonth()]} ${txDate.getFullYear()}`;
        }
        return transaction.date;
    };

    // Keep group totals accurate even when the card initially renders only one batch.
    // Like the header totals, these stay based on the selected date period, not search text.
    const groupTotals = {};
    periodTransactions.forEach(transaction => {
        const groupName = getStructuredGroupName(transaction);
        if (!groupTotals[groupName]) groupTotals[groupName] = { income: 0, spending: 0 };
        if (transaction.type === 'income') groupTotals[groupName].income += transaction.amount;
        else groupTotals[groupName].spending += transaction.amount;
    });

    // Now group the currently visible transaction items.
    const groups = {};
    itemsToRender.forEach(transaction => {
        const groupName = getStructuredGroupName(transaction);
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(transaction);
    });

    for (const groupName in groups) {
        const groupCard = document.createElement('div');
        groupCard.className = "bg-surface-container p-md rounded-xl border border-outline-variant/10 space-y-md shadow-sm";

        const safeId = groupName.replace(/[^a-zA-Z0-9]/g, '-');

        const totals = groupTotals[groupName] || { income: 0, spending: 0 };
        const balance = totals.income - totals.spending;
        const balanceClass = balance >= 0 ? 'bg-primary/15 text-primary' : 'bg-secondary/15 text-secondary';

        groupCard.innerHTML = `
            <div class="border-b border-outline-variant/10 pb-sm space-y-sm">
                <span class="text-label-md font-bold text-primary uppercase tracking-wider">${groupName}</span>
                <div class="flex flex-wrap gap-xs text-[11px] font-semibold">
                    <span class="bg-secondary/10 text-secondary px-3 py-1 rounded-full">Out: ₹${totals.spending.toFixed(2)}</span>
                    <span class="bg-primary/10 text-primary px-3 py-1 rounded-full">In: ₹${totals.income.toFixed(2)}</span>
                    <span class="${balanceClass} px-3 py-1 rounded-full">Bal: ${balance >= 0 ? '+' : '-'}₹${Math.abs(balance).toFixed(2)}</span>
                </div>
            </div>
            <div class="space-y-sm" id="structured-group-list-${safeId}">
            </div>
        `;

        listContainer.appendChild(groupCard);

        const subContainer = groupCard.querySelector(`#structured-group-list-${safeId}`);
        groups[groupName].forEach(t => {
            const isInc = t.type === 'income';
            const itemEl = document.createElement('div');
            itemEl.className = "p-sm rounded-lg flex items-center gap-md hover:bg-surface-container-high transition-all cursor-pointer active:scale-[0.98]";
            bindLongPress(itemEl, t);

            let colorClass = "text-secondary bg-secondary-container/20";
            if (isInc) colorClass = "text-primary bg-primary-container/20";

            itemEl.innerHTML = `
                <div class="w-10 h-10 rounded-full flex items-center justify-center ${colorClass} flex-shrink-0">
                    <span class="material-symbols-outlined text-[20px]">${t.categoryIcon || 'payments'}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center gap-sm">
                        <p class="text-body-md font-semibold text-on-surface break-words whitespace-normal">${t.note || t.category}</p>
                        <p class="text-body-md font-bold flex-shrink-0 ${isInc ? 'text-primary' : 'text-secondary'}">${isInc ? '+' : '-'}₹${t.amount.toFixed(2)}</p>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <p class="text-label-md text-on-surface-variant">${t.date}</p>
                        <span class="flex-shrink-0">${getTxAccountBadge(t)}</span>
                    </div>
                </div>
            `;
            // Add click to edit
            itemEl.onclick = (e) => {
                if (longPressTriggered) return;
                openEditTransactionModal(t);
            };
            subContainer.appendChild(itemEl);
        });
    }

    if (totalMatching > structuredTxRenderLimit) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = "w-full py-md bg-surface-container hover:bg-surface-container-high text-primary font-bold rounded-xl shadow-sm border border-outline-variant/10 transition-colors my-md active:scale-[0.98]";
        loadMoreBtn.innerText = `Load More (${totalMatching - structuredTxRenderLimit} remaining)`;
        loadMoreBtn.onclick = () => {
            structuredTxRenderLimit += 50;
            renderStructuredTx(true);
        };
        listContainer.appendChild(loadMoreBtn);
    }

    // Restore scroll position
    if (wasStructured && scrollPos > 0) {
        window.scrollTo(0, scrollPos);
        setTimeout(() => {
            window.scrollTo(0, scrollPos);
        }, 0);
    }
}


// Dashboard renderer
function updateDashboard() {
    let totalIncome = 0;
    let totalExpense = 0;
    let dashboardSpent = 0;

    transactions.forEach(t => {
        if (transactionBelongsToFilter(t)) {
            if (t.type === 'income') {
                totalIncome += t.amount;
            } else {
                totalExpense += t.amount;
            }
        }
    });

    const balance = totalIncome - totalExpense;

    // Calculate carry forward balance
    let totalAssets = 0;
    let totalLiabilities = 0;
    userAccounts.forEach(acc => {
        if (acc.type !== 'cash') return;
        let bal = acc.startingBalance;
        transactions.forEach(t => {
            if (t.paymentMode === acc.name) {
                if (acc.type === 'card') {
                    if (t.type === 'expense') bal += t.amount;
                    else bal -= t.amount;
                } else {
                    if (t.type === 'expense') bal -= t.amount;
                    else bal += t.amount;
                }
            } else if (!userAccounts.some(a => a.name === t.paymentMode)) {
                // Legacy fallback mapping
                if (acc.type === 'card' && (t.paymentMode === 'Credit Card' || t.paymentMode === 'card')) {
                    if (t.type === 'expense') bal += t.amount;
                    else bal -= t.amount;
                } else if (acc.type === 'cash' && (t.paymentMode === 'Cash' || t.paymentMode === 'cash')) {
                    if (t.type === 'expense') bal -= t.amount;
                    else bal += t.amount;
                } else if (acc.type === 'bank' && acc.id === 'bank') {
                    if (t.paymentMode !== 'Cash' && t.paymentMode !== 'cash' && t.paymentMode !== 'Credit Card' && t.paymentMode !== 'card') {
                        if (t.type === 'expense') bal -= t.amount;
                        else bal += t.amount;
                    }
                }
            }
        });
        if (acc.type === 'card') {
            totalLiabilities += bal;
        } else {
            totalAssets += bal;
        }
    });
    const carryForward = totalAssets - totalLiabilities;

    // Calculate all time net balance
    let allTimeIncome = 0;
    let allTimeExpense = 0;
    transactions.forEach(t => {
        if (t.type === 'income') allTimeIncome += t.amount;
        else allTimeExpense += t.amount;
    });
    const allTimeNet = allTimeIncome - allTimeExpense;

    // Select the balance to show
    let displayBalance = balance;
    if (typeof activeDashboardBalanceType !== 'undefined') {
        if (activeDashboardBalanceType === 'carry') displayBalance = carryForward;
        else if (activeDashboardBalanceType === 'alltime') displayBalance = allTimeNet;
    }

    const spendingEl = document.getElementById('stat-spending');
    const incomeEl = document.getElementById('stat-income');
    if (spendingEl) { spendingEl.innerText = formatAmount(totalExpense); fitText(spendingEl); }
    if (incomeEl) { incomeEl.innerText = formatAmount(totalIncome); fitText(incomeEl); }

    const balanceEl = document.getElementById('stat-balance');
    if (balanceEl) {
        const sign = displayBalance >= 0 ? '' : '-';
        balanceEl.innerText = `${sign}${formatAmount(Math.abs(displayBalance))}`;
        fitText(balanceEl);
    }

    renderRecentTransactions(transactions.filter(transactionBelongsToFilter));

    // Calculate yearly expenses
    let yearlyExpense = 0;
    transactions.forEach(t => {
        if (t.type === 'expense') {
            const txDate = getTransactionDate(t);
            if (txDate.getFullYear() === currentYear) {
                yearlyExpense += t.amount;
            }
        }
    });

    // Budget widget remaining
    let limit = monthlyBudgetLimit;
    let spent = totalExpense;
    if (typeof budgetPeriod !== 'undefined' && budgetPeriod === 'yearly') {
        limit = monthlyBudgetLimit * 12;
        spent = yearlyExpense;
    }
    const remaining = limit - spent;

    // Update Dashboard Elements
    const remainingEl = document.getElementById('budget-widget-remaining');
    if (remainingEl) {
        remainingEl.innerText = `Remaining: ₹${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    const cardProgress = document.getElementById('budget-card-progress');
    if (cardProgress) {
        const pct = Math.min((spent / limit) * 100, 100);
        cardProgress.style.width = `${pct}%`;
    }

    // Update Analysis Elements
    const aremainingEl = document.getElementById('analysis-budget-widget-remaining');
    if (aremainingEl) {
        aremainingEl.innerText = `Remaining: ₹${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    const acardProgress = document.getElementById('analysis-budget-card-progress');
    if (acardProgress) {
        const pct = Math.min((spent / limit) * 100, 100);
        acardProgress.style.width = `${pct}%`;
    }
}

function transactionBelongsToFilter(t) {
    const txDate = getTransactionDate(t);
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth();

    if (dashboardFilter === 'month') {
        return txMonth === currentMonth && txYear === currentYear;
    } else if (dashboardFilter === 'year') {
        return txYear === currentYear;
    } else { // 'all'
        return true;
    }
}

function toggleDashboardFilterDropdown() {
    const dropdown = document.getElementById('dashboard-filter-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function setDashboardFilter(filter) {
    dashboardFilter = filter;
    const label = document.getElementById('dashboard-filter-label');
    if (label) {
        if (filter === 'month') label.innerText = "This month";
        else if (filter === 'year') label.innerText = "This year";
        else label.innerText = "All time";
    }
    toggleDashboardFilterDropdown();
    saveToLocalStorage();
    syncAllViews();
}

function renderRecentTransactions(list) {
    const container = document.getElementById('recent-transactions-list');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `<p class="text-center text-on-surface-variant py-md">No transactions found</p>`;
        return;
    }

    list.slice(0, 4).forEach(t => {
        const isInc = t.type === 'income';
        const card = document.createElement('div');
        card.className = "bg-surface-container p-md rounded-xl flex items-center gap-md hover:bg-surface-container-high transition-all cursor-pointer active:scale-[0.98]";
        bindLongPress(card, t);

        // Color accent based on type
        let colorClass = "text-secondary bg-secondary-container/20";
        if (isInc) colorClass = "text-primary bg-primary-container/20";

        card.innerHTML = `
            <div class="w-12 h-12 rounded-full flex items-center justify-center ${colorClass}">
                <span class="material-symbols-outlined">${t.categoryIcon || 'payments'}</span>
            </div>
            <div class="flex-1">
                <div class="flex justify-between">
                    <p class="text-body-lg font-bold text-on-surface">${isInc ? '+' : '-'}₹${t.amount.toFixed(2)}</p>
                    <p class="text-label-md font-label-md text-on-surface-variant">${t.date}</p>
                </div>
                <div class="flex justify-between items-center gap-sm">
                    <p class="text-body-md text-on-surface-variant break-words whitespace-normal">${t.note || t.category}</p>
                    <span class="flex-shrink-0">${getTxAccountBadge(t)}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Analysis period pill control
function weekLabelStr(start) {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d) => `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
    const yr = start.getFullYear() === end.getFullYear() ? ` ${start.getFullYear()}` : ` ${start.getFullYear()}`;
    return `${fmt(start)}  –  ${fmt(end)}${yr}`;
}

function setAnalysisPeriod(period) {
    analysisPeriod = period;
    ['week', 'month', 'year', 'custom'].forEach(p => {
        const btn = document.getElementById(`analysis-pill-${p}`);
        if (!btn) return;
        if (p === period) {
            btn.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
        } else {
            btn.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container-high";
        }
    });
    // Show/hide navigators
    const monthNav = document.getElementById('analysis-period-nav');
    const weekNav = document.getElementById('analysis-week-nav');
    const customNav = document.getElementById('analysis-custom-nav');
    if (monthNav) monthNav.classList.toggle('hidden', period !== 'month' && period !== 'year');
    if (weekNav) weekNav.classList.toggle('hidden', period !== 'week');
    if (customNav) customNav.classList.toggle('hidden', period !== 'custom');
    // Seed custom dates if first time
    if (period === 'custom') {
        const fromEl = document.getElementById('analysis-custom-from');
        const toEl = document.getElementById('analysis-custom-to');
        if (fromEl && !fromEl.value) {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            fromEl.value = firstDay.toISOString().slice(0, 10);
            toEl.value = now.toISOString().slice(0, 10);
        }
    }
    // Seed week label
    if (period === 'week') {
        const wl = document.getElementById('analysis-week-label');
        if (wl) wl.innerText = weekLabelStr(analysisWeekStart);
    }
    updateAnalysis();
    saveInterfacePreferences();
}

function changeAnalysisPeriod(dir) {
    if (analysisPeriod === 'month') {
        analysisMonth += dir;
        if (analysisMonth > 11) { analysisMonth = 0; analysisYear++; }
        if (analysisMonth < 0) { analysisMonth = 11; analysisYear--; }
    } else if (analysisPeriod === 'year') {
        analysisYear += dir;
    }
    updateAnalysis();
    saveInterfacePreferences();
}

function changeAnalysisWeek(dir) {
    analysisWeekStart.setDate(analysisWeekStart.getDate() + dir * 7);
    const wl = document.getElementById('analysis-week-label');
    if (wl) wl.innerText = weekLabelStr(analysisWeekStart);
    updateAnalysis();
    saveInterfacePreferences();
}

function setAnalysisCatType(type) {
    analysisCatType = type;
    ['spending', 'income'].forEach(t => {
        const btn = document.getElementById(`analysis-cat-pill-${t}`);
        if (!btn) return;
        if (t === type) {
            btn.className = "px-md py-xs rounded-full text-label-lg font-bold transition-all bg-primary text-on-primary shadow-sm";
        } else {
            btn.className = "px-md py-xs rounded-full text-label-lg font-bold transition-all text-on-surface-variant hover:bg-surface-container-high";
        }
    });
    updateAnalysis();
    saveInterfacePreferences();
}

function transactionBelongsToAnalysisPeriod(t) {
    const txDate = getTransactionDate(t);
    if (!txDate) return false;

    // Normalize time to midnight for consistency in date range checks
    const checkDate = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());

    if (analysisPeriod === 'week') {
        const weekStart = new Date(analysisWeekStart.getFullYear(), analysisWeekStart.getMonth(), analysisWeekStart.getDate());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return checkDate >= weekStart && checkDate <= weekEnd;
    } else if (analysisPeriod === 'month') {
        return checkDate.getMonth() === analysisMonth && checkDate.getFullYear() === analysisYear;
    } else if (analysisPeriod === 'year') {
        return checkDate.getFullYear() === analysisYear;
    } else { // custom
        const fromEl = document.getElementById('analysis-custom-from');
        const toEl = document.getElementById('analysis-custom-to');
        if (!fromEl || !toEl || !fromEl.value || !toEl.value) return true;
        const from = new Date(fromEl.value); from.setHours(0, 0, 0, 0);
        const to = new Date(toEl.value); to.setHours(23, 59, 59, 999);
        return checkDate >= from && checkDate <= to;
    }
}

// Analysis view rendering
function updateAnalysis() {
    // Sync nav label on render
    const label = document.getElementById('analysis-month-label');
    if (label) {
        if (analysisPeriod === 'year') label.innerText = `${analysisYear}`;
        else label.innerText = `${monthNames[analysisMonth]} ${analysisYear}`;
    }
    const wl = document.getElementById('analysis-week-label');
    if (wl && analysisPeriod === 'week') wl.innerText = weekLabelStr(analysisWeekStart);

    const isSpending = analysisCatType === 'spending';
    const txType = isSpending ? 'expense' : 'income';

    // Calculate the complete period summary before narrowing the chart to one type.
    let totalIncome = 0;
    let totalSpending = 0;
    let total = 0;
    const categorySums = {};
    transactions.forEach(t => {
        if (!transactionBelongsToAnalysisPeriod(t)) return;

        const amt = Number(t.amount) || 0;
        if (t.type === 'income') totalIncome += amt;
        else totalSpending += amt;

        if (t.type === txType) {
            total += amt;
            if (t.category) {
                categorySums[t.category] = (categorySums[t.category] || 0) + amt;
            }
        }
    });

    const analysisIncomeEl = document.getElementById('analysis-total-income');
    const analysisSpendingEl = document.getElementById('analysis-total-spending');
    const analysisBalanceEl = document.getElementById('analysis-total-balance');
    const analysisBalanceCard = document.getElementById('analysis-balance-card');
    const analysisBalance = totalIncome - totalSpending;
    if (analysisIncomeEl) analysisIncomeEl.innerText = `₹${totalIncome.toFixed(2)}`;
    if (analysisSpendingEl) analysisSpendingEl.innerText = `₹${totalSpending.toFixed(2)}`;
    if (analysisBalanceEl) analysisBalanceEl.innerText = `${analysisBalance >= 0 ? '+' : '-'}₹${Math.abs(analysisBalance).toFixed(2)}`;
    if (analysisBalanceCard) {
        analysisBalanceCard.className = `px-4 py-1.5 rounded-full ${analysisBalance >= 0 ? 'bg-primary/15 text-primary' : 'bg-secondary/15 text-secondary'}`;
    }

    const totalLabel = document.getElementById('chart-total-spent');
    const totalLabelSub = totalLabel && totalLabel.previousElementSibling;
    if (totalLabel) totalLabel.innerText = `₹${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totalLabelSub) totalLabelSub.innerText = isSpending ? 'Total Spent' : 'Total Earned';

    // Build dynamic list and donut chart
    const listContainer = document.getElementById('analysis-category-list');
    const svg = document.getElementById('donut-svg');
    if (!listContainer || !svg) return;

    listContainer.innerHTML = '';
    svg.innerHTML = '';

    // All known categories per type
    const allExpenseCats = expenseCategories.map(c => ({ name: c.name, icon: c.icon }));
    const allIncomeCats = incomeCategories.map(c => ({ name: c.name, icon: c.icon }));
    const allCats = isSpending ? allExpenseCats : allIncomeCats;

    const colors = {
        'Groceries': '#ff8a50', 'Shopping': '#40c4ff', 'Education': '#b388ff',
        'Transport': '#ff5252', 'Bills & Utilities': '#7e57c2', 'Entertainment': '#66bb6a',
        'Medical': '#ef5350', 'Food & Drinks': '#ffd54f',
        'Salary': '#69f0ae', 'Freelance': '#40c4ff', 'Investments': '#b388ff',
        'Gifts & Grants': '#ff8a50', 'Other Income': '#78909c'
    };
    const bgLightColors = {
        'Groceries': 'bg-orange-500/10 text-orange-400', 'Shopping': 'bg-blue-500/10 text-blue-400',
        'Education': 'bg-purple-500/10 text-purple-400', 'Transport': 'bg-red-500/10 text-red-400',
        'Bills & Utilities': 'bg-indigo-500/10 text-indigo-400', 'Entertainment': 'bg-green-500/10 text-green-400',
        'Medical': 'bg-red-400/10 text-red-300', 'Food & Drinks': 'bg-yellow-500/10 text-yellow-400',
        'Salary': 'bg-green-500/10 text-green-400', 'Freelance': 'bg-blue-500/10 text-blue-400',
        'Investments': 'bg-purple-500/10 text-purple-400', 'Gifts & Grants': 'bg-orange-500/10 text-orange-400',
        'Other Income': 'bg-surface-container-high text-on-surface-variant'
    };

    // Sort: non-zero first by amount desc, then zero alphabetically
    const withValue = allCats.filter(c => (categorySums[c.name] || 0) > 0)
        .sort((a, b) => (categorySums[b.name] || 0) - (categorySums[a.name] || 0));
    const withoutValue = allCats.filter(c => !(categorySums[c.name] > 0));
    const sortedCats = [...withValue, ...withoutValue];

    // Draw donut only for non-zero
    let offset = 0;
    withValue.forEach(cat => {
        const sum = categorySums[cat.name];
        const pct = total > 0 ? (sum / total) * 100 : 0;
        const strokeColor = colors[cat.name] || '#899484';
        const strokeDasharray = `${pct} ${100 - pct}`;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'donut-segment transition-all duration-500');
        circle.setAttribute('cx', '18'); circle.setAttribute('cy', '18');
        circle.setAttribute('fill', 'transparent');
        circle.setAttribute('r', '15.915');
        circle.setAttribute('stroke', strokeColor);
        circle.setAttribute('stroke-width', '4.5');
        circle.setAttribute('stroke-dasharray', strokeDasharray);
        circle.setAttribute('stroke-dashoffset', (-offset).toString());
        svg.appendChild(circle);
        offset += pct;
    });

    // Draw all category rows (including zero)
    sortedCats.forEach(cat => {
        const sum = categorySums[cat.name] || 0;
        const pct = total > 0 && sum > 0 ? (sum / total) * 100 : 0;
        const bgLight = bgLightColors[cat.name] || 'bg-surface-container-high text-on-surface-variant';
        const isZero = sum === 0;

        const item = document.createElement('div');
        item.className = `flex items-center justify-between p-md bg-surface-container rounded-xl transition-colors ${isZero ? 'opacity-40' : 'hover:bg-surface-container-high cursor-pointer'}`;
        if (!isZero) item.onclick = () => openCatTransactionsSheet(cat.name, cat.icon);
        item.innerHTML = `
            <div class="flex items-center gap-md">
                <div class="w-12 h-12 rounded-full flex items-center justify-center ${bgLight}">
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">${cat.icon}</span>
                </div>
                <div>
                    <p class="text-body-lg font-semibold">${cat.name}</p>
                    <p class="text-label-md text-on-surface-variant">${isZero ? 'No transactions' : pct.toFixed(1) + '% of total'}</p>
                </div>
            </div>
            <p class="text-body-lg font-bold ${isZero ? 'text-on-surface-variant' : ''}">₹${sum.toFixed(2)}</p>
        `;
        listContainer.appendChild(item);
    });
}

function openCatTransactionsSheet(catName, catIcon) {
    const txType = analysisCatType === 'spending' ? 'expense' : 'income';
    const filtered = transactions.filter(t =>
        t.type === txType &&
        t.category === catName &&
        transactionBelongsToAnalysisPeriod(t)
    );

    // Header
    const titleEl = document.getElementById('cat-tx-sheet-title');
    const subtitleEl = document.getElementById('cat-tx-sheet-subtitle');
    if (titleEl) titleEl.innerText = catName;
    if (subtitleEl) {
        const periodStr = analysisPeriod === 'week'
            ? weekLabelStr(analysisWeekStart)
            : analysisPeriod === 'year'
                ? `${analysisYear}`
                : analysisPeriod === 'month'
                    ? `${monthNames[analysisMonth]} ${analysisYear}`
                    : 'Custom range';
        subtitleEl.innerText = `${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}  ·  ${periodStr}`;
    }

    // List
    const list = document.getElementById('cat-tx-sheet-list');
    list.innerHTML = '';
    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-center text-on-surface-variant py-xl">No transactions found</p>`;
    } else {
        const isInc = txType === 'income';
        let runTotal = 0;
        filtered.forEach(t => { runTotal += t.amount; });

        // Summary row
        const summary = document.createElement('div');
        summary.className = 'flex justify-between items-center py-sm px-md bg-surface-container rounded-xl mb-sm';
        summary.innerHTML = `
            <span class="text-label-lg text-on-surface-variant">Total</span>
            <span class="text-headline-md font-headline-md ${isInc ? 'text-primary' : 'text-secondary'}">${isInc ? '+' : '-'}₹${runTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        `;
        list.appendChild(summary);

        filtered.forEach(t => {
            const card = document.createElement('div');
            card.className = 'bg-surface-container p-md rounded-xl flex items-center gap-md hover:bg-surface-container-high transition-all cursor-pointer active:scale-[0.98]';
            card.onclick = () => { closeCatTransactionsSheet(); openEditTransactionModal(t); };
            const colorClass = isInc ? 'text-primary bg-primary-container/20' : 'text-secondary bg-secondary-container/20';
            card.innerHTML = `
                <div class="w-10 h-10 rounded-full flex items-center justify-center ${colorClass} flex-shrink-0">
                    <span class="material-symbols-outlined text-[20px]">${t.categoryIcon || 'payments'}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-baseline gap-sm">
                        <p class="text-body-md font-semibold text-on-surface break-words whitespace-normal">${t.note || t.category}</p>
                        <p class="text-body-lg font-bold flex-shrink-0 ${isInc ? 'text-primary' : 'text-secondary'}">${isInc ? '+' : '-'}₹${t.amount.toFixed(2)}</p>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <p class="text-label-md text-on-surface-variant">${t.date}</p>
                        <span class="flex-shrink-0">${getTxAccountBadge(t)}</span>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    }

    document.getElementById('sheet-cat-transactions').classList.remove('translate-y-full');
    showBackdrop();
}

function closeCatTransactionsSheet() {
    document.getElementById('sheet-cat-transactions').classList.add('translate-y-full');
    checkBackdropNeeded();
}

// Accounts tab renderer
function updateAccounts() {
    userAccounts.forEach(acc => {
        acc.currentBalance = acc.startingBalance;
    });

    transactions.forEach(t => {
        const acc = userAccounts.find(a => a.name === t.paymentMode);
        if (acc) {
            if (acc.type === 'card') {
                if (t.type === 'expense') acc.currentBalance += t.amount;
                else acc.currentBalance -= t.amount;
            } else {
                if (t.type === 'expense') acc.currentBalance -= t.amount;
                else acc.currentBalance += t.amount;
            }
        } else {
            // Legacy fallbacks
            if (t.paymentMode === 'Credit Card' || t.paymentMode === 'card') {
                const cardAcc = userAccounts.find(a => a.type === 'card');
                if (cardAcc) {
                    if (t.type === 'expense') cardAcc.currentBalance += t.amount;
                    else cardAcc.currentBalance -= t.amount;
                }
            } else if (t.paymentMode === 'Cash' || t.paymentMode === 'cash') {
                const cashAcc = userAccounts.find(a => a.type === 'cash');
                if (cashAcc) {
                    if (t.type === 'expense') cashAcc.currentBalance -= t.amount;
                    else cashAcc.currentBalance += t.amount;
                }
            } else {
                const bankAcc = userAccounts.find(a => a.type === 'bank');
                if (bankAcc) {
                    if (t.type === 'expense') bankAcc.currentBalance -= t.amount;
                    else bankAcc.currentBalance += t.amount;
                }
            }
        }
    });

    renderAccountsList();
    if (detailedAccountId) {
        updateDetailedAccountView();
    }
}

function renderAccountsList() {
    const listContainer = document.querySelector('#view-accounts .flex-col.gap-lg');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const categories = [
        { type: 'bank', label: 'Bank Accounts', icon: 'account_balance', color: 'text-tertiary' },
        { type: 'saving', label: 'Savings', icon: 'savings', color: 'text-primary' },
        { type: 'card', label: 'Credit Cards', icon: 'credit_card', color: 'text-secondary' },
        { type: 'cash', label: 'Cash', icon: 'payments', color: 'text-primary' },
        { type: 'other', label: 'Other', icon: 'account_balance_wallet', color: 'text-secondary' }
    ];

    let totalAvailableBalance = 0;
    let totalAvailableCredit = 0;

    categories.forEach(cat => {
        const catAccs = userAccounts.filter(a => a.type === cat.type);
        if (catAccs.length === 0) return;

        const sec = document.createElement('section');
        sec.className = "flex flex-col gap-sm";

        const titleDiv = document.createElement('div');
        titleDiv.className = "flex items-center gap-sm px-1";
        titleDiv.innerHTML = `
            <span class="material-symbols-outlined ${cat.color} text-[20px]" style="font-variation-settings: 'FILL' 1;">${cat.icon}</span>
            <h3 class="font-label-lg text-label-lg text-on-surface-variant">${cat.label}</h3>
        `;
        sec.appendChild(titleDiv);

        catAccs.forEach(acc => {
            const accBal = acc.currentBalance || 0;
            if (acc.type === 'card') {
                totalAvailableCredit += accBal;
            } else {
                if (!(acc.type === 'cash' && !includeCashInBalance)) {
                    totalAvailableBalance += accBal;
                }
            }

            const card = document.createElement('div');
            card.className = "bg-surface-container hover:bg-surface-container-high transition-colors p-md rounded-xl flex justify-between items-center cursor-pointer shadow-sm border border-outline-variant/10";
            card.onclick = () => openAccountDetailsSheet(acc.id);
            card.innerHTML = `
                <div class="flex flex-col">
                    <span class="font-body-lg text-body-lg text-on-surface font-semibold">${acc.name}</span>
                    <span class="text-label-sm text-on-surface-variant opacity-75">${acc.holderName || 'N/A'}</span>
                </div>
                <div class="flex items-center gap-sm">
                    <span class="font-body-lg text-body-lg text-on-surface">₹${accBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span class="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                </div>
            `;
            sec.appendChild(card);
        });

        if (cat.type === 'cash') {
            const banner = document.createElement('button');
            banner.type = 'button';
            banner.className = "mt-2 w-full text-left bg-primary/10 hover:bg-primary/15 border border-primary/15 rounded-2xl px-4 py-4 flex items-center justify-between gap-4 transition-colors active:scale-[0.99]";
            banner.onclick = () => toggleIncludeCashInBalance();

            banner.innerHTML = `
                <div class="flex items-center gap-3 min-w-0">
                    <span class="material-symbols-outlined text-primary text-[22px]" style="font-variation-settings: 'FILL' 1;">payments</span>
                    <div class="min-w-0">
                        <div class="text-[13px] font-bold text-on-surface truncate">Include Cash in Balance</div>
                        <div class="text-[11px] text-on-surface-variant truncate">
                            ${includeCashInBalance ? 'Cash wallet is included in totals' : 'Cash wallet is hidden from totals'}
                        </div>
                    </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0" onclick="event.stopPropagation()">
                    <input class="sr-only peer" id="acc-include-cash-toggle" onchange="toggleIncludeCashInBalance()"
                        type="checkbox" ${includeCashInBalance ? 'checked' : ''} />
                    <div
                        class="w-12 h-7 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary">
                    </div>
                </label>
            `;
            sec.appendChild(banner);
        }

        listContainer.appendChild(sec);
    });

    const totalEl = document.getElementById('acc-total-balance');
    const creditHeaderEl = document.getElementById('acc-card-header-balance');
    if (totalEl) totalEl.innerText = `₹${totalAvailableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (creditHeaderEl) creditHeaderEl.innerText = `₹${totalAvailableCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Budget tab rendering
function updateBudget() {
    let totalExpense = 0;
    const categorySums = {};
    const now = new Date();

    transactions.forEach(t => {
        if (t.type === 'expense') {
            if (activeBudgetTab === 'monthly') {
                if (transactionBelongsToSelectedMonth(t)) {
                    totalExpense += t.amount;
                    categorySums[t.category] = (categorySums[t.category] || 0) + t.amount;
                }
            } else {
                const txDate = getTransactionDate(t);
                const txYear = txDate.getFullYear();
                if (txYear === currentYear) {
                    totalExpense += t.amount;
                    categorySums[t.category] = (categorySums[t.category] || 0) + t.amount;
                }
            }
        }
    });

    const activeLimit = activeBudgetTab === 'monthly' ? monthlyBudgetLimit : yearlyBudgetLimit;

    // Update Header Date Info
    const headerDateText = document.querySelector('#view-budget h2.text-label-lg');
    if (headerDateText) {
        if (activeBudgetTab === 'monthly') {
            headerDateText.innerText = `${monthNames[currentMonth].slice(0, 3)} ${String(currentYear).slice(-2)} · Summary`;
        } else {
            headerDateText.innerText = `${currentYear} · Annual Summary`;
        }
    }

    document.getElementById('budget-spent-amount').innerText = `₹${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const limitDisplay = document.getElementById('budget-limit-display');
    if (limitDisplay) {
        limitDisplay.innerText = `Limit ₹${activeLimit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }

    const pct = Math.min((totalExpense / activeLimit) * 100, 100);
    const progressFill = document.getElementById('budget-progress-bar');
    progressFill.style.width = `${pct}%`;

    const statusText = document.getElementById('budget-status-text');
    const warningCard = document.getElementById('budget-warning-card');

    if (totalExpense > activeLimit) {
        progressFill.classList.remove('bg-primary-container');
        progressFill.classList.add('bg-secondary-container');
        statusText.innerHTML = `
            <span class="material-symbols-outlined text-[16px] text-error" style="font-variation-settings: 'FILL' 1;">error</span>
            <p class="text-label-lg font-label-lg text-error">Warning: Exceeded by <span class="font-bold">₹${(totalExpense - activeLimit).toFixed(2)}</span>!</p>
        `;
        warningCard.classList.remove('hidden');
    } else {
        progressFill.classList.add('bg-primary-container');
        progressFill.classList.remove('bg-secondary-container');
        statusText.innerHTML = `
            <span class="material-symbols-outlined text-[16px] text-primary" style="font-variation-settings: 'FILL' 1;">check_circle</span>
            <p class="text-label-lg font-label-lg text-primary">You are <span class="font-bold">₹${(activeLimit - totalExpense).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> under the limit.</p>
        `;
        if (pct > 70) {
            warningCard.classList.remove('hidden');
        } else {
            warningCard.classList.add('hidden');
        }
    }

    // Categories progress list
    const progressContainer = document.getElementById('budget-categories-progress');
    progressContainer.innerHTML = '';

    const icons = {
        'Groceries': 'shopping_basket',
        'Shopping': 'shopping_bag',
        'Education': 'school',
        'Transport': 'commute',
        'Bills & Utilities': 'receipt_long',
        'Entertainment': 'sports_esports',
        'Medical': 'medical_services',
        'Food & Drinks': 'restaurant'
    };

    for (const cat in categoryBudgetLimits) {
        const sum = categorySums[cat] || 0;
        const climit = activeBudgetTab === 'monthly' ? categoryBudgetLimits[cat] : categoryBudgetLimits[cat] * 12;
        const cpct = Math.min((sum / climit) * 100, 100);
        const isOver = sum > climit;
        const icon = icons[cat] || 'payments';

        const barColor = isOver ? 'bg-secondary-container' : 'bg-primary-container';
        const accentText = isOver ? 'text-secondary font-bold' : 'text-primary-fixed-dim';

        const progressItem = document.createElement('div');
        progressItem.className = "bg-surface-container p-md rounded-xl space-y-md border border-white/5 hover:bg-surface-container-high transition-colors cursor-pointer";
        progressItem.onclick = () => showToast(`${cat}: Limit ₹${climit}, spent ₹${sum}`);
        progressItem.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-md">
                    <div class="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center">
                        <span class="material-symbols-outlined text-secondary text-2xl">${icon}</span>
                    </div>
                    <span class="text-headline-md font-headline-md">${cat}</span>
                </div>
                <span class="material-symbols-outlined text-on-surface-variant">chevron_right</span>
            </div>
            <div class="space-y-sm">
                <div class="flex justify-between text-label-lg font-label-lg mb-1">
                    <span class="${accentText}">₹${sum.toFixed(2)}</span>
                    <span class="text-on-surface-variant">₹${climit}</span>
                </div>
                <div class="w-full h-4 bg-surface-container-high rounded-lg overflow-hidden relative">
                    <div class="absolute top-0 left-0 h-full ${barColor} progress-bar-fill" style="width: ${cpct}%;"></div>
                </div>
            </div>
        `;
        progressContainer.appendChild(progressItem);
    }
}

// Search trigger
function closeDashboardSearch(restoreDashboard = true) {
    const inputContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    dashboardSearchOpen = false;
    if (inputContainer) inputContainer.classList.add('hidden');
    if (searchInput) searchInput.value = '';
    if (restoreDashboard) updateDashboard();
}

function toggleSearch() {
    const inputContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    if (!inputContainer || !searchInput) return;

    const opening = inputContainer.classList.contains('hidden');
    if (opening) {
        inputContainer.classList.remove('hidden');
        dashboardSearchOpen = true;
        if (!history.state || !history.state.isSearch) {
            history.pushState({ viewId: currentView, isSearch: true }, '', '');
        }
        searchInput.focus();
    } else {
        if (history.state && history.state.isSearch) {
            history.back();
        } else {
            closeDashboardSearch();
        }
    }
}

function matchTransaction(t, query) {
    if (!query) return true;
    query = query.toLowerCase().trim();

    // 1. Check tags
    if (t.tags && t.tags.some(tag => tag.toLowerCase().includes(query) || ('#' + tag.toLowerCase()).includes(query))) {
        return true;
    }

    // 2. Check note / category / paymentMode
    if ((t.note && t.note.toLowerCase().includes(query)) ||
        (t.category && t.category.toLowerCase().includes(query)) ||
        (t.paymentMode && t.paymentMode.toLowerCase().includes(query))) {
        return true;
    }

    // 3. Check amount with signs/operators (+, -, >, <, >=, <=, =)
    const opMatch = query.match(/^([><=!+\-]+)?\s*([0-9.]+)/);
    if (opMatch) {
        const op = opMatch[1];
        const num = parseFloat(opMatch[2]);
        if (!isNaN(num)) {
            const amt = t.amount;
            if (op === '>') return amt > num;
            if (op === '<') return amt < num;
            if (op === '>=') return amt >= num;
            if (op === '<=') return amt <= num;
            if (op === '=') return amt === num;
            if (op === '+') return t.type === 'income' && (amt === num || query.length === 1 || String(amt).includes(opMatch[2]));
            if (op === '-') return t.type === 'expense' && (amt === num || query.length === 1 || String(amt).includes(opMatch[2]));
            return String(amt).includes(opMatch[2]);
        }
    }

    // Match loose "+" or "-" for type filters in search
    if (query === '+') return t.type === 'income';
    if (query === '-') return t.type === 'expense';

    return false;
}

function filterTransactions() {
    const val = document.getElementById('search-input').value;
    const filtered = transactions.filter(t => matchTransaction(t, val));
    renderRecentTransactions(filtered);
}

// Add Transaction Modal controls
function openAddTransactionModal() {
    editingTransactionId = null;

    // Reset Title/Button text
    const titleEl = document.querySelector('#modal-add-transaction h1');
    if (titleEl) titleEl.innerText = "Add Transaction";


    // Hide Delete Button in Add Mode
    const deleteBtn = document.getElementById('header-delete-btn');
    if (deleteBtn) deleteBtn.classList.add('hidden');

    // Reset modal values
    document.getElementById('tx-input-amount').value = '';
    document.getElementById('tx-input-desc').value = '';

    selectedTxDateObj = new Date();
    updateTxDatePickerLabel();

    selectedCategory = 'Groceries';
    selectedCategoryIcon = 'shopping_basket';
    selectedPaymentMode = 'Cash';
    selectedPaymentIcon = 'payments';
    selectedTags = [];
    selectedTxType = 'expense';

    syncAddTransactionUI();

    const modal = document.getElementById('modal-add-transaction');
    modal.classList.remove('translate-y-full');
    showBackdrop();
    setTimeout(() => { currentFormContext = { name: 'transaction', snapshot: snapshotFormState('transaction') }; }, 60);
}

function originalCloseAddTransactionModal() {
    const modal = document.getElementById('modal-add-transaction');
    if (!modal) return;
    modal.classList.add('translate-y-full');
    runAfterTransition(modal, checkBackdropNeeded);
}

function closeAddTransactionModal() {
    handleFormClose('transaction', originalCloseAddTransactionModal, saveTransaction);
}

function syncAddTransactionUI() {
    document.getElementById('tx-selected-cat-name').innerText = selectedCategory;
    document.getElementById('tx-selected-cat-icon').innerText = selectedCategoryIcon;

    document.getElementById('tx-selected-pay-name').innerText = selectedPaymentMode;
    document.getElementById('tx-selected-pay-icon').innerText = selectedPaymentIcon;

    const tagsCont = document.getElementById('tx-selected-tags-container');
    tagsCont.innerHTML = '';
    if (selectedTags.length === 0) {
        tagsCont.innerHTML = `<span class="text-label-md text-on-surface-variant">Add tags...</span>`;
    } else {
        selectedTags.forEach(tag => {
            const pill = document.createElement('div');
            pill.className = "flex items-center gap-xs px-3 py-1 bg-surface-container rounded-full border border-outline-variant";
            pill.innerHTML = `<span class="text-label-lg font-label-lg">${tag}</span>`;
            tagsCont.appendChild(pill);
        });
    }

    // Sync active state of segment buttons (Expense vs Income)
    const btnExp = document.getElementById('tx-type-expense');
    const btnInc = document.getElementById('tx-type-income');
    if (btnExp && btnInc) {
        if (selectedTxType === 'expense') {
            btnExp.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
            btnInc.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container-high";
        } else {
            btnInc.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
            btnExp.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container-high";
        }
    }

    // Sync color accents in form based on type
    const amtIcon = document.querySelector('#modal-add-transaction span.text-headline-lg');
    const descIcon = document.querySelector('#modal-add-transaction span.mt-1');
    if (selectedTxType === 'income') {
        if (amtIcon) amtIcon.className = "material-symbols-outlined text-primary text-headline-lg pb-1";
        if (descIcon) descIcon.className = "material-symbols-outlined text-primary mt-1";
    } else {
        if (amtIcon) amtIcon.className = "material-symbols-outlined text-secondary text-headline-lg pb-1";
        if (descIcon) descIcon.className = "material-symbols-outlined text-secondary mt-1";
    }
}

function switchTransactionType(type) {
    selectedTxType = type;
    const btnExp = document.getElementById('tx-type-expense');
    const btnInc = document.getElementById('tx-type-income');

    if (type === 'expense') {
        btnExp.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
        btnInc.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container-high";
        selectedCategory = 'Groceries';
        selectedCategoryIcon = 'shopping_basket';
    } else {
        btnInc.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
        btnExp.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container-high";
        selectedCategory = 'Salary';
        selectedCategoryIcon = 'work';
    }
    syncAddTransactionUI();
}

// Category Sheet Toggles
function openCategorySheet() {
    resetScroll('sheet-categories');
    syncCategoryLayoutUI();
    renderCategories();
    document.getElementById('sheet-categories').classList.remove('translate-y-full');
    showBackdrop();
}

function renderCategories() {
    const container = document.getElementById('categories-grid-container');
    if (!container) return;
    container.innerHTML = '';

    const list = selectedTxType === 'expense' ? expenseCategories : incomeCategories;

    if (categoryLayout === 'grid') {
        const grid = document.createElement('div');
        grid.className = "grid grid-cols-5 gap-y-sm gap-x-1";

        list.forEach(cat => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = "flex flex-col items-center gap-xs group py-1 overflow-hidden w-full";
            btn.onclick = () => selectCategory(cat.name, cat.icon);
            btn.innerHTML = `
                <div class="w-11 h-11 rounded-xl ${cat.color} flex items-center justify-center transition-all group-active:scale-90 ${cat.fillClass}">
                    <span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' 1;">${cat.icon}</span>
                </div>
                <span class="text-[10px] font-semibold text-on-surface-variant text-center leading-tight truncate w-full px-0.5" title="${cat.name}">${cat.name}</span>
            `;
            grid.appendChild(btn);
        });
        container.appendChild(grid);
    } else {
        const listWrapper = document.createElement('div');
        listWrapper.className = "flex flex-col gap-1.5";

        list.forEach(cat => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = "flex items-center gap-md w-full p-2 hover:bg-surface-container-high rounded-xl text-left transition-colors";
            btn.onclick = () => selectCategory(cat.name, cat.icon);
            btn.innerHTML = `
                <div class="w-10 h-10 rounded-xl ${cat.color} flex items-center justify-center ${cat.fillClass}">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">${cat.icon}</span>
                </div>
                <span class="text-body-md font-semibold text-on-surface">${cat.name}</span>
            `;
            listWrapper.appendChild(btn);
        });
        container.appendChild(listWrapper);
    }
}

function setCategoryLayout(layout) {
    categoryLayout = layout;
    saveInterfacePreferences();
    syncCategoryLayoutUI();
    renderCategories();
}

function closeCategorySheet() {
    document.getElementById('sheet-categories').classList.add('translate-y-full');
    checkBackdropNeeded();
}

// Category Selector callback
function selectCategory(name, icon) {
    selectedCategory = name;
    selectedCategoryIcon = icon;
    syncAddTransactionUI();
    closeCategorySheet();
}

// Payment Mode Sheet Toggles
function openPaymentSheet() {
    resetScroll('sheet-payments');
    renderPaymentModesList();
    document.getElementById('sheet-payments').classList.remove('translate-y-full');
    showBackdrop();
}

function renderPaymentModesList() {
    const container = document.querySelector('#sheet-payments .flex-1');
    if (!container) return;
    container.innerHTML = '';
    userAccounts.forEach(acc => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = "w-full flex items-center gap-md p-md bg-surface-container hover:bg-surface-container-high rounded-xl transition-all active:scale-[0.97] group border border-outline-variant/50";
        const icon = acc.type === 'bank' ? 'account_balance' : acc.type === 'card' ? 'credit_card' : 'payments';
        const colorClass = acc.type === 'bank' ? 'bg-tertiary/10 text-tertiary' : acc.type === 'card' ? 'bg-secondary-container/20 text-secondary' : 'bg-primary/10 text-primary';

        btn.onclick = () => selectPaymentMode(acc.name, icon);
        btn.innerHTML = `
            <div class="w-12 h-12 rounded-full ${colorClass} flex items-center justify-center group-hover:scale-115 transition-transform">
                <span class="material-symbols-outlined text-[28px]">${icon}</span>
            </div>
            <div class="flex-grow text-left min-w-0">
                <span class="block text-body-lg font-semibold text-on-background truncate">${acc.name}</span>
                <span class="block text-label-md text-on-surface-variant truncate">${acc.holderName ? acc.holderName + '  ·  ' : ''}${acc.type === 'bank' ? 'Bank Account' : acc.type === 'card' ? 'Credit Card' : 'Cash'}</span>
            </div>
        `;
        container.appendChild(btn);
    });
}

function closePaymentSheet() {
    document.getElementById('sheet-payments').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function selectPaymentMode(name, icon) {
    selectedPaymentMode = name;
    selectedPaymentIcon = icon;
    syncAddTransactionUI();
    closePaymentSheet();
}

// Tags Sheet Toggles
function openTagsSheet() {
    resetScroll('sheet-tags');
    renderTagsSelector();
    document.getElementById('sheet-tags').classList.remove('translate-y-full');
    showBackdrop();
}

function closeTagsSheet() {
    document.getElementById('sheet-tags').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function renderTagsSelector() {
    const container = document.getElementById('available-tags-list');
    container.innerHTML = '';

    if (allAvailableTags.length === 0) {
        container.innerHTML = '<p class="text-label-md text-on-surface-variant italic">No tags yet. Add one above.</p>';
        return;
    }

    allAvailableTags.forEach(tag => {
        const isActive = selectedTags.includes(tag);
        const pill = document.createElement('div');
        pill.className = "flex items-center gap-xs";

        const tagBtn = document.createElement('button');
        if (isActive) {
            tagBtn.className = "flex items-center gap-xs bg-primary/20 border-primary text-primary px-md py-sm rounded-full border transition-all active:scale-90 font-label-lg";
        } else {
            tagBtn.className = "flex items-center gap-xs bg-surface-container-high hover:bg-surface-container-highest border-outline-variant text-on-surface px-md py-sm rounded-full border transition-all active:scale-90 font-label-lg";
        }
        tagBtn.onclick = () => toggleTag(tag);
        tagBtn.innerHTML = `<span>#</span><span>${tag}</span>`;

        const delBtn = document.createElement('button');
        delBtn.className = "w-5 h-5 rounded-full bg-error/15 text-error flex items-center justify-center hover:bg-error/25 transition-colors flex-shrink-0";
        delBtn.innerHTML = '<span class="material-symbols-outlined text-[12px]">close</span>';
        delBtn.title = `Delete #${tag}`;
        delBtn.onclick = (e) => { e.stopPropagation(); deleteTag(tag); };

        pill.appendChild(tagBtn);
        pill.appendChild(delBtn);
        container.appendChild(pill);
    });
}

function toggleTag(tag) {
    const idx = selectedTags.indexOf(tag);
    if (idx > -1) {
        selectedTags.splice(idx, 1);
    } else {
        selectedTags.push(tag);
    }
    renderTagsSelector();
    syncAddTransactionUI();
}

function createCustomTag() {
    const input = document.getElementById('custom-tag-input');
    const val = input.value.trim().toLowerCase();
    if (val && !allAvailableTags.includes(val)) {
        allAvailableTags.push(val);
        selectedTags.push(val);
        input.value = '';
        saveToLocalStorage();
        renderTagsSelector();
        syncAddTransactionUI();
        showToast(`Created tag #${val}`);
    }
}

function deleteTag(tag) {
    // Remove from global list
    allAvailableTags = allAvailableTags.filter(t => t !== tag);
    // Remove from currently selected (if open in transaction add/edit)
    selectedTags = selectedTags.filter(t => t !== tag);
    // Remove from all existing transactions
    transactions.forEach(t => {
        if (t.tags) t.tags = t.tags.filter(tg => tg !== tag);
    });
    saveToLocalStorage();
    renderTagsSelector();
    syncAddTransactionUI();
    // Refresh advanced filters tag dropdown
    const tagDropdown = document.getElementById('filter-tag-dropdown');
    if (tagDropdown) {
        const tags = getAllTags();
        let html = `<div class="py-1"><button class="w-full text-left px-3 py-1.5 hover:bg-surface-container-high text-body-md text-on-surface font-semibold" onclick="setCustomFilterTag('all')">All Tags</button>`;
        tags.forEach(tg => {
            html += `<button class="w-full text-left px-3 py-1.5 hover:bg-surface-container-high text-body-md text-on-surface" onclick="setCustomFilterTag('${tg}')">#${tg}</button>`;
        });
        html += `</div>`;
        tagDropdown.innerHTML = html;
    }
    showToast(`Deleted tag #${tag}`);
}

let incomeSheetRenderFrame = 0;
let spendingSheetRenderFrame = 0;

function scheduleSheetContentRender(sheetId, renderFn) {
    // Let the browser paint the sheet's opening frame before building its list.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const sheet = document.getElementById(sheetId);
            if (sheet && !sheet.classList.contains('translate-y-full')) renderFn();
        });
    });
}

function queueIncomeTransactionsRender() {
    cancelAnimationFrame(incomeSheetRenderFrame);
    incomeSheetRenderFrame = requestAnimationFrame(() => {
        incomeSheetRenderFrame = 0;
        renderIncomeTransactions();
    });
}

function queueSpendingTransactionsRender() {
    cancelAnimationFrame(spendingSheetRenderFrame);
    spendingSheetRenderFrame = requestAnimationFrame(() => {
        spendingSheetRenderFrame = 0;
        renderSpendingTransactions();
    });
}

function openIncomeDetailsSheet() {
    incomeDetailsYear = currentYear;
    incomeDetailsMonth = currentMonth;
    const searchInput = document.getElementById('income-sheet-search');
    if (searchInput) searchInput.value = '';
    updateIncomeDetailsMonthLabel();
    document.getElementById('sheet-income-details').classList.remove('translate-y-full');
    showBackdrop();
    scheduleSheetContentRender('sheet-income-details', renderIncomeTransactions);
}

function closeIncomeDetailsSheet() {
    document.getElementById('sheet-income-details').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function renderIncomeTransactions(loadMore = false) {
    if (!loadMore) {
        incomeTxRenderLimit = getTransactionRenderBatchSize();
    }
    const container = document.getElementById('income-transactions-list');
    container.innerHTML = '';

    const searchVal = document.getElementById('income-sheet-search') ? document.getElementById('income-sheet-search').value : '';
    const monthlyIncome = transactions.filter(t => t.type === 'income' && transactionBelongsToMonth(t, incomeDetailsMonth, incomeDetailsYear));
    const incomeTotal = monthlyIncome.reduce((total, transaction) => total + (Number(transaction.amount) || 0), 0);
    const incomeTotalEl = document.getElementById('income-sheet-total');
    if (incomeTotalEl) incomeTotalEl.innerText = `+₹${incomeTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const incomeList = monthlyIncome.filter(t => matchTransaction(t, searchVal));

    if (incomeList.length === 0) {
        container.innerHTML = `<p class="text-center text-on-surface-variant py-md">No income transactions recorded for the selected period.</p>`;
        return;
    }

    const totalMatching = incomeList.length;
    const itemsToRender = incomeList.slice(0, incomeTxRenderLimit);

    itemsToRender.forEach(t => {
        const card = document.createElement('div');
        card.className = "bg-surface-container p-md rounded-xl flex items-center gap-md hover:bg-surface-container-high transition-all cursor-pointer active:scale-[0.98]";
        bindLongPress(card, t);

        let colorClass = "text-primary bg-primary-container/20";

        card.innerHTML = `
            <div class="w-12 h-12 rounded-full flex items-center justify-center ${colorClass}">
                <span class="material-symbols-outlined">${t.categoryIcon || 'payments'}</span>
            </div>
            <div class="flex-1">
                <div class="flex justify-between">
                    <p class="text-body-lg font-bold text-on-surface">+₹${t.amount.toFixed(2)}</p>
                    <p class="text-label-md font-label-md text-on-surface-variant">${t.date}</p>
                </div>
                <div class="flex justify-between items-center gap-sm">
                    <p class="text-body-md text-on-surface-variant break-words whitespace-normal">${t.note || t.category}</p>
                    <span class="flex-shrink-0">${getTxAccountBadge(t)}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    if (totalMatching > incomeTxRenderLimit) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = "w-full py-md bg-surface-container hover:bg-surface-container-high text-primary font-bold rounded-xl shadow-sm border border-outline-variant/10 transition-colors my-md active:scale-[0.98]";
        loadMoreBtn.innerText = `Load More (${totalMatching - incomeTxRenderLimit} remaining)`;
        loadMoreBtn.onclick = () => {
            incomeTxRenderLimit += getTransactionRenderBatchSize();
            renderIncomeTransactions(true);
        };
        container.appendChild(loadMoreBtn);
    }
}

function openSpendingDetailsSheet() {
    spendingDetailsYear = currentYear;
    spendingDetailsMonth = currentMonth;
    const searchInput = document.getElementById('spending-sheet-search');
    if (searchInput) searchInput.value = '';
    updateSpendingDetailsMonthLabel();
    document.getElementById('sheet-spending-details').classList.remove('translate-y-full');
    showBackdrop();
    scheduleSheetContentRender('sheet-spending-details', renderSpendingTransactions);
}

function closeSpendingDetailsSheet() {
    document.getElementById('sheet-spending-details').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function renderSpendingTransactions(loadMore = false) {
    if (!loadMore) {
        spendingTxRenderLimit = getTransactionRenderBatchSize();
    }
    const container = document.getElementById('spending-transactions-list');
    container.innerHTML = '';

    const searchVal = document.getElementById('spending-sheet-search') ? document.getElementById('spending-sheet-search').value : '';
    const monthlyExpenses = transactions.filter(t => t.type === 'expense' && transactionBelongsToMonth(t, spendingDetailsMonth, spendingDetailsYear));
    const spendingTotal = monthlyExpenses.reduce((total, transaction) => total + (Number(transaction.amount) || 0), 0);
    const spendingTotalEl = document.getElementById('spending-sheet-total');
    if (spendingTotalEl) spendingTotalEl.innerText = `-₹${spendingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const expenseList = monthlyExpenses.filter(t => matchTransaction(t, searchVal));

    if (expenseList.length === 0) {
        container.innerHTML = `<p class="text-center text-on-surface-variant py-md">No expenses recorded for the selected period.</p>`;
        return;
    }

    const totalMatching = expenseList.length;
    const itemsToRender = expenseList.slice(0, spendingTxRenderLimit);

    itemsToRender.forEach(t => {
        const card = document.createElement('div');
        card.className = "bg-surface-container p-md rounded-xl flex items-center gap-md hover:bg-surface-container-high transition-all cursor-pointer active:scale-[0.98]";
        bindLongPress(card, t);

        let colorClass = "text-secondary bg-secondary-container/20";

        card.innerHTML = `
            <div class="w-12 h-12 rounded-full flex items-center justify-center ${colorClass}">
                <span class="material-symbols-outlined">${t.categoryIcon || 'payments'}</span>
            </div>
            <div class="flex-1">
                <div class="flex justify-between">
                    <p class="text-body-lg font-bold text-on-surface">-₹${t.amount.toFixed(2)}</p>
                    <p class="text-label-md font-label-md text-on-surface-variant">${t.date}</p>
                </div>
                <div class="flex justify-between items-center gap-sm">
                    <p class="text-body-md text-on-surface-variant break-words whitespace-normal">${t.note || t.category}</p>
                    <span class="flex-shrink-0">${getTxAccountBadge(t)}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    if (totalMatching > spendingTxRenderLimit) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = "w-full py-md bg-surface-container hover:bg-surface-container-high text-primary font-bold rounded-xl shadow-sm border border-outline-variant/10 transition-colors my-md active:scale-[0.98]";
        loadMoreBtn.innerText = `Load More (${totalMatching - spendingTxRenderLimit} remaining)`;
        loadMoreBtn.onclick = () => {
            spendingTxRenderLimit += getTransactionRenderBatchSize();
            renderSpendingTransactions(true);
        };
        container.appendChild(loadMoreBtn);
    }
}

function syncAllViews() {
    updateDashboard();
    updateAccounts();
    updateBudget();

    if (currentView === 'analysis') {
        updateAnalysis();
    }
    if (currentView === 'structured-tx') {
        renderStructuredTx();
    }
    if (currentView === 'transactions-all') {
        updateAllTransactionsView();
    }

    // Also re-render active details sheets if they are open
    const incSheet = document.getElementById('sheet-income-details');
    if (incSheet && !incSheet.classList.contains('translate-y-full')) {
        renderIncomeTransactions(true);
    }
    const spendSheet = document.getElementById('sheet-spending-details');
    if (spendSheet && !spendSheet.classList.contains('translate-y-full')) {
        renderSpendingTransactions(true);
    }
    const accSheet = document.getElementById('sheet-account-details');
    if (accSheet && !accSheet.classList.contains('translate-y-full')) {
        renderAccountDetailsTransactions();
    }
}

function runAfterTransition(el, callback, timeoutMs = 380) {
    if (!el || typeof callback !== 'function') {
        if (typeof callback === 'function') callback();
        return;
    }

    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        el.removeEventListener('transitionend', onEnd);
        callback();
    };

    const onEnd = (event) => {
        if (event.target !== el) return;
        if (event.propertyName && event.propertyName !== 'transform' && event.propertyName !== 'opacity') return;
        finish();
    };

    el.addEventListener('transitionend', onEnd);
    setTimeout(finish, timeoutMs);
}

// Save Transaction to memory database
function saveTransaction() {
    const dtInput = document.getElementById('tx-input-datetime');
    if (dtInput && dtInput.value) {
        selectedTxDateObj = new Date(dtInput.value);
    }
    const amtVal = parseFloat(document.getElementById('tx-input-amount').value);
    const descVal = document.getElementById('tx-input-desc').value.trim();

    if (isNaN(amtVal) || amtVal < 0) {
        showToast("Please enter a valid amount");
        return;
    }

    if (!descVal) {
        showToast("Please enter a note/description");
        return;
    }

    let toastMessage = "Transaction saved successfully!";
    if (editingTransactionId !== null) {
        const tx = transactions.find(x => x.id === editingTransactionId);
        if (tx) {
            tx.amount = amtVal;
            tx.note = descVal || selectedCategory;
            tx.category = selectedCategory;
            tx.categoryIcon = selectedCategoryIcon;
            tx.type = selectedTxType;
            tx.paymentMode = selectedPaymentMode;
            tx.tags = [...selectedTags];
            tx.rawDate = selectedTxDateObj.toISOString();
            tx.updatedAt = new Date().toISOString();
            tx.date = getRelativeDateString(selectedTxDateObj);
        }
        editingTransactionId = null;
        toastMessage = "Transaction updated successfully!";
    } else {
        const newTx = {
            id: transactions.length + 1,
            syncId: generateTransactionSyncId(),
            amount: amtVal,
            rawDate: selectedTxDateObj.toISOString(),
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            date: getRelativeDateString(selectedTxDateObj),
            category: selectedCategory,
            categoryIcon: selectedCategoryIcon,
            note: descVal || selectedCategory,
            type: selectedTxType,
            paymentMode: selectedPaymentMode,
            tags: [...selectedTags]
        };

        transactions.unshift(newTx);
    }

    saveToLocalStorage();
    currentFormContext = null;

    // Sync all views immediately BEFORE closing modal to avoid flicker
    syncAllViews();

    // Show tick animation instead of toast
    showTickAnimation();

    // Then close the modal smoothly
    closeAddTransactionModal();
}

// Helper UI functions and Back Gesture Navigation Support
let isManuallyClosing = false;

function showBackdrop() {
    const overlay = document.getElementById('modal-overlay');
    const wasHidden = !overlay || overlay.classList.contains('opacity-0') || overlay.classList.contains('pointer-events-none');
    if (overlay) {
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100', 'pointer-events-auto');
    }
    document.body.classList.add('overflow-hidden');
    document.documentElement.classList.add('modal-open');

    // Push only once for the first opened sheet/modal so back navigation stays stable.
    if (wasHidden) {
        history.pushState({ isModal: true }, '', '');
    }
}

function performCloseAllSheets() {
    hideCustomFilterDropdowns();
    document.querySelectorAll('.bottom-sheet-transition').forEach(sheet => {
        sheet.classList.add('translate-y-full');
    });
    const txModal = document.getElementById('modal-add-transaction');
    if (txModal) txModal.classList.add('translate-y-full');

    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.remove('opacity-100', 'pointer-events-auto');
        overlay.classList.add('opacity-0', 'pointer-events-none');
    }
    dashboardSearchOpen = false;
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) searchContainer.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    document.documentElement.classList.remove('modal-open');
}

function closeAllSheets() {
    if (history.state && history.state.isModal) {
        isManuallyClosing = true;
        history.back();
    } else {
        performCloseAllSheets();
    }
}

function exitApp() {
    // Works in standalone PWAs and native webview hosts; browsers may ignore it.
    if (navigator.app && typeof navigator.app.exitApp === 'function') {
        navigator.app.exitApp();
        return;
    }

    window.close();
}

window.addEventListener('popstate', (event) => {
    if (isManuallyClosing) {
        isManuallyClosing = false;
        performCloseAllSheets();
        return;
    }

    const openSheets = Array.from(document.querySelectorAll('.bottom-sheet-transition')).filter(sheet => !sheet.classList.contains('translate-y-full'));
    const txModal = document.getElementById('modal-add-transaction');
    const isTxModalOpen = txModal && !txModal.classList.contains('translate-y-full');
    const searchContainer = document.getElementById('search-container');
    const isDashboardSearchOpen = dashboardSearchOpen || (searchContainer && !searchContainer.classList.contains('hidden'));

    if (openSheets.length > 0 || isTxModalOpen) {
        performCloseAllSheets();
        return;
    }

    if (isDashboardSearchOpen) {
        closeDashboardSearch(true);
        if (event.state && event.state.viewId) {
            switchView(event.state.viewId, true);
        }
        return;
    }

    // Handle view change back navigation
    if (event.state && event.state.viewId) {
        switchView(event.state.viewId, true);
    } else {
        exitApp();
    }
});

// Touch Swipe Gesture Navigation
let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

window.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
}, { passive: true });

function handleSwipe(startX, startY, endX, endY) {
    // If any sheet/modal is open, do not switch views/dates
    const openSheets = Array.from(document.querySelectorAll('.bottom-sheet-transition')).filter(sheet => !sheet.classList.contains('translate-y-full'));
    const txModal = document.getElementById('modal-add-transaction');
    const isTxModalOpen = txModal && !txModal.classList.contains('translate-y-full');
    if (openSheets.length > 0 || isTxModalOpen) return;

    const diffX = endX - startX;
    const diffY = endY - startY;

    // Thresholds: min horizontal distance is 80px, max vertical deviation is 50px
    if (Math.abs(diffX) > 80 && Math.abs(diffY) < 50) {
        if (diffX < 0) {
            onSwipeLeft();
        } else {
            onSwipeRight();
        }
    }
}

function onSwipeLeft() {
    if (currentView === 'structured-tx') {
        if (structuredTxMode !== 'custom') {
            structuredTxNavNext();
        }
    } else {
        const mainViews = ['home', 'analysis', 'accounts', 'more'];
        const idx = mainViews.indexOf(currentView);
        if (idx !== -1 && idx < mainViews.length - 1) {
            switchView(mainViews[idx + 1]);
        }
    }
}

function onSwipeRight() {
    if (currentView === 'structured-tx') {
        if (structuredTxMode !== 'custom') {
            structuredTxNavPrev();
        }
    } else {
        const mainViews = ['home', 'analysis', 'accounts', 'more'];
        const idx = mainViews.indexOf(currentView);
        if (idx !== -1 && idx > 0) {
            switchView(mainViews[idx - 1]);
        }
    }
}

function checkBackdropNeeded() {
    let openedSheet = false;
    document.querySelectorAll('.bottom-sheet-transition').forEach(sheet => {
        if (!sheet.classList.contains('translate-y-full')) {
            openedSheet = true;
        }
    });

    const txModal = document.getElementById('modal-add-transaction');
    if (txModal && !txModal.classList.contains('translate-y-full')) {
        openedSheet = true;
    }

    if (!openedSheet) {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.remove('opacity-100', 'pointer-events-auto');
            overlay.classList.add('opacity-0', 'pointer-events-none');
        }
        document.body.classList.remove('overflow-hidden');
        document.documentElement.classList.remove('modal-open');
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');

    // Check if this is a success message
    const isSuccess = msg.toLowerCase().includes('success') || msg.toLowerCase().includes('saved') || msg.toLowerCase().includes('updated') || msg.toLowerCase().includes('created') || msg.toLowerCase().includes('deleted') || msg.toLowerCase().includes('welcome');

    if (isSuccess) {
        // Show tick.svg for success - remove black background
        toast.className = 'fixed bottom-28 left-1/2 transform -translate-x-1/2 bg-transparent backdrop-blur-none px-lg py-sm rounded-full shadow-lg text-body-md font-bold opacity-0 transition-opacity duration-300 pointer-events-none z-[100] flex items-center justify-center';
        toast.innerHTML = '<img src="tick.svg" alt="Success" class="w-12 h-12" />';
    } else {
        // Show text for other messages - keep dark background
        toast.className = 'fixed bottom-28 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm px-lg py-sm rounded-full shadow-lg text-body-md font-bold opacity-0 transition-opacity duration-300 pointer-events-none z-[100] flex items-center justify-center text-white';
        toast.innerText = msg;
    }

    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');
    setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0');
    }, 2500);
}

// Show tick animation overlay for transaction save/update
function showTickAnimation() {
    const overlay = document.getElementById('tick-overlay');
    if (!overlay) return;

    // Force SVG animation restart by reloading the image
    const img = overlay.querySelector('img');
    if (img) {
        img.src = 'tick.svg?' + Date.now();
    }

    overlay.classList.remove('hidden', 'opacity-0');
    overlay.classList.add('opacity-100');

    // Auto-hide after 1.5 seconds
    setTimeout(() => {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }, 1500);
}

function resetScroll(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const scrollables = el.querySelectorAll('.overflow-y-auto');
    scrollables.forEach(s => s.scrollTop = 0);
    if (el.classList.contains('overflow-y-auto')) {
        el.scrollTop = 0;
    }
}

function showTransactionDetails(t) {
    openEditTransactionModal(t);
}

function openEditTransactionModal(t) {
    editingTransactionId = t.id;

    document.getElementById('tx-input-amount').value = t.amount;
    document.getElementById('tx-input-desc').value = t.note;

    if (t.rawDate) {
        selectedTxDateObj = new Date(t.rawDate);
    } else {
        selectedTxDateObj = parseTxDate(t.date);
    }
    updateTxDatePickerLabel();

    selectedCategory = t.category;
    selectedCategoryIcon = t.categoryIcon || 'payments';
    selectedPaymentMode = t.paymentMode;

    if (t.paymentMode === 'Cash') selectedPaymentIcon = 'payments';
    else if (t.paymentMode === 'Credit Card') selectedPaymentIcon = 'credit_card';
    else selectedPaymentIcon = 'account_balance_wallet';

    selectedTags = [...(t.tags || [])];
    selectedTxType = t.type;

    syncAddTransactionUI();

    const titleEl = document.querySelector('#modal-add-transaction h1');
    if (titleEl) titleEl.innerText = "Edit Transaction";


    // Show Delete Button in Edit Mode
    const deleteBtn = document.getElementById('header-delete-btn');
    if (deleteBtn) deleteBtn.classList.remove('hidden');

    const modal = document.getElementById('modal-add-transaction');
    modal.classList.remove('translate-y-full');
    showBackdrop();

    setTimeout(() => { currentFormContext = { name: 'transaction', snapshot: snapshotFormState('transaction') }; }, 60);
}

function changeMonth(dir) {
    currentMonth += dir;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear += 1;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear -= 1;
    }
    updateSheetMonthLabels();

    // Re-render dashboard, analysis, sheets, and budget
    updateDashboard();
    updateAnalysis();
    updateBudget();
    renderIncomeTransactions();
    renderSpendingTransactions();
}

function shiftDetailsMonth(details, dir) {
    details.month += dir;
    if (details.month > 11) {
        details.month = 0;
        details.year += 1;
    } else if (details.month < 0) {
        details.month = 11;
        details.year -= 1;
    }
}

function changeIncomeDetailsMonth(dir) {
    const details = { month: incomeDetailsMonth, year: incomeDetailsYear };
    shiftDetailsMonth(details, dir);
    incomeDetailsMonth = details.month;
    incomeDetailsYear = details.year;
    updateIncomeDetailsMonthLabel();
    renderIncomeTransactions();
}

function changeSpendingDetailsMonth(dir) {
    const details = { month: spendingDetailsMonth, year: spendingDetailsYear };
    shiftDetailsMonth(details, dir);
    spendingDetailsMonth = details.month;
    spendingDetailsYear = details.year;
    updateSpendingDetailsMonthLabel();
    renderSpendingTransactions();
}

function updateIncomeDetailsMonthLabel() {
    const label = document.getElementById('income-sheet-month-label');
    if (label) label.innerText = `${monthNames[incomeDetailsMonth]} ${incomeDetailsYear}`;
}

function updateSpendingDetailsMonthLabel() {
    const label = document.getElementById('spending-sheet-month-label');
    if (label) label.innerText = `${monthNames[spendingDetailsMonth]} ${spendingDetailsYear}`;
}

function updateSheetMonthLabels() {
    const labelStr = `${monthNames[currentMonth]} ${currentYear}`;
    const incLabel = document.getElementById('income-sheet-month-label');
    const spdLabel = document.getElementById('spending-sheet-month-label');
    const anaLabel = document.getElementById('analysis-month-label');
    if (incLabel) incLabel.innerText = labelStr;
    if (spdLabel) spdLabel.innerText = labelStr;
    if (anaLabel) anaLabel.innerText = labelStr;
}

function transactionBelongsToSelectedMonth(t) {
    return transactionBelongsToMonth(t, currentMonth, currentYear);
}

function transactionBelongsToMonth(t, month, year) {
    const txDate = getTransactionDate(t);
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth();
    return txMonth === month && txYear === year;
}

// CSV Export & Import functions
function exportCSV() {
    openExportRangeSheet();
}

function openExportRangeSheet() {
    closeExportDataSheet();
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const fromEl = document.getElementById('export-custom-from');
    const toEl = document.getElementById('export-custom-to');
    if (fromEl) fromEl.value = first.toISOString().slice(0, 10);
    if (toEl) toEl.value = now.toISOString().slice(0, 10);
    document.getElementById('sheet-export-range').classList.remove('translate-y-full');
    showBackdrop();
}

function closeExportRangeSheet() {
    document.getElementById('sheet-export-range').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function escapeCSVField(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    str = str.replace(/"/g, '""');
    return `"${str}"`;
}

function doExportCSV(rangeType) {
    let toExport = [];
    if (rangeType === 'all') {
        toExport = transactions;
    } else if (rangeType === 'month') {
        // Use the selected month from the picker if available, else current month
        const exportMonthVal = document.getElementById('export-month-date-val');
        let expMonth = currentMonth, expYear = currentYear;
        if (exportMonthVal && exportMonthVal.value) {
            const d = new Date(exportMonthVal.value);
            expMonth = d.getMonth();
            expYear = d.getFullYear();
        }
        toExport = transactions.filter(t => transactionBelongsToMonth(t, expMonth, expYear));
    } else if (rangeType === 'year') {
        // Use the selected year from the picker if available, else current year
        const exportYearVal = document.getElementById('export-year-date-val');
        let expYear = currentYear;
        if (exportYearVal && exportYearVal.value) {
            const d = new Date(exportYearVal.value);
            expYear = d.getFullYear();
        }
        toExport = transactions.filter(t => {
            const txDate = t.rawDate ? new Date(t.rawDate) : new Date(t.date);
            return !isNaN(txDate.getTime()) && txDate.getFullYear() === expYear;
        });
    } else if (rangeType === 'custom') {
        const fromVal = document.getElementById('export-custom-from').value;
        const toVal = document.getElementById('export-custom-to').value;
        if (!fromVal || !toVal) {
            showToast("Please select valid From and To dates");
            return;
        }
        const fromDate = new Date(fromVal); fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(toVal); toDate.setHours(23, 59, 59, 999);
        toExport = transactions.filter(t => {
            const txDate = t.rawDate ? new Date(t.rawDate) : new Date(t.date);
            if (isNaN(txDate.getTime())) return false;
            const checkDate = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
            return checkDate >= fromDate && checkDate <= toDate;
        });
    }

    if (toExport.length === 0) {
        showToast("No transactions found for the selected period");
        return;
    }

    let csvContent = "Date,Amount,Category,Payment Mode,Type,To Payment Mode,Note\n";
    toExport.forEach(t => {
        const dateStr = t.rawDate ? t.rawDate.replace('T', ' ').slice(0, 19) : new Date(t.date).toISOString().replace('T', ' ').slice(0, 19);
        const typeStr = t.type.charAt(0).toUpperCase() + t.type.slice(1);
        const toPayMode = t.toPaymentMode || '';
        csvContent += `${escapeCSVField(dateStr)},${t.amount},${escapeCSVField(t.category)},${escapeCSVField(t.paymentMode)},${escapeCSVField(typeStr)},${escapeCSVField(toPayMode)},${escapeCSVField(t.note || '')}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const filename = getTimestampedFilename('eledge_trans', 'csv');
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`CSV saved → Documents/ExpenLedge/CSV`);
    closeExportRangeSheet();
}

function triggerCSVImport() {
    document.getElementById('csv-import-file').click();
}

function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const lines = text.split('\n');
        if (lines.length <= 1) {
            showToast("Empty CSV file!");
            return;
        }

        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const dateIdx = headers.indexOf('Date');
        const amtIdx = headers.indexOf('Amount');

        let catIdx = headers.indexOf('Category');

        let pmIdx = headers.indexOf('Payment Mode');
        if (pmIdx === -1) pmIdx = headers.indexOf('Payment Method');

        const typeIdx = headers.indexOf('Type');
        const toPmIdx = headers.indexOf('To Payment Mode');

        let noteIdx = headers.indexOf('Note');
        if (noteIdx === -1) noteIdx = headers.indexOf('Description');

        const timeIdx = headers.indexOf('Time');

        if (dateIdx === -1 || amtIdx === -1) {
            showToast("Invalid CSV format! Date and Amount headers are required.");
            return;
        }

        let importCount = 0;
        const newTransactions = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Robust CSV line parser that handles quotes and preserves empty fields
            const row = [];
            let insideQuote = false;
            let entry = '';
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '"') {
                    if (insideQuote && line[j + 1] === '"') {
                        entry += '"';
                        j++;
                    } else {
                        insideQuote = !insideQuote;
                    }
                } else if (char === ',' && !insideQuote) {
                    row.push(entry.trim());
                    entry = '';
                } else {
                    entry += char;
                }
            }
            row.push(entry.trim());

            if (row.length <= Math.max(dateIdx, amtIdx)) continue;

            const baseDateStr = row[dateIdx];
            const timeStr = timeIdx !== -1 && timeIdx < row.length ? row[timeIdx] : '';
            const dateStr = timeStr ? `${baseDateStr} ${timeStr}` : baseDateStr;

            const rawAmtStr = row[amtIdx];
            const amount = Math.abs(parseFloat(rawAmtStr)) || 0;
            const category = catIdx !== -1 && catIdx < row.length && row[catIdx] ? row[catIdx] : 'Others';
            const paymentMode = pmIdx !== -1 && pmIdx < row.length && row[pmIdx] ? row[pmIdx] : 'Cash';
            const toPaymentMode = toPmIdx !== -1 && toPmIdx < row.length ? row[toPmIdx] : '';
            const note = noteIdx !== -1 && noteIdx < row.length && row[noteIdx] ? row[noteIdx] : category;

            // Determine transaction type
            let typeVal = 'expense';
            if (typeIdx !== -1 && typeIdx < row.length && row[typeIdx]) {
                typeVal = row[typeIdx].toLowerCase();
            } else {
                if (rawAmtStr.startsWith('-')) {
                    typeVal = 'expense';
                } else {
                    const catLower = category.toLowerCase();
                    const isIncomeCat = ['income', 'salary', 'freelance', 'rentals', 'sold items', 'other income'].includes(catLower) ||
                        incomeCategories.some(c => c.name.toLowerCase() === catLower);
                    typeVal = isIncomeCat ? 'income' : 'expense';
                }
            }

            let dateObj;
            if (dateStr) {
                // Try parsing directly first (browser natively parses M/D/YYYY H:MM:SS AM/PM)
                dateObj = new Date(dateStr.trim());

                if (isNaN(dateObj.getTime())) {
                    // Try replacing space with T for ISO format (if date has hyphens)
                    if (dateStr.includes('-')) {
                        const normalizedDateStr = dateStr.trim().replace(' ', 'T');
                        dateObj = new Date(normalizedDateStr);
                    }
                }

                if (isNaN(dateObj.getTime())) {
                    // Manual parser fallback
                    const parts = dateStr.trim().split(/\s+/);
                    const datePartsStr = parts[0];
                    const dateParts = datePartsStr.includes('/') ? datePartsStr.split('/') : datePartsStr.split('-');

                    if (dateParts.length === 3) {
                        let year, month, day;
                        const p0 = parseInt(dateParts[0], 10);
                        const p1 = parseInt(dateParts[1], 10);
                        const p2 = parseInt(dateParts[2], 10);

                        if (dateParts[0].length === 4) {
                            // YYYY-MM-DD or YYYY/MM/DD
                            year = p0;
                            month = p1 - 1;
                            day = p2;
                        } else if (dateParts[2].length === 4) {
                            year = p2;
                            // Determine if MM/DD/YYYY or DD/MM/YYYY
                            if (p0 > 12) {
                                // First number is day (e.g. 13/7/2026)
                                day = p0;
                                month = p1 - 1;
                            } else if (p1 > 12) {
                                // Second number is day (e.g. 7/13/2026)
                                month = p0 - 1;
                                day = p1;
                            } else {
                                // Ambiguous (<=12), default to MM/DD/YYYY for slash, DD-MM-YYYY for hyphen
                                if (datePartsStr.includes('/')) {
                                    month = p0 - 1;
                                    day = p1;
                                } else {
                                    day = p0;
                                    month = p1 - 1;
                                }
                            }
                        }

                        let hours = 0, minutes = 0, seconds = 0;
                        if (parts.length > 1) {
                            const timePart = parts[1];
                            const timeParts = timePart.split(':');
                            if (timeParts.length >= 2) {
                                hours = parseInt(timeParts[0], 10);
                                minutes = parseInt(timeParts[1], 10);
                                if (timeParts.length >= 3) {
                                    seconds = parseInt(timeParts[2], 10);
                                }
                            }

                            // Check for AM/PM in parts or timePart
                            let ampm = '';
                            if (parts.length > 2) {
                                ampm = parts[2].toUpperCase();
                            } else if (timePart.toUpperCase().includes('PM')) {
                                ampm = 'PM';
                            } else if (timePart.toUpperCase().includes('AM')) {
                                ampm = 'AM';
                            }

                            if (ampm === 'PM' && hours < 12) {
                                hours += 12;
                            } else if (ampm === 'AM' && hours === 12) {
                                hours = 0;
                            }
                        }
                        dateObj = new Date(year, month, day, hours, minutes, seconds);
                    }
                }
            } else {
                dateObj = new Date();
            }
            const validDate = !isNaN(dateObj.getTime()) ? dateObj : new Date();

            // Map category icon
            let matchedIcon = 'category';
            const catObj = expenseCategories.find(c => c.name.toLowerCase() === category.toLowerCase()) ||
                incomeCategories.find(c => c.name.toLowerCase() === category.toLowerCase());
            if (catObj) {
                matchedIcon = catObj.icon;
            }

            newTransactions.push({
                id: transactions.length + newTransactions.length + 1,
                syncId: generateTransactionSyncId(),
                amount: amount,
                rawDate: validDate.toISOString(),
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                date: getRelativeDateString(validDate),
                category: category,
                categoryIcon: matchedIcon,
                note: note,
                type: typeVal,
                paymentMode: paymentMode,
                toPaymentMode: toPaymentMode,
                tags: []
            });
            importCount++;
        }

        if (newTransactions.length > 0) {
            transactions = [...newTransactions, ...transactions];
            saveToLocalStorage();
            updateDashboard();
            updateAnalysis();
            updateAccounts();
            updateBudget();
            if (currentView === 'structured-tx') renderStructuredTx();
            showToast(`Imported ${importCount} transactions successfully!`);
        } else {
            showToast("No valid transactions found to import.");
        }
        closeExportDataSheet();
    };
    reader.readAsText(file);
    event.target.value = '';
}

function selectProfileAvatar(url, btn) {
    document.getElementById('profile-selected-avatar').value = url;
    const buttons = document.querySelectorAll('#profile-avatar-grid button');
    buttons.forEach(b => {
        b.className = "w-12 h-12 rounded-full overflow-hidden flex items-center justify-center p-1 bg-surface hover:bg-surface-container transition-all border border-transparent scale-90";
    });
    btn.className = "w-12 h-12 rounded-full overflow-hidden flex items-center justify-center p-1 bg-surface hover:bg-surface-container transition-all border-2 border-primary scale-110";
}

function openProfileSecuritySheet() {
    resetScroll('sheet-profile-security');
    document.getElementById('profile-input-name').value = userProfile.name;
    document.getElementById('profile-input-email').value = userProfile.email;
    document.getElementById('security-biometric-toggle').checked = false;

    // Sync Cash Wallet preference toggle
    const cashToggle = document.getElementById('pref-include-cash-toggle');
    if (cashToggle) cashToggle.checked = includeCashInBalance;

    const avatarVal = userProfile.avatar || 'bg-blue-500';
    document.getElementById('profile-selected-avatar').value = avatarVal;

    const buttons = document.querySelectorAll('#profile-avatar-grid button');
    buttons.forEach(btn => {
        const div = btn.querySelector('div');
        if (div && div.classList.contains(avatarVal)) {
            btn.className = "w-12 h-12 rounded-full overflow-hidden flex items-center justify-center p-1 bg-surface hover:bg-surface-container transition-all border-2 border-primary scale-110";
        } else {
            btn.className = "w-12 h-12 rounded-full overflow-hidden flex items-center justify-center p-1 bg-surface hover:bg-surface-container transition-all border border-transparent scale-90";
        }
    });

    document.getElementById('sheet-profile-security').classList.remove('translate-y-full');
    showBackdrop();
    setTimeout(() => { currentFormContext = { name: 'profile', snapshot: snapshotFormState('profile') }; }, 60);
}

function originalCloseProfileSecuritySheet() {
    document.getElementById('sheet-profile-security').classList.add('translate-y-full');
    checkBackdropNeeded();
}

// Intercept Profile closing
function closeProfileSecuritySheet() {
    handleFormClose('profile', originalCloseProfileSecuritySheet, saveProfileSecurity);
}

function toggleBiometricLock() {
    document.getElementById('security-biometric-toggle').checked = false;
    userProfile.biometricLock = false;
    saveToLocalStorage();
    showToast("Biometric lock is temporarily disabled");
}

function toggleIncludeCashInBalance() {
    // Determine which toggle was just changed (Accounts or Profile)
    const accToggle = document.getElementById('acc-include-cash-toggle');
    const profToggle = document.getElementById('pref-include-cash-toggle');
    // Use whichever exists as the source of truth
    if (accToggle && document.activeElement === accToggle) {
        includeCashInBalance = accToggle.checked;
    } else if (profToggle && document.activeElement === profToggle) {
        includeCashInBalance = profToggle.checked;
    } else {
        includeCashInBalance = accToggle ? accToggle.checked : (profToggle ? profToggle.checked : true);
    }
    // Sync both toggles to the same state
    if (accToggle) accToggle.checked = includeCashInBalance;
    if (profToggle) profToggle.checked = includeCashInBalance;
    saveToLocalStorage();
    renderAccountsList();
    updateDashboard();
    showToast(includeCashInBalance ? 'Cash Wallet included in balance' : 'Cash Wallet excluded from balance');
}

function saveProfileSecurity() {
    const newName = document.getElementById('profile-input-name').value.trim();
    const newEmail = document.getElementById('profile-input-email').value.trim();
    const newAvatar = document.getElementById('profile-selected-avatar').value;

    if (!newName || !newEmail) {
        showToast("Name and email cannot be empty");
        return;
    }

    userProfile.name = newName;
    userProfile.email = newEmail;
    userProfile.avatar = newAvatar;

    const nameDisplay = document.getElementById('profile-name-display');
    const emailDisplay = document.getElementById('profile-email-display');
    const dbName = document.getElementById('dashboard-user-name');
    const dbAvatar = document.getElementById('dashboard-user-avatar');
    const stAvatar = document.getElementById('settings-user-avatar');

    if (nameDisplay) nameDisplay.innerText = newName;
    if (emailDisplay) emailDisplay.innerText = newEmail;
    if (dbName) dbName.innerText = newName;
    if (dbAvatar) {
        dbAvatar.innerHTML = getAvatarHtml(newName, newAvatar);
    }
    if (stAvatar) {
        stAvatar.innerHTML = getAvatarHtml(newName, newAvatar);
    }

    saveToLocalStorage();
    showToast("Profile updated successfully!");
    currentFormContext = null;
    closeProfileSecuritySheet();
}

function openExportDataSheet() {
    resetScroll('sheet-export-data');
    document.getElementById('sheet-export-data').classList.remove('translate-y-full');
    showBackdrop();
}

function closeExportDataSheet() {
    document.getElementById('sheet-export-data').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function openBackupRestoreSheet() {
    resetScroll('sheet-backup-restore');
    document.getElementById('sheet-backup-restore').classList.remove('translate-y-full');
    applyBackupSheetPreferences();
    updateSupabaseSyncTime();
    setSupabaseStatus(supabaseClient ? 'Connected' : 'Not connected', !!supabaseClient, false);
    showBackdrop();
}

function closeBackupRestoreSheet() {
    document.getElementById('sheet-backup-restore').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function openSupabaseSyncSheet() {
    resetScroll('sheet-supabase-sync');
    document.getElementById('sheet-supabase-sync').classList.remove('translate-y-full');
    loadSupabaseCredentialsIntoForm();
    updateSupabaseSyncTime();
    setSupabaseStatus(supabaseClient ? 'Connected' : 'Not connected', !!supabaseClient, false);
    showBackdrop();
}

function closeSupabaseSyncSheet() {
    document.getElementById('sheet-supabase-sync').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function getTimestampedFilename(prefix, ext) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${prefix}_${year}_${month}_${day}_${hours}_${minutes}_${seconds}.${ext}`;
}

function downloadBackupFile() {
    const backupPayload = buildBackupPayload();
    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = getTimestampedFilename('eledge_backup', 'json');
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setLastBackupNow();
    const savePath = 'Documents/ExpenLedge/Backups';
    showToast(`Backup saved \u2192 ${savePath}`);
}

function runCloudBackup() {
    buildBackupPayload();
    setLastBackupNow();
    showToast("Cloud Backup Synchronized!");
}

let autoBackupInterval = null;
function toggleAutoBackup() {
    const isChecked = document.getElementById('backup-auto-toggle').checked;
    autoBackupEnabled = isChecked;
    saveToLocalStorage();
    if (isChecked) {
        showToast("Auto-save Backups enabled");
    } else {
        showToast("Auto-save Backups disabled");
    }
}

function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (restoreBackupPayload(imported)) {
                showToast("Backup restored successfully!");
                closeBackupRestoreSheet();
                setTimeout(() => location.reload(), 250);
            } else {
                showToast("Invalid backup file format.");
            }
        } catch (err) {
            showToast("Failed to parse backup file.");
        }
        const input = document.getElementById('import-file-input');
        if (input) input.value = '';
    };
    reader.readAsText(file);
}

function openEditBudgetSheet() {
    resetScroll('sheet-edit-budget');
    const labelEl = document.querySelector('#sheet-edit-budget label');
    const headerEl = document.querySelector('#sheet-edit-budget h3');

    if (activeBudgetTab === 'monthly') {
        if (headerEl) headerEl.innerText = "Total Monthly Limit";
        if (labelEl) labelEl.innerText = "Monthly Budget (₹)";
        document.getElementById('budget-input-limit').value = monthlyBudgetLimit;
    } else {
        if (headerEl) headerEl.innerText = "Total Yearly Limit";
        if (labelEl) labelEl.innerText = "Yearly Budget (₹)";
        document.getElementById('budget-input-limit').value = yearlyBudgetLimit;
    }

    document.getElementById('budget-cat-groceries').value = categoryBudgetLimits['Groceries'] || 0;
    document.getElementById('budget-cat-shopping').value = categoryBudgetLimits['Shopping'] || 0;
    document.getElementById('budget-cat-education').value = categoryBudgetLimits['Education'] || 0;
    document.getElementById('budget-cat-transport').value = categoryBudgetLimits['Transport'] || 0;
    document.getElementById('budget-cat-utilities').value = categoryBudgetLimits['Bills & Utilities'] || 0;
    document.getElementById('budget-cat-entertainment').value = categoryBudgetLimits['Entertainment'] || 0;
    document.getElementById('budget-cat-medical').value = categoryBudgetLimits['Medical'] || 0;
    document.getElementById('budget-cat-food').value = categoryBudgetLimits['Food and Dining'] || 0;

    const toggle = document.getElementById('budget-toggle-enabled');
    if (toggle) toggle.checked = budgetEnabled;
    toggleBudgetActiveState(budgetEnabled);

    document.getElementById('sheet-edit-budget').classList.remove('translate-y-full');
    showBackdrop();
    setTimeout(() => { currentFormContext = { name: 'budget', snapshot: snapshotFormState('budget') }; }, 60);
}

function originalCloseEditBudgetSheet() {
    document.getElementById('sheet-edit-budget').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function closeEditBudgetSheet() {
    handleFormClose('budget', originalCloseEditBudgetSheet, saveBudgetSettings);
}

function saveBudgetSettings() {
    if (!budgetEnabled) {
        saveToLocalStorage();
        currentFormContext = null;
        closeEditBudgetSheet();
        return;
    }
    const newLimit = parseFloat(document.getElementById('budget-input-limit').value);
    if (isNaN(newLimit) || newLimit <= 0) {
        showToast("Please enter a valid limit");
        return;
    }

    if (activeBudgetTab === 'monthly') {
        monthlyBudgetLimit = newLimit;
    } else {
        yearlyBudgetLimit = newLimit;
    }

    categoryBudgetLimits['Groceries'] = parseFloat(document.getElementById('budget-cat-groceries').value) || 0;
    categoryBudgetLimits['Shopping'] = parseFloat(document.getElementById('budget-cat-shopping').value) || 0;
    categoryBudgetLimits['Education'] = parseFloat(document.getElementById('budget-cat-education').value) || 0;
    categoryBudgetLimits['Transport'] = parseFloat(document.getElementById('budget-cat-transport').value) || 0;
    categoryBudgetLimits['Bills & Utilities'] = parseFloat(document.getElementById('budget-cat-utilities').value) || 0;
    categoryBudgetLimits['Entertainment'] = parseFloat(document.getElementById('budget-cat-entertainment').value) || 0;
    categoryBudgetLimits['Medical'] = parseFloat(document.getElementById('budget-cat-medical').value) || 0;
    categoryBudgetLimits['Food and Dining'] = parseFloat(document.getElementById('budget-cat-food').value) || 0;

    updateDashboard();
    updateBudget();
    saveToLocalStorage();

    showToast("Budgets updated successfully!");
    currentFormContext = null;
    closeEditBudgetSheet();
}

function toggleBudgetActiveState(enabled) {
    budgetEnabled = enabled;
    saveToLocalStorage();

    // Disable or enable inputs in edit sheet
    const inputs = [
        'budget-input-limit', 'budget-cat-groceries', 'budget-cat-shopping',
        'budget-cat-education', 'budget-cat-transport', 'budget-cat-utilities',
        'budget-cat-entertainment', 'budget-cat-medical', 'budget-cat-food'
    ];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = !enabled;
            if (!enabled) {
                el.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                el.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    });

    // Toggle widgets visibility
    const dashCard = document.getElementById('dashboard-budget-card');
    if (dashCard) {
        if (enabled) dashCard.classList.remove('hidden');
        else dashCard.classList.add('hidden');
    }
    const analysisCard = document.getElementById('analysis-budget-card');
    if (analysisCard) {
        if (enabled) analysisCard.classList.remove('hidden');
        else analysisCard.classList.add('hidden');
    }

    // Toggle Budget View contents
    const activeContent = document.getElementById('budget-active-content');
    const placeholder = document.getElementById('budget-disabled-placeholder');
    if (activeContent && placeholder) {
        if (enabled) {
            activeContent.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            activeContent.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }
    }
}

let detailedAccountId = null;
let detailedAccountFilter = 'all'; // 'all' | 'income' | 'expense'

function openAccountDetailsSheet(accountId) {
    resetScroll('sheet-account-details');
    detailedAccountId = accountId;
    detailedAccountFilter = 'all';

    // Reset tab styles
    updateAccountDetailsTabStyles();

    // Load and show details
    updateDetailedAccountView();

    document.getElementById('sheet-account-details').classList.remove('translate-y-full');
    showBackdrop();
}

function closeAccountDetailsSheet() {
    document.getElementById('sheet-account-details').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function editCurrentDetailedAccount() {
    if (!detailedAccountId) return;
    const id = detailedAccountId;
    closeAccountDetailsSheet();
    setTimeout(() => {
        openEditAccountSheet(id);
    }, 350);
}

function filterAccountDetailsTransactions(typeFilter) {
    detailedAccountFilter = typeFilter;
    updateAccountDetailsTabStyles();
    renderAccountDetailsTransactions();
}

function updateAccountDetailsTabStyles() {
    const tabs = {
        all: document.getElementById('acc-tx-tab-all'),
        income: document.getElementById('acc-tx-tab-income'),
        expense: document.getElementById('acc-tx-tab-expense')
    };

    const activeClass = "flex-1 py-1.5 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
    const inactiveClass = "flex-1 py-1.5 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container-high";

    for (const key in tabs) {
        if (tabs[key]) {
            if (key === detailedAccountFilter) {
                tabs[key].className = activeClass;
            } else {
                tabs[key].className = inactiveClass;
            }
        }
    }
}

function updateDetailedAccountView() {
    const acc = userAccounts.find(a => a.id === detailedAccountId);
    if (!acc) return;

    const typeLabels = { bank: 'BANK ACCOUNT', saving: 'SAVINGS ACCOUNT', card: 'CREDIT CARD', cash: 'CASH WALLET' };
    document.getElementById('acc-details-type-label').innerText = typeLabels[acc.type] || 'ACCOUNT';
    document.getElementById('acc-details-name').innerText = acc.name;
    document.getElementById('acc-details-holder').innerText = acc.holderName || 'No Holder Name';

    const balance = acc.currentBalance || 0;
    const balanceEl = document.getElementById('acc-details-balance');
    balanceEl.innerText = `₹${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (acc.type === 'card') {
        balanceEl.className = "text-headline-lg font-bold text-secondary";
    } else {
        balanceEl.className = "text-headline-lg font-bold text-primary";
    }

    // Sum total income and expense for this specific account
    let incomeSum = 0;
    let expenseSum = 0;
    transactions.forEach(t => {
        if (t.paymentMode === acc.name) {
            if (t.type === 'income') incomeSum += t.amount;
            else expenseSum += t.amount;
        } else if (!userAccounts.some(a => a.name === t.paymentMode)) {
            // Legacy fallbacks
            if (acc.type === 'card' && (t.paymentMode === 'Credit Card' || t.paymentMode === 'card')) {
                if (t.type === 'income') incomeSum += t.amount;
                else expenseSum += t.amount;
            } else if (acc.type === 'cash' && (t.paymentMode === 'Cash' || t.paymentMode === 'cash')) {
                if (t.type === 'income') incomeSum += t.amount;
                else expenseSum += t.amount;
            } else if (acc.type === 'bank' && acc.id === 'bank') {
                if (t.paymentMode !== 'Cash' && t.paymentMode !== 'cash' && t.paymentMode !== 'Credit Card' && t.paymentMode !== 'card') {
                    if (t.type === 'income') incomeSum += t.amount;
                    else expenseSum += t.amount;
                }
            }
        }
    });

    document.getElementById('acc-details-total-income').innerText = `+₹${incomeSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('acc-details-total-expense').innerText = `-₹${expenseSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    renderAccountDetailsTransactions();
}

function renderAccountDetailsTransactions(loadMore = false) {
    if (!loadMore) {
        accountDetailsTxRenderLimit = 50;
    }
    const acc = userAccounts.find(a => a.id === detailedAccountId);
    if (!acc) return;

    const container = document.getElementById('acc-details-tx-list');
    container.innerHTML = '';

    const filtered = transactions.filter(t => {
        const matchesAccount = t.paymentMode === acc.name || (
            !userAccounts.some(a => a.name === t.paymentMode) && (
                (acc.type === 'card' && (t.paymentMode === 'Credit Card' || t.paymentMode === 'card')) ||
                (acc.type === 'cash' && (t.paymentMode === 'Cash' || t.paymentMode === 'cash')) ||
                (acc.type === 'bank' && acc.id === 'bank' && t.paymentMode !== 'Cash' && t.paymentMode !== 'cash' && t.paymentMode !== 'Credit Card' && t.paymentMode !== 'card')
            )
        );

        if (!matchesAccount) return false;

        if (detailedAccountFilter === 'income') return t.type === 'income';
        if (detailedAccountFilter === 'expense') return t.type === 'expense';
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-center text-on-surface-variant py-md font-bold">No transactions found</p>`;
        return;
    }

    const totalMatching = filtered.length;
    const itemsToRender = filtered.slice(0, accountDetailsTxRenderLimit);

    itemsToRender.forEach(t => {
        const isInc = t.type === 'income';
        const card = document.createElement('div');
        card.className = "bg-surface-container p-md rounded-xl flex items-center gap-md hover:bg-surface-container-high transition-all cursor-pointer active:scale-[0.98]";

        card.onclick = () => {
            closeAccountDetailsSheet();
            setTimeout(() => {
                openEditTransactionModal(t);
            }, 350);
        };

        let colorClass = isInc ? "text-primary bg-primary-container/20" : "text-secondary bg-secondary-container/20";

        card.innerHTML = `
            <div class="w-12 h-12 rounded-full flex items-center justify-center ${colorClass}">
                <span class="material-symbols-outlined">${t.categoryIcon || 'payments'}</span>
            </div>
            <div class="flex-1">
                <div class="flex justify-between">
                    <p class="text-body-lg font-bold text-on-surface">${isInc ? '+' : '-'}₹${t.amount.toFixed(2)}</p>
                    <p class="text-label-md font-label-md text-on-surface-variant">${t.date}</p>
                </div>
                <div class="flex justify-between items-center">
                    <p class="text-body-md text-on-surface-variant">${t.note || t.category}</p>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    if (totalMatching > accountDetailsTxRenderLimit) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = "w-full py-md bg-surface-container hover:bg-surface-container-high text-primary font-bold rounded-xl shadow-sm border border-outline-variant/10 transition-colors my-md active:scale-[0.98]";
        loadMoreBtn.innerText = `Load More (${totalMatching - accountDetailsTxRenderLimit} remaining)`;
        loadMoreBtn.onclick = () => {
            accountDetailsTxRenderLimit += 50;
            renderAccountDetailsTransactions(true);
        };
        container.appendChild(loadMoreBtn);
    }
}

let currentEditingAccountId = null;

function openEditAccountSheet(accountId) {
    resetScroll('sheet-edit-account');
    currentEditingAccountId = accountId;
    const acc = userAccounts.find(a => a.id === accountId);
    if (!acc) return;

    document.getElementById('account-sheet-title').innerText = "Edit Account";
    document.getElementById('account-input-name').value = acc.name;
    document.getElementById('account-input-holder').value = acc.holderName || '';
    document.getElementById('account-input-type').value = acc.type;

    const typeLabels = { bank: 'Bank Accounts', saving: 'Savings', card: 'Credit Cards', cash: 'Cash' };
    document.getElementById('account-type-dropdown-value').innerText = typeLabels[acc.type] || 'Bank Accounts';

    document.getElementById('account-input-balance').value = acc.startingBalance;

    // Show delete button for custom accounts
    const deleteBtn = document.getElementById('account-delete-btn');
    if (deleteBtn) {
        if (userAccounts.length > 1) {
            deleteBtn.classList.remove('hidden');
        } else {
            deleteBtn.classList.add('hidden');
        }
    }

    document.getElementById('sheet-edit-account').classList.remove('translate-y-full');
    showBackdrop();
    setTimeout(() => { currentFormContext = { name: 'account', snapshot: snapshotFormState('account') }; }, 60);
}

function openAddAccountSheet() {
    resetScroll('sheet-edit-account');
    currentEditingAccountId = null;

    document.getElementById('account-sheet-title').innerText = "Add Account";
    document.getElementById('account-input-name').value = '';
    document.getElementById('account-input-holder').value = '';
    document.getElementById('account-input-type').value = 'bank';
    document.getElementById('account-type-dropdown-value').innerText = 'Bank Accounts';
    document.getElementById('account-input-balance').value = '';

    const deleteBtn = document.getElementById('account-delete-btn');
    if (deleteBtn) deleteBtn.classList.add('hidden');

    document.getElementById('sheet-edit-account').classList.remove('translate-y-full');
    showBackdrop();
    setTimeout(() => { currentFormContext = { name: 'account', snapshot: snapshotFormState('account') }; }, 60);
}

function toggleAccountTypeDropdown() {
    const dropdown = document.getElementById('account-type-dropdown-options');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function selectAccountType(type, label) {
    document.getElementById('account-input-type').value = type;
    document.getElementById('account-type-dropdown-value').innerText = label;
    const dropdown = document.getElementById('account-type-dropdown-options');
    if (dropdown) dropdown.classList.add('hidden');
}

function originalCloseEditAccountSheet() {
    document.getElementById('sheet-edit-account').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function closeEditAccountSheet() {
    handleFormClose('account', originalCloseEditAccountSheet, saveAccountBalance);
}

function saveAccountBalance() {
    const name = document.getElementById('account-input-name').value.trim();
    const holder = document.getElementById('account-input-holder').value.trim();
    const type = document.getElementById('account-input-type').value;
    const val = parseFloat(document.getElementById('account-input-balance').value) || 0;

    if (!name) {
        showToast("Please enter an account name");
        return;
    }

    if (currentEditingAccountId) {
        // Edit mode
        const acc = userAccounts.find(a => a.id === currentEditingAccountId);
        if (acc) {
            const oldName = acc.name;
            acc.name = name;
            acc.holderName = holder;
            acc.type = type;
            acc.startingBalance = val;

            if (oldName !== name) {
                transactions.forEach(t => {
                    if (t.paymentMode === oldName) {
                        t.paymentMode = name;
                    }
                });
            }
            showToast("Account updated successfully!");
        }
    } else {
        // Add mode
        const newAcc = {
            id: 'acc_' + Date.now(),
            name: name,
            holderName: holder,
            type: type,
            startingBalance: val
        };
        userAccounts.push(newAcc);
        showToast("Account added successfully!");
    }

    saveToLocalStorage();
    updateAccounts();
    updateDashboard();
    currentFormContext = null;
    closeEditAccountSheet();
    if (detailedAccountId === currentEditingAccountId) {
        setTimeout(() => {
            openAccountDetailsSheet(currentEditingAccountId);
        }, 400);
    }
}

function deleteAccount() {
    if (!currentEditingAccountId) return;
    openConfirmActionSheet("Delete Account", "Are you sure you want to delete this account? Transactions associated with this account will remain, but their balance allocation might change.", () => {
        const deletedId = currentEditingAccountId;
        userAccounts = userAccounts.filter(a => a.id !== deletedId);
        if (detailedAccountId === deletedId) {
            detailedAccountId = null;
            closeAccountDetailsSheet();
        }
        saveToLocalStorage();
        updateAccounts();
        updateDashboard();
        closeEditAccountSheet();
        showToast("Account deleted.");
    });
}

function performLogout() {
    closeProfileSecuritySheet();
    resetScroll('sheet-logout-confirm');
    const inputEl = document.getElementById('logout-verification-input');
    if (inputEl) inputEl.value = '';
    document.getElementById('sheet-logout-confirm').classList.remove('translate-y-full');
    showBackdrop();
}

function closeLogoutConfirmSheet() {
    document.getElementById('sheet-logout-confirm').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function submitLogoutConfirm() {
    const inputEl = document.getElementById('logout-verification-input');
    if (!inputEl || inputEl.value.trim() !== 'Clean') {
        showToast("Incorrect verification word");
        return;
    }
    localStorage.clear();
    location.reload();
}

let confirmActionCallback = null;

function openConfirmActionSheet(title, message, callback) {
    document.getElementById('confirm-sheet-title').innerText = title;
    document.getElementById('confirm-sheet-message').innerText = message;
    confirmActionCallback = callback;

    document.getElementById('sheet-confirm-action').classList.remove('translate-y-full');
    showBackdrop();
}

function closeConfirmActionSheet() {
    document.getElementById('sheet-confirm-action').classList.add('translate-y-full');
    checkBackdropNeeded();
}

// Bind confirmation callback button
window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('confirm-action-btn');
    if (btn) {
        btn.onclick = () => {
            if (confirmActionCallback) {
                confirmActionCallback();
            }
            closeConfirmActionSheet();
        };
    }
});

let selectedTransactionForOptions = null;
let longPressTriggered = false;
/**
 * Returns a badge HTML string for transactions not from a Cash Wallet account.
 * Shows the account name in a small styled pill.
 */
function getTxAccountBadge(t) {
    const isCash = t.paymentMode === 'Cash Wallet' || t.paymentMode === 'Cash' || t.paymentMode === 'cash' ||
        userAccounts.some(acc => acc.name === t.paymentMode && acc.type === 'cash');
    if (isCash) return '';
    const label = t.paymentMode || 'Other';
    const acc = userAccounts.find(a => a.name === t.paymentMode);
    const icon = acc?.type === 'card' ? 'credit_card' : acc?.type === 'bank' ? 'account_balance' : acc?.type === 'saving' ? 'savings' : 'account_balance_wallet';
    return `<span class="inline-flex items-center gap-[2px] px-[6px] py-[2px] rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 max-w-[90px] truncate leading-tight ml-1"><span class="material-symbols-outlined" style="font-size:10px">${icon}</span>${label}</span>`;
}

let longPressTimer = null;

function bindLongPress(card, t) {
    const start = (e) => {
        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            openTransactionOptionsSheet(t);
        }, 600);
    };

    const cancel = (e) => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    card.addEventListener('mousedown', start);
    card.addEventListener('touchstart', start, { passive: true });

    card.addEventListener('mouseup', cancel);
    card.addEventListener('touchend', cancel);
    card.addEventListener('mouseleave', cancel);
    card.addEventListener('touchmove', cancel);

    card.addEventListener('click', (e) => {
        if (longPressTriggered) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        showTransactionDetails(t);
    });
}

function openTransactionOptionsSheet(t) {
    selectedTransactionForOptions = t;

    const previewContainer = document.getElementById('options-entry-preview');
    const isInc = t.type === 'income';
    let colorClass = "text-secondary bg-secondary-container/20";
    if (isInc) colorClass = "text-primary bg-primary-container/20";

    previewContainer.innerHTML = `
        <div class="bg-surface-container p-md rounded-xl flex items-center gap-md border border-outline-variant/20">
            <div class="w-12 h-12 rounded-full flex items-center justify-center ${colorClass}">
                <span class="material-symbols-outlined">${t.categoryIcon || 'payments'}</span>
            </div>
            <div class="flex-1">
                <div class="flex justify-between">
                    <p class="text-body-lg font-bold text-on-surface">${isInc ? '+' : '-'}₹${t.amount.toFixed(2)}</p>
                    <p class="text-label-md font-label-md text-on-surface-variant">${t.date}</p>
                </div>
                <div class="flex justify-between items-center gap-sm">
                    <p class="text-body-md text-on-surface-variant break-words whitespace-normal">${t.note || t.category}</p>
                    <span class="flex-shrink-0">${getTxAccountBadge(t)}</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('sheet-transaction-options').classList.remove('translate-y-full');
    showBackdrop();
}

function closeTransactionOptionsSheet() {
    document.getElementById('sheet-transaction-options').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function duplicateSelectedTransaction() {
    if (!selectedTransactionForOptions) return;
    const copied = {
        ...selectedTransactionForOptions,
        id: transactions.length + 1,
        syncId: generateTransactionSyncId(),
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        date: 'Today'
    };
    transactions.unshift(copied);
    saveToLocalStorage();
    updateDashboard();
    updateAnalysis();
    updateAccounts();
    updateBudget();
    if (currentView === 'structured-tx') renderStructuredTx();
    showToast("Transaction duplicated!");
    closeTransactionOptionsSheet();
}

function deleteSelectedTransaction() {
    if (!selectedTransactionForOptions) return;
    const deleteKey = getTransactionSyncKey(selectedTransactionForOptions);
    if (deleteKey) {
        const tombstones = getDeletedTransactionLogSnapshot();
        const existing = tombstones.find(item => item.syncId === deleteKey);
        const now = new Date().toISOString();
        if (existing) {
            existing.deletedAt = now;
        } else {
            tombstones.push({ syncId: deleteKey, deletedAt: now, deletedBy: supabaseConfig.deviceId || 'local' });
        }
        saveDeletedTransactionLogSnapshot(tombstones);
    }
    transactions = transactions.filter(tx => getTransactionSyncKey(tx) !== getTransactionSyncKey(selectedTransactionForOptions));
    saveToLocalStorage();
    updateDashboard();
    updateAnalysis();
    updateAccounts();
    updateBudget();
    renderIncomeTransactions();
    renderSpendingTransactions();
    if (currentView === 'structured-tx') renderStructuredTx();
    showToast("Transaction deleted!");
    closeTransactionOptionsSheet();
}

function createScheduledTransaction() {
    if (!selectedTransactionForOptions) return;
    openScheduleTransactionSheet();
}

let selectedDayVal = 1;
let selectedMonthVal = 0;
let selectedYearVal = 2026;
let selectedHourVal = 0;
let selectedMinuteVal = 0;

function populateWheel(elementId, items, defaultValue, callback) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';

    const spacerTop = document.createElement('div');
    spacerTop.style.height = '40px';
    spacerTop.style.flexShrink = '0';
    container.appendChild(spacerTop);

    items.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = "h-[40px] flex items-center justify-center snap-center text-body-lg font-bold select-none text-on-surface-variant transition-all flex-shrink-0 cursor-pointer duration-200";
        el.innerText = typeof item === 'string' ? item : item.toString().padStart(2, '0');
        el.onclick = () => {
            container.scrollTo({ top: index * 40, behavior: 'smooth' });
        };
        container.appendChild(el);
    });

    const spacerBottom = document.createElement('div');
    spacerBottom.style.height = '40px';
    spacerBottom.style.flexShrink = '0';
    container.appendChild(spacerBottom);

    container.onscroll = () => {
        const scrollPos = container.scrollTop;
        const index = Math.round(scrollPos / 40);
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

        const children = container.querySelectorAll('div');
        children.forEach((child, i) => {
            if (i === clampedIndex + 1) {
                child.classList.add('text-primary', 'scale-110');
                child.classList.remove('text-on-surface-variant');
            } else {
                child.classList.remove('text-primary', 'scale-110');
                if (!child.style.height) {
                    child.classList.add('text-on-surface-variant');
                }
            }
        });

        callback(items[clampedIndex]);
    };

    const defIndex = items.indexOf(defaultValue);
    if (defIndex !== -1) {
        setTimeout(() => {
            container.scrollTop = defIndex * 40;
        }, 150);
    }
}

function openScheduleTransactionSheet() {
    const now = new Date();

    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const startYear = now.getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => startYear + i);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    selectedDayVal = now.getDate();
    selectedMonthVal = now.getMonth();
    selectedYearVal = now.getFullYear();
    selectedHourVal = now.getHours();
    selectedMinuteVal = now.getMinutes();

    populateWheel('wheel-day', days, selectedDayVal, (val) => { selectedDayVal = val; });
    populateWheel('wheel-month', monthNames, monthNames[selectedMonthVal], (val) => { selectedMonthVal = monthNames.indexOf(val); });
    populateWheel('wheel-year', years, selectedYearVal, (val) => { selectedYearVal = val; });
    populateWheel('wheel-hour', hours, selectedHourVal, (val) => { selectedHourVal = val; });
    populateWheel('wheel-minute', minutes, selectedMinuteVal, (val) => { selectedMinuteVal = val; });

    closeTransactionOptionsSheet();

    document.getElementById('sheet-schedule-transaction').classList.remove('translate-y-full');
    showBackdrop();
}

function closeScheduleTransactionSheet(saved = false) {
    document.getElementById('sheet-schedule-transaction').classList.add('translate-y-full');
    if (!saved && selectedTransactionForOptions) {
        openTransactionOptionsSheet(selectedTransactionForOptions);
    } else {
        checkBackdropNeeded();
    }
}

function confirmScheduleTransaction() {
    const targetDate = new Date(selectedYearVal, selectedMonthVal, selectedDayVal, selectedHourVal, selectedMinuteVal);
    const targetTime = targetDate.getTime();
    const now = new Date().getTime();

    if (isNaN(targetTime)) {
        showToast("Please select a valid date and time");
        return;
    }

    if (targetTime <= now) {
        showToast("Scheduled time must be in the future");
        return;
    }

    if (!selectedTransactionForOptions) return;

    const newScheduled = {
        id: Date.now(),
        scheduledTime: targetTime,
        transaction: {
            ...selectedTransactionForOptions,
            id: transactions.length + 1,
            syncId: generateTransactionSyncId(),
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            date: 'Today'
        }
    };

    scheduledTransactions.push(newScheduled);
    saveToLocalStorage();
    showToast("Transaction scheduled successfully!");
    closeScheduleTransactionSheet(true);
}

function checkScheduledTransactions() {
    const now = new Date().getTime();
    let executedAny = false;

    scheduledTransactions = scheduledTransactions.filter(item => {
        if (item.scheduledTime <= now) {
            transactions.unshift({
                ...item.transaction,
                syncId: item.transaction.syncId || generateTransactionSyncId(),
                updatedAt: new Date().toISOString(),
                createdAt: item.transaction.createdAt || new Date().toISOString()
            });
            showToast(`Auto-Executed Scheduled: ${item.transaction.category} (₹${item.transaction.amount})`);
            executedAny = true;
            return false;
        }
        return true;
    });

    if (executedAny) {
        saveToLocalStorage();
        updateDashboard();
        updateAnalysis();
        updateAccounts();
        updateBudget();
    }
}

let allTxTypeFilter = 'all';
let allTxSort = 'date-desc';
let allTxAccountFilter = 'all';
let allTxCategoryFilter = 'all';
let allTxTagFilter = 'all';

function hideCustomFilterDropdowns() {
    ['type', 'sort', 'account', 'category', 'tag'].forEach(type => {
        const dropdown = document.getElementById(`filter-${type}-dropdown`);
        if (dropdown) dropdown.classList.add('hidden');
    });
}

function positionCustomFilterDropdown(dropdown, button) {
    // Move the menu outside the sheet's scroll container so it cannot be clipped.
    document.body.appendChild(dropdown);

    const rect = button.getBoundingClientRect();
    const viewportPadding = 8;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const availableAbove = rect.top - viewportPadding;
    const openAbove = availableBelow < 160 && availableAbove > availableBelow;
    const maxHeight = Math.min(240, Math.max(120, openAbove ? availableAbove : availableBelow));
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);

    dropdown.style.position = 'fixed';
    dropdown.style.left = `${Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - width - viewportPadding))}px`;
    dropdown.style.top = `${openAbove ? Math.max(viewportPadding, rect.top - maxHeight - viewportPadding) : rect.bottom + viewportPadding}px`;
    dropdown.style.right = 'auto';
    dropdown.style.width = `${width}px`;
    dropdown.style.maxHeight = `${maxHeight}px`;
    dropdown.style.marginTop = '0';
    dropdown.style.zIndex = '250';
}

function toggleCustomFilterDropdown(type) {
    const list = ['type', 'sort', 'account', 'category', 'tag'];
    const dropdown = document.getElementById(`filter-${type}-dropdown`);
    const button = document.getElementById(`filter-${type}-btn`);
    if (!dropdown || !button) return;

    const shouldOpen = dropdown.classList.contains('hidden');
    hideCustomFilterDropdowns();
    if (!shouldOpen) return;

    dropdown.classList.remove('hidden');
    positionCustomFilterDropdown(dropdown, button);
}

function setCustomFilterType(val) {
    allTxTypeFilter = val;
    const labelMap = { all: "All Types", expense: "Expenses", income: "Income" };
    document.getElementById('filter-type-label').innerText = labelMap[val];
    document.getElementById('filter-type-dropdown').classList.add('hidden');
    updateAllTransactionsView();
}

function setCustomSort(val) {
    allTxSort = val;
    const labelMap = {
        'date-desc': "Newest First",
        'date-asc': "Oldest First",
        'amount-desc': "Highest Amount",
        'amount-asc': "Lowest Amount"
    };
    document.getElementById('filter-sort-label').innerText = labelMap[val];
    document.getElementById('filter-sort-dropdown').classList.add('hidden');
    saveInterfacePreferences();
    updateAllTransactionsView();
}

function setCustomFilterAccount(val) {
    allTxAccountFilter = val;
    document.getElementById('filter-account-label').innerText = val === 'all' ? "All Accounts" : val;
    document.getElementById('filter-account-dropdown').classList.add('hidden');
    updateAllTransactionsView();
}

function setCustomFilterCategory(val) {
    allTxCategoryFilter = val;
    document.getElementById('filter-category-label').innerText = val === 'all' ? "All Categories" : val;
    document.getElementById('filter-category-dropdown').classList.add('hidden');
    updateAllTransactionsView();
}

function setCustomFilterTag(val) {
    allTxTagFilter = val;
    document.getElementById('filter-tag-label').innerText = val === 'all' ? "All Tags" : (val.startsWith('#') ? val : '#' + val);
    document.getElementById('filter-tag-dropdown').classList.add('hidden');
    updateAllTransactionsView();
}

function renderAllTxFilters() {
    // 1. Account Dropdown
    const accDropdown = document.getElementById('filter-account-dropdown');
    if (accDropdown) {
        let html = `
            <div class="py-1">
                <button class="w-full text-left px-3 py-1.5 hover:bg-surface-container-high text-body-md text-on-surface font-semibold" onclick="setCustomFilterAccount('all')">All Accounts</button>
        `;
        userAccounts.forEach(acc => {
            html += `<button class="w-full text-left px-3 py-1.5 hover:bg-surface-container-high text-body-md text-on-surface" onclick="setCustomFilterAccount('${acc.name}')">${acc.name}</button>`;
        });
        html += `</div>`;
        accDropdown.innerHTML = html;
    }

    // 2. Category Dropdown
    const catDropdown = document.getElementById('filter-category-dropdown');
    if (catDropdown) {
        const expCats = expenseCategories.map(c => c.name);
        const incCats = incomeCategories.map(c => c.name);
        let html = `
            <div class="py-1">
                <button class="w-full text-left px-3 py-1.5 hover:bg-surface-container-high text-body-md text-on-surface font-bold" onclick="setCustomFilterCategory('all')">All Categories</button>
                <div class="px-3 py-1 text-[10px] font-bold text-secondary uppercase tracking-wider bg-secondary-container/10">Expense Categories</div>
        `;
        expCats.forEach(cat => {
            html += `<button class="w-full text-left px-3 py-1.5 hover:bg-surface-container-high text-body-md text-on-surface" onclick="setCustomFilterCategory('${cat}')">${cat}</button>`;
        });

        html += `
                <div class="border-t border-outline-variant/30 my-1"></div>
                <div class="px-3 py-1 text-[10px] font-bold text-primary uppercase tracking-wider bg-primary-container/10">Income Categories</div>
        `;
        incCats.forEach(cat => {
            html += `<button class="w-full text-left px-3 py-1.5 hover:bg-surface-container-high text-body-md text-on-surface" onclick="setCustomFilterCategory('${cat}')">${cat}</button>`;
        });
        html += `</div>`;
        catDropdown.innerHTML = html;
    }

    // 3. Tag Dropdown
    const tagDropdown = document.getElementById('filter-tag-dropdown');
    if (tagDropdown) {
        const tags = getAllTags();
        let html = `
            <div class="py-1">
                <button class="w-full text-left px-3 py-1.5 hover:bg-surface-container-high text-body-md text-on-surface font-semibold" onclick="setCustomFilterTag('all')">All Tags</button>
        `;
        tags.forEach(tag => {
            html += `<button class="w-full text-left px-3 py-1.5 hover:bg-surface-container-high text-body-md text-on-surface" onclick="setCustomFilterTag('${tag}')">#${tag}</button>`;
        });
        html += `</div>`;
        tagDropdown.innerHTML = html;
    }
}

window.addEventListener('click', (e) => {
    if (!e || !e.target) return;

    // Dashboard Timeframe Filter
    const btn = document.getElementById('dashboard-filter-btn');
    const dropdown = document.getElementById('dashboard-filter-dropdown');
    if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }

    // Account category type custom dropdown
    const typeDropdownContainer = document.getElementById('account-type-dropdown-container');
    const typeDropdownOptions = document.getElementById('account-type-dropdown-options');
    if (typeDropdownContainer && typeDropdownOptions && !typeDropdownContainer.contains(e.target)) {
        typeDropdownOptions.classList.add('hidden');
    }

    // All Transactions View Filters
    const filterTypes = ['type', 'sort', 'account', 'category', 'tag'];
    filterTypes.forEach(ft => {
        const btn = document.getElementById(`filter-${ft}-btn`);
        const dropdown = document.getElementById(`filter-${ft}-dropdown`);
        if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
});

let searchTimeout;
function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        updateAllTransactionsView(false);
    }, 300);
}

function openAdvancedSearchSheet() {
    renderAllTxFilters();
    document.getElementById('sheet-advanced-search').classList.remove('translate-y-full');
    showBackdrop();
}

function closeAdvancedSearchSheet() {
    hideCustomFilterDropdowns();
    document.getElementById('sheet-advanced-search').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function onChartTapped() {
    // 1. Identify filter based on Income or Spending
    // analysisCatType is 'spending' (expense) or 'income' (income)
    structuredTypeFilter = (analysisCatType === 'spending') ? 'expense' : 'income';

    // 2. Identify the selected period and set it on the structured view
    if (analysisPeriod === 'week') {
        // Week maps to custom date range
        structuredTxMode = 'custom';
        const fromDate = new Date(analysisWeekStart);
        const toDate = new Date(fromDate);
        toDate.setDate(toDate.getDate() + 6);

        const fromEl = document.getElementById('structured-date-from');
        const toEl = document.getElementById('structured-date-to');
        if (fromEl) fromEl.value = fromDate.toISOString().slice(0, 10);
        if (toEl) toEl.value = toDate.toISOString().slice(0, 10);
    } else if (analysisPeriod === 'month') {
        // Month maps to month mode
        structuredTxMode = 'month';
        structuredSelectedDate = new Date(analysisYear, analysisMonth, 1);
    } else if (analysisPeriod === 'year') {
        // Year maps to custom range for that entire year
        structuredTxMode = 'custom';
        const fromDate = new Date(analysisYear, 0, 1);
        const toDate = new Date(analysisYear, 11, 31);

        const fromEl = document.getElementById('structured-date-from');
        const toEl = document.getElementById('structured-date-to');
        if (fromEl) fromEl.value = fromDate.toISOString().slice(0, 10);
        if (toEl) toEl.value = toDate.toISOString().slice(0, 10);
    } else if (analysisPeriod === 'custom') {
        // Custom maps to custom
        structuredTxMode = 'custom';
        const analysisFrom = document.getElementById('analysis-custom-from');
        const analysisTo = document.getElementById('analysis-custom-to');
        const fromEl = document.getElementById('structured-date-from');
        const toEl = document.getElementById('structured-date-to');
        if (analysisFrom && fromEl) fromEl.value = analysisFrom.value;
        if (analysisTo && toEl) toEl.value = analysisTo.value;
    }

    // 3. Update title/subtitles for structured-tx view based on the mode
    const titleEl = document.getElementById('structured-tx-title');
    const subtitleEl = document.getElementById('structured-tx-subtitle');

    if (structuredTxMode === 'month') {
        if (titleEl) titleEl.innerText = "Month-wise";
        if (subtitleEl) subtitleEl.innerText = "All transactions grouped by month";
    } else {
        if (titleEl) titleEl.innerText = "Custom Range";
        if (subtitleEl) subtitleEl.innerText = "Transactions in a specific range";
    }

    // Update the Spent/Income cards UI
    updateStructuredFilterUI();

    // Clear search input on structured view
    const searchInput = document.getElementById('structured-search-input');
    if (searchInput) searchInput.value = '';

    // 4. Switch to view-structured-tx
    switchView('structured-tx');
}

function updateAllTransactionsView(loadMore = false) {
    if (!loadMore) {
        allTxRenderLimit = 50;
    }
    renderAllTxFilters();

    const searchVal = document.getElementById('all-tx-search').value;
    const typeFilter = allTxTypeFilter;
    const sortVal = allTxSort;
    const accountFilter = allTxAccountFilter;
    const categoryFilter = allTxCategoryFilter;
    const tagFilter = allTxTagFilter;

    let filtered = [...transactions];

    // 1. Apply Search
    if (searchVal) {
        filtered = filtered.filter(t => matchTransaction(t, searchVal));
    }

    // 2. Apply Type Filter
    if (typeFilter !== 'all') {
        filtered = filtered.filter(t => t.type === typeFilter);
    }

    // 3. Apply Account Filter
    if (accountFilter !== 'all') {
        filtered = filtered.filter(t => t.paymentMode === accountFilter);
    }

    // 4. Apply Category Filter
    if (categoryFilter !== 'all') {
        filtered = filtered.filter(t => t.category === categoryFilter);
    }

    // 5. Apply Tag Filter
    if (tagFilter !== 'all') {
        filtered = filtered.filter(t => t.tags && t.tags.includes(tagFilter));
    }

    const getTransactionDateValue = (t) => {
        const d = getTransactionDate(t);
        return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    };

    // 3. Apply Sort
    if (sortVal === 'date-desc') {
        filtered.sort((a, b) => getTransactionDateValue(b) - getTransactionDateValue(a));
    } else if (sortVal === 'date-asc') {
        filtered.sort((a, b) => getTransactionDateValue(a) - getTransactionDateValue(b));
    } else if (sortVal === 'amount-desc') {
        filtered.sort((a, b) => b.amount - a.amount);
    } else if (sortVal === 'amount-asc') {
        filtered.sort((a, b) => a.amount - b.amount);
    }

    const totalMatching = filtered.length;
    const itemsToRender = filtered.slice(0, allTxRenderLimit);

    // 4. Group by actual day
    const groups = new Map();
    itemsToRender.forEach(t => {
        const txDate = getTransactionDate(t);
        const safeDate = Number.isNaN(txDate.getTime()) ? new Date() : txDate;
        const groupName = safeDate.toISOString().slice(0, 10);
        if (!groups.has(groupName)) {
            groups.set(groupName, { date: safeDate, items: [] });
        }
        groups.get(groupName).items.push(t);
    });

    const container = document.getElementById('all-transactions-grouped-container');
    container.innerHTML = '';

    if (totalMatching === 0) {
        container.innerHTML = `<p class="text-center text-on-surface-variant py-lg">No transactions found matching your filters</p>`;
        return;
    }

    [...groups.entries()]
        .sort((a, b) => b[1].date.getTime() - a[1].date.getTime())
        .forEach(([groupKey, group]) => {
            const groupCard = document.createElement('div');
            groupCard.className = "bg-surface-container p-md rounded-xl border border-outline-variant/10 space-y-md";

            // Calculate daily totals for badges
            let dayIn = 0;
            let dayOut = 0;
            group.items.forEach(t => {
                if (t.type === 'income') dayIn += t.amount;
                else dayOut += t.amount;
            });
            const dayBalance = dayIn - dayOut;
            const day = getRelativeDateString(group.date);
            const safeDayId = groupKey.replace(/[^a-zA-Z0-9]/g, '-');
            groupCard.innerHTML = `
            <div class="border-b border-outline-variant/10 pb-xs flex justify-between items-center flex-wrap gap-xs">
                <span class="text-label-md font-bold text-primary uppercase tracking-wider">${day}</span>
                <div class="flex flex-wrap gap-xs text-[10px] font-semibold">
                    <span class="bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">Out: ₹${dayOut.toFixed(2)}</span>
                    <span class="bg-primary/10 text-primary px-2 py-0.5 rounded-full">In: ₹${dayIn.toFixed(2)}</span>
                    <span class="px-2 py-0.5 rounded-full ${dayBalance >= 0 ? 'bg-primary/15 text-primary' : 'bg-secondary/15 text-secondary'}">Bal: ${dayBalance >= 0 ? '+' : '-'}₹${Math.abs(dayBalance).toFixed(2)}</span>
                </div>
            </div>
            <div class="space-y-sm" id="group-list-${safeDayId}">
            </div>
        `;

            container.appendChild(groupCard);

            const listContainer = groupCard.querySelector(`#group-list-${safeDayId}`);
            group.items.forEach(t => {
                const isInc = t.type === 'income';
                const itemEl = document.createElement('div');
                itemEl.className = "p-sm rounded-lg flex items-center gap-md hover:bg-surface-container-high transition-all cursor-pointer active:scale-[0.98]";
                bindLongPress(itemEl, t);

                let colorClass = "text-secondary bg-secondary-container/20";
                if (isInc) colorClass = "text-primary bg-primary-container/20";

                itemEl.innerHTML = `
                <div class="w-10 h-10 rounded-full flex items-center justify-center ${colorClass}">
                    <span class="material-symbols-outlined text-[20px]">${t.categoryIcon || 'payments'}</span>
                </div>
                <div class="flex-1">
                    <div class="flex justify-between items-center">
                        <p class="text-body-md font-bold text-on-surface">${isInc ? '+' : '-'}₹${t.amount.toFixed(2)}</p>
                        <span class="flex-shrink-0">${getTxAccountBadge(t)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <p class="text-label-md text-on-surface-variant">${t.note || t.category}</p>
                    </div>
                </div>
            `;
                // Add click to edit
                itemEl.onclick = (e) => {
                    if (longPressTriggered) return;
                    openEditTransactionModal(t);
                };
                listContainer.appendChild(itemEl);
            });
        });

    if (totalMatching > allTxRenderLimit) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = "w-full py-md bg-surface-container hover:bg-surface-container-high text-primary font-bold rounded-xl shadow-sm border border-outline-variant/10 transition-colors my-md active:scale-[0.98]";
        loadMoreBtn.innerText = `Load More (${totalMatching - allTxRenderLimit} remaining)`;
        loadMoreBtn.onclick = () => {
            allTxRenderLimit += 50;
            updateAllTransactionsView(true);
        };
        container.appendChild(loadMoreBtn);
    }
}

function openSearchOnTransactionsPage() {
    closeDashboardSearch(false);
    switchView('transactions-all');
    setTimeout(() => {
        const searchInput = document.getElementById('all-tx-search');
        if (searchInput) {
            searchInput.focus();
        }
    }, 150);
}

function deleteCurrentEditingTransaction() {
    if (editingTransactionId !== null) {
        openConfirmActionSheet("Delete Transaction", "Are you sure you want to delete this transaction?", () => {
            transactions = transactions.filter(tx => tx.id !== editingTransactionId);
            saveToLocalStorage();
            syncAllViews();
            closeAddTransactionModal();
            showToast("Transaction deleted successfully");
        });
    } else {
        closeAddTransactionModal();
    }
}

function updateTxDatePickerLabel() {
    const d = selectedTxDateObj;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const str = `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;

    const label = document.getElementById('tx-selected-datetime');
    if (label) label.innerText = str;

    const dtInput = document.getElementById('tx-input-datetime');
    if (dtInput) {
        const tzoffset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
        dtInput.value = localISOTime;
    }
}

function getRelativeDateString(d) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (checkDate.getTime() === today.getTime()) {
        return 'Today';
    } else if (checkDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    } else {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = String(d.getDate()).padStart(2, '0');
        const month = months[d.getMonth()];
        const year = String(d.getFullYear()).slice(-2);
        return `${day} ${month} ${year}`;
    }
}

function getTransactionDate(t) {
    if (!t) return new Date();
    if (t.rawDate) {
        return new Date(t.rawDate);
    }
    return parseTxDate(t.date);
}

function parseTxDate(dateStr) {
    if (!dateStr || dateStr === 'Today') return new Date();
    if (dateStr === 'Yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
    }
    if (dateStr === 'Day before yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 2);
        return d;
    }
    const parts = dateStr.split(' ');
    if (parts.length === 3) {
        const monthAbbrs = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dVal = parseInt(parts[0]);
        const mIdx = monthAbbrs.indexOf(parts[1]);
        let yVal = parseInt(parts[2]);
        if (yVal < 100) yVal += 2000;
        if (!isNaN(dVal) && mIdx !== -1 && !isNaN(yVal)) {
            return new Date(yVal, mIdx, dVal, 12, 0);
        }
    }
    return new Date();
}

let budgetPeriod = 'monthly';

function setBudgetPeriod(period) {
    budgetPeriod = period;
    const btnMonthly = document.getElementById('toggle-budget-monthly');
    const btnYearly = document.getElementById('toggle-budget-yearly');
    const titleEl = document.getElementById('budget-card-title');

    const abtnMonthly = document.getElementById('analysis-toggle-budget-monthly');
    const abtnYearly = document.getElementById('analysis-toggle-budget-yearly');
    const atitleEl = document.getElementById('analysis-budget-card-title');

    const activeCls = "px-md py-xs rounded-full text-label-lg font-bold transition-all bg-primary text-on-primary shadow-sm";
    const inactiveCls = "px-md py-xs rounded-full text-label-lg font-bold transition-all text-on-surface-variant hover:text-on-surface";

    if (period === 'monthly') {
        if (btnMonthly) btnMonthly.className = activeCls;
        if (btnYearly) btnYearly.className = inactiveCls;
        if (titleEl) titleEl.innerText = "Monthly budget";

        if (abtnMonthly) abtnMonthly.className = activeCls;
        if (abtnYearly) abtnYearly.className = inactiveCls;
        if (atitleEl) atitleEl.innerText = "Monthly budget";
    } else {
        if (btnYearly) btnYearly.className = activeCls;
        if (btnMonthly) btnMonthly.className = inactiveCls;
        if (titleEl) titleEl.innerText = "Yearly budget";

        if (abtnYearly) abtnYearly.className = activeCls;
        if (abtnMonthly) abtnMonthly.className = inactiveCls;
        if (atitleEl) atitleEl.innerText = "Yearly budget";
    }

    updateDashboard();
    saveInterfacePreferences();
}

let activeBudgetTab = 'monthly';
let yearlyBudgetLimit = 0;

function switchBudgetViewTab(tab) {
    activeBudgetTab = tab;
    const btnMonthly = document.getElementById('btn-budget-tab-monthly');
    const btnYearly = document.getElementById('btn-budget-tab-yearly');

    if (tab === 'monthly') {
        btnMonthly.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
        btnYearly.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container-high";
    } else {
        btnYearly.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
        btnMonthly.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container-high";
    }

    updateBudget();
}

function openNetBalancesSheet() {
    let periodIncome = 0;
    let periodExpense = 0;
    transactions.forEach(t => {
        if (transactionBelongsToFilter(t)) {
            if (t.type === 'income') periodIncome += t.amount;
            else periodExpense += t.amount;
        }
    });
    const periodNet = periodIncome - periodExpense;

    let periodLabel = "For this month";
    if (dashboardFilter === 'month') {
        periodLabel = `For ${monthNames[currentMonth]} ${currentYear}`;
    } else if (dashboardFilter === 'year') {
        periodLabel = `For the year ${currentYear}`;
    } else {
        periodLabel = "For all time";
    }
    const lbl = document.getElementById('net-balance-period-label');
    if (lbl) lbl.innerText = periodLabel;

    let totalAssets = 0;
    let totalLiabilities = 0;
    userAccounts.forEach(acc => {
        if (acc.type !== 'cash') return;
        let bal = acc.startingBalance;
        transactions.forEach(t => {
            if (t.paymentMode === acc.name) {
                if (acc.type === 'card') {
                    if (t.type === 'expense') bal += t.amount;
                    else bal -= t.amount;
                } else {
                    if (t.type === 'expense') bal -= t.amount;
                    else bal += t.amount;
                }
            } else if (!userAccounts.some(a => a.name === t.paymentMode)) {
                // Legacy fallback mapping
                if (acc.type === 'card' && (t.paymentMode === 'Credit Card' || t.paymentMode === 'card')) {
                    if (t.type === 'expense') bal += t.amount;
                    else bal -= t.amount;
                } else if (acc.type === 'cash' && (t.paymentMode === 'Cash' || t.paymentMode === 'cash')) {
                    if (t.type === 'expense') bal -= t.amount;
                    else bal += t.amount;
                } else if (acc.type === 'bank' && acc.id === 'bank') {
                    if (t.paymentMode !== 'Cash' && t.paymentMode !== 'cash' && t.paymentMode !== 'Credit Card' && t.paymentMode !== 'card') {
                        if (t.type === 'expense') bal -= t.amount;
                        else bal += t.amount;
                    }
                }
            }
        });
        if (acc.type === 'card') {
            totalLiabilities += bal;
        } else {
            totalAssets += bal;
        }
    });
    const carryForward = totalAssets - totalLiabilities;

    let allTimeIncome = 0;
    let allTimeExpense = 0;
    transactions.forEach(t => {
        if (t.type === 'income') allTimeIncome += t.amount;
        else allTimeExpense += t.amount;
    });
    const allTimeNet = allTimeIncome - allTimeExpense;

    renderNetVal('net-balance-period', periodNet);
    renderNetVal('net-balance-carry', carryForward);
    renderNetVal('net-balance-alltime', allTimeNet);

    // Sync checkmark indicators
    const ticks = {
        period: document.getElementById('tick-balance-period'),
        carry: document.getElementById('tick-balance-carry'),
        alltime: document.getElementById('tick-balance-alltime')
    };
    for (const key in ticks) {
        if (ticks[key]) {
            ticks[key].classList.toggle('invisible', activeDashboardBalanceType !== key);
        }
    }

    document.getElementById('sheet-net-balances').classList.remove('translate-y-full');
    showBackdrop();
}

function renderNetVal(elementId, val) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const sign = val >= 0 ? '+' : '-';
    el.innerText = `${sign}₹${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (val >= 0) {
        el.className = "text-headline-md font-headline-md text-primary font-bold";
    } else {
        el.className = "text-headline-md font-headline-md text-secondary font-bold";
    }
}

function closeNetBalancesSheet() {
    document.getElementById('sheet-net-balances').classList.add('translate-y-full');
    checkBackdropNeeded();
}

let activeDashboardBalanceType = 'carry';

function selectDashboardBalanceType(type) {
    activeDashboardBalanceType = type;
    saveToLocalStorage();

    const ticks = {
        period: document.getElementById('tick-balance-period'),
        carry: document.getElementById('tick-balance-carry'),
        alltime: document.getElementById('tick-balance-alltime')
    };
    for (const key in ticks) {
        if (ticks[key]) {
            ticks[key].classList.toggle('invisible', key !== type);
        }
    }

    updateDashboard();
}

let manageCatTab = 'spending';
let selectedManageIcon = 'category';
let manageCategoryLayout = 'grid';
let manageCategoryDragIndex = null;
let manageCategoryPointerIndex = null;
let categoryPendingDeletion = null;
let deleteCategoryDestination = null;

function openManageCategoriesSheet(startTab = 'spending') {
    selectedManageIcon = 'category';
    const previewIcon = document.getElementById('mgcat-selected-icon-name');
    if (previewIcon) previewIcon.innerText = selectedManageIcon;

    const nameInput = document.getElementById('mgcat-new-name');
    if (nameInput) nameInput.value = '';

    setManageCatTab(startTab);
    syncManageCategoryLayoutUI();
    renderManageIconGrid();
    document.getElementById('sheet-manage-categories').classList.remove('translate-y-full');
    showBackdrop();
}

function closeManageCategoriesSheet() {
    document.getElementById('sheet-manage-categories').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function openAddCategorySheet() {
    selectedManageIcon = 'category';
    const nameInput = document.getElementById('mgcat-new-name');
    const iconPreview = document.getElementById('mgcat-selected-icon-name');
    if (nameInput) nameInput.value = '';
    if (iconPreview) iconPreview.innerText = selectedManageIcon;
    renderManageIconGrid();
    document.getElementById('sheet-add-category').classList.remove('translate-y-full');
    showBackdrop();
    setTimeout(() => { currentFormContext = { name: 'category', snapshot: snapshotFormState('category') }; }, 60);
}

function originalCloseAddCategorySheet() {
    document.getElementById('sheet-add-category').classList.add('translate-y-full');
    checkBackdropNeeded();
    renderManagedCategories();
}

function closeAddCategorySheet() {
    handleFormClose('category', originalCloseAddCategorySheet, addNewManagedCategory);
}

function openManageCategoriesFromTx() {
    const isExpense = document.getElementById('tx-type-expense').classList.contains('bg-primary');
    const tabType = isExpense ? 'spending' : 'income';
    openManageCategoriesSheet(tabType);
}

function setManageCatTab(tab) {
    manageCatTab = tab;
    const btnSpend = document.getElementById('mgcat-pill-spending');
    const btnInc = document.getElementById('mgcat-pill-income');
    if (tab === 'spending') {
        if (btnSpend) btnSpend.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
        if (btnInc) btnInc.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant";
    } else {
        if (btnInc) btnInc.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
        if (btnSpend) btnSpend.className = "flex-1 py-2 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant";
    }
    renderManagedCategories();
}

function syncManageCategoryLayoutUI() {
    const gridButton = document.getElementById('mgcat-layout-grid');
    const listButton = document.getElementById('mgcat-layout-list');
    const activeClass = 'p-1 rounded-full bg-primary text-on-primary shadow-sm flex items-center justify-center transition-all duration-150';
    const inactiveClass = 'p-1 rounded-full text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all duration-150';

    if (gridButton) gridButton.className = manageCategoryLayout === 'grid' ? activeClass : inactiveClass;
    if (listButton) listButton.className = manageCategoryLayout === 'list' ? activeClass : inactiveClass;
}

function setManageCategoryLayout(layout) {
    manageCategoryLayout = layout === 'list' ? 'list' : 'grid';
    saveInterfacePreferences();
    syncManageCategoryLayoutUI();
    renderManagedCategories();
}

function moveManagedCategory(fromIndex, toIndex) {
    const list = manageCatTab === 'spending' ? expenseCategories : incomeCategories;
    if (fromIndex === toIndex || fromIndex === null || toIndex === null || !list[fromIndex] || !list[toIndex]) return;

    const [category] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, category);
    saveCategoryOrders();
    renderManagedCategories();
}

function renderManagedCategories() {
    const list = manageCatTab === 'spending' ? expenseCategories : incomeCategories;
    const container = document.getElementById('mgcat-list');
    if (!container) return;
    container.innerHTML = '';
    container.className = manageCategoryLayout === 'grid'
        ? 'grid grid-cols-4 gap-2'
        : 'space-y-xs';

    list.forEach((cat, index) => {
        const item = document.createElement('div');
        item.dataset.categoryIndex = index;

        if (manageCategoryLayout === 'grid') {
            item.className = "relative flex flex-col items-center p-xs bg-surface-container-high rounded-xl border border-outline-variant/30 cursor-grab active:cursor-grabbing w-full overflow-hidden text-center gap-xs";
            item.innerHTML = `
                <div class="flex justify-between items-center w-full px-1 text-[10px] text-on-surface-variant flex-shrink-0">
                    <span class="material-symbols-outlined text-[14px] touch-none cursor-move" data-drag-handle title="Drag to reorder">drag_indicator</span>
                    ${cat.builtIn
                    ? '<span class="text-[9px] text-on-surface-variant opacity-60">Built-in</span>'
                    : `<button class="material-symbols-outlined text-error hover:bg-error-container/20 text-[14px] p-0.5 rounded-full" aria-label="Delete ${cat.name}" onclick="requestDeleteManagedCategory(${index}); event.stopPropagation();">delete</button>`}
                </div>
                <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-[20px]">${cat.icon}</span>
                </div>
                <span class="text-[10px] font-semibold text-on-surface truncate w-full px-0.5" title="${cat.name}">${cat.name}</span>
            `;
        } else {
            item.className = "flex items-center justify-between p-xs bg-surface-container-high rounded-xl border border-outline-variant/30 cursor-grab active:cursor-grabbing gap-sm";
            item.innerHTML = `
                <div class="flex items-center gap-xs min-w-0 flex-1">
                    <span class="material-symbols-outlined text-on-surface-variant text-[18px] touch-none cursor-move" data-drag-handle title="Drag to reorder">drag_indicator</span>
                    <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <span class="material-symbols-outlined text-[18px]">${cat.icon}</span>
                    </div>
                    <span class="text-label-md font-semibold text-on-surface truncate min-w-0 flex-1">${cat.name}</span>
                </div>
                <div class="flex-shrink-0">
                    ${cat.builtIn
                    ? '<span class="text-[10px] text-on-surface-variant opacity-60 px-2">Built-in</span>'
                    : `<button class="material-symbols-outlined text-error hover:bg-error-container/20 text-[18px] p-1 rounded-full" aria-label="Delete ${cat.name}" onclick="requestDeleteManagedCategory(${index}); event.stopPropagation();">delete</button>`}
                </div>
            `;
        }

        item.draggable = true;
        item.addEventListener('dragstart', (event) => {
            manageCategoryDragIndex = index;
            event.dataTransfer.effectAllowed = 'move';
            item.classList.add('opacity-50');
        });
        item.addEventListener('dragend', () => {
            manageCategoryDragIndex = null;
            item.classList.remove('opacity-50');
        });
        item.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        });
        item.addEventListener('drop', (event) => {
            event.preventDefault();
            moveManagedCategory(manageCategoryDragIndex, index);
        });

        const dragHandle = item.querySelector('[data-drag-handle]');
        dragHandle.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse') return;
            manageCategoryPointerIndex = index;
            dragHandle.setPointerCapture(event.pointerId);
            item.classList.add('opacity-50');
        });
        dragHandle.addEventListener('pointerup', (event) => {
            if (manageCategoryPointerIndex === null) return;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-category-index]');
            const targetIndex = target ? Number(target.dataset.categoryIndex) : null;
            moveManagedCategory(manageCategoryPointerIndex, targetIndex);
            manageCategoryPointerIndex = null;
            item.classList.remove('opacity-50');
        });
        dragHandle.addEventListener('pointercancel', () => {
            manageCategoryPointerIndex = null;
            item.classList.remove('opacity-50');
        });
        container.appendChild(item);
    });
}

function renderManageIconGrid() {
    const icons = ['shopping_basket', 'restaurant', 'shopping_bag', 'commute', 'receipt_long', 'sports_esports', 'flight', 'medical_services', 'school', 'work', 'laptop_mac', 'trending_up', 'redeem', 'payments', 'home', 'movie', 'directions_car', 'fitness_center', 'spa', 'pets'];
    const container = document.getElementById('mgcat-icon-grid');
    if (!container) return;
    container.innerHTML = '';

    icons.forEach(ico => {
        const btn = document.createElement('button');
        btn.className = "w-10 h-10 rounded-xl bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center border border-outline-variant/20";
        btn.type = 'button';
        btn.onclick = () => {
            selectedManageIcon = ico;
            const previewIcon = document.getElementById('mgcat-selected-icon-name');
            if (previewIcon) previewIcon.innerText = ico;
        };
        btn.innerHTML = `<span class="material-symbols-outlined text-[20px]">${ico}</span>`;
        container.appendChild(btn);
    });
}

function addNewManagedCategory() {
    const nameInput = document.getElementById('mgcat-new-name');
    const name = nameInput.value.trim();
    if (!name) {
        showToast("Please enter a category name");
        return;
    }

    const list = manageCatTab === 'spending' ? expenseCategories : incomeCategories;
    if (list.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        showToast("Category already exists");
        return;
    }

    const newCat = createUserCategory(name, selectedManageIcon);

    list.push(newCat);
    nameInput.value = '';
    renderManagedCategories();
    saveToLocalStorage();
    showToast("Category added!");
    currentFormContext = null;
    closeAddCategorySheet();
}

function requestDeleteManagedCategory(index) {
    const list = manageCatTab === 'spending' ? expenseCategories : incomeCategories;
    const category = list[index];
    if (!category) return;
    if (category.builtIn) {
        showToast("Built-in categories cannot be deleted");
        return;
    }

    const transactionType = manageCatTab === 'spending' ? 'expense' : 'income';
    const recordedTransactions = transactions.filter(transaction => transaction.type === transactionType && transaction.category === category.name);
    const scheduledMatches = scheduledTransactions.filter(item => item.transaction?.type === transactionType && item.transaction?.category === category.name);
    categoryPendingDeletion = { category, transactionType, count: recordedTransactions.length + scheduledMatches.length };

    if (categoryPendingDeletion.count === 0) {
        openConfirmActionSheet(
            'Delete Category',
            `Delete "${category.name}"? It has no related transactions.`,
            () => deleteManagedCategory(category)
        );
        return;
    }

    const message = document.getElementById('delete-category-message');
    const destinationCategories = list.filter(item => item !== category);
    deleteCategoryDestination = destinationCategories[0]?.name || null;
    renderDeleteCategoryDestinations(destinationCategories);
    message.innerText = `"${category.name}" has ${categoryPendingDeletion.count} related transaction${categoryPendingDeletion.count === 1 ? '' : 's'}. Choose where to move them before deleting this category.`;
    document.getElementById('sheet-delete-category').classList.remove('translate-y-full');
    showBackdrop();
}

function closeDeleteCategorySheet() {
    document.getElementById('sheet-delete-category').classList.add('translate-y-full');
    document.getElementById('delete-category-target-dropdown').classList.add('hidden');
    categoryPendingDeletion = null;
    deleteCategoryDestination = null;
}

function renderDeleteCategoryDestinations(categories) {
    const label = document.getElementById('delete-category-target-label');
    const dropdown = document.getElementById('delete-category-target-dropdown');
    if (!label || !dropdown) return;

    label.innerText = deleteCategoryDestination || 'Choose a category';
    dropdown.innerHTML = '';
    categories.forEach(category => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'w-full px-md py-sm text-left text-body-lg text-on-surface hover:bg-surface-container-high transition-colors';
        option.innerText = category.name;
        option.onclick = () => {
            deleteCategoryDestination = category.name;
            label.innerText = category.name;
            dropdown.classList.add('hidden');
        };
        dropdown.appendChild(option);
    });
}

function toggleDeleteCategoryDropdown() {
    const dropdown = document.getElementById('delete-category-target-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function confirmDeleteManagedCategory() {
    if (!categoryPendingDeletion) return;
    const destinationName = deleteCategoryDestination;
    const list = categoryPendingDeletion.transactionType === 'expense' ? expenseCategories : incomeCategories;
    const destination = list.find(category => category.name === destinationName);
    if (!destination) {
        showToast('Choose a category to move transactions to');
        return;
    }

    const sourceName = categoryPendingDeletion.category.name;
    transactions.forEach(transaction => {
        if (transaction.type === categoryPendingDeletion.transactionType && transaction.category === sourceName) {
            transaction.category = destination.name;
            transaction.categoryIcon = destination.icon;
        }
    });
    scheduledTransactions.forEach(item => {
        if (item.transaction?.type === categoryPendingDeletion.transactionType && item.transaction?.category === sourceName) {
            item.transaction.category = destination.name;
            item.transaction.categoryIcon = destination.icon;
        }
    });

    deleteManagedCategory(categoryPendingDeletion.category);
    closeDeleteCategorySheet();
    updateDashboard();
    updateBudget();
    saveToLocalStorage();
    showToast('Transactions moved and category deleted');
}

function deleteManagedCategory(category) {
    const list = expenseCategories.includes(category) ? expenseCategories : incomeCategories;
    const index = list.indexOf(category);
    if (index < 0) return;
    list.splice(index, 1);
    renderManagedCategories();
    saveCategoryOrders();
    saveToLocalStorage();
    categoryPendingDeletion = null;
    showToast('Category deleted');
}

let pickerSelectedDate = new Date();
let pickerActiveTab = 'date';
let pickerMode = 'tx'; // 'tx', 'analysis-from', 'analysis-to'

function initPickerSelects() {
    const hrOptions = document.getElementById('dtpicker-custom-hour-options');
    const minOptions = document.getElementById('dtpicker-custom-minute-options');
    if (!hrOptions || !minOptions) return;

    hrOptions.innerHTML = '';
    minOptions.innerHTML = '';

    for (let h = 1; h <= 12; h++) {
        const val = String(h).padStart(2, '0');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = "w-full text-center py-1.5 hover:bg-surface-container-high text-body-md text-on-surface font-semibold";
        btn.innerText = val;
        btn.onclick = () => selectPickerDropdownValue('hour', val);
        hrOptions.appendChild(btn);
    }
    for (let m = 0; m < 60; m++) {
        const val = String(m).padStart(2, '0');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = "w-full text-center py-1.5 hover:bg-surface-container-high text-body-md text-on-surface font-semibold";
        btn.innerText = val;
        btn.onclick = () => selectPickerDropdownValue('minute', val);
        minOptions.appendChild(btn);
    }
}

function togglePickerDropdown(type) {
    const dropdowns = ['hour', 'minute', 'ampm'];
    dropdowns.forEach(d => {
        const el = document.getElementById(`dtpicker-custom-${d}-options`);
        if (el) {
            if (d === type) {
                el.classList.toggle('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });
}

function selectPickerDropdownValue(type, val) {
    const label = document.getElementById(`dtpicker-custom-${type}-value`);
    if (label) label.innerText = val;

    const el = document.getElementById(`dtpicker-custom-${type}-options`);
    if (el) el.classList.add('hidden');

    syncClockFromSelects();
}

function setPickerTab(tab) {
    pickerActiveTab = tab;
    const btnDate = document.getElementById('dtpicker-tab-date');
    const btnTime = document.getElementById('dtpicker-tab-time');
    const contentDate = document.getElementById('dtpicker-content-date');
    const contentTime = document.getElementById('dtpicker-content-time');

    // Close any open custom picker dropdowns
    togglePickerDropdown('none');

    if (tab === 'date') {
        if (btnDate) btnDate.className = "flex-1 py-1 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
        if (btnTime) btnTime.className = "flex-1 py-1 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container-high";
        if (contentDate) contentDate.classList.remove('hidden');
        if (contentTime) contentTime.classList.add('hidden');
        stopClockTicking();
    } else {
        if (btnTime) btnTime.className = "flex-1 py-1 rounded-lg text-label-lg font-label-lg transition-all bg-primary text-on-primary shadow-sm";
        if (btnDate) btnDate.className = "flex-1 py-1 rounded-lg text-label-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container-high";
        if (contentTime) contentTime.classList.remove('hidden');
        if (contentDate) contentDate.classList.add('hidden');
        startClockTicking();
    }
}

function changePickerMonth(dir) {
    // Start at day 1 before changing months so Jan 29-31 never skips February.
    const originalDay = pickerSelectedDate.getDate();
    pickerSelectedDate.setDate(1);
    pickerSelectedDate.setMonth(pickerSelectedDate.getMonth() + dir);
    const daysInTargetMonth = new Date(pickerSelectedDate.getFullYear(), pickerSelectedDate.getMonth() + 1, 0).getDate();
    pickerSelectedDate.setDate(Math.min(originalDay, daysInTargetMonth));
    renderPickerCalendar();
}

let pickerSwipeStartX = 0;
let pickerSwipeStartY = 0;

function bindPickerCalendarSwipe(grid) {
    if (grid.dataset.swipeBound === 'true') return;

    grid.dataset.swipeBound = 'true';
    grid.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];
        pickerSwipeStartX = touch.clientX;
        pickerSwipeStartY = touch.clientY;
    }, { passive: true });

    grid.addEventListener('touchend', (event) => {
        if (grid.dataset.pickerView !== 'calendar') return;

        const touch = event.changedTouches[0];
        const horizontalDistance = touch.clientX - pickerSwipeStartX;
        const verticalDistance = touch.clientY - pickerSwipeStartY;
        if (Math.abs(horizontalDistance) < 60 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return;

        changePickerMonth(horizontalDistance < 0 ? 1 : -1);
    }, { passive: true });
}

function openPickerYearSelector() {
    const grid = document.getElementById('dtpicker-calendar-grid');
    const label = document.getElementById('dtpicker-month-label');
    if (!grid) return;

    if (label) {
        label.style.cursor = 'pointer';
        label.title = 'Tap to pick year';
        label.onclick = openPickerYearSelector;
        if (pickerMode === 'export-year') {
            label.innerText = String(pickerSelectedDate.getFullYear());
        }
    }

    const weekHeader = document.getElementById('dtpicker-week-header');
    if (weekHeader) weekHeader.classList.add('hidden');

    grid.dataset.pickerView = 'year';
    grid.className = 'block';
    grid.innerHTML = '';

    const currentPickerYear = pickerSelectedDate.getFullYear();

    // For export-year: only show years that have transactions
    // For regular calendar: show a full range
    let yearList = [];
    if (pickerMode === 'export-year') {
        const txYears = new Set();
        transactions.forEach(t => {
            const txDate = getTransactionDate(t);
            if (txDate) txYears.add(txDate.getFullYear());
        });
        yearList = [...txYears].sort((a, b) => b - a);
        if (yearList.length === 0) yearList = [new Date().getFullYear()];
    } else {
        const minY = 2000;
        const maxY = new Date().getFullYear() + 5;
        for (let y = maxY; y >= minY; y--) yearList.push(y);
    }

    const yearGridEl = document.createElement('div');
    yearGridEl.className = 'grid grid-cols-4 gap-2 w-full py-2';

    yearList.forEach(y => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = (y === currentPickerYear)
            ? 'py-2 rounded-xl text-sm font-bold bg-primary text-on-primary shadow-sm'
            : 'py-2 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors';
        btn.textContent = y;
        btn.onclick = () => {
            pickerSelectedDate.setFullYear(y);
            if (pickerMode === 'export-year') {
                const labelEl = document.getElementById('dtpicker-month-label');
                if (labelEl) labelEl.innerText = String(y);
                openPickerYearSelector();
            } else {
                renderPickerCalendar();
            }
        };
        yearGridEl.appendChild(btn);
    });

    const overlay = document.createElement('div');
    overlay.className = 'overflow-y-auto max-h-[220px] w-full';
    overlay.appendChild(yearGridEl);
    grid.appendChild(overlay);

    setTimeout(() => {
        const sel = [...yearGridEl.querySelectorAll('button')].find(b => parseInt(b.textContent) === currentPickerYear);
        if (sel) sel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
}

function renderPickerCalendar() {
    const year = pickerSelectedDate.getFullYear();
    const month = pickerSelectedDate.getMonth();

    // Restore navigator chevrons visibility
    const chevrons = document.querySelectorAll('#dtpicker-content-date button');
    chevrons.forEach(c => {
        const onClickAttr = c.getAttribute('onclick') || '';
        if (onClickAttr.includes('changePickerMonth')) {
            c.classList.remove('invisible');
        }
    });

    const label = document.getElementById('dtpicker-month-label');
    if (label) {
        label.innerText = `${monthNames[month]} ${year}`;
        label.style.cursor = 'pointer';
        label.title = 'Tap to jump to a year';
        label.onclick = openPickerYearSelector;
    }

    const weekHeader = document.getElementById('dtpicker-week-header');
    if (weekHeader) weekHeader.classList.remove('hidden');

    const grid = document.getElementById('dtpicker-calendar-grid');
    if (!grid) return;
    grid.dataset.pickerView = 'calendar';
    grid.className = 'grid grid-cols-7 gap-y-2 text-center';
    grid.innerHTML = '';
    bindPickerCalendarSwipe(grid);


    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const prevTotalDays = new Date(year, month, 0).getDate();

    // Previous Month's trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const d = prevTotalDays - i;
        const cell = document.createElement('div');
        cell.className = "text-sm text-on-surface-variant/30 py-1.5";
        cell.innerText = d;
        grid.appendChild(cell);
    }

    // Current Month's days
    for (let d = 1; d <= totalDays; d++) {
        const cell = document.createElement('div');
        const isSelected = d === pickerSelectedDate.getDate() &&
            month === pickerSelectedDate.getMonth() &&
            year === pickerSelectedDate.getFullYear();
        if (isSelected) {
            cell.className = "relative flex justify-center items-center py-1 cursor-pointer";
            cell.innerHTML = `<span class="absolute w-8 h-8 bg-primary rounded-full shadow-sm"></span><span class="relative text-sm font-bold text-on-primary">${d}</span>`;
        } else {
            cell.className = "text-sm font-bold text-on-surface hover:bg-surface-container-high rounded-full py-1.5 cursor-pointer";
            cell.innerText = d;
            cell.onclick = () => selectPickerDate(d);
        }
        grid.appendChild(cell);
    }

    // Next Month's leading days to complete grid
    const totalCells = firstDayIndex + totalDays;
    const remaining = 42 - totalCells;
    for (let d = 1; d <= remaining; d++) {
        const cell = document.createElement('div');
        cell.className = "text-sm text-on-surface-variant/30 py-1.5";
        cell.innerText = String(d).padStart(2, '0');
        grid.appendChild(cell);
    }
}

function selectPickerDate(day) {
    pickerSelectedDate.setDate(day);
    renderPickerCalendar();
}

function openTxDateTimePicker() {
    pickerMode = 'tx';
    pickerSelectedDate = new Date(selectedTxDateObj);

    const tabs = document.getElementById('dtpicker-tabs-container');
    if (tabs) tabs.classList.remove('hidden');

    const title = document.getElementById('dtpicker-title');
    if (title) title.innerText = "Select Date & Time";

    initPickerSelects();

    // Sync Custom Dropdowns
    let hr = pickerSelectedDate.getHours();
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12;
    hr = hr ? hr : 12;
    const min = pickerSelectedDate.getMinutes();

    const hrVal = document.getElementById('dtpicker-custom-hour-value');
    const minVal = document.getElementById('dtpicker-custom-minute-value');
    const ampmVal = document.getElementById('dtpicker-custom-ampm-value');

    if (hrVal) hrVal.innerText = String(hr).padStart(2, '0');
    if (minVal) minVal.innerText = String(min).padStart(2, '0');
    if (ampmVal) ampmVal.innerText = ampm;

    syncClockFromSelects();

    setPickerTab('date');
    renderPickerCalendar();

    document.getElementById('sheet-datetime-picker').classList.remove('translate-y-full');
    showBackdrop();
}

function openCustomDatePicker(type) {
    pickerMode = 'analysis-' + type;
    const inputVal = document.getElementById('analysis-custom-' + type).value;
    pickerSelectedDate = inputVal ? new Date(inputVal) : new Date();

    const tabs = document.getElementById('dtpicker-tabs-container');
    if (tabs) tabs.classList.add('hidden');

    const title = document.getElementById('dtpicker-title');
    if (title) title.innerText = type === 'from' ? "Select From Date" : "Select To Date";

    setPickerTab('date');
    renderPickerCalendar();

    document.getElementById('sheet-datetime-picker').classList.remove('translate-y-full');
    showBackdrop();
}

function openCustomPickerForStructured(type) {
    pickerMode = 'structured-' + type;
    const hiddenInput = document.getElementById('structured-date-' + type);
    pickerSelectedDate = (hiddenInput && hiddenInput.value) ? new Date(hiddenInput.value) : new Date();

    const tabs = document.getElementById('dtpicker-tabs-container');
    if (tabs) tabs.classList.add('hidden');

    const title = document.getElementById('dtpicker-title');
    if (title) title.innerText = type === 'from' ? 'Select From Date' : 'Select To Date';

    setPickerTab('date');
    renderPickerCalendar();

    document.getElementById('sheet-datetime-picker').classList.remove('translate-y-full');
    showBackdrop();
}

function openCustomPickerForExport(type) {
    pickerMode = 'export-' + type;
    const hiddenInput = document.getElementById('export-custom-' + type);
    pickerSelectedDate = (hiddenInput && hiddenInput.value) ? new Date(hiddenInput.value) : new Date();

    const tabs = document.getElementById('dtpicker-tabs-container');
    if (tabs) tabs.classList.add('hidden');

    const title = document.getElementById('dtpicker-title');
    if (title) title.innerText = type === 'from' ? 'Select From Date' : 'Select To Date';

    setPickerTab('date');
    renderPickerCalendar();

    document.getElementById('sheet-datetime-picker').classList.remove('translate-y-full');
    showBackdrop();
}

function openPickerForExportMonth() {
    pickerMode = 'export-month';
    const existing = document.getElementById('export-month-date-val').value;
    pickerSelectedDate = existing ? new Date(existing) : new Date();

    const tabs = document.getElementById('dtpicker-tabs-container');
    if (tabs) tabs.classList.add('hidden');

    const title = document.getElementById('dtpicker-title');
    if (title) title.innerText = 'Select Month to Export';

    setPickerTab('date');
    renderPickerCalendar();

    document.getElementById('sheet-datetime-picker').classList.remove('translate-y-full');
    showBackdrop();
}

function openPickerForExportYear() {
    pickerMode = 'export-year';
    const existing = document.getElementById('export-year-date-val').value;
    pickerSelectedDate = existing ? new Date(existing) : new Date();

    // Open year selector directly
    const tabs = document.getElementById('dtpicker-tabs-container');
    if (tabs) tabs.classList.add('hidden');

    const title = document.getElementById('dtpicker-title');
    if (title) title.innerText = 'Select Year to Export';

    setPickerTab('date');
    openPickerYearSelector();

    // Hide navigator chevrons
    const chevrons = document.querySelectorAll('#dtpicker-content-date button');
    chevrons.forEach(c => {
        const onClickAttr = c.getAttribute('onclick') || '';
        if (onClickAttr.includes('changePickerMonth')) {
            c.classList.add('invisible');
        }
    });

    document.getElementById('sheet-datetime-picker').classList.remove('translate-y-full');
    showBackdrop();
}

function closeDateTimePickerSheet() {
    document.getElementById('sheet-datetime-picker').classList.add('translate-y-full');
    checkBackdropNeeded();
    stopClockTicking();
}

function confirmDateTimePickerSelection() {
    const year = pickerSelectedDate.getFullYear();
    const month = String(pickerSelectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(pickerSelectedDate.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;

    if (pickerMode === 'tx') {
        let hr = parseInt(document.getElementById('dtpicker-custom-hour-value').innerText) || 12;
        const min = parseInt(document.getElementById('dtpicker-custom-minute-value').innerText) || 0;
        const ampm = document.getElementById('dtpicker-custom-ampm-value').innerText;

        if (ampm === 'PM' && hr < 12) hr += 12;
        if (ampm === 'AM' && hr === 12) hr = 0;

        pickerSelectedDate.setHours(hr, min, 0, 0);
        selectedTxDateObj = new Date(pickerSelectedDate);
        updateTxDatePickerLabel();

    } else if (pickerMode.startsWith('analysis-')) {
        const type = pickerMode.split('-')[1];
        document.getElementById('analysis-custom-' + type).value = isoDate;
        document.getElementById('analysis-custom-' + type + '-label').innerText = `${pickerSelectedDate.getDate()} ${monthNames[pickerSelectedDate.getMonth()]}`;
        updateAnalysis();
        saveInterfacePreferences();

    } else if (pickerMode.startsWith('structured-')) {
        const type = pickerMode.split('-')[1];
        const hiddenInput = document.getElementById('structured-date-' + type);
        const labelEl = document.getElementById('structured-date-' + type + '-label');
        if (hiddenInput) { hiddenInput.value = isoDate; hiddenInput.dispatchEvent(new Event('change')); }
        if (labelEl) labelEl.innerText = `${pickerSelectedDate.getDate()} ${monthNames[pickerSelectedDate.getMonth()]} ${year}`;

    } else if (pickerMode.startsWith('export-')) {
        const subType = pickerMode.replace('export-', '');
        if (subType === 'from' || subType === 'to') {
            const hiddenInput = document.getElementById('export-custom-' + subType);
            const labelEl = document.getElementById('export-custom-' + subType + '-label');
            if (hiddenInput) hiddenInput.value = isoDate;
            if (labelEl) labelEl.innerText = `${pickerSelectedDate.getDate()} ${monthNames[pickerSelectedDate.getMonth()]} ${year}`;
        } else if (subType === 'month') {
            const hiddenInput = document.getElementById('export-month-date-val');
            const labelEl = document.getElementById('export-month-label');
            if (hiddenInput) hiddenInput.value = isoDate;
            if (labelEl) labelEl.innerText = `Selected: ${monthNames[pickerSelectedDate.getMonth()]} ${year}`;
        } else if (subType === 'year') {
            const hiddenInput = document.getElementById('export-year-date-val');
            const labelEl = document.getElementById('export-year-label');
            if (hiddenInput) hiddenInput.value = isoDate;
            if (labelEl) labelEl.innerText = `Selected: ${year}`;
        }
    }

    closeDateTimePickerSheet();
}

function syncClockHands(hour, minute) {
    const hourHand = document.getElementById('clock-hand-hour');
    const minHand = document.getElementById('clock-hand-minute');
    if (hourHand) {
        const hAngle = (hour % 12) * 30 + (minute * 0.5) + 90;
        hourHand.style.transform = `rotate(${hAngle}deg)`;
    }
    if (minHand) {
        const mAngle = minute * 6;
        minHand.style.transform = `rotate(${mAngle}deg)`;
    }
}

function syncClockFromSelects() {
    const hr = parseInt(document.getElementById('dtpicker-custom-hour-value').innerText) || 12;
    const min = parseInt(document.getElementById('dtpicker-custom-minute-value').innerText) || 0;
    syncClockHands(hr, min);
}

function initClockFaceInteraction() {
    const face = document.getElementById('analog-clock-face');
    if (!face) return;

    let isDragging = false;
    let dragTarget = 'minute'; // 'hour' or 'minute'

    function getDragAngleAndDistance(e) {
        const rect = face.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;

        return { angle, dist, dx, dy };
    }

    function startDrag(e) {
        isDragging = true;
        const { angle } = getDragAngleAndDistance(e);

        const hr = parseInt(document.getElementById('dtpicker-custom-hour-value').innerText) || 12;
        const min = parseInt(document.getElementById('dtpicker-custom-minute-value').innerText) || 0;

        const hourAngle = ((hr % 12) * 30 + min * 0.5) % 360;
        const minuteAngle = (min * 6) % 360;

        const diffHour = Math.min(Math.abs(angle - hourAngle), 360 - Math.abs(angle - hourAngle));
        const diffMinute = Math.min(Math.abs(angle - minuteAngle), 360 - Math.abs(angle - minuteAngle));

        if (diffHour < diffMinute) {
            dragTarget = 'hour';
        } else {
            dragTarget = 'minute';
        }

        handleTimeDrag(e);
    }

    function handleTimeDrag(e) {
        if (!isDragging) return;
        const { angle } = getDragAngleAndDistance(e);

        const hrVal = document.getElementById('dtpicker-custom-hour-value');
        const minVal = document.getElementById('dtpicker-custom-minute-value');

        if (dragTarget === 'hour') {
            let hr = Math.round(angle / 30) % 12;
            hr = hr === 0 ? 12 : hr;
            if (hrVal) hrVal.innerText = String(hr).padStart(2, '0');
        } else {
            let min = Math.round(angle / 6) % 60;
            if (minVal) minVal.innerText = String(min).padStart(2, '0');
        }
        syncClockFromSelects();
    }

    face.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', handleTimeDrag);
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    face.addEventListener('touchstart', (e) => {
        startDrag(e);
    });
    window.addEventListener('touchmove', handleTimeDrag);
    window.addEventListener('touchend', () => {
        isDragging = false;
    });
}

let calcExpression = '';
let calcCurrentVal = '0';
let calcResetOnNext = false;

function openCalculatorSheet() {
    const amt = document.getElementById('tx-input-amount').value;
    calcCurrentVal = amt && !isNaN(amt) ? String(amt) : '0';
    calcExpression = '';
    calcResetOnNext = false;
    updateCalcDisplay();

    document.getElementById('sheet-calculator').classList.remove('translate-y-full');
    showBackdrop();
}

function closeCalculatorSheet() {
    document.getElementById('sheet-calculator').classList.add('translate-y-full');
    checkBackdropNeeded();
}

function updateCalcDisplay() {
    const disp = document.getElementById('calc-display');
    const expr = document.getElementById('calc-expression');
    if (disp) disp.innerText = calcCurrentVal;
    if (expr) {
        expr.innerText = calcExpression.replace(/\*/g, '×').replace(/\//g, '÷');
    }
}

function pressCalcKey(key) {
    if (key === 'C') {
        calcCurrentVal = '0';
        calcExpression = '';
        calcResetOnNext = false;
    } else if (key === '+/-') {
        if (calcCurrentVal !== '0') {
            if (calcCurrentVal.startsWith('-')) {
                calcCurrentVal = calcCurrentVal.substring(1);
            } else {
                calcCurrentVal = '-' + calcCurrentVal;
            }
        }
    } else if (key === '%') {
        calcCurrentVal = String(parseFloat(calcCurrentVal) / 100);
        calcResetOnNext = true;
    } else if (['+', '-', '*', '/'].includes(key)) {
        if (calcExpression && !calcResetOnNext) {
            calcExpression += calcCurrentVal;
            const res = safeEvaluate(calcExpression);
            calcCurrentVal = String(res);
            calcExpression = calcCurrentVal + key;
        } else {
            calcExpression = calcCurrentVal + key;
        }
        calcResetOnNext = true;
    } else if (key === '=') {
        if (calcExpression) {
            calcExpression += calcCurrentVal;
            const res = safeEvaluate(calcExpression);
            calcCurrentVal = String(res);
            calcExpression = '';
            calcResetOnNext = true;
        }
    } else {
        if (calcResetOnNext) {
            calcCurrentVal = key === '.' ? '0.' : key;
            calcResetOnNext = false;
        } else {
            if (key === '.') {
                if (!calcCurrentVal.includes('.')) {
                    calcCurrentVal += '.';
                }
            } else {
                if (calcCurrentVal === '0') {
                    calcCurrentVal = key;
                } else {
                    calcCurrentVal += key;
                }
            }
        }
    }
    updateCalcDisplay();
}

function safeEvaluate(str) {
    try {
        const clean = str.replace(/[^0-9+\-*/.]/g, '');
        const res = new Function(`return ${clean}`)();
        if (isNaN(res) || !isFinite(res)) return 'Error';
        return Math.round(res * 100) / 100;
    } catch (e) {
        return 'Error';
    }
}

function confirmCalculatorValue() {
    if (calcCurrentVal !== 'Error') {
        const amtInput = document.getElementById('tx-input-amount');
        if (amtInput) {
            amtInput.value = calcCurrentVal;
            amtInput.dispatchEvent(new Event('input'));
        }
    }
    closeCalculatorSheet();
}

let clockTickingInterval = null;

function startClockTicking() {
    if (clockTickingInterval) clearInterval(clockTickingInterval);

    function tick() {
        const secondHand = document.getElementById('clock-hand-second');
        if (secondHand) {
            const s = new Date().getSeconds();
            const sAngle = s * 6;
            secondHand.style.transform = `rotate(${sAngle}deg)`;
        }
    }

    tick(); // initial tick
    clockTickingInterval = setInterval(tick, 1000);
}

function stopClockTicking() {
    if (clockTickingInterval) {
        clearInterval(clockTickingInterval);
        clockTickingInterval = null;
    }
}

// Hook up the Custom Date labels and Clock interactions on load
window.addEventListener('DOMContentLoaded', () => {
    // Suppress browser/Google auto-fill manager on all input fields
    suppressBrowserAutofill();

    // Watch for dynamic DOM changes to apply suppression to any newly added/modified inputs
    const observer = new MutationObserver(() => {
        suppressBrowserAutofill();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    initClockFaceInteraction();

    // Close custom dropdowns on outside click
    window.addEventListener('click', (e) => {
        if (!e.target.closest('#dtpicker-custom-hour') &&
            !e.target.closest('#dtpicker-custom-minute') &&
            !e.target.closest('#dtpicker-custom-ampm')) {
            togglePickerDropdown('none');
        }
    });

    // Auto-prefill transaction details based on past description
    const descInput = document.getElementById('tx-input-desc');
    if (descInput) {
        const handlePrefill = () => {
            const val = descInput.value.trim().toLowerCase();
            if (!val || !transactions) return;

            // Find most recent transaction with this description (case insensitive)
            const match = transactions.slice().reverse().find(t => {
                const descStr = t.description || t.note || "";
                return descStr.trim().toLowerCase() === val;
            });

            if (match) {
                selectedCategory = match.category;
                selectedCategoryIcon = match.categoryIcon || 'payments';

                selectedPaymentMode = match.paymentMode;
                if (match.paymentMode === 'Bank/UPI') selectedPaymentIcon = 'account_balance';
                else if (match.paymentMode === 'Credit Card') selectedPaymentIcon = 'credit_card';
                else selectedPaymentIcon = 'account_balance_wallet';

                selectedTags = [...(match.tags || [])];

                syncAddTransactionUI();
            }
        };
        descInput.addEventListener('blur', handlePrefill);
        descInput.addEventListener('change', handlePrefill);
    }

    setTimeout(() => {
        const fromVal = document.getElementById('analysis-custom-from');
        const toVal = document.getElementById('analysis-custom-to');
        if (fromVal && fromVal.value) {
            const d = new Date(fromVal.value);
            document.getElementById('analysis-custom-from-label').innerText = `${d.getDate()} ${monthNames[d.getMonth()]}`;
        }
        if (toVal && toVal.value) {
            const d = new Date(toVal.value);
            document.getElementById('analysis-custom-to-label').innerText = `${d.getDate()} ${monthNames[d.getMonth()]}`;
        }
    }, 100);
});

// Format large amounts compactly: ₹2.03L, ₹1.5Cr etc., with auto-size support
function formatAmount(val) {
    const abs = Math.abs(val);
    if (abs >= 1e7) return `₹${(val / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `₹${(val / 1e5).toFixed(2)}L`;
    return `₹${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Auto-shrink text inside an element to fit its container width
function fitText(el) {
    if (!el) return;
    el.style.fontSize = '';
    const parent = el.parentElement;
    if (!parent) return;
    let size = parseFloat(window.getComputedStyle(el).fontSize) || 20;
    const minSize = 10;
    while (el.scrollWidth > parent.clientWidth && size > minSize) {
        size -= 0.5;
        el.style.fontSize = size + 'px';
    }
}


let currentFormContext = null;

function snapshotFormState(formName) {
    const state = {};
    if (formName === 'transaction') {
        const amountEl = document.getElementById('tx-input-amount');
        const descEl = document.getElementById('tx-input-desc');
        state.amount = amountEl ? amountEl.value : '';
        state.desc = descEl ? descEl.value : '';
        state.type = selectedTxType;
        state.category = selectedCategory;
        state.paymentMode = selectedPaymentMode;
        state.tags = JSON.stringify(selectedTags);
        state.date = selectedTxDateObj ? selectedTxDateObj.getTime() : null;
    } else if (formName === 'account') {
        const nameEl = document.getElementById('account-input-name');
        const holderEl = document.getElementById('account-input-holder');
        const typeEl = document.getElementById('account-input-type');
        const balanceEl = document.getElementById('account-input-balance');
        state.name = nameEl ? nameEl.value : '';
        state.holder = holderEl ? holderEl.value : '';
        state.type = typeEl ? typeEl.value : 'bank';
        state.balance = balanceEl ? balanceEl.value : '';
    } else if (formName === 'category') {
        const nameEl = document.getElementById('mgcat-new-name');
        const iconEl = document.getElementById('mgcat-selected-icon-name');
        state.name = nameEl ? nameEl.value : '';
        state.icon = iconEl ? iconEl.innerText : 'category';
    } else if (formName === 'profile') {
        const nameEl = document.getElementById('profile-input-name');
        const emailEl = document.getElementById('profile-input-email');
        const avatarEl = document.getElementById('profile-selected-avatar');
        state.name = nameEl ? nameEl.value : '';
        state.email = emailEl ? emailEl.value : '';
        state.avatar = avatarEl ? avatarEl.value : '';
    } else if (formName === 'budget') {
        const toggleEl = document.getElementById('budget-toggle-enabled');
        const limitEl = document.getElementById('budget-input-limit');
        state.enabled = toggleEl ? toggleEl.checked : false;
        state.limit = limitEl ? limitEl.value : '';
        const catLimits = {};
        const inputs = document.querySelectorAll('[id^="budget-cat-"]');
        inputs.forEach(inp => { catLimits[inp.id] = inp.value; });
        state.catLimits = JSON.stringify(catLimits);
    }
    return state;
}

function isFormDirty(formName, snapshot) {
    if (!snapshot) return false;
    const current = snapshotFormState(formName);
    return JSON.stringify(current) !== JSON.stringify(snapshot);
}

function handleFormClose(formName, originalCloseFn, saveFn) {
    if (currentFormContext && currentFormContext.name === formName && isFormDirty(formName, currentFormContext.snapshot)) {
        currentFormContext.saveFn = saveFn;
        currentFormContext.closeFn = originalCloseFn;
        const dialog = document.getElementById('unsaved-dialog');
        if (dialog) dialog.classList.remove('hidden');
    } else {
        originalCloseFn();
        currentFormContext = null;
    }
}

function dismissUnsavedDialog() {
    const dialog = document.getElementById('unsaved-dialog');
    if (dialog) dialog.classList.add('hidden');
}

function unsavedDialogDiscard() {
    dismissUnsavedDialog();
    if (currentFormContext && currentFormContext.closeFn) {
        currentFormContext.closeFn();
    }
    currentFormContext = null;
}

function unsavedDialogSave() {
    dismissUnsavedDialog();
    if (!currentFormContext || !currentFormContext.saveFn) return;
    // A failed validation keeps this original snapshot, so the form remains dirty.
    // Successful save handlers clear the context before closing their sheet.
    currentFormContext.saveFn();
}