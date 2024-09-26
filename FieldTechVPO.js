document.addEventListener("DOMContentLoaded", async function () {
    console.log('DOM fully loaded and parsed');

    const storedTech = localStorage.getItem('fieldTech');
    const displayNameElement = document.getElementById('displayName');
    const changeNameButton = document.getElementById('changeNameButton');

    if (!storedTech) {
        const techName = prompt("Please enter your name or ID:");
        localStorage.setItem('fieldTech', techName);
    }

    const fieldTech = localStorage.getItem('fieldTech');
    displayNameElement.innerText = `Logged in as: ${fieldTech}`;

    changeNameButton.addEventListener('click', () => {
        const newName = prompt("Enter your name to only see your records:");
        if (newName) {
            localStorage.setItem('fieldTech', newName);
            displayNameElement.innerText = `Logged in as: ${newName}`;
            fetchRecordsForTech(newName); // Re-fetch records for the new technician.
        }
    });

    const airtableApiKey = 'pata9Iv7DANqtJrgO.b308b33cd0f323601f3fb580aac0d333ca1629dd26c5ebe2e2b9f18143ccaa8e';
    const airtableBaseId = 'appQDdkj6ydqUaUkE';
    const airtableTableName = 'tblO72Aw6qplOEAhR';
    const airtableEndpoint = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`;

    axios.defaults.headers.common['Authorization'] = `Bearer ${airtableApiKey}`;

    let allRecords = [];
    let technicianRecords = []; // Store records fetched for the logged-in technician

    const modal = document.getElementById('confirmationModal');
    const yesButton = document.getElementById('yesButton');
    const noButton = document.getElementById('noButton');
    const searchBar = document.getElementById('searchBar');

    // Fetch records for the logged-in technician initially
    async function fetchRecordsForTech(fieldTech) {
        try {
            showLoadingMessage();
            console.log(`Fetching records for ${fieldTech} from Airtable...`);

            const filterByFormula = `SEARCH("${fieldTech}", {static Field Technician})`;
            let records = [];
            let offset = '';

            do {
                const response = await axios.get(`${airtableEndpoint}?filterByFormula=${encodeURIComponent(filterByFormula)}&offset=${offset}`);
                records = records.concat(response.data.records.map(record => ({
                    id: record.id,
                    fields: record.fields,
                    descriptionOfWork: record.fields['Description of Work']
                })));
                offset = response.data.offset || '';
            } while (offset);

            console.log('Technician records fetched successfully:', records);
            technicianRecords = records.filter(record => !record.fields['Field Tech Confirmed Job Complete']); // Only show incomplete records
            displayRecords(technicianRecords); // Initially display only the technician's incomplete records
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            hideLoadingMessage();
        }
    }

    // Fetch all records (only when the search bar is used)
    async function fetchAllRecords() {
        try {
            showLoadingMessage();
            console.log('Fetching all records from Airtable...');

            let records = [];
            let offset = '';

            do {
                const response = await axios.get(`${airtableEndpoint}?offset=${offset}`);
                records = records.concat(response.data.records.map(record => ({
                    id: record.id,
                    fields: record.fields,
                    descriptionOfWork: record.fields['Description of Work']
                })));
                offset = response.data.offset || '';
            } while (offset);

            console.log('All records fetched successfully:', records);
            allRecords = records.filter(record => !record.fields['Field Tech Confirmed Job Complete']); // Filter for incomplete records
            filterRecords(searchBar.value.toLowerCase()); // Apply the current search filter once all records are fetched
        } catch (error) {
            console.error('Error fetching all records:', error);
        } finally {
            hideLoadingMessage();
        }
    }

    function showLoadingMessage() {
        document.getElementById('loadingMessage').innerText = 'Loading records...';
        document.getElementById('loadingMessage').style.display = 'block';
    }

    function hideLoadingMessage() {
        document.getElementById('loadingMessage').style.display = 'none';
    }

    function displayRecords(records) {
        console.log('Displaying records...');
        const recordsContainer = document.getElementById('records');
        recordsContainer.innerHTML = '';

        if (records.length === 0) {
            recordsContainer.innerText = 'No records found.';
            return;
        }

        records = sortRecordsWithSpecialCondition(records);

        const tableHeader = `
            <thead>
                <tr>
                    <th style="width: 8%;">ID Number</th>
                    <th>Branch</th>
                    <th>Job Name</th>
                    <th>Description of Work</th>
                    <th>Field Technician</th>
                    <th style="width: 13%;">Confirmed Complete</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        recordsContainer.innerHTML = tableHeader;
        const tableBody = recordsContainer.querySelector('tbody');

        records.forEach(record => {
            const recordRow = createRecordRow(record);
            tableBody.appendChild(recordRow);
        });

        console.log(`Total number of entries displayed: ${records.length}`);
    }

    function sortRecordsWithSpecialCondition(records) {
        return records.sort((a, b) => {
            const officeA = a.fields['static Vanir Office'] || '';
            const officeB = b.fields['static Vanir Office'] || '';
            const techA = a.fields['static Field Technician'] || '';
            const techB = b.fields['static Field Technician'] || '';

            if (officeA === 'Greensboro' && officeB === 'Greenville, SC') return -1;
            if (officeA === 'Greenville, SC' && officeB === 'Greensboro') return 1;

            const primarySort = officeA.localeCompare(officeB);
            if (primarySort !== 0) return primarySort;

            return techA.localeCompare(techB);
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
            <td>
                <label class="custom-checkbox">
                    <input type="checkbox" ${checkboxValue} data-record-id="${record.id}" data-initial-checked="${checkboxValue}">
                    <span class="checkmark"></span>
                </label>
            </td>
        `;

        const checkbox = recordRow.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('click', handleCheckboxClick);

        return recordRow;
    }

    function handleCheckboxClick(event) {
        currentCheckbox = event.target;
        currentRecordId = currentCheckbox.getAttribute('data-record-id');
        const isChecked = currentCheckbox.checked;
        const initialChecked = currentCheckbox.getAttribute('data-initial-checked') === 'checked';

        if (!initialChecked && isChecked) {
            modal.style.display = 'block';
        }
    }

    yesButton.addEventListener('click', () => {
        submitUpdate(currentRecordId, true);
        modal.style.display = 'none';
    });

    noButton.addEventListener('click', () => {
        currentCheckbox.checked = false;
        modal.style.display = 'none';
    });

    async function submitUpdate(recordId, isChecked) {
        console.log(`Submitting update for record ID ${recordId}...`);

        try {
            await axios.patch(`${airtableEndpoint}/${recordId}`, {
                fields: {
                    'Field Tech Confirmed Job Complete': isChecked,
                    'Field Tech Confirmed Job Completed Date': new Date().toISOString()
                }
            });

            console.log(`Record ID ${recordId} updated successfully.`);
            alert(`Record ID ${recordId} updated successfully.`);
            location.reload();

        } catch (error) {
            console.error('Error updating record:', error);
            alert(`Error updating record ID ${recordId}. Please try again.`);
        }
    }

    // Trigger fetching of all records when typing in the search bar
    document.getElementById('searchBar').addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase();
        if (searchTerm.length > 0) {
            // If the search bar is not empty, fetch all records
            fetchAllRecords();
        } else {
            // If the search bar is cleared, show the technician's incomplete records again
            displayRecords(technicianRecords);
        }
    });

    // Filter records based on the search term
    function filterRecords(searchTerm) {
        const filteredRecords = allRecords.filter(record => {
            const idNumber = record.fields['ID Number'] ? record.fields['ID Number'].toString().toLowerCase() : '';
            const vanirOffice = record.fields['static Vanir Office'] ? record.fields['static Vanir Office'].toLowerCase() : '';
            const jobName = record.fields['Job Name'] ? record.fields['Job Name'].toLowerCase() : '';
            const descriptionOfWork = record.fields['Description of Work'] ? record.fields['Description of Work'].toLowerCase() : '';
            const fieldTechnician = record.fields['static Field Technician'] ? record.fields['static Field Technician'].toLowerCase() : '';

            return idNumber.includes(searchTerm) ||
                vanirOffice.includes(searchTerm) ||
                jobName.includes(searchTerm) ||
                descriptionOfWork.includes(searchTerm) ||
                fieldTechnician.includes(searchTerm);
        });

        displayRecords(filteredRecords);
    }

    // Fetch records for the logged-in technician on page load
    fetchRecordsForTech(fieldTech);
});
