document.addEventListener("DOMContentLoaded", async function () {
    console.log('DOM fully loaded and parsed');

    const airtableApiKey = 'pata9Iv7DANqtJrgO.b308b33cd0f323601f3fb580aac0d333ca1629dd26c5ebe2e2b9f18143ccaa8e';
    const airtableBaseId = 'appQDdkj6ydqUaUkE';
    const airtableTableName = 'tblO72Aw6qplOEAhR';
    const airtableEndpoint = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`;

    axios.defaults.headers.common['Authorization'] = `Bearer ${airtableApiKey}`;

    let allRecords = [];

    // Create a div for the validation message
    const validationMessageDiv = document.createElement('div');
    validationMessageDiv.id = 'validationMessage';
    validationMessageDiv.style.display = 'none'; // Hide initially
    validationMessageDiv.style.color = 'red'; // Set color to red for error message
    document.body.appendChild(validationMessageDiv); // Append to the body

    async function fetchAllRecords() {
        let records = [];
        let offset = null;

        do {
            const response = await fetch(`${airtableEndpoint}?${new URLSearchParams({ offset })}`, {
                headers: {
                    Authorization: `Bearer ${airtableApiKey}`
                }
            });

            const data = await response.json();
            records = records.concat(data.records.map(record => ({
                id: record.id,
                fields: record.fields,
                descriptionOfWork: record.fields['Description of Work'] // Fetch 'Description of Work' field
            })));
            offset = data.offset;
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
                    <th>Branch</th>
                    <th>Job Name</th>
                    <th>Description of Work</th>
                    <th>Field Technician</th>
                    <th>Confirmed Complete</th>
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
        const vanirOffice = record.fields['static Vanir Office'] || '';
        const jobName = record.fields['Job Name'] || '';
        const fieldTechnician = record.fields['static Field Technician'] || '';
        const fieldTechConfirmedComplete = record.fields['Field Tech Confirmed Job Complete'];
        const checkboxValue = fieldTechConfirmedComplete ? 'checked' : '';
        const descriptionOfWork = record.descriptionOfWork || '';

        recordRow.innerHTML = `
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

        // Add event listener for click instead of blur
        checkbox.addEventListener('click', handleCheckboxClick);

        return recordRow;
    }

    function handleCheckboxClick(event) {
        const checkbox = event.target;
        const recordId = checkbox.getAttribute('data-record-id');
        const isChecked = checkbox.checked;

        let updates = JSON.parse(localStorage.getItem('updates')) || {};

        // Validation: Only submit if there is a change
        const initialChecked = checkbox.getAttribute('data-initial-checked') === 'checked';

        if (initialChecked !== isChecked) {
            const confirmation = window.confirm("Are you sure you want to mark this as complete?");
            if (confirmation) {
                updates[recordId] = isChecked;
                localStorage.setItem('updates', JSON.stringify(updates));
                submitUpdate(recordId, isChecked);
                validationMessageDiv.style.display = 'none'; // Hide validation message if confirmed
            } else {
                // If user clicks "No", revert the checkbox to its initial state
                checkbox.checked = initialChecked;
                validationMessageDiv.innerText = "Action canceled.";
                validationMessageDiv.style.display = 'block'; // Show validation message
            }
        } else {
            validationMessageDiv.innerText = "No changes detected.";
            validationMessageDiv.style.display = 'block'; // Show validation message if no change is detected
        }
    }

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
    
            // Refresh the page after successful submission
            location.reload();
            
        } catch (error) {
            console.error('Error updating record:', error);
            alert(`Error updating record ID ${recordId}. Please try again.`);
        }
    }
    

    fetchAllRecords()
        .then(records => {
            console.log('Total records fetched:', records.length);
            console.log(records);
        })
        .catch(error => {
            console.error('Error fetching records:', error);
        });

    fetchUncheckedRecords();
});
