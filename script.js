// 1. DATA SETUP & STATE
let currentFilter = 'New';
let activeLeadId = null;
let touchStartX = 0;
let isDragging = false;
let touchMoved = false; 

// Swipe-down modal state
let modalStartY = 0;
let modalCurrentY = 0;
let isDraggingModal = false;

let rawData = localStorage.getItem('myLeads');
let leads = rawData ? JSON.parse(rawData) : [
    { id: 1, name: "John Smith", company: "Example Corp", source: "Instagram", value: 1200, status: 'New', activities: [], phone: "", email: "", address: "" }
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

    const pVal = document.getElementById('detail-phone-input').value;
    const eVal = document.getElementById('detail-email-input').value;

    if ((pVal !== "" && !validatePhone(pVal)) || (eVal !== "" && !validateEmail(eVal))) {
        showValidationError("Please fix the contact details first.");
        return;
    }

    // UPDATED: Show company name in the profile header
    document.getElementById('profile-main-name').innerText = lead.name;
    const companyDisplay = lead.company ? `${lead.company} • ` : "";
    document.getElementById('profile-sub-info').innerText = `${companyDisplay}${lead.source} • £${lead.value}`;

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
        
        // UPDATED: Added company display logic to the lead card
        const companyInfo = lead.company ? `<span style="font-weight:600; color:var(--teal-primary)">${lead.company}</span> • ` : "";
        
        cardWrapper.innerHTML = `
            <div class="lead-card" 
                id="card-${lead.id}"
                onclick="openLeadDetail(${lead.id})"
                ontouchstart="handleTouchStart(event)"
                ontouchmove="handleTouchMove(event)"
                ontouchend="handleTouchEnd(event, ${lead.id})">
                <div class="card-info">
                    <h3>${lead.name}</h3>
                    <p>${companyInfo}${lead.source} • £${lead.value}</p>
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
        document.getElementById('detail-company-text').innerText = lead.company || "No Company Added";
        document.getElementById('detail-status-select').value = lead.status;
        document.getElementById('detail-phone-input').value = lead.phone || '';
        document.getElementById('detail-email-input').value = lead.email || '';
        document.getElementById('lead-detail-screen').style.display = 'flex';
    }
}

// 5. TOUCH & SWIPE LOGIC (LEAD CARDS)
function handleTouchStart(e) {
    isDragging = true;
    touchMoved = false; 
    touchStartX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    e.currentTarget.style.transition = 'none';
}

function handleTouchMove(e) {
    if (!isDragging) return;
    let currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const diffX = touchStartX - currentX;

    if (Math.abs(diffX) > 10) {
        touchMoved = true;
        const card = e.currentTarget;
        if (diffX > 0 && diffX < 150) {
            card.style.transform = `translateX(-${diffX}px)`;
        }
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
        leadToDelete = id;
        openDeleteModal();
    } else {
        card.style.transform = 'translateX(0)';
        setTimeout(() => { touchMoved = false; }, 300);
    }
}

// 6. SWIPE-TO-CLOSE LOGIC (ADD LEAD MODAL)
function initModalSwipe() {
    const modal = document.getElementById('add-lead-modal');
    const content = modal.querySelector('.modal-content');
    if (!content) return;

    content.addEventListener('touchstart', (e) => {
        modalStartY = e.touches[0].clientY;
        isDraggingModal = true;
        content.style.transition = 'none';
    }, { passive: true });

    content.addEventListener('touchmove', (e) => {
        if (!isDraggingModal) return;
        modalCurrentY = e.touches[0].clientY;
        const diffY = modalCurrentY - modalStartY;
        if (diffY > 0) {
            content.style.transform = `translateY(${diffY}px)`;
        }
    }, { passive: true });

    content.addEventListener('touchend', () => {
        if (!isDraggingModal) return;
        isDraggingModal = false;
        const diffY = modalCurrentY - modalStartY;
        content.style.transition = 'transform 0.3s cubic-bezier(0.15, 0, 0.15, 1)';

        if (diffY > 150) closeModal();
        else content.style.transform = 'translateY(0)';
    });
}

function openModal() {
    const modal = document.getElementById('add-lead-modal');
    const content = modal.querySelector('.modal-content');
    modal.style.display = 'flex';
    content.style.transform = 'translateY(0)';
}

function closeModal() {
    const modal = document.getElementById('add-lead-modal');
    const content = modal.querySelector('.modal-content');
    modal.style.display = 'none';
    content.style.transform = 'translateY(0)';
}

// 7. PERSISTENCE & HELPERS
function saveData() { localStorage.setItem('myLeads', JSON.stringify(leads)); }

function deleteLead(id) {
    leads = leads.filter(l => l.id !== id);
    saveData();
    renderLeads();
}

const leadForm = document.getElementById('lead-form');
if(leadForm) {
    leadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const phoneVal = document.getElementById('lead-phone').value;
        const emailVal = document.getElementById('lead-email').value;

        // Validation... (same as your logic)
        leads.push({
            id: Date.now(),
            name: document.getElementById('lead-name').value,
            company: document.getElementById('lead-company').value, // SAVING COMPANY
            source: document.getElementById('lead-source').value,
            value: document.getElementById('lead-value').value,
            phone: phoneVal,
            email: emailVal,
            status: 'New',
            activities: []
        });
        saveData();
        renderLeads();
        this.reset();
        closeModal();
    });
}

function syncProfileToData() {
    const idx = leads.findIndex(l => l.id === activeLeadId);
    if (idx !== -1) {
        leads[idx].company = document.getElementById('profile-company-input').value;
        leads[idx].phone = document.getElementById('profile-phone-input').value;
        leads[idx].email = document.getElementById('profile-email-input').value;
        leads[idx].address = document.getElementById('profile-address-input').value;
        leads[idx].notes = document.getElementById('profile-notes-input').value;
        saveData();
    }
}

function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validatePhone(phone) { return phone.replace(/[^0-9+]/g, '').length >= 11; }
function validateLive(el, type) { el.classList.toggle('invalid-input', el.value !== "" && (type === 'phone' ? !validatePhone(el.value) : !validateEmail(el.value))); }

function openDeleteModal() { document.getElementById('delete-modal').style.display = 'flex'; document.getElementById('confirm-delete-btn').onclick = () => { deleteLead(leadToDelete); closeDeleteModal(); }; }
function closeDeleteModal() { document.getElementById('delete-modal').style.display = 'none'; renderLeads(); }
function showValidationError(m) { document.getElementById('validation-error-text').innerText = m; document.getElementById('validation-modal').style.display = 'flex'; }
function closeValidationModal() { document.getElementById('validation-modal').style.display = 'none'; }
function closeDetail() { document.getElementById('lead-detail-screen').style.display = 'none'; }
function updateLeadContact() { syncProfileToData(); } // Shortcut for modal edits

// Initialize
renderLeads();
initModalSwipe();