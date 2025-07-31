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
        // Show warning if still loading
        let warning = document.getElementById('search-warning');
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'search-warning';
            warning.style.color = 'orange';
            warning.style.margin = '1em 0';
            searchBar.parentNode.insertBefore(warning, searchBar.nextSibling);
        }
        if (isFetching) {
            warning.innerText = 'No matching records found so far. Still loading more—please try again shortly.';
            warning.style.display = '';
        } else {
            warning.innerText = 'No matching records found so far. Still loading more—please try again shortly.';
            warning.style.display = '';
        }
        recordsContainer.innerHTML = '';
        return;
    } else {
        const warning = document.getElementById('search-warning');
        if (warning) warning.style.display = 'none';
    }

    // Build table as before, but from filteredRecords
  // Build table as before, but from filteredRecords
filteredRecords = sortRecordsWithSpecialCondition(filteredRecords);
const tableHeader = `
    <thead>
        <tr>
            <th style="width: 8%;">ID Number</th>
            <th>Branch</th>
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

// 🚀 instant row render (no fade-in)
filteredRecords.forEach((record) => {
    const recordRow = createRecordRow(record);
    tableBody.appendChild(recordRow);
});

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
        const initialChecked = currentCheckbox.getAttribute('data-initial-checked') === 'true';
        if (!isChecked) {
            submitUpdate(currentRecordId, false);
            modal.style.display = 'none';
        } else if (!initialChecked && isChecked) {
            modal.style.display = 'block';
        }
        currentCheckbox.setAttribute('data-initial-checked', isChecked);
    }
    yesButton.addEventListener('click', () => {
        submitUpdate(currentRecordId, true);
        modal.style.display = 'none';
    });
    noButton.addEventListener('click', () => {
        if (currentCheckbox) currentCheckbox.checked = false;
        modal.style.display = 'none';
    });

async function submitUpdate(recordId, isChecked) {
    try {
        // Patch Airtable record
        await axios.patch(`${airtableEndpoint}/${recordId}`, {
            fields: {
                'Field Tech Confirmed Job Complete': isChecked,
                'Field Tech Confirmed Job Completed Date': isChecked ? new Date().toISOString() : null
            }
        });

        // Update checkbox UI
        updateCheckboxUI(recordId, isChecked);

        // Optionally, remove the row from the table if it's completed
        if (isChecked) {
            const row = document.querySelector(`input[data-record-id="${recordId}"]`)?.closest("tr");
            if (row) {
                row.style.transition = "opacity 0.4s";
                row.style.opacity = "0";
                setTimeout(() => row.remove(), 400); // remove row after fade-out
            }
        }

        console.log(`✅ Record ${recordId} updated successfully`);
    } catch (error) {
        console.error('❌ Error updating record:', error);
        alert("Failed to update record. Please try again.");
        
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
