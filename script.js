// 1. DATA SETUP & STATE
let currentFilter = 'New';
let activeLeadId = null;

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
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const target = document.getElementById(screenId);
    if(target) target.style.display = 'block';
    if(screenId === 'pipeline-screen') renderLeads();
    if(screenId === 'tasks-screen') renderAllTasks();
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

// Fixed Save Task for Mobile & Browser
function saveTask() {
    const descInput = document.getElementById('task-desc');
    const dateInput = document.getElementById('task-date');
    const timeInput = document.getElementById('task-time');

    if (!descInput.value || !dateInput.value) {
        openValidationModal("Please provide a description and date.");
        return;
    }

    const lead = leads.find(l => l.id === activeLeadId);
    if (!lead) return;

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
        timestamp: timestampStr,
        completed: false
    };

    if (!lead.activities) lead.activities = [];
    lead.activities.unshift(taskEntry);

    saveData();
    renderActivities(lead);
    
    descInput.value = '';
    dateInput.value = '';
    timeInput.value = '';
    
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

    // dots based on ALL tasks
    const allTasks = leads.flatMap(l => (l.activities || []).filter(a => a.type === 'Task'));

    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTasks = allTasks.filter(t => t.date === dateString);
        const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        
        const hasTaskClass = dayTasks.length > 0 ? 'has-task' : '';
        
        // Show count if more than 1 task, otherwise show standard dot
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

    // Only one task: Jump directly to profile
    if (tasksForDay.length === 1) {
        activeLeadId = tasksForDay[0].leadId;
        closeCalendar();
        openFullProfile();
        return;
    const taskModal = document.getElementById('calendar-task-modal');
    taskModal.style.display = 'flex'; // This centers it because of the 'align-items: center' style
}

    // Multiple tasks: Show the picker modal
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

// Initial Load
renderLeads();