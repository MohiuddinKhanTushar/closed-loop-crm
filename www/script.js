// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAFjiFR8-P42EWiJQWRrZGdf7sJ2O4oWZU",
    authDomain: "closed-loop-crm.firebaseapp.com",
    projectId: "closed-loop-crm",
    storageBucket: "closed-loop-crm.firebasestorage.app",
    messagingSenderId: "770921103170",
    appId: "1:770921103170:web:2b642ed99e03bc3f4ad2db"
};

// 1. INITIALIZE GLOBALLY
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// 2. Enable Persistence IMMEDIATELY (No Timeout)
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Persistence failed: Multiple tabs open.");
    } else if (err.code == 'unimplemented') {
        console.warn("Persistence not supported by this browser.");
    }
});

// 3. Wait for Device Ready
window.addEventListener('DOMContentLoaded', () => {
    // Wait for the native bridge to be ready before calling setupCapacitor
    document.addEventListener('deviceready', () => {
        setupCapacitor();
    }, false);
});




// 3. Status Bar, Splash Screen & Back Button Fix
let lastBackPress = 0; 

async function setupCapacitor() {
    const Plugins = window.Capacitor.Plugins;
    const { StatusBar, App, LocalNotifications } = Plugins;

    if (LocalNotifications) await LocalNotifications.requestPermissions(); 

    // IMPORTANT: Clear any previous listeners to prevent double-firing
    if (App) {
        await App.removeAllListeners();

        App.addListener('backButton', () => {
            const now = Date.now();
            if (now - lastBackPress < 500) return; 
            lastBackPress = now;

            console.log("Native Back Button Triggered");

            const isVisible = (id) => {
                const el = document.getElementById(id);
                if (!el) return false;
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            };
            const isAddLeadOpen = isVisible('add-lead-modal');
            const menu = document.getElementById('side-menu');
            const isMenuOpen = menu && menu.classList.contains('open');
            const isSearchOpen = isVisible('search-overlay');
            const isDetailOpen = isVisible('lead-detail-screen');
            const isCalendarOpen = isVisible('calendar-modal');
            const isNotifOpen = isVisible('notif-modal');
            const isAuthVisible = isVisible('auth-screen');
            const isPipelineVisible = isVisible('pipeline-screen');

            // Logic Tree
            if (isMenuOpen) {
                toggleMenu();
            } else if (isSearchOpen) {
                toggleSearch(false);
            } else if (isAddLeadOpen) { // --- Add this condition ---
                console.log("Closing Add Lead Modal");
                closeModal();
            } else if (isCalendarOpen) {
                closeCalendar();
            } else if (isNotifOpen) {
                toggleNotifications();
            } else if (isDetailOpen) {
                closeDetail();
            } else if (!isPipelineVisible && !isAuthVisible) {
                showScreen('pipeline-screen');
            } else {
                // We are on the Home (Pipeline) screen, now we can exit
                App.exitApp();
            }
        });
    }

    if (StatusBar) {
        try {
            await StatusBar.setOverlaysWebView({ overlay: true });
            await StatusBar.setStyle({ style: 'LIGHT' });
        } catch (e) { console.error(e); }
    }
}

async function scheduleNativeNotification(task) {
    // Add a guard clause to prevent errors when running in a web browser
    // where Capacitor is not defined.
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.LocalNotifications) {
        console.log("Native environment not detected. Skipping native notification.");
        return; // Exit gracefully if not on a native device
    }

    const { LocalNotifications } = window.Capacitor.Plugins;
    
    // Calculate trigger time: task time minus offset minutes
    const triggerMillis = task.taskTimestamp - (parseInt(task.reminderOffset) * 60000);
    
    // Don't schedule if the time has already passed
    if (triggerMillis < Date.now()) return;

    await LocalNotifications.schedule({
        notifications: [
            {
                title: "Task Reminder",
                body: `${task.leadName}: ${task.description}`,
                id: Math.floor(task.id % 100000), // Ensure it's an integer
                schedule: { at: new Date(triggerMillis) },
                sound: 'default',
                actionTypeId: "",
                extra: task
            }
        ]
    });
}

// 1. DATA SETUP & STATE
let currentFilter = 'New';
let activeLeadId = null;
let notifications = []; // Initialize as empty. Will be loaded per-user.

let rawData = localStorage.getItem('myLeads');
let leads = rawData ? JSON.parse(rawData) : [
    { id: 1, name: "John Smith", company: "Example Corp", source: "Instagram", value: 1200, status: 'New', activities: [], phone: "", email: "", address: "", notes: "" }
];

// 2. NAVIGATION & SCREENS
function toggleMenu() { 
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    const isOpen = menu.classList.toggle('open');
    
    if (isOpen) {
        overlay.style.display = 'block';
        overlay.offsetHeight; 
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
        setTimeout(() => {
            if (!menu.classList.contains('open')) overlay.style.display = 'none';
        }, 300);
    }
}

function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    
    const target = document.getElementById(screenId);
    if(target) {
        target.style.display = 'block';
        
        // Trigger logic based on which screen opened
        if(screenId === 'pipeline-screen') renderLeads();
        if(screenId === 'tasks-screen') renderAllTasks();
        if(screenId === 'roi-screen') renderROI();
        if(screenId === 'settings-screen') renderSettingsContent(); // Changed name to avoid conflict
    }
}

async function clearTaskFromList(leadId, taskId) {
    // 1. Find the lead
    const leadIdx = leads.findIndex(l => String(l.id) === String(leadId));
    if (leadIdx === -1) return;

    // 2. Find the task within that lead's activities
    const task = leads[leadIdx].activities.find(a => String(a.id) === String(taskId));
    
    if (task) {
        // 3. Mark it as cleared so it disappears from the "All Tasks" view
        task.clearedFromGlobalList = true;

        // 4. Save the changes to Firebase/Local Storage
        await saveData();

        // 5. Refresh the Tasks UI
        renderAllTasks();
        showToast("Task cleared from list");
    }
}

function openFullProfile() {
    const lead = leads.find(l => l.id === activeLeadId);
    if (!lead) return;

    const pVal = document.getElementById('detail-phone-input').value;
    const eVal = document.getElementById('detail-email-input').value;
    
    if ((pVal !== "" && !validatePhone(pVal)) || (eVal !== "" && !validateEmail(eVal))) {
        openValidationModal("Please fix the contact details before viewing the full profile.");
        return;
    }

    document.getElementById('profile-main-name').innerText = lead.name;
    updateProfileSubInfo(lead);

    document.getElementById('profile-company-input').value = lead.company || "";
    document.getElementById('profile-phone-input').value = lead.phone || "";
    document.getElementById('profile-email-input').value = lead.email || "";
    document.getElementById('profile-address-input').value = lead.address || "";
    document.getElementById('profile-notes-input').value = ""; 

    renderActivities(lead);
    closeDetail();
    showScreen('profile-screen');
    const contentArea = document.querySelector('#profile-screen .content');
    if (contentArea) {
        contentArea.scrollTop = 0;
    }
}

