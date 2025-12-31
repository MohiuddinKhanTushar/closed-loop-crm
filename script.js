// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAFjiFR8-P42EWiJQWRrZGdf7sJ2O4oWZU",
    authDomain: "closed-loop-crm.firebaseapp.com",
    projectId: "closed-loop-crm",
    storageBucket: "closed-loop-crm.firebasestorage.app",
    messagingSenderId: "770921103170",
    appId: "1:770921103170:web:2b642ed99e03bc3f4ad2db"
};

// 2. Initialize
firebase.initializeApp(firebaseConfig);

// 3. Shortcuts (These are what we will use in our functions)
const auth = firebase.auth();
const db = firebase.firestore();

// 4. Offline Persistence (Vital for Mobile Apps)
// This lets the CRM work even when the user has no signal
db.enablePersistence().catch((err) => {
    console.error("Persistence error:", err.code);
});

// This runs automatically whenever a user logs in or out
auth.onAuthStateChanged((user) => {
    const authScreen = document.getElementById('auth-screen');
    
    if (user) {
        // User is logged in! 
        console.log("Logged in as:", user.email);
        authScreen.style.display = 'none'; // Hide login
        syncLeadsFromServer();             // Start getting their leads
    } else {
        // No user is logged in
        authScreen.style.display = 'flex'; // Show login
    }
});

// 1. DATA SETUP & STATE
let currentFilter = 'New';
let activeLeadId = null;
let notifications = JSON.parse(localStorage.getItem('notifications')) || [];

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
        if(screenId === 'settings-screen') renderSettingsContent(); // Changed name to avoid conflict
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
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const task = lead.activities.find(a => a.id === taskId);
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

        return `
            <div class="timeline-item" style="${isCompleted}">
                <div class="timeline-dot" style="${isTask ? `background: ${taskColor};` : ''}"></div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="font-size: 11px; color: #999;">${a.timestamp}</div>
                    ${isTask ? `
                        <button onclick="event.stopPropagation(); toggleTaskComplete(${lead.id}, ${a.id})" 
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
        
        cardWrapper.innerHTML = `
            <div class="lead-card" onclick="openLeadDetail(${lead.id})">
                <div class="card-info">
                    <h3>${lead.name}</h3>
                    <p>${companyInfo}${lead.source} • £${lead.value}</p>
                </div>
                <button class="delete-btn-inline" onclick="event.stopPropagation(); requestDelete(${lead.id})">
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

function filterLeads(stage) {
    currentFilter = stage;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (event && event.target && event.target.classList.contains('tab')) {
        event.target.classList.add('active');
    }
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
        
        phoneInput.classList.remove('invalid-input');
        emailInput.classList.remove('invalid-input');
        
        document.getElementById('lead-detail-screen').style.display = 'flex';
    }
}

// 5. DELETE LOGIC
function requestDelete(id) {
    activeLeadId = id;
    openDeleteModal();
}

function openDeleteModal() { 
    document.getElementById('delete-modal').style.display = 'flex'; 
    document.getElementById('confirm-delete-btn').onclick = () => { 
        deleteLead(activeLeadId); 
        closeDeleteModal(); 
    }; 
}

function closeDeleteModal() { 
    document.getElementById('delete-modal').style.display = 'none'; 
}

function deleteLead(id) {
    leads = leads.filter(l => l.id !== id);
    saveData();
    renderLeads();
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

// 7. DATA PERSISTENCE & SYNC
function saveData() { 
    localStorage.setItem('myLeads', JSON.stringify(leads)); 
}

const leadForm = document.getElementById('lead-form');
if(leadForm) {
    leadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const phone = document.getElementById('lead-phone').value;
        const email = document.getElementById('lead-email').value;

        if ((phone !== "" && !validatePhone(phone)) || (email !== "" && !validateEmail(email))) {
            openValidationModal("The phone or email format is incorrect. Please check and try again.");
            return;
        }

        leads.push({
            id: Date.now(),
            name: document.getElementById('lead-name').value,
            company: document.getElementById('lead-company').value,
            source: document.getElementById('lead-source').value,
            value: document.getElementById('lead-value').value,
            phone: phone,
            email: email,
            status: 'New',
            activities: [],
            notes: "",
            address: ""
        });
        saveData();
        renderLeads();
        this.reset();
        closeModal();
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

function validatePhone(phone) { 
    const clean = phone.replace(/[^0-9+]/g, '');
    return clean.length >= 10; 
}

function validateLive(el, type) { 
    const isValid = el.value === "" || (type === 'phone' ? validatePhone(el.value) : validateEmail(el.value));
    el.classList.toggle('invalid-input', !isValid); 
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

    resultsContainer.innerHTML = filtered.map(lead => `
        <div class="search-result-item" onclick="goToLeadFromSearch(${lead.id})">
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

