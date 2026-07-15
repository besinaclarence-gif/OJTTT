// Default users data (including Clarence as initial user)
const DEFAULT_USERS = {
    "besina.clarence@llcc.edu.ph": {
        password: "LLCCITD@008",
        name: "Clarence Besina",
        course: "Bachelor of Science in Information Technology",
        school: "Liceo de Cagayan University",
        timeRecords: {},
        holidays: [],
        documents: { daily: [], weekly: [], monthly: [] }
    }
};

// Global state
let users = {};
let currentUser = null;
let currentDate = new Date();
let selectedDate = null;
let dtrCurrentDate = new Date();

// Initialize app
function initApp() {
    // First, check if we have old data but haven't migrated it
    const oldTimeRecords = localStorage.getItem('timeRecords');
    const hasOldData = oldTimeRecords && Object.keys(JSON.parse(oldTimeRecords)).length > 0;
    const hasNewUsers = localStorage.getItem('ojtUsers');
    
    // If we have old data and either don't have new users or new users have empty data, do migration
    if (hasOldData) {
        const usersData = hasNewUsers ? JSON.parse(localStorage.getItem('ojtUsers')) : null;
        const needsMigration = !usersData || 
            !usersData['besina.clarence@llcc.edu.ph'] || 
            Object.keys(usersData['besina.clarence@llcc.edu.ph'].timeRecords).length === 0;
        
        if (needsMigration) {
            // Force migration
            localStorage.removeItem('ojtUsers');
            localStorage.removeItem('currentUserEmail');
        }
    }
    
    loadUsers();
    
    // Check if user is already logged in
    const savedUserEmail = localStorage.getItem('currentUserEmail');
    if (savedUserEmail && users[savedUserEmail]) {
        loginUser(savedUserEmail, false);
    } else {
        document.getElementById('loginPage').style.display = 'flex';
    }
    
    // Initialize UI event listeners
    setupAuthListeners();
    setupAppListeners();
}

// Load users from localStorage or defaults
function loadUsers() {
    const savedUsers = localStorage.getItem('ojtUsers');
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    } else {
        // Try to migrate old data first!
        const oldTimeRecords = localStorage.getItem('timeRecords');
        const oldHolidays = localStorage.getItem('holidays');
        const oldDocuments = localStorage.getItem('documents');
        
        if (oldTimeRecords || oldHolidays || oldDocuments) {
            // Found old data - migrate it!
            users = { ...DEFAULT_USERS };
            
            if (oldTimeRecords) {
                users['besina.clarence@llcc.edu.ph'].timeRecords = JSON.parse(oldTimeRecords);
            }
            
            if (oldHolidays) {
                users['besina.clarence@llcc.edu.ph'].holidays = JSON.parse(oldHolidays);
            }
            
            if (oldDocuments) {
                users['besina.clarence@llcc.edu.ph'].documents = JSON.parse(oldDocuments);
            }
            
            saveUsers();
        } else {
            // No old data, use defaults
            users = { ...DEFAULT_USERS };
            saveUsers();
        }
    }
}

// Save users to localStorage
function saveUsers() {
    localStorage.setItem('ojtUsers', JSON.stringify(users));
}

// Authentication listeners
function setupAuthListeners() {
    // Tab switching
    document.getElementById('loginTabBtn').addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginTabBtn').classList.add('active');
        document.getElementById('registerTabBtn').classList.remove('active');
    });
    
    document.getElementById('registerTabBtn').addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('loginTabBtn').classList.remove('active');
        document.getElementById('registerTabBtn').classList.add('active');
    });
    
    // Login button
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    
    // Register button
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
}

// Handle login
function handleLogin() {
    const email = document.getElementById('emailInput').value.toLowerCase().trim();
    const password = document.getElementById('passwordInput').value;
    
    if (users[email] && users[email].password === password) {
        loginUser(email, true);
        document.getElementById('loginErrorMessage').style.display = 'none';
    } else {
        document.getElementById('loginErrorMessage').style.display = 'block';
    }
}