// 3. ACTIVITIES LOGIC
function toggleTaskComplete(leadId, taskId) {
    const lead = leads.find(l => l.id == leadId);
    if (!lead) return;

    const task = lead.activities.find(a => a.id == taskId);
    if (task) {
        task.completed = !task.completed;
        saveData();
        renderActivities(lead);
        if (document.getElementById('tasks-screen').style.display === 'block') renderAllTasks();
        showToast(task.completed ? "Task Completed!" : "Task Re-opened");
    }
}

function logActivity(type) {
    const lead = leads.find(l => l.id === activeLeadId);
    if(!lead) return;
    if(!lead.activities) lead.activities = [];
    
    lead.activities.unshift({
        id: Date.now(),
        action: type,
        isNote: false,
        timestamp: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    });
    
    saveData();
    renderActivities(lead);

    const phoneNumber = (lead.phone || "").replace(/\s+/g, '');
    if(type === 'Call' && phoneNumber) window.location.href = `tel:${phoneNumber}`;
    else if(type === 'Email' && lead.email) window.location.href = `mailto:${lead.email}`;
    else if(type === 'WhatsApp' && phoneNumber) window.location.href = `https://wa.me/${phoneNumber.replace('+', '')}`;
    else if(type === 'Text' && phoneNumber) window.location.href = `sms:${phoneNumber}`;
}

function saveNoteToActivity() {
    const noteInput = document.getElementById('profile-notes-input');
    const noteText = noteInput.value.trim();

    if (!noteText) return; 

    const lead = leads.find(l => l.id === activeLeadId);
    if (lead) {
        if (!lead.activities) lead.activities = [];

        lead.activities.unshift({
            id: Date.now(),
            action: 'Note',
            content: noteText,
            isNote: true,
            timestamp: new Date().toLocaleString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        });

        noteInput.value = '';
        saveData();
        renderActivities(lead);
    }
}

function renderActivities(lead) {
    const log = document.getElementById('activity-log');
    if(!lead.activities || lead.activities.length === 0) {
        log.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">No history yet.</p>';
        return;
    }
    log.innerHTML = lead.activities.map(a => {
        const isTask = a.type === 'Task';
        const isCompleted = a.completed ? 'opacity: 0.6;' : '';
        const taskColor = a.completed ? '#4caf50' : '#ff9500';

        // FIX: Added quotes around lead.id and a.id
        return `
            <div class="timeline-item" style="${isCompleted}">
                <div class="timeline-dot" style="${isTask ? `background: ${taskColor};` : ''}"></div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="font-size: 11px; color: #999;">${a.timestamp}</div>
                    ${isTask ? `
                        <button onclick="event.stopPropagation(); toggleTaskComplete('${lead.id}', ${a.id})" 
                                style="background:none; border:none; padding:0; cursor:pointer; color: ${a.completed ? '#4caf50' : '#ccc'};">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </button>
                    ` : ''}
                </div>
                <div style="font-weight: 700; color: var(--teal-primary); font-size: 13px; margin-top: 2px; ${a.completed ? 'text-decoration: line-through;' : ''}">
                    ${isTask ? (a.completed ? 'TASK COMPLETED' : 'TASK SCHEDULED') : (a.isNote ? 'NOTE' : a.action + ' ATTEMPT')}
                </div>
                <div style="font-size: 14px; color: #444; margin-top: 4px; line-height: 1.4; ${a.completed ? 'text-decoration: line-through;' : ''}">
                    ${isTask ? `<strong>${a.date} @ ${a.time}</strong><br>${a.description}` : (a.isNote ? a.content : '')}
                </div>
            </div>
        `;
    }).join('');
}

