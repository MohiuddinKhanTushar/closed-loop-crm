// 1. DATA SETUP & STATE
let currentFilter = 'New';
let activeLeadId = null;
let touchStartX = 0;
let touchEndX = 0;
let isDragging = false;
let touchMoved = false; 

let rawData = localStorage.getItem('myLeads');
let leads = rawData ? JSON.parse(rawData) : [
    { id: 1, name: "John Smith", source: "Instagram", value: 1200, status: 'New', activities: [], phone: "", email: "", address: "" }
];

// 2. NAVIGATION & SCREENS
function toggleMenu() { 
    document.getElementById('side-menu').classList.toggle('open'); 
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

    // Check if current summary inputs are valid before allowing transition
    const pVal = document.getElementById('detail-phone-input').value;
    const eVal = document.getElementById('detail-email-input').value;

    if ((pVal !== "" && !validatePhone(pVal)) || (eVal !== "" && !validateEmail(eVal))) {
        showValidationError("Please fix the contact details before viewing the full profile.");
        return;
    }

    // 1. Populate Header info
    document.getElementById('profile-main-name').innerText = lead.name;
    document.getElementById('profile-sub-info').innerText = `${lead.source} • £${lead.value}`;
    
    // 2. Populate Contact info
    const pInput = document.getElementById('profile-phone-input');
    const eInput = document.getElementById('profile-email-input');
    const aInput = document.getElementById('profile-address-input');
    
    pInput.value = lead.phone || "";
    eInput.value = lead.email || "";
    aInput.value = lead.address || "";

    // Populate Notes
    const notesInput = document.getElementById('profile-notes-input');
    notesInput.value = lead.notes || ""; // Load existing notes or leave empty

    // Run the red-highlight check immediately on load
    validateLive(pInput, 'phone');
    validateLive(eInput, 'email');

    // 3. Render the timeline
    renderActivities(lead);
    
    // 4. Switch screens
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

    if(type === 'Call' && phoneNumber) {
        window.location.href = `tel:${phoneNumber}`;
    } else if(type === 'Email' && lead.email) {
        window.location.href = `mailto:${lead.email}`;
    } else if(type === 'WhatsApp' && phoneNumber) {
        window.location.href = `https://wa.me/${phoneNumber.replace('+', '')}`;
    } else if(type === 'Text' && phoneNumber) {
        window.location.href = `sms:${phoneNumber}`;
    }   
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
        cardWrapper.innerHTML = `
            <div class="lead-card" 
                id="card-${lead.id}"
                onclick="openLeadDetail(${lead.id})"
                ontouchstart="handleTouchStart(event)"
                ontouchmove="handleTouchMove(event)"
                ontouchend="handleTouchEnd(event, ${lead.id})"
                onmousedown="handleTouchStart(event)"
                onmousemove="handleTouchMove(event)"
                onmouseup="handleTouchEnd(event, ${lead.id})"
                onmouseleave="handleTouchEnd(event, ${lead.id})">
                <div class="card-info">
                    <h3>${lead.name}</h3>
                    <p>${lead.source} • £${lead.value}</p>
                </div>
            </div>
        `;
        container.appendChild(cardWrapper);
    });
}

function filterLeads(stage) {
    currentFilter = stage;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    renderLeads();
}

function openLeadDetail(id) {
    if (touchMoved) return; 

    activeLeadId = id;
    const lead = leads.find(l => l.id === id);
    if (lead) {
        document.getElementById('detail-name').innerText = lead.name;
        document.getElementById('detail-status-select').value = lead.status;
        
        const pInput = document.getElementById('detail-phone-input');
        const eInput = document.getElementById('detail-email-input');
        
        pInput.value = lead.phone || '';
        eInput.value = lead.email || '';

        validateLive(pInput, 'phone');
        validateLive(eInput, 'email');

        document.getElementById('lead-detail-screen').style.display = 'flex';
    }
}

// 5. TOUCH & SWIPE LOGIC
function handleTouchStart(e) {
    isDragging = true;
    touchMoved = false; 
    touchStartX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    e.currentTarget.style.transition = 'none';
}

function handleTouchMove(e) {
    if (!isDragging) return;
    let currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const diff = touchStartX - currentX;
    if (Math.abs(diff) > 10) touchMoved = true;
    const card = e.currentTarget;
    if (diff > 0 && diff < 150) {
        card.style.transform = `translateX(-${diff}px)`;
    }
}

let leadToDelete = null;

function handleTouchEnd(e, id) {
    if (!isDragging) return;
    isDragging = false;
    const card = e.currentTarget;
    const currentX = (e.type === 'touchend' || e.type === 'mouseup') ? (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) : touchStartX;
    const diff = touchStartX - currentX;
    card.style.transition = 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)';

    if (touchMoved && diff > 80) {
        card.style.transform = 'translateX(-100px)';
        card.classList.add('swiped');
        leadToDelete = id;
        openDeleteModal();
    } else {
        card.style.transform = 'translateX(0)';
        setTimeout(() => { touchMoved = false; }, 300);
    }
}

