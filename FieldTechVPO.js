document.addEventListener("DOMContentLoaded", async function () {
    console.log('DOM fully loaded and parsed');

    const airtableApiKey = 'pata9Iv7DANqtJrgO.b308b33cd0f323601f3fb580aac0d333ca1629dd26c5ebe2e2b9f18143ccaa8e';
    const airtableBaseId = 'appQDdkj6ydqUaUkE';
    const airtableTableName = 'tblO72Aw6qplOEAhR';
    const airtableEndpoint = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`;

    axios.defaults.headers.common['Authorization'] = `Bearer ${airtableApiKey}`;

    let allRecords = [];
    let previousUpdates = {}; // To store the previous state of updates for undo

    async function fetchAllRecords() {
        console.log('Fetching all records from Airtable...');
        let records = [];
        let offset = null;

        do {
            const response = await axios.get(`${airtableEndpoint}?${new URLSearchParams({ offset })}`);
            records = records.concat(response.data.records.map(record => ({
                id: record.id,
                fields: record.fields,
                descriptionOfWork: record.fields['Description of Work']
            })));
            offset = response.data.offset;
        } while (offset);

        console.log(`Total records fetched: ${records.length}`);
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
                    descriptionOfWork: record.fields['Description of Work']
                })));
                offset = response.data.offset || '';
            } while (offset);

            console.log(`Unchecked records fetched successfully: ${records.length} records`);
            allRecords = records;
            displayRecords(records);
        } catch (error) {
            console.error('Error fetching unchecked records:', error);
        } finally {
            hideLoadingMessage();
        }
    }

    function showLoadingMessage() {
        console.log('Showing loading message');
        document.getElementById('loadingMessage').innerText = 'Open VPOs are being loaded...';
        document.getElementById('loadingMessage').style.display = 'block';
        document.getElementById('searchButton').classList.add('hidden');
        document.getElementById('submitUpdates').classList.add('hidden');
        document.getElementById('searchBar').classList.add('hidden');
        document.getElementById('searchBarTitle').classList.add('hidden');
        document.getElementById('undoButton').classList.add('hidden');
    }

    function hideLoadingMessage() {
        console.log('Hiding loading message');
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('searchButton').classList.remove('hidden');
        document.getElementById('submitUpdates').classList.remove('hidden');
        document.getElementById('searchBar').classList.remove('hidden');
        document.getElementById('searchBarTitle').classList.remove('hidden');
        document.getElementById('undoButton').classList.remove('hidden');
    }

    function displayRecords(records) {
        console.log('Displaying records...');
        const recordsContainer = document.getElementById('records');
        recordsContainer.innerHTML = '';

        if (records.length === 0) {
            recordsContainer.innerText = 'No records found.';
            console.log('No records found.');
            return;
        }

        records = sortRecordsWithSpecialCondition(records);

        const tableHeader = `
            <thead>
                <tr>
                    <th>Id Number</th>
                    <th>Vanir Office</th>
                    <th>Job Name</th>
                    <th>Description of Work</th>
                    <th>Field Technician</th>
                    <th>Confirmed Complete</th>
                    <!-- <th>Completed Photo(s)</th> -->
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
        console.log('Sorting records with special condition');
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
            <td class="description-cell">${descriptionOfWork}</td>
            <td>${fieldTechnician}</td>
            <td>
                <label class="custom-checkbox">
                    <input type="checkbox" ${checkboxValue} data-record-id="${record.id}" data-initial-checked="${checkboxValue}">
                    <span class="checkmark"></span>
                </label>
            </td>
            <!-- <td>
                <input type="file" class="file-upload hidden" data-record-id="${record.id}">
            </td> -->
        `;
    
        const checkbox = recordRow.querySelector('input[type="checkbox"]');
        // const fileInput = recordRow.querySelector('.file-upload');
        checkbox.addEventListener('change', handleCheckboxChange);
        // fileInput.addEventListener('change', handleFileSelection);
    
        console.log(`Created row for record ID ${record.id}:`, record);
        return recordRow;
    }

    function handleCheckboxChange(event) {
        const checkbox = event.target;
        const recordId = checkbox.getAttribute('data-record-id');
        const isChecked = checkbox.checked;
        // const fileInput = document.querySelector(`input.file-upload[data-record-id="${recordId}"]`);

        let updates = JSON.parse(localStorage.getItem('updates')) || {};

        if (isChecked) {
            updates[recordId] = true;
            // fileInput.classList.remove('hidden');
            console.log(`Checkbox checked for record ID ${recordId}.`);
        } else {
            delete updates[recordId];
            // fileInput.classList.add('hidden');
            console.log(`Checkbox unchecked for record ID ${recordId}.`);
        }

        localStorage.setItem('updates', JSON.stringify(updates));
        console.log('Current updates:', updates);
    }

    // function handleFileSelection(event) {
    //     const fileInput = event.target;
    //     const recordId = fileInput.getAttribute('data-record-id');
    //     const file = fileInput.files[0]; // Get the first file from the input
    
    //     if (!file) {
    //         console.warn(`No file selected for record ID ${recordId}.`);
    //         return;
    //     }
    
    //     console.log(`File selected for record ID ${recordId}:`, file.name);
    
    //     let fileData = JSON.parse(localStorage.getItem('fileData')) || {};
    //     fileData[recordId] = file;
    //     localStorage.setItem('fileData', JSON.stringify(fileData));
    // }

    async function submitUpdates() {
        console.log('Submitting updates...');
        let updates = JSON.parse(localStorage.getItem('updates')) || {};
        let fileData = JSON.parse(localStorage.getItem('fileData')) || {};
        let updateArray = Object.keys(updates).map(id => ({
            id: id,
            fields: {
                'Field Tech Confirmed Job Complete': updates[id],
                'Field Tech Confirmed Job Completed Date': new Date().toISOString(),
            },
        }));

        if (updateArray.length === 0) {
            console.log('No changes to submit.');
            alert('No changes to submit.');
            return;
        }

        previousUpdates = { ...updates }; // Store the current updates for undo functionality

        try {
            const updatePromises = updateArray.map(async update => {
                const recordId = update.id;
                // const file = fileData[recordId];
                // if (file) {
                //     const formData = new FormData();
                //     formData.append('attachments', file);

                //     const response = await axios.post(`${airtableEndpoint}/${recordId}/attachments`, formData, {
                //         headers: {
                //             Authorization: `Bearer ${airtableApiKey}`
                //         }
                //     });

                //     if (response.status !== 200) {
                //         throw new Error(`Failed to upload file to Airtable for record ID ${recordId}. Status: ${response.status} ${response.statusText}`);
                //     }

                //     const responseData = response.data;
                //     console.log(`Uploaded file for record ID ${recordId} to Airtable. Response:`, responseData);

                //     update.fields['Completed Photo(s)'] = responseData.fields['Completed Photo(s)'];
                //     delete fileData[recordId]; // Remove file from local storage after successful upload
                // }

                const patchUrl = `${airtableEndpoint}/${recordId}`;
                const patchResponse = await axios.patch(patchUrl, { fields: update.fields }, {
                    headers: {
                        Authorization: `Bearer ${airtableApiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log(`Updated record ID ${recordId} in Airtable. Response:`, patchResponse.data);
                return patchResponse.data;
            });

            showLoadingMessage();
            console.log('Submitting updates to Airtable...', updatePromises);
            await Promise.all(updatePromises);
            console.log('Records updated successfully');
            alert('Records updated successfully.');

            localStorage.removeItem('updates');
            localStorage.removeItem('fileData');
            document.getElementById('loadingMessage').innerText = 'Values have been submitted. Repopulating table...';
            await fetchUncheckedRecords();
        } catch (error) {
            console.error('Error updating records:', error.response ? error.response.data : error.message);
            alert(`Error updating records. ${error.response ? error.response.data.error.message : error.message}`);
        } finally {
            hideLoadingMessage();
        }
    }

    async function undoUpdates() {
        console.log('Undoing updates...');
        if (Object.keys(previousUpdates).length === 0) {
            alert('No updates to undo.');
            return;
        }

        const undoPromises = Object.keys(previousUpdates).map(async id => {
            const update = {
                fields: {
                    'Field Tech Confirmed Job Complete': false,
                    'Field Tech Confirmed Job Completed Date': null,
                },
            };

            const patchUrl = `${airtableEndpoint}/${id}`;
            const patchResponse = await axios.patch(patchUrl, update, {
                headers: {
                    Authorization: `Bearer ${airtableApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Undone update for record ID ${id}. Response:`, patchResponse.data);
            return patchResponse.data;
        });

        try {
            showLoadingMessage();
            await Promise.all(undoPromises);
            console.log('Updates undone successfully');
            alert('Updates undone successfully.');

            previousUpdates = {}; // Clear previous updates
            await fetchUncheckedRecords();
        } catch (error) {
            console.error('Error undoing updates:', error.response ? error.response.data : error.message);
            alert(`Error undoing updates. ${error.response ? error.response.data.error.message : error.message}`);
        } finally {
            hideLoadingMessage();
        }
    }

    function filterRecords() {
        const searchTerm = document.getElementById('searchBar').value.toLowerCase();
        const filteredRecords = allRecords.filter(record => {
            const vanirOffice = (record.fields['static Vanir Office'] || '').toLowerCase();
            const jobName = (record.fields['Job Name'] || '').toLowerCase();
            const fieldTechnician = (record.fields['static Field Technician'] || '').toLowerCase();
            const IDNumber = (record.fields['ID Number'] || '').toString().toLowerCase();
            return vanirOffice.includes(searchTerm) || jobName.includes(searchTerm) || fieldTechnician.includes(searchTerm) || IDNumber.includes(searchTerm);
        });
        displayRecords(filteredRecords);
    }

    fetchAllRecords()
        .then(records => {
            console.log('Total records fetched:', records.length);
        })
        .catch(error => {
            console.error('Error fetching records:', error);
        });

    fetchUncheckedRecords();

    document.getElementById('submitUpdates').addEventListener('click', submitUpdates);
    document.getElementById('searchButton').addEventListener('click', filterRecords);
    document.getElementById('undoButton').addEventListener('click', undoUpdates);
});