// 4. PIPELINE & LEAD RENDERING
function renderLeads() {
    const container = document.getElementById('leads-container');
    if (!container) return;
    container.innerHTML = '';

    const filtered = leads.filter(l => l.status === currentFilter);

    filtered.forEach(lead => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'lead-card-container';
        
        const companyInfo = lead.company ? `<span style="font-weight:600; color:var(--teal-primary)">${lead.company}</span> • ` : "";
        
        // FIX: Added single quotes around lead.id in both onclicks
        cardWrapper.innerHTML = `
            <div class="lead-card" onclick="openLeadDetail('${lead.id}')">
                <div class="card-info">
                    <h3>${lead.name}</h3>
                    <p>${companyInfo}${lead.source} • £${lead.value}</p>
                </div>
                <button class="delete-btn-inline" onclick="event.stopPropagation(); requestDelete('${lead.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        container.appendChild(cardWrapper);
    });
}

function filterLeads(stage, el) {
    currentFilter = stage;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    renderLeads();
}


function openLeadDetail(id) {
    activeLeadId = id;
    const lead = leads.find(l => l.id === id);
    if (lead) {
        const phoneInput = document.getElementById('detail-phone-input');
        const emailInput = document.getElementById('detail-email-input');
        
        document.getElementById('detail-name').innerText = lead.name;
        document.getElementById('detail-company-input').value = lead.company || '';
        document.getElementById('detail-status-select').value = lead.status;
        phoneInput.value = lead.phone || '';
        emailInput.value = lead.email || '';
        
        // CLEAR ERRORS WHEN OPENING NEW LEAD
        phoneInput.classList.remove('invalid-input');
        emailInput.classList.remove('invalid-input');
        
        // Hide existing error message texts if they exist
        const pErr = document.getElementById('detail-phone-input-error-msg');
        const eErr = document.getElementById('detail-email-input-error-msg');
        if (pErr) pErr.style.display = 'none';
        if (eErr) eErr.style.display = 'none';
        
        document.getElementById('lead-detail-screen').style.display = 'flex';
    }
}

// --- 5. DELETE LOGIC ---

function requestDelete(id) {
    activeLeadId = id;
    openDeleteModal();
}

function openDeleteModal() { 
    document.getElementById('delete-modal').style.display = 'flex'; 
    // Re-bind the click handler to ensure it uses the current activeLeadId
    document.getElementById('confirm-delete-btn').onclick = () => { 
        deleteLead(activeLeadId); 
        closeDeleteModal(); 
    }; 
}

function closeDeleteModal() { 
    document.getElementById('delete-modal').style.display = 'none'; 
}

async function deleteLead(id) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            showToast("You must be logged in to delete.");
            return;
        }

        // 1. Delete from Firestore first using the string ID
        await db.collection("leads").doc(String(id)).delete();

        // 2. Update local state
        leads = leads.filter(l => String(l.id) !== String(id));
        
        // 3. Update Local Storage
        localStorage.setItem('myLeads', JSON.stringify(leads));
        
        // 4. Refresh UI
        renderLeads();
        if (typeof closeFullProfile === "function") closeFullProfile();
        
        showToast("Lead permanently deleted");
        console.log("Firestore: Document deleted:", id);

    } catch (error) {
        console.error("Error deleting lead:", error);
        showToast("Delete failed. Please check connection.");
    }
}

// 6. MODAL UTILITIES
function openModal() {
    document.getElementById('add-lead-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('add-lead-modal').style.display = 'none';
}

function closeDetail() { 
    document.getElementById('lead-detail-screen').style.display = 'none'; 
}

function handleBackdropClick(event) {
    if (event.target.id === 'lead-detail-screen') closeDetail();
}

function openValidationModal(msg) {
    if(msg) document.getElementById('validation-error-msg').innerText = msg;
    document.getElementById('validation-modal').style.display = 'flex';
}

function closeValidationModal() {
    document.getElementById('validation-modal').style.display = 'none';
}

// 7. DATA PERSISTENCE & SYNC (Optimized for Mobile)
async function saveData() { 
    // 1. Instant Local Save (Keeps UI snappy)
    localStorage.setItem('myLeads', JSON.stringify(leads)); 

    // 2. Background Cloud Sync
    const user = firebase.auth().currentUser;
    if (!user) {
        console.log("Not logged in: Skipping cloud sync.");
        return;
    }

    try {
        const batch = firebase.firestore().batch();
        
        leads.forEach(lead => {
            // Ensure every lead has the owner's ID
            lead.userId = user.uid; 
            
            // Convert numeric IDs to strings for Firestore compatibility
            const leadIdStr = lead.id.toString();
            const docRef = firebase.firestore().collection("leads").doc(leadIdStr);
            
            batch.set(docRef, lead, { merge: true });
        });

        // Use 'await' to ensure the batch completes, but catch errors
        // so a network failure doesn't crash the whole script.
        await batch.commit();
        console.log("Cloud sync successful.");
    } catch (err) {
        console.error("Cloud save failed (Device may be offline):", err);
        // We don't alert the user here because Offline Persistence 
        // will handle it once they reconnect.
    }
}

const leadForm = document.getElementById('lead-form');
if(leadForm) {
    leadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // 1. Run Validation on Save
        const isPhoneValid = validateField(document.getElementById('lead-phone'), 'phone');
        const isEmailValid = validateField(document.getElementById('lead-email'), 'email');

        // 2. Stop if invalid
        if (!isPhoneValid || !isEmailValid) {
            if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback for error
            return; 
        }

        // 3. Continue with Save logic if valid
        const user = firebase.auth().currentUser; 
        if(!user) {
            showToast("Please log in to add leads.");
            return;
        }

        const newLeadRef = firebase.firestore().collection("leads").doc();

        const newLead = {
            id: newLeadRef.id, 
            userId: user.uid,
            name: document.getElementById('lead-name').value,
            company: document.getElementById('lead-company').value,
            source: document.getElementById('lead-source').value,
            value: document.getElementById('lead-value').value,
            phone: document.getElementById('lead-phone').value,
            email: document.getElementById('lead-email').value,
            status: 'New',
            activities: [],
            notes: "",
            address: ""
        };

        leads.push(newLead);
        await saveData();
        renderLeads();
        this.reset();
        closeModal();
        showToast("Lead Saved Successfully!");
    });
}

function updateLeadContact() {
    const idx = leads.findIndex(l => l.id === activeLeadId);
    if (idx !== -1) {
        const pVal = document.getElementById('detail-phone-input').value;
        const eVal = document.getElementById('detail-email-input').value;

        if ((pVal !== "" && !validatePhone(pVal)) || (eVal !== "" && !validateEmail(eVal))) return; 

        leads[idx].company = document.getElementById('detail-company-input').value;
        leads[idx].phone = pVal;
        leads[idx].email = eVal;
        saveData();
        renderLeads();
    }
}

function updateLeadStatus() {
    const idx = leads.findIndex(l => l.id === activeLeadId);
    if (idx !== -1) {
        leads[idx].status = document.getElementById('detail-status-select').value;
        saveData();
        renderLeads();
        closeDetail();
    }
}

function syncProfileToData() {
    const idx = leads.findIndex(l => l.id === activeLeadId);
    if (idx !== -1) {
        const pVal = document.getElementById('profile-phone-input').value;
        const eVal = document.getElementById('profile-email-input').value;

        if ((pVal !== "" && !validatePhone(pVal)) || (eVal !== "" && !validateEmail(eVal))) return;

        leads[idx].company = document.getElementById('profile-company-input').value;
        leads[idx].phone = pVal;
        leads[idx].email = eVal;
        leads[idx].address = document.getElementById('profile-address-input').value;
        updateProfileSubInfo(leads[idx]);
        saveData();
        renderLeads();
    }
}

function updateProfileSubInfo(lead) {
    const companyDisplay = lead.company ? `${lead.company} • ` : "";
    const infoEl = document.getElementById('profile-sub-info');
    if(infoEl) infoEl.innerText = `${companyDisplay}${lead.source} • £${lead.value}`;
}

// 8. VALIDATION LOGIC
function validateEmail(email) { 
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); 
}

function getFormattedTime(date = new Date()) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function validatePhone(phone) { 
    const clean = phone.replace(/[^0-9+]/g, '');
    return clean.length >= 10; 
}

function validateLive(inputElement, type) {
    // If the box is already red (invalid), check if the new typing has fixed it
    if (inputElement.classList.contains('invalid-input')) {
        const value = inputElement.value.trim();
        let isValid = true;

        if (type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = emailRegex.test(value);
        } else if (type === 'phone') {
    const phoneRegex = /^(\+44)?\d{11}$/;
    isValid = phoneRegex.test(value.replace(/\s+/g, ''));
}

        if (isValid) {
            inputElement.classList.remove('invalid-input');
            const errorDisplay = document.getElementById(inputElement.id + '-error');
            if (errorDisplay) errorDisplay.style.display = 'none';
        }
    }
}

function toggleSearch(show) {
    const overlay = document.getElementById('search-overlay');
    overlay.style.display = show ? 'block' : 'none';
    if (show) {
        document.getElementById('search-input').focus();
    } else {
        document.getElementById('search-input').value = '';
        document.getElementById('search-results').innerHTML = '';
    }
}

function handleSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!query) {
        resultsContainer.innerHTML = '';
        return;
    }

    const filtered = leads.filter(lead => 
        lead.name.toLowerCase().includes(query.toLowerCase()) || 
        (lead.company && lead.company.toLowerCase().includes(query.toLowerCase()))
    );

    // FIX: Added quotes around lead.id
    resultsContainer.innerHTML = filtered.map(lead => `
        <div class="search-result-item" onclick="goToLeadFromSearch('${lead.id}')">
            <div style="font-weight:600; color:var(--text-dark);">${lead.name}</div>
            <div style="font-size:12px; color:#666;">${lead.company || 'No Company'} • ${lead.status}</div>
        </div>
    `).join('');
}

function goToLeadFromSearch(id) {
    activeLeadId = id;
    toggleSearch(false);
    openFullProfile();
}

let currentCalendarDate = new Date();

function openCalendar() {
    document.getElementById('calendar-modal').style.display = 'flex';
    renderCalendar();
}

function closeCalendar() {
    document.getElementById('calendar-modal').style.display = 'none';
}

function changeMonth(offset) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    renderCalendar();
}

// Uniform Notification Function
window.showToast = function(message) {
    const toastContainer = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');

    if (!toastContainer || !toastMessage) return;

    toastMessage.innerText = message;
    
    // Ensure it's above the Login screen
    toastContainer.style.zIndex = "20001";
    toastContainer.style.display = 'flex'; 

    // Use a tiny timeout to allow display:flex to register before animating
    setTimeout(() => {
        toastContainer.classList.add('show');
    }, 10);

    if (navigator.vibrate) navigator.vibrate(30);

    setTimeout(() => {
        toastContainer.classList.remove('show');
        setTimeout(() => { 
            toastContainer.style.display = 'none'; 
        }, 3000); // Give it time to fade out
    }, 3000);
};

// --- NOTIFICATIONS & REMINDERS ---

// Helper function to save notifications to localStorage, keyed by user ID
function saveNotificationsForCurrentUser() {
    const user = firebase.auth().currentUser;
    if (user) {
        localStorage.setItem(user.uid + '_notifications', JSON.stringify(notifications));
    }
}

function toggleNotifications() {
    const modal = document.getElementById('notif-modal');
    // Simple toggle logic
    if (modal.style.display === 'none' || !modal.style.display) {
        modal.style.display = 'flex';
        // Mark all as read when opening
        notifications.forEach(n => n.read = true);
        saveNotificationsForCurrentUser();
        
        renderNotificationList();
        updateNotifUI();
    } else {
        modal.style.display = 'none';
    }
}

function renderNotificationList() {
    const container = document.getElementById('notif-list-container');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; color:#999; padding:40px 20px;">
                <div style="font-size:30px; margin-bottom:10px;">🔔</div>
                <p style="font-size:13px; margin:0;">No new notifications</p>
            </div>`;
        return;
    }

    // Header with Clear All button
    let html = `
        <div style="padding: 12px; border-bottom: 2px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
            <span style="font-size: 11px; font-weight: 800; color: #999; text-transform: uppercase; letter-spacing:0.5px;">Reminders</span>
            <button onclick="clearAllNotifications()" style="background: none; border: none; color: #ff3b30; font-size: 11px; font-weight: 700; cursor: pointer;">Clear All</button>
        </div>
    `;

    // Map through notifications
    // FIX: Added '${n.leadId}' quotes to handle alphanumeric strings
    html += notifications.map((n, index) => `
        <div class="notif-item"
             style="padding:15px 12px; border-bottom:1px solid #f5f5f5; background:white; cursor:pointer; position: relative;"
             onclick="goToLeadFromNotification('${n.leadId}')">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; padding-right:20px;">
                <strong style="font-size:13px; color:var(--teal-primary);">${n.leadName}</strong>
                <span style="font-size:10px; color:#999;">${n.time}</span>
            </div>
            <div style="font-size:13px; color:#333; line-height:1.4; padding-right:25px;">
                ${n.taskDesc}
            </div>
            
            <button onclick="event.stopPropagation(); deleteNotification(${index})" 
                    style="position: absolute; top: 12px; right: 10px; background: #f0f0f0; border: none; color: #999; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size: 14px; cursor: pointer;">
                &times;
            </button>
        </div>
    `).join('');

    container.innerHTML = html;
}

