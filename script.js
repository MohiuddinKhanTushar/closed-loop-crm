// 1. DATA STATE & PERSISTENCE
let currentFilter = 'New';
let activeLeadId = null;

let rawData = localStorage.getItem('myLeads');
let leads = rawData ? JSON.parse(rawData) : [
    { id: 1, name: "John Smith", source: "Instagram", value: 1200, status: 'New' }
];

// SELF-HEALING: If a lead (like John Smith) exists but has no status, give it one.
leads = leads.map(lead => {
    if (!lead.status) lead.status = 'New';
    return lead;
});

// 2. MENU & NAVIGATION LOGIC
function toggleMenu() {
    document.getElementById('side-menu').classList.toggle('open');
}

function showScreen(screenId) {
    // This will be used as we add more screens like ROI Dashboard
    console.log("Navigating to:", screenId);
    toggleMenu(); 
}

// 3. TAB FILTERING LOGIC
function filterLeads(stage) {
    currentFilter = stage;
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.innerText === stage || (stage === 'In-Progress' && tab.innerText === 'Progress')) {
            tab.classList.add('active');
        }
    });
    renderLeads();
}

// 4. RENDERING CARDS TO SCREEN
function renderLeads() {
    const container = document.getElementById('leads-container');
    if (!container) return;
    container.innerHTML = '';

    const filtered = leads.filter(l => l.status === currentFilter);

    filtered.forEach(lead => {
        const card = `
            <div class="lead-card">
                <div class="card-info" onclick="openLeadDetail(${lead.id})">
                    <h3>${lead.name}</h3>
                    <p>${lead.source} • £${lead.value}</p>
                </div>
                <button class="delete-btn" onclick="deleteLead(${lead.id})">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        container.innerHTML += card;
    });
}

// 5. CREATE & DELETE LOGIC
document.getElementById('lead-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const newLead = {
        id: Date.now(),
        name: document.getElementById('lead-name').value,
        source: document.getElementById('lead-source').value,
        value: document.getElementById('lead-value').value,
        status: 'New'
    };
    leads.push(newLead);
    saveData();
    renderLeads();
    this.reset();
    closeModal();
});

function deleteLead(id) {
    
        leads = leads.filter(l => l.id !== id);
        saveData();
        renderLeads();
    }


// 6. LEAD DETAIL & STAGE UPDATING (The New Parts)
function openLeadDetail(id) {
    activeLeadId = id;
    const lead = leads.find(l => l.id === id);
    
    if (lead) {
        document.getElementById('detail-name').innerText = lead.name;
        document.getElementById('detail-status-select').value = lead.status;
        document.getElementById('lead-detail-screen').style.display = 'flex';
    }
}

function closeDetail() {
    document.getElementById('lead-detail-screen').style.display = 'none';
    activeLeadId = null;
}

function updateLeadStatus() {
    const newStatus = document.getElementById('detail-status-select').value;
    const leadIndex = leads.findIndex(l => l.id === activeLeadId);
    
    if (leadIndex !== -1) {
        leads[leadIndex].status = newStatus;
        saveData();
        renderLeads(); // Card moves to the new tab automatically
        closeDetail();
    }
}

// 7. HELPERS
function saveData() {
    localStorage.setItem('myLeads', JSON.stringify(leads));
}

function openModal() { document.getElementById('add-lead-modal').style.display = 'flex'; }
function closeModal() { document.getElementById('add-lead-modal').style.display = 'none'; }

// Initial Render
renderLeads();