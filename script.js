function showScreen(screenId) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.style.display = 'none';
    });

    // Show the requested screen
    document.getElementById(screenId).style.display = 'block';
}

function openModal() {
    document.getElementById('add-lead-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('add-lead-modal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('add-lead-modal');
    if (event.target === modal) {
        closeModal();
    }
}   