// Handle registration
function handleRegister() {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.toLowerCase().trim();
    const password = document.getElementById('registerPassword').value;
    const course = document.getElementById('registerCourse').value.trim();
    const school = document.getElementById('registerSchool').value.trim();
    
    if (!name || !email || !password || !course || !school) {
        document.getElementById('registerErrorMessage').textContent = 'Please fill in all fields';
        document.getElementById('registerErrorMessage').style.display = 'block';
        document.getElementById('registerSuccessMessage').style.display = 'none';
        return;
    }
    
    if (users[email]) {
        document.getElementById('registerErrorMessage').textContent = 'Email already registered';
        document.getElementById('registerErrorMessage').style.display = 'block';
        document.getElementById('registerSuccessMessage').style.display = 'none';
        return;
    }
    
    // Create new user
    users[email] = {
        password: password,
        name: name,
        course: course,
        school: school,
        timeRecords: {},
        holidays: [],
        documents: { daily: [], weekly: [], monthly: [] }
    };
    
    saveUsers();
    
    document.getElementById('registerErrorMessage').style.display = 'none';
    document.getElementById('registerSuccessMessage').style.display = 'block';
    
    // Clear form
    document.getElementById('registerName').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerCourse').value = '';
    document.getElementById('registerSchool').value = '';
}

// Login user and show app
function loginUser(email, saveState = true) {
    currentUser = users[email];
    if (saveState) {
        localStorage.setItem('currentUserEmail', email);
    }
    
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    
    // Update student info in DTR
    document.getElementById('dtrStudentName').textContent = currentUser.name;
    document.getElementById('dtrStudentCourse').textContent = currentUser.course;
    document.getElementById('dtrStudentSchool').textContent = currentUser.school;
    
    renderCalendar();
    updateProgress();
        renderMonthlyTotals();
    renderDocuments();
}

// Logout
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUserEmail');
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    
    // Clear form
    document.getElementById('emailInput').value = '';
    document.getElementById('passwordInput').value = '';
}

// App listeners
function setupAppListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Calendar navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    // Save/Delete buttons
    document.getElementById('saveBtn').addEventListener('click', saveTimeRecord);
    document.getElementById('deleteBtn').addEventListener('click', deleteTimeRecord);
    document.getElementById('toggleHolidayBtn').addEventListener('click', toggleHoliday);
    
    // Tab functionality
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Hide all overlays first
            document.getElementById('reports').style.display = 'none';
            document.getElementById('dtr').style.display = 'none';
            
            if (tabId === 'reports') {
                document.getElementById('reports').style.display = 'flex';
            } else if (tabId === 'dtr') {
                document.getElementById('dtr').style.display = 'flex';
                renderDtrReport();
            }
            
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Close reports when clicking outside content
    document.getElementById('reports').addEventListener('click', (e) => {
        if (e.target === document.getElementById('reports')) {
            closeReports();
        }
    });
    
    // Close DTR when clicking outside content
    document.getElementById('dtr').addEventListener('click', (e) => {
        if (e.target === document.getElementById('dtr')) {
            closeDtr();
        }
    });
    
    // DTR Navigation
    document.getElementById('dtrPrevMonth').addEventListener('click', () => {
        dtrCurrentDate.setMonth(dtrCurrentDate.getMonth() - 1);
        renderDtrReport();
    });
    
    document.getElementById('dtrNextMonth').addEventListener('click', () => {
        dtrCurrentDate.setMonth(dtrCurrentDate.getMonth() + 1);
        renderDtrReport();
    });
    
    // PDF Export
    document.getElementById('exportPdfBtn').addEventListener('click', () => {
        window.print();
    });
}

// Helper functions
function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    let period = 'AM';
    let displayHours = hours;
    
    if (hours >= 12) {
        period = 'PM';
        displayHours = hours > 12 ? hours - 12 : hours;
    }
    
    if (displayHours === 0) displayHours = 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function calculateHours(timeIn, timeOut) {
    const [inH, inM] = timeIn.split(':').map(Number);
    const [outH, outM] = timeOut.split(':').map(Number);
    
    let totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    
    // Subtract 1 hour lunch break if working 6+ hours
    if (totalMinutes >= 360) {
        totalMinutes -= 60;
    }
    
    return parseFloat((totalMinutes / 60).toFixed(2));
}

