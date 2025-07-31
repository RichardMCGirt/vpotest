let records = [];
let fetchedRecords = 0;
let totalIncompleteRecords = 0;
let offset = '';
let isLoading = false; 
let techniciansWithRecords = new Set(); 
let currentCheckbox = null; 
let currentRecordId = null;  
let totalRecords = 0;
let isFetching = false;
let currentSearchTerm = '';

const fieldsToFetch = [
  'ID Number',
  'static Vanir Office',
  'Job Name',
  'Description of Work',
  'static Field Technician',
  'Field Tech Confirmed Job Complete'
];
function showLoadingOverlay() {
  document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoadingOverlay() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

document.addEventListener("DOMContentLoaded", async function () {
    const displayNameElement = document.getElementById('displayName');
    const techDropdown = document.getElementById('techDropdown'); 
    const searchBar = document.getElementById('searchBar'); 

    // Airtable config
    const airtableApiKey = 'pata9Iv7DANqtJrgO.b308b33cd0f323601f3fb580aac0d333ca1629dd26c5ebe2e2b9f18143ccaa8e';
    const airtableBaseId = 'appQDdkj6ydqUaUkE';
    const airtableTableName = 'tblO72Aw6qplOEAhR';
    const airtableViewId = 'viwAYuyLBtyoHOxPK'; // ✅ optimized view
const airtableEndpoint = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}?view=${airtableViewId}`;
 // Only fetch these fields
    const fieldsToFetch = [
        'ID Number',
        'static Vanir Office',
        'Job Name',
        'Description of Work',
        'static Field Technician',
        'Field Tech Confirmed Job Complete'
    ];
    // Default headers for axios
    axios.defaults.headers.common['Authorization'] = `Bearer ${airtableApiKey}`;
    const cacheTime = 24 * 60 * 60 * 1000; 
    const lastFetch = localStorage.getItem('lastTechFetchTime');
    const currentTime = new Date().getTime();

    function toggleSearchBarVisibility(recordCount) {
        searchBar.style.display = recordCount < 6 ? 'none' : 'block';
    }

    // --- Search bar filtering ---
  let searchTimeout;
searchBar.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentSearchTerm = searchBar.value.toLowerCase();
        renderTableFromRecords();
    }, 300); // wait 300ms after typing stops
});

    // --- Dropdown population and dedupe ---
    async function fetchTechniciansWithRecords() {
        offset = '';
        techniciansWithRecords = new Set();
        try {
            do {
                const response = await axios.get(`${airtableEndpoint}?offset=${offset}`);
                const pageRecords = response.data.records;
                pageRecords.forEach(record => {
                    const techName = record.fields['static Field Technician'];
                    const isJobComplete = record.fields['Field Tech Confirmed Job Complete'];
                    if (techName && !isJobComplete) {
                        techniciansWithRecords.add(techName);
                    }
                });
                offset = response.data.offset || '';
            } while (offset);
            return Array.from(techniciansWithRecords).sort();
        } catch (error) {
            console.error('Error fetching technicians:', error);
            return [];
        }
    }

    function populateDropdownFromCache(technicians) {
        const uniqueTechs = Array.from(new Set(technicians.filter(Boolean)));
        const previouslySelectedTech = localStorage.getItem('fieldTech') || '';
        techDropdown.innerHTML = `
            <option value="">Select a Technician</option>
            <option value="all">Display All</option>
        `;
        uniqueTechs.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech;
            option.innerText = tech;
            techDropdown.appendChild(option);
        });
        if (previouslySelectedTech) {
            techDropdown.value = previouslySelectedTech;
        }
    }

    async function populateDropdown() {
        const cachedTechnicians = JSON.parse(localStorage.getItem('technicians'));
        let technicians = [];
        if (cachedTechnicians && cachedTechnicians.length > 0) {
            populateDropdownFromCache(cachedTechnicians);
        }
        if (!cachedTechnicians || !lastFetch || currentTime - lastFetch > cacheTime) {
            technicians = await fetchTechniciansWithRecords();
            localStorage.setItem('technicians', JSON.stringify(technicians));
            localStorage.setItem('lastTechFetchTime', currentTime.toString());
            populateDropdownFromCache(technicians);
        }
    }

// --- Fetch all incomplete records from Airtable ---
async function fetchAllIncompleteRecords() {
    showLoadingOverlay(); // Show spinner/overlay while loading

    // Reset state before fetching
    records = [];
    fetchedRecords = 0;
    offset = '';  // Airtable pagination offset
    totalIncompleteRecords = 0;
    isFetching = true;

    // Render empty state while loading
    renderTableFromRecords();

    try {
        // Airtable pagination loop
        do {
            const response = await axios.get(
                `https://api.airtable.com/v0/appQDdkj6ydqUaUkE/tblO72Aw6qplOEAhR`,
                {
                    headers: {
                        Authorization: `Bearer ${airtableApiKey}`
                    },
                    params: {
                        filterByFormula: `NOT({Field Tech Confirmed Job Complete})`,
                        view: "viwAYuyLBtyoHOxPK",
                        fields: fieldsToFetch,
                        offset: offset // ✅ send current offset
                    }
                }
            );

            // Extract records from this page
            const pageRecords = response.data.records
                .filter(record => !record.fields['Field Tech Confirmed Job Complete'])
                .map(record => ({
                    id: record.id,
                    fields: record.fields,
                    descriptionOfWork: record.fields['Description of Work']
                }));

            // Append new page’s records
            records = records.concat(pageRecords);
            fetchedRecords += pageRecords.length;

            // ✅ Save total count as we go
            totalIncompleteRecords = records.length;

            // ✅ Update offset for next loop iteration
            offset = response.data.offset || '';

            console.log(`Fetched ${fetchedRecords} records so far. Next offset: ${offset || 'none'}`);

            // Incremental table render for smoother UX
            renderTableFromRecords();

        } while (offset); // Continue while Airtable provides an offset

    } catch (error) {
        console.error('❌ Error fetching all incomplete records:', error);
    } finally {
        isFetching = false;
        hideLoadingOverlay();

        // Final render after all pages loaded
        renderTableFromRecords();

        console.log(`✅ Finished fetching. Total incomplete records: ${totalIncompleteRecords}`);
    }
}

