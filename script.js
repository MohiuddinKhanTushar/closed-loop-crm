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
function showToast(message) {
    const toast = document.getElementById('toast-notification');
    const msgEl = document.getElementById('toast-message');
    if(!toast || !msgEl) return;
    msgEl.innerText = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

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
    const allTasks = leads.flatMap(l => (l.activities || []).map(a => ({...a, leadName: l.name})));
    const tasksForDay = allTasks.filter(t => t.type === 'Task' && t.date === dateString);

    if (tasksForDay.length === 0) return;

    if (tasksForDay.length === 1) {
        activeLeadId = tasksForDay[0].leadId;
        closeCalendar();
        openFullProfile();
        return;
    }

    const modal = document.getElementById('calendar-task-modal');
    const listContainer = document.getElementById('calendar-task-list');
    const dateHeader = document.getElementById('calendar-modal-date');

    if (!modal || !listContainer) return;

    dateHeader.innerText = `Tasks for ${new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    
    listContainer.innerHTML = tasksForDay.map(task => `
        <div class="search-result-item" onclick="goToLeadFromCalendarPicker(${task.leadId})" style="border-bottom:1px solid #eee; padding:12px 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; color:var(--text-dark);">${task.description}</span>
                <span style="font-size:11px; color:#ff9500; font-weight:700;">${task.time}</span>
            </div>
            <div style="font-size:12px; color:#666; margin-top:2px;">Lead: ${task.leadName} ${task.completed ? '✅' : ''}</div>
        </div>
    `).join('');

    modal.style.display = 'flex';
}

function goToLeadFromCalendarPicker(leadId) {
    activeLeadId = leadId;
    document.getElementById('calendar-task-modal').style.display = 'none';
    closeCalendar();
    openFullProfile();
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
        card.className = 'lead-card';
        card.style.marginBottom = '12px';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'space-between';
        card.style.borderLeft = `4px solid ${task.completed ? '#4caf50' : '#ff9500'}`;
        if(task.completed) card.style.opacity = '0.7';
        
        card.onclick = () => {
            activeLeadId = task.belongsToId;
            openFullProfile();
        };

        card.innerHTML = `
            <div class="card-info" style="flex-grow:1; ${task.completed ? 'text-decoration: line-through;' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
                    <h3 style="margin:0; font-size: 15px;">${task.description}</h3>
                    <span style="font-size:10px; background:${task.completed ? '#e8f5e9' : '#fff3e0'}; color:${task.completed ? '#4caf50' : '#ff9500'}; padding:2px 6px; border-radius:4px; font-weight:700; white-space:nowrap; margin-left: 10px;">
                        ${task.date}
                    </span>
                </div>
                <p style="margin: 0; font-size:12px; color:#666;">
                    Lead: <strong>${task.belongsTo}</strong> • Time: ${task.time || 'N/A'}
                </p>
            </div>
            <button onclick="event.stopPropagation(); toggleTaskComplete(${task.belongsToId}, ${task.id})" 
                    style="background:none; border:none; padding:10px; cursor:pointer; color: ${task.completed ? '#4caf50' : '#ccc'};">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </button>
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

// 10. AUTHENTICATION & SIGN UP LOGIC
let isSignUpMode = true;

function checkAuth() {
    const accountExists = localStorage.getItem('crm_user_creds');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const authScreen = document.getElementById('auth-screen');

    if (isLoggedIn === 'true') {
        authScreen.style.display = 'none';
        const savedCreds = JSON.parse(accountExists);
        if(savedCreds) updateTopRightAvatar(savedCreds.initials);
        return;
    }

    // If an account exists, default to Login mode, otherwise Sign Up
    if (accountExists) {
        setAuthMode('login');
    } else {
        setAuthMode('signup');
    }
    authScreen.style.display = 'flex';
}

function setAuthMode(mode) {
    isSignUpMode = (mode === 'signup');
    
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btn = document.getElementById('auth-button');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');
    
    // Elements to toggle
    const nameFields = document.getElementById('auth-name-fields');
    const forgotArea = document.getElementById('forgot-password-area');

    if (isSignUpMode) {
        title.innerText = "Create Account";
        subtitle.innerText = "Set up your secure CRM access";
        btn.innerText = "Sign Up";
        toggleText.innerText = "Already have an account?";
        toggleLink.innerText = "Log In";
        
        nameFields.style.display = "block";  // Show Names
        forgotArea.style.display = "none";    // Hide Forgot Password
    } else {
        title.innerText = "Welcome Back";
        subtitle.innerText = "Log in to manage your leads";
        btn.innerText = "Log In";
        toggleText.innerText = "Don't have an account?";
        toggleLink.innerText = "Sign Up";
        
        nameFields.style.display = "none";   // Hide Names
        forgotArea.style.display = "block";  // Show Forgot Password
    }
}

function toggleAuthMode() {
    setAuthMode(isSignUpMode ? 'login' : 'signup');
}

function handleAuthAction() {
    const user = document.getElementById('auth-username').value.trim();
    const pass = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    const authBtn = document.getElementById('auth-button');

    // Reset error display
    errorEl.style.display = 'none';

    // Helper for consistent error haptics and feedback
    const triggerError = (msg) => {
        errorEl.innerText = msg;
        errorEl.style.display = 'block';
        
        // Physical Haptic (for APK)
        if (navigator.vibrate) navigator.vibrate(50);

        // Visual Haptic (Shake)
        authBtn.style.transform = "translateX(5px)";
        setTimeout(() => authBtn.style.transform = "translateX(-5px)", 50);
        setTimeout(() => authBtn.style.transform = "translateX(0)", 100);
    };

    // Helper to validate Email or Phone
    const isValidIdentifier = (val) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?[0-9]{10,15}$/; 
        return emailRegex.test(val) || phoneRegex.test(val);
    };

    if (isSignUpMode) {
        const firstName = document.getElementById('auth-first-name').value.trim();
        const lastName = document.getElementById('auth-last-name').value.trim();

        // 1. Check for empty fields
        if (!user || !pass || !firstName || !lastName) {
            triggerError("Please fill in all fields.");
            return;
        }

        // 2. Validate Identity (Email or Phone)
        if (!isValidIdentifier(user)) {
            triggerError("Username must be a valid Email or Mobile Number.");
            return;
        }

        // 3. Create Account
        const initials = (firstName[0] + lastName[0]).toUpperCase();
        const newUser = { 
            username: user, 
            password: pass, 
            firstName: firstName, 
            lastName: lastName, 
            initials: initials 
        };

        localStorage.setItem('crm_user_creds', JSON.stringify(newUser));
        localStorage.setItem('isLoggedIn', 'true');
        document.getElementById('auth-screen').style.display = 'none';
        updateTopRightAvatar(initials);
        showToast(`Welcome, ${firstName}!`);
        
    } else {
        // --- LOGIN MODE ---
        const savedCredsRaw = localStorage.getItem('crm_user_creds');
        
        if (!savedCredsRaw) {
            triggerError("No account found. Please sign up.");
            return;
        }

        const savedCreds = JSON.parse(savedCredsRaw);
        
        // Check credentials (case-sensitive password, case-insensitive username for convenience)
        if (user.toLowerCase() === savedCreds.username.toLowerCase() && pass === savedCreds.password) {
            localStorage.setItem('isLoggedIn', 'true');
            document.getElementById('auth-screen').style.display = 'none';
            updateTopRightAvatar(savedCreds.initials);
            showToast("Welcome back!");
        } else {
            triggerError("Invalid username or password.");
        }
    }
}