function openDeleteModal() {
    document.getElementById('delete-modal').style.display = 'flex';
    document.getElementById('confirm-delete-btn').onclick = function() {
        deleteLead(leadToDelete);
        closeDeleteModal();
    };
}

function closeDeleteModal() {
    document.getElementById('delete-modal').style.display = 'none';
    renderLeads(); 
    setTimeout(() => { touchMoved = false; }, 300);
}

// 6. PERSISTENCE & MODALS
function deleteLead(id) {
    leads = leads.filter(l => l.id !== id);
    saveData();
    renderLeads();
    leadToDelete = null;
}

function updateLeadStatus() {
    const newStatus = document.getElementById('detail-status-select').value;
    const leadIndex = leads.findIndex(l => l.id === activeLeadId);
    if (leadIndex !== -1) {
        leads[leadIndex].status = newStatus;
        saveData();
        renderLeads(); 
        closeDetail();
    }
}

function saveData() {
    localStorage.setItem('myLeads', JSON.stringify(leads));
}

const leadForm = document.getElementById('lead-form');
if(leadForm) {
    leadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const phoneVal = document.getElementById('lead-phone').value;
        const emailVal = document.getElementById('lead-email').value;

        if (!validatePhone(phoneVal)) {
            showValidationError("Phone must start with +44 and be at least 11 digits long.");
            document.getElementById('lead-phone').classList.add('invalid-input');
            return;
        }
        
        if (!validateEmail(emailVal)) {
            showValidationError("Please enter a valid email address (e.g. name@domain.com).");
            document.getElementById('lead-email').classList.add('invalid-input');
            return;
        }

        const newLead = {
            id: Date.now(),
            name: document.getElementById('lead-name').value,
            source: document.getElementById('lead-source').value,
            value: document.getElementById('lead-value').value,
            phone: phoneVal,
            email: emailVal,
            address: "",
            status: 'New',
            activities: []
        };
        leads.push(newLead);
        saveData();
        renderLeads();
        this.reset();
        closeModal();
    });
}

function updateLeadContact() {
    const leadIndex = leads.findIndex(l => l.id === activeLeadId);
    if (leadIndex !== -1) {
        const phoneVal = document.getElementById('detail-phone-input').value.trim();
        const emailVal = document.getElementById('detail-email-input').value.trim();

        if ((validatePhone(phoneVal) || phoneVal === "") && (validateEmail(emailVal) || emailVal === "")) {
            leads[leadIndex].phone = phoneVal;
            leads[leadIndex].email = emailVal;
            saveData();
        }
    }
}

function syncProfileToData() {
    const leadIndex = leads.findIndex(l => l.id === activeLeadId);
    if (leadIndex !== -1) {
        const phone = document.getElementById('profile-phone-input').value.trim();
        const email = document.getElementById('profile-email-input').value.trim();
        const address = document.getElementById('profile-address-input').value.trim();
        const notes = document.getElementById('profile-notes-input').value; // Grab the notes

        if ((validatePhone(phone) || phone === "") && (validateEmail(email) || email === "")) {
            leads[leadIndex].phone = phone;
            leads[leadIndex].email = email;
            leads[leadIndex].address = address;
            leads[leadIndex].notes = notes; // Save the notes to the lead object
            saveData();
        }
    }
}

function closeDetail() { document.getElementById('lead-detail-screen').style.display = 'none'; }
function openModal() { document.getElementById('add-lead-modal').style.display = 'flex'; }
function closeModal() { document.getElementById('add-lead-modal').style.display = 'none'; }

// VALIDATION UTILITIES
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
    const clean = phone.replace(/[^0-9+]/g, '');
    return clean.startsWith('+') && clean.length >= 12; 
}

function validateLive(element, type) {
    const value = element.value.trim();
    if (value === "") {
        element.classList.remove('invalid-input');
        return;
    }
    const isValid = (type === 'phone') ? validatePhone(value) : validateEmail(value);
    element.classList.toggle('invalid-input', !isValid);
}

function showValidationError(message) {
    const errorMsg = document.getElementById('validation-error-text');
    if(errorMsg) {
        errorMsg.innerText = message;
        document.getElementById('validation-modal').style.display = 'flex';
}
}
function closeValidationModal() {
    document.getElementById('validation-modal').style.display = 'none';
}

function handleBackdropClick(e) {
    // This ensures that if the user clicks the dark blurred area, 
    // we run the update function to save any changes, then close.
    if (e.target.id === 'lead-detail-screen') {
        updateLeadContact(); // Save any last-minute edits
        closeDetail();
    }
}

renderLeads();