// Calendar
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('monthYear').textContent = 
        currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    for (let i = 0; i < startingDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell disabled';
        calendarGrid.appendChild(empty);
    }
    
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        if (date.getDay() === 0) {
            cell.classList.add('sunday');
        }
        
        if (currentUser.holidays.includes(dateStr)) {
            cell.classList.add('holiday');
        }
        
        if (currentUser.timeRecords[dateStr]) {
            cell.classList.add('has-data');
        }
        
        if (selectedDate === dateStr) {
            cell.classList.add('selected');
        }
        
        cell.innerHTML = `<div class="date">${day}</div>`;
        
        if (currentUser.timeRecords[dateStr]) {
            const record = currentUser.timeRecords[dateStr];
            cell.innerHTML += `
                <div class="time-display">
                    <div class="time-entry"><span class="time-label">In:</span>${formatTime(record.timeIn)}</div>
                    <div class="time-entry"><span class="time-label">Out:</span>${formatTime(record.timeOut)}</div>
                </div>
                <div class="hours">${record.hours.toFixed(1)}hrs</div>
            `;
        }
        
        cell.addEventListener('click', () => selectDate(dateStr));
        calendarGrid.appendChild(cell);
    }
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    
    const dateParts = dateStr.split('-');
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    
    document.getElementById('selectedDateTitle').textContent = 
        date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    
    if (currentUser.timeRecords[dateStr]) {
        const record = currentUser.timeRecords[dateStr];
        document.getElementById('timeIn').value = record.timeIn;
        document.getElementById('timeOut').value = record.timeOut;
    } else {
        document.getElementById('timeIn').value = '';
        document.getElementById('timeOut').value = '';
    }
    
    const isSunday = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay() === 0;
    document.getElementById('holidaySection').style.display = isSunday ? 'none' : 'flex';
    
    if (currentUser.holidays.includes(dateStr)) {
        document.getElementById('toggleHolidayBtn').textContent = 'Unmark Holiday';
    } else {
        document.getElementById('toggleHolidayBtn').textContent = 'Mark Holiday';
    }
}

function saveTimeRecord() {
    if (!selectedDate) return;
    
    const timeIn = document.getElementById('timeIn').value;
    const timeOut = document.getElementById('timeOut').value;
    
    if (!timeIn || !timeOut) return;
    
    const hours = calculateHours(timeIn, timeOut);
    
    currentUser.timeRecords[selectedDate] = {
        timeIn: timeIn,
        timeOut: timeOut,
        hours: hours
    };
    
    saveUsers();
    renderCalendar();
    updateProgress();
    renderMonthlyTotals();
}

function deleteTimeRecord() {
    if (!selectedDate) return;
    
    delete currentUser.timeRecords[selectedDate];
    saveUsers();
    
    document.getElementById('timeIn').value = '';
    document.getElementById('timeOut').value = '';
    
    renderCalendar();
    updateProgress();
    renderMonthlyTotals();
}

function toggleHoliday() {
    if (!selectedDate) return;
    
    const idx = currentUser.holidays.indexOf(selectedDate);
    if (idx > -1) {
        currentUser.holidays.splice(idx, 1);
        document.getElementById('toggleHolidayBtn').textContent = 'Mark Holiday';
    } else {
        currentUser.holidays.push(selectedDate);
        document.getElementById('toggleHolidayBtn').textContent = 'Unmark Holiday';
    }
    
    saveUsers();
    renderCalendar();
}

// Progress
function updateProgress() {
    let totalHours = 0;
    
    Object.values(currentUser.timeRecords).forEach(record => {
        totalHours += record.hours;
    });
    
    const remaining = Math.max(1800 - totalHours, 0);
    const avgPerDay = Object.keys(currentUser.timeRecords).length > 0 
        ? totalHours / Object.keys(currentUser.timeRecords).length 
        : 0;
    
    document.getElementById('renderedHours').textContent = totalHours.toFixed(1);
    document.getElementById('remainingHours').textContent = remaining.toFixed(1);
    
    // Calculate estimated end date
    if (totalHours > 0 && remaining > 0) {
        const daysNeeded = Math.ceil(remaining / avgPerDay);
        const endDate = new Date();
        let daysAdded = 0;
        while (daysAdded < daysNeeded) {
            endDate.setDate(endDate.getDate() + 1);
            if (endDate.getDay() !== 0) {
                daysAdded++;
            }
        }
        
        document.getElementById('endDateValue').textContent = 
            endDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
}

function getMonthlyTotals() {
    const monthlyTotals = {};

    Object.entries(currentUser.timeRecords).forEach(([dateStr, record]) => {
        const [year, month] = dateStr.split('-');
        const key = `${year}-${month}`;

        if (!monthlyTotals[key]) {
            const monthDate = new Date(Number(year), Number(month) - 1, 1);
            monthlyTotals[key] = {
                label: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                totalHours: 0
            };
        }

        monthlyTotals[key].totalHours += record.hours;
    });

    return Object.entries(monthlyTotals)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([, value]) => value);
}