function goToLeadFromNotification(leadId) {
    // FIX: Ensure activeLeadId is set as a string
    activeLeadId = String(leadId);
    const modal = document.getElementById('notif-modal');
    if (modal) modal.style.display = 'none';
    
    // Standard profile opening logic
    openFullProfile(); 
}

function updateNotifUI() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (unreadCount > 0) {
        badge.innerText = unreadCount;
        badge.style.display = 'flex'; // Usually flex works better for centered text
    } else {
        badge.style.display = 'none';
    }
}

function clearAllNotifications() {
    // No need for a confirm if you want it fast, but good for safety
    notifications = [];
    saveNotificationsForCurrentUser();
    renderNotificationList();
    updateNotifUI();
}

function deleteNotification(index) {
    notifications.splice(index, 1);
    saveNotificationsForCurrentUser();
    renderNotificationList();
    updateNotifUI();
}

// 9. REVISED SAVE TASK (With Reminder Support)
async function saveTask() {
    const descInput = document.getElementById('task-desc');
    const dateInput = document.getElementById('task-date');
    const timeInput = document.getElementById('task-time');
    const reminderOffset = document.getElementById('task-reminder-offset').value;

    if (!descInput.value || !dateInput.value) {
        openValidationModal("Please provide a description and date.");
        return;
    }

    const lead = leads.find(l => l.id === activeLeadId);
    if (!lead) return;

    const taskDateTime = new Date(`${dateInput.value}T${timeInput.value || '00:00'}`).getTime();
    const now = new Date();
    // Unified timestamp for the activity log
    const timestampStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + 
                         ', ' + getFormattedTime(now);

    const taskEntry = {
        id: Date.now(),
        leadId: activeLeadId, 
        leadName: lead.name,
        type: 'Task',
        description: descInput.value,
        date: dateInput.value,
        time: timeInput.value || "00:00",
        taskTimestamp: taskDateTime, 
        reminderOffset: reminderOffset,
        timestamp: timestampStr,
        completed: false,
        notified: false
    };

    if (reminderOffset !== 'none') {
        try {
            await scheduleNativeNotification(taskEntry);
        } catch (err) {
            console.error("Native notification failed:", err);
        }
        // REMOVED: notifications.unshift(newNotif) from here. 
        // It will now only be added when the notification triggers or is clicked.
    }

    if (!lead.activities) lead.activities = [];
    lead.activities.unshift(taskEntry);

    saveData();
    renderActivities(lead);
    
    descInput.value = '';
    dateInput.value = '';
    timeInput.value = '';
    document.getElementById('task-reminder-offset').value = 'none';
    
    showToast("Task & Reminder Set!");
}

