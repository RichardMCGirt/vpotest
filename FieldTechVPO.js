document.addEventListener("DOMContentLoaded", async function () {
    console.log('DOM fully loaded and parsed');

    const airtableApiKey = 'pata9Iv7DANqtJrgO.b308b33cd0f323601f3fb580aac0d333ca1629dd26c5ebe2e2b9f18143ccaa8e';
    const airtableBaseId = 'appQDdkj6ydqUaUkE';
    const airtableTableName = 'tblO72Aw6qplOEAhR';
    const airtableEndpoint = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`;

    axios.defaults.headers.common['Authorization'] = `Bearer ${airtableApiKey}`;

    let allRecords = [];

    const modal = document.getElementById('confirmationModal');
    const yesButton = document.getElementById('yesButton');
    const noButton = document.getElementById('noButton');

    async function fetchAllRecords() {
        let records = [];
        let offset = null;

        do {
            try {
                const response = await fetch(`${airtableEndpoint}?${new URLSearchParams({ offset })}`, {
                    headers: {
                        Authorization: `Bearer ${airtableApiKey}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Error fetching records: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();

                if (!data.records) {
                    throw new Error('No records found in the response.');
                }

                records = records.concat(data.records.map(record => ({
                    id: record.id,
                    fields: record.fields,
                    descriptionOfWork: record.fields['Description of Work'] // Fetch 'Description of Work' field
                })));
                offset = data.offset;
            } catch (error) {
                console.error('Error fetching records:', error);
                break; // Stop the loop if there's an error
            }
        } while (offset);

        return records;
    }

    async function fetchUncheckedRecords() {
        try {
            showLoadingMessage();
            console.log('Fetching unchecked records from Airtable...');
            const filterByFormula = 'NOT({Field Tech Confirmed Job Complete})';
            let records = [];
            let offset = '';

            do {
                const response = await axios.get(`${airtableEndpoint}?filterByFormula=${encodeURIComponent(filterByFormula)}&offset=${offset}`);
                records = records.concat(response.data.records.map(record => ({
                    id: record.id,
                    fields: record.fields,
                    descriptionOfWork: record.fields['Description of Work'] // Fetch 'Description of Work' field
                })));
                offset = response.data.offset || '';
            } while (offset);

            console.log('Unchecked records fetched successfully:', records);
            allRecords = records;
            displayRecords(records);
        } catch (error) {
            console.error('Error fetching unchecked records:', error);
        } finally {
            hideLoadingMessage();
        }
    }

    function showLoadingMessage() {
        document.getElementById('loadingMessage').innerText = 'Open VPOs are being loaded...';
        document.getElementById('loadingMessage').style.display = 'block';
        document.getElementById('searchButton').classList.add('hidden');
        document.getElementById('searchBar').classList.add('hidden');
        document.getElementById('searchBarTitle').classList.add('hidden');
    }

    function hideLoadingMessage() {
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('searchButton').classList.remove('hidden');
        document.getElementById('searchBar').classList.remove('hidden');
        document.getElementById('searchBarTitle').classList.remove('hidden');
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
            <tbody>
            </tbody>
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

        // If the checkbox is not initially checked and user checks it, show the custom modal for confirmation
        if (!initialChecked && isChecked) {
            modal.style.display = 'block'; // Show the modal
        }
    }

    yesButton.addEventListener('click', () => {
        // If confirmed, submit the update to Airtable
        submitUpdate(currentRecordId, true);
        modal.style.display = 'none'; // Hide the modal after action
    });

    noButton.addEventListener('click', () => {
        // If not confirmed, revert the checkbox to its initial state
        currentCheckbox.checked = false;
        modal.style.display = 'none'; // Hide the modal
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
            location.reload(); // Refresh the page after successful submission

        } catch (error) {
            console.error('Error updating record:', error);
            alert(`Error updating record ID ${recordId}. Please try again.`);
        }
    }

    // Real-time search filtering
    document.getElementById('searchBar').addEventListener('input', (event) => {
        const searchTerm = event.target.value;
        filterRecords(searchTerm);
    });

    function filterRecords(searchTerm) {
        const filteredRecords = allRecords.filter(record => {
            const idNumber = record.fields['ID Number'] ? record.fields['ID Number'].toString().toLowerCase() : '';
            const vanirOffice = record.fields['static Vanir Office'] ? record.fields['static Vanir Office'].toLowerCase() : '';
            const jobName = record.fields['Job Name'] ? record.fields['Job Name'].toLowerCase() : '';
            const descriptionOfWork = record.fields['Description of Work'] ? record.fields['Description of Work'].toLowerCase() : '';
            const fieldTechnician = record.fields['static Field Technician'] ? record.fields['static Field Technician'].toLowerCase() : '';
    
            return idNumber.includes(searchTerm.toLowerCase()) ||
                   vanirOffice.includes(searchTerm.toLowerCase()) ||
                   jobName.includes(searchTerm.toLowerCase()) ||
                   descriptionOfWork.includes(searchTerm.toLowerCase()) ||
                   fieldTechnician.includes(searchTerm.toLowerCase());
        });
    
        displayRecords(filteredRecords);
    }
    
    fetchUncheckedRecords();
    });
    