function renderMonthlyTotals() {
    const monthlyTotals = getMonthlyTotals();
    ['dashboardMonthlyTotalsList', 'monthlyTotalsList'].forEach(listId => {
        const list = document.getElementById(listId);
        if (!list) return;

        list.innerHTML = '';

        if (monthlyTotals.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'monthly-total-empty';
            emptyState.textContent = 'No hours recorded yet.';
            list.appendChild(emptyState);
            return;
        }

        monthlyTotals.forEach(month => {
            const item = document.createElement('div');
            item.className = 'monthly-total-item';

            const label = document.createElement('span');
            label.className = 'monthly-total-label';
            label.textContent = month.label;

            const value = document.createElement('span');
            value.className = 'monthly-total-value';
            value.textContent = `${month.totalHours.toFixed(1)} hrs`;

            item.appendChild(label);
            item.appendChild(value);
            list.appendChild(item);
        });
    });
}

// Documents
function renderDocuments() {
    renderDocumentList('daily');
    renderDocumentList('weekly');
    renderDocumentList('monthly');
}

function renderDocumentList(type) {
    const list = document.getElementById(`${type}List`);
    list.innerHTML = '';
    
    currentUser.documents[type].forEach((doc, idx) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span class="name">${doc.name}</span>
            <div class="actions">
                <button onclick="viewDocument('${type}', ${idx})">View</button>
                <button onclick="deleteDocument('${type}', ${idx})">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentUser.documents[type].push({
            name: file.name,
            type: file.type,
            data: e.target.result
        });
        saveUsers();
        renderDocuments();
    };
    
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        reader.readAsDataURL(file);
    } else {
        reader.readAsDataURL(file);
    }
}