function toggleNotifications() {
    const modal = document.getElementById('notif-modal');
    if(modal.style.display === 'none' || !modal.style.display) {
        modal.style.display = 'flex';
        renderNotificationList();
        // Mark all as read when opening
        notifications.forEach(n => n.read = true);
        localStorage.setItem('notifications', JSON.stringify(notifications));
        updateNotifUI();
    } else {
        modal.style.display = 'none';
    }
}

function renderNotificationList() {
    const container = document.getElementById('notif-list-container');
    if(!container) return;
    
    if(notifications.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#888; padding:20px;">No notifications yet.</p>';
        return;
    }

    // Header with Clear All button
    let html = `
        <div style="padding: 10px 12px; border-bottom: 2px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
            <span style="font-size: 12px; font-weight: 700; color: #666;">NOTIFICATIONS</span>
            <button onclick="clearAllNotifications()" style="background: none; border: none; color: var(--teal-primary); font-size: 11px; font-weight: 700; cursor: pointer; padding: 4px 8px;">Clear All</button>
        </div>
    `;

    // Map through notifications
    html += notifications.map((n, index) => `
        <div style="padding:12px; border-bottom:1px solid #eee; background:${n.read ? 'white' : '#f0f9f9'}; cursor:pointer; position: relative;"
             class="notif-item"
             onclick="goToLeadFromNotification(${n.leadId})">
            <div style="display:flex; justify-content:space-between; padding-right: 20px;">
                <strong style="font-size:13px; color:var(--teal-primary);">${n.leadName}</strong>
                <span style="font-size:10px; color:#999;">${n.time}</span>
            </div>
            <div style="font-size:13px; color:#444; margin-top:4px; padding-right: 20px;">Reminder: ${n.taskDesc}</div>
            
            <button onclick="event.stopPropagation(); deleteNotification(${index})" 
                    style="position: absolute; top: 10px; right: 8px; background: none; border: none; color: #ccc; font-size: 16px; cursor: pointer; line-height: 1;">
                &times;
            </button>
        </div>
    `).join('');

    container.innerHTML = html;
}

function goToLeadFromNotification(leadId) {
    activeLeadId = leadId;
    const modal = document.getElementById('notif-modal');
    if (modal) modal.style.display = 'none';
    openFullProfile();
}