function renderTableFromRecords() {
    const recordsContainer = document.getElementById('records');
    let filteredRecords = records;

    if (currentSearchTerm) {
        filteredRecords = records.filter(record =>
            Object.values(record.fields).some(val =>
                (val + '').toLowerCase().includes(currentSearchTerm)
            ) ||
            (record.descriptionOfWork || '').toLowerCase().includes(currentSearchTerm)
        );
    }

    if (filteredRecords.length === 0) {
        let warning = document.getElementById('search-warning');
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'search-warning';
            warning.style.color = 'orange';
            warning.style.margin = '1em 0';
            searchBar.parentNode.insertBefore(warning, searchBar.nextSibling);
        }
        warning.innerText = isFetching
            ? 'No matching records found so far. Still loading more—please try again shortly.'
            : 'No matching records found.';
        recordsContainer.innerHTML = '';
        return;
    } else {
        const warning = document.getElementById('search-warning');
        if (warning) warning.style.display = 'none';
    }

    // ✅ Sort by Branch first if multiple branches exist, then by ID Number
    const uniqueBranches = [...new Set(filteredRecords.map(r => r.fields['static Vanir Office']).filter(Boolean))];
    if (uniqueBranches.length > 1) {
        filteredRecords.sort((a, b) => {
            const branchA = a.fields['static Vanir Office'] || '';
            const branchB = b.fields['static Vanir Office'] || '';
            if (branchA !== branchB) return branchA.localeCompare(branchB);

            // fallback: sort by ID Number if same branch
            const idA = parseInt(a.fields['ID Number'], 10);
            const idB = parseInt(b.fields['ID Number'], 10);
            if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
            return (a.fields['ID Number'] || '').localeCompare(b.fields['ID Number'] || '');
        });
    } else {
        filteredRecords = sortRecordsWithSpecialCondition(filteredRecords);
    }

    // ✅ Build table (Branch column always in header, but hidden later if needed)
    const tableHeader = `
        <thead>
            <tr>
                <th style="width: 8%;">ID Number</th>
                <th class="branch-col">Branch</th>
                <th>Job Name</th>
                <th>Description of Work</th>
                <th>Field Technician</th>
                <th style="width: 13%;">Completed</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    recordsContainer.innerHTML = tableHeader;
    const tableBody = recordsContainer.querySelector('tbody');

    filteredRecords.forEach((record) => {
        const recordRow = createRecordRow(record);
        tableBody.appendChild(recordRow);
    });

    // ✅ Hide Branch column completely if only one branch
    const branchHeader = recordsContainer.querySelector('th.branch-col');
    const branchCells = recordsContainer.querySelectorAll('td.branch-cell');
    if (uniqueBranches.length <= 1) {
        branchHeader.style.display = 'none';
        branchCells.forEach(cell => (cell.style.display = 'none'));
    } else {
        branchHeader.style.display = '';
        branchCells.forEach(cell => (cell.style.display = ''));
    }
}

function createRecordRow(record) {
    const recordRow = document.createElement('tr');
    const IDNumber = record.fields['ID Number'] || '';
    const vanirOffice = record.fields['static Vanir Office'] || '';
    const jobName = record.fields['Job Name'] || '';
    const fieldTechnician = record.fields['static Field Technician'] || '';
    const fieldTechConfirmedComplete = record.fields['Field Tech Confirmed Job Complete'];
    const checkboxValue = fieldTechConfirmedComplete ? 'checked' : '';
    const descriptionOfWork = record.descriptionOfWork || '';

    recordRow.innerHTML = `
        <td>${IDNumber}</td>
        <td class="branch-cell">${vanirOffice}</td>
        <td>${jobName}</td>
        <td>${descriptionOfWork}</td>
        <td>${fieldTechnician}</td>
        <td class="completed-cell" style="cursor: pointer;">
            <label class="custom-checkbox" style="width:100%;height:100%;display:block;">
                <input type="checkbox" ${checkboxValue} data-record-id="${record.id}" data-initial-checked="${checkboxValue}">
                <span class="checkmark"></span>
            </label>
        </td>
    `;

    const completedTd = recordRow.querySelector('td.completed-cell');
    const checkbox = completedTd.querySelector('input[type="checkbox"]');

    completedTd.addEventListener('click', function(e) {
        if (e.target !== checkbox) {
            checkbox.click();
        }
    });

    checkbox.addEventListener('click', handleCheckboxClick);

    return recordRow;
}



async function fetchRecordsForTech(fieldTech) {
    showLoadingOverlay();
    records = [];
    fetchedRecords = 0;
    offset = '';
    totalIncompleteRecords = 0;

    try {
        const filterByFormula = `SEARCH("${fieldTech}", {static Field Technician})`;

        do {
            const response = await axios.get(
                `https://api.airtable.com/v0/appQDdkj6ydqUaUkE/tblO72Aw6qplOEAhR`,
                {
                    headers: {
                        Authorization: `Bearer ${airtableApiKey}`
                    },
                    params: {
                        filterByFormula: filterByFormula,
                        view: "viwAYuyLBtyoHOxPK", // ✅ use your custom view
                        fields: fieldsToFetch,   // ✅ only return necessary fields
                        offset: offset           // ✅ pagination
                    }
                }
            );

            const pageRecords = response.data.records
                .filter(record => !record.fields['Field Tech Confirmed Job Complete'])
                .map(record => ({
                    id: record.id,
                    fields: record.fields,
                    descriptionOfWork: record.fields['Description of Work']
                }));

            records = records.concat(pageRecords);
            fetchedRecords += pageRecords.length;
            offset = response.data.offset || '';
        } while (offset);

        renderTableFromRecords()(records);
        toggleSearchBarVisibility(records.length);
        hideFieldTechnicianColumnIfMatches();

    } catch (error) {
        console.error(`Error fetching records for technician ${fieldTech}:`, error);
    } finally {
        hideLoadingOverlay();
    }
}


    function sortRecordsWithSpecialCondition(records) {
        return records.sort((a, b) => {
            const idA = a.fields['ID Number'] || '';
            const idB = b.fields['ID Number'] || '';
            const numA = parseInt(idA, 10);
            const numB = parseInt(idB, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return idA.localeCompare(idB);
        });
    }

function createRecordRow(record) {
    const recordRow = document.createElement('tr');
    const IDNumber = record.fields['ID Number'] || '';
    const vanirOffice = record.fields['static Vanir Office'] || '';
    const jobName = record.fields['Job Name'] || '';
    const fieldTechnician = record.fields['static Field Technician'] || '';
    const fieldTechConfirmedComplete = record.fields['Field Tech Confirmed Job Complete'];
    const checkboxValue = fieldTechConfirmedComplete ? 'checked' : '';
    const descriptionOfWork = record.descriptionOfWork || '';

    recordRow.innerHTML = `
        <td>${IDNumber}</td>
        <td>${vanirOffice}</td>
        <td>${jobName}</td>
        <td>${descriptionOfWork}</td>
        <td>${fieldTechnician}</td>
        <td class="completed-cell" style="cursor: pointer;">
            <label class="custom-checkbox" style="width:100%;height:100%;display:block;">
                <input type="checkbox" ${checkboxValue} data-record-id="${record.id}" data-initial-checked="${checkboxValue}">
                <span class="checkmark"></span>
            </label>
        </td>
    `;

    // Get references to checkbox and completed cell
    const completedTd = recordRow.querySelector('td.completed-cell');
    const checkbox = completedTd.querySelector('input[type="checkbox"]');

    // Handler for clicking anywhere in the cell
    completedTd.addEventListener('click', function(e) {
        // Only trigger if not already clicking the checkbox itself
        if (e.target !== checkbox) {
            checkbox.click();
        }
    });

    // Handler for checkbox itself (modal logic etc)
    checkbox.addEventListener('click', handleCheckboxClick);

    return recordRow;
}

    // --- Hide field tech/branch column ---
    function hideFieldTechnicianColumnIfMatches() {
        const selectedTech = techDropdown.value;
        const fieldTechHeader = document.querySelector('th:nth-child(5)');
        const branchHeader = document.querySelector('th:nth-child(2)');
        const fieldTechCells = document.querySelectorAll('td:nth-child(5)');
        const branchCells = document.querySelectorAll('td:nth-child(2)');
        if (!fieldTechHeader || !branchHeader) return;
        if (selectedTech === "all") {
            fieldTechHeader.style.display = '';
            fieldTechCells.forEach(cell => { cell.style.display = ''; });
            branchHeader.style.display = '';
            branchCells.forEach(cell => { cell.style.display = ''; });
        } else {
            fieldTechHeader.style.display = 'none';
            fieldTechCells.forEach(cell => { cell.style.display = 'none'; });
            branchHeader.style.display = 'none';
            branchCells.forEach(cell => { cell.style.display = 'none'; });
        }
    }

    // --- Checkbox/modal logic ---
    const modal = document.getElementById('modal');
    const yesButton = document.getElementById('yesButton');
    const noButton = document.getElementById('noButton');

 function handleCheckboxClick(event) {
    currentCheckbox = event.target;
    currentRecordId = currentCheckbox.getAttribute('data-record-id');
    const isChecked = currentCheckbox.checked;

    if (!isChecked) {
        // ✅ Unchecking: update immediately
        submitUpdate(currentRecordId, false);
        modal.style.display = 'none';
    } else {
        // ✅ Checking: always confirm
        modal.style.display = 'block';
    }

    // Keep the attribute updated for consistency
    currentCheckbox.setAttribute('data-initial-checked', isChecked);
}

// ✅ Yes button → confirm and update Airtable
yesButton.addEventListener('click', () => {
    console.log("✅ Yes clicked, updating record:", currentRecordId);
    submitUpdate(currentRecordId, true);
    modal.style.display = 'none';
});


// ✅ No button → cancel check and revert UI
noButton.addEventListener('click', () => {
    if (currentCheckbox) currentCheckbox.checked = false;
    modal.style.display = 'none';
});

async function submitUpdate(recordId, isChecked) {
    try {
        // Patch Airtable record
        await axios.patch(
            `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}/${recordId}`,
            {
                fields: {
                    "Field Tech Confirmed Job Complete": isChecked
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${airtableApiKey}`,
                    "Content-Type": "application/json"
                }
            }
        );

        // Update checkbox UI
        updateCheckboxUI(recordId, isChecked);

        // Optionally, remove the row from the table if it's completed
        if (isChecked) {
            const row = document.querySelector(`input[data-record-id="${recordId}"]`)?.closest("tr");
            if (row) {
                row.style.transition = "opacity 0.4s";
                row.style.opacity = "0";
                setTimeout(() => row.remove(), 400); 
            }
        }

console.log(`✅ Record ${recordId} updated successfully`);

// ✅ Show toast notification with job name or ID
const recordRow = document.querySelector(`input[data-record-id="${recordId}"]`)?.closest("tr");
const jobName = recordRow ? recordRow.querySelector("td:nth-child(3)")?.textContent : `Record ${recordId}`;
showToast(`✅ Completed: ${jobName}`);
    } catch (error) {
        console.error('❌ Error updating record:', error);
        
        // Rollback checkbox if Airtable update fails
        const checkbox = document.querySelector(`input[data-record-id="${recordId}"]`);
        if (checkbox) checkbox.checked = !isChecked;
    }
}

    function updateCheckboxUI(recordId, isChecked) {
        const checkbox = document.querySelector(`input[data-record-id="${recordId}"]`);
        if (checkbox) {
            checkbox.checked = isChecked;
            const row = checkbox.closest('tr');
            const statusCell = row.querySelector('.status-cell');
            if (statusCell) {
                statusCell.textContent = isChecked ? 'Complete' : 'Incomplete';
            }
        }
    }

    // --- Only one dropdown change listener! ---
    techDropdown.addEventListener('change', async () => {
        const selectedTech = techDropdown.value;
        localStorage.setItem('fieldTech', selectedTech || "all");
        displayNameElement.innerText = selectedTech && selectedTech !== "all" ? `Logged in as: ${selectedTech}` : '';
        if (selectedTech === "all" || !selectedTech) {
            await fetchAllIncompleteRecords();
        } else {
            await fetchRecordsForTech(selectedTech);
        }
        hideFieldTechnicianColumnIfMatches();
    });
    showLoadingOverlay();

    // --- Page load: only fetch once! ---
    await populateDropdown();
    const storedTech = localStorage.getItem('fieldTech') || "all";
    if (storedTech === "all" || !storedTech) {
        await fetchAllIncompleteRecords();
    } else {
        await fetchRecordsForTech(storedTech);
    }
    hideFieldTechnicianColumnIfMatches();
});

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "toast show";

    setTimeout(() => {
        toast.className = "toast"; // hide again after 3 seconds
    }, 3000);
}