function updateTopRightAvatar(initials) {
    const avatarElements = document.querySelectorAll('.user-initials-display');
    avatarElements.forEach(el => {
        el.innerText = initials;
    });
}

// This is what your Avatar button calls
function openProfilePage() {
    showScreen('settings-screen');
}

// This actually draws the content
function renderSettingsContent() {
    const savedCreds = JSON.parse(localStorage.getItem('crm_user_creds'));
    const container = document.getElementById('settings-screen');
    
    if (!savedCreds || !container) return;

    container.innerHTML = `
        <header class="teal-header" style="min-height: auto; padding: 12px 20px 10px;">
            <div class="header-top" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 5px;">
                <button onclick="showScreen('pipeline-screen')" style="background:none; border:none; color:white; cursor:pointer; padding: 0; display: flex; align-items: center;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="square">
                        <path d="M19 12H5M11 18l-6-6 6-6"/>
                    </svg>
                </button>
                <div class="user-profile-mini user-initials-display" style="margin: 0; width: 30px; height: 30px; font-size: 12px;">${savedCreds.initials}</div>
            </div>
            <div class="page-identity">
                <h2 style="margin: 0; font-size: 14px; font-weight: 600; color: rgba(255, 255, 255, 0.85); letter-spacing: 1px;">User Settings</h2>
            </div>
        </header>

        <main class="content" style="padding: 20px;">
            <div class="profile-card" style="text-align: left; padding: 25px 20px; background: white; border-radius: 20px; box-shadow: 0 8px 20px rgba(0,0,0,0.04); border: 1px solid #f0f0f0;">
                
                <label style="font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase;">First Name</label>
                <input type="text" id="edit-firstName" value="${savedCreds.firstName}" style="margin-bottom: 15px; border-bottom: 2px solid #f0f0f0; border-top:none; border-left:none; border-right:none; border-radius:0; padding: 8px 0;">

                <label style="font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase;">Last Name</label>
                <input type="text" id="edit-lastName" value="${savedCreds.lastName}" style="margin-bottom: 15px; border-bottom: 2px solid #f0f0f0; border-top:none; border-left:none; border-right:none; border-radius:0; padding: 8px 0;">

                <label style="font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase;">Username (Login)</label>
                <input type="text" id="edit-username" value="${savedCreds.username}" style="margin-bottom: 25px; border-bottom: 2px solid #f0f0f0; border-top:none; border-left:none; border-right:none; border-radius:0; padding: 8px 0;">

                <button onclick="updateUserProfile()" class="save-btn" style="margin-bottom: 15px;">Update Profile</button>
                
                <button onclick="logout()" style="width: 100%; padding: 15px; background: #fff; color: #ff3b30; border: 1px solid #ff3b30; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer;">
                    Logout
                </button>
            </div>
            
            <p style="text-align: center; color: #ccc; font-size: 11px; margin-top: 30px; letter-spacing: 0.5px;">TEAL CRM v1.0.4</p>
        </main>
    `;
}
function logout() {
    localStorage.removeItem('isLoggedIn');
    window.location.reload();
}

function updateUserProfile() {
    const newFirstName = document.getElementById('edit-firstName').value.trim();
    const newLastName = document.getElementById('edit-lastName').value.trim();
    const newUsername = document.getElementById('edit-username').value.trim();

    if (!newFirstName || !newLastName || !newUsername) {
        showToast("All fields are required");
        return;
    }

    // Calculate new initials
    const initials = (newFirstName[0] + newLastName[0]).toUpperCase();

    // Create the updated object
    const updatedCreds = {
        firstName: newFirstName,
        lastName: newLastName,
        username: newUsername,
        initials: initials,
        password: JSON.parse(localStorage.getItem('crm_user_creds')).password // Keep old password
    };

    // Save to LocalStorage
    localStorage.setItem('crm_user_creds', JSON.stringify(updatedCreds));
    
    showToast("Profile Updated Successfully!");
    
    // Refresh the screen to show new initials in the header
    renderSettingsContent();
}