function updateNotifUI() {
    const badge = document.getElementById('notif-badge');
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if(unreadCount > 0) {
        badge.innerText = unreadCount;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

function clearAllNotifications() {
    if (confirm("Are you sure you want to clear all notifications?")) {
        notifications = [];
        localStorage.setItem('notifications', JSON.stringify(notifications));
        renderNotificationList();
        updateNotifUI();
    }
}

function deleteNotification(index) {
    // Remove the specific notification from the array
    notifications.splice(index, 1);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    
    // Refresh the UI
    renderNotificationList();
    updateNotifUI();
}

// 9. REVISED SAVE TASK (With Reminder Support)
function saveTask() {
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

    // Calculate actual task timestamp for the reminder logic
    const taskDateTime = new Date(`${dateInput.value}T${timeInput.value || '00:00'}`).getTime();

    const now = new Date();
    const timestampStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + 
                         ', ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

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

    if (!lead.activities) lead.activities = [];
    lead.activities.unshift(taskEntry);

    saveData();
    renderActivities(lead);
    
    descInput.value = '';
    dateInput.value = '';
    timeInput.value = '';
    document.getElementById('task-reminder-offset').value = 'none';
    
    showToast("Task Scheduled!");
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
        activeLeadId = tasksForDay[0].leadId; // Ensure this is set!
        closeCalendar();
        openFullProfile();
        return;
    }

    // If multiple tasks, show the picker modal
    const modal = document.getElementById('calendar-task-modal');
    const listContainer = document.getElementById('calendar-task-list');
    const dateHeader = document.getElementById('calendar-modal-date');

    dateHeader.innerText = `Tasks for ${new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    
    listContainer.innerHTML = tasksForDay.map(task => `
        <div class="search-result-item" onclick="goToLeadFromCalendarPicker(${task.leadId})">
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
                if (act.type === 'Task') {
                    allTasks.push({ ...act, belongsTo: lead.name, belongsToId: lead.id });
                }
            });
        }
    });

    // Sort: Newest/Upcoming first
    allTasks.sort((a, b) => {
        const dateTimeA = new Date(`${a.date} ${a.time || '00:00'}`);
        const dateTimeB = new Date(`${b.date} ${b.time || '00:00'}`);
        return dateTimeB - dateTimeA;
    });

    if (allTasks.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center; padding:40px;">No scheduled tasks found.</p>';
        return;
    }

    allTasks.forEach(task => {
        const card = document.createElement('div');
        // Use your existing class for styling
        card.className = 'lead-card'; 
        card.style.marginBottom = '12px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column'; // Stack info vertically
        card.style.alignItems = 'flex-start';
        card.style.borderLeft = `4px solid ${task.completed ? '#4caf50' : '#ff9500'}`;
        if(task.completed) card.style.opacity = '0.7';
        
        card.onclick = () => {
            activeLeadId = task.belongsToId;
            openFullProfile();
        };

        // This is the CLEAN HTML for a task, NOT a settings page
        card.innerHTML = `
            <div style="padding: 12px; width: 100%; box-sizing: border-box;">
                <div style="font-size: 11px; font-weight: 700; color: ${task.completed ? '#4caf50' : '#ff9500'}; text-transform: uppercase;">
                    ${task.date} @ ${task.time} ${task.completed ? '✓' : ''}
                </div>
                <div style="font-weight: 700; font-size: 16px; margin: 4px 0; color: #333;">
                    ${task.description}
                </div>
                <div style="font-size: 13px; color: #666;">
                    Lead: <span style="color: var(--teal-primary); font-weight: 600;">${task.belongsTo}</span>
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
                    const newNotif = {
                        id: Date.now() + Math.random(),
                        taskDesc: task.description,
                        leadId: lead.id,
                        leadName: lead.name,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        read: false
                    };
                    notifications.unshift(newNotif);
                    task.notified = true;
                    needsUpdate = true;
                }
            }
        });
    });

    if (needsUpdate) {
        saveData();
        localStorage.setItem('notifications', JSON.stringify(notifications));
        updateNotifUI();
    }
}, 30000);

// Initial Load
renderLeads();
updateNotifUI();

// --- 10. AUTHENTICATION & UI LOGIC ---

let isSignUpMode = true;

// 10a. Auth State Observer (Controls Splash Screen & Data Sync)
auth.onAuthStateChanged((user) => {
    const splash = document.getElementById('splash-screen');
    const authScreen = document.getElementById('auth-screen');

    if (user) {
        // User is Logged In
        if (authScreen) authScreen.style.display = 'none';
        
        // Start Live Cloud Sync
        if (typeof syncLeadsFromServer === "function") {
            syncLeadsFromServer();
        }

        // Update all initials displays (Main page, Detail pages, etc.)
        updateUserInitials(user); 

    } else {
        // User is Logged Out
        if (authScreen) {
            authScreen.style.display = 'flex';
            setAuthMode('login');
        }
    }

    // Always hide splash screen after auth check
    setTimeout(() => {
        if (splash) splash.classList.add('fade-out');
    }, 3000);
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

            const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
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
        triggerError(error.message);
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
                    <input type="text" value="${user.email}" disabled class="settings-input">
                </div>

                <button onclick="updateUserProfile()" class="save-btn" style="margin-top: 10px; width: 100%;">Update Profile</button>
                
                <button onclick="logout()" style="width: 100%; padding: 15px; background: none; color: #ff3b30; border: 1px solid #ff3b30; border-radius: 12px; margin-top:15px; font-weight: 700;">
                    Logout
                </button>
            </div>
            <p style="text-align: center; color: #ccc; font-size: 11px; margin-top: 30px;">CLOSED LOOP CRM v1.0.5</p>
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