function viewDocument(type, idx) {
    const doc = currentUser.documents[type][idx];
    if (!doc) return;
    
    const modal = document.getElementById('previewModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = doc.name;
    
    if (doc.type === 'application/pdf') {
        modalBody.innerHTML = `<div class="iframe-container"><iframe src="${doc.data}" style="width:100%; height:100%; border: none;"></iframe></div>`;
    } else if (doc.type.startsWith('image/')) {
        modalBody.innerHTML = `<div style="display: flex; justify-content: center;"><img src="${doc.data}" style="max-width: 100%; height: auto; border-radius: 10px;"></div>`;
    } else {
        let fileIcon = '📄';
        let fileType = 'Document';
        if (doc.name.toLowerCase().endsWith('.docx') || doc.name.toLowerCase().endsWith('.doc')) {
            fileIcon = '📝';
            fileType = 'Word Document';
        } else if (doc.name.toLowerCase().endsWith('.xlsx') || doc.name.toLowerCase().endsWith('.xls')) {
            fileIcon = '📊';
            fileType = 'Excel Spreadsheet';
        } else if (doc.name.toLowerCase().endsWith('.pptx') || doc.name.toLowerCase().endsWith('.ppt')) {
            fileIcon = '📽️';
            fileType = 'PowerPoint';
        }
        
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 60px 40px;">
                <div style="font-size: 5rem; margin-bottom: 20px;">${fileIcon}</div>
                <h3 style="color: #333333; margin-bottom: 10px; font-size: 1.5rem;">${fileType}</h3>
                <p style="color: #888; font-size: 1rem; margin-bottom: 30px;">This file type can't be previewed in the browser.</p>
                <p style="color: #666; margin-bottom: 25px;">Download it to view in your preferred application.</p>
                <a href="${doc.data}" download="${doc.name}" class="btn btn-primary" style="display: inline-block; background: linear-gradient(135deg, #333333, #555555); padding: 16px 40px; border-radius: 16px; color: white; text-decoration: none; font-weight: 700; font-size: 1.1rem; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4); transition: all 0.3s;">
                    <span style="margin-right: 10px;">⬇️</span> Download ${fileType}
                </a>
            </div>
        `;
    }
    
    modal.classList.add('active');
}

function deleteDocument(type, idx) {
    currentUser.documents[type].splice(idx, 1);
    saveUsers();
    renderDocuments();
}

function closeModal() {
    document.getElementById('previewModal').classList.remove('active');
}

// Reports
function closeReports() {
    document.getElementById('reports').style.display = 'none';
    document.querySelector('.tab-btn[data-tab="calendar"]').classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="calendar"]').classList.add('active');
}

function closeDtr() {
    document.getElementById('dtr').style.display = 'none';
    document.querySelector('.tab-btn[data-tab="calendar"]').classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="calendar"]').classList.add('active');
}

// DTR Report
function renderDtrReport() {
    const year = dtrCurrentDate.getFullYear();
    const month = dtrCurrentDate.getMonth();
    
    document.getElementById('dtrMonthYear').textContent = 
        dtrCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const tbody = document.getElementById('dtrTableBody');
    tbody.innerHTML = '';
    
    let totalHours = 0;
    let workDaysCount = 0;
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const fullDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const isSunday = date.getDay() === 0;
        const isHoliday = currentUser.holidays.includes(dateStr);
        const hasEntry = currentUser.timeRecords[dateStr];
        
        const tr = document.createElement('tr');
        
        if (hasEntry) {
            tr.classList.add('has-data');
        } else if (isSunday) {
            tr.classList.add('sunday');
        } else if (isHoliday) {
            tr.classList.add('holiday');
        }
        
        const tdDate = document.createElement('td');
        tdDate.textContent = fullDate;
        tr.appendChild(tdDate);
        
        const tdDay = document.createElement('td');
        tdDay.textContent = dayName;
        tr.appendChild(tdDay);
        
        const tdTimeIn = document.createElement('td');
        tdTimeIn.textContent = hasEntry ? formatTime(currentUser.timeRecords[dateStr].timeIn) : '-';
        tr.appendChild(tdTimeIn);
        
        const tdTimeOut = document.createElement('td');
        tdTimeOut.textContent = hasEntry ? formatTime(currentUser.timeRecords[dateStr].timeOut) : '-';
        tr.appendChild(tdTimeOut);
        
        const tdHours = document.createElement('td');
        if (hasEntry) {
            tdHours.textContent = currentUser.timeRecords[dateStr].hours.toFixed(2) + ' hrs';
            tdHours.style.fontWeight = '700';
            tdHours.style.color = '#059669';
            totalHours += currentUser.timeRecords[dateStr].hours;
            workDaysCount++;
        } else {
            tdHours.textContent = '-';
        }
        tr.appendChild(tdHours);
        
        const tdStatus = document.createElement('td');
        if (hasEntry || isHoliday || isSunday) {
            const statusBadge = document.createElement('span');
            statusBadge.classList.add('status-badge');
            
            if (hasEntry) {
                statusBadge.classList.add('status-present');
                statusBadge.textContent = 'Present';
            } else if (isHoliday) {
                statusBadge.classList.add('status-holiday');
                statusBadge.textContent = 'Holiday';
            } else if (isSunday) {
                statusBadge.classList.add('status-sunday');
                statusBadge.textContent = 'Sunday';
            }
            
            tdStatus.appendChild(statusBadge);
        } else {
            tdStatus.textContent = '';
        }
        
        tr.appendChild(tdStatus);
        tbody.appendChild(tr);
    }
    
    document.getElementById('dtrTotalDays').textContent = workDaysCount;
    document.getElementById('dtrTotalHours').textContent = totalHours.toFixed(1);
    document.getElementById('dtrAvgHours').textContent = workDaysCount > 0 ? (totalHours / workDaysCount).toFixed(1) : '0';
    document.getElementById('dtrRemaining').textContent = Math.max(1800 - totalHours, 0).toFixed(1);
    document.getElementById('dtrTotalHoursFooter').textContent = totalHours.toFixed(1) + ' hours';
    renderMonthlyTotals();
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', initApp);
