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
}

function openFullProfile() {
    const lead = leads.find(l => l.id === activeLeadId);
    if (!lead) return;

    // Validation check before moving to profile
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
    document.getElementById('profile-notes-input').value = lead.notes || "";

    renderActivities(lead);
    closeDetail();
    showScreen('profile-screen');
}

// 3. ACTIVITIES LOGIC
function logActivity(type) {
    const lead = leads.find(l => l.id === activeLeadId);
    if(!lead) return;
    if(!lead.activities) lead.activities = [];
    
    lead.activities.unshift({
        action: type,
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

function renderActivities(lead) {
    const log = document.getElementById('activity-log');
    if(!lead.activities || lead.activities.length === 0) {
        log.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">No history yet.</p>';
        return;
    }
    log.innerHTML = lead.activities.map(a => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <p>${a.action} attempt</p>
            <span>${a.timestamp}</span>
        </div>
    `).join('');
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
        
        // Reset validation highlights when opening
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

// Custom Validation Modal Controls
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

        // Block save if invalid and show custom modal
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

        // Silently block data sync if invalid (handled visually by live validation)
        if ((pVal !== "" && !validatePhone(pVal)) || (eVal !== "" && !validateEmail(eVal))) {
            return; 
        }

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

        if ((pVal !== "" && !validatePhone(pVal)) || (eVal !== "" && !validateEmail(eVal))) {
            return;
        }

        leads[idx].company = document.getElementById('profile-company-input').value;
        leads[idx].phone = pVal;
        leads[idx].email = eVal;
        leads[idx].address = document.getElementById('profile-address-input').value;
        leads[idx].notes = document.getElementById('profile-notes-input').value;
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
    openFullProfile(); // This uses your existing function to show the profile
}

// Initial Load
renderLeads();