function renderCalendar() {
    const monthYear = document.getElementById('calendar-month-year');
    const daysContainer = document.getElementById('calendar-days');
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    monthYear.innerText = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(currentCalendarDate);
    daysContainer.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startingPoint = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < startingPoint; i++) { daysContainer.innerHTML += `<div></div>`; }

    const allTasks = leads.flatMap(l => (l.activities || []).filter(a => a.type === 'Task'));

    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTasks = allTasks.filter(t => t.date === dateString);
        const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        
        const hasTaskClass = dayTasks.length > 0 ? 'has-task' : '';
        
        let indicator = '';
        if (dayTasks.length > 1) {
            indicator = `<span class="task-count-badge" style="position:absolute; bottom:2px; right:2px; background:var(--teal-primary); color:white; font-size:9px; width:14px; height:14px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700;">${dayTasks.length}</span>`;
        } else if (dayTasks.length === 1) {
            indicator = `<span class="task-dot" style="background:${dayTasks[0].completed ? '#4caf50' : '#ff9500'}"></span>`;
        }

        daysContainer.innerHTML += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasTaskClass}" onclick="handleDateClick('${dateString}')" style="position:relative;">
                ${day}
                ${indicator}
            </div>`;
    }
}

function handleDateClick(dateString) {
    const allTasks = leads.flatMap(l => (l.activities || []).map(a => ({...a, leadName: l.name, leadId: l.id})));
    const tasksForDay = allTasks.filter(t => t.type === 'Task' && t.date === dateString);

    if (tasksForDay.length === 0) return;

    // If only one task, go straight to lead
    if (tasksForDay.length === 1) {
        // Change from tasksForDay[0].toString() to the specific leadId
        activeLeadId = String(tasksForDay[0].leadId); 
        closeCalendar();
        openFullProfile();
        return;
    }

    // If multiple tasks, show the picker modal
    const modal = document.getElementById('calendar-task-modal');
    const listContainer = document.getElementById('calendar-task-list');
    const dateHeader = document.getElementById('calendar-modal-date');

    listContainer.style.maxHeight = '300px'; // Limits the height of the list
    listContainer.style.overflowY = 'auto'; // Enables scrolling
    listContainer.style.paddingRight = '5px'; // Prevents scrollbar from overlapping text

    dateHeader.innerText = `Tasks for ${new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    
    listContainer.innerHTML = tasksForDay.map(task => `
    <div class="search-result-item" onclick="goToLeadFromCalendarPicker('${task.leadId}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700;">${task.description}</span>
            <span style="font-size:11px; color:#ff9500;">${task.time}</span>
        </div>
        <div style="font-size:12px; color:#666;">Lead: ${task.leadName}</div>
    </div>
`).join('');

    modal.style.display = 'flex';
}

function goToLeadFromCalendarPicker(leadId) {
    activeLeadId = leadId;
    document.getElementById('calendar-task-modal').style.display = 'none';
    closeCalendar();
    // Use a small timeout to ensure the UI has time to transition
    setTimeout(openFullProfile, 50);
}

function closeCalendarTaskModal(event) {
    if (event.target.id === 'calendar-task-modal') {
        document.getElementById('calendar-task-modal').style.display = 'none';
    }
}

function renderAllTasks() {
    const container = document.getElementById('all-tasks-container');
    if (!container) return;
    container.innerHTML = '';

    let allTasks = [];
    leads.forEach(lead => {
        if (lead.activities) {
            lead.activities.forEach(act => {
                // Only show tasks that haven't been "cleared" from this view
                if (act.type === 'Task' && !act.clearedFromGlobalList) {
                    allTasks.push({ ...act, belongsTo: lead.name, belongsToId: lead.id });
                }
            });
        }
    });

    // Sort: Uncompleted tasks first, then by date
    allTasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed - b.completed;
        return new Date(a.taskTimestamp) - new Date(b.taskTimestamp);
    });

    if (allTasks.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:60px 20px; color:#888;">✅ All tasks cleared!</div>';
        return;
    }

    allTasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'lead-card'; 
        const isComp = task.completed;
        
        card.style.cssText = `
            margin-bottom: 8px !important;
            padding: 12px 15px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            border-left: 4px solid ${isComp ? '#4caf50' : '#ff9500'} !important;
            opacity: ${isComp ? '0.7' : '1'};
            cursor: pointer;
        `;

        card.onclick = () => {
            activeLeadId = task.belongsToId;
            openFullProfile();
        };

        card.innerHTML = `
            <div style="flex: 1; ${isComp ? 'text-decoration: line-through;' : ''}">
                <div style="font-size: 10px; font-weight: 700; color: ${isComp ? '#4caf50' : '#ff9500'}; text-transform: uppercase;">
                    ${isComp ? 'Completed' : `${task.date} @ ${task.time}`}
                </div>
                <div style="font-weight: 700; font-size: 15px; color: #333; margin: 2px 0;">
                    ${task.description}
                </div>
                <div style="font-size: 12px; color: #666;">Lead: ${task.belongsTo}</div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 5px;">
                ${isComp ? `
                    <button onclick="event.stopPropagation(); clearTaskFromList('${task.belongsToId}', '${task.id}')" 
                            style="background:#f0f0f0; border:none; border-radius:6px; padding:6px 10px; font-size:11px; color:#666; cursor:pointer; font-weight:600;">
                        CLEAR
                    </button>
                ` : ''}
                
                <div onclick="event.stopPropagation(); toggleTaskComplete('${task.belongsToId}', '${task.id}')" 
                     style="padding: 10px; cursor: pointer; display: flex; align-items: center;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${isComp ? '#4caf50' : '#ddd'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Check for reminders every 30 seconds
setInterval(() => {
    const now = Date.now();
    let needsUpdate = false;

    leads.forEach(lead => {
        if (!lead.activities) return;
        lead.activities.forEach(task => {
            if (task.type === 'Task' && task.reminderOffset !== 'none' && !task.notified && !task.completed) {
                const reminderTime = task.taskTimestamp - (parseInt(task.reminderOffset) * 60000);
                
                if (now >= reminderTime) {
                    // Check if already in bell list to prevent duplicates
                    if (!notifications.some(n => n.taskId === task.id)) {
                        const newNotif = {
                            id: Date.now() + Math.random(),
                            taskId: task.id,
                            taskDesc: task.description,
                            leadId: String(lead.id),
                            leadName: lead.name,
                            time: getFormattedTime(), // Using unified 24h helper
                            read: false
                        };
                        notifications.unshift(newNotif);
                    }
                    task.notified = true;
                    needsUpdate = true;
                }
            }
        });
    });

    if (needsUpdate) {
        saveData(); 
        saveNotificationsForCurrentUser();
        updateNotifUI();
        if (document.getElementById('notif-modal').style.display === 'flex') {
            renderNotificationList();
        }
    }
}, 30000);

// Initial Load
renderLeads();
updateNotifUI();

// --- 10. AUTHENTICATION & UI LOGIC ---

let isSignUpMode = true;

// 10a. Auth State Observer (Controls Splash Screen & Data Sync)
firebase.auth().onAuthStateChanged((user) => {
    const splash = document.getElementById('splash-screen');
    const authScreen = document.getElementById('auth-screen');

    if (user) {
        // User is Logged In
        if (authScreen) authScreen.style.setProperty('display', 'none', 'important');

        // Load notifications specific to the logged-in user
        // FIX: Clear leads array before loading new data
        leads = [];
        renderLeads();

        // Load notifications specific to the logged-in user
        const userNotifications = localStorage.getItem(user.uid + '_notifications');
        notifications = userNotifications ? JSON.parse(userNotifications) : [];
        updateNotifUI();
        
        if (typeof syncLeadsFromServer === "function") {
            syncLeadsFromServer();
        }
        updateUserInitials(user); 

    } else {
        // User is Logged Out
        if (authScreen) {
            authScreen.style.setProperty('display', 'flex', 'important');
            setAuthMode('login');

            // Clear notifications when logged out
            leads = [];
            notifications = [];
            updateNotifUI();
        }
    }

    // Hide splash screen ONLY after logic has decided what to show
    setTimeout(() => {
        // THE FIX: Unhide the app content right as we start fading the splash
        document.body.classList.add('app-ready');

        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 600);
        }
    }, 2000); 
});
// 10b. Toggle between Login and Sign Up UI
function setAuthMode(mode) {
    isSignUpMode = (mode === 'signup');
    
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btn = document.getElementById('auth-button');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');
    const nameFields = document.getElementById('auth-name-fields');
    const forgotArea = document.getElementById('forgot-password-area');

    if (isSignUpMode) {
        title.innerText = "Create Account";
        subtitle.innerText = "Set up your secure CRM access";
        btn.innerText = "Sign Up";
        toggleText.innerText = "Already have an account?";
        toggleLink.innerText = "Log In";
        nameFields.style.display = "block";
        forgotArea.style.display = "none";
    } else {
        title.innerText = "Welcome Back";
        subtitle.innerText = "Log in to manage your leads";
        btn.innerText = "Log In";
        toggleText.innerText = "Don't have an account?";
        toggleLink.innerText = "Sign Up";
        nameFields.style.display = "none";
        forgotArea.style.display = "block";
    }
}

function toggleAuthMode() {
    setAuthMode(isSignUpMode ? 'login' : 'signup');
}

// 10c. Handle Sign Up and Log In Actions
async function handleAuthAction() {
    const email = document.getElementById('auth-username').value.trim();
    const pass = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    const authBtn = document.getElementById('auth-button');

    errorEl.style.display = 'none';

    const triggerError = (msg) => {
        errorEl.innerText = msg;
        errorEl.style.display = 'block';
        if (navigator.vibrate) navigator.vibrate(50);
        authBtn.style.transform = "translateX(5px)";
        setTimeout(() => authBtn.style.transform = "translateX(-5px)", 50);
        setTimeout(() => authBtn.style.transform = "translateX(0)", 100);
    };

    try {
        if (isSignUpMode) {
            const firstName = document.getElementById('auth-first-name').value.trim();
            const lastName = document.getElementById('auth-last-name').value.trim();

            if (!email || !pass || !firstName || !lastName) {
                triggerError("Please fill in all fields.");
                return;
            }

            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, pass);
            const user = userCredential.user;

            // Save Name to Auth Profile
            await user.updateProfile({
                displayName: `${firstName} ${lastName}`
            });

            // Save extra details to Firestore
            const initials = (firstName[0] + lastName[0]).toUpperCase();
            await db.collection("users").doc(user.uid).set({
                firstName: firstName,
                lastName: lastName,
                initials: initials,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            updateUserInitials(user);
            showToast(`Welcome, ${firstName}!`);
        } else {
            await auth.signInWithEmailAndPassword(email, pass);
            showToast("Welcome back!");
        }
    } catch (error) {
        // For login failures, provide a user-friendly, generic error message.
        // This prevents revealing whether the username or password was the incorrect part.
        if (!isSignUpMode && (
            error.code === 'auth/invalid-credential' ||
            error.code === 'auth/user-not-found' ||
            error.code === 'auth/wrong-password' ||
            error.code === 'auth/invalid-email')) {
            triggerError("Incorrect username or password.");
        } else {
            // For sign-up errors (like 'email-already-in-use') or others, the default message is more descriptive.
            triggerError(error.message);
        }
    }
}

// 10d. Global Avatar Update (Updates every "JS" circle in the app)
function updateUserInitials(user) {
    const avatarElements = document.querySelectorAll('.user-initials-display');
    let initials = "??";

    if (user && user.displayName) {
        // Split by space and remove empty strings caused by extra spaces
        const names = user.displayName.trim().split(/\s+/).filter(Boolean);
        
        if (names.length >= 2) {
            // Take first letter of first name and first letter of last name
            initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
        } else if (names.length === 1) {
            // If only one name exists, take the first two letters or just the first
            initials = names[0].substring(0, 1).toUpperCase();
        }
    } else if (user && user.email) {
        initials = user.email[0].toUpperCase();
    }

    avatarElements.forEach(el => {
        el.innerText = initials;
    });
}

// 10e. Profile Settings Logic
function openProfilePage() {
    showScreen('settings-screen');
}

async function renderSettingsContent() {
    const user = auth.currentUser;
    const container = document.getElementById('settings-screen');
    if (!user || !container) return;

    const userDoc = await db.collection("users").doc(user.uid).get();
    const data = userDoc.data() || { firstName: "", lastName: "", initials: "" };

    container.innerHTML = `
        <header class="teal-header" style="min-height: auto; padding: 12px 20px 10px;">
            <div class="header-top" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 5px;">
                <button onclick="showScreen('pipeline-screen')" style="background:none; border:none; color:white; cursor:pointer; padding: 0;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                        <path d="M19 12H5M11 18l-6-6 6-6"/>
                    </svg>
                </button>
                <div class="user-initials-display">${data.initials || '??'}</div>
            </div>
            <div class="page-identity">
                <h2 style="margin: 0; font-size: 14px; color: rgba(255, 255, 255, 0.85); text-transform: uppercase; letter-spacing: 1px;">User Settings</h2>
            </div>
        </header>

        <main class="content" style="padding: 20px;">
            <div class="settings-card">
                <div class="settings-group">
                    <label>First Name</label>
                    <input type="text" id="edit-firstName" value="${data.firstName || ''}" class="settings-input">
                </div>

                <div class="settings-group">
                    <label>Last Name</label>
                    <input type="text" id="edit-lastName" value="${data.lastName || ''}" class="settings-input">
                </div>

                <div class="settings-group">
                    <label>Email Address</label>
                    <input type="text" value="${user.email}" disabled class="settings-input" style="background: #f0f0f0; color: #888;">
                </div>

                <button onclick="updateUserProfile()" class="save-btn" style="margin-top: 10px; width: 100%;">Update Profile</button>
                
                <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;">

                <h3 style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Support & Legal</h3>
                
                <button onclick="window.open('https://gist.github.com/MohiuddinKhanTushar/a9dfa87a7e1dee5071e230a08d538c2f', '_blank')" 
                        style="width: 100%; padding: 14px; background: #fafafa; border: 1px solid #eee; border-radius: 12px; text-align: left; margin-bottom: 10px; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Privacy Policy</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>

                <button onclick="window.location.href='mailto:closedloopcrm@gmail.com'" 
                        style="width: 100%; padding: 14px; background: #fafafa; border: 1px solid #eee; border-radius: 12px; text-align: left; margin-bottom: 20px; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Contact Support</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>

                <button onclick="logout()" style="width: 100%; padding: 15px; background: none; color: #ff3b30; border: 1px solid #ff3b30; border-radius: 12px; font-weight: 700; cursor: pointer;">
                    Logout
                </button>
            </div>
            <p style="text-align: center; color: #ccc; font-size: 11px; margin-top: 30px;">CLOSED LOOP CRM v1.0.6</p>
        </main>
    `;
}

async function updateUserProfile() {
    const user = auth.currentUser;
    const newFirstName = document.getElementById('edit-firstName').value.trim();
    const newLastName = document.getElementById('edit-lastName').value.trim();

    if (!newFirstName || !newLastName || !user) return;
    const initials = (newFirstName[0] + newLastName[0]).toUpperCase();

    try {
        await db.collection("users").doc(user.uid).update({
            firstName: newFirstName,
            lastName: newLastName,
            initials: initials
        });
        await user.updateProfile({ displayName: `${newFirstName} ${newLastName}` });
        updateUserInitials(user);
        showToast("Profile Updated!");
    } catch (error) {
        showToast("Update failed.");
    }
}

function logout() {
    auth.signOut().then(() => window.location.reload());
}

window.handleForgotPassword = function() {
    const email = document.getElementById('auth-username').value.trim();
    if (!email) return showToast("Enter your email first");
    auth.sendPasswordResetEmail(email)
        .then(() => showToast("Reset link sent!"))
        .catch(err => showToast("Error: " + err.message));
};

function syncLeadsFromServer() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    db.collection("leads")
      .where("userId", "==", user.uid)
      .onSnapshot((snapshot) => {
        leads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Local cache only
        localStorage.setItem('myLeads', JSON.stringify(leads));

        renderLeads();
        if (document.getElementById('tasks-screen')?.style.display === 'block') {
            renderAllTasks();
        }

        console.log("Cloud Sync: Success");
    }, console.error);
}


function renderROI() {
    const pipelineEl = document.getElementById('roi-pipeline-total');
    const revenueEl = document.getElementById('roi-revenue-total');
    const winRateEl = document.getElementById('roi-win-rate');
    const sourceListEl = document.getElementById('roi-source-list');
    const projectedEl = document.getElementById('roi-projected-revenue'); // New Element

    if (!pipelineEl) return;

    let totalPipelineValue = 0;
    let totalWonValue = 0;
    let totalProjectedValue = 0; // Track weighted value
    let wonCount = 0;
    let lostCount = 0;

    // Track revenue by source
    const sourceData = {};

    leads.forEach(lead => {
        const val = parseFloat(lead.value) || 0;
        
        if (lead.status === 'Won') {
            totalWonValue += val;
            wonCount++;
        } else if (lead.status === 'Lost') {
            lostCount++; 
        } else {
            // Only active leads (New, In-Progress) count as Pipeline
            totalPipelineValue += val;

            // --- Projected Revenue Logic ---
            if (lead.status === 'New') {
                totalProjectedValue += (val * 0.10); // 10% Probability
            } else if (lead.status === 'In-Progress') {
                totalProjectedValue += (val * 0.50); // 50% Probability
            }
        }

        // Track Revenue by Source (only for Won leads)
        if (lead.status === 'Won' && lead.source) {
            sourceData[lead.source] = (sourceData[lead.source] || 0) + val;
        }
    });

    // Update UI Labels
    if (pipelineEl) pipelineEl.innerText = `£${totalPipelineValue.toLocaleString()}`;
    if (revenueEl) revenueEl.innerText = `£${totalWonValue.toLocaleString()}`;
    if (projectedEl) projectedEl.innerText = `£${Math.round(totalProjectedValue).toLocaleString()}`;
    
    // Win Rate Calculation: Won / (Won + Lost)
    const closedLeads = wonCount + lostCount;
    const winRate = closedLeads > 0 ? Math.round((wonCount / closedLeads) * 100) : 0;
    if (winRateEl) winRateEl.innerText = `${winRate}%`;

    // Render Source Breakdown
    sourceListEl.innerHTML = '';
    const sortedSources = Object.entries(sourceData).sort((a, b) => b[1] - a[1]);

    sortedSources.forEach(([source, value]) => {
        const percentage = totalWonValue > 0 ? (value / totalWonValue) * 100 : 0;
        sourceListEl.innerHTML += `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                    <span style="font-weight: 600;">${source}</span>
                    <span style="color: #666;">£${value.toLocaleString()}</span>
                </div>
                <div style="width: 100%; height: 8px; background: #eee; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: var(--teal-primary);"></div>
                </div>
            </div>
        `;
    });

    if (sortedSources.length === 0) {
        sourceListEl.innerHTML = '<p style="color:#999; font-size:12px; text-align:center;">No "Won" leads to analyze yet.</p>';
    }
}
function validateField(inputElement, type) {
    if (!inputElement) return true;

    const value = inputElement.value.trim();
    let isValid = true;
    let message = "";

    // 1. Logic check
    if (value === "") {
        isValid = true; // Allow empty if your form doesn't require these fields
    } else if (type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        isValid = emailRegex.test(value);
        message = "Please enter a valid email";
    } else if (type === 'phone') {
    // This regex checks for an optional +44 and exactly 11 digits
    const phoneRegex = /^(\+44)?\d{11}$/;
    isValid = phoneRegex.test(value.replace(/\s+/g, '')); // Removes spaces before checking
    message = "Enter 11 digits including UK prefix";
}

    // 2. Visual updates
    let errorId = inputElement.id + '-error';
    let errorDisplay = document.getElementById(errorId);
    
    if (!errorDisplay) {
        errorDisplay = document.createElement('div');
        errorDisplay.id = errorId;
        errorDisplay.className = 'error-message';
        inputElement.parentNode.insertBefore(errorDisplay, inputElement.nextSibling);
    }

    if (!isValid) {
        inputElement.classList.add('invalid-input');
        errorDisplay.innerText = message;
        errorDisplay.style.display = 'block';
    } else {
        inputElement.classList.remove('invalid-input');
        errorDisplay.style.display = 'none';
    }

    return isValid;
}

// --- EDIT LEAD MODAL LOGIC ---

function openEditLeadModal() {
    // Find the lead in your existing 'leads' array using 'activeLeadId'
    const lead = leads.find(l => l.id === activeLeadId);
    
    if (!lead) {
        console.error("No lead data found for ID:", activeLeadId);
        showToast("Error: Lead not found");
        return;
    }

    // Populate the modal fields with current data
    document.getElementById('edit-lead-name').value = lead.name || "";
    document.getElementById('edit-lead-source').value = lead.source || "";
    document.getElementById('edit-lead-value').value = lead.value || 0;
    
    // Show the modal
    document.getElementById('edit-lead-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-lead-modal').style.display = 'none';
}

async function saveLeadEdits() {
    const newName = document.getElementById('edit-lead-name').value.trim();
    const newSource = document.getElementById('edit-lead-source').value.trim();
    const newValue = document.getElementById('edit-lead-value').value;

    if (!newName) {
        showToast("Lead name cannot be empty");
        return;
    }

    // 1. Find the lead index in your global array
    const idx = leads.findIndex(l => l.id === activeLeadId);
    
    if (idx !== -1) {
        // 2. Update the local data object
        leads[idx].name = newName;
        leads[idx].source = newSource;
        leads[idx].value = newValue;

        // 3. Update the UI headings on the Profile Screen immediately
        document.getElementById('profile-main-name').innerText = newName;
        updateProfileSubInfo(leads[idx]);

        // 4. Save to LocalStorage and Firebase using your existing sync function
        await saveData();

        // 5. Refresh the pipeline list in the background
        renderLeads();

        closeEditModal();
        showToast("Lead updated");
    } else {
        showToast("Error updating lead");
    }
}

// ACTIVATE VALIDATION
document.addEventListener('DOMContentLoaded', () => {
    // We no longer call applyValidation here because 
    // validation now happens inside the 'submit' event of the lead form.
    console.log("CRM Ready: Validation will trigger on Save.");
});

// --- SINGLE NOTIFICATION CLICK LISTENER ---
if (window.Capacitor && window.Capacitor.Plugins.LocalNotifications) {
    window.Capacitor.Plugins.LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const taskData = action.notification.extra;

        if (taskData && taskData.leadId) {
            const alreadyInList = notifications.some(n => n.taskId === taskData.id);

            if (!alreadyInList) {
                const newNotif = {
                    id: Date.now(),
                    taskId: taskData.id,
                    taskDesc: taskData.description || "Task Reminder",
                    leadId: String(taskData.leadId),
                    leadName: taskData.leadName || "Lead",
                    time: taskData.time || getFormattedTime(), // Use task time or current 24h time
                    date: taskData.date || "",
                    read: false
                };

                notifications.unshift(newNotif);
                saveNotificationsForCurrentUser();
                updateNotifUI();

                if (document.getElementById('notif-modal')?.style.display === 'flex') {
                    renderNotificationList();
                }
            }
            
            activeLeadId = String(taskData.leadId);
            openFullProfile();
        }
    });
}

function makeSwipable(el, closeFunction) {
    let startY = 0;
    let currentY = 0;

    el.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        el.style.transition = 'none'; 
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
        // If the user is scrolling content inside the modal, don't swipe the whole modal
        if (el.scrollTop > 0) return;

        currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;

        // Only allow dragging downwards
        if (deltaY > 0) {
            el.style.transform = `translateY(${deltaY}px)`;
        }
    }, { passive: true });

   el.addEventListener('touchend', (e) => {
    // Add the smooth transition back in
    el.style.transition = 'transform 0.4s cubic-bezier(0.15, 1, 0.3, 1)';
    
    const deltaY = currentY - startY;

    if (deltaY > 120) {
        // 1. Slide it all the way off the bottom of the screen
        el.style.transform = 'translateY(100%)';
        
        // 2. Wait for that animation to finish (400ms)
        setTimeout(() => {
            closeFunction(); // This actually closes the modal/screen
            
            // 3. Reset the position for the NEXT time it opens
            setTimeout(() => {
                el.style.transform = 'translateY(0)';
            }, 50);
        }, 400);
        
    } else {
        // If they didn't swipe far enough, snap back to top
        el.style.transform = 'translateY(0)';
    }
    
    // Reset touch tracking
    startY = 0;
    currentY = 0;
});
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. For the Add New Lead Modal
    const addLeadContent = document.querySelector('#add-lead-modal .modal-content');
    if (addLeadContent) {
        makeSwipable(addLeadContent, closeModal); 
    }
    
    // 2. For the Lead Quick Detail Card (Summary)
    const leadDetailCard = document.querySelector('#lead-detail-screen .lead-detail-card');
    if (leadDetailCard) {
        makeSwipable(leadDetailCard, () => {
            document.getElementById('lead-detail-screen').style.display = 'none';
        });
    }

    makeSideMenuSwipable('side-menu', 'menu-overlay');

});

function makeSideMenuSwipable(menuId, overlayId) {
    const menu = document.getElementById(menuId);
    const overlay = document.getElementById(overlayId);
    let startX = 0;
    let currentX = 0;

    menu.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        menu.style.transition = 'none'; // Disable animation during drag
    }, { passive: true });

    menu.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX;
        const deltaX = currentX - startX;

        // Only allow dragging to the left (closing)
        if (deltaX < 0) {
            menu.style.transform = `translateX(${deltaX}px)`;
            // Gradually fade the overlay as you swipe
            const opacity = 1 + (deltaX / 300); 
            overlay.style.opacity = Math.max(opacity, 0);
        }
    }, { passive: true });

    menu.addEventListener('touchend', (e) => {
    menu.style.transition = 'transform 0.3s ease-out';
    const deltaX = currentX - startX;

    // If swiped more than 70px to the left (closing)
    if (deltaX < -70) {
        // 1. Force the menu to slide completely out of view
        menu.style.transform = 'translateX(-105%)';
        overlay.style.opacity = '0';
        
        // 2. Wait for the animation, then cleanup the classes
        setTimeout(() => {
            // This calls your existing function that handles the 'display: none'
            toggleMenu(); 
            
            // 3. Reset the manual transform so it opens normally next time
            menu.style.transform = '';
        }, 300);
        
    } else {
        // If the swipe wasn't far enough, snap it back open
        menu.style.transform = 'translateX(0)';
        overlay.style.opacity = '1';
    }
    
    // Reset tracking variables
    startX = 0;
    currentX = 0;
});
}

// Close side menu when a link is clicked
document.querySelectorAll('.side-menu a').forEach(link => {
    link.addEventListener('click', () => {
        // We use your existing toggle function to ensure 
        // the menu slides away and the overlay fades out.
        if (typeof toggleMenu === "function") {
            toggleMenu(); 
        }
    });
});